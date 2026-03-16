"use client";

/**
 * LogPanel — Drizzle Studio-style log viewer for Serverless Hub.
 *
 * NO hardcoded URLs — builds API paths from workerId:
 *   logsUrl  = /api/serverless-hub/{workerId}/logs
 *   streamUrl = /api/serverless-hub/{workerId}/logs/stream
 *
 * Each log entry = subtle card with colored left accent bar.
 * SSE-backed real-time streaming from Cloud Logging.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, RefreshCw, Pause, Play, ChevronDown, ArrowDown } from "lucide-react";

/* ── Types ── */

interface LogEntry {
    timestamp: string;
    level: "info" | "warn" | "error" | "success";
    message: string;
    stage?: string;
    runId?: string | null;
    source?: string;
}

interface LogPanelProps {
    workerId: string;
    workerName: string;
    onClose: () => void;
}

/* ── Helpers ── */

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";

function fmtTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString("en-GB", {
            hour12: false, timeZone: "Asia/Jakarta",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
    } catch { return iso; }
}

function cleanMsg(msg: string): string {
    let m = msg.replace(/^[═─\s]+$/, "").trim();
    if (!m) return msg;
    // Keep [CONFIG] prefix for config audit entries
    if (m.startsWith("[CONFIG]")) return m;
    m = m.replace(/^\[(SYNC|BQ|SHEETS|QC|FS|CONFIG)\]\s*/i, "");
    m = m.replace(/^[✅❌⚠️☁️📦📥📋🔍⏸️🔄📊✓]\s*/u, "").trim();
    return m;
}

function extractDuration(msg: string): string | null {
    // Match: "1m 3s", "3.3s", "500ms"
    const mCompound = msg.match(/\b(\d+m\s*\d+s)\b/);
    if (mCompound) return mCompound[1];
    const m = msg.match(/\b(\d+(?:\.\d+)?)\s*(ms|s|min)\b/);
    if (!m) return null;
    const val = parseFloat(m[1]);
    const unit = m[2];
    if (unit === "ms" && val >= 1000) return `${(val / 1000).toFixed(1)}s`;
    return `${m[1]}${unit}`;
}

function extractRows(msg: string): string | null {
    // Match: "1.6k rows", "31.3k rows", "256 rows", "1.2M rows"
    const m = msg.match(/([\d.]+[kM]?)\s*rows?/i);
    if (!m) return null;
    return `${m[1]} rows`;
}

function extractSize(msg: string): string | null {
    // Match: "9KB", "3.8MB", "357KB", "0.01MB", "45B"
    const m = msg.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)\b/i);
    if (!m) return null;
    const val = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    // Normalize to MB
    const mb = unit === "GB" ? val * 1024 : unit === "MB" ? val : unit === "KB" ? val / 1024 : val / 1048576;
    return `${mb < 0.01 ? "<0.01" : mb.toFixed(2)}MB`;
}

/* ── Accent colors per level ── */

const ACCENT: Record<string, string> = {
    info:    "border-l-muted-foreground/40",
    warn:    "border-l-yellow-500",
    error:   "border-l-red-500",
    success: "border-l-emerald-500",
};

const MSG_COLOR: Record<string, string> = {
    info:    "text-foreground",
    warn:    "text-yellow-600 dark:text-yellow-300",
    error:   "text-red-600 dark:text-red-400",
    success: "text-foreground",
};

/* ── Component ── */

export function LogPanel({ workerId, workerName, onClose }: LogPanelProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const [connected, setConnected] = useState(false);
    const [paused, setPaused] = useState(false);
    const [viewFilter, setViewFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

    const scrollRef = useRef<HTMLDivElement>(null);
    const esRef = useRef<EventSource | null>(null);
    const cursorRef = useRef("");

    // ── URLs from registry pattern — zero hardcoded ──
    const logsUrl = useMemo(
        () => `/api/serverless-hub/${workerId}/logs?limit=200`,
        [workerId]
    );
    const streamUrl = useMemo(
        () => `/api/serverless-hub/${workerId}/logs/stream`,
        [workerId]
    );

    const markConnected = useCallback(() => { setConnected(true); setLoading(false); }, []);

    const appendLog = useCallback((entry: LogEntry) => {
        setLogs(cur => {
            if (cur.some(x => x.timestamp === entry.timestamp && x.message === entry.message && x.source === entry.source)) return cur;
            const next = [...cur, entry];
            next.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return next.slice(0, 200);
        });
        markConnected();
    }, [markConnected]);

    const fetchInitial = useCallback(async () => {
        if (!logsUrl) return;
        try {
            const res = await fetch(logsUrl);
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            const entries = Array.isArray(data) ? data : (data?.logs || []);
            if (Array.isArray(entries) && entries.length) {
                const sorted = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setLogs(sorted);
                cursorRef.current = sorted[0]?.timestamp || "";
            }
            markConnected();
        } catch { setConnected(false); setLoading(false); }
    }, [logsUrl, markConnected]);



    useEffect(() => {
        if (!streamUrl || paused) { esRef.current?.close(); esRef.current = null; return; }
        setLoading(true);
        void fetchInitial().then(() => {
            if (paused) return;
            const url = cursorRef.current ? `${streamUrl}?cursor=${cursorRef.current}` : streamUrl;
            const es = new EventSource(url);
            esRef.current = es;
            es.onopen = () => markConnected();
            es.onmessage = (ev) => {
                try {
                    const p = JSON.parse(ev.data);
                    appendLog({ timestamp: p.timestamp, level: p.level || "info", stage: p.stage, runId: p.runId, message: p.message, source: p.source || "unknown" });
                } catch { /* skip */ }
            };
            es.onerror = () => setConnected(false);
        });
        return () => { esRef.current?.close(); esRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamUrl, paused, workerId]);

    useEffect(() => () => { esRef.current?.close(); }, []);
    useEffect(() => { if (autoScroll && scrollRef.current) scrollRef.current.scrollTop = 0; }, [logs, autoScroll]);


    const onScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    const filtered = useMemo(() => {
        const base = logs.filter(log => {
            // Level filter
            const passLevel = viewFilter === "all"
                || (viewFilter === "error" && (log.level === "error" || log.level === "warn"))
                || (viewFilter === "warn" && log.level === "warn")
                || (viewFilter === "success" && log.level === "success")
                || (viewFilter === "info" && log.level === "info");
            if (viewFilter !== "all" && !passLevel) return false;

            // Source filter
            if (sourceFilter === "all") return true;
            if (sourceFilter === "cf") return log.source === "cloud-function";
            if (sourceFilter === "bq") return (log.stage === "bigquery" || log.message.toLowerCase().includes("bq") || log.message.toLowerCase().includes("bigquery"));
            if (sourceFilter === "fs") return (log.stage === "firestore" || log.message.toLowerCase().includes("firestore"));
            if (sourceFilter === "cs") return log.source === "cloud-scheduler";
            if (sourceFilter === "config") return log.source === "dashboard-config";
            if (sourceFilter === "sync") return (log.stage === "sync" || log.stage === "sheets");
            if (sourceFilter === "qc") return log.stage === "qc";
            return true;
        });

        return base;
    }, [logs, viewFilter, sourceFilter]);

    const refresh = () => {
        esRef.current?.close(); esRef.current = null;
        setLogs([]); setLoading(true); setConnected(false);
        void fetchInitial();
    };

    /* ── Render ── */
    return (
        <div className="flex flex-col h-full bg-background" style={{ fontFamily: MONO }}>

            {/* Header */}
            <div className="flex-none flex items-center justify-between px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <span className="text-[13px] font-semibold text-foreground" style={{ fontFamily: "Inter, sans-serif" }}>{workerName}</span>
                    {connected && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                    {!connected && !loading && <span className="h-2 w-2 rounded-full bg-red-500" />}
                </div>
                <div className="flex items-center gap-1">
                    {!autoScroll && (
                        <HdrBtn onClick={() => { setAutoScroll(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }}>
                            <ArrowDown className="h-3.5 w-3.5" />
                        </HdrBtn>
                    )}
                    <HdrBtn onClick={() => setPaused(!paused)}>
                        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    </HdrBtn>
                    <HdrBtn onClick={refresh}>
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    </HdrBtn>
                    <HdrBtn onClick={onClose}><X className="h-3.5 w-3.5" /></HdrBtn>
                </div>
            </div>

            <div className="flex-none border-b border-border px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                    {filtered.length} entries
                </span>
                <div className="flex items-center gap-1.5">
                    {/* Source filter */}
                    <div className="relative">
                        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                            className="h-[22px] appearance-none rounded border border-border bg-muted px-2 pr-5 text-[10px] text-muted-foreground outline-none cursor-pointer hover:border-foreground/20 transition-colors">
                            <option value="all">All sources</option>
                            <option value="cf">CF</option>
                            <option value="bq">BQ</option>
                            <option value="fs">FS</option>
                            <option value="cs">CS</option>
                            <option value="sync">Sync</option>
                            <option value="qc">QC</option>
                            <option value="config">CONFIG</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1 top-[5px] h-3 w-3 text-muted-foreground/50" />
                    </div>
                    {/* Level filter */}
                    <div className="relative">
                        <select value={viewFilter} onChange={e => setViewFilter(e.target.value)}
                            className="h-[22px] appearance-none rounded border border-border bg-muted px-2 pr-5 text-[10px] text-muted-foreground outline-none cursor-pointer hover:border-foreground/20 transition-colors">
                            <option value="all">All levels</option>
                            <option value="error">Errors</option>
                            <option value="warn">Warnings</option>
                            <option value="success">Success</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1 top-[5px] h-3 w-3 text-muted-foreground/50" />
                    </div>
                </div>
            </div>

            {/* Log entries */}
            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-2 space-y-1">

                {/* Loading animation */}
                {loading && logs.length === 0 && (
                    <div className="px-3 pt-4 space-y-2 text-[11px]">
                        <p className="text-muted-foreground animate-[fadeIn_0.3s_ease-out]">
                            <span className="text-emerald-500">›</span> Establishing SSE connection...
                        </p>
                        <p className="text-muted-foreground animate-[fadeIn_0.3s_ease-out_0.6s_both]">
                            <span className="text-emerald-500">›</span> Authenticating Cloud Logging...
                        </p>
                        <p className="text-muted-foreground animate-[fadeIn_0.3s_ease-out_1.2s_both]">
                            <span className="text-emerald-500">›</span> Fetching recent entries...
                        </p>
                        <p className="text-muted-foreground/60 animate-[fadeIn_0.3s_ease-out_1.8s_both] flex items-center gap-1">
                            <span className="text-yellow-500">›</span> Waiting for log stream
                            <span className="inline-block w-1.5 h-3.5 bg-muted-foreground animate-[blink_1s_step-end_infinite]" />
                        </p>
                    </div>
                )}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                    <div className="flex items-center justify-center h-32">
                        <span className="text-[11px] text-muted-foreground">
                            {logs.length === 0 ? "No log entries yet" : "No entries match filter"}
                        </span>
                    </div>
                )}

                {/* Log cards */}
                {filtered.map((log, i) => {
                    const msg = cleanMsg(log.message);
                    if (/^[═─]{5,}$/.test(msg.trim())) {
                        return <div key={i} className="my-2 border-t border-border/50" />;
                    }

                    const accent = log.level === "error" ? "border-l-red-500"
                        : log.level === "warn" ? "border-l-yellow-500"
                        : log.level === "success" ? "border-l-emerald-500"
                        : log.source === "cloud-function" ? "border-l-blue-400"
                        : log.source === "cloud-scheduler" ? "border-l-violet-400"
                        : log.source === "dashboard-config" ? "border-l-teal-400"
                        : log.source === "thor" ? "border-l-amber-400"
                        : "border-l-muted-foreground/40";
                    const msgColor = MSG_COLOR[log.level] || MSG_COLOR.info;
                    // CONFIG logs: don't extract badges — values like "15min" are config data, not metrics
                    const isConfig = log.source === 'dashboard-config' || msg.startsWith('[CONFIG]');
                    const duration = isConfig ? null : extractDuration(msg);
                    const rows = isConfig ? null : extractRows(msg);
                    const size = isConfig ? null : extractSize(msg);
                    // Strip extracted values from display message to avoid duplication with badges
                    let cleanedMsg = msg;
                    if (rows) cleanedMsg = cleanedMsg.replace(/[\d.]+[kM]?\s*rows?,?\s*/i, '').replace(/,\s*,/g, ',').replace(/:\s*,/, ':').replace(/,\s*$/, '');
                    if (size) cleanedMsg = cleanedMsg.replace(/\d+(?:\.\d+)?\s*(?:KB|MB|GB|B),?\s*/i, '').replace(/,\s*,/g, ',').replace(/,\s*$/, '');
                    if (duration) cleanedMsg = cleanedMsg.replace(/\b(?:in\s+)?\d+m\s*\d+s,?\s*/i, '').replace(/\b(?:in\s+)?\d+(?:\.\d+)?\s*(?:ms|s|min)\b,?\s*/i, '').replace(/,\s*,/g, ',').replace(/,\s*$/, '');
                    // Final cleanup: orphaned trailing words, double spaces, trailing punctuation
                    cleanedMsg = cleanedMsg.replace(/\s+(?:in|to)\s*$/i, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').trim();

                    const cardBg = log.level === "error" ? "bg-red-500/5 border-border"
                        : log.level === "warn" ? "bg-yellow-500/5 border-border"
                        : "bg-muted/30 border-border/60";

                    return (
                        <div key={i}
                            className={`rounded border-l-2 border ${accent} ${cardBg} px-2.5 py-1.5 transition-colors hover:bg-muted/50`}>
                            <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                        {fmtTime(log.timestamp)}
                                    </span>
                                    {log.source === "cloud-function" && (
                                        <span className="text-[9px] px-1 py-px rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">CF</span>
                                    )}
                                    {log.source === "cloud-scheduler" && (
                                        <span className="text-[9px] px-1 py-px rounded bg-violet-500/15 text-violet-600 dark:text-violet-400 font-medium">CS</span>
                                    )}
                                    {log.source === "dashboard-config" && (
                                        <span className="text-[9px] px-1 py-px rounded bg-teal-500/15 text-teal-600 dark:text-teal-400 font-medium">CONFIG</span>
                                    )}
                                    {log.source === "thor" && (
                                        <span className="text-[9px] px-1 py-px rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">TH</span>
                                    )}
                                    {log.stage && !["general", "scheduler", "config"].includes(log.stage) && (() => {
                                        const STAGE_STYLE: Record<string, string> = {
                                            bigquery:  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                                            sync:      "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                                            qc:        "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                                            firestore: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                                            sheets:    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
                                        };
                                        const STAGE_LABEL: Record<string, string> = {
                                            bigquery: "BQ", sync: "Sync", qc: "QC", firestore: "FS", sheets: "Sheets",
                                        };
                                        const style = STAGE_STYLE[log.stage] || "bg-muted text-muted-foreground";
                                        const label = STAGE_LABEL[log.stage] || log.stage;
                                        return (
                                            <span className={`text-[9px] px-1 py-px rounded font-medium ${style}`}>
                                                {label}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="flex items-center gap-1">
                                    {rows && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{rows}</span>
                                    )}
                                    {size && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">{size}</span>
                                    )}
                                    {duration && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                            log.level === "error" ? "bg-red-500/15 text-red-600 dark:text-red-300"
                                            : log.level === "success" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                            : "bg-muted text-muted-foreground"
                                        }`}>{duration}</span>
                                    )}
                                </div>
                            </div>
                            {(() => {
                                const isLong = cleanedMsg.length > 80;
                                const logId = log.timestamp + log.message.substring(0, 30);
                                const isExpanded = expandedLogs.has(logId);
                                const displayMsg = isLong && !isExpanded ? cleanedMsg.substring(0, 77) + "..." : cleanedMsg;
                                return (
                                    <p
                                        className={`text-[11px] leading-relaxed break-words ${msgColor} ${isLong ? "cursor-pointer hover:opacity-80" : ""}`}
                                        onClick={isLong ? () => setExpandedLogs(prev => {
                                            const next = new Set(prev);
                                            next.has(logId) ? next.delete(logId) : next.add(logId);
                                            return next;
                                        }) : undefined}
                                        title={isLong ? (isExpanded ? "Click to collapse" : "Click to expand") : undefined}
                                    >
                                        {displayMsg}
                                        {isLong && !isExpanded && (
                                            <span className="text-[9px] text-blue-400 ml-1">▸</span>
                                        )}
                                    </p>
                                );
                            })()}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="flex-none px-3 py-1.5 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {connected ? (
                        paused
                            ? <><span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />paused</>
                            : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />live</>
                    ) : (
                        <><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />offline</>
                    )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 tabular-nums">

                    <span>
                        {logs.length > 0 ? `${logs.length} logs · ${fmtTime(logs[logs.length - 1].timestamp)}` : "no logs"}
                    </span>
                </div>
            </div>
        </div>
    );
}

function HdrBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {children}
        </button>
    );
}
