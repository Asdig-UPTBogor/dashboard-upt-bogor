import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

export const revalidate = 300;

const SPREADSHEET_ID = "13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM";
const SHEET_NAME = "KONDISI ROW";

export async function GET() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });
        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!A:AZ`,
        });

        const rows = res.data.values || [];
        if (rows.length < 2) {
            return NextResponse.json({ data: [], headers: [] });
        }

        const headers = rows[0] as string[];
        const data = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const obj: Record<string, string> = {};
            headers.forEach((h, idx) => {
                obj[h?.trim() || `col_${idx}`] = (row[idx] || "").toString().trim();
            });

            const hasContent = Object.values(obj).some(v => v !== "");
            if (hasContent) data.push(obj);
        }

        return NextResponse.json({
            data,
            headers: headers.map(h => h?.trim() || ""),
            total: data.length,
            source: SHEET_NAME,
        });
    } catch (err) {
        console.error("[/api/kondisi-row] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch kondisi ROW data", detail: String(err) },
            { status: 500 },
        );
    }
}
