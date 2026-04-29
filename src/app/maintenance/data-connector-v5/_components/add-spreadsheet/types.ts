/**
 * Add Spreadsheet Wizard — shared types
 * Mirror backend `/api/ss-v5/wizard/*` response shapes.
 */

export interface DetectedSheet {
    sheetId: number;
    title: string;
    rowCount: number;
    headers: string[];
}

export interface SpreadsheetInfo {
    spreadsheetId: string;
    name: string;
    owner: string;
    modifiedTime: string;
    webViewLink: string;
    sheets: DetectedSheet[];
}

export interface SheetConfigFE {
    include: boolean;
    tableName: string;
    // pkColumn DROPPED 2026-04-23 (V2 Mode C — Full Replace, no PK needed)
    // Level + FK columns moved to Step 4 (Level Config) — set terpisah via bq_table_levels
}

export interface SheetPreview {
    sheet: string;
    tableName: string;
    hierarchyLevel: string;
    headers: Array<{ name: string; safeName: string; included: boolean; reason?: string }>;
    sampleRows: Array<Record<string, string>>;
    totalRowsEstimate: number;
    rejectedEstimate: number;
    rejectedSample: Array<{ rowNumber: number; reason: string; value: string }>;
    storageEstimateKB: number;
    error?: string;
}

export interface TotalEstimate {
    rows: number;
    rejected: number;
    storageKB: number;
}

export interface CreateResultSheet {
    sheet: string;
    ok: boolean;
    error?: string;
}

export interface CreateResult {
    datasetId: string;
    created?: number;
    results?: CreateResultSheet[];
}
