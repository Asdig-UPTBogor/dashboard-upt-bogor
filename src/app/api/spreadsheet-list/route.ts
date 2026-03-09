/**
 * GET /api/spreadsheet-list
 *
 * Returns a lightweight tree of all registered spreadsheets and their sheets.
 * Used by the Dashboard Data explorer to dynamically populate the tree view.
 *
 * Reads from spreadsheet-config.json via loadRegistry() — always fresh from disk.
 */

import { NextResponse } from "next/server";
import { loadRegistry } from "@/lib/data-source-registry";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const registry = loadRegistry();

        const tree = registry.map((ss) => ({
            id: ss.id,
            spreadsheetId: ss.spreadsheetId,
            title: ss.title,
            sheets: ss.sheets.map((sh) => ({
                sheetName: sh.sheetName,
                label: sh.label || sh.sheetName,
                usedBy: sh.usedBy || [],
                columnCount: (sh.columnsUsed || []).length,
                hierarchyPresent: sh.hierarchyPresent || [],
            })),
        }));

        return NextResponse.json(tree);
    } catch (err) {
        console.error("[spreadsheet-list] Error:", err);
        return NextResponse.json(
            { error: "Failed to load spreadsheet list" },
            { status: 500 }
        );
    }
}
