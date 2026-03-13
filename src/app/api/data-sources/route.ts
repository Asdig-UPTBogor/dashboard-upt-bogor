/**
 * /api/data-sources — Lists available BQ Views and page configurations.
 *
 * Replaces the old worker-proxy based health check / explore / registry endpoints.
 * Now reads directly from the BQ Views mapping and page configs.
 */

import { NextResponse } from "next/server";
import { getAllPages } from "@/lib/sidebar-config";
import { getRegisteredPages, isPageRegistered } from "@/lib/bigquery-data-layer";

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);

        // Return all sidebar pages
        if (url.searchParams.get("pages") === "1") {
            return NextResponse.json({ success: true, pages: getAllPages() });
        }

        // Return list of registered BQ View pages
        const registeredPages = getRegisteredPages();
        const allPages = getAllPages();

        const status = allPages.map((p: { path: string; label: string }) => ({
            path: p.path,
            label: p.label,
            hasBQView: isPageRegistered(p.path),
        }));

        return NextResponse.json({
            success: true,
            totalPages: allPages.length,
            pagesWithBQViews: registeredPages.length,
            status,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal Server Error",
            },
            { status: 500 }
        );
    }
}
