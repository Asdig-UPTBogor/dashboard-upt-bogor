/**
 * relation-utils.ts
 *
 * Config-driven cross-sheet join resolver for the Overview page.
 * Reads hierarchyMapping from API response data (from Firestore config).
 *
 * Each sheet in the API response declares:
 *   hierarchyMapping: { ultg: "Master_ULTG", gi: "Master_Gardu_Induk", bay?: "Master_Bay" }
 *
 * This tells us the exact column name for each hierarchy level in each sheet.
 */

/* ── Types ── */
type Row = Record<string, string>;
type HierarchyLevel = "ultg" | "gi" | "bay";

/* ── Sheet name constants ── */
export const SHEETS = {
    GI: "Master Gardu Induk",
    BAY: "Master Bay",
    RELAY: "Asset Relay UPT Bogor",
    TRAFO: "MTU TRAFO",
    PMT: "MTU PMT",
    PMS: "MTU PMS",
    CT: "MTU CT",
    CVT: "MTU CVT",
    LA: "MTU LA",
    KABEL_POWER: "MTU KABEL POWER",
    SEALING_END: "SEALING END",
} as const;

/* ── Hierarchy index — built dynamically from API response ── */
const hierarchyIndex = new Map<string, Record<string, string>>();

/**
 * buildHierarchyIndex — Populate the hierarchy index from API response sheets.
 * Called by use-overview-data after receiving API data.
 * Each sheet in the response has: { sheetName, hierarchyMapping, ... }
 */
export function buildHierarchyIndex(
    sheets: { sheetName: string; hierarchyMapping?: Record<string, string> | null }[]
): void {
    for (const sheet of sheets) {
        if (sheet.hierarchyMapping) {
            const mapping: Record<string, string> = {};
            for (const [k, v] of Object.entries(sheet.hierarchyMapping)) {
                if (v != null) mapping[k] = v;
            }
            hierarchyIndex.set(sheet.sheetName, mapping);
        }
    }
}

/**
 * getHierarchyColumn — Get the exact column name for a hierarchy level in a sheet.
 * Returns null if the sheet doesn't have that hierarchy level.
 */
export function getHierarchyColumn(sheetName: string, level: HierarchyLevel): string | null {
    const mapping = hierarchyIndex.get(sheetName);
    return mapping?.[level] ?? null;
}

/** Get the "gi" column for a sheet. Throws if hierarchy not built yet. */
export function getGIColumn(sheetName: string): string {
    const col = getHierarchyColumn(sheetName, "gi");
    if (!col) {
        console.warn(`[relation-utils] No 'gi' mapping for sheet "${sheetName}", falling back to "Master Gardu Induk"`);
        return "Master Gardu Induk";
    }
    return col;
}

/** Get the "ultg" column for a sheet. Warns if hierarchy not built. */
export function getULTGColumn(sheetName: string): string {
    const col = getHierarchyColumn(sheetName, "ultg");
    if (!col) {
        console.warn(`[relation-utils] No 'ultg' mapping for sheet "${sheetName}", falling back to "Master ULTG"`);
        return "Master ULTG";
    }
    return col;
}

/** Get the "bay" column for a sheet (only MTU sheets have this in hierarchy). */
export function getBayColumn(sheetName: string): string | null {
    return getHierarchyColumn(sheetName, "bay");
}

/** Get the column that identifies/references a bay in a sheet. */
export function getBayNameColumn(sheetName: string): string | null {
    return getHierarchyColumn(sheetName, "bay");
}

/**
 * filterByHierarchy — Filter rows where the hierarchy column matches a value.
 * Uses case-insensitive comparison to handle data inconsistencies.
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
 * Case-INSENSITIVE because bay names differ in casing across sheets.
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
