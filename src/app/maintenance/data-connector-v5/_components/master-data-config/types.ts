/**
 * Master Data Config — shared types (v2 BQ-sourced).
 * Ref: Spreadsheet Sync/docs/MASTER_CONFIG_SCHEMA.md
 */

export type Level = "upt" | "ultg" | "gi" | "bay";

export interface LevelConfig {
    dataset: string;
    table: string;
    columns: {
        name: string;
        parentNames?: { upt?: string; ultg?: string; gi?: string };
        attrs?: Record<string, string>;
    };
}

export interface MasterConfig {
    version: 2;
    source: "bigquery";
    configuredAt?: string;
    configuredBy?: string;
    scope?: { uptFilter?: string };
    levels: Record<Level, LevelConfig>;
}

export type DatasetOption = { id: string; category: string };
export type TableOption = { id: string; type: string; rowCount: number };
export type ColumnOption = { name: string; type: string; mode: string };

export interface TestResultEntry {
    ok: boolean;
    distinctCount?: number;
    rowCount?: number;
    error?: string;
}

export type TestResult = Record<Level, TestResultEntry>;
