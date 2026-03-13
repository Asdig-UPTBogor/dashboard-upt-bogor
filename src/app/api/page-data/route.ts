import { NextResponse } from "next/server";
import {
    proxyDashboardSyncWorker,
    requireDashboardSyncWorkerUrl,
} from "@/lib/dashboard-sync-worker";
import {
    applyPageDataFilters,
    getCurrentPageSnapshotFromBigQuery,
} from "@/lib/bigquery-page-snapshots";

export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page");
        const refresh = url.searchParams.get("refresh") === "true";
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

        if (!page) {
            return NextResponse.json({
                ok: false,
                error: "Missing query parameter: page",
            }, { status: 400 });
        }

        if (refresh) {
            requireDashboardSyncWorkerUrl();
            const upstream = await proxyDashboardSyncWorker("/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "refresh", page }),
            });
            if (!upstream.ok) {
                const text = await upstream.text();
                return new Response(text, {
                    status: upstream.status,
                    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
                });
            }
        }

        const payload = await getCurrentPageSnapshotFromBigQuery(page);
        if (!payload) {
            return NextResponse.json({
                ok: false,
                error: `No BigQuery snapshot found for page: ${page}`,
            }, { status: 404 });
        }

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
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
