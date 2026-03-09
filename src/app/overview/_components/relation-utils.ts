/**
 * relation-utils.ts
 *
 * Config-driven cross-sheet join resolver for the Overview page.
 * Reads hierarchyMapping from overview.json dataSources — NO FALLBACKS.
 *
 * Each sheet in config declares:
 *   hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk", bay?: "Master Bay" }
 *
 * This tells us the exact column name for each hierarchy level in each sheet.
 */

import overviewConfig from "@/lib/page-configs/overview.json";

/* ── Types ── */
type Row = Record<string, string>;
type HierarchyLevel = "ultg" | "gi" | "bay";

/* ── Build hierarchy index from config dataSources ── */
const hierarchyIndex = new Map<string, Record<string, string>>();
for (const ds of overviewConfig.dataSources) {
    if (ds.hierarchyMapping) {
        const mapping: Record<string, string> = {};
        for (const [k, v] of Object.entries(ds.hierarchyMapping)) {
            if (v != null) mapping[k] = v;
        }
        hierarchyIndex.set(ds.sheetName, mapping);
    }
}


/**
 * getHierarchyColumn — Get the exact column name for a hierarchy level in a sheet.
 * Returns null if the sheet doesn't have that hierarchy level.
 *
 * Example:
 *   getHierarchyColumn("Asset Relay UPT Bogor", "gi")  → "Gardu Induk"
 *   getHierarchyColumn("MTU TRAFO", "gi")               → "Master Gardu Induk"
 *   getHierarchyColumn("MTU TRAFO", "bay")              → "Master Bay"
 *   getHierarchyColumn("Asset Bay", "bay")              → null (no bay in hierarchy)
 */
export function getHierarchyColumn(sheetName: string, level: HierarchyLevel): string | null {
    const mapping = hierarchyIndex.get(sheetName);
    return mapping?.[level] ?? null;
}

/** Get the "gi" column for a sheet. */
export function getGIColumn(sheetName: string): string {
    return getHierarchyColumn(sheetName, "gi")!;
}

/** Get the "ultg" column for a sheet. */
export function getULTGColumn(sheetName: string): string {
    return getHierarchyColumn(sheetName, "ultg")!;
}

/** Get the "bay" column for a sheet (only MTU sheets have this in hierarchy). */
export function getBayColumn(sheetName: string): string | null {
    return getHierarchyColumn(sheetName, "bay");
}

/**
 * getBayNameColumn — Get the column that identifies/references a bay in a sheet.
 * Now ALL sheets with bay data declare it in hierarchyMapping.
 *
 *   Asset Bay  → "Bay/Diameter"  (from hierarchyMapping.bay)
 *   Relay      → "Bay/Diameter"  (from hierarchyMapping.bay)
 *   MTU TRAFO  → "Master Bay"    (from hierarchyMapping.bay)
 */
export function getBayNameColumn(sheetName: string): string | null {
    return getHierarchyColumn(sheetName, "bay");
}

/**
 * filterByHierarchy — Filter rows where the hierarchy column matches a value.
 * Uses case-insensitive comparison to handle data inconsistencies
 * (e.g., "Trafo 2" in Asset Bay vs "TRAFO 2" in MTU TRAFO).
 */
export function filterByHierarchy(
    sheetName: string,
    rows: Row[],
    level: HierarchyLevel,
    value: string,
): Row[] {
    const col = getHierarchyColumn(sheetName, level);
    if (!col) return [];
    const lower = value.toLowerCase();
    return rows.filter((r) => r[col]?.toLowerCase() === lower);
}

/**
 * filterBySet — Filter rows where the hierarchy column value is in the provided set.
 * Case-sensitive (hierarchy values like GI names are consistent across sheets).
 */
export function filterBySet(
    sheetName: string,
    rows: Row[],
    level: HierarchyLevel,
    valueSet: Set<string>,
): Row[] {
    const col = getHierarchyColumn(sheetName, level);
    if (!col) return [];
    return rows.filter((r) => {
        const val = r[col];
        return val != null && valueSet.has(val);
    });
}

/**
 * filterByBayName — Filter rows where the bay-name column matches.
 * Case-INSENSITIVE because bay names differ in casing across sheets
 * (e.g., "Trafo 2" in Asset Bay vs "TRAFO 2" in MTU TRAFO).
 */
export function filterByBayName(
    sheetName: string,
    rows: Row[],
    bayName: string,
): Row[] {
    const col = getBayNameColumn(sheetName);
    if (!col) return [];
    const lower = bayName.toLowerCase();
    return rows.filter((r) => r[col]?.toLowerCase() === lower);
}

/* ── Sheet name constants from config ── */
export const SHEETS = {
    GI: overviewConfig.dataSources[0]?.sheetName || "Master Gardu Induk",
    BAY: overviewConfig.dataSources[1]?.sheetName || "Master Bay",
    RELAY: overviewConfig.dataSources[2]?.sheetName || "Asset Relay UPT Bogor",
    TRAFO: overviewConfig.dataSources[3]?.sheetName || "MTU TRAFO",
    PMT: overviewConfig.dataSources[4]?.sheetName || "MTU PMT",
    PMS: overviewConfig.dataSources[5]?.sheetName || "MTU PMS",
    CT: overviewConfig.dataSources[6]?.sheetName || "MTU CT",
    CVT: overviewConfig.dataSources[7]?.sheetName || "MTU CVT",
    LA: overviewConfig.dataSources[8]?.sheetName || "MTU LA",
    KABEL_POWER: overviewConfig.dataSources[9]?.sheetName || "MTU KABEL POWER",
    SEALING_END: overviewConfig.dataSources[10]?.sheetName || "SEALING END",
} as const;
