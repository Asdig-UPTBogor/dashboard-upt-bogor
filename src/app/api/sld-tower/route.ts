import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

export const revalidate = 300;

const SPREADSHEET_ID = "13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM";
const SHEET_NAME = "17.SLD TOWER";

export async function GET() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });
        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            ranges: [`'${SHEET_NAME}'!A:Z`],
            includeGridData: true,
        });

        const gridData = res.data.sheets?.[0]?.data?.[0]?.rowData;
        if (!gridData || gridData.length < 2) {
            return NextResponse.json({ data: [], headers: [] });
        }

        // Get headers from the first row
        const headerRow = gridData[0].values || [];
        const headers = headerRow.map(cell => cell.formattedValue?.toString().trim() || "");

        const data = [];
        for (let i = 1; i < gridData.length; i++) {
            const row = gridData[i].values || [];
            if (!row || row.length === 0) continue;

            const obj: Record<string, string> = {};
            let hasContent = false;

            headers.forEach((h, idx) => {
                const cell = row[idx];
                let cellValue = "";
                let url = "";

                if (cell) {
                    cellValue = cell.formattedValue?.toString().trim() || "";
                    url = cell.hyperlink || "";

                    if (!url && cell.userEnteredValue?.formulaValue?.toUpperCase().startsWith('=HYPERLINK(')) {
                        const match = cell.userEnteredValue.formulaValue.match(/=HYPERLINK\("([^"]+)"/i);
                        if (match) url = match[1];
                    }
                }

                if (url) {
                    cellValue = `${url}|${cellValue || 'Link'}`;
                }

                if (cellValue) hasContent = true;
                obj[h || `col_${idx}`] = cellValue;
            });

            if (hasContent) data.push(obj);
        }

        return NextResponse.json({
            data,
            headers: headers.map(h => h?.trim() || ""),
            total: data.length,
            source: SHEET_NAME,
        });
    } catch (err) {
        console.error("[/api/sld-tower] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch SLD Tower data", detail: String(err) },
            { status: 500 },
        );
    }
}
