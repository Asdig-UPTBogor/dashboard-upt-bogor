/**
 * Page Data API — page-configs SSOT
 *
 * GET /api/page-data?page=/proteksi/asset
 * GET /api/page-data?page=/asset-maps&sheet=MASTER ASSET TOWER
 * GET /api/page-data?page=/asset-maps&refresh=true
 *
 * Single Source of Truth: unified registry (spreadsheet-config.json) via pageBindings
 *   - Which spreadsheet + sheet to fetch
 *   - Which columns are "connected" (columnsUsed)
 *
 * Caching Strategy:
 *   - Sheet-level cache (key: spreadsheetId::sheetName) — shared across pages
 *   - Background prefetch worker refreshes all sheets every 60 seconds
 *   - API requests served from cache (instant) unless refresh=true
 *   - refresh=true → invalidate + fetch fresh from Google Sheets
 *
 * Returns 404 if page has no config — user must configure via Data Connector first.
 */

import { NextResponse } from "next/server";
import {
    loadPageConfig,
    loadRegistryRoot,
} from "@/lib/data-source-registry";
import { fetchSheetData, type ColumnPosition } from "@/lib/sheets-api";
import { sheetCache } from "@/lib/sheet-cache";
import { startPrefetchWorker } from "@/lib/background-prefetch";
import { rateLimitCounter } from "@/lib/rate-limit-counter";

// No ISR cache — always execute route handler
export const revalidate = 0;

/* ── Dev-only logging (fix m3: no console.log spam in production) ── */
const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };

/* ── Start background worker on first import ── */
let workerStarted = false;
function ensureWorkerStarted() {
    if (!workerStarted) {
        workerStarted = true;
        startPrefetchWorker();
    }
}

/* ── Types ── */
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
    errorCode?: number | null;
    cacheStatus?: "HIT" | "MISS" | "REFRESH";
}

/* ── Hierarchy Cascade Filter ────────────────────────────────────────
 * Post-processing step: filters child sheets so orphan rows
 * (e.g. bays whose GI was deleted) are excluded from the response.
 *
 * Hierarchy levels: ultg > gi > bay
 * - Root sheet: defines valid ULTG + GI values (e.g. Asset GI)
 * - Bay source sheet: filtered by valid GIs, then defines valid Bays
 * - Child sheets: filtered by valid GIs + valid Bays
 *
 * Only active when sheets have hierarchyMapping in their config.
 * Pages without hierarchy config are unaffected.
 * ── */
function applyCascadeFilter(sheets: SheetResult[]): SheetResult[] {
    // Only process sheets that have hierarchy mappings
    const sheetsWithHierarchy = sheets.filter(s => s.hierarchyMapping && s.hierarchyPresent.length > 0);
    if (sheetsWithHierarchy.length < 2) return sheets; // Need at least 2 sheets for cascade

    // Step 1: Find root sheet — has ultg+gi but NOT bay (e.g. Asset GI)
    const rootSheet = sheetsWithHierarchy.find(s =>
        s.hierarchyPresent.includes('ultg') &&
        s.hierarchyPresent.includes('gi') &&
        !s.hierarchyPresent.includes('bay')
    );
    if (!rootSheet || !rootSheet.hierarchyMapping) return sheets; // No root → skip

    // Step 2: Build valid value sets from root
    const ultgCol = rootSheet.hierarchyMapping['ultg'];
    const giCol = rootSheet.hierarchyMapping['gi'];
    const validULTGs = new Set(rootSheet.rows.map(r => r[ultgCol]?.toLowerCase()).filter(Boolean));
    const validGIs = new Set(rootSheet.rows.map(r => r[giCol]?.toLowerCase()).filter(Boolean));

    devLog(`[cascade] Root: "${rootSheet.sheetName}" → ${validULTGs.size} ULTGs, ${validGIs.size} GIs`);

    // Step 3: Find bay source sheet — has ultg+gi+bay (e.g. Asset Bay)
    const baySourceSheet = sheetsWithHierarchy.find(s =>
        s !== rootSheet &&
        s.hierarchyPresent.includes('bay') &&
        s.hierarchyMapping?.['bay']
    );

    let validBays: Set<string> | null = null;

    // Step 4: Filter each non-root sheet
    return sheets.map(sheet => {
        if (sheet === rootSheet) return sheet; // Root is never filtered
        if (!sheet.hierarchyMapping || sheet.hierarchyPresent.length === 0) return sheet; // No hierarchy = pass-through

        const beforeCount = sheet.rows.length;
        let filtered = sheet.rows;

        // Filter by valid GIs
        const sheetGiCol = sheet.hierarchyMapping['gi'];
        if (sheetGiCol && validGIs.size > 0) {
            filtered = filtered.filter(r => {
                const val = r[sheetGiCol]?.toLowerCase();
                return val && validGIs.has(val);
            });
        }

        // If this is the bay source sheet, build valid bays AFTER filtering by GI
        if (sheet === baySourceSheet && sheet.hierarchyMapping['bay']) {
            const bayCol = sheet.hierarchyMapping['bay'];
            validBays = new Set(filtered.map(r => r[bayCol]?.toLowerCase()).filter(Boolean));
            devLog(`[cascade] Bay source: "${sheet.sheetName}" → ${validBays.size} valid bays`);
        }

        // Filter by valid Bays (for non-bay-source sheets)
        if (sheet !== baySourceSheet && validBays && validBays.size > 0) {
            const sheetBayCol = sheet.hierarchyMapping['bay'];
            if (sheetBayCol) {
                filtered = filtered.filter(r => {
                    const val = r[sheetBayCol]?.toLowerCase();
                    return val && validBays!.has(val);
                });
            }
        }

        if (filtered.length < beforeCount) {
            devLog(`[cascade]   ✂ ${sheet.sheetName}: ${beforeCount} → ${filtered.length} rows (orphans removed)`);
        }

        return filtered.length === beforeCount
            ? sheet
            : { ...sheet, rows: filtered, rowCount: filtered.length };
    });
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

    // Ensure background prefetch worker is running
    ensureWorkerStarted();

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

    // ═══════════════════════════════════════════════
    // On refresh: invalidate cache for this page's sheets
    // ═══════════════════════════════════════════════
    if (isRefresh) {
        for (const ds of validSources) {
            sheetCache.invalidate(ds.spreadsheetId, ds.sheetName);
        }
        devLog(`[page-data] 🔄 Refresh: invalidated ${validSources.length} sheet(s) for ${pagePath}`);
    }

    try {
        /* ── Fetch each data source: cache-first, then Google Sheets ── */
        const sheets = await Promise.all(
            validSources.map(async (ds): Promise<SheetResult> => {
                const columnPositions: ColumnPosition[] = (ds.columnsUsed || []).map(
                    (c: { name: string; pos: string }) => ({ name: c.name, pos: c.pos })
                );
                const connectedColumns = columnPositions.map(c => c.name);
                const sheetStart = Date.now();

                try {
                    // ── Check sheet-cache first ──
                    const cached = sheetCache.get(
                        ds.spreadsheetId,
                        ds.sheetName,
                        connectedColumns
                    );

                    if (cached) {
                        // CACHE HIT — return from cache (0 Google API requests)
                        const elapsed = Date.now() - sheetStart;
                        devLog(`[page-data]   HIT  ${ds.sheetName} → ${cached.rowCount} rows (${elapsed}ms, from cache)`);

                        return {
                            sheetName: ds.sheetName,
                            spreadsheetTitle: ds.label || ds.sheetName,
                            spreadsheetId: ds.spreadsheetId,
                            hierarchyMapping: ds.hierarchyMapping || null,
                            hierarchyPresent: ds.hierarchyPresent || [],
                            columnsConnected: connectedColumns,
                            ...cached,
                            error: cached.missingColumns.length > 0
                                ? `${cached.missingColumns.length} kolom tidak ditemukan di sheet. Cek di DSM.`
                                : null,
                            cacheStatus: "HIT",
                        };
                    }

                    // ── CACHE MISS — fetch from Google Sheets API ──
                    const fetchStart = Date.now();
                    const data = await fetchSheetData(
                        ds.spreadsheetId,
                        ds.sheetName,
                        columnPositions
                    );
                    const fetchMs = Date.now() - fetchStart;

                    // Store in sheet-cache for future requests
                    sheetCache.set(
                        ds.spreadsheetId,
                        ds.sheetName,
                        data,
                        connectedColumns,
                        fetchMs
                    );

                    const elapsed = Date.now() - sheetStart;
                    devLog(`[page-data]   MISS ${ds.sheetName} → ${data.rowCount} rows (${fetchMs}ms fetch, ${elapsed}ms total)`);

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
                        cacheStatus: isRefresh ? "REFRESH" : "MISS",
                    };
                } catch (err) {
                    // Detect error code for rate limiting
                    const errCode = (err as { code?: number })?.code
                        || (err as { status?: number })?.status
                        || ((err as Error)?.message?.includes('429') ? 429 : 0);
                    if (errCode) rateLimitCounter.recordError(errCode, (err as Error)?.message || 'Unknown');
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
                        errorCode: errCode || null,
                        cacheStatus: "MISS",
                    };
                }
            })
        );

        const totalElapsed = Date.now() - routeStart;
        const cacheHits = sheets.filter(s => s.cacheStatus === "HIT").length;
        devLog(`[page-data] ✅ ${pagePath} done in ${totalElapsed}ms (${cacheHits}/${sheets.length} cached)${configIssues.length > 0 ? ` [${configIssues.length} config issue(s)]` : ""}`);

        // ── Cascade hierarchy filter: remove orphan rows ──
        const cascadeFiltered = applyCascadeFilter(sheets);

        // Apply server-side date filter if maxDays is specified
        let filteredSheets = cascadeFiltered;
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
            sheetCount: filteredSheets.length,
            sheets: filteredSheets,
            ...(configIssues.length > 0 ? { configIssues } : {}),
            apiQuota: rateLimitCounter.getStatus(),
            cache: sheetCache.getStatus(),
        });
    } catch (error) {
        console.error("[page-data] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch page data" },
            { status: 500 }
        );
    }
}
