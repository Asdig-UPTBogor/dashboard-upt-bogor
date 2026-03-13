/**
 * /api/write-data — Write data back to Google Sheets.
 *
 * This endpoint allows the dashboard to write data to spreadsheets
 * (e.g. QC corrections, manual data entry).
 *
 * Since BQ External Tables are live views into Sheets,
 * writing to the Sheet automatically updates what BQ sees.
 * No sync worker trigger needed.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/dashboard-config";

const SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
];

async function getSheetsClient() {
    const auth = getGoogleAuth(SHEETS_SCOPES);
    return google.sheets({ version: "v4", auth });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { spreadsheetId, sheetName, updates = [], appends = [] } = body;

        if (!spreadsheetId || !sheetName) {
            return NextResponse.json(
                { error: "Missing spreadsheetId or sheetName" },
                { status: 400 }
            );
        }

        const client = await getSheetsClient();

        // 1. Fetch headers to map JSON keys to column positions
        const headerRes = await client.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!1:1`,
        });
        const headers = headerRes.data.values?.[0] || [];
        if (headers.length === 0) {
            return NextResponse.json(
                { error: "Sheet has no headers configured." },
                { status: 400 }
            );
        }

        // 2. Process Appends (New Rows)
        if (appends.length > 0) {
            const appendArrays = appends.map((item: { data: Record<string, unknown> }) => {
                const rowArray = new Array(headers.length).fill("");
                for (const [key, val] of Object.entries(item.data)) {
                    const colIdx = headers.indexOf(key);
                    if (colIdx >= 0) rowArray[colIdx] = val;
                }
                return rowArray;
            });

            await client.spreadsheets.values.append({
                spreadsheetId,
                range: `'${sheetName}'!A1`,
                valueInputOption: "USER_ENTERED",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values: appendArrays },
            });
            console.log(`[Write API] Appended ${appends.length} rows to ${sheetName}`);
        }

        // 3. Process Updates (Existing Rows)
        if (updates.length > 0) {
            const batchUpdateData = updates.map((update: { _rowIndex: number; data: Record<string, unknown> }) => {
                const rowIndex = update._rowIndex;
                if (!rowIndex) throw new Error("Missing _rowIndex for update payload");

                const rowArray = new Array(headers.length).fill("");
                for (const [key, val] of Object.entries(update.data)) {
                    const colIdx = headers.indexOf(key);
                    if (colIdx >= 0) rowArray[colIdx] = val;
                }
                return {
                    range: `'${sheetName}'!A${rowIndex}`,
                    values: [rowArray],
                };
            });

            await client.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: batchUpdateData,
                },
            });
            console.log(`[Write API] Updated ${updates.length} rows in ${sheetName}`);
        }

        // No sync worker trigger needed — BQ External Tables see Sheet changes instantly
        return NextResponse.json({
            success: true,
            message: `Successfully synced ${appends.length + updates.length} rows.`,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to sync data";
        console.error("[Write API] Error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
