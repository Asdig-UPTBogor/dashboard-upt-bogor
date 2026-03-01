/**
 * Generic Sheet API — Catch-All Route
 *
 * Dynamically serves spreadsheet data based on the registry (spreadsheet-config.json).
 * When a sheet is linked to a page with a route like `/api/proteksi/asset`,
 * this catch-all handler at `/api/sheets/[...path]` will:
 *
 *   1. Reconstruct the route (e.g., `/api/sheets/proteksi/asset` → `/api/proteksi/asset`)
 *   2. Look up the registry for sheets with that route
 *   3. Fetch the data from Google Sheets
 *   4. Return JSON with headers, rows, and metadata
 *
 * v2 enhancements:
 *   - ?columns=A,B,C — filter to specific columns (hierarchy columns always included)
 *   - Hierarchy values normalized (DBT-style: trim, collapse spaces, uppercase)
 *
 * This does NOT replace existing dedicated APIs (/api/overview, /api/towers, etc.).
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import { loadRegistry, normalizeHierarchyValue } from "@/lib/data-source-registry";

// Cache: 5 min
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

/* ── Fetch a single sheet from a spreadsheet ── */
async function fetchSheetData(
    spreadsheetId: string,
    sheetName: string,
    filterColumns?: string[],
    hierarchyColumns?: string[]
) {
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
        // Build set of requested columns + always include hierarchy columns
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

    // Build data rows
    const dataRows = rows.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        if (includeIndices) {
            for (const i of includeIndices) {
                const h = allHeaders[i];
                let value = row[i] || "";
                // Normalize hierarchy values
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
    });

    return { headers, rows: dataRows, rowCount: dataRows.length };
}

/* ── GET handler ── */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params;
        // Reconstruct the target route: /api/sheets/proteksi/asset → /api/proteksi/asset
        const targetRoute = `/api/${path.join("/")}`;

        // Parse query parameters
        const url = new URL(request.url);
        const columnsParam = url.searchParams.get("columns");
        const filterColumns = columnsParam
            ? columnsParam.split(",").map((c) => c.trim()).filter(Boolean)
            : undefined;

        // Look up registry for sheets linked to this route
        const registry = loadRegistry();
        const matches: {
            spreadsheetId: string;
            sheetName: string;
            title: string;
            hierarchyMapping?: Record<string, string>;
        }[] = [];

        for (const entry of registry) {
            for (const sheet of entry.sheets) {
                if (sheet.route === targetRoute) {
                    matches.push({
                        spreadsheetId: entry.spreadsheetId,
                        sheetName: sheet.sheetName,
                        title: entry.title,
                        hierarchyMapping: sheet.hierarchyMapping,
                    });
                }
            }
        }

        if (matches.length === 0) {
            return NextResponse.json(
                {
                    error: "No sheets found for this route",
                    route: targetRoute,
                    hint: "Link a spreadsheet sheet to this page via Data Source Manager first",
                },
                { status: 404 }
            );
        }

        // Fetch all matching sheets in parallel
        const results = await Promise.all(
            matches.map(async (m) => {
                try {
                    // Collect hierarchy column names for normalization
                    const hierarchyColumns = m.hierarchyMapping
                        ? Object.values(m.hierarchyMapping)
                        : undefined;

                    const data = await fetchSheetData(
                        m.spreadsheetId,
                        m.sheetName,
                        filterColumns,
                        hierarchyColumns
                    );
                    return {
                        sheetName: m.sheetName,
                        spreadsheetTitle: m.title,
                        spreadsheetId: m.spreadsheetId,
                        ...data,
                        error: null,
                    };
                } catch (err) {
                    return {
                        sheetName: m.sheetName,
                        spreadsheetTitle: m.title,
                        spreadsheetId: m.spreadsheetId,
                        headers: [],
                        rows: [],
                        rowCount: 0,
                        error: err instanceof Error ? err.message : "Unknown error",
                    };
                }
            })
        );

        return NextResponse.json({
            route: targetRoute,
            fetchedAt: new Date().toISOString(),
            sheetCount: results.length,
            columnsFiltered: filterColumns || null,
            sheets: results,
        });
    } catch (error) {
        console.error("[Generic Sheet API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch sheet data" },
            { status: 500 }
        );
    }
}
