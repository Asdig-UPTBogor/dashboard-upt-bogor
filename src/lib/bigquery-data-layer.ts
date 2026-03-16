/**
 * bigquery-data-layer.ts
 *
 * Core data layer for the Dashboard → BigQuery integration.
 *
 * Architecture:
 *   Spreadsheet → External Table → View (QC+filter) → Native Table → Dashboard
 *
 * Data flow:
 *   1. Firestore config (dashboard_pages) defines which sheets a page needs
 *   2. Each dataSource in Firestore has explicit dataset + tableName (set via DC Canvas)
 *   3. queryNativeTableAsSheet() queries BQ and normalizes column names
 *   4. Column names restored to original spreadsheet names via Firestore columnsUsed
 *   5. Response filtered to only include configured columns
 *
 * Native Tables refreshed every 15 min by BQ Scheduled Query + manual trigger.
 *
 * @module bigquery-data-layer
 */

import { getGoogleAuth } from "@/lib/dashboard-config";
import { loadPageConfigFromFirestore } from "@/lib/firestore-dashboard-config";
import { getAllPages } from "@/lib/sidebar-config";

// ── Configuration ──────────────────────────────────────────────────

const BIGQUERY_PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const BIGQUERY_LOCATION =
    process.env.BIGQUERY_LOCATION || "asia-southeast2";

const BIGQUERY_SCOPES = [
    "https://www.googleapis.com/auth/bigquery",
    "https://www.googleapis.com/auth/drive.readonly",
];

// ── Types ──────────────────────────────────────────────────────────

/** A single sheet result, matching the frontend SheetData interface */
interface PageSheet {
    name: string;
    sheetName: string;
    headers: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    hierarchyMapping: Record<string, string> | null;
    hierarchyPresent: string[];
    error: string | null;
    [key: string]: unknown;
}

/** Full page data payload, matching the frontend PageDataResponse interface */
interface PagePayload {
    page: string;
    source: string;
    fetchedAt: string;
    sheetCount: number;
    sheets: PageSheet[];
    [key: string]: unknown;
}

/** Resolved config for a single BQ data source (from Firestore) */
interface ResolvedSource {
    dataset: string;
    tableName: string;
    sheetName: string;
    hierarchyMapping: Record<string, string> | null;
    hierarchyPresent: string[];
    columnsUsed?: string[];
}

// ── BQ Routing Registry ────────────────────────────────────────────
//
// Maps sheet names → BQ dataset + native table.
// DC Canvas (Firestore) stores WHAT data to show (columns, hierarchy).
// This registry stores WHERE the data lives in BQ.
// Both are needed: Firestore config + this registry = complete source resolution.

interface SheetMapping {
    dataset: string;
    table: string;
}

const SHEET_TO_TABLE: Record<string, SheetMapping> = {
    // Master Hierarchy
    "Master Gardu Induk":          { dataset: "MASTER_HIERARCHY_UPT_Bogor", table: "n_Master_Gardu_Induk" },
    "Master Bay":                  { dataset: "MASTER_HIERARCHY_UPT_Bogor", table: "n_Master_Bay" },
    "Koordinat Gardu Induk":       { dataset: "MASTER_HIERARCHY_UPT_Bogor", table: "n_Koordinat_Gardu_Induk" },
    "Koordinat GI":                { dataset: "MASTER_HIERARCHY_UPT_Bogor", table: "n_Koordinat_Gardu_Induk" },

    // Dashboard Gardu Induk
    "MTU TRAFO":                   { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_MTU_TRAFO" },
    "MTU PMT":                     { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_MTU_PMT" },
    "MTU PMS":                     { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_MTU_PMS" },
    "MTU CT":                      { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_MTU_CT" },
    "MTU CVT":                     { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_MTU_CVT" },
    "MTU LA":                      { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_MTU_LA" },
    "MTU KABEL POWER":             { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_MTU_KABEL_POWER" },
    "SEALING END":                 { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_SEALING_END" },
    "PROGRAM STRATEGIS TRAFO":     { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_PROGRAM_STRATEGIS_TRAFO" },
    "PROGRAM KERJA HARGI":         { dataset: "Dashboard_Gardu_Induk_UPT_Bogor", table: "n_PROGRAM_KERJA_HARGI" },

    // Master Transmisi
    "MASTER ASSET TOWER":          { dataset: "Master_Transmisi_UPT_Bogor", table: "n_MASTER_ASSET_TOWER" },
    "0.RESUME JARINGAN":           { dataset: "Master_Transmisi_UPT_Bogor", table: "n_0_RESUME_JARINGAN" },
    "1.DATA PETIR":                { dataset: "Master_Transmisi_UPT_Bogor", table: "n_1_DATA_PETIR" },
    "DATA PETIR":                  { dataset: "Master_Transmisi_UPT_Bogor", table: "n_1_DATA_PETIR" },
    "3.PROTEKSI PETIR TAMBAHAN":   { dataset: "Master_Transmisi_UPT_Bogor", table: "n_3_PROTEKSI_PETIR_TAMBAHAN" },
    "5.HEALTHY INDEX TOWER":       { dataset: "Master_Transmisi_UPT_Bogor", table: "n_5_HEALTHY_INDEX_TOWER" },
    "6.ASSESMENT TOWER DAN VENOM": { dataset: "Master_Transmisi_UPT_Bogor", table: "n_6_ASSESMENT_TOWER_DAN_VENOM" },
    "12.KONDISI ROW":              { dataset: "Master_Transmisi_UPT_Bogor", table: "n_12_KONDISI_ROW" },
    "14.LM JARINGAN 2026":         { dataset: "Master_Transmisi_UPT_Bogor", table: "n_14_LM_JARINGAN_2026" },
    "17.SLD TOWER":                { dataset: "Master_Transmisi_UPT_Bogor", table: "n_17_SLD_TOWER" },

    // Asset Relay
    "Asset Relay UPT Bogor":       { dataset: "Master_Asset_Relay_UPT_Bogor", table: "n_Asset_Relay_UPT_Bogor" },

    // Jadwal Padam
    "Jadwal Padam":                { dataset: "Master_Jadwal_Padam_UPT_Bogor", table: "n_Jadwal_Padam" },
};

// ── Auth ────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
    const auth = getGoogleAuth(BIGQUERY_SCOPES);
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token =
        typeof tokenResponse === "string"
            ? tokenResponse
            : tokenResponse?.token || "";

    if (!token) {
        throw new Error("Failed to get BigQuery access token");
    }
    return token;
}

// ── Column Name Normalization ──────────────────────────────────────
//
// BQ auto-detect converts spreadsheet column names:
//   - spaces → underscores
//   - special chars like (), / → stripped
//
// To restore original names, we use Firestore columnsUsed as source of truth.
// Each columnsUsed entry has the EXACT spreadsheet name (e.g. "Tegangan (kV)").
// We convert that to what BQ would produce ("Tegangan_kV"), then match.

/** Columns that should NOT be normalized (added by views, not from spreadsheet) */
const KEEP_AS_IS = new Set(["ID_GI", "ID_ULTG", "ID_Bay", "qc_hierarchy"]);

/** Convert a spreadsheet column name to what BQ auto-detect would produce.
 *  BQ auto-detect replaces special chars (/, (, ), spaces, dots, etc.) with underscores.
 *  Consecutive underscores are collapsed. Leading underscores trimmed.
 *  BQ KEEPS trailing underscores (e.g. "NO." → "NO_").
 *  e.g. "MDG /KOPEL MRG" → "MDG_KOPEL_MRG"
 *  e.g. "NO." → "NO_"
 */
function toBQColumnName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9_]/g, "_")   // replace ALL non-alnum (incl space, /) with _
        .replace(/_+/g, "_")               // collapse consecutive underscores
        .replace(/^_/, "");                // trim leading _ only (BQ keeps trailing _)
}

/**
 * Build a reverse map: BQ column name → original spreadsheet name.
 * Source of truth: Firestore columnsUsed (exact spreadsheet names).
 */
function buildColumnNameMap(columnsUsed?: string[]): Record<string, string> {
    if (!columnsUsed || columnsUsed.length === 0) return {};
    const map: Record<string, string> = {};
    for (const original of columnsUsed) {
        map[toBQColumnName(original)] = original;
    }
    return map;
}

/**
 * Normalize a BQ column name back to its display name.
 * Priority: KEEP_AS_IS → Firestore columnMap → fallback underscore→space
 */
function normalizeColumnName(bqName: string, columnMap: Record<string, string>): string {
    if (KEEP_AS_IS.has(bqName)) return bqName;
    if (bqName.startsWith("string_field_")) return bqName;
    if (columnMap[bqName]) return columnMap[bqName];
    return bqName.replace(/_/g, " ");
}

// ── BQ Query Execution ─────────────────────────────────────────────

interface BQQueryResult {
    schema?: { fields?: { name: string; type: string }[] };
    rows?: { f?: { v?: unknown }[] }[];
    totalRows?: string;
}

async function queryBigQuery(sql: string, token: string): Promise<BQQueryResult> {
    const baseUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${BIGQUERY_PROJECT_ID}`;

    // 1. Start the query
    const response = await fetch(`${baseUrl}/queries`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: sql,
            useLegacySql: false,
            location: BIGQUERY_LOCATION,
            maxResults: 10000,
        }),
        cache: "no-store",
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`BigQuery query failed (${response.status}): ${text}`);
    }

    const firstPage = await response.json() as BQQueryResult & {
        pageToken?: string;
        jobReference?: { jobId?: string };
        jobComplete?: boolean;
    };

    // If all rows fit in first page, return directly
    if (!firstPage.pageToken) return firstPage;

    // 2. Paginate: collect remaining rows via getQueryResults
    const allRows = [...(firstPage.rows || [])];
    let pageToken: string | undefined = firstPage.pageToken;
    const jobId = firstPage.jobReference?.jobId;

    while (pageToken && jobId) {
        const params = new URLSearchParams({
            pageToken,
            maxResults: "10000",
            location: BIGQUERY_LOCATION,
        });
        const pageResp = await fetch(
            `${baseUrl}/queries/${jobId}?${params}`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            },
        );
        if (!pageResp.ok) break;

        const pageData = await pageResp.json() as BQQueryResult & { pageToken?: string };
        if (pageData.rows) allRows.push(...pageData.rows);
        pageToken = pageData.pageToken;
    }

    // Return merged result with all rows
    return {
        schema: firstPage.schema,
        rows: allRows,
        totalRows: firstPage.totalRows,
    };
}

// ── Native Table Query ─────────────────────────────────────────────

/**
 * Query a single BQ Native Table and return it as a PageSheet.
 * Handles column name normalization and optional column filtering.
 */
async function queryNativeTableAsSheet(
    source: ResolvedSource,
    token: string,
): Promise<PageSheet> {
    try {
        // Build column name map from Firestore columnsUsed
        const columnMap = buildColumnNameMap(source.columnsUsed);

        // Build SQL: SELECT specific columns if columnsUsed is set, otherwise SELECT *
        let sql: string;
        if (source.columnsUsed && source.columnsUsed.length > 0) {
            // Convert display names → BQ column names
            const bqCols = new Set<string>();
            for (const displayName of source.columnsUsed) {
                bqCols.add(toBQColumnName(displayName));
            }

            const colList = [...bqCols].map((c) => `\`${c}\``).join(", ");
            sql = `SELECT ${colList} FROM \`${BIGQUERY_PROJECT_ID}.${source.dataset}.${source.tableName}\``;
        } else {
            sql = `SELECT * FROM \`${BIGQUERY_PROJECT_ID}.${source.dataset}.${source.tableName}\``;
        }

        const result = await queryBigQuery(sql, token);
        console.log(`[BQ] ${source.sheetName}: ${source.columnsUsed?.length || 'ALL'} cols → ${source.dataset}.${source.tableName} (${result.totalRows || 0} rows)`);

        // Normalize BQ column names → display names
        const bqColumns = (result.schema?.fields || []).map((f) => f.name);
        const displayColumns = bqColumns.map((col) => normalizeColumnName(col, columnMap));

        // Convert rows: BQ [{f: [{v: val}]}] → [{col: val}]
        const rows: Record<string, unknown>[] = (result.rows || []).map((row) => {
            const record: Record<string, unknown> = {};
            (row.f || []).forEach((cell, index) => {
                if (index < displayColumns.length) {
                    record[displayColumns[index]] = cell.v ?? null;
                }
            });
            return record;
        });

        // Normalize hierarchy mapping column names
        const normalizedMapping: Record<string, string> | null = source.hierarchyMapping
            ? Object.fromEntries(
                Object.entries(source.hierarchyMapping).map(([key, value]) => [
                    key,
                    normalizeColumnName(value, columnMap),
                ])
            )
            : null;

        return {
            name: source.sheetName,
            sheetName: source.sheetName,
            headers: displayColumns,
            rows,
            rowCount: rows.length,
            hierarchyMapping: normalizedMapping,
            hierarchyPresent: source.hierarchyPresent,
            error: null,
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[BQ] Query failed for ${source.dataset}.${source.tableName}:`, msg);
        return {
            name: source.sheetName,
            sheetName: source.sheetName,
            headers: [],
            rows: [],
            rowCount: 0,
            hierarchyMapping: null,
            hierarchyPresent: source.hierarchyPresent,
            error: msg,
        };
    }
}

// ── Firestore Config Resolution ────────────────────────────────────

/**
 * Convert a Firestore dataSource entry to a ResolvedSource.
 * Maps sheetName → BQ dataset+table from Firestore config.
 * Throws descriptive error if sheet has no mapping.
 */
function resolveFirestoreDataSource(ds: Record<string, unknown>): ResolvedSource {
    const sheetName = String(ds.sheetName || "");
    if (!sheetName) {
        throw new Error(`[BQ] dataSource entry has no sheetName`);
    }

    // Resolve BQ location: Firestore explicit fields → SHEET_TO_TABLE registry
    let dataset = ds.dataset ? String(ds.dataset) : undefined;
    let tableName = ds.tableName ? String(ds.tableName) : undefined;

    if (!dataset || !tableName) {
        const mapping = SHEET_TO_TABLE[sheetName];
        if (!mapping) {
            throw new Error(
                `[BQ] Sheet "${sheetName}" tidak terdaftar di SHEET_TO_TABLE. ` +
                `Tambahkan mapping di bigquery-data-layer.ts untuk sheet ini.`
            );
        }
        dataset = dataset || mapping.dataset;
        tableName = tableName || mapping.table;
    }

    // Hierarchy mapping: convert "Master ULTG" → "Master_ULTG" for BQ
    const rawMapping = (ds.hierarchyMapping || {}) as Record<string, string>;
    const hierarchyMapping: Record<string, string> = {};
    for (const [level, colName] of Object.entries(rawMapping)) {
        hierarchyMapping[level] = colName.replace(/ /g, "_");
    }

    const hierarchyPresent = Array.isArray(ds.hierarchyPresent)
        ? (ds.hierarchyPresent as string[])
        : Object.keys(rawMapping);

    const columnsUsed = Array.isArray(ds.columnsUsed)
        ? (ds.columnsUsed as unknown[]).map((c) => {
            if (typeof c === "string") return c;          // flat: ["NO", "PENGHANTAR", ...]
            if (c && typeof c === "object" && "name" in c) return String((c as { name: string }).name); // object: [{name: "NO"}, ...]
            return "";
        }).filter(Boolean)
        : [];

    return {
        dataset,
        tableName,
        sheetName,
        hierarchyMapping: Object.keys(hierarchyMapping).length > 0 ? hierarchyMapping : null,
        hierarchyPresent,
        columnsUsed: columnsUsed.length > 0 ? columnsUsed : undefined,
    };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get page data by querying BQ Native Tables.
 *
 * Reads page config from Firestore → resolves dataSources → queries BQ.
 * NO fallback — errors are propagated with exact messages.
 */
export async function getPageDataFromBigQuery(
    page: string
): Promise<PagePayload> {
    // Load page config from Firestore — errors propagate, no silent catch
    const config = await loadPageConfigFromFirestore(page);

    if (!config || !Array.isArray(config.dataSources) || config.dataSources.length === 0) {
        throw new Error(
            `[BQ] Tidak ada Firestore config untuk page "${page}". ` +
            `Pastikan page sudah didaftarkan di collection dashboard_pages dengan dataSources yang benar.`
        );
    }

    const sources = (config.dataSources as Record<string, unknown>[]).map(resolveFirestoreDataSource);

    if (sources.length === 0) {
        throw new Error(
            `[BQ] Semua dataSources untuk page "${page}" gagal di-resolve. ` +
            `Cek Firestore config: setiap dataSource harus punya dataset dan tableName.`
        );
    }

    const token = await getAccessToken();

    const sheets = await Promise.all(
        sources.map((source) => queryNativeTableAsSheet(source, token))
    );

    return {
        page,
        source: "bigquery",
        fetchedAt: new Date().toISOString(),
        sheetCount: sheets.length,
        sheets,
    };
}

// ── Page Data Filters ──────────────────────────────────────────────

/** Internal type for filter-compatible sheet (looser than PageSheet) */
type FilterableSheet = {
    name?: string | null;
    sheetName?: string | null;
    headers?: string[];
    rows?: Record<string, unknown>[];
    rowCount?: number;
    hierarchyMapping?: Record<string, string> | null;
    [key: string]: unknown;
};

function getDateColumn(sheet: FilterableSheet) {
    return (sheet.headers || []).find((h) => {
        const l = h.toLowerCase();
        return l.includes("time") || l.includes("date");
    }) || null;
}

function filterRowsByMaxDays(sheet: FilterableSheet, maxDays: number | null) {
    if (!maxDays || maxDays <= 0) return sheet;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    const dateColumn = getDateColumn(sheet);
    if (!dateColumn) return sheet;
    const rows = (sheet.rows || []).filter((row) => {
        const v = row[dateColumn];
        if (!v) return false;
        const parsed = new Date(String(v).replace(" ", "T"));
        return !Number.isNaN(parsed.getTime()) && parsed >= cutoff;
    });
    return { ...sheet, rows, rowCount: rows.length };
}

function filterLatestRows(sheet: FilterableSheet, latestRows: number | null) {
    if (!latestRows || latestRows <= 0) return sheet;
    const dateColumn = getDateColumn(sheet);
    if (!dateColumn) {
        const rows = (sheet.rows || []).slice(0, latestRows);
        return { ...sheet, rows, rowCount: rows.length };
    }
    const rows = [...(sheet.rows || [])]
        .sort((a, b) => {
            const aD = new Date(String(a[dateColumn] || "").replace(" ", "T")).getTime();
            const bD = new Date(String(b[dateColumn] || "").replace(" ", "T")).getTime();
            return (Number.isNaN(bD) ? 0 : bD) - (Number.isNaN(aD) ? 0 : aD);
        })
        .slice(0, latestRows);
    return { ...sheet, rows, rowCount: rows.length };
}

function filterColumns(sheet: FilterableSheet, columns: string[]) {
    if (!Array.isArray(columns) || columns.length === 0) return sheet;
    const requested = new Set(columns.map((c) => String(c).trim()).filter(Boolean));
    if (requested.size === 0) return sheet;
    const hierarchyColumns = new Set<string>();
    const mapping = sheet.hierarchyMapping || null;
    if (mapping) {
        for (const value of Object.values(mapping)) {
            if (value) hierarchyColumns.add(String(value));
        }
    }
    const allowed = new Set([...requested, ...hierarchyColumns, "_rowIndex"]);
    const headers = (sheet.headers || []).filter((h) => allowed.has(h));
    const rows = (sheet.rows || []).map((row) => {
        const next: Record<string, unknown> = {};
        for (const key of Object.keys(row)) {
            if (allowed.has(key)) next[key] = row[key];
        }
        return next;
    });
    return { ...sheet, headers, rows };
}

function filterRowsByGI(sheet: FilterableSheet, gi: string | null) {
    if (!gi) return sheet;
    const mapping = sheet.hierarchyMapping || null;
    const giColumn = mapping?.gi
        || (sheet.headers || []).find((h) => h.toLowerCase().includes("gardu induk"))
        || null;
    if (!giColumn) return sheet;
    const target = gi.trim().toLowerCase();
    const rows = (sheet.rows || []).filter((row) =>
        String(row[giColumn] || "").trim().toLowerCase() === target
    );
    return { ...sheet, rows, rowCount: rows.length };
}

function filterRowsByBBox(
    sheet: FilterableSheet,
    bbox: { west: number; south: number; east: number; north: number } | null
) {
    if (!bbox) return sheet;
    const headers = sheet.headers || [];
    const latCandidates = ["strike_lat", "tower_lat", "LAT", "Latitude", "latitude"];
    const lngCandidates = ["strike_lon", "tower_lon", "LONG", "Longitude", "longitude"];
    const latCol = latCandidates.find((c) => headers.includes(c)) || null;
    const lngCol = lngCandidates.find((c) => headers.includes(c)) || null;
    if (!latCol || !lngCol) return sheet;
    const rows = (sheet.rows || []).filter((row) => {
        const lat = Number.parseFloat(String(row[latCol] || ""));
        const lng = Number.parseFloat(String(row[lngCol] || ""));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
    });
    return { ...sheet, rows, rowCount: rows.length };
}

/**
 * Apply server-side filters (sheet selection, columns, date range, bbox, GI) to a PagePayload.
 */
export function applyPageDataFilters(
    payload: { page: string; sheets?: FilterableSheet[]; [key: string]: unknown },
    {
        sheetFilter,
        sheetFilters,
        maxDays,
        latestRows,
        columns,
        gi,
        bbox,
    }: {
        sheetFilter?: string | null;
        sheetFilters?: string[];
        maxDays?: number | null;
        latestRows?: number | null;
        columns?: string[];
        gi?: string | null;
        bbox?: { west: number; south: number; east: number; north: number } | null;
    }
) {
    const normalizedFilterSet = new Set(
        (sheetFilters || []).map((v) => v.trim().toLowerCase()).filter(Boolean)
    );
    if (sheetFilter?.trim()) {
        normalizedFilterSet.add(sheetFilter.trim().toLowerCase());
    }

    const targetSheets = normalizedFilterSet.size > 0
        ? (payload.sheets || []).filter((s) =>
            normalizedFilterSet.has((s.sheetName || "").trim().toLowerCase())
        )
        : payload.sheets || [];

    if (normalizedFilterSet.size > 0 && targetSheets.length === 0) {
        const requested = sheetFilter || Array.from(normalizedFilterSet).join(", ");
        throw new Error(`Sheet "${requested}" not found in page data for "${payload.page}"`);
    }

    const sheets = targetSheets.map((sheet) =>
        filterColumns(
            filterLatestRows(
                filterRowsByBBox(
                    filterRowsByGI(
                        filterRowsByMaxDays(sheet, maxDays ?? null),
                        gi ?? null
                    ),
                    bbox ?? null
                ),
                latestRows ?? null
            ),
            columns || []
        )
    );

    return {
        ...payload,
        sheetCount: sheets.length,
        columnsFiltered: Array.isArray(columns) && columns.length > 0 ? columns : null,
        sheets: sheets.map((s) => ({
            ...s,
            name: s.name || s.sheetName || null,
        })),
    };
}

// ── Native Table Refresh ───────────────────────────────────────────

/**
 * Refresh a single native table by running CREATE OR REPLACE from its view.
 * Takes dataset + tableName directly (from Firestore config).
 */
export async function refreshNativeTable(
    dataset: string,
    tableName: string,
): Promise<{ ok: boolean; table: string; error?: string }> {
    try {
        const viewName = tableName.replace(/^n_/, "v_");
        const token = await getAccessToken();
        const sql = `CREATE OR REPLACE TABLE \`${BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\` AS SELECT * FROM \`${BIGQUERY_PROJECT_ID}.${dataset}.${viewName}\``;
        await queryBigQuery(sql, token);
        console.log(`[BQ] Refreshed: ${dataset}.${tableName}`);
        return { ok: true, table: `${dataset}.${tableName}` };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[BQ] Failed to refresh ${dataset}.${tableName}:`, msg);
        return { ok: false, table: `${dataset}.${tableName}`, error: msg };
    }
}

/**
 * Collect all unique {dataset, tableName} pairs from ALL Firestore page configs.
 */
async function collectAllNativeTablesFromFirestore(): Promise<{ dataset: string; tableName: string }[]> {
    const allPages = getAllPages();
    const seen = new Set<string>();
    const tables: { dataset: string; tableName: string }[] = [];

    for (const page of allPages) {
        try {
            const config = await loadPageConfigFromFirestore(page.path);
            if (!config || !Array.isArray(config.dataSources)) continue;

            for (const ds of config.dataSources as Record<string, unknown>[]) {
                const sheetName = String(ds.sheetName || "");
                const mapping = SHEET_TO_TABLE[sheetName];
                if (!mapping) continue;

                const key = `${mapping.dataset}.${mapping.table}`;
                if (seen.has(key)) continue;
                seen.add(key);
                tables.push({ dataset: mapping.dataset, tableName: mapping.table });
            }
        } catch {
            // Skip pages without config
        }
    }

    return tables;
}

/**
 * Refresh ALL native tables discovered from Firestore page configs.
 */
export async function refreshAllNativeTables(): Promise<{ ok: boolean; refreshed: string[]; errors: string[] }> {
    const tables = await collectAllNativeTablesFromFirestore();

    if (tables.length === 0) {
        return { ok: false, refreshed: [], errors: ["No native tables found in Firestore configs"] };
    }

    const results = await Promise.all(
        tables.map(({ dataset, tableName }) => refreshNativeTable(dataset, tableName))
    );

    const refreshed = results.filter((r) => r.ok).map((r) => r.table);
    const errors = results.filter((r) => !r.ok).map((r) => `${r.table}: ${r.error}`);

    return { ok: errors.length === 0, refreshed, errors };
}

/**
 * Refresh native tables for a specific page.
 * Reads Firestore config to determine which tables the page uses.
 */
export async function refreshPageNativeTables(page: string): Promise<{ ok: boolean; refreshed: string[]; errors: string[] }> {
    try {
        const config = await loadPageConfigFromFirestore(page);
        if (!config || !Array.isArray(config.dataSources) || config.dataSources.length === 0) {
            return { ok: false, refreshed: [], errors: [`No Firestore config for page: ${page}`] };
        }

        const seen = new Set<string>();
        const tables: { dataset: string; tableName: string }[] = [];

        for (const ds of config.dataSources as Record<string, unknown>[]) {
            const sheetName = String(ds.sheetName || "");
            const mapping = SHEET_TO_TABLE[sheetName];
            if (!mapping) continue;

            const key = `${mapping.dataset}.${mapping.table}`;
            if (seen.has(key)) continue;
            seen.add(key);
            tables.push({ dataset: mapping.dataset, tableName: mapping.table });
        }

        const results = await Promise.all(
            tables.map(({ dataset, tableName }) => refreshNativeTable(dataset, tableName))
        );

        const refreshed = results.filter((r) => r.ok).map((r) => r.table);
        const errors = results.filter((r) => !r.ok).map((r) => `${r.table}: ${r.error}`);

        return { ok: errors.length === 0, refreshed, errors };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return { ok: false, refreshed: [], errors: [msg] };
    }
}
