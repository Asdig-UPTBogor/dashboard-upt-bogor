/**
 * Data Source Registry — Types, Loader & Hierarchy Engine
 *
 * Type definitions for spreadsheet mapping + hierarchy validation.
 * Runtime data is loaded from spreadsheet-config.json (CRUD-able via API).
 *
 * Structure: per-spreadsheet (not per-page)
 *   Each entry = 1 spreadsheet → N sheets → each sheet has usedBy[] pages
 *
 * v2: Added hierarchy support, column matching, data normalization.
 */

import fs from "fs";
import path from "path";
import { findPageByPath } from "./sidebar-config";

/* ── Hierarchy Definitions ── */

/** Hierarchy level definition — extensible via config */
export interface HierarchyLevel {
    key: string;       // e.g. "ultg", "gi", "bay"
    label: string;     // Display name: "ULTG", "Gardu Induk", "Bay"
    required: boolean; // Must exist for sheet to be eligible
    /** Column name variants — ordered by priority (first match wins) */
    columnNames: string[];
}

/** Default hierarchy config — 2-level priority per level */
export const DEFAULT_HIERARCHY_LEVELS: HierarchyLevel[] = [
    {
        key: "ultg",
        label: "ULTG",
        required: true,
        columnNames: ["Master ULTG", "ULTG"],
    },
    {
        key: "gi",
        label: "Gardu Induk",
        required: true,
        columnNames: ["Master Gardu Induk", "Gardu Induk"],
    },
    {
        key: "bay",
        label: "Bay",
        required: false,
        columnNames: ["Master Bay", "Bay"],
    },
];

/**
 * Match a hierarchy level against a list of sheet headers.
 * Uses 2-level priority: tries each columnName in order, case-insensitive + trimmed.
 *
 * @returns The exact header name that matched, or null if no match.
 */
export function matchHierarchyColumn(
    headers: string[],
    level: HierarchyLevel
): string | null {
    const trimmedHeaders = headers.map((h) => h.trim());

    for (const candidate of level.columnNames) {
        const found = trimmedHeaders.find(
            (h) => h.toLowerCase() === candidate.toLowerCase()
        );
        if (found) return found;
    }
    return null;
}

/**
 * Check all hierarchy levels against sheet headers.
 * Returns per-level results + overall eligibility.
 */
export interface HierarchyCheckResult {
    eligible: boolean;
    levels: {
        key: string;
        label: string;
        required: boolean;
        found: boolean;
        matchedAs: string | null;
    }[];
}

export function checkSheetHierarchy(
    headers: string[],
    hierarchyLevels: HierarchyLevel[] = DEFAULT_HIERARCHY_LEVELS
): HierarchyCheckResult {
    const levels = hierarchyLevels.map((level) => {
        const matchedAs = matchHierarchyColumn(headers, level);
        return {
            key: level.key,
            label: level.label,
            required: level.required,
            found: matchedAs !== null,
            matchedAs,
        };
    });

    // Eligible = all required levels are found
    const eligible = levels
        .filter((l) => l.required)
        .every((l) => l.found);

    return { eligible, levels };
}

/* ── Data Normalization (DBT-Style) ── */

/**
 * Normalize hierarchy values for consistent cross-filtering.
 * "Sukabumi" / "SUKABUMI" / "sukabumi  " → "SUKABUMI"
 */
export function normalizeHierarchyValue(value: string): string {
    if (!value) return "";
    return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/* ── Type Definitions ── */

export interface ColumnMapping {
    name: string;   // Column name the code actually reads
    pos: string;    // Expected sheet position (A, B, C...) — informational only
}

export interface SheetUsage {
    sheetName: string;       // Tab name in the spreadsheet
    label: string;           // Human-readable description
    route: string;           // API route serving this data
    usedBy: string[];        // Which dashboard pages use this sheet
    columnsUsed: (ColumnMapping | string)[];  // Columns with optional position hint
    disabledColumns?: string[];  // Columns explicitly disabled by user

    /* v2 fields */
    hierarchyPresent?: string[];   // Which hierarchy keys this sheet has: ["ultg", "gi"] or ["ultg", "gi", "bay"]
    hierarchyMapping?: Record<string, string>;  // Maps level key → actual column name: { ultg: "ULTG", gi: "Gardu Induk" }
    role?: string;                 // Component hint: "map-markers", "heatmap-data", "table-data", "chart-data", etc.
}

export interface SpreadsheetEntry {
    id: string;              // Unique slug for CRUD operations
    spreadsheetId: string;   // Google Sheets ID
    title: string;           // Spreadsheet title (display name)
    sheets: SheetUsage[];    // Sheets inside this spreadsheet
}

/** A column-to-column join between two sheets */
export interface DataRelation {
    id: string;                // Unique ID (auto-generated)
    fromSpreadsheet: string;   // spreadsheetId
    fromSheet: string;         // sheet tab name
    fromColumn: string;        // column name in source sheet
    toSpreadsheet: string;     // spreadsheetId (can be same)
    toSheet: string;           // sheet tab name
    toColumn: string;          // column name in target sheet
    joinType: "left" | "inner"; // How to merge data
}

/** v2 registry root — wraps the array with config */
export interface RegistryRoot {
    version: number;
    hierarchyLevels: HierarchyLevel[];
    spreadsheets: SpreadsheetEntry[];
    relations?: DataRelation[];  // Cross-sheet column relations
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
 * Supports both v1 (plain array) and v2 (object with version + hierarchyLevels).
 * Always returns a RegistryRoot — auto-migrates v1 to v2 format.
 */
export function loadRegistryRoot(): RegistryRoot {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
            const parsed = JSON.parse(raw);

            // v2 format: { version, hierarchyLevels, spreadsheets }
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.version) {
                return parsed as RegistryRoot;
            }

            // v1 format: plain array of SpreadsheetEntry — auto-wrap
            if (Array.isArray(parsed)) {
                return {
                    version: 2,
                    hierarchyLevels: DEFAULT_HIERARCHY_LEVELS,
                    spreadsheets: parsed as SpreadsheetEntry[],
                };
            }
        }
    } catch (err) {
        console.error("[data-source-registry] Failed to load JSON config:", err);
    }
    return { version: 2, hierarchyLevels: DEFAULT_HIERARCHY_LEVELS, spreadsheets: [] };
}

/**
 * Load the registry — returns the spreadsheet array (backward-compatible).
 * All existing code that calls loadRegistry() will continue to work.
 */
export function loadRegistry(): SpreadsheetEntry[] {
    return loadRegistryRoot().spreadsheets;
}

/**
 * Save the registry back to JSON file in v2 format.
 */
export function saveRegistry(data: SpreadsheetEntry[]): void {
    const root = loadRegistryRoot();
    root.spreadsheets = data;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(root, null, 2), "utf-8");
}

/**
 * Save the full registry root (including hierarchy config).
 */
export function saveRegistryRoot(root: RegistryRoot): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(root, null, 2), "utf-8");
}

/**
 * Get the hierarchy configuration from registry.
 */
export function getHierarchyConfig(): HierarchyLevel[] {
    return loadRegistryRoot().hierarchyLevels;
}

/**
 * Get all sheets linked to a specific page path.
 * Returns sheet info + the parent spreadsheet context.
 */
export interface PageSheet {
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheet: SheetUsage;
}

export function getPageSheets(pagePath: string): PageSheet[] {
    const registry = loadRegistry();
    const result: PageSheet[] = [];

    for (const entry of registry) {
        for (const sheet of entry.sheets) {
            if (sheet.usedBy.includes(pagePath)) {
                result.push({
                    spreadsheetId: entry.spreadsheetId,
                    spreadsheetTitle: entry.title,
                    sheet,
                });
            }
        }
    }

    return result;
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

/* ══════════════════════════════════════════════════
   Per-Page Config Functions
   ══════════════════════════════════════════════════ */

import type { PageConfig } from "./page-config-types";

const PAGE_CONFIGS_DIR = path.join(process.cwd(), "src", "lib", "page-configs");

/**
 * Convert a page path to a filename slug.
 * e.g., "/asset-maps" → "asset-maps"
 *        "/proteksi/asset" → "proteksi--asset"
 *        "/gardu-induk" → "gardu-induk"
 */
export function pagePathToSlug(pagePath: string): string {
    return pagePath
        .replace(/^\//, "")       // remove leading slash
        .replace(/\//g, "--");    // replace inner slashes with --
}

/**
 * Convert a filename slug back to a page path.
 * e.g., "asset-maps" → "/asset-maps"
 *        "proteksi--asset" → "/proteksi/asset"
 */
export function slugToPagePath(slug: string): string {
    return "/" + slug.replace(/--/g, "/");
}

/**
 * Load a per-page config. Returns null if not found.
 */
export function loadPageConfig(pagePath: string): PageConfig | null {
    const slug = pagePathToSlug(pagePath);
    const filePath = path.join(PAGE_CONFIGS_DIR, `${slug}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, "utf-8");
            return JSON.parse(raw) as PageConfig;
        }
    } catch (err) {
        console.error(`[page-config] Failed to load config for ${pagePath}:`, err);
    }
    return null;
}

/**
 * Save a per-page config. Creates the file if it doesn't exist.
 */
export function savePageConfig(config: PageConfig): void {
    // Ensure directory exists
    if (!fs.existsSync(PAGE_CONFIGS_DIR)) {
        fs.mkdirSync(PAGE_CONFIGS_DIR, { recursive: true });
    }

    const slug = pagePathToSlug(config.page);
    const filePath = path.join(PAGE_CONFIGS_DIR, `${slug}.json`);
    config.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * List all existing page configs.
 * Returns an array of PageConfig objects (reads each JSON file).
 */
export function listPageConfigs(): PageConfig[] {
    if (!fs.existsSync(PAGE_CONFIGS_DIR)) return [];

    const files = fs.readdirSync(PAGE_CONFIGS_DIR).filter((f) => f.endsWith(".json"));
    const configs: PageConfig[] = [];

    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(PAGE_CONFIGS_DIR, file), "utf-8");
            configs.push(JSON.parse(raw) as PageConfig);
        } catch {
            console.error(`[page-config] Failed to parse ${file}`);
        }
    }

    return configs;
}

/**
 * Delete a page config file.
 */
export function deletePageConfig(pagePath: string): boolean {
    const slug = pagePathToSlug(pagePath);
    const filePath = path.join(PAGE_CONFIGS_DIR, `${slug}.json`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
    } catch (err) {
        console.error(`[page-config] Failed to delete config for ${pagePath}:`, err);
    }
    return false;
}

/**
 * Resolve all page configs that reference a specific API route.
 * Used by the generic sheets API to find sheet data for a route.
 */
export function findPageConfigsByRoute(apiRoute: string): {
    pageConfig: PageConfig;
    dataSource: PageConfig["dataSources"][number];
}[] {
    const configs = listPageConfigs();
    const results: { pageConfig: PageConfig; dataSource: PageConfig["dataSources"][number] }[] = [];

    for (const config of configs) {
        for (const ds of config.dataSources) {
            if (ds.route === apiRoute) {
                results.push({ pageConfig: config, dataSource: ds });
            }
        }
    }

    return results;
}
