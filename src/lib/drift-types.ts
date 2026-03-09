/**
 * Drift Types — Shared type definitions for config drift detection
 *
 * Digunakan oleh:
 *   - Worker (generate drift report setiap siklus)
 *   - DSM (tampilkan status kesehatan)
 *   - DC (pre-canvas validation)
 *   - SSE (broadcast ke frontend)
 *
 * Prinsip:
 *   - column.name = source of truth (bukan pos)
 *   - pos hanya helper display, auto-update diam-diam
 */

/* ── Status per kolom ── */
export type ColumnDriftStatus = "ok" | "moved" | "missing" | "renamed";

export interface ColumnDrift {
    /** Nama kolom sesuai config */
    name: string;
    /** Posisi menurut config (e.g. "B") */
    configPos: string;
    /** Status hasil audit */
    status: ColumnDriftStatus;
    /** Posisi aktual di sheet sekarang (jika ditemukan) */
    actualPos?: string;
    /** Saran nama baru dari fuzzy match (jika renamed) */
    suggestedName?: string;
    /** Skor fuzzy match (0-100) */
    matchScore?: number;
}

/* ── Status per sheet ── */
export type SheetDriftStatus = "ok" | "missing" | "renamed";

export interface SheetDrift {
    /** Nama sheet sesuai config */
    sheetName: string;
    /** Status hasil audit */
    status: SheetDriftStatus;
    /** Saran nama baru dari fuzzy match (jika renamed) */
    suggestedName?: string;
    /** Jumlah baris di sheet (jika ditemukan) */
    rowCount?: number;
    /** Detail drift per kolom */
    columns: ColumnDrift[];
    /** Ringkasan: berapa kolom OK / moved / missing */
    summary: {
        total: number;
        ok: number;
        moved: number;
        missing: number;
        renamed: number;
    };
}

/* ── Status per spreadsheet ── */
export interface SpreadsheetDrift {
    spreadsheetId: string;
    title: string;
    /** Apakah API bisa diakses? */
    accessible: boolean;
    /** Error message jika tidak bisa diakses */
    error?: string;
    /** Response time dalam ms */
    responseTime: number;
    /** Apakah dipakai oleh page manapun? */
    hasPages: boolean;
    /** Detail drift per sheet */
    sheets: SheetDrift[];
}

/* ── Drift Report (per siklus worker) ── */
export interface DriftReport {
    /** Timestamp pembuatan report */
    timestamp: string;
    /** Versi report (untuk backward compat) */
    version: 1;
    /** Health score keseluruhan (0-100) */
    overallHealth: number;
    /** Detail per spreadsheet */
    spreadsheets: SpreadsheetDrift[];
    /** Ringkasan global */
    summary: {
        totalSpreadsheets: number;
        totalSheets: number;
        totalColumns: number;
        issueCount: number;
        /** Daftar ringkas masalah untuk notifikasi cepat */
        issues: DriftIssue[];
    };
}

/* ── Issue entry untuk notifikasi singkat ── */
export interface DriftIssue {
    severity: "error" | "warning" | "info";
    spreadsheetTitle: string;
    sheetName: string;
    columnName?: string;
    message: string;
}
