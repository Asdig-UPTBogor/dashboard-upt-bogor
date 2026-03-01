/**
 * Data Source Registry — Types & JSON Loader
 *
 * Type definitions for spreadsheet mapping.
 * Runtime data is loaded from spreadsheet-config.json (CRUD-able via API).
 *
 * Structure: per-spreadsheet (not per-page)
 *   Each entry = 1 spreadsheet → N sheets → each sheet has usedBy[] pages
 */

import fs from "fs";
import path from "path";

/* ── Type Definitions ── */

export interface ColumnMapping {
    name: string;   // Column name the code actually reads
    pos: string;    // Expected sheet position (A, B, C...) — informational only
}

export interface SheetUsage {
    sheetName: string;       // Tab name in the spreadsheet (always kept up-to-date)
    label: string;           // Human-readable description
    route: string;           // API route serving this data
    usedBy: string[];        // Which dashboard pages use this sheet (e.g. ["/asset-maps", "/gardu-induk"])
    columnsUsed: (ColumnMapping | string)[];  // Columns with optional position hint
    disabledColumns?: string[];  // Columns explicitly disabled by user
}

export interface SpreadsheetEntry {
    id: string;              // Unique slug for CRUD operations
    spreadsheetId: string;   // Google Sheets ID
    title: string;           // Spreadsheet title (display name)
    sheets: SheetUsage[];    // Sheets inside this spreadsheet
}

/** Helper: normalize columnsUsed entry to { name, pos } */
export function normalizeColumn(col: ColumnMapping | string): ColumnMapping {
    if (typeof col === "string") return { name: col, pos: "" };
    return col;
}

/* ── JSON Config Path ── */
const CONFIG_PATH = path.join(process.cwd(), "src", "lib", "spreadsheet-config.json");

/**
 * Load the registry from JSON file.
 * This is the Single Source of Truth for all spreadsheet mappings.
 */
export function loadRegistry(): SpreadsheetEntry[] {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
            return JSON.parse(raw) as SpreadsheetEntry[];
        }
    } catch (err) {
        console.error("[data-source-registry] Failed to load JSON config:", err);
    }
    return [];
}

/**
 * Save the registry back to JSON file.
 */
export function saveRegistry(data: SpreadsheetEntry[]): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/* ── Legacy Compatibility Helpers ── */

/**
 * Convert per-spreadsheet format to per-page format (for Data Source Manager compat).
 * Groups sheets by their usedBy pages.
 */
export interface PageDataSource {
    page: string;
    path: string;
    icon: string;
    spreadsheets: { spreadsheetId: string; sheets: SheetUsage[] }[];
}

import { findPageByPath } from "./sidebar-config";

export function registryToPageView(): PageDataSource[] {
    const registry = loadRegistry();
    const pageMap = new Map<string, PageDataSource>();

    for (const entry of registry) {
        for (const sheet of entry.sheets) {
            for (const pagePath of sheet.usedBy) {
                if (!pageMap.has(pagePath)) {
                    const pageInfo = findPageByPath(pagePath);
                    pageMap.set(pagePath, {
                        page: pageInfo?.label || pagePath,
                        path: pagePath,
                        icon: "file",
                        spreadsheets: [],
                    });
                }
                const pd = pageMap.get(pagePath)!;
                let sp = pd.spreadsheets.find((s) => s.spreadsheetId === entry.spreadsheetId);
                if (!sp) {
                    sp = { spreadsheetId: entry.spreadsheetId, sheets: [] };
                    pd.spreadsheets.push(sp);
                }
                sp.sheets.push(sheet);
            }
        }
    }

    return [...pageMap.values()];
}
