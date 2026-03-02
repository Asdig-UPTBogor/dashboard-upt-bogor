/**
 * Page Data API — page-configs SSOT
 *
 * GET /api/page-data?page=/proteksi/asset
 * GET /api/page-data?page=/asset-maps&sheet=MASTER ASSET TOWER
 * GET /api/page-data?page=/asset-maps&sheet=MASTER ASSET TOWER&refresh=true
 *
 * Single Source of Truth: page-configs/*.json (from Data Connector)
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
    normalizeHierarchyValue,
} from "@/lib/data-source-registry";
import { ApiCache } from "@/lib/api-cache";

// Cache: 5 min (Next.js ISR level)
export const revalidate = 300;

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
    error: string | null;
}

/* ── Fetch a single sheet with optional column filtering ── */
async function fetchSheetData(
    spreadsheetId: string,
    sheetName: string,
    filterColumns?: string[],
    hierarchyColumns?: string[]
): Promise<{ headers: string[]; rows: Record<string, string>[]; rowCount: number }> {
    const client = await getClient();
    const res = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:ZZ`,
    });
    const rows = res.data.values || [];
    if (rows.length < 1) return { headers: [], rows: [], rowCount: 0 };

    const allHeaders = rows[0] as string[];

    // Determine which columns to include
    let includeIndices: number[] | null = null;
    if (filterColumns && filterColumns.length > 0) {
        const requestedSet = new Set(
            filterColumns.map((c) => c.trim().toLowerCase())
        );
        // Always include hierarchy columns
        if (hierarchyColumns) {
            for (const hCol of hierarchyColumns) {
                requestedSet.add(hCol.trim().toLowerCase());
            }
        }
        includeIndices = allHeaders
            .map((h, i) => (requestedSet.has(h.trim().toLowerCase()) ? i : -1))
            .filter((i) => i >= 0);
    }

    // Build header list
    const headers = includeIndices
        ? includeIndices.map((i) => allHeaders[i])
        : allHeaders;

    // Determine which headers are hierarchy columns (for normalization)
    const hierarchySet = new Set(
        (hierarchyColumns || []).map((c) => c.trim().toLowerCase())
    );

    // Build data rows — skip phantom rows where all columns are empty
    const dataRows = rows.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        if (includeIndices) {
            for (const i of includeIndices) {
                const h = allHeaders[i];
                let value = row[i] || "";
                if (hierarchySet.has(h.trim().toLowerCase())) {
                    value = normalizeHierarchyValue(value);
                }
                obj[h] = value;
            }
        } else {
            allHeaders.forEach((h, i) => {
                let value = row[i] || "";
                if (hierarchySet.has(h.trim().toLowerCase())) {
                    value = normalizeHierarchyValue(value);
                }
                obj[h] = value;
            });
        }
        return obj;
    }).filter((obj) => Object.values(obj).some((v) => v.trim() !== ""));

    return { headers, rows: dataRows, rowCount: dataRows.length };
}

/* ── GET handler ── */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const pagePath = url.searchParams.get("page");
    const sheetFilter = url.searchParams.get("sheet");
    const isRefresh = url.searchParams.get("refresh") === "true";

    if (!pagePath) {
        return NextResponse.json(
            { error: "Missing query parameter: page", hint: "Usage: /api/page-data?page=/proteksi/asset" },
            { status: 400 }
        );
    }

    // ═══════════════════════════════════════════════
    // SSOT: page-configs/*.json (from Data Connector)
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

    console.log(`[page-data] ${pagePath}${sheetFilter ? ` → sheet:${sheetFilter}` : ""} → ${targetSources.length} source(s)`);

    // Invalidate cache if refresh requested
    if (isRefresh) {
        const cacheKey = getCacheKey(pagePath, sheetFilter || undefined);
        const cache = pageDataCache.get(cacheKey);
        if (cache) cache.invalidate();
        // Also invalidate per-sheet caches for this page
        for (const [key, c] of pageDataCache.entries()) {
            if (key.startsWith(`${pagePath}::`)) c.invalidate();
        }
        console.log(`[page-data] Cache invalidated for ${pagePath}`);
    }

    try {
        const cacheKey = getCacheKey(pagePath, sheetFilter || undefined);
        const cache = getOrCreateCache(cacheKey);

        const fetchAll = async (): Promise<SheetResult> => {
            const sheets = await Promise.all(
                targetSources.map(async (ds) => {
                    try {
                        const connectedColumns = (ds.columnsUsed || []).map(
                            (c: { name: string; pos: string }) => c.name
                        );
                        const hierarchyColumns = ds.hierarchyMapping
                            ? Object.values(ds.hierarchyMapping).filter(Boolean) as string[]
                            : (ds.hierarchyPresent || []);

                        const data = await fetchSheetData(
                            ds.spreadsheetId,
                            ds.sheetName,
                            connectedColumns.length > 0 ? connectedColumns : undefined,
                            hierarchyColumns.length > 0 ? hierarchyColumns : undefined
                        );

                        return {
                            sheetName: ds.sheetName,
                            spreadsheetTitle: ds.label || ds.sheetName,
                            spreadsheetId: ds.spreadsheetId,
                            hierarchyMapping: ds.hierarchyMapping || null,
                            hierarchyPresent: ds.hierarchyPresent || [],
                            columnsConnected: connectedColumns,
                            ...data,
                            error: null,
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
                            error: err instanceof Error ? err.message : "Unknown error",
                        };
                    }
                })
            );

            // For single sheet queries, return first result; for multi, wrap
            if (sheetFilter && sheets.length === 1) {
                return sheets[0];
            }
            // Return first sheet as the result for caching (multi-sheet handled below)
            return sheets[0];
        };

        // Use cache for single-sheet requests
        if (sheetFilter) {
            const result = await cache.getOrFetch(fetchAll);
            return NextResponse.json({
                page: pagePath,
                source: "page-config",
                fetchedAt: new Date().toISOString(),
                cacheAge: cache.ageSeconds,
                sheetCount: 1,
                sheets: [result],
            });
        }

        // Multi-sheet: fetch all without per-sheet caching
        const sheets = await Promise.all(
            targetSources.map(async (ds) => {
                const perSheetKey = getCacheKey(pagePath, ds.sheetName);
                const perSheetCache = getOrCreateCache(perSheetKey);

                return perSheetCache.getOrFetch(async () => {
                    try {
                        const connectedColumns = (ds.columnsUsed || []).map(
                            (c: { name: string; pos: string }) => c.name
                        );
                        const hierarchyColumns = ds.hierarchyMapping
                            ? Object.values(ds.hierarchyMapping).filter(Boolean) as string[]
                            : (ds.hierarchyPresent || []);

                        const data = await fetchSheetData(
                            ds.spreadsheetId,
                            ds.sheetName,
                            connectedColumns.length > 0 ? connectedColumns : undefined,
                            hierarchyColumns.length > 0 ? hierarchyColumns : undefined
                        );

                        return {
                            sheetName: ds.sheetName,
                            spreadsheetTitle: ds.label || ds.sheetName,
                            spreadsheetId: ds.spreadsheetId,
                            hierarchyMapping: ds.hierarchyMapping || null,
                            hierarchyPresent: ds.hierarchyPresent || [],
                            columnsConnected: connectedColumns,
                            ...data,
                            error: null,
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
                            error: err instanceof Error ? err.message : "Unknown error",
                        };
                    }
                });
            })
        );

        return NextResponse.json({
            page: pagePath,
            source: "page-config",
            fetchedAt: new Date().toISOString(),
            cacheAge: null,
            sheetCount: sheets.length,
            sheets,
        });
    } catch (error) {
        console.error("[page-data] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch page data" },
            { status: 500 }
        );
    }
}
