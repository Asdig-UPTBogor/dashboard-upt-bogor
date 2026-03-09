import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

export const revalidate = 300;

const SPREADSHEET_ID = "13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM";
const SHEET_NAME = "0.RESUME JARINGAN";

export async function GET() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });
        const sheets = google.sheets({ version: "v4", auth });

        // Start from A2, as row 1 usually has empty headers or title logic.
        // We will dynamically find the real header row.
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!A1:Z`,
        });

        const rows = res.data.values || [];
        if (rows.length < 2) {
            return NextResponse.json({ data: [], headers: [] });
        }

        // Find the first row that actually looks like a header (e.g. starts with NO or ULTG)
        let headerIdx = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
            if (rows[i][0] === "NO" || rows[i][0] === "NO.") {
                headerIdx = i;
                break;
            }
        }

        const headers = rows[headerIdx] as string[];
        const data = [];

        for (let i = headerIdx + 1; i < rows.length; i++) {
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
        console.error("[/api/asset-transmisi] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch Resume Jaringan data", detail: String(err) },
            { status: 500 },
        );
    }
}
