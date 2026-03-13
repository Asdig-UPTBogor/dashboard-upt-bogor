"use client";

/**
 * LogPanel — Terminal-style log viewer for worker events.
 *
 * Features:
 * - One initial fetch to seed recent history
 * - Live append from shared worker SSE stream
 * - Dark terminal background with monospace font
 * - Auto-scroll to bottom
 * - Pause/play to pause the live stream
 * - Cloud Run badge showing connection source
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, RefreshCw, Terminal, ArrowDown, Pause, Play, Cloud, ChevronDown } from "lucide-react";
import {
    useSSEEvent,
    type WorkerStatusSnapshot,
    type WorkerCycleDoneEvent,
    type WorkerCycleStartEvent,
    type WorkerProgressEvent,
} from "@/hooks/useWorkerSSE";

/* ── Types ── */
interface LogEntry {
    timestamp: string;
    level: "info" | "warn" | "error" | "success";
    message: string;
    stage?: string;
    runId?: string | null;
    meta?: Record<string, unknown> | null;
    source?: string;
}

interface LogPanelProps {
    workerId: string;
    workerName: string;
    onClose: () => void;
}

/* ── Level colors ── */
const LEVEL_COLORS: Record<string, string> = {
    info: "text-slate-400",
    warn: "text-yellow-300",
    error: "text-red-400",
    success: "text-emerald-400",
};

const LEVEL_ICONS: Record<string, string> = {
    info: "ℹ",
    warn: "⚠",
    error: "✗",
    success: "✓",
};

const STAGE_COLORS: Record<string, string> = {
    summary: "border-slate-500/30 text-slate-300",
    config: "border-violet-500/30 text-violet-300",
    plan: "border-cyan-500/30 text-cyan-300",
    sheets: "border-blue-500/30 text-blue-300",
    qc: "border-amber-500/30 text-amber-300",
    bigquery: "border-emerald-500/30 text-emerald-300",
    firestore: "border-orange-500/30 text-orange-300",
    writeback: "border-red-500/30 text-red-300",
    scheduler: "border-fuchsia-500/30 text-fuchsia-300",
};

const SOURCE_COLORS: Record<string, string> = {
    "dashboard-sync-worker": "border-blue-500/30 text-blue-300",
    "cloud-scheduler": "border-fuchsia-500/30 text-fuchsia-300",
    thor: "border-amber-500/30 text-amber-300",
};

function formatTimestamp(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString("id-ID", {
            hour12: false,
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }) + " WIB";
    } catch {
        return iso;
    }
}

function normalizeRunIdToIso(runId: string): string | null {
    const direct = new Date(runId);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString();

    const slugMatch = runId.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/
    );
    if (!slugMatch) return null;

    const [, year, month, day, hour, minute, second, ms] = slugMatch;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
}

function formatRunId(runId: string): string {
    const iso = normalizeRunIdToIso(runId);
    if (!iso) return runId;

    try {
        const d = new Date(iso);
        const date = d.toLocaleDateString("id-ID", {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        const time = d.toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        return `${date} ${time} WIB`;
    } catch {
        return runId;
    }
}

/* ── Component ── */
export function LogPanel({ workerId, workerName, onClose }: LogPanelProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const [connected, setConnected] = useState(false);
    const [streamPaused, setStreamPaused] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<string>("");
    const [viewFilter, setViewFilter] = useState("all");
    const scrollRef = useRef<HTMLDivElement>(null);
    const thorEventSourceRef = useRef<EventSource | null>(null);
    const thorCursorRef = useRef<string>("");
    const liveCycleStart = useSSEEvent<WorkerCycleStartEvent>("cycle-start");
    const liveProgress = useSSEEvent<WorkerProgressEvent>("progress");
    const liveDone = useSSEEvent<WorkerCycleDoneEvent>("sync-complete");
    const liveStatus = useSSEEvent<WorkerStatusSnapshot>("status");
    const liveLog = useSSEEvent<{
        at: string;
        level?: LogEntry["level"];
        stage?: string;
        runId?: string | null;
        message: string;
        meta?: Record<string, unknown> | null;
    }>("log");
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getLogsUrl = useCallback((): string => {
        switch (workerId) {
            case "spreadsheet-sync":
                return "/api/dashboard-sync/logs";
            case "thor-vaisala":
                return "/api/cron/thor-sync/logs?limit=50";
            default:
                return "";
        }
    }, [workerId]);

    const fetchLogs = useCallback(async () => {
        const url = getLogsUrl();
        if (!url) return;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                const sorted = [...data].sort((a, b) => (
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                ));
                setLogs(sorted);
                if (workerId === "thor-vaisala") {
                    thorCursorRef.current = sorted[sorted.length - 1]?.timestamp || thorCursorRef.current;
                }
                setConnected(true);
                setLastRefresh(new Date().toLocaleTimeString("id-ID", {
                    hour12: false, timeZone: "Asia/Jakarta"
                }));
            }
        } catch {
            setConnected(false);
        }
    }, [getLogsUrl]);

    const appendThorLog = useCallback((entry: LogEntry) => {
        setLogs((current) => {
            const duplicate = current.some((item) =>
                item.timestamp === entry.timestamp &&
                item.level === entry.level &&
                item.message === entry.message &&
                item.source === entry.source
            );
            if (duplicate) return current;

            const next = [...current, entry];
            next.sort((a, b) => (
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            ));
            return next.slice(-200);
        });

        if (!thorCursorRef.current || new Date(entry.timestamp).getTime() >= new Date(thorCursorRef.current).getTime()) {
            thorCursorRef.current = entry.timestamp;
        }

        setConnected(true);
        setLastRefresh(new Date().toLocaleTimeString("id-ID", {
            hour12: false,
            timeZone: "Asia/Jakarta",
        }));
    }, []);

    const scheduleLiveRefresh = useCallback(() => {
        if (workerId !== "spreadsheet-sync" || streamPaused) return;
        if (refreshTimerRef.current) return;
        refreshTimerRef.current = setTimeout(() => {
            refreshTimerRef.current = null;
            void fetchLogs();
        }, 250);
    }, [fetchLogs, streamPaused, workerId]);

    // Seed recent history once on mount. Live updates come from SSE afterwards.
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs, workerId]);

    useEffect(() => {
        if (workerId !== "spreadsheet-sync" || !liveStatus || streamPaused) return;
        const nextLogs = (liveStatus.logTail || []).map((entry) => ({
            timestamp: entry.at,
            level: entry.level || "info",
            stage: entry.stage || "worker",
            runId: entry.runId || null,
            message: entry.message,
            meta: entry.meta || null,
            source: "dashboard-sync-worker",
        }));
        if (nextLogs.length === 0) return;
        nextLogs.sort((a, b) => (
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ));
        setLogs(nextLogs.slice(-200));
        setConnected(true);
        setLastRefresh(new Date().toLocaleTimeString("id-ID", {
            hour12: false,
            timeZone: "Asia/Jakarta",
        }));
    }, [liveStatus, streamPaused, workerId]);

    useEffect(() => {
        if (workerId !== "spreadsheet-sync") return;
        scheduleLiveRefresh();
    }, [liveCycleStart, liveProgress, liveDone, workerId, scheduleLiveRefresh]);

    useEffect(() => {
        if (workerId !== "spreadsheet-sync" || !liveLog || streamPaused) return;

        const normalized: LogEntry = {
            timestamp: liveLog.at,
            level: liveLog.level || "info",
            stage: liveLog.stage,
            runId: liveLog.runId || null,
            message: liveLog.message,
            meta: liveLog.meta || null,
            source: "dashboard-sync-worker",
        };

        setLogs((current) => {
            const next = [...current, normalized];
            next.sort((a, b) => (
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            ));
            return next.slice(-200);
        });
        setConnected(true);
        setLastRefresh(new Date().toLocaleTimeString("id-ID", {
            hour12: false,
            timeZone: "Asia/Jakarta",
        }));
    }, [liveLog, streamPaused, workerId]);

    useEffect(() => {
        if (workerId !== "thor-vaisala" || streamPaused) {
            thorEventSourceRef.current?.close();
            thorEventSourceRef.current = null;
            return;
        }

        const params = new URLSearchParams();
        if (thorCursorRef.current) {
            params.set("cursor", thorCursorRef.current);
        }

        const es = new EventSource(`/api/cron/thor-sync/stream${params.toString() ? `?${params.toString()}` : ""}`);
        thorEventSourceRef.current = es;

        es.onopen = () => {
            setConnected(true);
            setLastRefresh(new Date().toLocaleTimeString("id-ID", {
                hour12: false,
                timeZone: "Asia/Jakarta",
            }));
        };

        es.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data) as {
                    timestamp: string;
                    level?: LogEntry["level"];
                    stage?: string;
                    runId?: string | null;
                    message: string;
                    source?: string;
                };
                appendThorLog({
                    timestamp: payload.timestamp,
                    level: payload.level || "info",
                    stage: payload.stage,
                    runId: payload.runId || null,
                    message: payload.message,
                    source: payload.source || "thor",
                });
            } catch {
                // Ignore malformed SSE chunks and keep stream alive.
            }
        };

        es.onerror = () => {
            setConnected(false);
        };

        return () => {
            es.close();
            if (thorEventSourceRef.current === es) {
                thorEventSourceRef.current = null;
            }
        };
    }, [appendThorLog, streamPaused, workerId]);

    useEffect(() => {
        return () => {
            thorEventSourceRef.current?.close();
            thorEventSourceRef.current = null;
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    const handleRefresh = () => {
        setLogs([]);
        if (workerId !== "spreadsheet-sync") {
            fetchLogs();
        }
    };

    const logsUrl = getLogsUrl();
    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            if (viewFilter === "all") {
                return true;
            }
            if (viewFilter === "worker") {
                return (log.source || "") === "dashboard-sync-worker";
            }
            if (viewFilter === "scheduler") {
                return (log.source || "") === "cloud-scheduler";
            }
            if (viewFilter === "thor") {
                return (log.source || "") === "thor";
            }
            return (log.stage || "") === viewFilter;
        });
    }, [logs, viewFilter]);

    if (!logsUrl) {
        return (
            <div className="flex flex-col h-full bg-card/60 backdrop-blur-sm">
                <div className="flex-none flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-[11px] font-semibold text-foreground/80">{workerName}</span>
                    <button onClick={onClose} className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent transition-colors">
                        <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground/50">
                    Log viewer is not available for this worker
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-card/60 backdrop-blur-sm">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-foreground/80">
                        {workerName}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                        {logs.length} entries
                    </span>
                    {connected && (
                        <span className="flex items-center gap-1">
                            <Cloud className="h-3 w-3 text-blue-400" />
                            <span className="text-[8px] text-blue-400 font-mono">
                                {workerId === "spreadsheet-sync" ? "SYNC" : "CR"}
                            </span>
                        </span>
                    )}
                    {!connected && (
                        <span className="flex h-1.5 w-1.5 rounded-full bg-red-400" title="Disconnected" />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {!autoScroll && (
                        <button
                            onClick={() => {
                                setAutoScroll(true);
                                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent transition-colors"
                            title="Scroll to bottom"
                        >
                            <ArrowDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                    )}
                    <button
                        onClick={() => setStreamPaused(!streamPaused)}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent transition-colors"
                        title={streamPaused ? "Resume log stream" : "Pause log stream"}
                    >
                        {streamPaused
                            ? <Play className="h-3 w-3 text-muted-foreground" />
                            : <Pause className="h-3 w-3 text-muted-foreground" />
                        }
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent transition-colors"
                        title="Refresh logs"
                    >
                        <RefreshCw className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                        onClick={onClose}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent transition-colors"
                        title="Close panel"
                    >
                        <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                </div>
            </div>

            <div className="flex-none border-b border-border px-2 py-1">
                <div className="flex items-center justify-end">
                    <div className="relative">
                        <select
                            value={viewFilter}
                            onChange={(e) => setViewFilter(e.target.value)}
                            className="h-6 min-w-[112px] appearance-none rounded-md border border-white/10 bg-[oklch(0.18_0_0)] pl-2 pr-6 font-mono text-[10px] text-slate-300 outline-none transition-colors hover:border-white/20 hover:bg-[oklch(0.2_0_0)] focus:border-cyan-500/40"
                        >
                            <option value="all">All logs</option>
                            {workerId === "spreadsheet-sync" && (
                                <>
                                    <option value="worker">Worker</option>
                                    <option value="scheduler">Scheduler</option>
                                    <option value="config">Config</option>
                                    <option value="plan">Plan</option>
                                    <option value="sheets">Sheets</option>
                                    <option value="qc">QC</option>
                                    <option value="bigquery">BigQuery</option>
                                    <option value="firestore">Firestore</option>
                                    <option value="summary">Summary</option>
                                </>
                            )}
                            {workerId === "thor-vaisala" && (
                                <option value="thor">Thor</option>
                            )}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 text-slate-500" />
                    </div>
                </div>
            </div>

            {/* Log entries */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed bg-[oklch(0.15_0_0)] dark:bg-[oklch(0.12_0_0)]"
            >
                {filteredLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-600 text-[10px]">
                        {logs.length === 0
                            ? (connected ? "Waiting for log entries..." : "Connecting to worker log stream...")
                            : "No logs match the current filter"}
                    </div>
                ) : (
                    filteredLogs.map((log, i) => (
                        <div
                            key={i}
                            className="py-1.5 hover:bg-white/[0.02] rounded px-2 transition-colors"
                        >
                            <div className="mb-1 flex items-center gap-2">
                                <span className="text-slate-600 shrink-0 tabular-nums">
                                    {formatTimestamp(log.timestamp)}
                                </span>
                                <span className={`shrink-0 ${LEVEL_COLORS[log.level] || "text-slate-500"}`}>
                                    {LEVEL_ICONS[log.level] || "·"}
                                </span>
                            </div>
                            <div className="min-w-0 pl-1">
                                <div className="flex items-start gap-2">
                                    <div className="shrink-0 w-[56px] pt-0.5">
                                        {log.source && workerId === "spreadsheet-sync" && (
                                            <div className={`mb-1 inline-flex rounded border px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-wider ${SOURCE_COLORS[log.source] || "border-slate-500/30 text-slate-300"}`}>
                                                {log.source === "cloud-scheduler" ? "Scheduler" : "Worker"}
                                            </div>
                                        )}
                                        {log.stage && !(log.source === "cloud-scheduler" && log.stage === "scheduler") && (
                                            <div className={`inline-flex rounded border px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-wider ${STAGE_COLORS[log.stage] || "border-slate-500/30 text-slate-300"}`}>
                                                {log.stage.charAt(0).toUpperCase() + log.stage.slice(1)}
                                            </div>
                                        )}
                                    </div>
                                    <span className={`min-w-0 flex-1 text-[11px] break-words ${LEVEL_COLORS[log.level] || "text-slate-300"}`}>
                                        {log.message}
                                    </span>
                                </div>
                                {log.runId && (
                                    <div className="mt-1 text-[9px] text-slate-500" title={log.runId}>
                                        run: {formatRunId(log.runId)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="flex-none px-3 py-1.5 border-t border-border flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                    {connected
                        ? (streamPaused
                            ? "⏸ Log stream paused"
                            : workerId === "thor-vaisala"
                                ? "● Thor CR logs (live SSE)"
                                : "● Sync Worker logs (live SSE)")
                        : "○ Disconnected"}
                </span>
                <span className="text-[9px] text-muted-foreground/40 font-mono">
                    {lastRefresh ? `${filteredLogs.length}/${logs.length} · ${lastRefresh}` : `${filteredLogs.length}/${logs.length}`}
                </span>
            </div>
        </div>
    );
}
