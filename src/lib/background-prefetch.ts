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
import { buildDriftReport, getMovedColumns, type ActualSpreadsheetData, type ActualSheetData, type ConfiguredSpreadsheet, type ConfiguredColumn } from "@/lib/drift-audit";
import { setDriftReport } from "@/lib/drift-store";
import { loadRegistry, saveRegistry, type SpreadsheetEntry } from "@/lib/data-source-registry";
import { runQcWriteback, isQcWritebackEnabled, setQcWritebackEnabled } from "@/lib/qc-writeback";

/* ── Dynamic Config (adjustable via API) ── */
export interface WorkerConfig {
    refreshIntervalMs: number;
    fetchDelayMs: number;
}
const DEFAULT_CONFIG: WorkerConfig = { refreshIntervalMs: 60_000, fetchDelayMs: 2_000 };
const globalForConfig = globalThis as typeof globalThis & { __workerConfig?: WorkerConfig };
const getConfig = (): WorkerConfig => globalForConfig.__workerConfig ?? DEFAULT_CONFIG;
export function setWorkerConfig(patch: Partial<WorkerConfig>) {
    const cur = getConfig();
    globalForConfig.__workerConfig = { ...cur, ...patch };
}
export function getWorkerConfig(): WorkerConfig { return { ...getConfig() }; }

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

/** Drift report event — broadcasted by worker after completing audit */
interface WorkerDriftEvent {
    type: "drift-report";
    overallHealth: number;
    issueCount: number;
    timestamp: string;
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
 * After fetching, runs drift audit and broadcasts report.
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
        try {
            const title = await getSpreadsheetTitle(id);
            titleMap.set(id, title);
        } catch (err) {
            devLog(`[prefetch] Error fetching title for ${id}:`, err);
            titleMap.set(id, "Unknown Spreadsheet");
        }
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
    // then move to the next spreadsheet after a smart delay
    const spreadsheetGroups = new Map<string, typeof sheets>();
    for (const sheet of sheets) {
        const arr = spreadsheetGroups.get(sheet.spreadsheetId) ?? [];
        arr.push(sheet);
        spreadsheetGroups.set(sheet.spreadsheetId, arr);
    }

    // ── Smart Rate Limiter ──
    // Google Sheets API limit: 60 read requests per minute per user
    // Safety margin: use 50 req/min to avoid edge cases
    const QUOTA_PER_MINUTE = 50;
    const groupCount = spreadsheetGroups.size;
    const totalRequests = sheets.length;

    // Hitung delay antar group agar total requests tersebar dalam 60 detik
    // Jika total request < quota → delay minimal (1s)
    // Jika total request >= quota → spread evenly
    const smartDelayMs = totalRequests <= QUOTA_PER_MINUTE
        ? Math.max(1000, Math.ceil(60_000 / groupCount / 2))   // cukup quota → delay ringan
        : Math.ceil((60_000 / QUOTA_PER_MINUTE) * Math.max(...[...spreadsheetGroups.values()].map(g => g.length)));

    devLog(`  [rate-limit] ${totalRequests} sheets, ${groupCount} groups, delay=${smartDelayMs}ms (quota=${QUOTA_PER_MINUTE}/min)`);

    // ── Collect actual headers per spreadsheet for drift audit ──
    const actualHeadersMap = new Map<string, Map<string, { headers: string[]; rowCount: number }>>();

    let globalIdx = 0;
    let groupIdx = 0;
    for (const [ssId, groupSheets] of spreadsheetGroups) {
        // Smart delay between spreadsheet groups (skip first)
        if (groupIdx > 0) await new Promise(r => setTimeout(r, smartDelayMs));
        groupIdx++;

        devLog(`  ── ${titleMap.get(ssId) ?? ssId.slice(0, 8)} (${groupSheets.length} sheets) ──`);

        // Initialize headers map for this spreadsheet
        if (!actualHeadersMap.has(ssId)) actualHeadersMap.set(ssId, new Map());
        const ssHeaders = actualHeadersMap.get(ssId)!;

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

                // Collect headers for drift audit
                ssHeaders.set(sheet.sheetName, {
                    headers: data.headers,
                    rowCount: data.rowCount,
                });

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

    // ── Drift Audit: bandingkan header aktual vs config registry ──
    try {
        const registry = loadRegistry();

        // Build actual data dari hasil fetch
        const actuals: ActualSpreadsheetData[] = [];
        for (const [ssId, sheetsMap] of actualHeadersMap) {
            const actualSheets: ActualSheetData[] = [];
            for (const [sheetName, data] of sheetsMap) {
                actualSheets.push({ sheetName, headers: data.headers, rowCount: data.rowCount });
            }
            actuals.push({
                spreadsheetId: ssId,
                title: titleMap.get(ssId) || ssId.slice(0, 8),
                accessible: true,
                responseTime: 0,
                sheets: actualSheets,
            });
        }

        // Build config data dari page-configs (sumber kebenaran kolom)
        // collectUniqueSheets() sudah merge kolom dari semua page-configs per sheet
        const uniqueSheets = collectUniqueSheets();
        const uniqueMap = new Map(uniqueSheets.map(u => [`${u.spreadsheetId}::${u.sheetName}`, u]));

        const configs: ConfiguredSpreadsheet[] = registry
            .map((entry: SpreadsheetEntry) => ({
                spreadsheetId: entry.spreadsheetId,
                title: entry.title,
                sheets: entry.sheets
                    .filter(sh => {
                        // HANYA sheet yang ada di page-configs (benar-benar terhubung ke page)
                        const key = `${entry.spreadsheetId}::${sh.sheetName}`;
                        return uniqueMap.has(key);
                    })
                    .map(sh => {
                        const key = `${entry.spreadsheetId}::${sh.sheetName}`;
                        const pc = uniqueMap.get(key)!;
                        return {
                            sheetName: sh.sheetName,
                            columnsUsed: pc.columns.map(c => ({
                                name: c.name, pos: c.pos || "",
                            })) as ConfiguredColumn[],
                            usedBy: sh.usedBy || [],
                        };
                    }),
            }))
            .filter(cfg => cfg.sheets.length > 0);

        // Generate drift report
        const driftReport = buildDriftReport(configs, actuals);

        // Auto-fix posisi kolom yang bergeser — cascade ke page-configs + registry
        const movedCols = getMovedColumns(driftReport);
        if (movedCols.length > 0) {
            // 1. Fix di page-configs (sumber kebenaran kolom)
            let pcFixed = 0;
            try {
                const pcFiles = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith(".json"));
                for (const file of pcFiles) {
                    const filePath = path.join(CONFIG_DIR, file);
                    const raw = fs.readFileSync(filePath, "utf-8");
                    const pc = JSON.parse(raw);
                    let changed = false;
                    for (const ds of pc.dataSources || []) {
                        for (const moved of movedCols) {
                            if (ds.spreadsheetId !== moved.spreadsheetId) continue;
                            if (ds.sheetName.toLowerCase() !== moved.sheetName.toLowerCase()) continue;
                            for (const col of ds.columnsUsed || []) {
                                if (col.name.toLowerCase() === moved.columnName.toLowerCase() && col.pos !== moved.newPos) {
                                    col.pos = moved.newPos;
                                    changed = true;
                                    pcFixed++;
                                }
                            }
                        }
                    }
                    if (changed) {
                        fs.writeFileSync(filePath, JSON.stringify(pc, null, 2) + "\n", "utf-8");
                    }
                }
            } catch (err) {
                devLog(`[drift] Error fixing POS in page-configs:`, err);
            }

            // 2. Fix di registry juga (backup)
            let registryChanged = false;
            for (const moved of movedCols) {
                for (const entry of registry) {
                    if ((entry as SpreadsheetEntry).spreadsheetId !== moved.spreadsheetId) continue;
                    for (const sh of (entry as SpreadsheetEntry).sheets) {
                        if (sh.sheetName.toLowerCase() !== moved.sheetName.toLowerCase()) continue;
                        for (const col of sh.columnsUsed) {
                            const colName = typeof col === "string" ? col : col.name;
                            if (colName.toLowerCase() === moved.columnName.toLowerCase() && typeof col !== "string") {
                                col.pos = moved.newPos;
                                registryChanged = true;
                            }
                        }
                    }
                }
            }
            if (registryChanged) saveRegistry(registry);
            devLog(`[drift] Auto-fix POS: ${pcFixed} in page-configs, ${movedCols.length} total moved`);
        }

        // Auto-sync spreadsheet titles (pindahan dari health-check.ts)
        let titleChanged = false;
        for (const entry of registry) {
            const ssEntry = entry as SpreadsheetEntry;
            const freshTitle = titleMap.get(ssEntry.spreadsheetId);
            if (freshTitle && freshTitle !== "Unknown Spreadsheet" && freshTitle !== ssEntry.title) {
                devLog(`[drift] Title sync: "${ssEntry.title}" → "${freshTitle}"`);
                ssEntry.title = freshTitle;
                titleChanged = true;
            }
        }
        if (titleChanged) {
            saveRegistry(registry);
            devLog(`[drift] Saved title sync to registry`);
        }

        // Simpan ke store & broadcast via SSE
        setDriftReport(driftReport);
        workerEmitter.emit("drift-report", {
            type: "drift-report",
            overallHealth: driftReport.overallHealth,
            issueCount: driftReport.summary.issueCount,
            timestamp: driftReport.timestamp,
        } satisfies WorkerDriftEvent);

        if (driftReport.summary.issueCount > 0) {
            devLog(`[drift] ⚠️ ${driftReport.summary.issueCount} issue(s) detected — health: ${driftReport.overallHealth}%`);
            for (const issue of driftReport.summary.issues.slice(0, 5)) {
                devLog(`  ${issue.severity === "error" ? "❌" : "⚠️"} ${issue.spreadsheetTitle}/${issue.sheetName}: ${issue.message}`);
            }
        } else {
            devLog(`[drift] ✅ Semua OK — health: ${driftReport.overallHealth}%`);
        }
    } catch (driftErr) {
        console.error("[drift] Error running drift audit:", driftErr);
    }

    // ── QC Writeback: validate hierarchy & optionally format cells ──
    try {
        await runQcWriteback();
    } catch (qcErr) {
        console.error("[QC Worker] Error running QC writeback:", qcErr);
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
    devLog(`║ Next refresh in: ${getConfig().refreshIntervalMs / 1000}s`.padEnd(47) + `║`);
    devLog(`╚══════════════════════════════════════════════╝\n`);
}

/* ── Worker Singleton (via globalThis) ── */

interface WorkerState {
    timer: ReturnType<typeof setTimeout> | null;
    running: boolean;
    lastCycleEnd: number | null;
    forceOnce: boolean;
}

const globalForWorker = globalThis as typeof globalThis & { __workerState?: WorkerState };
const workerState = globalForWorker.__workerState ??= {
    timer: null,
    running: false,
    lastCycleEnd: null,
    forceOnce: false,
};
// Force reset hanging state on module hot-reload
if (workerState.running) {
    console.log("[prefetch] 🔄 Hard resetting stuck worker state on hot-reload");
    workerState.running = false;
}

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

/** Global pause state for background prefetch — includes reason for UI display */
export type PauseReason = "dsm" | "dc" | "manual" | "dev" | null;
interface PauseState { paused: boolean; reason: PauseReason }
const globalForPause = globalThis as typeof globalThis & { __pauseState?: PauseState };
const getPauseState = (): PauseState => globalForPause.__pauseState ?? { paused: false, reason: null };
export const getWorkerPaused = () => getPauseState().paused;
export const getPauseReason = (): PauseReason => getPauseState().reason;
export function setWorkerPaused(paused: boolean, reason: PauseReason = "manual") {
    globalForPause.__pauseState = { paused, reason: paused ? reason : null };
    const label = paused ? `PAUSED (${reason})` : "RESUMED";
    devLog(`[prefetch] Worker auto-fetch ${label}`);

    // Broadcast status change immediately so sidebar reacts
    workerEmitter.emit("status", { type: "status", ...getWorkerStatus() });
}

/** Trigger an immediate cycle regardless of timer or pause state */
export function triggerWorkerRefresh() {
    devLog("[prefetch] Manual refresh triggered (force once)");
    workerState.forceOnce = true;
    if (workerState.timer) {
        clearTimeout(workerState.timer);
        workerState.timer = null;
    }
    runCycle();
}

/**
 * Start the background prefetch worker.
 * Safe to call multiple times — only starts once.
 */
export function startPrefetchWorker(): void {
    if (workerState.timer || workerState.running) return; // already running

    const cfg = getConfig();
    devLog(`[prefetch] ⚡ Worker started (interval: ${cfg.refreshIntervalMs / 1000}s, delay: ${cfg.fetchDelayMs / 1000}s/group)`);

    // Initial fetch immediately
    runCycle();
}

/** Schedule next cycle after REFRESH_INTERVAL_MS from now */
function scheduleNext(): void {
    workerState.timer = setTimeout(() => {
        workerState.timer = null;
        runCycle();
    }, getConfig().refreshIntervalMs);
}

async function runCycle(): Promise<void> {
    if (workerState.running) {
        devLog("[prefetch] ⏭ Skipping — previous cycle still running");
        scheduleNext();
        return;
    }

    if (getWorkerPaused() && !workerState.forceOnce) {
        devLog("[prefetch] ⏸ Skipping — worker is PAUSED by user");
        scheduleNext();
        return;
    }
    workerState.forceOnce = false;

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
    const cfg = getConfig();
    const intervalSec = cfg.refreshIntervalMs / 1000;
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
        isPaused: getWorkerPaused(),
        pauseReason: getPauseReason(),
        config: cfg,
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
