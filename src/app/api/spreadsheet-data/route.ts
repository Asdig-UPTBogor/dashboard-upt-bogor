/**
 * GET /api/spreadsheet-data?spreadsheetId=xxx
 * GET /api/spreadsheet-data?spreadsheetId=xxx&sheet=Master+Bay
 *
 * Fetches ALL sheets (or a specific sheet) for a given spreadsheet.
 * Used by Dashboard Data page to load data by spreadsheet (not by page config).
 *
 * Data flow:
 *   1. Read registry to find all sheets for spreadsheetId
 *   2. For each sheet: check cache → fetch from Google Sheets if miss
 *   3. Return array of SheetResult
 */

import { NextResponse } from "next/server";
import { loadRegistry, loadRegistryRoot } from "@/lib/data-source-registry";
import { fetchSheetData, type ColumnPosition } from "@/lib/sheets-api";
import { sheetCache } from "@/lib/sheet-cache";
import { startPrefetchWorker } from "@/lib/background-prefetch";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/* ── Build column lineage from page-configs ── */
function buildColumnLineage(): Record<string, Record<string, string[]>> {
    // Returns: { "spreadsheetId::sheetName" -> { "columnName" -> ["Page A", "Page B"] } }
    const lineage: Record<string, Record<string, string[]>> = {};
    try {
        const configDir = path.join(process.cwd(), "src/lib/page-configs");
        if (!fs.existsSync(configDir)) return lineage;

        const files = fs.readdirSync(configDir).filter(f => f.endsWith(".json"));
        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(configDir, file), "utf-8");
                const config = JSON.parse(raw);
                const pageLabel = config.label || config.page || file.replace(".json", "");

                for (const ds of config.dataSources || []) {
                    const key = `${ds.spreadsheetId}::${ds.sheetName}`;
                    if (!lineage[key]) lineage[key] = {};

                    for (const col of ds.columnsUsed || []) {
                        const colName = typeof col === "string" ? col : col.name;
                        if (!lineage[key][colName]) lineage[key][colName] = [];
                        if (!lineage[key][colName].includes(pageLabel)) {
                            lineage[key][colName].push(pageLabel);
                        }
                    }
                }
            } catch { /* skip broken config */ }
        }
    } catch { /* no page-configs */ }
    return lineage;
}

/* ── Ensure worker is running ── */
let workerStarted = false;
function ensureWorkerStarted() {
    if (!workerStarted) {
        startPrefetchWorker();
        workerStarted = true;
    }
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get("spreadsheetId");
    const sheetFilter = url.searchParams.get("sheet");

    if (!spreadsheetId) {
        return NextResponse.json(
            { error: "Missing query parameter: spreadsheetId" },
            { status: 400 }
        );
    }

    ensureWorkerStarted();

    // Find the spreadsheet in registry
    const registry = loadRegistry();
    const spreadsheet = registry.find((ss) => ss.spreadsheetId === spreadsheetId);

    if (!spreadsheet) {
        return NextResponse.json(
            { error: `Spreadsheet tidak ditemukan di registry: ${spreadsheetId}` },
            { status: 404 }
        );
    }

    // Filter to specific sheet if requested
    const targetSheets = sheetFilter
        ? spreadsheet.sheets.filter(
            (sh) => sh.sheetName.trim().toLowerCase() === sheetFilter.trim().toLowerCase()
        )
        : spreadsheet.sheets;

    if (targetSheets.length === 0) {
        return NextResponse.json(
            {
                error: `Sheet "${sheetFilter}" tidak ditemukan`,
                available: spreadsheet.sheets.map((sh) => sh.sheetName),
            },
            { status: 404 }
        );
    }

    try {
        // Pre-compute column lineage (which pages use each column)
        const allLineage = buildColumnLineage();

        const sheets = await Promise.all(
            targetSheets.map(async (sh) => {
                // Build column positions from registry columnsUsed
                const columnPositions: ColumnPosition[] = (sh.columnsUsed || []).map(
                    (c) => {
                        if (typeof c === "string") return { name: c, pos: "" };
                        return { name: c.name, pos: c.pos || "" };
                    }
                );
                const connectedColumns = columnPositions.map((c) => c.name);
                const lineageKey = `${spreadsheetId}::${sh.sheetName}`;
                const columnLineage = allLineage[lineageKey] || {};

                try {
                    // Check cache first
                    const cached = sheetCache.get(spreadsheetId, sh.sheetName, connectedColumns);

                    if (cached) {
                        return {
                            sheetName: sh.sheetName,
                            spreadsheetTitle: spreadsheet.title,
                            spreadsheetId: spreadsheetId,
                            hierarchyMapping: sh.hierarchyMapping || null,
                            hierarchyPresent: sh.hierarchyPresent || [],
                            columnsConnected: connectedColumns,
                            columnLineage,
                            ...cached,
                            error: null,
                            cacheStatus: "HIT" as const,
                        };
                    }

                    // Cache miss — fetch from Google Sheets
                    const fetchStart = Date.now();
                    const data = await fetchSheetData(spreadsheetId, sh.sheetName, columnPositions);
                    const fetchMs = Date.now() - fetchStart;

                    // Store in cache
                    sheetCache.set(spreadsheetId, sh.sheetName, data, connectedColumns, fetchMs);

                    return {
                        sheetName: sh.sheetName,
                        spreadsheetTitle: spreadsheet.title,
                        spreadsheetId: spreadsheetId,
                        hierarchyMapping: sh.hierarchyMapping || null,
                        hierarchyPresent: sh.hierarchyPresent || [],
                        columnsConnected: connectedColumns,
                        columnLineage,
                        ...data,
                        error: null,
                        cacheStatus: "MISS" as const,
                    };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {
                        sheetName: sh.sheetName,
                        spreadsheetTitle: spreadsheet.title,
                        spreadsheetId: spreadsheetId,
                        hierarchyMapping: sh.hierarchyMapping || null,
                        hierarchyPresent: sh.hierarchyPresent || [],
                        columnsConnected: connectedColumns,
                        columnLineage,
                        headers: [],
                        rows: [],
                        rowCount: 0,
                        missingColumns: [],
                        error: message,
                        cacheStatus: null,
                    };
                }
            })
        );

        return NextResponse.json({
            spreadsheetId: spreadsheet.spreadsheetId,
            spreadsheetTitle: spreadsheet.title,
            sheetCount: sheets.length,
            sheets,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
