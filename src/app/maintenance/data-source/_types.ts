/**
 * Data Source Manager — Shared Types
 *
 * Single source of truth for all TypeScript types used across
 * the Data Source Manager components. Keep alphabetically sorted.
 */

/* ─── Registry Types (Add/Unlink/Delete/Manage) ──────────── */

/** Target for unlinking a sheet from a specific page */
export type UnlinkTarget = {
    id: string;            // spreadsheetId
    title: string;         // spreadsheet display name
    sheetName: string;     // sheet tab name
    pagePath: string;      // page to unlink FROM (e.g. "/asset-maps")
    pageLabel: string;     // display name (e.g. "Asset Maps")
};

/** Target for deleting a sheet/spreadsheet from registry (only when usedBy is empty) */
export type DeleteTarget = {
    type: "spreadsheet" | "sheet";
    id: string;            // spreadsheetId
    title: string;         // display name for the dialog
    sheetName?: string;    // only for sheet-level deletion
};

export type RegistrySheet = {
    sheetName: string;
    label: string;
    route: string;
    usedBy: string[];
    columnsUsed: unknown[];
};

export type RegistryEntry = {
    id: string;
    spreadsheetId: string;
    title: string;
    sheets: RegistrySheet[];
};

export type DetectedSheet = {
    sheetName: string;
    rowCount: number;
    colCount: number;
    headers: string[];
};

export type ExploreSheet = {
    name: string;
    rowCount: number;
    colCount: number;
    headers: string[];
    registered: boolean;
    usedBy: string[];
    route: string;
};

/* ─── Diagnostics & Health Types ──────────────────── */

export type ColumnMeta = {
    position: string;
    index: number;
    name: string;
    type: string;
    sample: string;
    isUsed: boolean;
    configName: string | null;
    configPos: string | null;
    isOverride?: boolean;
    isHierarchy?: boolean;
    hierarchyKey?: string | null;
    isDisabled?: boolean;
};

export type MissingColumn = {
    name: string;
    expectedPos: string | null;
    currentAtPos: string | null;
    suggestion: string | null;
};

export type RouteHealth = {
    status: number;
    ok: boolean;
    time: number;
    count?: number;
} | null;

export type HierarchyCheck = {
    key: string;
    label: string;
    required: boolean;
    found: boolean;
    matchedAs: string | null;
};

/* ─── API Response Types ──────────────────────────── */

export type SheetResult = {
    configuredName: string;
    actualName: string;
    label: string;
    route: string;
    status: "ok" | "missing";
    rowCount: number;
    colCount: number;
    columnMeta: ColumnMeta[];
    missingColumns: MissingColumn[];
    suggestions: { name: string; score: number }[];
    routeHealth: RouteHealth;
    hierarchy?: HierarchyCheck[];
    resolveLevel?: string;
};

export type SpreadsheetResult = {
    spreadsheetId: string;
    title: string;
    responseTime: number;
    error: string | null;
    allSheetNames: string[];
    sheets: SheetResult[];
};

export type PageResult = {
    page: string;
    path: string;
    icon: string;
    healthScore: number;
    totalChecks: number;
    passedChecks: number;
    spreadsheets: SpreadsheetResult[];
};

export type UnlinkedPage = {
    page: string;
    path: string;
    section: string;
};

export type DSResponse = {
    timestamp: string;
    overallHealth: number;
    apiHealth: Record<string, { status: number; ok: boolean; time: number; count?: number }>;
    pages: PageResult[];
    unlinkedPages?: UnlinkedPage[];
};

/* ─── UI Config Types ─────────────────────────────── */

export interface SheetLinkConfig {
    page: string;
    route: string;
}

/* ─── Constants ───────────────────────────────────── */

export const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    teks: { label: "Text", color: "text-blue-400/60" },
    angka: { label: "Number", color: "text-amber-400/60" },
    koordinat: { label: "Coord", color: "text-cyan-400/60" },
    tanggal: { label: "Date", color: "text-purple-400/60" },
    boolean: { label: "Bool", color: "text-green-400/60" },
    url: { label: "URL", color: "text-sky-400/60" },
    empty: { label: "Unknown", color: "text-slate-600" },
};
