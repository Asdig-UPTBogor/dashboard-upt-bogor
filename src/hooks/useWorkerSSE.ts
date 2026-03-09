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
 *   - "cache-updated" → cycle finished, data is fresh
 *
 * Architecture:
 *   Browser Tab → 1 EventSource → /api/rate-limit (SSE mode)
 *   Multiple components → subscribe to same EventSource via this hook
 *
 * Debug: Open DevTools → Network → filter "rate-limit" → see EventStream tab
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
    type: "cache-updated" | "cycle-done";
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
    cache: {
        totalSheets: number;
        lastRefresh: string | null;
        sheets: { key: string; rows: number; columns: number; age: number; fetchMs: number }[];
    };
    worker: {
        intervalSec: number;
        secondsUntilRefresh: number;
        isRefreshing: boolean;
        lastRefreshAt: string | null;
        progress: {
            current: number;
            total: number;
            currentSheet: string;
            completed: { sheet: string; ok: boolean; rows: number; ms: number }[];
        } | null;
    };
}

/* ── Global SSE Manager (singleton per tab) ── */

type SSEListener = (data: unknown) => void;

class SSEManager {
    private es: EventSource | null = null;
    private listeners = new Map<string, Set<SSEListener>>();
    private lastData = new Map<string, unknown>(); // Replay cache
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
        const eventTypes = ["status", "cycle-start", "progress", "cache-updated", "heartbeat"];
        for (const type of eventTypes) {
            this.es.addEventListener(type, (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    this.lastData.set(type, data); // Cache for replay
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
            const snap = d as { worker?: { groups?: SpreadsheetGroup[] } };
            if (snap?.worker?.groups?.length) {
                setGroups(snap.worker.groups);
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

        const unsubDone = mgr.subscribe("cache-updated", (d) => {
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
    const [lastCycleAt, setLastCycleAt] = useState<number | null>(null);
    const [tick, setTick] = useState(0); // forces re-render every second
    const intervalSec = status?.worker.intervalSec ?? 60;

    // Sync from initial status snapshot
    useEffect(() => {
        if (status?.worker.lastRefreshAt) {
            setLastCycleAt(new Date(status.worker.lastRefreshAt).getTime());
        }
    }, [status]);

    // Update lastCycleAt when cycle finishes (from SSE)
    useEffect(() => {
        const mgr = getSSEManager();
        const unsub = mgr.subscribe("cache-updated", () => {
            setLastCycleAt(Date.now());
        });
        return unsub;
    }, []);

    // Tick every second to re-compute countdown
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    // Derive countdown from server timestamp — always in sync
    const countdown = lastCycleAt !== null
        ? Math.max(0, intervalSec - Math.floor((Date.now() - lastCycleAt) / 1000))
        : null;

    return { status, countdown };
}

/**
 * Subscribe to cache-updated events.
 * Returns a callback ref that increments on each cache update.
 * Useful for triggering re-fetches in usePageData.
 */
export function useCacheUpdated(): number {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const unsub = getSSEManager().subscribe("cache-updated", () => {
            setVersion(v => v + 1);
        });
        return unsub;
    }, []);

    return version;
}
