import { google } from "googleapis";
import { NextResponse } from "next/server";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

const SPREADSHEET_ID = "1Zzk_9dm_jNn1xQkrIXI8xufyOUVHPldmlUX9T8o53MQ";

export async function GET() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });

        const sheets = google.sheets({ version: "v4", auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "PEDOMAN 2026!A1:Z",
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // The first row is headers
        const headers = rows[0];

        // Ensure NO columns are handled specifically
        let noHeaderEncountered = false;
        const normalizedHeaders = headers.map((h: string) => {
            if (h === "NO" || h === "NO.") {
                if (noHeaderEncountered) {
                    return `NO_${Math.random().toString(36).substring(7)}`; // unique but won't be displayed
                }
                noHeaderEncountered = true;
                return "NO";
            }
            return h;
        });

        const data = rows.slice(1).map(row => {
            const obj: any = {};
            normalizedHeaders.forEach((header: string, index: number) => {
                obj[header] = row[index] || "";
            });
            return obj;
        });

        return NextResponse.json({ headers: normalizedHeaders, data });
    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
