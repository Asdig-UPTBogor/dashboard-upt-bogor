/**
 * Explore spreadsheet — GET ?explore=<spreadsheetId>
 *
 * Fetches all sheets + headers for a specific spreadsheet,
 * with file-based cache (30 min TTL) to avoid Google API rate limits.
 */

import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { loadRegistry, SpreadsheetEntry } from "@/lib/data-source-registry";
import { getSheetsApi, devLog } from "./helpers";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function handleExplore(exploreId: string, forceRefresh: boolean) {
    const cacheDir = path.join(process.cwd(), ".cache");
    const cacheFile = path.join(cacheDir, `explore-${exploreId}.json`);

    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
        try {
            const stat = fs.statSync(cacheFile);
            const age = Date.now() - stat.mtimeMs;
            if (age < CACHE_TTL_MS) {
                const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
                devLog(`[explore] Cache HIT for ${exploreId} (age: ${Math.round(age / 1000)}s)`);
                return NextResponse.json(cached);
            }
        } catch { /* cache miss — proceed to fetch */ }
    }

    try {
        devLog(`[explore] Cache MISS for ${exploreId} — fetching from Google Sheets API`);
        const sheetsApi = await getSheetsApi();

        // Fetch spreadsheet metadata
        const meta = await sheetsApi.spreadsheets.get({
            spreadsheetId: exploreId,
            fields: "properties.title,sheets.properties(title,gridProperties)",
        });
        const title = meta.data.properties?.title || "Untitled";
        const sheetsRaw = meta.data.sheets || [];

        // Fetch headers for each sheet
        const sheetsData = await Promise.all(
            sheetsRaw.map(async (s) => {
                const name = s.properties?.title || "Unknown";
                const rowCount = s.properties?.gridProperties?.rowCount || 0;
                const colCount = s.properties?.gridProperties?.columnCount || 0;
                let headers: string[] = [];
                try {
                    const hRes = await sheetsApi.spreadsheets.values.get({
                        spreadsheetId: exploreId,
                        range: `'${name}'!1:1`,
                    });
                    headers = (hRes.data.values?.[0] || []).map(String).filter(Boolean);
                } catch { /* sheet might be empty */ }
                return { name, rowCount, colCount, headers };
            })
        );

        // Cross-reference with registry for link status
        const registry = loadRegistry();
        const entry = registry.find((e: SpreadsheetEntry) => e.spreadsheetId === exploreId);
        const registered = new Map<string, { usedBy: string[]; route: string }>();
        if (entry) {
            for (const sh of entry.sheets) {
                registered.set(sh.sheetName, { usedBy: sh.usedBy || [], route: sh.route || "" });
            }
        }

        const result = sheetsData.map((s) => {
            const reg = registered.get(s.name);
            return {
                ...s,
                registered: !!reg,
                usedBy: reg?.usedBy || [],
                route: reg?.route || "",
            };
        });

        const response = { success: true, spreadsheetId: exploreId, title, sheets: result };

        // Cache validation guard: jangan cache jika ada sheet dengan 0 headers
        // (tandanya fetch gagal/rate limit, bukan data yang valid)
        const hasEmptyHeaders = sheetsData.some(s => s.headers.length === 0 && s.rowCount > 1);
        if (!hasEmptyHeaders) {
            try {
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                fs.writeFileSync(cacheFile, JSON.stringify(response, null, 2));
                devLog(`[explore] Cached ${exploreId} (${sheetsData.length} sheets)`);
            } catch (cacheErr) {
                console.warn("[explore] Failed to write cache:", cacheErr);
            }
        } else {
            devLog(`[explore] SKIP cache for ${exploreId} — ${sheetsData.filter(s => s.headers.length === 0).length} sheet(s) have 0 headers (possible rate limit)`);
        }

        return NextResponse.json(response);
    } catch (err: unknown) {
        return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
    }
}
