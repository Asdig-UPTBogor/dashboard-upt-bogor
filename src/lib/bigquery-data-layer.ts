/**
 * bigquery-data-layer.ts
 *
 * Core data layer for the Dashboard → BigQuery integration.
 *
 * Architecture (Phase 4 — CF Live ✅):
 *   Google Sheet → Cloud Function (15 min) → Native Table (n_) → Dashboard
 *
 * Data flow:
 *   1. Firestore dashboard_pages defines which sheets a page needs (sheetName, columns, hierarchy)
 *   2. Table resolution: explicit dataset/tableName in dashboard_pages → fallback to Firestore data_sources
 *   3. queryNativeTableAsSheet() queries BQ and normalizes column names
 *   4. Column names restored to original spreadsheet names via Firestore columnsUsed
 *   5. Response filtered to only include configured columns
 *
 * Native Tables refreshed every 15 min by Cloud Function (sheet-bq-sync).
 * No fallback — exact errors if table not found.
 *
 * @module bigquery-data-layer
 */

import { getGoogleAuth } from "@/lib/dashboard-config";
import { loadPageConfigFromFirestore } from "@/lib/firestore-dashboard-config";

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

// ── Dynamic Table Resolution (data_sources Firestore) ──────────────
//
// Resolves sheet names → BQ dataset + native table from Firestore data_sources.
// Cloud Function writes this metadata every 15 minutes.
// No hardcoded mapping — everything resolved at runtime from Firestore.
// No fallback — exact error if sheet not found.

const FIRESTORE_PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const FIRESTORE_BASE_URL =
    `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

const FIRESTORE_SCOPES = ["https://www.googleapis.com/auth/datastore"];

interface DataSourcesDoc {
    _id: string;
    dataset?: string;
    sheets?: Record<string, { tableName?: string; [k: string]: unknown }>;
    [k: string]: unknown;
}

/** In-memory cache for data_sources docs — TTL 60s (CF updates every 15 min) */
let _dataSourcesCache: { docs: DataSourcesDoc[]; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

function decodeFirestoreValue(val: unknown): unknown {
    if (!val || typeof val !== "object") return null;
    const v = val as Record<string, unknown>;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("arrayValue" in v) {
        const arr = v.arrayValue as { values?: unknown[] };
        return (arr.values || []).map(decodeFirestoreValue);
    }
    if ("mapValue" in v) {
        const map = v.mapValue as { fields?: Record<string, unknown> };
        const result: Record<string, unknown> = {};
        for (const [k, child] of Object.entries(map.fields || {})) {
            result[k] = decodeFirestoreValue(child);
        }
        return result;
    }
    return null;
}

function decodeFirestoreDoc(doc: { name: string; fields?: Record<string, unknown> }): DataSourcesDoc {
    const id = doc.name.split("/").pop() || "";
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(doc.fields || {})) {
        fields[k] = decodeFirestoreValue(v);
    }
    return { _id: id, ...fields } as DataSourcesDoc;
}

async function getFirestoreToken(): Promise<string> {
    const auth = getGoogleAuth(FIRESTORE_SCOPES);
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token || "";
    if (!token) throw new Error("[BQ] Failed to get Firestore access token");
    return token;
}

/**
 * Load all data_sources docs from Firestore (cached 60s).
 * These are written by the Cloud Function every 15 minutes.
 */
async function loadDataSourcesDocs(): Promise<DataSourcesDoc[]> {
    if (_dataSourcesCache && Date.now() - _dataSourcesCache.at < CACHE_TTL_MS) {
        return _dataSourcesCache.docs;
    }

    const token = await getFirestoreToken();
    const res = await fetch(`${FIRESTORE_BASE_URL}/data_sources?pageSize=50`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`[BQ] Failed to fetch data_sources from Firestore (${res.status}): ${text}`);
    }

    const data = await res.json() as { documents?: { name: string; fields?: Record<string, unknown> }[] };
    const docs = (data.documents || []).map(decodeFirestoreDoc);
    _dataSourcesCache = { docs, at: Date.now() };
    console.log(`[BQ] Loaded ${docs.length} data_sources docs from Firestore (cached ${CACHE_TTL_MS / 1000}s)`);
    return docs;
}

/**
 * Resolve a sheet name → { dataset, tableName } from data_sources collection.
 * Scans all data_sources docs to find the sheet.
 * Throws exact error if not found — NO fallback.
 */
function resolveTableFromDataSources(
    sheetName: string,
    docs: DataSourcesDoc[],
): { dataset: string; tableName: string } {
    for (const doc of docs) {
        if (doc._id === "_settings") continue;
        const sheets = doc.sheets;
        if (sheets && sheetName in sheets && sheets[sheetName]?.tableName) {
            return {
                dataset: String(doc.dataset),
                tableName: String(sheets[sheetName].tableName),
            };
        }
    }

    // NO fallback — exact error per RULES.md #5 & DATA_LAYER_DESIGN_STANDARD Section 11
    const available = docs
        .filter(d => d._id !== "_settings" && d.sheets)
        .flatMap(d => Object.keys(d.sheets || {}));
    throw new Error(
        `[BQ] Sheet "${sheetName}" tidak ditemukan di Firestore data_sources. ` +
        `Pastikan sheet ini sudah di-sync oleh Cloud Function. ` +
        `Available sheets: [${available.join(", ")}]`
    );
}

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

/** Convert a spreadsheet column name to what BQ/CF auto-detect would produce.
 *  Replaces special chars with underscores, collapses consecutive, trims leading.
 *  NOTE: Trailing underscore behavior is inconsistent between BQ auto-detect and CF.
 *  This function is ONLY used for building the reverse column name map (BQ → display).
 *  We NEVER use this to build SELECT queries — always SELECT * to avoid mismatches.
 */
function toBQColumnName(name: string): string {
    return name
        .replace(/\s+/g, "_")                 // spaces → underscore (separate step, like CF)
        .replace(/[^a-zA-Z0-9_]/g, "_")       // replace ALL non-alnum with _
        .replace(/_+/g, "_")                   // collapse consecutive underscores
        .replace(/^_|_$/g, "");                // trim BOTH leading AND trailing _ (aligned with CF)
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
 * Always uses SELECT * (BQ column names are unreliable to guess).
 * Filters to columnsUsed + hierarchy columns post-query per DC Canvas config.
 */
async function queryNativeTableAsSheet(
    source: ResolvedSource,
    token: string,
): Promise<PageSheet> {
    try {
        // Build column name map from Firestore columnsUsed
        const columnMap = buildColumnNameMap(source.columnsUsed);

        // Always SELECT * — column filtering happens post-query.
        // We NEVER guess BQ column names in SQL (inconsistent trailing _ behavior).
        const sql = `SELECT * FROM \`${BIGQUERY_PROJECT_ID}.${source.dataset}.${source.tableName}\``;

        const result = await queryBigQuery(sql, token);

        // Normalize BQ column names → display names
        const bqColumns = (result.schema?.fields || []).map((f) => f.name);
        const displayColumns = bqColumns.map((col) => normalizeColumnName(col, columnMap));

        // Build set of allowed columns: columnsUsed + hierarchy columns
        let allowedColumns: Set<string> | null = null;
        if (source.columnsUsed && source.columnsUsed.length > 0) {
            allowedColumns = new Set(source.columnsUsed);
            // Also include hierarchy columns so cross-filtering works
            if (source.hierarchyMapping) {
                for (const colName of Object.values(source.hierarchyMapping)) {
                    // hierarchyMapping values are BQ names (Master_ULTG) — normalize them
                    allowedColumns.add(normalizeColumnName(colName, columnMap));
                }
            }
        }

        // Filter to only allowed columns (or keep all if no columnsUsed)
        const filteredIndices: number[] = [];
        const filteredHeaders: string[] = [];
        displayColumns.forEach((col, i) => {
            if (!allowedColumns || allowedColumns.has(col)) {
                filteredIndices.push(i);
                filteredHeaders.push(col);
            }
        });

        // Convert rows: BQ [{f: [{v: val}]}] → [{col: val}], only allowed columns
        const rows: Record<string, unknown>[] = (result.rows || []).map((row) => {
            const record: Record<string, unknown> = {};
            const cells = row.f || [];
            for (const i of filteredIndices) {
                if (i < cells.length) {
                    record[filteredHeaders[filteredIndices.indexOf(i)]] = cells[i].v ?? null;
                }
            }
            return record;
        });

        console.log(`[BQ] ${source.sheetName}: ${filteredHeaders.length}/${bqColumns.length} cols → ${source.dataset}.${source.tableName} (${result.totalRows || 0} rows)`);

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
            headers: filteredHeaders,
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
 * Resolution chain:
 *   1. Explicit dataset+tableName in dashboard_pages → use directly
 *   2. Missing? → resolve from Firestore data_sources (written by CF)
 *   3. Not found in data_sources? → throw exact error (NO fallback)
 */
async function resolveFirestoreDataSource(ds: Record<string, unknown>): Promise<ResolvedSource> {
    const sheetName = String(ds.sheetName || "");
    if (!sheetName) {
        throw new Error(`[BQ] dataSource entry has no sheetName`);
    }

    // Step 1: Check explicit fields in dashboard_pages config
    let dataset = ds.dataset ? String(ds.dataset) : undefined;
    let tableName = ds.tableName ? String(ds.tableName) : undefined;

    if (!dataset || !tableName) {
        // Step 2: Resolve from Firestore data_sources
        const docs = await loadDataSourcesDocs();
        const resolved = resolveTableFromDataSources(sheetName, docs);
        dataset = dataset || resolved.dataset;
        tableName = tableName || resolved.tableName;
        console.log(`[BQ] "${sheetName}" → resolved from data_sources: ${dataset}.${tableName}`);
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
            if (typeof c === "string") return c;
            if (c && typeof c === "object" && "name" in c) return String((c as { name: string }).name);
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
    page: string,
    sheetFilter?: string | null,
): Promise<PagePayload> {
    // Load page config from Firestore — errors propagate, no silent catch
    const config = await loadPageConfigFromFirestore(page);

    if (!config || !Array.isArray(config.dataSources) || config.dataSources.length === 0) {
        throw new Error(
            `[BQ] Tidak ada Firestore config untuk page "${page}". ` +
            `Pastikan page sudah didaftarkan di collection dashboard_pages dengan dataSources yang benar.`
        );
    }

    // If sheetFilter is provided, only resolve+query that specific sheet
    const allDS = config.dataSources as Record<string, unknown>[];
    const filteredDS = sheetFilter
        ? allDS.filter(ds => {
            const sn = String(ds.sheetName || "").trim().toLowerCase();
            return sn === sheetFilter.trim().toLowerCase();
        })
        : allDS;

    if (filteredDS.length === 0 && sheetFilter) {
        // Fallback: if no match, query all (rare edge case)
        console.warn(`[BQ] sheetFilter "${sheetFilter}" not found in dataSources, querying all`);
    }

    const toResolve = filteredDS.length > 0 ? filteredDS : allDS;
    const sources = await Promise.all(
        toResolve.map(resolveFirestoreDataSource)
    );

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
// REMOVED (Phase 4): refreshNativeTable, collectAllNativeTablesFromFirestore,
// refreshAllNativeTables, refreshPageNativeTables.
// Cloud Function (sheet-bq-sync) handles all native table refresh.
// Dashboard no longer manages BQ table refresh directly.
