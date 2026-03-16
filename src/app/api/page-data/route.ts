/**
 * /api/page-data — Main data endpoint for all dashboard pages.
 *
 * Flow:
 *   1. Frontend calls: GET /api/page-data?page=/gardu-induk/hi-trafo
 *   2. This route queries BQ Views via bigquery-data-layer
 *   3. Applies server-side filters (sheet, columns, GI, bbox, etc.)
 *   4. Returns filtered PagePayload to frontend
 *
 * Data is live from spreadsheets via BQ External Tables → Views.
 * No sync worker needed — data is always fresh.
 */

import { NextResponse } from "next/server";
import {
    getPageDataFromBigQuery,
    applyPageDataFilters,
} from "@/lib/bigquery-data-layer";

export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page");

        // ── Parse filter parameters ────────────────────────────────
        const sheetFilter = url.searchParams.get("sheet");
        const sheetsRaw = url.searchParams.get("sheets");
        const sheetFilters = sheetsRaw
            ? sheetsRaw
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : [];
        const maxDaysRaw = url.searchParams.get("maxDays");
        const maxDays = maxDaysRaw ? Number.parseInt(maxDaysRaw, 10) : null;
        const latestRowsRaw = url.searchParams.get("latestRows");
        const latestRows = latestRowsRaw ? Number.parseInt(latestRowsRaw, 10) : null;
        const gi = url.searchParams.get("gi");
        const bboxWest = url.searchParams.get("bboxWest");
        const bboxSouth = url.searchParams.get("bboxSouth");
        const bboxEast = url.searchParams.get("bboxEast");
        const bboxNorth = url.searchParams.get("bboxNorth");
        const columnsRaw = url.searchParams.get("columns");
        const columns = columnsRaw
            ? columnsRaw
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : [];

        // ── Validate required params ───────────────────────────────
        if (!page) {
            return NextResponse.json(
                { ok: false, error: "Missing query parameter: page" },
                { status: 400 }
            );
        }

        // ── Fetch data from BQ Native Tables ───────────────────────
        // getPageDataFromBigQuery throws with exact error if config missing
        const payload = await getPageDataFromBigQuery(page);

        // ── Apply server-side filters ──────────────────────────────
        const filtered = applyPageDataFilters(payload, {
            sheetFilter,
            sheetFilters,
            maxDays,
            latestRows,
            columns,
            gi,
            bbox:
                bboxWest && bboxSouth && bboxEast && bboxNorth
                    ? {
                        west: Number.parseFloat(bboxWest),
                        south: Number.parseFloat(bboxSouth),
                        east: Number.parseFloat(bboxEast),
                        north: Number.parseFloat(bboxNorth),
                    }
                    : null,
        });

        return NextResponse.json(filtered);
    } catch (error) {
        console.error("[page-data] Error:", error);
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Internal Server Error",
            },
            { status: 500 }
        );
    }
}
