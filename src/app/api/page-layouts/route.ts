import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { PageLayoutConfig } from "@/lib/page-layout-types";

const LAYOUTS_FILE = path.join(process.cwd(), "src/lib/page-layouts.json");

/**
 * GET /api/page-layouts — Read all saved layouts
 */
export async function GET() {
    try {
        const raw = fs.readFileSync(LAYOUTS_FILE, "utf-8");
        const data = JSON.parse(raw);
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ layouts: [] });
    }
}

/**
 * POST /api/page-layouts — Save or update a page layout
 * Body: PageLayoutConfig
 */
export async function POST(request: Request) {
    try {
        const config: PageLayoutConfig = await request.json();

        if (!config.pagePath || !config.widgets?.length) {
            return NextResponse.json(
                { error: "pagePath and widgets are required" },
                { status: 400 }
            );
        }

        // Read existing layouts
        let data: { layouts: PageLayoutConfig[] } = { layouts: [] };
        try {
            const raw = fs.readFileSync(LAYOUTS_FILE, "utf-8");
            data = JSON.parse(raw);
        } catch {
            // File doesn't exist or is invalid — start fresh
        }

        // Upsert: replace existing layout for this page, or add new
        const existingIdx = data.layouts.findIndex((l) => l.pagePath === config.pagePath);
        if (existingIdx >= 0) {
            data.layouts[existingIdx] = config;
        } else {
            data.layouts.push(config);
        }

        // Write back
        fs.writeFileSync(LAYOUTS_FILE, JSON.stringify(data, null, 2), "utf-8");

        return NextResponse.json({ success: true, pagePath: config.pagePath });
    } catch (err) {
        return NextResponse.json(
            { error: "Failed to save layout", detail: String(err) },
            { status: 500 }
        );
    }
}
