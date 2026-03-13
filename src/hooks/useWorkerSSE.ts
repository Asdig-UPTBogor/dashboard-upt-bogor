/**
 * useWorkerSSE — Global SSE hook for worker event streaming
 *
 * Creates ONE EventSource connection per browser tab (shared singleton).
 * Components subscribe to specific events without creating duplicate connections.
 *
 * Events:
 *   - "status"        → initial system snapshot
 *   - "cycle-start"   → worker begins fetching
 *   - "progress"      → one sheet fetched
 *   - "sync-complete" → cycle finished, data is fresh
 *   - "log"           → one worker log entry
 *   - "drift-report"  → drift audit result from worker
 *
 * Architecture:
 *   Browser Tab → 1 EventSource → /api/rate-limit (SSE mode)
 *   Multiple components → subscribe to same EventSource via this hook
 *
 * Debug: Open DevTools → Network → filter "rate-limit" → see EventStream tab
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getWorkerCountdown, type WorkerPauseReason } from "@/lib/worker-sync-ui";

/* ── SSE Event Types ── */

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
    type: "sync-complete" | "cycle-done";
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

export interface WorkerStatusSnapshot {
    sheetsPerCycle: number;
    quotaLimit: number;
    usagePercent: number;
    rateLimited: boolean;
    lastError429At: string | null;
    apiQuota?: {
        callsPerCycle: number;
        limitPerMinute: number;
        usagePercent: number;
        spreadsheetGroups: number;
        sheetsInScope: number;
        strategy: string;
        rateLimited: boolean;
        lastRateLimitAt: string | null;
    };
    syncSnapshot: {
        totalSheets: number;
        lastSyncAt: string | null;
        sheets: {
            key: string;
            spreadsheetId?: string;
            spreadsheetTitle?: string;
            sheetName?: string;
            rows: number;
            columns: number;
            age: number;
            fetchMs: number;
        }[];
    };
    worker: {
        intervalSec: number;
        secondsUntilRefresh: number;
        isRefreshing: boolean;
        isPaused?: boolean;
        pauseReason?: WorkerPauseReason;
        phase?: string | null;
        runStartedAt?: string | null;
        config?: { refreshIntervalMs: number; fetchDelayMs: number; page?: string | null };
        lastRefreshAt: string | null;
        groups?: SpreadsheetGroup[];
        progress: {
            current: number;
            total: number;
            currentSheet: string;
            currentItemType?: "sheet" | "page" | null;
            currentItemLabel?: string | null;
            completed: { sheet: string; ok: boolean; rows: number; ms: number }[];
        } | null;
    };
    logTail?: {
        at: string;
        level?: "info" | "warn" | "error" | "success";
        stage?: string;
        runId?: string | null;
        message: string;
        meta?: Record<string, unknown> | null;
    }[];
    drift: DriftSnapshotSummary | null;
}

/** Drift summary yang dikirim via SSE/API (bukan full report) */
export interface DriftSnapshotSummary {
    overallHealth: number;
    issueCount: number;
    timestamp: string;
    issues: DriftIssueSSE[];
}

export interface DriftIssueSSE {
    severity: "error" | "warning" | "info";
    spreadsheetTitle: string;
    sheetName: string;
    columnName?: string;
    message: string;
}

/* ── Global SSE Manager (singleton per tab) ── */

type SSEListener = (data: unknown) => void;

class SSEManager {
    private es: EventSource | null = null;
    private listeners = new Map<string, Set<SSEListener>>();
    private lastData = new Map<string, unknown>(); // Replay buffer
    private refCount = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    /** Add a subscriber. Starts connection if first subscriber. */
    subscribe(event: string, listener: SSEListener): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
        this.refCount++;

        if (this.refCount === 1) this.connect();

        // Replay last received data for this event type (fixes race condition)
        const last = this.lastData.get(event);
        if (last !== undefined) {
            queueMicrotask(() => listener(last));
        }

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(listener);
            this.refCount--;
            if (this.refCount <= 0) {
                this.refCount = 0;
                this.disconnect();
            }
        };
    }

    private connect() {
        if (this.es) return;

        this.es = new EventSource("/api/rate-limit");

        // Register all known event types
        const eventTypes = ["status", "cycle-start", "progress", "sync-complete", "drift-report", "heartbeat", "log"];
        for (const type of eventTypes) {
            this.es.addEventListener(type, (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    this.lastData.set(type, data); // Cache for replay
                    window.dispatchEvent(new CustomEvent("dashboard-sync-worker:sse", {
                        detail: { eventType: type, data },
                    }));
                    this.listeners.get(type)?.forEach(fn => fn(data));
                } catch { /* ignore parse errors */ }
            });
        }

        this.es.onerror = () => {
            // EventSource auto-reconnects, but we clear stale state
            if (this.es?.readyState === EventSource.CLOSED) {
                this.es = null;
                // Manual reconnect after 5s if still have subscribers
                if (this.refCount > 0) {
                    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
                }
            }
        };
    }

    private disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.es) {
            this.es.close();
            this.es = null;
        }
        this.lastData.clear();
    }
}

// Singleton SSE manager for the browser tab
let sseManager: SSEManager | null = null;
function getSSEManager(): SSEManager {
    if (!sseManager) sseManager = new SSEManager();
    return sseManager;
}

/* ── Hooks ── */

/**
 * Subscribe to a specific SSE event type.
 * Returns the latest event data of that type.
 */
export function useSSEEvent<T>(eventType: string): T | null {
    const [data, setData] = useState<T | null>(null);

    useEffect(() => {
        const unsub = getSSEManager().subscribe(eventType, (d) => {
            setData(d as T);
        });
        return unsub;
    }, [eventType]);

    return data;
}

/**
 * Subscribe to worker progress events.
 * Accumulates all progress events during a cycle for live display.
 */
export function useWorkerProgress() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [progress, setProgress] = useState<WorkerProgressEvent[]>([]);
    const [totalSheets, setTotalSheets] = useState(0);
    const [allSheetNames, setAllSheetNames] = useState<string[]>([]);
    const [groups, setGroups] = useState<SpreadsheetGroup[]>([]);
    const [lastCycleDone, setLastCycleDone] = useState<WorkerCycleDoneEvent | null>(null);

    useEffect(() => {
        const mgr = getSSEManager();

        // Seed groups from initial status snapshot (on page refresh/reconnect)
        const unsubStatus = mgr.subscribe("status", (d) => {
            const snap = d as {
                worker?: {
                    groups?: SpreadsheetGroup[];
                    isRefreshing?: boolean;
                    progress?: {
                        current?: number;
                        total?: number;
                        currentSheet?: string;
                        completed?: { sheet: string; ok: boolean; rows: number; ms: number }[];
                    } | null;
                };
            };
            if (snap?.worker?.groups?.length) {
                setGroups(snap.worker.groups);
            }
            if (snap?.worker?.isRefreshing) {
                setIsRefreshing(true);
                const total = snap.worker.progress?.total || 0;
                const completed = (snap.worker.progress?.completed || []).map((entry, index) => ({
                    type: "progress" as const,
                    sheet: entry.sheet,
                    ok: entry.ok,
                    rows: entry.rows,
                    ms: entry.ms,
                    current: index + 1,
                    total,
                }));
                setTotalSheets(total);
                setProgress(completed);
            } else {
                setIsRefreshing(false);
            }
        });

        const unsubStart = mgr.subscribe("cycle-start", (d) => {
            const ev = d as WorkerCycleStartEvent;
            setIsRefreshing(true);
            setTotalSheets(ev.totalSheets);
            setAllSheetNames(ev.sheets);
            setGroups(ev.groups);
            setProgress([]);
        });

        const unsubProgress = mgr.subscribe("progress", (d) => {
            const ev = d as WorkerProgressEvent;
            setProgress(prev => [...prev, ev]);
        });

        const unsubDone = mgr.subscribe("sync-complete", (d) => {
            const ev = d as WorkerCycleDoneEvent;
            setIsRefreshing(false);
            setLastCycleDone(ev);
        });

        return () => {
            unsubStatus();
            unsubStart();
            unsubProgress();
            unsubDone();
        };
    }, []);

    return { isRefreshing, progress, totalSheets, allSheetNames, groups, lastCycleDone };
}

/**
 * Subscribe to the initial status snapshot.
 * Also gets countdown timer that ticks locally.
 */
export function useWorkerStatus() {
    const status = useSSEEvent<WorkerStatusSnapshot>("status");
    const [tick, setTick] = useState(0); // forces re-render every second
    const intervalSec = status?.worker.intervalSec ?? 60;
    const isPaused = status?.worker.isPaused ?? false;
    const isRefreshing = status?.worker.isRefreshing ?? false;

    // Tick every second to re-compute countdown
    useEffect(() => {
        const id = setInterval(() => {
            if (!isPaused) {
                setTick(t => t + 1);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [isPaused]);

    // Derive countdown from server timestamp — always in sync
    const countdown = getWorkerCountdown({
        lastRefreshAt: status?.worker.lastRefreshAt ?? null,
        intervalSec,
        isPaused,
        isRefreshing,
        now: Date.now(),
    });

    const pauseReason = (status?.worker.pauseReason ?? null) as WorkerPauseReason;

    return { status, countdown, isPaused, pauseReason };
}

/**
 * Subscribe to sync-complete events.
 * Returns a callback ref that increments on each sync-complete event.
 * Useful for triggering re-fetches in usePageData.
 */
export function useCacheUpdated(): number {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const unsub = getSSEManager().subscribe("sync-complete", () => {
            setVersion(v => v + 1);
        });
        return unsub;
    }, []);

    return version;
}

/**
 * Subscribe ke drift-report dari worker.
 * Returns ringkasan drift terbaru (health score, issues).
 */
export function useWorkerDrift(): DriftSnapshotSummary | null {
    const [drift, setDrift] = useState<DriftSnapshotSummary | null>(null);

    useEffect(() => {
        const mgr = getSSEManager();

        // Ambil dari initial status snapshot
        const unsubStatus = mgr.subscribe("status", (d) => {
            const snap = d as WorkerStatusSnapshot;
            if (snap?.drift) setDrift(snap.drift);
        });

        // Update real-time dari worker
        const unsubDrift = mgr.subscribe("drift-report", (d) => {
            const ev = d as DriftSnapshotSummary;
            setDrift(ev);
        });

        return () => { unsubStatus(); unsubDrift(); };
    }, []);

    return drift;
}
