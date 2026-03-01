/**
 * Page Config Types — Per-Page Data Source Configuration
 *
 * Each dashboard page has its own config JSON in `src/lib/page-configs/`.
 * This replaces the monolithic spreadsheet-config.json for page-level data.
 *
 * Flow:
 *   Data Connector WRITES → page-configs/<slug>.json
 *   API routes READ       → page-configs/<slug>.json
 *   DSM Health Check READ → page-configs/<slug>.json
 */

/* ── Column definition — what column from a sheet is used ── */
export interface PageColumnDef {
    name: string;            // Column header in Google Sheet
    pos: string;             // Column letter (A, B, C, ...)
}

/* ── Data source — a sheet linked to this page ── */
export interface PageDataSource {
    spreadsheetId: string;   // Google Sheets document ID
    sheetName: string;       // Tab name within the spreadsheet
    label: string;           // Human-readable label (e.g., "Data Tower Transmisi")
    route: string;           // API route (e.g., "/api/towers")
    role?: string;           // Data role: "map-markers", "heatmap-data", "hierarchy", "lookup"
    columnsUsed: PageColumnDef[];
    disabledColumns?: string[];         // Columns explicitly disabled by admin
    hierarchyPresent?: string[];        // Which hierarchy keys exist (e.g., ["ultg", "gi"])
    hierarchyMapping?: Record<string, string>;  // e.g., { "ultg": "Master ULTG" }
}

/* ── Relation — column-to-column join between two sheets ── */
export interface PageRelation {
    id: string;              // Unique relation ID
    fromSheet: string;       // Source sheet name
    fromColumn: string;      // Source column name
    toSheet: string;         // Target sheet name
    toColumn: string;        // Target column name
    joinType: "left" | "inner";
    auto?: boolean;          // Was this auto-generated from hierarchy matching?
}

/* ── Page Config root ── */
export interface PageConfig {
    page: string;            // Page path (e.g., "/asset-maps")
    label: string;           // Human-readable label (e.g., "Asset Maps")
    dataSources: PageDataSource[];
    relations: PageRelation[];
    updatedAt?: string;      // ISO timestamp of last save
}
