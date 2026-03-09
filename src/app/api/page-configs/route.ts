/**
 * Page Configs API
 *
 * CRUD endpoint for per-page data source configurations.
 * Page configs are resolved from the unified registry (spreadsheet-config.json).
 *
 * Endpoints:
 *   GET              → list all page configs (summary)
 *   GET ?page=/path  → load a specific page config
 *   PUT              → save a page config (body = PageConfig)
 */

import { NextResponse } from "next/server";
import {
    loadPageConfig,
    savePageConfig,
    listPageConfigs,
} from "@/lib/data-source-registry";

/* ── GET: list all or load specific ── */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const pagePath = url.searchParams.get("page");

        if (pagePath) {
            // Load specific page config
            const config = loadPageConfig(pagePath);
            if (!config) {
                return NextResponse.json(
                    { error: `No config found for page: ${pagePath}` },
                    { status: 404 }
                );
            }
            return NextResponse.json({ success: true, config });
        }

        // List all page configs (summary only)
        const configs = listPageConfigs();
        const summary = configs.map((c) => ({
            page: c.page,
            label: c.label,
            dataSourceCount: c.dataSources.length,
            relationCount: c.relations.length,
            sheetNames: c.dataSources.map((ds) => ds.sheetName),
            updatedAt: c.updatedAt,
        }));

        return NextResponse.json({ success: true, pages: summary });
    } catch (error) {
        console.error("[page-configs] GET error:", error);
        return NextResponse.json(
            { error: "Failed to load page configs" },
            { status: 500 }
        );
    }
}

/* ── PUT: save a page config ── */
export async function PUT(request: Request) {
    try {
        const body = await request.json();

        if (!body.page || !body.label) {
            return NextResponse.json(
                { error: "Missing required fields: page, label" },
                { status: 400 }
            );
        }

        // Validate structure
        const config = {
            page: body.page as string,
            label: body.label as string,
            dataSources: body.dataSources || [],
            relations: body.relations || [],
            nodePositions: body.nodePositions || {},
            updatedAt: new Date().toISOString(),
        };

        savePageConfig(config);

        return NextResponse.json({
            success: true,
            message: `Config saved for ${config.page}`,
            updatedAt: config.updatedAt,
        });
    } catch (error) {
        console.error("[page-configs] PUT error:", error);
        return NextResponse.json(
            { error: "Failed to save page config" },
            { status: 500 }
        );
    }
}
