"use client";

/**
 * Spreadsheet Sync — Spreadsheet → BigQuery Automated Pipeline
 * Vercel-style flat design — no cards, clean dividers, inline stats
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Play, Pause, RefreshCw,
    FileSpreadsheet, Timer, CloudCog, ToggleLeft, ToggleRight,
    ExternalLink, ChevronDown, ChevronRight, Copy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWorkerStatus } from "@/hooks/useWorkerSSE";

/* ── Types ── */

type CfSpreadsheet = {
    id: string;
    spreadsheetId: string;
    name: string;
    dataset: string;
    syncEnabled: boolean;
    syncMode: string;
    sheetCount: number;
    lastSync: {
        at?: string;
        status?: string;
        sheetsProcessed?: number;
        rowsTotal?: number;
        qcIssues?: number;
        durationMs?: number;
        errors?: string[];
    } | null;
};

type SheetBenchmark = {
    key: string;
    spreadsheetId: string;
    sheetName: string;
    tableName: string;
    fetchMs: number;
    rows: number;
    cols: number;
    sizeBytes: number;
};

/* ── API ── */

const CONTROL_API = "/api/serverless-hub/spreadsheet-sync/control";
const CONFIG_API = "/api/serverless-hub/spreadsheet-sync/config";

async function controlAction(body: Record<string, unknown>) {
    return fetch(CONTROL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

/* ── Format Helpers ── */

function fmtMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function fmtAgo(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
    return `${Math.floor(d / 86400_000)}d ago`;
}

function fmtCountdown(sec: number | null): string {
    if (sec === null || sec <= 0) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtWIB(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-GB", {
        hour12: false, timeZone: "Asia/Jakarta",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}

/* ── Health ── */

type Health = "healthy" | "stale" | "error" | "paused" | "unknown";

function getHealth(cf: Record<string, unknown> | undefined, paused: boolean): Health {
    if (paused) return "paused";
    if (!cf) return "unknown";
    if (cf.lastStatus === "error") return "error";
    if (cf.isStale) return "stale";
    if (cf.lastStatus === "success") return "healthy";
    return "unknown";
}

const HC: Record<Health, { dot: string; text: string; label: string }> = {
    healthy: { dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]", text: "text-emerald-400", label: "Healthy" },
    stale:   { dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]", text: "text-amber-400", label: "Stale" },
    error:   { dot: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]", text: "text-red-400", label: "Error" },
    paused:  { dot: "bg-slate-400", text: "text-slate-400", label: "Paused" },
    unknown: { dot: "bg-slate-600", text: "text-slate-500", label: "Unknown" },
};

/* ═══════════════════════════════════════════════════ */

export default function SpreadsheetSyncPage() {
    const { status } = useWorkerStatus();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf = (status as any)?.cfStatus as Record<string, unknown> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sched = (status as any)?.scheduler as Record<string, unknown> | undefined;
    const spreadsheets = ((cf?.spreadsheets || []) as CfSpreadsheet[]);
    const syncedSheets = (status?.syncSnapshot?.sheets || []) as SheetBenchmark[];

    /* ── State ── */
    const [intervalMin, setIntervalMin] = useState("15");
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [cfInfra, setCfInfra] = useState<Record<string, any> | null>(null);
    const [localPaused, setLocalPaused] = useState<boolean | null>(null);
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

    const isPaused = localPaused !== null ? localPaused : (status?.worker?.isPaused ?? !(sched?.enabled ?? false));
    const health = getHealth(cf, isPaused);
    const hc = HC[health];

    const showFeedback = useCallback((msg: string, ok: boolean) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 3000);
    }, []);

    /* ── Ticker ── */
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

    const countdown = useMemo(() => {
        const nr = sched?.nextRunAt as string | undefined;
        if (!nr || isPaused) return null;
        const ms = new Date(nr).getTime();
        return Number.isNaN(ms) ? null : Math.max(0, Math.floor((ms - now) / 1000));
    }, [sched?.nextRunAt, isPaused, now]);

    /* ── Sync config from SSE ── */
    useEffect(() => {
        if (!sched) return;
        if (!dirty) {
            const sec = sched.intervalSec as number | undefined;
            if (sec) setIntervalMin(String(Math.max(1, Math.round(sec / 60))));
        }
        setLocalPaused(null);
    }, [sched, dirty]);

    /* ── Fetch CF infrastructure (once on mount) ── */
    useEffect(() => {
        controlAction({ action: "status" }).then(r => r.json()).then(d => {
            if (d?.config) {
                const c = d.config as Record<string, unknown>;
                setCfInfra({
                    name: c.cfName, runtime: c.cfRuntime, memory: c.cfMemory,
                    timeout: c.cfTimeout, cpu: c.cfCpu, region: c.cfRegion,
                    generation: c.cfGeneration, revision: c.cfRevision, url: c.cfUrl,
                });
            }
        }).catch(() => {});
    }, []);

    const lastDurationMs = (cf?.lastDurationMs as number) || 0;

    const getBenchmark = useCallback((ssId: string) => {
        return syncedSheets.filter(s => s.key.startsWith(ssId + "::"));
    }, [syncedSheets]);

    /* ── Actions ── */
    const handlePauseResume = useCallback(async () => {
        setSaving(true);
        const willPause = !isPaused;
        try {
            const res = await controlAction({ action: willPause ? "pause" : "resume" });
            const data = await res.json();
            if (data.ok) {
                setLocalPaused(willPause);
                showFeedback(willPause ? "Sync paused" : "Sync resumed", true);
            } else {
                showFeedback(`Failed: ${data.error || "Unknown error"}`, false);
            }
        } catch {
            showFeedback("Network error", false);
        }
        setSaving(false);
    }, [isPaused, showFeedback]);

    const handleTrigger = useCallback(async () => {
        setTriggering(true);
        try {
            const res = await controlAction({ action: "trigger" });
            const data = await res.json();
            if (data.ok && data.triggered) {
                showFeedback(`Sync triggered — HTTP ${data.result?.status || 200}`, true);
            } else {
                showFeedback(`Trigger failed: ${data.error || "Unknown error"}`, false);
            }
        } catch {
            showFeedback("Network error", false);
        }
        setTriggering(false);
    }, [showFeedback]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        const v = Math.max(1, parseInt(intervalMin || "15") || 15);
        try {
            const res = await controlAction({ action: "interval", intervalSec: v * 60 });
            const data = await res.json();
            if (data.ok) {
                showFeedback(`Interval saved: ${v} min`, true);
            } else {
                showFeedback(`Save failed: ${data.error || "Unknown error"}`, false);
            }
        } catch {
            showFeedback("Network error", false);
        }
        setDirty(false);
        setSaving(false);
    }, [intervalMin, showFeedback]);

    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

    const handleToggleSS = useCallback(async (id: string, on: boolean) => {
        setTogglingIds(p => new Set(p).add(id));
        try {
            const res = await fetch(CONFIG_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ _collection: "data_sources", _document: id, syncEnabled: !on }),
            });
            const data = await res.json();
            if (data.ok) {
                showFeedback(`${!on ? "Enabled" : "Disabled"}: ${id}`, true);
            }
        } finally {
            setTogglingIds(p => { const n = new Set(p); n.delete(id); return n; });
        }
    }, [showFeedback]);

    const toggle = useCallback((id: string) => {
        setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }, []);

    /* ── Computed ── */
    const totalSheets = spreadsheets.reduce((s, x) => s + x.sheetCount, 0);
    const totalFetchMs = syncedSheets.reduce((sum, s) => sum + s.fetchMs, 0);

    /* ── Render ── */
    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">

            {/* Feedback Toast */}
            {feedback && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-lg transition-all animate-in slide-in-from-right-5 ${
                    feedback.ok
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                    {feedback.msg}
                </div>
            )}

            {/* ═══════════ Header ═══════════ */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 opacity-20 blur-lg" />
                        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600">
                            <CloudCog className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground">Spreadsheet Sync</h1>
                        <p className="text-xs text-muted-foreground">Sheets → BigQuery · Automated Pipeline</p>
                    </div>
                </div>
                <div className={`flex items-center gap-2 text-xs font-medium ${hc.text}`}>
                    <span className={`h-2 w-2 rounded-full ${hc.dot}`} />
                    {hc.label}
                </div>
            </div>

            {/* ═══════════ Control Bar ═══════════ */}
            <div className="border-y border-border py-4 mb-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button onClick={handlePauseResume} disabled={saving}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                isPaused
                                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                    : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            }`}>
                            {isPaused ? <><Play className="h-3.5 w-3.5" />Resume</> : <><Pause className="h-3.5 w-3.5" />Pause</>}
                        </button>
                        <button onClick={handleTrigger} disabled={triggering}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-50">
                            <RefreshCw className={`h-3.5 w-3.5 ${triggering ? "animate-spin" : ""}`} />
                            {triggering ? "Running..." : "Run Now"}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 bg-border" />

                    {/* Interval */}
                    <div className="flex items-center gap-2">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="text-[11px] text-muted-foreground">Interval</span>
                        <div className="flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-1">
                            <input type="text" inputMode="numeric" value={intervalMin}
                                onFocus={e => e.currentTarget.select()}
                                onChange={e => { setIntervalMin(e.target.value.replace(/[^\d]/g, "") || "1"); setDirty(true); }}
                                className="w-8 bg-transparent text-xs font-mono tabular-nums text-foreground outline-none text-center" />
                            <span className="text-[10px] text-muted-foreground">min</span>
                        </div>
                        {dirty && (
                            <button onClick={handleSave} disabled={saving}
                                className="px-2 py-1 rounded text-[10px] font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors">
                                {saving ? "..." : "Save"}
                            </button>
                        )}
                    </div>


                    {/* Status info — right side */}
                    <div className="ml-auto flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="text-muted-foreground/50">Last Sync</span>
                            <span className="font-mono tabular-nums text-foreground/70">{fmtWIB(cf?.lastRun as string)}</span>
                            <span className="text-muted-foreground/40">({fmtAgo(cf?.lastRun as string)})</span>
                        </span>
                        {lastDurationMs > 0 && (
                            <span className="flex items-center gap-1">
                                <span className="text-muted-foreground/50">Duration</span>
                                <span className="font-mono tabular-nums">{fmtMs(lastDurationMs)}</span>
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <span className="text-muted-foreground/50">Next Sync in</span>
                            <span className="font-mono tabular-nums text-foreground/70">{fmtCountdown(countdown)}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══════════ Stats Row ═══════════ */}
            <div className="flex items-center gap-6 mb-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400/60" />
                    <span className="font-mono tabular-nums text-foreground/80">{spreadsheets.length}</span>
                    <span>sources</span>
                </div>
                <div>
                    <span className="font-mono tabular-nums text-foreground/80">{totalSheets}</span>
                    <span className="ml-1">sheets</span>
                </div>
                {totalFetchMs > 0 && (
                    <div>
                        <span className="font-mono tabular-nums text-foreground/80">{fmtMs(totalFetchMs)}</span>
                        <span className="ml-1">total</span>
                    </div>
                )}
                {/* Infra */}
                {cfInfra && (
                    <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground/50">
                        <span className="font-mono">{cfInfra.name}</span>
                        <span>{cfInfra.runtime} · {cfInfra.memory}</span>
                        <span>{cfInfra.region}</span>
                        {cfInfra.url && (
                            <button onClick={() => navigator.clipboard.writeText(cfInfra.url)}
                                className="inline-flex items-center gap-1 hover:text-foreground transition-colors" title="Copy CF URL">
                                <Copy className="h-3 w-3" /> URL
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════ Spreadsheet Registry ═══════════ */}
            <div className="border-t border-border">
                {spreadsheets.length > 0 ? (
                    spreadsheets.map((ss, idx) => {
                        const isOpen = expanded.has(ss.id);
                        const ls = ss.lastSync;
                        const ok = ls?.status === "success";
                        const bench = getBenchmark(ss.spreadsheetId);
                        const ssTotalSize = bench.reduce((s, b) => s + b.sizeBytes, 0);
                        const ssTotalMs = bench.reduce((s, b) => s + b.fetchMs, 0);

                        return (
                            <div key={ss.id} className={`${idx > 0 ? "border-t border-border/50" : ""} ${!ss.syncEnabled ? "opacity-50" : ""}`}>
                                {/* Row */}
                                <div className="flex items-center gap-3 py-3 px-1 group">
                                    <button onClick={() => toggle(ss.id)} className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors">
                                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </button>

                                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${!ss.syncEnabled ? "bg-slate-500" : ok ? "bg-emerald-400" : ls?.status === "error" ? "bg-red-400" : "bg-slate-600"}`} />

                                    <div className="flex-1 min-w-0">
                                        <span className="text-[13px] font-medium text-foreground">{ss.name}</span>
                                        <span className="text-[10px] text-muted-foreground/40 font-mono ml-2">{ss.dataset}</span>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">
                                        <span>{ss.sheetCount} sheets</span>
                                        {ssTotalMs > 0 && <span className="text-cyan-400/70">{fmtMs(ssTotalMs)}</span>}
                                        {ssTotalSize > 0 && <span className="text-violet-400/70">{(ssTotalSize / 1048576).toFixed(1)}MB</span>}
                                        {ls?.at && <span className="text-muted-foreground/40">{fmtAgo(ls.at)}</span>}
                                        <button onClick={() => handleToggleSS(ss.id, ss.syncEnabled)}
                                            disabled={togglingIds.has(ss.id)}
                                            className={`transition-all ${togglingIds.has(ss.id) ? "opacity-50 animate-pulse" : ""} ${ss.syncEnabled ? "text-emerald-400" : "text-muted-foreground/30"}`}
                                            title={ss.syncEnabled ? "Disable sync" : "Enable sync"}>
                                            {ss.syncEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded */}
                                {isOpen && (
                                    <div className="pb-3 pl-9 pr-1">
                                        {/* Summary stats */}
                                        {ls && (
                                            <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
                                                <span className="font-mono tabular-nums">{(ls.rowsTotal ?? 0).toLocaleString()} rows</span>
                                                <span className="text-border">·</span>
                                                <span className="font-mono tabular-nums">{fmtMs((ls.durationMs && ls.durationMs > 0) ? ls.durationMs : ssTotalMs)}</span>
                                                {(ls.qcIssues ?? 0) > 0 && (
                                                    <>
                                                        <span className="text-border">·</span>
                                                        <span className="font-mono text-amber-400">{ls.qcIssues} QC</span>
                                                    </>
                                                )}
                                                <a href={`https://docs.google.com/spreadsheets/d/${ss.spreadsheetId}`}
                                                    target="_blank" rel="noopener noreferrer"
                                                    className="ml-auto inline-flex items-center gap-1 text-blue-400/70 hover:text-blue-300 transition-colors">
                                                    <ExternalLink className="h-3 w-3" /> Sheets
                                                </a>
                                            </div>
                                        )}
                                        {!ls && <p className="text-[10px] text-muted-foreground/40 italic mb-2">No sync data yet</p>}

                                        {/* Sheet table */}
                                        {bench.length > 0 && (
                                            <div className="space-y-0">
                                                {bench.map(sh => {
                                                    const slow = sh.fetchMs > 2000;
                                                    const sizeMB = sh.sizeBytes > 0 ? (sh.sizeBytes / 1048576).toFixed(2) : null;
                                                    return (
                                                        <div key={sh.key} className="flex items-baseline py-[3px] group/sh">
                                                            <span className="text-[11px] text-foreground/70 w-44 truncate shrink-0">{sh.sheetName}</span>
                                                            <span className="text-[9px] text-muted-foreground/30 font-mono w-40 truncate shrink-0">{sh.tableName}</span>
                                                            <span className="ml-auto flex items-center gap-3 text-[10px] font-mono tabular-nums text-muted-foreground/50">
                                                                {sh.rows > 0 && <span>{sh.rows.toLocaleString()} rows</span>}
                                                                {sh.cols > 0 && <span>{sh.cols} cols</span>}
                                                                {sizeMB && <span>{sizeMB}MB</span>}
                                                                <span className={`w-12 text-right ${slow ? "text-amber-400" : ""}`}>{fmtMs(sh.fetchMs)}</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Errors */}
                                        {ls?.errors && ls.errors.length > 0 && (
                                            <div className="mt-2 text-[9px] text-red-400 space-y-0.5">
                                                {ls.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12 text-muted-foreground/30 text-sm">
                        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>Loading spreadsheet registry...</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground/30 font-mono">
                    {cfInfra?.name || "sheet-bq-sync"} · {cfInfra?.region || "..."} · {cfInfra?.generation || "GEN_2"}
                </p>
            </div>
        </div>
    );
}
