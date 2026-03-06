/**
 * Background Prefetch Worker
 *
 * Scans all page-configs, collects unique spreadsheetId+sheetName pairs,
 * merges their column requirements (union), and fetches them every 60 seconds.
 *
 * This keeps the sheet-cache warm so page loads are instant (0 API requests).
 *
 * Lazy initialization: starts on first API call, not on import.
 *
 * Flow per cycle:
 *   1. Scan page-configs/*.json → collect unique sheets
 *   2. Fetch each sheet (1 API call per sheet, all columns)
 *   3. Store in sheet-cache with fetchMs timing
 *   4. Emit SSE events (progress per sheet, cycle-done at end)
 *   5. Wait REFRESH_INTERVAL_MS, then repeat
 *
 * With 17 unique sheets × 1 call each = 17 API calls per cycle.
 * Delay of 2s between sheets → cycle takes ~34s, well under 60s interval.
 */

import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { fetchSheetData, getSpreadsheetTitle, type ColumnPosition } from "@/lib/sheets-api";
import { sheetCache } from "@/lib/sheet-cache";
import { rateLimitCounter } from "@/lib/rate-limit-counter";

/* ── Config ── */
const REFRESH_INTERVAL_MS = 60_000; // 60 seconds
const FETCH_DELAY_MS = 2_000;       // 2s gap between sheets to avoid rate limit
const CONFIG_DIR = path.join(process.cwd(), "src/lib/page-configs");

/* ── Dev-only logging ── */
const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };

/* ── Types ── */
interface UniqueSheet {
    spreadsheetId: string;
    sheetName: string;
    columns: ColumnPosition[];      // union of all columns across pages
}

interface PageConfig {
    dataSources: {
        spreadsheetId: string;
        sheetName: string;
        columnsUsed: { name: string; pos: string }[];
    }[];
}

export interface SheetResult {
    sheet: string;
    ok: boolean;
    rows: number;
    ms: number;
}

/** SSE event types emitted by the worker */
export interface WorkerProgressEvent {
    type: "progress";
    sheet: string;
    ok: boolean;
    rows: number;
    ms: number;
    current: number;
    total: number;
}

export interface WorkerCycleDoneEvent {
    type: "cycle-done";
    success: number;
    errors: number;
    elapsedMs: number;
    totalSheets: number;
}

export interface SpreadsheetGroup {
    spreadsheetId: string;
    label: string;
    sheets: string[];
}

export interface WorkerCycleStartEvent {
    type: "cycle-start";
    totalSheets: number;
    sheets: string[];
    groups: SpreadsheetGroup[];
}

/**
 * Global EventEmitter for SSE streaming.
 *
 * Shared via globalThis to survive Next.js module isolation.
 * Emits: "progress" (per sheet), "cycle-start", "cycle-done"
 *
 * Scalable: any future event types can be added without changing the architecture.
 */
const globalForEmitter = globalThis as typeof globalThis & { __workerEmitter?: EventEmitter };
export const workerEmitter = globalForEmitter.__workerEmitter ??= (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(50); // Support up to 50 concurrent SSE connections
    return emitter;
})();

/**
 * Scan all page-configs/*.json and collect unique sheets with merged columns.
 */
function collectUniqueSheets(): UniqueSheet[] {
    const uniqueMap = new Map<string, UniqueSheet>();

    try {
        const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith(".json"));

        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(CONFIG_DIR, file), "utf-8");
                const config: PageConfig = JSON.parse(raw);

                for (const ds of config.dataSources || []) {
                    const key = `${ds.spreadsheetId}::${ds.sheetName}`;
                    const existing = uniqueMap.get(key);

                    if (existing) {
                        // Merge columns: add any new columns not already in the list
                        const existingNames = new Set(existing.columns.map(c => c.name.toLowerCase()));
                        for (const col of ds.columnsUsed || []) {
                            if (!existingNames.has(col.name.toLowerCase())) {
                                existing.columns.push({ name: col.name, pos: col.pos });
                                existingNames.add(col.name.toLowerCase());
                            }
                        }
                    } else {
                        uniqueMap.set(key, {
                            spreadsheetId: ds.spreadsheetId,
                            sheetName: ds.sheetName,
                            columns: (ds.columnsUsed || []).map(c => ({ name: c.name, pos: c.pos })),
                        });
                    }
                }
            } catch (err) {
                devLog(`[prefetch] Error reading config ${file}:`, err);
            }
        }
    } catch (err) {
        devLog(`[prefetch] Error scanning config dir:`, err);
    }

    return [...uniqueMap.values()];
}

/**
 * Fetch all unique sheets and populate the cache.
 * Emits SSE events for real-time progress streaming.
 */
async function refreshAllSheets(): Promise<void> {
    const sheets = collectUniqueSheets().sort((a, b) => a.spreadsheetId.localeCompare(b.spreadsheetId));
    const cycleStart = Date.now();

    // Update quota monitor with deterministic sheet count
    rateLimitCounter.setSheetCount(sheets.length);

    devLog(`\n╔══════════════════════════════════════════════╗`);
    devLog(`║ [prefetch] CYCLE START — ${sheets.length} sheets to fetch  ║`);
    devLog(`╚══════════════════════════════════════════════╝`);

    let success = 0;
    let errors = 0;

    // Reset live progress
    liveProgress = { current: 0, total: sheets.length, currentSheet: "", results: [] };

    // Build spreadsheet groups — auto-fetch titles from Google Sheets API (cached)
    const uniqueIds = [...new Set(sheets.map(s => s.spreadsheetId))];
    const titleMap = new Map<string, string>();
    await Promise.all(uniqueIds.map(async (id) => {
        const title = await getSpreadsheetTitle(id);
        titleMap.set(id, title);
    }));

    const groupMap = new Map<string, { label: string; sheets: string[] }>();
    for (const s of sheets) {
        let g = groupMap.get(s.spreadsheetId);
        if (!g) {
            g = { label: titleMap.get(s.spreadsheetId) ?? s.spreadsheetId.slice(0, 8), sheets: [] };
            groupMap.set(s.spreadsheetId, g);
        }
        g.sheets.push(s.sheetName);
    }

    // Persist groups so SSE reconnects can use them
    const groupsPayload = [...groupMap.entries()].map(([id, g]) => ({
        spreadsheetId: id,
        label: g.label,
        sheets: g.sheets,
    }));
    lastGroups = globalForGroups.__lastGroups = groupsPayload;

    // Emit cycle-start event for SSE (includes sheet names for upfront display)
    workerEmitter.emit("cycle-start", {
        type: "cycle-start",
        totalSheets: sheets.length,
        sheets: sheets.map(s => s.sheetName),
        groups: groupsPayload,
    } satisfies WorkerCycleStartEvent);

    // Burst-per-spreadsheet: fetch all sheets in a spreadsheet in parallel,
    // then move to the next spreadsheet after a short delay
    const spreadsheetGroups = new Map<string, typeof sheets>();
    for (const sheet of sheets) {
        const arr = spreadsheetGroups.get(sheet.spreadsheetId) ?? [];
        arr.push(sheet);
        spreadsheetGroups.set(sheet.spreadsheetId, arr);
    }

    let globalIdx = 0;
    let groupIdx = 0;
    for (const [ssId, groupSheets] of spreadsheetGroups) {
        // Delay between spreadsheet groups (skip first)
        if (groupIdx > 0) await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
        groupIdx++;

        devLog(`  ── ${titleMap.get(ssId) ?? ssId.slice(0, 8)} (${groupSheets.length} sheets) ──`);

        // Burst: fetch all sheets in this spreadsheet in parallel
        await Promise.all(groupSheets.map(async (sheet) => {
            const idx = ++globalIdx;
            liveProgress.current = idx;
            liveProgress.currentSheet = sheet.sheetName;

            try {
                const t0 = Date.now();
                const data = await fetchSheetData(
                    sheet.spreadsheetId,
                    sheet.sheetName,
                    sheet.columns
                );
                const fetchMs = Date.now() - t0;

                sheetCache.set(
                    sheet.spreadsheetId,
                    sheet.sheetName,
                    data,
                    sheet.columns.map(c => c.name),
                    fetchMs
                );

                const result: SheetResult = { sheet: sheet.sheetName, ok: true, rows: data.rowCount, ms: fetchMs };
                liveProgress.results.push(result);

                workerEmitter.emit("progress", {
                    type: "progress",
                    sheet: sheet.sheetName,
                    ok: true,
                    rows: data.rowCount,
                    ms: fetchMs,
                    current: idx,
                    total: sheets.length,
                } satisfies WorkerProgressEvent);

                devLog(`  [${String(idx).padStart(2)}/${sheets.length}] ✓ ${sheet.sheetName.padEnd(28)} ${String(data.rowCount).padStart(5)} rows  ${String(fetchMs).padStart(5)}ms`);
                success++;
            } catch (err) {
                errors++;
                const errMsg = (err as Error)?.message || "Unknown";
                const errCode = (err as { code?: number })?.code
                    || (err as { status?: number })?.status
                    || (errMsg.includes("429") ? 429 : 0);
                if (errCode) rateLimitCounter.recordError(errCode, errMsg);

                const result: SheetResult = { sheet: sheet.sheetName, ok: false, rows: 0, ms: 0 };
                liveProgress.results.push(result);

                workerEmitter.emit("progress", {
                    type: "progress",
                    sheet: sheet.sheetName,
                    ok: false,
                    rows: 0,
                    ms: 0,
                    current: idx,
                    total: sheets.length,
                } satisfies WorkerProgressEvent);

                devLog(`  [${String(idx).padStart(2)}/${sheets.length}] ✗ ${sheet.sheetName.padEnd(28)} ERROR: ${errMsg.slice(0, 60)}`);
            }
        }));
    }

    const elapsed = Date.now() - cycleStart;

    // Emit cycle-done event for SSE (triggers auto-refresh on frontend)
    workerEmitter.emit("cycle-done", {
        type: "cycle-done",
        success,
        errors,
        elapsedMs: elapsed,
        totalSheets: sheets.length,
    } satisfies WorkerCycleDoneEvent);

    devLog(`╔══════════════════════════════════════════════╗`);
    devLog(`║ [prefetch] CYCLE DONE — ${success} OK, ${errors} err (${(elapsed / 1000).toFixed(1)}s)`.padEnd(47) + `║`);
    devLog(`║ Next refresh in: ${REFRESH_INTERVAL_MS / 1000}s`.padEnd(47) + `║`);
    devLog(`╚══════════════════════════════════════════════╝\n`);
}

/* ── Worker Singleton (via globalThis) ── */

interface WorkerState {
    timer: ReturnType<typeof setTimeout> | null;
    running: boolean;
    lastCycleEnd: number | null;
}

const globalForWorker = globalThis as typeof globalThis & { __workerState?: WorkerState };
const workerState = globalForWorker.__workerState ??= {
    timer: null,
    running: false,
    lastCycleEnd: null,
};

/** Live progress — updated during each refresh cycle */
interface LiveProgress {
    current: number;
    total: number;
    currentSheet: string;
    results: SheetResult[];
}
let liveProgress: LiveProgress = { current: 0, total: 0, currentSheet: "", results: [] };
const globalForGroups = globalThis as typeof globalThis & { __lastGroups?: Array<{ spreadsheetId: string; label: string; sheets: string[] }> };
let lastGroups = globalForGroups.__lastGroups ??= [];

/**
 * Start the background prefetch worker.
 * Safe to call multiple times — only starts once.
 */
export function startPrefetchWorker(): void {
    if (workerState.timer || workerState.running) return; // already running

    devLog(`[prefetch] ⚡ Worker started (interval: ${REFRESH_INTERVAL_MS / 1000}s, delay: ${FETCH_DELAY_MS / 1000}s/sheet)`);

    // Initial fetch immediately
    runCycle();
}

/** Schedule next cycle after REFRESH_INTERVAL_MS from now */
function scheduleNext(): void {
    workerState.timer = setTimeout(() => {
        workerState.timer = null;
        runCycle();
    }, REFRESH_INTERVAL_MS);
}

async function runCycle(): Promise<void> {
    if (workerState.running) {
        devLog("[prefetch] ⏭ Skipping — previous cycle still running");
        scheduleNext();
        return;
    }
    workerState.running = true;
    try {
        await refreshAllSheets();
    } catch (err) {
        devLog("[prefetch] Cycle error:", err);
    } finally {
        workerState.running = false;
        workerState.lastCycleEnd = Date.now();
        scheduleNext(); // Schedule next cycle 60s from NOW (cycle end)
    }
}

/** Get worker status for the FE countdown/progress indicator */
export function getWorkerStatus() {
    const intervalSec = REFRESH_INTERVAL_MS / 1000;
    let secondsUntilRefresh = intervalSec;
    if (workerState.lastCycleEnd) {
        const elapsed = Math.round((Date.now() - workerState.lastCycleEnd) / 1000);
        secondsUntilRefresh = Math.max(0, intervalSec - elapsed);
    }
    return {
        intervalSec,
        secondsUntilRefresh,
        isRefreshing: workerState.running,
        lastRefreshAt: workerState.lastCycleEnd ? new Date(workerState.lastCycleEnd).toISOString() : null,
        groups: lastGroups,
        progress: workerState.running ? {
            current: liveProgress.current,
            total: liveProgress.total,
            currentSheet: liveProgress.currentSheet,
            completed: liveProgress.results,
        } : null,
    };
}

/**
 * Stop the background worker (for cleanup/testing).
 */
export function stopPrefetchWorker(): void {
    if (workerState.timer) {
        clearInterval(workerState.timer);
        workerState.timer = null;
        devLog("[prefetch] Worker stopped");
    }
}

/**
 * Get the worker's collected unique sheet list (for debugging).
 */
export function getUniqueSheets(): UniqueSheet[] {
    return collectUniqueSheets();
}
