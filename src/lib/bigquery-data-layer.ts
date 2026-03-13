/**
 * bigquery-data-layer.ts
 *
 * Core data layer for the Dashboard → BigQuery integration.
 *
 * Responsibilities:
 * 1. Map page paths to BQ View names
 * 2. Query BQ Views via REST API
 * 3. Normalize BQ column names to display format (underscore → space)
 * 4. Return data in the PagePayload format expected by usePageData
 *
 * Architecture:
 *   Browser → /api/page-data → this module → BQ Views → External Tables → Spreadsheets
 *
 * @module bigquery-data-layer
 */

import { getGoogleAuth } from "@/lib/dashboard-config";

// ── Configuration ──────────────────────────────────────────────────

const BIGQUERY_PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const BIGQUERY_VIEWS_DATASET =
    process.env.BIGQUERY_VIEWS_DATASET || "dashboard_views";

const BIGQUERY_LOCATION =
    process.env.BIGQUERY_LOCATION || "asia-southeast2";

const BIGQUERY_SCOPES = [
    "https://www.googleapis.com/auth/bigquery.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
];

// ── Types ──────────────────────────────────────────────────────────

/** A single sheet/view result, matching the frontend SheetData interface */
export interface PageSheet {
    name: string;
    sheetName: string;
    headers: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    hierarchyMapping: Record<string, string> | null;
    hierarchyPresent: string[];
    error: string | null;
}

/** Full page data payload, matching the frontend PageDataResponse interface */
export interface PagePayload {
    page: string;
    source: string;
    fetchedAt: string;
    sheetCount: number;
    sheets: PageSheet[];
    [key: string]: unknown;
}

/** Configuration for a single BQ View data source */
interface ViewSource {
    /** BQ View name (e.g. "v_hi_trafo") */
    viewName: string;
    /** Display name shown to frontend (e.g. "MTU TRAFO") */
    sheetName: string;
    /** Hierarchy column mapping for cross-filtering */
    hierarchyMapping: Record<string, string> | null;
    /** Which hierarchy levels are present */
    hierarchyPresent: string[];
}

// ── Page → BQ View Mapping ─────────────────────────────────────────
//
// This is the single source of truth for which BQ Views serve which pages.
// Each page can have one or more ViewSources.
// The sheetName MUST match what the frontend page component expects
// (typically what's in the page-config JSON).
//
// When adding a new page:
// 1. Create the BQ View in dashboard_views dataset
// 2. Add the mapping entry here
// 3. That's it — no other code changes needed

const PAGE_VIEW_MAP: Record<string, ViewSource[]> = {
    "/gardu-induk/hi-trafo": [
        {
            viewName: "v_hi_trafo",
            sheetName: "MTU TRAFO",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk", bay: "Master Bay" },
            hierarchyPresent: ["ultg", "gi", "bay"],
        },
    ],
    "/proteksi/asset": [
        {
            viewName: "v_proteksi_asset",
            sheetName: "Asset Relay UPT Bogor",
            hierarchyMapping: { ultg: "ULTG", gi: "Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/maintenance/test-page": [
        {
            viewName: "v_proteksi_asset",
            sheetName: "Asset Relay UPT Bogor",
            hierarchyMapping: { ultg: "ULTG", gi: "Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/jadwal-pekerjaan": [
        {
            viewName: "v_jadwal_padam",
            sheetName: "Jadwal Padam",
            hierarchyMapping: { ultg: "ULTG", gi: "Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/maintenance/master-data": [
        {
            viewName: "v_maintenance_master",
            sheetName: "Master Gardu Induk",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/asset-maps": [
        {
            viewName: "v_asset_maps",
            sheetName: "MASTER ASSET TOWER",
            hierarchyMapping: null,
            hierarchyPresent: [],
        },
    ],
    "/transmisi/anomali": [
        {
            viewName: "v_transmisi_anomali",
            sheetName: "6.ASSESMENT TOWER DAN VENOM",
            hierarchyMapping: { ultg: "ULTG", gi: "GARDU INDUK" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/transmisi/monitoring-tower-kritis": [
        {
            viewName: "v_transmisi_anomali",
            sheetName: "6.ASSESMENT TOWER DAN VENOM",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/transmisi/asset": [
        {
            viewName: "v_transmisi_asset",
            sheetName: "0.RESUME JARINGAN",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/transmisi/healthy-index": [
        {
            viewName: "v_transmisi_healthy_index",
            sheetName: "5.HEALTHY INDEX TOWER",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/transmisi/kerawanan": [
        {
            viewName: "v_transmisi_kerawanan",
            sheetName: "MASTER ASSET TOWER",
            hierarchyMapping: { ultg: "MASTER ULTG", gi: "MASTER GARDU INDUK" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/transmisi/petir": [
        {
            viewName: "v_transmisi_petir",
            sheetName: "3.PROTEKSI PETIR TAMBAHAN",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/transmisi/program-kerja": [
        {
            viewName: "v_transmisi_program_kerja",
            sheetName: "14.LM JARINGAN 2026",
            hierarchyMapping: {},
            hierarchyPresent: [],
        },
    ],
    "/transmisi/row": [
        {
            viewName: "v_transmisi_row",
            sheetName: "12.KONDISI ROW",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/transmisi/sld-tower": [
        {
            viewName: "v_transmisi_sld_tower",
            sheetName: "17.SLD TOWER",
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
    "/overview": [
        {
            viewName: "v_overview_gi_bay",
            sheetName: "Master Gardu Induk",
            hierarchyMapping: { ultg: "Master_ULTG", gi: "Master_Gardu_Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
        {
            viewName: "v_overview_asset_summary",
            sheetName: "Asset Summary",
            hierarchyMapping: { ultg: "Master_ULTG", gi: "Master_Gardu_Induk" },
            hierarchyPresent: ["ultg", "gi"],
        },
    ],
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
// BQ auto-detect converts spaces to underscores in column names.
// Frontend expects the original names with spaces.
// We convert back: "Master_ULTG" → "Master ULTG"
//
// Special cases:
// - "ID_GI", "ID_Bay" → keep as-is (new columns from Views)
// - "qc_hierarchy" → keep as-is (QC column from Views)
// - "string_field_N" → keep as-is (auto-detect fallback)

const KEEP_AS_IS = new Set([
    "ID_GI",
    "ID_Bay",
    "qc_hierarchy",
]);

function normalizeColumnName(bqName: string): string {
    if (KEEP_AS_IS.has(bqName)) return bqName;
    if (bqName.startsWith("string_field_")) return bqName;
    // Replace underscores with spaces, preserving original casing
    return bqName.replace(/_/g, " ");
}

// ── BQ Query Execution ─────────────────────────────────────────────

interface BQQueryResult {
    schema?: { fields?: { name: string; type: string }[] };
    rows?: { f?: { v?: unknown }[] }[];
    totalRows?: string;
}

/**
 * Execute a SQL query against BigQuery and return typed results.
 * Uses the BQ REST API directly (no SDK dependency).
 */
async function queryBigQuery(sql: string, token: string): Promise<BQQueryResult> {
    const response = await fetch(
        `https://bigquery.googleapis.com/bigquery/v2/projects/${BIGQUERY_PROJECT_ID}/queries`,
        {
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
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`BigQuery query failed (${response.status}): ${text}`);
    }

    return response.json();
}

/**
 * Query a single BQ View and return it as a PageSheet.
 * Handles column name normalization and row formatting.
 */
async function queryViewAsSheet(
    viewName: string,
    sheetName: string,
    hierarchyMapping: Record<string, string> | null,
    hierarchyPresent: string[],
    token: string
): Promise<PageSheet> {
    try {
        const sql = `SELECT * FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_VIEWS_DATASET}.${viewName}\``;
        const result = await queryBigQuery(sql, token);

        // Extract column names from schema
        const bqColumns = (result.schema?.fields || []).map((f) => f.name);
        const displayColumns = bqColumns.map(normalizeColumnName);

        // Convert rows from BQ format [{f: [{v: val}, ...]}, ...] to [{col: val}, ...]
        const rows: Record<string, unknown>[] = (result.rows || []).map((row) => {
            const record: Record<string, unknown> = {};
            (row.f || []).forEach((cell, index) => {
                if (index < displayColumns.length) {
                    record[displayColumns[index]] = cell.v ?? null;
                }
            });
            return record;
        });

        // Normalize hierarchyMapping column names to match display format
        const normalizedMapping: Record<string, string> | null = hierarchyMapping
            ? Object.fromEntries(
                Object.entries(hierarchyMapping).map(([key, value]) => [
                    key,
                    normalizeColumnName(value),
                ])
            )
            : null;

        return {
            name: sheetName,
            sheetName,
            headers: displayColumns,
            rows,
            rowCount: rows.length,
            hierarchyMapping: normalizedMapping,
            hierarchyPresent,
            error: null,
        };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown query error";
        console.error(`[BQ] Error querying ${viewName}:`, errorMsg);
        return {
            name: sheetName,
            sheetName,
            headers: [],
            rows: [],
            rowCount: 0,
            hierarchyMapping: hierarchyMapping,
            hierarchyPresent,
            error: errorMsg,
        };
    }
}

// ── Server-side Cache ──────────────────────────────────────────────
//
// BQ External Tables read from Google Sheets on every query = slow.
// Cache page data in memory for CACHE_TTL_MS to avoid repeated BQ calls.
// First load is slow (~3-5s), subsequent loads within TTL are instant.

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
    data: PagePayload;
    expiresAt: number;
}

const pageCache = new Map<string, CacheEntry>();

/**
 * Get page data by querying BQ Views directly, with in-memory caching.
 *
 * This replaces the old getCurrentPageSnapshotFromBigQuery() which read
 * from the sync worker's page_snapshots_current table.
 *
 * Now data is live from the source spreadsheets via BQ External Tables → Views.
 * Results are cached in memory for 60 seconds to avoid hitting BQ on every request.
 *
 * @param page - Page path (e.g. "/gardu-induk/hi-trafo")
 * @returns PagePayload with sheets data, or null if page not found
 */
export async function getPageDataFromBigQuery(
    page: string
): Promise<PagePayload | null> {
    // Check cache first
    const cached = pageCache.get(page);
    if (cached && Date.now() < cached.expiresAt) {
        return { ...cached.data, source: "bigquery-views (cached)" };
    }

    const viewSources = PAGE_VIEW_MAP[page];
    if (!viewSources || viewSources.length === 0) {
        console.warn(`[BQ] No view mapping found for page: ${page}`);
        return null;
    }

    const token = await getAccessToken();

    // Query all views for this page in parallel
    const sheets = await Promise.all(
        viewSources.map((source) =>
            queryViewAsSheet(
                source.viewName,
                source.sheetName,
                source.hierarchyMapping,
                source.hierarchyPresent,
                token
            )
        )
    );

    const payload: PagePayload = {
        page,
        source: "bigquery-views",
        fetchedAt: new Date().toISOString(),
        sheetCount: sheets.length,
        sheets,
    };

    // Store in cache
    pageCache.set(page, {
        data: payload,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return payload;
}

/**
 * Get the list of all registered page paths.
 * Useful for validation and admin tools.
 */
export function getRegisteredPages(): string[] {
    return Object.keys(PAGE_VIEW_MAP);
}

/**
 * Check if a page path has BQ View mappings configured.
 */
export function isPageRegistered(page: string): boolean {
    return page in PAGE_VIEW_MAP;
}

// ── Re-export filter functions ─────────────────────────────────────
//
// These filter functions work on the PagePayload format and are shared
// between the old snapshot system and the new BQ Views system.
// They are kept in this file for cohesion.

export { applyPageDataFilters } from "@/lib/bigquery-page-snapshots";
