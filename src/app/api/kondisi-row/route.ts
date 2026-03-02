/**
 * /api/kondisi-row — Kondisi ROW Transmisi
 *
 * Resolves from page-config SSOT (transmisi--row.json via Data Connector).
 * Sheet: "KONDISI ROW" in Master Transmisi spreadsheet.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import { loadPageConfig } from "@/lib/data-source-registry";
import { ApiCache } from "@/lib/api-cache";

// Cache: 5 min (Next.js ISR level)
export const revalidate = 300;

// In-memory cache — fetch once, manual refresh only
const cache = new ApiCache<{ data: Record<string, string>[]; headers: string[]; total: number; source: string }>();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "true";
    if (refresh) cache.invalidate();

    try {
        const result = await cache.getOrFetch(async () => {
            const config = loadPageConfig("/transmisi/row");
            if (!config || config.dataSources.length === 0) {
                throw new Error("No data source configured for /transmisi/row");
            }

            const ds = config.dataSources[0];

            const auth = new google.auth.GoogleAuth({
                keyFile: GOOGLE_CREDS_PATH,
                scopes: [...GOOGLE_SCOPES],
            });
            const sheets = google.sheets({ version: "v4", auth });

            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: ds.spreadsheetId,
                range: `'${ds.sheetName}'!A:AZ`,
            });

            const rows = res.data.values || [];
            if (rows.length < 2) {
                return { data: [], headers: [], total: 0, source: ds.sheetName };
            }

            const headers = rows[0] as string[];
            const data: Record<string, string>[] = [];

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

            return {
                data,
                headers: headers.map(h => h?.trim() || ""),
                total: data.length,
                source: ds.sheetName,
            };
        });

        return NextResponse.json(result);
    } catch (err) {
        console.error("[/api/kondisi-row] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch kondisi ROW data", detail: String(err) },
            { status: 500 },
        );
    }
}
