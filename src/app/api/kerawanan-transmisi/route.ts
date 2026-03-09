import { google } from "googleapis";
import { NextResponse } from "next/server";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

const SPREADSHEET_ID = "13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM";
const SHEET_NAME = "MASTER ASSET TOWER";

export async function GET() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });

        const sheets = google.sheets({ version: "v4", auth });

        // Let's fetch A1:AJ to cover the requested Y-AJ columns
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!A1:AJ`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Find the header row (sometimes row 1, sometimes row 2 depending on formatting)
        // Let's assume the first row with "NO" or "ULTG" is the header
        let headerIdx = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
            if (rows[i][0] === "NO" || rows[i][0] === "NO." || rows[i][0] === "ID" || rows[i][1] === "ULTG") {
                headerIdx = i;
                break;
            }
        }

        const headers = rows[headerIdx];

        let noHeaderEncountered = false;
        const normalizedHeaders = headers.map((h: string) => {
            if (h === "NO" || h === "NO.") {
                if (noHeaderEncountered) {
                    return `NO_${Math.random().toString(36).substring(7)}`;
                }
                noHeaderEncountered = true;
                return "NO";
            }
            return h?.trim() || "";
        });

        const data = rows.slice(headerIdx + 1).map(row => {
            const obj: Record<string, string> = {};
            normalizedHeaders.forEach((header: string, index: number) => {
                if (header !== "") {
                    obj[header] = row[index] || "";
                }
            });
            return obj;
        });

        return NextResponse.json({ headers: normalizedHeaders, data });
    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
