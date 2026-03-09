import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets-api";
import { sheetCache } from "@/lib/sheet-cache";
import { workerEmitter } from "@/lib/background-prefetch";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { spreadsheetId, sheetName, updates = [], appends = [] } = body;

        if (!spreadsheetId || !sheetName) {
            return NextResponse.json({ error: "Missing spreadsheetId or sheetName" }, { status: 400 });
        }

        const client = await getSheetsClient();

        // 1. Fetch headers to map JSON keys to column positions
        const headerRes = await client.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!1:1`
        });
        const headers = headerRes.data.values?.[0] || [];
        if (headers.length === 0) {
            return NextResponse.json({ error: "Sheet has no headers configured." }, { status: 400 });
        }

        // 2. Process Appends (New Rows)
        if (appends.length > 0) {
            const appendArrays = appends.map((item: any) => {
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
                requestBody: { values: appendArrays }
            });
            console.log(`[Write API] Appended ${appends.length} rows to ${sheetName}`);
        }

        // 3. Process Updates (Existing Rows)
        if (updates.length > 0) {
            const batchUpdateData = updates.map((update: any) => {
                const rowIndex = update._rowIndex; // Must be 1-based index from Google Sheets (e.g. 2 for second row)
                if (!rowIndex) throw new Error("Missing _rowIndex for update payload");

                const rowArray = new Array(headers.length).fill("");
                for (const [key, val] of Object.entries(update.data)) {
                    const colIdx = headers.indexOf(key);
                    if (colIdx >= 0) rowArray[colIdx] = val;
                }
                return {
                    range: `'${sheetName}'!A${rowIndex}`,
                    values: [rowArray]
                };
            });

            await client.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: batchUpdateData
                }
            });
            console.log(`[Write API] Updated ${updates.length} rows in ${sheetName}`);
        }

        // 4. Force global cache invalidation and SSE broadcast
        sheetCache.invalidate(spreadsheetId, sheetName);
        console.log(`[Write API] Cleared cache for ${sheetName}`);

        workerEmitter.emit("cycle-done", {
            type: "cycle-done",
            success: 1,
            errors: 0,
            elapsedMs: 0,
            totalSheets: 1, // trigger SWR revalidation
        });

        return NextResponse.json({ success: true, message: `Successfully synced ${appends.length + updates.length} rows.` });
    } catch (error: any) {
        console.error("[Write API] Error:", error.message);
        return NextResponse.json({ error: error.message || "Failed to sync data" }, { status: 500 });
    }
}
