/**
 * Overview API — ULTG/GI/BAY master data
 *
 * GET /api/overview
 *
 * Returns { ultgs, gis, bays } from the UPT Bogor master spreadsheet.
 * Used by: /gardu-induk page.
 *
 * v2: Migrated from legacy sheets.ts to use centralised auth from dashboard-config.
 *     No more hardcoded spreadsheet ID or singleton client.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

// Cache: 5 min — Overview ULTG/GI/BAY
export const revalidate = 300;

/* ── Google Sheets Client (shared with page-data pattern) ── */
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

/** Spreadsheet ID for UPT Bogor master data (ULTG/GI/BAY hierarchy) */
const MASTER_SPREADSHEET_ID = "1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ";

/**
 * Fetch a single sheet and convert rows to key-value objects.
 * Reuses the same pattern as page-data/route.ts fetchSheetData().
 */
async function fetchSheet(sheetName: string): Promise<Record<string, string>[]> {
    const client = await getClient();
    const res = await client.spreadsheets.values.get({
        spreadsheetId: MASTER_SPREADSHEET_ID,
        range: `'${sheetName}'!A:Z`,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0] as string[];
    return rows.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = (row as string[])[i] || ""; });
        return obj;
    });
}

export async function GET() {
    try {
        const [ultgs, gis, bays] = await Promise.all([
            fetchSheet("Master ULTG"),
            fetchSheet("Master GI"),
            fetchSheet("Master BAY"),
        ]);
        return NextResponse.json({ ultgs, gis, bays });
    } catch (error) {
        console.error("[overview] Sheets API error:", error);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }
}
