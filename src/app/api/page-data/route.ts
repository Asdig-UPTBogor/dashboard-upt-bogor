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

/* ── Hierarchy Warning Type ── */
interface HierarchyWarning {
    sheet: string;
    row: number;
    level: 'ultg' | 'gi' | 'bay';
    action: 'corrected' | 'orphan_removed' | 'invalid_id';
    oldValue?: string;
    newValue?: string;
    message: string;
}

/* ── Hierarchy Cascade Filter + Validation Engine ─────────────────────
 * Post-processing step that does TWO things:
 *
 * 1. VALIDATE: Check child sheet values against Master (SSOT)
 *    - If child has ID column → resolve names from Master via ID lookup
 *    - If child has no ID → normalize name and match against Master values
 *    - Auto-correct mismatched names to Master's canonical value
 *
 * 2. FILTER: Remove orphan rows (original cascade logic)
 *    - Rows referencing ULTGs/GIs/Bays not in Master are excluded
 *
 * Hierarchy levels: ultg > gi > bay
 * - Root sheet = Master with ultg+gi, no bay (SSOT for GI names)
 * - Bay source = Master with ultg+gi+bay (SSOT for Bay names)
 * - Child sheets = validated + filtered against Master values
 *
 * Returns { sheets, hierarchyWarnings } for API response.
 * ── */
function applyCascadeFilter(sheets: SheetResult[]): {
    sheets: SheetResult[];
    hierarchyWarnings: HierarchyWarning[];
} {
    const warnings: HierarchyWarning[] = [];

    // Only process sheets that have hierarchy mappings
    const sheetsWithHierarchy = sheets.filter(s => s.hierarchyMapping && s.hierarchyPresent.length > 0);
    if (sheetsWithHierarchy.length < 2) return { sheets, hierarchyWarnings: warnings };

    // Step 1: Find root sheet — has ultg+gi but NOT bay (SSOT for GI)
    const rootSheet = sheetsWithHierarchy.find(s =>
        s.hierarchyPresent.includes('ultg') &&
        s.hierarchyPresent.includes('gi') &&
        !s.hierarchyPresent.includes('bay')
    );
    if (!rootSheet || !rootSheet.hierarchyMapping) return { sheets, hierarchyWarnings: warnings };

    // Step 2: Build Master lookup tables from root
    const ultgCol = rootSheet.hierarchyMapping['ultg'];
    const giCol = rootSheet.hierarchyMapping['gi'];

    // Canonical value sets (preserves original casing)
    const canonicalULTGs = new Map<string, string>(); // lowercase → original
    const canonicalGIs = new Map<string, string>();    // lowercase → original
    // GI → ULTG mapping for hierarchy conflict detection
    const giToUltg = new Map<string, string>();        // gi_lowercase → ultg_original

    // ID-based lookup (if root has ID column)
    const idToRootRow = new Map<string, Record<string, string>>(); // id → full row
    const rootHasId = rootSheet.rows.some(r => r['ID'] !== undefined);

    for (const row of rootSheet.rows) {
        const ultgVal = row[ultgCol]?.trim();
        const giVal = row[giCol]?.trim();
        if (ultgVal) canonicalULTGs.set(ultgVal.toLowerCase(), ultgVal);
        if (giVal) {
            canonicalGIs.set(giVal.toLowerCase(), giVal);
            if (ultgVal) giToUltg.set(giVal.toLowerCase(), ultgVal);
        }
        if (rootHasId && row['ID']) {
            idToRootRow.set(row['ID'].trim(), row);
        }
    }

    const validULTGs = new Set(canonicalULTGs.keys());
    const validGIs = new Set(canonicalGIs.keys());

    devLog(`[hierarchy] Root: "${rootSheet.sheetName}" → ${validULTGs.size} ULTGs, ${validGIs.size} GIs${rootHasId ? ', ID column ✓' : ''}`);

    // Step 3: Find bay source sheet — has ultg+gi+bay (SSOT for Bay)
    const baySourceSheet = sheetsWithHierarchy.find(s =>
        s !== rootSheet &&
        s.hierarchyPresent.includes('bay') &&
        s.hierarchyMapping?.['bay']
    );

    let validBays = new Map<string, string>();   // lowercase → original
    let bayToGi = new Map<string, string>();     // bay_lowercase → gi_original
    /** Composite GI→Set<Bay> map: which bays belong to which GI */
    let giToBays = new Map<string, Set<string>>();  // gi_lower → Set<bay_lower>
    const idToBayRow = new Map<string, Record<string, string>>();
    const bayHasId = baySourceSheet?.rows.some(r => r['ID'] !== undefined) ?? false;

    if (baySourceSheet?.hierarchyMapping) {
        const bayCol = baySourceSheet.hierarchyMapping['bay'];
        const bayGiCol = baySourceSheet.hierarchyMapping['gi'];

        for (const row of baySourceSheet.rows) {
            const bayVal = row[bayCol]?.trim();
            const giVal = row[bayGiCol]?.trim();
            if (bayVal) {
                validBays.set(bayVal.toLowerCase(), bayVal);
                if (giVal) {
                    bayToGi.set(bayVal.toLowerCase(), giVal);
                    // Build composite GI→Bays map
                    const giLower = giVal.toLowerCase();
                    if (!giToBays.has(giLower)) giToBays.set(giLower, new Set());
                    giToBays.get(giLower)!.add(bayVal.toLowerCase());
                }
            }
            if (bayHasId && row['ID']) {
                idToBayRow.set(row['ID'].trim(), row);
            }
        }
        devLog(`[hierarchy] Bay source: "${baySourceSheet.sheetName}" → ${validBays.size} bays, ${giToBays.size} GIs${bayHasId ? ', ID column ✓' : ''}`);
    }

    // Step 4: Validate + Filter each non-root sheet
    const resultSheets = sheets.map(sheet => {
        if (sheet === rootSheet) return sheet;
        if (!sheet.hierarchyMapping || sheet.hierarchyPresent.length === 0) return sheet;

        const beforeCount = sheet.rows.length;
        const sheetUltgCol = sheet.hierarchyMapping['ultg'];
        const sheetGiCol = sheet.hierarchyMapping['gi'];
        const sheetBayCol = sheet.hierarchyMapping['bay'];

        // Process each row: validate + auto-correct
        const processedRows: Record<string, string>[] = [];

        for (let i = 0; i < sheet.rows.length; i++) {
            const row = { ...sheet.rows[i] }; // clone to allow mutation
            let isValid = true;

            // ── GI Validation ──
            if (sheetGiCol && validGIs.size > 0) {
                const giVal = row[sheetGiCol]?.trim();
                if (!giVal) {
                    isValid = false;
                } else {
                    const giLower = giVal.toLowerCase();
                    const canonical = canonicalGIs.get(giLower);

                    if (canonical) {
                        // Value exists in Master — auto-correct casing if different
                        if (giVal !== canonical) {
                            warnings.push({
                                sheet: sheet.sheetName, row: i, level: 'gi',
                                action: 'corrected', oldValue: giVal, newValue: canonical,
                                message: `Casing corrected: "${giVal}" → "${canonical}"`,
                            });
                            row[sheetGiCol] = canonical;
                        }
                    } else {
                        // Value NOT in Master → orphan, remove
                        isValid = false;
                        warnings.push({
                            sheet: sheet.sheetName, row: i, level: 'gi',
                            action: 'orphan_removed', oldValue: giVal,
                            message: `GI "${giVal}" not found in Master → row removed`,
                        });
                    }
                }
            }

            // ── ULTG Validation + Hierarchy Conflict Check ──
            if (isValid && sheetUltgCol && validULTGs.size > 0) {
                const ultgVal = row[sheetUltgCol]?.trim();
                const giVal = row[sheetGiCol]?.trim();

                if (ultgVal) {
                    const ultgLower = ultgVal.toLowerCase();
                    const canonical = canonicalULTGs.get(ultgLower);

                    if (canonical && ultgVal !== canonical) {
                        row[sheetUltgCol] = canonical;
                    }

                    // Hierarchy conflict: check if GI belongs to the correct ULTG
                    if (giVal) {
                        const expectedUltg = giToUltg.get(giVal.toLowerCase());
                        if (expectedUltg && expectedUltg.toLowerCase() !== (canonical || ultgVal).toLowerCase()) {
                            warnings.push({
                                sheet: sheet.sheetName, row: i, level: 'ultg',
                                action: 'corrected', oldValue: ultgVal, newValue: expectedUltg,
                                message: `ULTG conflict: "${giVal}" belongs to "${expectedUltg}", not "${ultgVal}" → corrected`,
                            });
                            row[sheetUltgCol] = expectedUltg;
                        }
                    }
                }
            }

            // ── Bay Validation (v2: composite GI+Bay key) ──
            // Bay names (e.g. "TRF#1 150/20kV") are NOT unique across GIs.
            // We now validate BOTH that the bay name exists AND belongs to the row's GI.
            if (isValid && sheetBayCol && validBays.size > 0 && sheet !== baySourceSheet) {
                const bayVal = row[sheetBayCol]?.trim();
                if (bayVal) {
                    const bayLower = bayVal.toLowerCase();
                    const canonical = validBays.get(bayLower);

                    if (canonical) {
                        // Normalize bay name casing to match Master
                        if (bayVal !== canonical) {
                            row[sheetBayCol] = canonical;
                        }
                        // Composite check: does this bay belong to the row's GI?
                        const rowGiVal = row[sheetGiCol || '']?.trim();
                        if (rowGiVal && giToBays.size > 0) {
                            const giLower = rowGiVal.toLowerCase();
                            const baysForGI = giToBays.get(giLower);
                            if (baysForGI && !baysForGI.has(bayLower)) {
                                // Bay exists but under different GI — log warning but don't remove
                                const actualGI = bayToGi.get(bayLower) || '??';
                                warnings.push({
                                    sheet: sheet.sheetName, row: i, level: 'bay',
                                    action: 'invalid_id', oldValue: bayVal,
                                    message: `Bay "${bayVal}" not found in GI "${rowGiVal}" (exists in "${actualGI}")`,
                                });
                            }
                        }
                    } else {
                        isValid = false;
                        warnings.push({
                            sheet: sheet.sheetName, row: i, level: 'bay',
                            action: 'orphan_removed', oldValue: bayVal,
                            message: `Bay "${bayVal}" not found in Master → row removed`,
                        });
                    }
                }
            }

            if (isValid) processedRows.push(row);
        }

        // Build valid bays from bay source AFTER filtering
        if (sheet === baySourceSheet && sheetBayCol) {
            validBays = new Map<string, string>();
            bayToGi = new Map<string, string>();
            giToBays = new Map<string, Set<string>>();
            for (const row of processedRows) {
                const bayVal = row[sheetBayCol]?.trim();
                const giVal = row[sheetGiCol || '']?.trim();
                if (bayVal) {
                    validBays.set(bayVal.toLowerCase(), bayVal);
                    if (giVal) {
                        bayToGi.set(bayVal.toLowerCase(), giVal);
                        const giLower = giVal.toLowerCase();
                        if (!giToBays.has(giLower)) giToBays.set(giLower, new Set());
                        giToBays.get(giLower)!.add(bayVal.toLowerCase());
                    }
                }
            }
            devLog(`[hierarchy]   Bay source filtered: ${validBays.size} valid bays, ${giToBays.size} GIs`);
        }

        if (processedRows.length < beforeCount) {
            devLog(`[hierarchy]   ✂ ${sheet.sheetName}: ${beforeCount} → ${processedRows.length} rows`);
        }

        return processedRows.length === beforeCount && warnings.filter(w => w.sheet === sheet.sheetName).length === 0
            ? sheet
            : { ...sheet, rows: processedRows, rowCount: processedRows.length };
    });

    if (warnings.length > 0) {
        devLog(`[hierarchy] ⚠ ${warnings.length} warning(s): ${warnings.filter(w => w.action === 'corrected').length} corrected, ${warnings.filter(w => w.action === 'orphan_removed').length} orphans removed`);
    }

    return { sheets: resultSheets, hierarchyWarnings: warnings };
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

        // ── Hierarchy validation + cascade filter ──
        const { sheets: cascadeFiltered, hierarchyWarnings } = applyCascadeFilter(sheets);

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
            ...(hierarchyWarnings.length > 0 ? { hierarchyWarnings } : {}),
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
