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
 * Auto-deduplicate: jika ada sheetName duplikat dalam 1 spreadsheet, gabungkan.
 */
export function saveRegistryRoot(root: RegistryRoot): void {
    // Guard deduplikasi: merge sheet duplikat per spreadsheet
    for (const ss of root.spreadsheets) {
        const seen = new Map<string, number>(); // norm(sheetName) → index
        const merged: SheetUsage[] = [];

        for (const sheet of ss.sheets) {
            const key = sheet.sheetName.trim().toLowerCase();
            const existingIdx = seen.get(key);

            if (existingIdx !== undefined) {
                // Gabung ke entry yang sudah ada
                const existing = merged[existingIdx];
                // Merge usedBy (unique)
                for (const page of sheet.usedBy) {
                    if (!existing.usedBy.includes(page)) existing.usedBy.push(page);
                }
                // Merge columnsUsed (unique by name)
                const existingColNames = new Set(
                    existing.columnsUsed.map(c => normalizeColumn(c).name.trim().toLowerCase())
                );
                for (const col of sheet.columnsUsed) {
                    const colObj = normalizeColumn(col);
                    if (!existingColNames.has(colObj.name.trim().toLowerCase())) {
                        existing.columnsUsed.push(colObj);
                        existingColNames.add(colObj.name.trim().toLowerCase());
                    }
                }
                console.log(`[registry dedup] Merged duplicate sheet "${sheet.sheetName}" in "${ss.title}"`);
            } else {
                seen.set(key, merged.length);
                merged.push(sheet);
            }
        }

        ss.sheets = merged;
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(root, null, 2), "utf-8");
}

/**
 * Get the hierarchy configuration from registry.
 */
export function getHierarchyConfig(): HierarchyLevel[] {
    return loadRegistryRoot().hierarchyLevels;
}

/**
 * Get spreadsheets yang tidak dipakai oleh page manapun.
 * Spreadsheet dianggap unused jika SEMUA sheet-nya punya usedBy kosong.
 */
export function getUnusedSpreadsheets(): { id: string; spreadsheetId: string; title: string; sheetCount: number }[] {
    const registry = loadRegistry();
    return registry
        .filter(ss => ss.sheets.every(sh => !sh.usedBy || sh.usedBy.length === 0))
        .map(ss => ({
            id: ss.id,
            spreadsheetId: ss.spreadsheetId,
            title: ss.title,
            sheetCount: ss.sheets.length,
        }));
}

/**
 * Hapus spreadsheet dari registry berdasarkan ID.
 * Returns jumlah spreadsheet yang berhasil dihapus.
 */
export function removeSpreadsheets(ids: string[]): number {
    const root = loadRegistryRoot();
    const before = root.spreadsheets.length;
    root.spreadsheets = root.spreadsheets.filter(ss => !ids.includes(ss.id));
    const removed = before - root.spreadsheets.length;
    if (removed > 0) {
        saveRegistryRoot(root);
        console.log(`[registry] Removed ${removed} spreadsheet(s): ${ids.join(", ")}`);
    }
    return removed;
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
   Per-Page Config Functions
   
   Each page has its own JSON config file at:
     src/lib/page-configs/{slug}.json
   
   These files define which spreadsheet, sheet, and
   columns each page uses. Written by Data Connector,
   read by /api/page-data at runtime.
   
   The registry (spreadsheet-config.json) only stores:
   - Spreadsheet inventory (id, title, sheet list)
   - usedBy arrays (auto-synced from page configs)
   - DSM metadata (hierarchy, disabled columns)
   ══════════════════════════════════════════════════ */

import type { PageConfig, PageDataSource, PageRelation } from "./page-config-types";

/** Directory where per-page JSON configs are stored */
const PAGE_CONFIGS_DIR = path.join(process.cwd(), "src", "lib", "page-configs");

/**
 * Convert a page path to a filename slug.
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
 * Get the filesystem path for a page's config JSON.
 * e.g., "/transmisi/row" → src/lib/page-configs/transmisi--row.json
 */
function getPageConfigPath(pagePath: string): string {
    const slug = pagePathToSlug(pagePath);
    return path.join(PAGE_CONFIGS_DIR, `${slug}.json`);
}

/**
 * Load a per-page config from its JSON file.
 * Returns null if the config file does not exist.
 */
export function loadPageConfig(pagePath: string): PageConfig | null {
    const configPath = getPageConfigPath(pagePath);
    try {
        if (!fs.existsSync(configPath)) return null;
        const raw = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(raw) as PageConfig;
        // Normalize columnsUsed entries
        for (const ds of config.dataSources) {
            ds.columnsUsed = (ds.columnsUsed || []).map(normalizeColumn);
        }
        return config;
    } catch (err) {
        console.error(`[loadPageConfig] Failed to load config for ${pagePath}:`, err);
        return null;
    }
}

/**
 * Save a per-page config to its JSON file.
 * Also syncs the registry's usedBy arrays and merges new columns
 * so DSM registry stays consistent with Data Connector changes.
 */
export function savePageConfig(config: PageConfig): void {
    const now = new Date().toISOString();
    config.updatedAt = now;

    // 1. Write per-page JSON file
    const configPath = getPageConfigPath(config.page);
    if (!fs.existsSync(PAGE_CONFIGS_DIR)) {
        fs.mkdirSync(PAGE_CONFIGS_DIR, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    // 2. Sync usedBy in registry (lightweight — only updates which pages reference which sheets)
    syncRegistryUsedBy();

    // 3. Sync columns: merge any new columns from page-config into registry
    //    This ensures columns added via Data Connector are reflected in the registry.
    syncRegistryColumns(config);
}

/**
 * Merge sheets and columns from a page-config's dataSources into the registry.
 * If the spreadsheet or sheet doesn't exist in the registry, it adds them.
 * Then it merges any new columns to ensure DSM stays consistent.
 */
function syncRegistryColumns(config: PageConfig): void {
    const root = loadRegistryRoot();
    let changed = false;

    for (const ds of config.dataSources) {
        // Find matching spreadsheet in registry
        let regSs = root.spreadsheets.find(ss => ss.spreadsheetId === ds.spreadsheetId);
        if (!regSs) {
            // Spreadsheet not in registry yet, add it
            regSs = {
                id: ds.spreadsheetId.substring(0, 15), // fallback stub ID
                spreadsheetId: ds.spreadsheetId,
                title: "Spreadsheet Baru", // Akan di-auto-correct oleh health-check nanti
                sheets: []
            };
            root.spreadsheets.push(regSs);
            changed = true;
        }

        // Find matching sheet
        let regSheet = regSs.sheets.find(
            sh => sh.sheetName.trim().toLowerCase() === ds.sheetName.trim().toLowerCase()
        );
        if (!regSheet) {
            // Sheet not in registry yet, add it
            regSheet = {
                sheetName: ds.sheetName,
                label: ds.label || ds.sheetName,
                route: ds.route || "",
                usedBy: [], // Di-populate nanti oleh syncRegistryUsedBy()
                columnsUsed: []
            };
            regSs.sheets.push(regSheet);
            changed = true;
        }

        // Build set of existing column names (lowercase for comparison)
        const existingCols = new Set(
            (regSheet.columnsUsed || []).map(c => normalizeColumn(c).name.trim().toLowerCase())
        );

        // Merge new columns
        for (const col of (ds.columnsUsed || [])) {
            const colObj = typeof col === "string" ? { name: col, pos: "" } : col;
            if (!existingCols.has(colObj.name.trim().toLowerCase())) {
                regSheet.columnsUsed.push({ name: colObj.name, pos: colObj.pos || "" });
                existingCols.add(colObj.name.trim().toLowerCase());
                changed = true;
            }
        }
    }

    if (changed) {
        saveRegistryRoot(root);
    }
}

/**
 * List all page configs by scanning the page-configs directory.
 */
export function listPageConfigs(): PageConfig[] {
    if (!fs.existsSync(PAGE_CONFIGS_DIR)) return [];

    const files = fs.readdirSync(PAGE_CONFIGS_DIR).filter(f => f.endsWith(".json"));
    const configs: PageConfig[] = [];

    for (const file of files) {
        const slug = file.replace(/\.json$/, "");
        const pagePath = slugToPagePath(slug);
        const config = loadPageConfig(pagePath);
        if (config) configs.push(config);
    }

    return configs;
}

/**
 * Delete a page config — removes JSON file and syncs registry usedBy.
 */
export function deletePageConfig(pagePath: string): boolean {
    const configPath = getPageConfigPath(pagePath);
    if (!fs.existsSync(configPath)) return false;

    fs.unlinkSync(configPath);
    syncRegistryUsedBy();
    return true;
}

/**
 * Sync registry usedBy arrays from all per-page JSON configs.
 * Scans every page config to rebuild which pages use which sheets.
 * Called after save/delete to keep registry metadata consistent.
 */
export function syncRegistryUsedBy(): void {
    const root = loadRegistryRoot();
    const configs = listPageConfigs();

    // Build a map: "spreadsheetId::sheetName" → Set<pagePath>
    const sheetToPages = new Map<string, Set<string>>();
    for (const config of configs) {
        for (const ds of config.dataSources) {
            const key = `${ds.spreadsheetId}::${ds.sheetName}`;
            if (!sheetToPages.has(key)) sheetToPages.set(key, new Set());
            sheetToPages.get(key)!.add(config.page);
        }
    }

    // Update usedBy in registry
    for (const ss of root.spreadsheets) {
        for (const sheet of ss.sheets) {
            const key = `${ss.spreadsheetId}::${sheet.sheetName}`;
            const pages = sheetToPages.get(key);
            sheet.usedBy = pages ? [...pages] : [];
        }
    }

    saveRegistryRoot(root);
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

/* ══════════════════════════════════════════════════
   DSM Accept — Cascade Updates to Page-Configs

   When DSM Accept fixes a sheet rename or column remap
   in the registry, ALL page-configs that reference the
   old value must also be updated.
   ══════════════════════════════════════════════════ */

/**
 * Cascade a sheet rename to all page-configs.
 * Finds every page-config that uses the old sheet name
 * (for the given spreadsheetId) and updates it.
 *
 * @returns Number of page-configs updated
 */
export function cascadeSheetRename(
    spreadsheetId: string,
    oldSheetName: string,
    newSheetName: string,
): number {
    if (!fs.existsSync(PAGE_CONFIGS_DIR)) return 0;

    const files = fs.readdirSync(PAGE_CONFIGS_DIR).filter(f => f.endsWith(".json"));
    let updated = 0;

    for (const file of files) {
        const filePath = path.join(PAGE_CONFIGS_DIR, file);
        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const config = JSON.parse(raw) as PageConfig;
            let changed = false;

            for (const ds of config.dataSources) {
                if (ds.spreadsheetId === spreadsheetId &&
                    ds.sheetName.trim().toLowerCase() === oldSheetName.trim().toLowerCase()) {
                    ds.sheetName = newSheetName;
                    changed = true;
                }
            }

            if (changed) {
                config.updatedAt = new Date().toISOString();
                fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
                updated++;
                console.log(`[cascadeSheetRename] Updated ${file}: "${oldSheetName}" → "${newSheetName}"`);
            }
        } catch (err) {
            console.error(`[cascadeSheetRename] Failed to process ${file}:`, err);
        }
    }

    return updated;
}

/**
 * Cascade a column rename to all page-configs.
 * Finds every page-config that uses the old column name
 * (for the given spreadsheetId + sheetName) and updates it.
 *
 * @returns Number of page-configs updated
 */
export function cascadeColumnRemap(
    spreadsheetId: string,
    sheetName: string,
    oldColumnName: string,
    newColumnName: string,
): number {
    if (!fs.existsSync(PAGE_CONFIGS_DIR)) return 0;

    const files = fs.readdirSync(PAGE_CONFIGS_DIR).filter(f => f.endsWith(".json"));
    let updated = 0;

    for (const file of files) {
        const filePath = path.join(PAGE_CONFIGS_DIR, file);
        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const config = JSON.parse(raw) as PageConfig;
            let changed = false;

            for (const ds of config.dataSources) {
                if (ds.spreadsheetId !== spreadsheetId) continue;
                if (ds.sheetName.trim().toLowerCase() !== sheetName.trim().toLowerCase()) continue;

                for (let i = 0; i < (ds.columnsUsed || []).length; i++) {
                    const col = ds.columnsUsed[i];
                    const colName = typeof col === "string" ? col : col.name;
                    if (colName === oldColumnName) {
                        if (typeof col === "string") {
                            ds.columnsUsed[i] = newColumnName as unknown as typeof col;
                        } else {
                            col.name = newColumnName;
                        }
                        changed = true;
                    }
                }

                // Also update hierarchyMapping if it references the old column name
                if (ds.hierarchyMapping) {
                    for (const [key, value] of Object.entries(ds.hierarchyMapping)) {
                        if (value === oldColumnName) {
                            ds.hierarchyMapping[key] = newColumnName;
                            changed = true;
                        }
                    }
                }
            }

            if (changed) {
                config.updatedAt = new Date().toISOString();
                fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
                updated++;
                console.log(`[cascadeColumnRemap] Updated ${file}: column "${oldColumnName}" → "${newColumnName}"`);
            }
        } catch (err) {
            console.error(`[cascadeColumnRemap] Failed to process ${file}:`, err);
        }
    }

    return updated;
}
