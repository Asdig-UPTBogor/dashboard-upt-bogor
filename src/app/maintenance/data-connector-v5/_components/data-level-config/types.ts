/**
 * Data Level Config — shared types
 * Mirror backend `/api/bq-table-levels` response shape.
 */

export type Level = "UPT" | "ULTG" | "GI" | "BAY" | "FLAT";

export interface LevelColumns {
    upt?: string;
    ultg?: string;
    gi?: string;
    bay?: string;
}

export interface RejectReasons {
    [k: string]: number | undefined;
}

export interface DryRunSampleRow {
    row_number: number;
    reason: string;
    reason_message: string;
    cell_value: string | null;
}

export interface DryRunResult {
    rowsTotal: number;
    rowsEnriched: number;
    rowsRejected: number;
    rejectReasons: RejectReasons;
    sample: DryRunSampleRow[];
    runAt: string;
}

export interface TableEntry {
    dataset: string;
    table: string;
    level: Level;
    configured: boolean;
    columns?: LevelColumns;
    lastDryRun?: DryRunResult;
}

export interface ColumnMeta {
    name: string;
    type: string;
    mode: string;
}
