/**
 * hierarchy-qc.ts — Hierarchy Quality Control utilities (v2 — Composite Keys)
 *
 * Validates hierarchy columns (ULTG, Gardu Induk, Bay) against
 * the MASTER HIERARCHY spreadsheet as single source of truth.
 *
 * v2 Upgrade:
 * - ULTG: simple set check
 * - GI: check GI exists AND belongs to correct ULTG (ULTG→GI composite)
 * - Bay: check Bay exists AND belongs to correct GI (GI→Bay composite)
 * - Each validation returns specific error reason
 *
 * Scalable: add new hierarchy levels by updating HIERARCHY_COLUMNS.
 * Easy to debug: each function has a single responsibility.
 */

/* ── Types ── */
export interface HierarchyValidSets {
    /** Set of valid ULTG names */
    ultg: Set<string>;
    /** Set of valid GI names (all) */
    gi: Set<string>;
    /** Set of valid Bay names (all) */
    bay: Set<string>;
    /** Map: ULTG→Set<GI> — which GIs belong to which ULTG */
    ultgToGI: Map<string, Set<string>>;
    /** Map: GI→ULTG — reverse lookup */
    giToULTG: Map<string, string>;
    /** Map: GI→Set<Bay> — which Bays belong to which GI (composite key) */
    giToBay: Map<string, Set<string>>;
    /** Map: Bay→GI — reverse lookup for orphan diagnostics */
    bayToGIs: Map<string, Set<string>>;
}

export type QcErrorReason =
    | 'valid'
    | 'empty'                   // Cell is empty (optional, not flagged)
    | 'ultg_not_found'          // ULTG not in Master GI
    | 'gi_not_found'            // GI name not in Master GI at all
    | 'gi_wrong_ultg'           // GI exists but under different ULTG
    | 'bay_not_found'           // Bay name not in Master Bay at all
    | 'bay_wrong_gi'            // Bay exists but under different GI
    | 'no_master_data';         // Master data not loaded yet

export interface QcResult {
    /** Whether this cell value is valid */
    isValid: boolean;
    /** Machine-readable error reason */
    reason: QcErrorReason;
    /** Human-readable message for tooltip */
    message: string;
    /** Expected value suggestion (if available) */
    suggestion?: string;
}

export interface RowQcResult {
    /** Whether all hierarchy cells in row are valid */
    isHealthy: boolean;
    /** Number of invalid cells in this row */
    errorCount: number;
    /** Details per column */
    details: Record<string, QcResult>;
}

/* ── Constants ── */
/** Hierarchy columns to validate — order matters for display */
export const HIERARCHY_COLUMNS = ["Master ULTG", "Master Gardu Induk", "Master Bay"] as const;

/** Alternative column names that map to the same hierarchy level */
const COLUMN_ALIASES: Record<string, string> = {
    "ULTG": "Master ULTG",
    "Gardu Induk": "Master Gardu Induk",
    "GARDU INDUK": "Master Gardu Induk",
    "Bay": "Master Bay",
    "BAY": "Master Bay",
    "Bay/Diameter": "Master Bay",
};

/* ── Build valid sets from MASTER HIERARCHY sheets (v2 — composite keys) ── */
export function buildValidSets(hierarchySheets: any[]): HierarchyValidSets {
    const sets: HierarchyValidSets = {
        ultg: new Set<string>(),
        gi: new Set<string>(),
        bay: new Set<string>(),
        ultgToGI: new Map<string, Set<string>>(),
        giToULTG: new Map<string, string>(),
        giToBay: new Map<string, Set<string>>(),
        bayToGIs: new Map<string, Set<string>>(),
    };

    // Extract ULTG and GI from "Master Gardu Induk" tab
    const giSheet = hierarchySheets.find((s: any) => s.sheetName === "Master Gardu Induk");
    if (giSheet?.rows) {
        giSheet.rows.forEach((r: any) => {
            const u = r["Master ULTG"]?.toString().trim();
            const g = r["Master Gardu Induk"]?.toString().trim();
            if (u) sets.ultg.add(u);
            if (g) {
                sets.gi.add(g);
                // ULTG→GI mapping
                if (u) {
                    if (!sets.ultgToGI.has(u)) sets.ultgToGI.set(u, new Set());
                    sets.ultgToGI.get(u)!.add(g);
                    sets.giToULTG.set(g, u);
                }
            }
        });
    }

    // Extract Bay from "Master Bay" tab — with GI composite key
    const baySheet = hierarchySheets.find((s: any) => s.sheetName === "Master Bay");
    if (baySheet?.rows) {
        baySheet.rows.forEach((r: any) => {
            const b = r["Master Bay"]?.toString().trim();
            const g = r["Master Gardu Induk"]?.toString().trim();
            if (b) {
                sets.bay.add(b);
                // GI→Bay composite mapping
                if (g) {
                    if (!sets.giToBay.has(g)) sets.giToBay.set(g, new Set());
                    sets.giToBay.get(g)!.add(b);
                    // Bay→GIs reverse mapping (one bay name can appear in multiple GIs)
                    if (!sets.bayToGIs.has(b)) sets.bayToGIs.set(b, new Set());
                    sets.bayToGIs.get(b)!.add(g);
                }
            }
        });
    }

    return sets;
}

/* ── Resolve column name to canonical hierarchy name ── */
export function resolveHierarchyColumn(columnName: string): string | null {
    if (HIERARCHY_COLUMNS.includes(columnName as any)) return columnName;
    return COLUMN_ALIASES[columnName] || null;
}

/* ── Check if a sheet has any hierarchy columns ── */
export function getHierarchyColumnsInHeaders(headers: string[]): string[] {
    return headers.filter(h => resolveHierarchyColumn(h) !== null);
}

/**
 * Strict version: only match columns with exact "Master ULTG", "Master Gardu Induk", "Master Bay" names.
 * Use this for Explorer-level QC to avoid false positives from loose aliases
 * like "Bay", "Gardu Induk" in sheets that use different value formatting.
 */
export function getStrictHierarchyColumnsInHeaders(headers: string[]): string[] {
    const strictNames = new Set(HIERARCHY_COLUMNS as readonly string[]);
    return headers.filter(h => strictNames.has(h.trim()));
}

/* ── Validate a single cell with full chain context (v2) ── */
export function validateHierarchyCell(
    columnName: string,
    value: string | undefined | null,
    validSets: HierarchyValidSets,
    /** Row context — needed for chain validation (GI needs ULTG, Bay needs GI) */
    rowContext?: Record<string, any>,
): QcResult {
    const canonical = resolveHierarchyColumn(columnName);
    if (!canonical) return { isValid: true, reason: 'valid', message: '' };

    const trimmed = value?.toString().trim() || "";
    if (!trimmed) {
        return { isValid: true, reason: 'empty', message: '' };
    }

    // Check if master data is loaded
    const hasMasterData = validSets.ultg.size > 0 || validSets.gi.size > 0;
    if (!hasMasterData) {
        return { isValid: true, reason: 'no_master_data', message: 'Master data belum tersedia' };
    }

    // ── ULTG validation (simple set check) ──
    if (canonical === "Master ULTG") {
        if (!validSets.ultg.has(trimmed)) {
            return {
                isValid: false,
                reason: 'ultg_not_found',
                message: `ULTG "${trimmed}" tidak ditemukan di Master Gardu Induk`,
            };
        }
        return { isValid: true, reason: 'valid', message: '' };
    }

    // ── GI validation (check existence + ULTG chain) ──
    if (canonical === "Master Gardu Induk") {
        if (!validSets.gi.has(trimmed)) {
            return {
                isValid: false,
                reason: 'gi_not_found',
                message: `GI "${trimmed}" tidak ditemukan di Master Gardu Induk`,
            };
        }
        // Chain check: does this GI belong to the row's ULTG?
        const rowULTG = rowContext?.["Master ULTG"]?.toString().trim();
        if (rowULTG && validSets.giToULTG.has(trimmed)) {
            const expectedULTG = validSets.giToULTG.get(trimmed)!;
            if (expectedULTG !== rowULTG) {
                return {
                    isValid: false,
                    reason: 'gi_wrong_ultg',
                    message: `GI "${trimmed}" milik ULTG "${expectedULTG}", bukan "${rowULTG}"`,
                    suggestion: expectedULTG,
                };
            }
        }
        return { isValid: true, reason: 'valid', message: '' };
    }

    // ── Bay validation (check existence + GI composite chain) ──
    if (canonical === "Master Bay") {
        if (!validSets.bay.has(trimmed)) {
            return {
                isValid: false,
                reason: 'bay_not_found',
                message: `Bay "${trimmed}" tidak ditemukan di Master Bay`,
            };
        }
        // Chain check: does this Bay belong to the row's GI?
        const rowGI = rowContext?.["Master Gardu Induk"]?.toString().trim();
        if (rowGI) {
            const baysForGI = validSets.giToBay.get(rowGI);
            if (baysForGI && !baysForGI.has(trimmed)) {
                // Bay exists but under different GI
                const actualGIs = validSets.bayToGIs.get(trimmed);
                const giList = actualGIs ? Array.from(actualGIs).slice(0, 3).join(", ") : "??";
                return {
                    isValid: false,
                    reason: 'bay_wrong_gi',
                    message: `Bay "${trimmed}" bukan milik GI "${rowGI}". Bay ini ada di: ${giList}`,
                    suggestion: giList,
                };
            }
        }
        return { isValid: true, reason: 'valid', message: '' };
    }

    return { isValid: true, reason: 'valid', message: '' };
}

/* ── Validate all hierarchy columns in a row (v2 — with chain context) ── */
export function validateRow(
    row: Record<string, any>,
    hierarchyColumns: string[],
    validSets: HierarchyValidSets,
): RowQcResult {
    const details: Record<string, QcResult> = {};
    let errorCount = 0;

    for (const col of hierarchyColumns) {
        const result = validateHierarchyCell(col, row[col], validSets, row);
        details[col] = result;
        if (!result.isValid) errorCount++;
    }

    return {
        isHealthy: errorCount === 0,
        errorCount,
        details,
    };
}

/* ── Count invalid rows in dataset (v2 — with chain context) ── */
export function countInvalidRows(
    rows: Record<string, any>[],
    hierarchyColumns: string[],
    validSets: HierarchyValidSets,
): number {
    if (hierarchyColumns.length === 0 || (validSets.ultg.size === 0 && validSets.gi.size === 0)) {
        return 0;
    }
    return rows.filter(row => !validateRow(row, hierarchyColumns, validSets).isHealthy).length;
}

/* ── Summary: get all invalid cells grouped by error type ── */
export interface QcSummary {
    totalRows: number;
    invalidRows: number;
    healthPercent: number;
    byReason: Record<QcErrorReason, { count: number; examples: string[] }>;
}

export function buildQcSummary(
    rows: Record<string, any>[],
    hierarchyColumns: string[],
    validSets: HierarchyValidSets,
): QcSummary {
    const byReason: QcSummary['byReason'] = {
        valid: { count: 0, examples: [] },
        empty: { count: 0, examples: [] },
        ultg_not_found: { count: 0, examples: [] },
        gi_not_found: { count: 0, examples: [] },
        gi_wrong_ultg: { count: 0, examples: [] },
        bay_not_found: { count: 0, examples: [] },
        bay_wrong_gi: { count: 0, examples: [] },
        no_master_data: { count: 0, examples: [] },
    };

    let invalidRows = 0;
    for (const row of rows) {
        const result = validateRow(row, hierarchyColumns, validSets);
        if (!result.isHealthy) invalidRows++;
        for (const [col, qc] of Object.entries(result.details)) {
            const entry = byReason[qc.reason];
            if (entry) {
                entry.count++;
                if (entry.examples.length < 5) {
                    const val = row[col]?.toString().trim();
                    if (val && !entry.examples.includes(val)) entry.examples.push(val);
                }
            }
        }
    }

    return {
        totalRows: rows.length,
        invalidRows,
        healthPercent: rows.length > 0 ? Math.round((1 - invalidRows / rows.length) * 100) : 100,
        byReason,
    };
}
