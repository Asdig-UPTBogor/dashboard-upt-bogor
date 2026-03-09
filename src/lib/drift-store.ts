/**
 * Drift Store — Penyimpanan in-memory untuk DriftReport terbaru
 *
 * Digunakan oleh:
 *   - Worker: simpan report setelah audit
 *   - API worker-control: GET endpoint mengembalikan report terbaru
 *   - SSE: baca terakhir saat client connect
 *
 * Kenapa globalThis?
 *   Next.js hot-reload bisa re-import module, tapi globalThis tetap persistent.
 */

import type { DriftReport } from "./drift-types";

/* ── Global state key (avoid hot-reload reset) ── */
const STORE_KEY = "__driftReport" as const;

interface GlobalWithDrift {
    [STORE_KEY]?: DriftReport | null;
}

const g = globalThis as unknown as GlobalWithDrift;

/** Simpan drift report terbaru */
export function setDriftReport(report: DriftReport): void {
    g[STORE_KEY] = report;
}

/** Ambil drift report terbaru (null jika belum pernah ada) */
export function getDriftReport(): DriftReport | null {
    return g[STORE_KEY] ?? null;
}

/** Hapus drift report (untuk testing/reset) */
export function clearDriftReport(): void {
    g[STORE_KEY] = null;
}
