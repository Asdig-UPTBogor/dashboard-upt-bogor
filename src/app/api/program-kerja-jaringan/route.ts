/**
 * /api/program-kerja-jaringan — Program Kerja Jaringan
 *
 * Resolves from page-config SSOT (transmisi--program-kerja.json via Data Connector).
 * Sheet: "LM JARINGAN 2026" in Master Transmisi spreadsheet.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import { resolveApiDataSource } from "@/lib/data-source-resolver";

// Cache: 5 min
export const revalidate = 300;

export async function GET() {
    try {
        const { spreadsheetId, sheetName } = resolveApiDataSource("/api/program-kerja-jaringan");

        const auth = new google.auth.GoogleAuth({
            keyFile: GOOGLE_CREDS_PATH,
            scopes: [...GOOGLE_SCOPES],
        });
        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A:Z`,
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

            // Skip completely empty rows
            const hasContent = Object.values(obj).some(v => v !== "");
            if (hasContent) {
                data.push(obj);
            }
        }

        return NextResponse.json({
            data,
            headers: headers.map(h => h?.trim() || ""),
            total: data.length,
            source: sheetName,
        });
    } catch (err) {
        console.error("[/api/program-kerja-jaringan] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch program kerja data", detail: String(err) },
            { status: 500 },
        );
    }
}
