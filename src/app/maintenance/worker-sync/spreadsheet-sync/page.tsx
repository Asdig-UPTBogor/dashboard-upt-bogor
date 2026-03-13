"use client";

/**
 * Worker Sync — Admin Control Panel
 *
 * Full control over the dashboard sync worker:
 * - Real-time status monitoring (SSE)
 * - Pause / Resume / Manual Refresh
 * - Adjustable config (interval, delay)
 * - Benchmark panel with grouped spreadsheets
 * - API Quota monitoring
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity, Play, Pause, RefreshCw, Settings, Clock, Zap,
    AlertTriangle, CheckCircle2, XCircle, Gauge, Server,
    FileSpreadsheet, Timer, Radio,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkerStatus } from "@/hooks/useWorkerSSE";
import {
    getWorkerDetailLabel,
    getWorkerCountdown,
    getWorkerNextSyncLabel,
    getWorkerUiState,
} from "@/lib/worker-sync-ui";

/* ── API Helpers ── */
async function workerAction(body: Record<string, unknown>) {
    return fetch("/api/worker-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function loadWorkerControlState() {
    const response = await fetch("/api/worker-control", {
        cache: "no-store",
    });
    if (!response.ok) {
        throw new Error("Failed to load worker control state");
    }
    return response.json();
}

type SchedulerStatus = {
    enabled: boolean;
    state: string;
    schedule: string;
    intervalSec: number;
    nextRunAt: string | null;
    timeZone: string;
};

/* ═══════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════ */
export default function WorkerSyncPage() {
    const { status } = useWorkerStatus();
    const isRefreshing = status?.worker?.isRefreshing ?? false;
    const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
    const [schedulerLoading, setSchedulerLoading] = useState(true);
    const groups = status?.worker?.groups || [];
    const totalSheets = status?.worker?.phase === "fetching"
        ? status?.worker?.progress?.total || 0
        : status?.syncSnapshot?.totalSheets || 0;
    const progress = useMemo(() => {
        const completed = status?.worker?.progress?.completed || [];
        const total = status?.worker?.phase === "fetching"
            ? status?.worker?.progress?.total || 0
            : completed.length;
        return completed.map((entry, index) => ({
            type: "progress" as const,
            sheet: entry.sheet,
            ok: entry.ok,
            rows: entry.rows,
            ms: entry.ms,
            current: index + 1,
            total,
        }));
    }, [status?.worker?.phase, status?.worker?.progress?.completed, status?.worker?.progress?.total]);
    const runElapsedSec = status?.worker.runStartedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(status.worker.runStartedAt).getTime()) / 1000))
        : null;
    const isAllPagesScope = !status?.worker?.config || !("page" in status.worker.config) || !status.worker.config.page;
    const minIntervalSec = 60;

    /* ── Config state (editable) ── */
    const [intervalMin, setIntervalMin] = useState("1");
    const [delaySec, setDelaySec] = useState("0");
    const [configDirty, setConfigDirty] = useState(false);
    const [configSaving, setConfigSaving] = useState(false);

    const refreshControlState = useCallback(async () => {
        const data = await loadWorkerControlState();
        setScheduler((data?.scheduler || null) as SchedulerStatus | null);
        setSchedulerLoading(false);
        if (data?.worker?.config) {
            const cfg = data.worker.config as { fetchDelayMs?: number };
            setDelaySec(String(Math.max(0, Math.round((cfg.fetchDelayMs || 0) / 1000))));
        }
    }, []);

    useEffect(() => {
        void refreshControlState();
    }, [refreshControlState]);

    useEffect(() => {
        if (status?.worker?.lastRefreshAt) {
            void refreshControlState();
        }
    }, [refreshControlState, status?.worker?.lastRefreshAt]);

    useEffect(() => {
        if (scheduler) {
            setIntervalMin(String(Math.max(1, Math.round(scheduler.intervalSec / 60))));
            setConfigDirty(false);
        }
    }, [scheduler]);

    const normalizeIntegerInput = useCallback((value: string, fallback = "0") => {
        const digitsOnly = value.replace(/[^\d]/g, "");
        if (!digitsOnly) return fallback;
        return String(Number.parseInt(digitsOnly, 10));
    }, []);

    const saveConfig = useCallback(async () => {
        setConfigSaving(true);
        const parsedIntervalMin = Math.max(1, Number.parseInt(intervalMin || "1", 10) || 1);
        const parsedDelaySec = Math.max(0, Number.parseInt(delaySec || "0", 10) || 0);
        await workerAction({
            action: "config",
            refreshIntervalMs: Math.max(parsedIntervalMin * 60, minIntervalSec) * 1000,
            fetchDelayMs: parsedDelaySec * 1000,
        });
        await refreshControlState();
        setConfigDirty(false);
        setConfigSaving(false);
    }, [delaySec, intervalMin, minIntervalSec, refreshControlState]);

    const isPaused = scheduler ? !scheduler.enabled : true;
    const pauseReason = isPaused ? "manual" : null;

    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const schedulerCountdown = useMemo(() => {
        if (!scheduler?.enabled || isRefreshing) {
            return null;
        }
        if (scheduler.nextRunAt) {
            const nextRunMs = new Date(scheduler.nextRunAt).getTime();
            if (!Number.isNaN(nextRunMs)) {
                return Math.max(0, Math.floor((nextRunMs - now) / 1000));
            }
        }
        return getWorkerCountdown({
            lastRefreshAt: status?.worker?.lastRefreshAt || null,
            intervalSec: scheduler.intervalSec,
            isPaused: !scheduler.enabled,
            isRefreshing,
            now,
        });
    }, [scheduler, isRefreshing, now, status?.worker?.lastRefreshAt]);

    /* ── Derived status ── */
    const workerUi = getWorkerUiState({
        isRefreshing,
        isPaused,
        pauseReason,
        phase: status?.worker.phase ?? null,
        progressCurrent: status?.worker?.progress?.current ?? progress.length,
        progressTotal: status?.worker?.progress?.total ?? totalSheets,
    });
    const nextSyncLabel = getWorkerNextSyncLabel({
        countdown: schedulerCountdown,
        isPaused,
        isRefreshing,
    });
    const statusColor = workerUi.textClass;
    const statusLabel = workerUi.label;
    const statusDot = workerUi.dotClass;

    /* ── Benchmark data ── */
    const syncedSheets = status?.syncSnapshot.sheets || [];
    const displayGroups = groups.length > 0
        ? groups
        : (status?.worker.groups || []).length > 0
            ? status?.worker.groups || []
            : (() => {
                const grouped = new Map<string, { spreadsheetId: string; label: string; sheets: string[] }>();
                for (const sheet of syncedSheets) {
                    const [spreadsheetId, sheetName] = sheet.key.includes("::")
                        ? sheet.key.split("::")
                        : [sheet.spreadsheetId || sheet.key, sheet.sheetName || sheet.key];
                    const current = grouped.get(spreadsheetId) || {
                        spreadsheetId,
                        label: sheet.spreadsheetTitle || spreadsheetId,
                        sheets: [],
                    };
                    current.sheets.push(sheet.sheetName || sheetName);
                    grouped.set(spreadsheetId, current);
                }
                return [...grouped.values()];
            })();
    const maxFetchMs = Math.max(...syncedSheets.map(s => s.fetchMs), 1);
    const totalFetchMs = syncedSheets.reduce((sum, s) => sum + s.fetchMs, 0);
    const sheetsInScope = status?.apiQuota?.sheetsInScope ?? status?.sheetsPerCycle ?? totalSheets;
    const apiCallsPerCycle = status?.apiQuota?.callsPerCycle ?? displayGroups.length;
    const quotaLimit = status?.apiQuota?.limitPerMinute ?? status?.quotaLimit ?? 60;
    const usagePct = status?.apiQuota?.usagePercent
        ?? (apiCallsPerCycle > 0 ? Math.round((apiCallsPerCycle / quotaLimit) * 100) : 0);

    return (
        <div className="min-h-screen bg-background p-6 md:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 opacity-25 blur-lg" />
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Worker Sync</h1>
                        <p className="text-sm text-muted-foreground">Sheets Sync · QC · BigQuery Publish</p>
                    </div>
                </div>

                {/* Live Status Badge */}
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${statusColor} border-current/20`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
                        {statusLabel}
                    </div>
                </div>
            </div>

            {/* ═══════════ Control Cards Row ═══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

                {/* ── Card 1: Worker Controls ── */}
                <Card className="border-border bg-muted/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-400" /> Worker Controls
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* ── Auto Sync Toggle ── */}
                        <div className="flex rounded-lg border border-border overflow-hidden">
                            <button
                                onClick={async () => {
                                    setConfigSaving(true);
                                    await workerAction({ paused: false });
                                    await refreshControlState();
                                    setConfigSaving(false);
                                }}
                                disabled={configSaving}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold transition-all ${!isPaused
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
                                    }`}
                            >
                                <Radio className="h-3.5 w-3.5" />
                                Auto Sync
                                {!isPaused && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                            </button>
                        </div>

                        {/* Pause / Refresh buttons */}
                        <div className="flex gap-2">
                            <Button
                                onClick={async () => {
                                    setConfigSaving(true);
                                    await workerAction({ paused: !isPaused, reason: "manual" });
                                    await refreshControlState();
                                    setConfigSaving(false);
                                }}
                                variant={isPaused ? "default" : "outline"}
                                size="sm"
                                disabled={configSaving}
                                className={`flex-1 min-w-0 overflow-hidden ${isPaused
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                    : "border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"}`}
                            >
                                {isPaused
                                    ? <><Play className="h-4 w-4 shrink-0" /><span className="ml-1.5 truncate">Resume</span></>
                                    : <><Pause className="h-4 w-4 shrink-0" /><span className="ml-1.5 truncate">Pause</span></>
                                }
                            </Button>
                            <Button
                                onClick={() => workerAction({ action: "refresh" })}
                                disabled={isRefreshing}
                                variant="outline"
                                size="sm"
                                className="flex-1 min-w-0 overflow-hidden border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
                                <span className="ml-1.5 truncate">{isRefreshing ? "Running..." : "Run Sync Now"}</span>
                            </Button>
                        </div>

                        {/* Status details */}
                        <div className="space-y-1.5 text-[11px] text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Mode</span>
                                <span className="font-medium">
                                    {schedulerLoading ? "Loading..." : isPaused ? "Paused" : "Auto Sync"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Activity</span>
                                <span className={`font-medium ${statusColor}`}>{workerUi.activityLabel || "Idle"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Elapsed</span>
                                <span className="font-mono">{isRefreshing && runElapsedSec !== null ? `${runElapsedSec}s` : "—"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Next sync</span>
                                <span className="font-mono">{nextSyncLabel}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Last run</span>
                                <span className="font-mono tabular-nums">
                                    {status?.worker.lastRefreshAt
                                        ? new Date(status.worker.lastRefreshAt).toLocaleTimeString("en-GB", {
                                                hour12: false,
                                                timeZone: "Asia/Jakarta",
                                            })
                                            : "—"}
                                </span>
                            </div>
                            {scheduler?.schedule && (
                                <div className="flex justify-between">
                                    <span>Schedule</span>
                                    <Badge variant="outline" className="h-4 text-[9px] border-blue-500/20 px-1.5 text-blue-400">
                                        {Math.max(1, Math.round(scheduler.intervalSec / 60))} min
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* ── Card 2: Config ── */}
                <Card className="border-border bg-muted/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Settings className="h-4 w-4 text-violet-400" /> Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Scheduler Interval */}
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">
                                Cloud Scheduler
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                                    <Timer className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={intervalMin}
                                        onFocus={(e) => e.currentTarget.select()}
                                        onChange={(e) => { setIntervalMin(normalizeIntegerInput(e.target.value, "1")); setConfigDirty(true); }}
                                        className="w-full bg-transparent text-sm font-mono tabular-nums text-foreground outline-none"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">min</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">Auto sync interval</p>
                        </div>

                        {/* Spreadsheet Fetch Interval */}
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">
                                Spreadsheet Interval
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={delaySec}
                                        onFocus={(e) => e.currentTarget.select()}
                                        onChange={(e) => { setDelaySec(normalizeIntegerInput(e.target.value, "0")); setConfigDirty(true); }}
                                        className="w-full bg-transparent text-sm font-mono tabular-nums text-foreground outline-none"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">sec</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">Delay between fetch groups</p>
                        </div>

                        <Button
                            onClick={saveConfig}
                            disabled={!configDirty || configSaving}
                            size="sm"
                            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40"
                        >
                            {configSaving ? "Saving..." : configDirty ? "Save" : "Saved"}
                        </Button>
                    </CardContent>
                </Card>

                {/* ── Card 3: Quota ── */}
                <Card className="border-border bg-muted/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-amber-400" /> Sheets API
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-3xl font-bold text-foreground">{apiCallsPerCycle}</span>
                            <span className="text-sm text-muted-foreground">/ {quotaLimit} call/min</span>
                        </div>
                        {/* Quota bar */}
                        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${usagePct > 80 ? "bg-red-500" : usagePct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(usagePct, 100)}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {usagePct}% usage · {Math.max(0, quotaLimit - apiCallsPerCycle)} remaining headroom
                        </p>

                        {(status?.apiQuota?.rateLimited ?? status?.rateLimited) && (
                            <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                                <span className="text-xs text-red-400 font-medium">Rate Limited Detected!</span>
                            </div>
                        )}

                        <div className="space-y-1 text-[11px] text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Sheets per cycle</span>
                                <span className="font-mono">{sheetsInScope}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>API calls per cycle</span>
                                <span className="font-mono">{apiCallsPerCycle}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Spreadsheet groups</span>
                                <span className="font-mono">{displayGroups.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total fetch time</span>
                                <span className="font-mono">{(totalFetchMs / 1000).toFixed(1)}s</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Fetch strategy</span>
                                <span className="font-mono">{status?.apiQuota?.strategy || "batch-per-spreadsheet"}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══════════ Live Progress (during refresh) ═══════════ */}
            {isRefreshing && (
                <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-400">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            {workerUi.activityLabel || "Planning"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-2 flex items-center justify-between text-[11px] text-blue-300/80">
                                <span>{isRefreshing && runElapsedSec !== null ? `Elapsed ${runElapsedSec}s` : "Starting..."}</span>
                                <span className="font-mono">
                                    {status?.worker.phase === "publishing"
                                        ? `${status?.worker.progress?.current || 0}/${status?.worker.progress?.total || 0} page`
                                        : status?.worker.phase === "fetching"
                                            ? `${status?.worker.progress?.current || progress.length}/${status?.worker.progress?.total || totalSheets} sheet`
                                            : status?.worker.phase === "qc"
                                                ? "QC"
                                                : status?.worker.phase === "planning"
                                                    ? "Planning"
                                                    : "—"}
                                </span>
                            </div>
                        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-3">
                            <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                style={{
                                    width: `${status?.worker.phase === "publishing"
                                        ? Math.max(5, (((status?.worker.progress?.current || 0) / Math.max(1, status?.worker.progress?.total || 0)) * 100))
                                        : status?.worker.phase === "fetching"
                                            ? Math.max(5, ((((status?.worker.progress?.current || progress.length) / Math.max(1, status?.worker.progress?.total || totalSheets)) * 100)))
                                            : status?.worker.phase === "qc"
                                                ? 90
                                                : status?.worker.phase === "planning"
                                                    ? 15
                                                    : 5}%`
                                }}
                            />
                        </div>
                        <div className="mb-3 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-100/90">
                            {getWorkerDetailLabel({
                                phase: status?.worker.phase ?? null,
                                currentItemType: status?.worker.progress?.currentItemType ?? null,
                                currentItemLabel:
                                    status?.worker.progress?.currentItemLabel
                                    || status?.worker.progress?.currentSheet
                                    || null,
                            })}
                        </div>
                        {progress.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                                {progress.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                        {p.ok
                                            ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                            : <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                                        }
                                        <span className="truncate text-muted-foreground">{p.sheet}</span>
                                        {p.ok && <span className="text-muted-foreground/50 font-mono">{p.ms}ms</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ═══════════ Benchmark — Grouped by Spreadsheet ═══════════ */}
            <Card className="border-border bg-muted/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Server className="h-4 w-4 text-cyan-400" />
                        Last Sync Benchmark — {syncedSheets.length} sheet
                        {syncedSheets.length !== 1 ? "s" : ""}
                        {totalFetchMs > 0 && (
                            <Badge variant="outline" className="ml-auto border-border text-muted-foreground text-[10px]">
                                <Clock className="mr-1 h-3 w-3" /> Last sync: {(totalFetchMs / 1000).toFixed(1)}s
                            </Badge>
                        )}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                        {status?.worker?.config && "page" in status.worker.config && status.worker.config.page
                            ? `Scope: ${String(status.worker.config.page)}`
                            : "Scope: all pages"}
                    </p>
                </CardHeader>
                <CardContent>
                    {displayGroups.length > 0 ? (
                        <div className="space-y-4">
                            {displayGroups.map((group) => {
                                const groupSheets = syncedSheets.filter(s =>
                                    s.key.startsWith(group.spreadsheetId + "::")
                                );
                                return (
                                    <div key={group.spreadsheetId}>
                                        {/* Spreadsheet header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                            <span className="text-sm font-medium text-foreground">{group.label}</span>
                                            <span className="text-[10px] text-muted-foreground/50">
                                                {group.sheets.length} sheet{group.sheets.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        {/* Sheet bars */}
                                        <div className="space-y-1 ml-6">
                                            {groupSheets.map((sheet) => {
                                                const sheetName = sheet.key.split("::")[1] ?? sheet.key;
                                                const pct = Math.max(5, (sheet.fetchMs / maxFetchMs) * 100);
                                                const barColor = sheet.fetchMs > 2000 ? "bg-red-500" :
                                                    sheet.fetchMs > 1000 ? "bg-amber-500" : "bg-emerald-500";
                                                return (
                                                    <div key={sheet.key} className="flex items-center gap-2">
                                                        <span className="text-[11px] text-muted-foreground w-36 truncate shrink-0">{sheetName}</span>
                                                        <div className="flex-1 h-3 rounded-sm bg-muted/40 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-sm ${barColor} transition-all duration-500`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-mono text-muted-foreground w-14 text-right shrink-0">
                                                            {sheet.fetchMs}ms
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/40 w-16 text-right shrink-0">
                                                            {sheet.rows.toLocaleString()} row{sheet.rows !== 1 ? "s" : ""}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground/50 text-sm">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>Waiting for the first sync run...</p>
                            <p className="text-[10px] mt-1">Benchmark appears after the first fetch finishes.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Timestamp */}
            <p className="mt-4 text-center text-[11px] text-muted-foreground/40">
                Worker Sync Control Panel · Live status from Sync Worker
            </p>
        </div>
    );
}
