/**
 * Overview — shared types (health summary + master counts).
 */

export interface HealthSummary {
    total_datasets: number;
    total_rows: number;
    total_valid: number;
    total_rejected: number;
    overall_valid_pct: number;
    excellent: number;
    good: number;
    warning: number;
    critical: number;
}

export interface HealthDataset {
    dataset_name: string;
    row_count_total: number;
    row_count_valid: number;
    row_count_rejected: number;
    valid_pct: number;
    last_sync_status: string;
    last_synced_at: string;
    health_status: "excellent" | "good" | "warning" | "critical";
}

export interface HealthData {
    summary: HealthSummary;
    datasets: Array<HealthDataset>;
}

export interface MasterCounts {
    upt: number;
    ultg: number;
    gi: number;
    bay: number;
}

export type StatColor = "indigo" | "blue" | "amber" | "emerald" | "red";
