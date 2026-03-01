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
 * This does NOT replace existing dedicated APIs (/api/overview, /api/towers, etc.).
 * Those continue to work as before. This is for NEW pages that get sheets linked via
 * the Data Source Manager.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import { loadRegistry } from "@/lib/data-source-registry";

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
async function fetchSheetData(spreadsheetId: string, sheetName: string) {
    const client = await getClient();
    const res = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:ZZ`,
    });
    const rows = res.data.values || [];
    if (rows.length < 1) return { headers: [], rows: [], rowCount: 0 };

    const headers = rows[0] as string[];
    const dataRows = rows.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ""; });
        return obj;
    });

    return { headers, rows: dataRows, rowCount: dataRows.length };
}

/* ── GET handler ── */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params;
        // Reconstruct the target route: /api/sheets/proteksi/asset → /api/proteksi/asset
        const targetRoute = `/api/${path.join("/")}`;

        // Look up registry for sheets linked to this route
        const registry = loadRegistry();
        const matches: { spreadsheetId: string; sheetName: string; title: string }[] = [];

        for (const entry of registry) {
            for (const sheet of entry.sheets) {
                if (sheet.route === targetRoute) {
                    matches.push({
                        spreadsheetId: entry.spreadsheetId,
                        sheetName: sheet.sheetName,
                        title: entry.title,
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
                    const data = await fetchSheetData(m.spreadsheetId, m.sheetName);
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
