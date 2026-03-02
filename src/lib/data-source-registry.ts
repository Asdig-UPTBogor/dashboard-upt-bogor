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
 * v3: Unified config — page bindings inline in each sheet (no separate page-config files).
 *     pageRelations stored at root level.
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

/* ── v3 Page Binding — per-sheet, per-page config ── */
export interface PageBinding {
    label: string;                              // Display label for this page's usage
    route: string;                              // API route (e.g., "/api/towers")
    columnsUsed: (ColumnMapping | string)[];    // Page-specific column selection
}

export interface SheetUsage {
    sheetName: string;       // Tab name in the spreadsheet
    label: string;           // Human-readable description
    route: string;           // API route serving this data
    usedBy: string[];        // Which dashboard pages use this sheet (derived from pageBindings keys)
    columnsUsed: (ColumnMapping | string)[];  // Master list of all columns
    disabledColumns?: string[];  // Columns explicitly disabled by user

    /* v2 fields */
    hierarchyPresent?: string[];   // Which hierarchy keys this sheet has: ["ultg", "gi"] or ["ultg", "gi", "bay"]
    hierarchyMapping?: Record<string, string>;  // Maps level key → actual column name: { ultg: "ULTG", gi: "Gardu Induk" }
    role?: string;                 // Component hint: "map-markers", "heatmap-data", "table-data", "chart-data", etc.

    /* v3 field — inline page bindings */
    pageBindings?: Record<string, PageBinding>;  // Map of pagePath → per-page config
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

/** Page-level relation (from pageRelations in v3 registry) */
export interface PageRelationEntry {
    label: string;
    relations: import("./page-config-types").PageRelation[];
    updatedAt?: string;
}

/** v3 registry root — unified config */
export interface RegistryRoot {
    version: number;
    hierarchyLevels: HierarchyLevel[];
    spreadsheets: SpreadsheetEntry[];
    relations?: DataRelation[];       // Legacy cross-sheet relations
    pageRelations?: Record<string, PageRelationEntry>;  // v3: per-page relations
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
export interface PageDataSourceView {
    page: string;
    path: string;
    icon: string;
    spreadsheets: { spreadsheetId: string; sheets: SheetUsage[] }[];
}

export function registryToPageView(): PageDataSourceView[] {
    const registry = loadRegistry();
    const pageMap = new Map<string, PageDataSourceView>();

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
   Per-Page Config Functions — v3 Unified Registry
   
   Page configs are now RESOLVED from the registry's
   inline pageBindings, not from separate JSON files.
   ══════════════════════════════════════════════════ */

import type { PageConfig, PageDataSource, PageRelation } from "./page-config-types";

/**
 * Convert a page path to a filename slug (kept for backward compat).
 * e.g., "/asset-maps" → "asset-maps"
 *        "/proteksi/asset" → "proteksi--asset"
 */
export function pagePathToSlug(pagePath: string): string {
    return pagePath
        .replace(/^\//, "")
        .replace(/\//g, "--");
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
 * Load a per-page config — RESOLVED from v3 registry inline pageBindings.
 * Scans all sheets for pageBindings[pagePath] and constructs a PageConfig.
 * Returns null if no sheet has a binding for this page.
 */
export function loadPageConfig(pagePath: string): PageConfig | null {
    const root = loadRegistryRoot();
    const dataSources: PageDataSource[] = [];

    for (const ss of root.spreadsheets) {
        for (const sheet of ss.sheets) {
            const binding = sheet.pageBindings?.[pagePath];
            if (!binding) continue;

            // Build PageDataSource from sheet + binding
            const columnsUsed = binding.columnsUsed.map(normalizeColumn);

            dataSources.push({
                spreadsheetId: ss.spreadsheetId,
                sheetName: sheet.sheetName,
                label: binding.label || sheet.label,
                route: binding.route || sheet.route || "",
                role: sheet.role,
                columnsUsed,
                disabledColumns: sheet.disabledColumns,
                hierarchyPresent: sheet.hierarchyPresent,
                hierarchyMapping: sheet.hierarchyMapping,
            });
        }
    }

    if (dataSources.length === 0) return null;

    // Resolve relations from pageRelations
    const relEntry = root.pageRelations?.[pagePath];
    const relations: PageRelation[] = relEntry?.relations || [];

    const pageInfo = findPageByPath(pagePath);
    return {
        page: pagePath,
        label: relEntry?.label || pageInfo?.label || pagePath,
        dataSources,
        relations,
        updatedAt: relEntry?.updatedAt,
    };
}

/**
 * Save a per-page config — writes INLINE to the v3 registry.
 * Updates pageBindings in each relevant sheet + pageRelations at root.
 */
export function savePageConfig(config: PageConfig): void {
    const root = loadRegistryRoot();
    const now = new Date().toISOString();

    // First: remove old bindings for this page from ALL sheets
    for (const ss of root.spreadsheets) {
        for (const sheet of ss.sheets) {
            if (sheet.pageBindings?.[config.page]) {
                delete sheet.pageBindings[config.page];
            }
            // Update usedBy
            sheet.usedBy = Object.keys(sheet.pageBindings || {});
        }
    }

    // Then: add new bindings from the config's dataSources
    for (const ds of config.dataSources) {
        // Find the matching sheet in registry
        let targetSheet: SheetUsage | null = null;
        for (const ss of root.spreadsheets) {
            if (ss.spreadsheetId !== ds.spreadsheetId) continue;
            const found = ss.sheets.find(s => s.sheetName === ds.sheetName);
            if (found) { targetSheet = found; break; }
        }

        if (!targetSheet) {
            console.warn(`[savePageConfig] Sheet ${ds.sheetName} not found in registry, skipping`);
            continue;
        }

        // Create pageBinding
        if (!targetSheet.pageBindings) targetSheet.pageBindings = {};
        targetSheet.pageBindings[config.page] = {
            label: ds.label || targetSheet.label,
            route: ds.route || "",
            columnsUsed: ds.columnsUsed,
        };

        // Update hierarchy info from datasource (if provided)
        if (ds.hierarchyPresent) targetSheet.hierarchyPresent = ds.hierarchyPresent;
        if (ds.hierarchyMapping) targetSheet.hierarchyMapping = ds.hierarchyMapping;

        // Update usedBy
        targetSheet.usedBy = Object.keys(targetSheet.pageBindings);
    }

    // Update pageRelations
    if (!root.pageRelations) root.pageRelations = {};
    root.pageRelations[config.page] = {
        label: config.label,
        relations: config.relations || [],
        updatedAt: now,
    };

    saveRegistryRoot(root);
}

/**
 * List all page configs — scans registry for all unique page paths in pageBindings.
 */
export function listPageConfigs(): PageConfig[] {
    const root = loadRegistryRoot();
    const pageSet = new Set<string>();

    // Collect all page paths from pageBindings
    for (const ss of root.spreadsheets) {
        for (const sheet of ss.sheets) {
            if (sheet.pageBindings) {
                for (const pagePath of Object.keys(sheet.pageBindings)) {
                    pageSet.add(pagePath);
                }
            }
        }
    }

    // Also include pages from pageRelations (may have relations-only entries)
    if (root.pageRelations) {
        for (const pagePath of Object.keys(root.pageRelations)) {
            pageSet.add(pagePath);
        }
    }

    // Build each PageConfig
    const configs: PageConfig[] = [];
    for (const pagePath of pageSet) {
        const config = loadPageConfig(pagePath);
        if (config) configs.push(config);
    }

    return configs;
}

/**
 * Delete a page config — removes all pageBindings for this page + pageRelations entry.
 */
export function deletePageConfig(pagePath: string): boolean {
    const root = loadRegistryRoot();
    let found = false;

    // Remove pageBindings from all sheets
    for (const ss of root.spreadsheets) {
        for (const sheet of ss.sheets) {
            if (sheet.pageBindings?.[pagePath]) {
                delete sheet.pageBindings[pagePath];
                sheet.usedBy = Object.keys(sheet.pageBindings);
                found = true;
            }
        }
    }

    // Remove pageRelations entry
    if (root.pageRelations?.[pagePath]) {
        delete root.pageRelations[pagePath];
        found = true;
    }

    if (found) saveRegistryRoot(root);
    return found;
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
