/**
 * QC Store — In-memory storage for QC writeback results
 *
 * Pattern follows drift-store.ts: globalThis singleton for Next.js hot-reload safety.
 *
 * Used by:
 *   - Worker: stores QC results after validation
 *   - API/SSE: FE reads QC status from here
 *
 * Write-once logic: stores a hash of previous QC results per sheet.
 * If hash matches → skip writeback (no API call).
 */

import { createHash } from "crypto";

/* ── Types ── */
export interface SheetQcResult {
    spreadsheetId: string;
    sheetName: string;
    total: number;
    invalid: number;
    /** Per-row invalid cell info: [rowIndex, colName, reason][] */
    invalidCells: [number, string, string][];
    /** Hash of invalidCells for write-once comparison */
    hash: string;
    /** Whether formatting was written to the sheet */
    written: boolean;
    /** Timestamp of last QC run */
    lastRun: string;
}

export interface QcReport {
    results: Map<string, SheetQcResult>; // key = "ssId::sheetName"
    lastRun: string;
    totalErrors: number;
}

/* ── Global state (survives hot-reload) ── */
const STORE_KEY = "__qcReport" as const;
interface GlobalWithQc {
    [STORE_KEY]?: QcReport | null;
}
const g = globalThis as unknown as GlobalWithQc;

/** Save QC report */
export function setQcReport(report: QcReport): void {
    g[STORE_KEY] = report;
}

/** Get latest QC report */
export function getQcReport(): QcReport | null {
    return g[STORE_KEY] ?? null;
}

/** Get QC result for a specific sheet */
export function getSheetQcResult(spreadsheetId: string, sheetName: string): SheetQcResult | null {
    const report = getQcReport();
    if (!report) return null;
    return report.results.get(`${spreadsheetId}::${sheetName}`) ?? null;
}

/** Check if QC needs to write (hash changed OR previous run was dry-run) */
export function needsWrite(key: string, newHash: string): boolean {
    const report = getQcReport();
    if (!report) return true; // Never run before → needs write
    const prev = report.results.get(key);
    if (!prev) return true; // New sheet → needs write
    if (!prev.written) return true; // Previous was dry-run → needs write
    return prev.hash !== newHash; // Data changed → needs write
}

/** Generate hash for a set of invalid cells */
export function hashInvalidCells(cells: [number, string, string][]): string {
    if (cells.length === 0) return "CLEAN";
    const data = cells.map(c => `${c[0]}:${c[1]}:${c[2]}`).sort().join("|");
    return createHash("md5").update(data).digest("hex").slice(0, 12);
}

/** Clear QC report (for testing/reset) */
export function clearQcReport(): void {
    g[STORE_KEY] = null;
}
