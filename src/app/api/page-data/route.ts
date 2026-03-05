/**
 * Page Data API — page-configs SSOT
 *
 * GET /api/page-data?page=/proteksi/asset
 * GET /api/page-data?page=/asset-maps&sheet=MASTER ASSET TOWER
 * GET /api/page-data?page=/asset-maps&sheet=MASTER ASSET TOWER&refresh=true
 *
 * Single Source of Truth: unified registry (spreadsheet-config.json) via pageBindings
 *   - Which spreadsheet + sheet to fetch
 *   - Which columns are "connected" (columnsUsed)
 *
 * Returns 404 if page has no config — user must configure via Data Connector first.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import {
    loadPageConfig,
    loadRegistryRoot,
} from "@/lib/data-source-registry";
import { ApiCache } from "@/lib/api-cache";

// Cache: 5 min (Next.js ISR level)
export const revalidate = 300;

/* ── Dev-only logging (fix m3: no console.log spam in production) ── */
const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };

/* ── Google Sheets Client (singleton) ── */
let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function getClient() {
    if (sheetsClient) return sheetsClient;
    const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_CREDS_PATH,
        scopes: [...GOOGLE_SCOPES],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
    return sheetsClient;
}

/* ── In-memory cache: page::sheet → data (fetch-once, manual refresh) ── */
const pageDataCache = new Map<string, ApiCache<SheetResult>>();

function getCacheKey(page: string, sheet?: string): string {
    return sheet ? `${page}::${sheet}` : page;
}

function getOrCreateCache(key: string): ApiCache<SheetResult> {
    let cache = pageDataCache.get(key);
    if (!cache) {
        cache = new ApiCache<SheetResult>();
        pageDataCache.set(key, cache);
    }
    return cache;
}

interface SheetResult {
    sheetName: string;
    spreadsheetTitle: string;
    spreadsheetId: string;
    hierarchyMapping: Record<string, string> | null;
    hierarchyPresent: string[];
    columnsConnected: string[];
    headers: string[];
    rows: Record<string, string>[];
    rowCount: number;
    missingColumns: { name: string; configPos: string; reason: string }[];
    error: string | null;
}

/**
 * Column config from per-page JSON.
 * `name` = source of truth (must match actual header in sheet).
 * `pos`  = optimization hint (check this position first before scanning).
 */
interface ColumnPosition {
    name: string;
    pos: string;
}

/** Columns that could not be found in the actual sheet */
interface MissingColumn {
    name: string;
    configPos: string;          // pos from config (hint that failed)
    reason: "not_found" | "header_mismatch";
}

/**
 * Fetch data from a single sheet using name-based column matching.
 *
 * 2-step process:
 *   Step 1: Fetch header row → resolve each config column by NAME
 *           (use `pos` as hint: check that position first, else scan all headers)
 *   Step 2: batchGet data for matched columns only
 *
 * Columns NOT found in the sheet are returned in `missingColumns` for FE to report.
 * Per-page fetch is a DUMB fetcher — it does NOT fix anything.
 * User must go to DSM to fix config issues.
 */
async function fetchSheetData(
    spreadsheetId: string,
    sheetName: string,
    columnPositions: ColumnPosition[]
): Promise<{
    headers: string[];
    rows: Record<string, string>[];
    rowCount: number;
    missingColumns: MissingColumn[];
}> {
    const client = await getClient();

    if (!columnPositions || columnPositions.length === 0) {
        throw new Error(`[fetchSheetData] No columns configured for sheet "${sheetName}"`);
    }

    // ── Step 1: Fetch header row ──
    devLog(`[fetchSheetData] Fetching header row for "${sheetName}"`);
    const headerRes = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!1:1`,
    });
    const headerValues: string[] = (headerRes.data.values?.[0] || []).map(
        (v: unknown) => (v || "").toString().trim()
    );

    if (headerValues.length === 0) {
        return { headers: [], rows: [], rowCount: 0, missingColumns: [] };
    }

    // Build lowercase header → actual column letter mapping
    const headerNameToLetter = new Map<string, string>();
    for (let i = 0; i < headerValues.length; i++) {
        const name = headerValues[i].toLowerCase();
        if (name) headerNameToLetter.set(name, indexToColLetter(i));
    }

    // ── Step 2: Resolve each config column by STRICT POS ──
    // POS is the source of truth. If POS+Name don't match, report error.
    // NO fallback scan by name — forces user to fix config via DSM.
    const matched: { name: string; actualPos: string }[] = [];
    const missing: MissingColumn[] = [];

    for (const col of columnPositions) {
        const configName = col.name.trim().toLowerCase();

        // Strict POS check: pos MUST exist and header at pos MUST match name
        const VALID_COL_REGEX = /^[A-Z]{1,3}$/;
        if (col.pos && VALID_COL_REGEX.test(col.pos.trim())) {
            const hintIdx = colLetterToIndex(col.pos);
            if (hintIdx < headerValues.length &&
                headerValues[hintIdx].toLowerCase() === configName) {
                // POS + Name match — use this position ✅
                matched.push({ name: headerValues[hintIdx], actualPos: col.pos.trim() });
            } else {
                // POS mismatch — do NOT scan by name. Report error. ❌
                const actualAtPos = hintIdx < headerValues.length ? headerValues[hintIdx] : null;
                missing.push({
                    name: col.name,
                    configPos: col.pos,
                    reason: actualAtPos ? "header_mismatch" : "not_found",
                });
                devLog(`[fetchSheetData] ✗ Column "${col.name}" at pos ${col.pos}: expected "${col.name}" but found "${actualAtPos || '(out of range)'}". Fix via DSM.`);
            }
        } else {
            // No valid POS — cannot fetch this column
            missing.push({ name: col.name, configPos: col.pos || "", reason: "not_found" });
            devLog(`[fetchSheetData] ✗ Column "${col.name}" has no valid pos. Fix via DSM.`);
        }
    }

    // If no columns matched, return empty with missing info
    if (matched.length === 0) {
        return { headers: [], rows: [], rowCount: 0, missingColumns: missing };
    }

    // ── Step 3: batchGet data for matched columns ──
    devLog(`[fetchSheetData] batchGet for ${sheetName}: ${matched.length} matched, ${missing.length} missing`);
    const colRanges = matched.map(c => `'${sheetName}'!${c.actualPos}:${c.actualPos}`);

    const dataRes = await client.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: colRanges,
    });

    const valueRanges = dataRes.data.valueRanges || [];
    const headers = matched.map(c => c.name);
    const maxRows = Math.max(0, ...valueRanges.map(vr => (vr.values || []).length - 1));

    const dataRows: Record<string, string>[] = [];

    for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
        const obj: Record<string, string> = {};
        let hasData = false;

        for (let colIdx = 0; colIdx < matched.length; colIdx++) {
            const colData = valueRanges[colIdx]?.values || [];
            // Row 0 in colData is the header, data starts at index 1
            const value = (colData[rowIdx + 1]?.[0] || "").toString().trim();
            const headerName = matched[colIdx].name;

            obj[headerName] = value;
            if (value.trim() !== "") hasData = true;
        }

        if (hasData) dataRows.push(obj);
    }

    devLog(`[fetchSheetData] ${sheetName}: ${headers.length} cols, ${dataRows.length} rows, ${missing.length} missing`);
    return { headers, rows: dataRows, rowCount: dataRows.length, missingColumns: missing };
}

/** Convert column letter to 0-based index (A=0, B=1, ..., Z=25, AA=26) */
function colLetterToIndex(letter: string): number {
    let idx = 0;
    for (let i = 0; i < letter.length; i++) {
        idx = idx * 26 + (letter.charCodeAt(i) - 64);
    }
    return idx - 1;
}

/** Convert 0-based index to column letter (0=A, 1=B, ..., 25=Z, 26=AA) */
function indexToColLetter(index: number): string {
    let letter = "";
    let i = index;
    while (true) {
        letter = String.fromCharCode(65 + (i % 26)) + letter;
        i = Math.floor(i / 26) - 1;
        if (i < 0) break;
    }
    return letter;
}

/* ── GET handler ── */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const pagePath = url.searchParams.get("page");
    const sheetFilter = url.searchParams.get("sheet");
    const isRefresh = url.searchParams.get("refresh") === "true";
    const maxDaysRaw = url.searchParams.get("maxDays");
    const maxDays = maxDaysRaw ? parseInt(maxDaysRaw, 10) : null;

    if (!pagePath) {
        return NextResponse.json(
            { error: "Missing query parameter: page", hint: "Usage: /api/page-data?page=/proteksi/asset" },
            { status: 400 }
        );
    }

    // ═══════════════════════════════════════════════
    // SSOT: unified registry via pageBindings (from Data Connector)
    // ═══════════════════════════════════════════════
    const pageConfig = loadPageConfig(pagePath);

    if (!pageConfig || pageConfig.dataSources.length === 0) {
        return NextResponse.json(
            {
                error: `No data sources configured for page "${pagePath}"`,
                hint: "Configure data sources via Data Connector (Maintenance → Data Connector)",
            },
            { status: 404 }
        );
    }

    // Filter to specific sheet if requested
    const targetSources = sheetFilter
        ? pageConfig.dataSources.filter(
            (ds) => ds.sheetName.trim().toUpperCase() === sheetFilter.trim().toUpperCase()
        )
        : pageConfig.dataSources;

    if (sheetFilter && targetSources.length === 0) {
        return NextResponse.json(
            {
                error: `Sheet "${sheetFilter}" not found in page config for "${pagePath}"`,
                hint: `Available sheets: ${pageConfig.dataSources.map(ds => ds.sheetName).join(", ")}`,
            },
            { status: 404 }
        );
    }

    const routeStart = Date.now();

    // ═══════════════════════════════════════════════
    // DSM Gate: validate each dataSource against registry (<1ms)
    // Valid sources → fetch data. Invalid → return as configIssues.
    // ═══════════════════════════════════════════════
    const registry = loadRegistryRoot();
    const validSources: typeof targetSources = [];
    const configIssues: { sheetName: string; spreadsheetId: string; issue: string }[] = [];

    for (const ds of targetSources) {
        const regSs = registry.spreadsheets.find(ss => ss.spreadsheetId === ds.spreadsheetId);
        if (!regSs) {
            configIssues.push({
                sheetName: ds.sheetName,
                spreadsheetId: ds.spreadsheetId,
                issue: `Spreadsheet tidak terdaftar di DSM registry`,
            });
            continue;
        }
        const regSheet = regSs.sheets.find(
            sh => sh.sheetName.trim().toLowerCase() === ds.sheetName.trim().toLowerCase()
        );
        if (!regSheet) {
            configIssues.push({
                sheetName: ds.sheetName,
                spreadsheetId: ds.spreadsheetId,
                issue: `Sheet "${ds.sheetName}" tidak ditemukan di DSM registry. Perbaiki di Data Source Manager.`,
            });
            continue;
        }

        // Validate column names: each column in page-config must exist in registry
        const regColNames = (regSheet.columnsUsed || []).map(
            (c: { name: string } | string) => (typeof c === "string" ? c : c.name).trim().toLowerCase()
        );
        const missingCols: string[] = [];
        for (const col of (ds.columnsUsed || [])) {
            const colName = typeof col === "string" ? col : col.name;
            if (!regColNames.includes(colName.trim().toLowerCase())) {
                missingCols.push(colName);
            }
        }
        if (missingCols.length > 0) {
            configIssues.push({
                sheetName: ds.sheetName,
                spreadsheetId: ds.spreadsheetId,
                issue: `Kolom tidak ada di registry: ${missingCols.join(", ")}. Perbaiki di DSM.`,
            });
        }
        // Still fetch — valid columns will work, missing ones will be reported
        validSources.push(ds);
    }

    if (configIssues.length > 0) {
        devLog(`[page-data] DSM Gate: ${configIssues.length} issue(s) for ${pagePath}`, configIssues);
    }
    devLog(`[page-data] ${pagePath}${sheetFilter ? ` → sheet:${sheetFilter}` : ""} → ${validSources.length} valid, ${configIssues.length} issues`);

    // Invalidate cache if refresh requested
    if (isRefresh) {
        const cacheKey = getCacheKey(pagePath, sheetFilter || undefined);
        const cache = pageDataCache.get(cacheKey);
        if (cache) cache.invalidate();
        // Also invalidate per-sheet caches for this page
        for (const [key, c] of pageDataCache.entries()) {
            if (key.startsWith(`${pagePath}::`)) c.invalidate();
        }
        devLog(`[page-data] Cache invalidated for ${pagePath}`);
    }

    try {
        const cacheKey = getCacheKey(pagePath, sheetFilter || undefined);
        const cache = getOrCreateCache(cacheKey);

        /* ── Shared helper: fetch one data source → SheetResult (fix C1: no duplication) ── */
        const fetchSingleSheetResult = async (
            ds: (typeof targetSources)[number]
        ): Promise<SheetResult> => {
            try {
                // Pass full column positions to enable targeted batchGet
                const columnPositions = (ds.columnsUsed || []).map(
                    (c: { name: string; pos: string }) => ({ name: c.name, pos: c.pos })
                );
                const connectedColumns = columnPositions.map(c => c.name);

                const data = await fetchSheetData(
                    ds.spreadsheetId,
                    ds.sheetName,
                    columnPositions
                );

                return {
                    sheetName: ds.sheetName,
                    spreadsheetTitle: ds.label || ds.sheetName,
                    spreadsheetId: ds.spreadsheetId,
                    hierarchyMapping: ds.hierarchyMapping || null,
                    hierarchyPresent: ds.hierarchyPresent || [],
                    columnsConnected: connectedColumns,
                    ...data,
                    error: data.missingColumns.length > 0
                        ? `${data.missingColumns.length} kolom tidak ditemukan di sheet. Cek di DSM.`
                        : null,
                };
            } catch (err) {
                return {
                    sheetName: ds.sheetName,
                    spreadsheetTitle: ds.label || ds.sheetName,
                    spreadsheetId: ds.spreadsheetId,
                    hierarchyMapping: ds.hierarchyMapping || null,
                    hierarchyPresent: ds.hierarchyPresent || [],
                    columnsConnected: [],
                    headers: [],
                    rows: [],
                    rowCount: 0,
                    missingColumns: [],
                    error: err instanceof Error ? err.message : "Unknown error",
                };
            }
        };

        // Use cache for single-sheet requests
        if (sheetFilter) {
            if (validSources.length === 0) {
                // Sheet exists in page-config but NOT in registry
                return NextResponse.json({
                    page: pagePath,
                    source: "page-config",
                    fetchedAt: new Date().toISOString(),
                    sheetCount: 0,
                    sheets: [],
                    configIssues,
                });
            }
            const result = await cache.getOrFetch(() => fetchSingleSheetResult(validSources[0]));
            return NextResponse.json({
                page: pagePath,
                source: "page-config",
                fetchedAt: new Date().toISOString(),
                cacheAge: cache.ageSeconds,
                sheetCount: 1,
                sheets: [result],
                ...(configIssues.length > 0 ? { configIssues } : {}),
            });
        }

        // Multi-sheet: per-sheet caching with timing
        const sheets = await Promise.all(
            validSources.map(async (ds) => {
                const perSheetKey = getCacheKey(pagePath, ds.sheetName);
                const perSheetCache = getOrCreateCache(perSheetKey);
                const wasCached = perSheetCache.hasData;
                const sheetStart = Date.now();

                const result = await perSheetCache.getOrFetch(() => fetchSingleSheetResult(ds));

                const elapsed = Date.now() - sheetStart;
                const cacheStatus = wasCached ? "HIT" : "MISS";
                devLog(`[page-data]   ${cacheStatus} ${ds.sheetName} → ${result.rowCount} rows (${elapsed}ms)`);
                return result;
            })
        );

        const totalElapsed = Date.now() - routeStart;
        const allCached = validSources.every(ds => {
            const c = pageDataCache.get(getCacheKey(pagePath, ds.sheetName));
            return c?.hasData;
        });
        devLog(`[page-data] ✅ ${pagePath} done in ${totalElapsed}ms (${allCached ? "all cached" : "fetched from GSheets"})${configIssues.length > 0 ? ` [${configIssues.length} config issue(s)]` : ""}`);

        // Apply server-side date filter if maxDays is specified
        let filteredSheets = sheets;
        if (maxDays && maxDays > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - maxDays);

            filteredSheets = sheets.map(sheet => {
                // Auto-detect date column: header containing 'time' or 'date'
                const dateCol = sheet.headers.find(h => {
                    const lower = h.toLowerCase();
                    return lower.includes('time') || lower.includes('date');
                });
                if (!dateCol) return sheet; // No date column → return all rows

                const beforeCount = sheet.rows.length;
                const filteredRows = sheet.rows.filter(row => {
                    const val = row[dateCol];
                    if (!val) return false;
                    // Parse date string (supports ISO, "YYYY-MM-DD HH:mm:ss", etc.)
                    const d = new Date(val.replace(' ', 'T'));
                    return !isNaN(d.getTime()) && d >= cutoff;
                });

                if (filteredRows.length < beforeCount) {
                    devLog(
                        `[page-data]   ✂ ${sheet.sheetName}: ${beforeCount} → ${filteredRows.length} rows ` +
                        `(filtered by ${dateCol}, last ${maxDays}d)`
                    );
                }

                return {
                    ...sheet,
                    rows: filteredRows,
                    rowCount: filteredRows.length,
                };
            });
        }

        return NextResponse.json({
            page: pagePath,
            source: "page-config",
            fetchedAt: new Date().toISOString(),
            cacheAge: allCached ? Math.min(...validSources.map(ds => {
                const c = pageDataCache.get(getCacheKey(pagePath, ds.sheetName));
                return c?.ageSeconds ?? 0;
            })) : null,
            sheetCount: filteredSheets.length,
            sheets: filteredSheets,
            ...(configIssues.length > 0 ? { configIssues } : {}),
        });
    } catch (error) {
        console.error("[page-data] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch page data" },
            { status: 500 }
        );
    }
}
