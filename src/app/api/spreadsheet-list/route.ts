import { NextResponse } from "next/server";
import {
    loadRegistryRootFromFirestore,
    syncRegistryRootFromPageConfigs,
} from "@/lib/firestore-dashboard-config";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await syncRegistryRootFromPageConfigs();
        const registryRoot = await loadRegistryRootFromFirestore();
        const registry = Array.isArray((registryRoot as { spreadsheets?: unknown[] } | null)?.spreadsheets)
            ? ((registryRoot as { spreadsheets: unknown[] }).spreadsheets)
            : [];

        const tree = registry.map((ss: any) => ({
            id: ss.id,
            spreadsheetId: ss.spreadsheetId,
            title: ss.title,
            sheets: (ss.sheets || []).map((sh: any) => ({
                sheetName: sh.sheetName,
                label: sh.label || sh.sheetName,
                usedBy: sh.usedBy || [],
                columnCount: (sh.columnsUsed || []).length,
                hierarchyPresent: sh.hierarchyPresent || [],
            })),
        }));

        return NextResponse.json(tree);
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
