"use client";

/**
 * LogPanel — Drizzle Studio-style log viewer with KREDIBEL status indicators.
 *
 * Receives pre-filtered log entries from shared SSE in layout.
 * Each log entry = subtle card with colored left accent bar.
 *
 * Status indicators are driven by `streamStatus` from the layout state machine:
 *   🟢 pulse  "live"            — tailEntries active, data flowing
 *   🟡        "reconnecting…"   — tail error, server auto-retrying
 *   🔴        "stream failed"   — tail failed after max retries
 *   ⚫        "offline"          — SSE disconnected
 *   🟡        "stale Xm"        — tailing but no data for 5+ min
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, RefreshCw, Pause, Play, ChevronDown, ArrowDown } from "lucide-react";
import type { LogEntry, StreamStatus } from "../layout";

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

function fmtAgo(ts: number): string {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 10) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

function cleanMsg(msg: string): string {
    let m = msg.replace(/^[═─\s]+$/, "").trim();
    if (!m) return msg;
    if (m.startsWith("[CONFIG]")) return m;
    m = m.replace(/^\[(SYNC|BQ|SHEETS|QC|FS|CONFIG)\]\s*/i, "");
    m = m.replace(/^[✅❌⚠️☁️📦📥📋🔍⏸️🔄📊✓]\s*/u, "").trim();
    return m;
}

function extractDuration(msg: string): string | null {
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
    const m = msg.match(/([\d.]+[kM]?)\s*rows?/i);
    if (!m) return null;
    return `${m[1]} rows`;
}

function extractSize(msg: string): string | null {
    const m = msg.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)\b/i);
    if (!m) return null;
    const val = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    const mb = unit === "GB" ? val * 1024 : unit === "MB" ? val : unit === "KB" ? val / 1024 : val / 1048576;
    return `${mb < 0.01 ? "<0.01" : mb.toFixed(2)}MB`;
}

/* ── Accent colors per level ── */

const MSG_COLOR: Record<string, string> = {
    info:    "text-foreground",
    warn:    "text-yellow-600 dark:text-yellow-300",
    error:   "text-red-600 dark:text-red-400",
    success: "text-foreground",
    debug:   "text-muted-foreground",
};

/* ── Props ── */

interface Props {
    serviceId: string;
    serviceName: string;
    serviceColor: string;
    entries: LogEntry[];
    streamStatus: StreamStatus;
    isStale: boolean;
    lastDataReceived: number;
    tailRetryInfo: { attempt: number; maxRetries: number } | null;
    loading?: boolean;
    onClose: () => void;
    onRefresh: () => void;
    injectUserAction: (serviceId: string, message: string) => void;
}

/* ── Component ── */

export function LogPanel({
    serviceName,
    entries,
    streamStatus,
    isStale,
    lastDataReceived,
    tailRetryInfo,
    loading: fetchLoading,
    onClose,
    onRefresh,
}: Props) {
    const [autoScroll, setAutoScroll] = useState(true);
    const [paused, setPaused] = useState(false);
    const [viewFilter, setViewFilter] = useState("all");
    const [stageFilter, setStageFilter] = useState("all");
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const [refreshSpin, setRefreshSpin] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    // Auto-update "Xm ago" text
    const [, setTick] = useState(0);

    const isConnected = streamStatus !== "offline" && streamStatus !== "connecting";
    const loading = fetchLoading || (!isConnected && entries.length === 0);

    // ── Tick every 30s to update "ago" text ──
    useEffect(() => {
        const iv = setInterval(() => setTick(t => t + 1), 30_000);
        return () => clearInterval(iv);
    }, []);

    // ── Auto-scroll (newest at top → scroll to top) ──
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [entries, autoScroll]);

    const onScroll = useCallback(() => {
        if (!scrollRef.current) return;
        setAutoScroll(scrollRef.current.scrollTop < 40);
    }, []);

    // ── Refresh handler with spin animation ──
    const handleRefresh = useCallback(() => {
        setRefreshSpin(true);
        onRefresh();
        setTimeout(() => setRefreshSpin(false), 800);
    }, [onRefresh]);

    // ── Unique stages for filter ──
    const stages = useMemo(() => {
        const s = new Set<string>();
        entries.forEach((e) => {
            if (e.stage && !["general", "scheduler", "config", "runtime", "warning"].includes(e.stage)) {
                s.add(e.stage);
            }
        });
        return Array.from(s).sort();
    }, [entries]);

    // ── Stage labels ──
    const STAGE_LABEL: Record<string, string> = {
        bigquery: "BQ", sync: "Sync", qc: "QC", firestore: "FS", sheets: "Sheets",
    };

    // ── Filtered entries ──
    const filtered = useMemo(() => {
        return entries.filter(log => {
            if (paused) return true;
            if (viewFilter !== "all") {
                if (viewFilter === "error" && log.level !== "error") return false;
                if (viewFilter === "warn" && log.level !== "warn") return false;
                if (viewFilter === "success" && log.level !== "success") return false;
                if (viewFilter === "info" && log.level !== "info") return false;
            }
            if (stageFilter !== "all") {
                if (log.stage !== stageFilter) return false;
            }
            return true;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [entries, viewFilter, stageFilter, paused]);

    // ── Status indicator logic (KREDIBEL) ──
    const statusIndicator = useMemo(() => {
        if (paused) {
            return { dot: "bg-yellow-400", text: "paused", pulse: false };
        }

        switch (streamStatus) {
            case "tailing":
                if (isStale) {
                    return { dot: "bg-yellow-400", text: `stale · ${fmtAgo(lastDataReceived)}`, pulse: false };
                }
                return { dot: "bg-emerald-500", text: "live", pulse: true };
            case "backfilling":
                return { dot: "bg-blue-400", text: "connecting…", pulse: true };
            case "connecting":
                return { dot: "bg-blue-400", text: "connecting…", pulse: true };
            case "retrying":
                return {
                    dot: "bg-yellow-500",
                    text: tailRetryInfo
                        ? `reconnecting ${tailRetryInfo.attempt}/${tailRetryInfo.maxRetries}`
                        : "reconnecting…",
                    pulse: false,
                };
            case "failed":
                return { dot: "bg-red-500", text: "stream failed", pulse: false };
            case "offline":
                return { dot: "bg-muted-foreground/40", text: "offline", pulse: false };
            default:
                return { dot: "bg-muted-foreground/40", text: "unknown", pulse: false };
        }
    }, [streamStatus, paused, isStale, lastDataReceived, tailRetryInfo]);

    /* ── Render ── */
    return (
        <div className="flex flex-col h-full bg-background" style={{ fontFamily: MONO }}>

            {/* Header */}
            <div className="flex-none flex items-center justify-between px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>{serviceName}</span>
                    <span className={`h-2 w-2 rounded-full ${statusIndicator.dot}`} />
                </div>
                <div className="flex items-center gap-1">
                    {/* Refresh button (re-fetch backfill) */}
                    <HdrBtn onClick={handleRefresh} title="Refresh logs">
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshSpin ? "animate-spin" : ""}`} />
                    </HdrBtn>
                    {!autoScroll && (
                        <HdrBtn onClick={() => { setAutoScroll(true); scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}>
                            <ArrowDown className="h-3.5 w-3.5 rotate-180" />
                        </HdrBtn>
                    )}
                    <HdrBtn onClick={() => setPaused(!paused)}>
                        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    </HdrBtn>
                    <HdrBtn onClick={onClose}><X className="h-3.5 w-3.5" /></HdrBtn>
                </div>
            </div>

            {/* Filter bar */}
            <div className="flex-none border-b border-border px-3 py-1.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground tabular-nums">
                    {filtered.length} entries
                </span>
                <div className="flex items-center gap-1.5">
                    {/* Stage filter */}
                    {stages.length > 0 && (
                        <div className="relative">
                            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                                className="h-5.5 appearance-none rounded border border-border bg-muted px-2 pr-5 text-xs text-muted-foreground outline-none cursor-pointer hover:border-foreground/20 transition-colors">
                                <option value="all">All stages</option>
                                {stages.map((s) => (
                                    <option key={s} value={s}>{STAGE_LABEL[s] || s}</option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-1 top-1.25 h-3 w-3 text-muted-foreground/50" />
                        </div>
                    )}
                    {/* Level filter */}
                    <div className="relative">
                        <select value={viewFilter} onChange={e => setViewFilter(e.target.value)}
                            className="h-5.5 appearance-none rounded border border-border bg-muted px-2 pr-5 text-xs text-muted-foreground outline-none cursor-pointer hover:border-foreground/20 transition-colors">
                            <option value="all">All levels</option>
                            <option value="error">Errors</option>
                            <option value="warn">Warnings</option>
                            <option value="success">Success</option>
                            <option value="info">Info</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1 top-1.25 h-3 w-3 text-muted-foreground/50" />
                    </div>
                </div>
            </div>

            {/* Log entries */}
            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-2 space-y-1">

                {/* Loading animation */}
                {loading && (
                    <div className="px-3 pt-4 space-y-2 text-xs">
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
                        <span className="text-xs text-muted-foreground">
                            {entries.length === 0 ? "No log entries yet" : "No entries match filter"}
                        </span>
                    </div>
                )}

                {/* Log cards */}
                {filtered.map((log, i) => {
                    const msg = cleanMsg(log.message || `[${log.level}] ${log.stage || ""}`);
                    if (/^[═─]{5,}$/.test(msg.trim())) {
                        return <div key={log.id || i} className="my-2 border-t border-border/50" />;
                    }

                    const accent = log.level === "error" ? "border-l-red-500"
                        : log.level === "warn" ? "border-l-yellow-500"
                        : log.level === "success" ? "border-l-emerald-500"
                        : "border-l-muted-foreground/40";
                    const msgColor = MSG_COLOR[log.level] || MSG_COLOR.info;

                    const isConfig = log.source === 'dashboard-config' || msg.startsWith('[CONFIG]');
                    const duration = isConfig ? null : extractDuration(msg);
                    const rows = isConfig ? null : extractRows(msg);
                    const size = isConfig ? null : extractSize(msg);

                    let cleanedMsg = msg;
                    if (rows) cleanedMsg = cleanedMsg.replace(/[\d.]+[kM]?\s*rows?,?\s*/i, '').replace(/,\s*,/g, ',').replace(/:\s*,/, ':').replace(/,\s*$/, '');
                    if (size) cleanedMsg = cleanedMsg.replace(/\d+(?:\.\d+)?\s*(?:KB|MB|GB|B),?\s*/i, '').replace(/,\s*,/g, ',').replace(/,\s*$/, '');
                    if (duration) cleanedMsg = cleanedMsg.replace(/\b(?:in\s+)?\d+m\s*\d+s,?\s*/i, '').replace(/\b(?:in\s+)?\d+(?:\.\d+)?\s*(?:ms|s|min)\b,?\s*/i, '').replace(/,\s*,/g, ',').replace(/,\s*$/, '');
                    cleanedMsg = cleanedMsg.replace(/\s+(?:in|to)\s*$/i, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').trim();

                    const cardBg = log.level === "error" ? "bg-red-500/5 border-border"
                        : log.level === "warn" ? "bg-yellow-500/5 border-border"
                        : "bg-muted/30 border-border/60";

                    const STAGE_STYLE: Record<string, string> = {
                        bigquery:  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                        sync:      "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                        qc:        "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                        firestore: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        sheets:    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
                    };

                    const logId = log.id || `${log.timestamp}-${i}`;
                    const isExpanded = expandedLogs.has(logId);
                    const toggleExpand = () => setExpandedLogs(prev => {
                        const next = new Set(prev);
                        next.has(logId) ? next.delete(logId) : next.add(logId);
                        return next;
                    });

                    return (
                        <div key={logId}
                            onClick={toggleExpand}
                            className={`rounded border-l-2 border ${accent} ${cardBg} px-2.5 py-1.5 transition-colors hover:bg-muted/50 cursor-pointer select-none`}>
                            <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {fmtTime(log.timestamp)}
                                    </span>
                                    {log.stage && !["general", "scheduler", "config", "runtime", "warning"].includes(log.stage) && (() => {
                                        const style = STAGE_STYLE[log.stage] || "bg-muted text-muted-foreground";
                                        const label = STAGE_LABEL[log.stage] || log.stage;
                                        return (
                                            <span className={`text-xs px-1 py-px rounded font-medium ${style}`}>
                                                {label}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="flex items-center gap-1">
                                    {rows && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{rows}</span>
                                    )}
                                    {size && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">{size}</span>
                                    )}
                                    {duration && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            log.level === "error" ? "bg-red-500/15 text-red-600 dark:text-red-300"
                                            : log.level === "success" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                            : "bg-muted text-muted-foreground"
                                        }`}>{duration}</span>
                                    )}
                                </div>
                            </div>
                            <p className={`text-xs leading-relaxed ${msgColor} ${
                                isExpanded ? "wrap-break-word" : "truncate"
                            }`}>
                                {cleanedMsg}
                                {!isExpanded && cleanedMsg.length > 40 && (
                                    <span className="text-xs text-blue-400 ml-1">▸</span>
                                )}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Footer — KREDIBEL status indicator */}
            <div className="flex-none px-3 py-1.5 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusIndicator.dot}`} />
                    <span>{statusIndicator.text}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 tabular-nums">
                    {lastDataReceived > 0 && (
                        <span className="text-muted-foreground/40">
                            {fmtAgo(lastDataReceived)}
                        </span>
                    )}
                    <span>
                        {entries.length > 0 ? `${entries.length} logs` : "no logs"}
                    </span>
                </div>
            </div>
        </div>
    );
}

function HdrBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
    return (
        <button onClick={onClick} title={title}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {children}
        </button>
    );
}
