/**
 * SheetDetail — shared types.
 */

export interface SheetSyncState {
    dataset_name: string;
    sheet_name: string;
    last_synced_at?: string;
    last_sync_status?: string;
    row_count_total?: number;
    row_count_valid?: number;
    row_count_rejected?: number;
}

export interface RejectBreakdown {
    reason_code: string;
    count: number;
}

export interface RejectedRowLite {
    source_sheet?: string;
    reason_code?: string;
}
