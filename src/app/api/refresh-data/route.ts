/**
 * /api/refresh-data — Manually refresh native tables from BQ Views.
 *
 * POST /api/refresh-data
 *   Body: { page: "/gardu-induk/hi-trafo" }  → refresh specific page
 *   Body: { all: true }                       → refresh all pages
 *
 * This copies data from Views (live, slow) to Native Tables (fast).
 * Called by the dashboard's manual refresh button.
 */

import { NextResponse } from "next/server";
import {
    refreshPageNativeTables,
    refreshAllNativeTables,
} from "@/lib/bigquery-data-layer";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (body.all) {
            const result = await refreshAllNativeTables();
            return NextResponse.json({
                ok: result.ok,
                message: `Refreshed ${result.refreshed.length} tables`,
                refreshed: result.refreshed,
                errors: result.errors,
            });
        }

        if (body.page) {
            const result = await refreshPageNativeTables(body.page);
            return NextResponse.json({
                ok: result.ok,
                message: `Refreshed ${result.refreshed.length} tables for ${body.page}`,
                refreshed: result.refreshed,
                errors: result.errors,
            });
        }

        return NextResponse.json(
            { ok: false, error: "Provide 'page' or 'all' in request body" },
            { status: 400 }
        );
    } catch (error) {
        console.error("[refresh-data] Error:", error);
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Internal Server Error",
            },
            { status: 500 }
        );
    }
}
