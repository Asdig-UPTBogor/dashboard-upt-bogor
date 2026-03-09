"use client";

/**
 * Worker Sync — Admin Control Panel
 *
 * Full control over the background prefetch worker:
 * - Real-time status monitoring (SSE)
 * - Pause / Resume / Manual Refresh
 * - Adjustable config (interval, delay)
 * - Benchmark panel with grouped spreadsheets
 * - API Quota monitoring
 */

import { useCallback, useEffect, useState } from "react";
import {
    Activity, Play, Pause, RefreshCw, Settings, Clock, Zap,
    AlertTriangle, CheckCircle2, XCircle, Gauge, Server,
    FileSpreadsheet, Timer, ArrowUpDown, Code, Radio,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkerProgress, useWorkerStatus } from "@/hooks/useWorkerSSE";

/* ── API Helpers ── */
async function workerAction(body: Record<string, unknown>) {
    return fetch("/api/worker-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

/* ═══════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════ */
export default function WorkerSyncPage() {
    const { status, countdown, isPaused, pauseReason } = useWorkerStatus();
    const { isRefreshing, progress, totalSheets, groups } = useWorkerProgress();

    /* ── Config state (editable) ── */
    const [intervalSec, setIntervalSec] = useState(60);
    const [delayMs, setDelayMs] = useState(2000);
    const [configDirty, setConfigDirty] = useState(false);
    const [configSaving, setConfigSaving] = useState(false);

    // Sync from server
    useEffect(() => {
        if (status?.worker.config) {
            const cfg = status.worker.config as { refreshIntervalMs: number; fetchDelayMs: number };
            setIntervalSec(cfg.refreshIntervalMs / 1000);
            setDelayMs(cfg.fetchDelayMs);
            setConfigDirty(false);
        }
    }, [status?.worker.config]);

    const saveConfig = useCallback(async () => {
        setConfigSaving(true);
        await workerAction({
            action: "config",
            refreshIntervalMs: intervalSec * 1000,
            fetchDelayMs: delayMs,
        });
        setConfigDirty(false);
        setConfigSaving(false);
    }, [intervalSec, delayMs]);

    /* ── Derived status ── */
    const isDevMode = pauseReason === "dev";
    const isOverride = pauseReason === "dsm" || pauseReason === "dc";
    const statusColor = isRefreshing ? "text-blue-400" :
        isDevMode ? "text-orange-400" :
            isOverride ? "text-amber-400" :
                isPaused ? "text-yellow-400" :
                    "text-emerald-400";
    const statusLabel = isRefreshing ? "Syncing..." :
        isDevMode ? "Dev Mode" :
            isOverride ? `Override: ${pauseReason?.toUpperCase()} Active` :
                isPaused ? "Paused" :
                    "Auto Sync";
    const statusDot = isRefreshing ? "bg-blue-500 animate-pulse" :
        isDevMode ? "bg-orange-500" :
            isOverride ? "bg-amber-500 animate-pulse" :
                isPaused ? "bg-yellow-500" :
                    "bg-emerald-500";

    /* ── Benchmark data ── */
    const cachedSheets = status?.cache.sheets || [];
    const maxFetchMs = Math.max(...cachedSheets.map(s => s.fetchMs), 1);
    const totalFetchMs = cachedSheets.reduce((sum, s) => sum + s.fetchMs, 0);
    const sheetsPerCycle = status?.sheetsPerCycle ?? totalSheets;
    const quotaLimit = status?.quotaLimit ?? 300;
    const usagePct = sheetsPerCycle > 0 ? Math.round((sheetsPerCycle / quotaLimit) * 100) : 0;

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
                        <p className="text-sm text-muted-foreground">Background Prefetch · Control · Benchmark</p>
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
                        {/* ── Dev / Auto Mode Toggle ── */}
                        <div className="flex rounded-lg border border-border overflow-hidden">
                            <button
                                onClick={() => workerAction({ paused: true, reason: "dev" })}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold transition-all ${isDevMode
                                        ? "bg-orange-500/15 text-orange-400 border-r border-orange-500/30"
                                        : "bg-muted/20 text-muted-foreground hover:bg-muted/40 border-r border-border"
                                    }`}
                            >
                                <Code className="h-3.5 w-3.5" />
                                Dev Mode
                                {isDevMode && <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />}
                            </button>
                            <button
                                onClick={() => workerAction({ paused: false })}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold transition-all ${!isPaused && !isRefreshing
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
                                    }`}
                            >
                                <Radio className="h-3.5 w-3.5" />
                                Auto Sync
                                {!isPaused && !isRefreshing && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                            </button>
                        </div>

                        {/* Pause / Refresh buttons */}
                        <div className="flex gap-2">
                            <Button
                                onClick={() => workerAction({ paused: !isPaused, reason: "manual" })}
                                variant={isPaused ? "default" : "outline"}
                                size="sm"
                                className={isPaused
                                    ? "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                                    : "flex-1 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"}
                            >
                                {isPaused
                                    ? <><Play className="mr-2 h-4 w-4" /> Resume</>
                                    : <><Pause className="mr-2 h-4 w-4" /> Pause</>
                                }
                            </Button>
                            <Button
                                onClick={() => workerAction({ action: "refresh" })}
                                disabled={isRefreshing}
                                variant="outline"
                                size="sm"
                                className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                                {isRefreshing ? "Syncing..." : "Refresh Now"}
                            </Button>
                        </div>

                        {/* Status details */}
                        <div className="space-y-1.5 text-[11px] text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Mode</span>
                                <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Next refresh</span>
                                <span className="font-mono">{isPaused ? "—" : `${countdown ?? "—"}s`}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Last refresh</span>
                                <span className="font-mono">
                                    {status?.worker.lastRefreshAt
                                        ? new Date(status.worker.lastRefreshAt).toLocaleTimeString("id-ID")
                                        : "—"}
                                </span>
                            </div>
                            {pauseReason && (
                                <div className="flex justify-between">
                                    <span>Pause reason</span>
                                    <Badge variant="outline" className="h-4 text-[9px] border-yellow-500/20 text-yellow-400">
                                        {pauseReason}
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
                        {/* Refresh Interval */}
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">
                                Refresh Interval
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                                    <Timer className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <input
                                        type="number"
                                        min={10}
                                        max={600}
                                        value={intervalSec}
                                        onChange={(e) => { setIntervalSec(Number(e.target.value)); setConfigDirty(true); }}
                                        className="w-full bg-transparent text-sm font-mono text-foreground outline-none"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">detik</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">Min 10s · Default 60s</p>
                        </div>

                        {/* Delay Between Groups */}
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">
                                Delay antar Spreadsheet
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <input
                                        type="number"
                                        min={0}
                                        max={10000}
                                        step={500}
                                        value={delayMs}
                                        onChange={(e) => { setDelayMs(Number(e.target.value)); setConfigDirty(true); }}
                                        className="w-full bg-transparent text-sm font-mono text-foreground outline-none"
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">ms</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">Delay antar group spreadsheet · Default 2000ms</p>
                        </div>

                        <Button
                            onClick={saveConfig}
                            disabled={!configDirty || configSaving}
                            size="sm"
                            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40"
                        >
                            {configSaving ? "Saving..." : configDirty ? "💾 Apply Config" : "Config Saved ✓"}
                        </Button>
                    </CardContent>
                </Card>

                {/* ── Card 3: Quota ── */}
                <Card className="border-border bg-muted/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-amber-400" /> API Quota
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-3xl font-bold text-foreground">{sheetsPerCycle}</span>
                            <span className="text-sm text-muted-foreground">/ {quotaLimit} req/min</span>
                        </div>
                        {/* Quota bar */}
                        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${usagePct > 80 ? "bg-red-500" : usagePct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(usagePct, 100)}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {usagePct}% usage · {quotaLimit - sheetsPerCycle} remaining headroom
                        </p>

                        {status?.rateLimited && (
                            <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                                <span className="text-xs text-red-400 font-medium">Rate Limited Detected!</span>
                            </div>
                        )}

                        <div className="space-y-1 text-[11px] text-muted-foreground">
                            <div className="flex justify-between">
                                <span>Sheets per cycle</span>
                                <span className="font-mono">{sheetsPerCycle}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Spreadsheet groups</span>
                                <span className="font-mono">{groups.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total fetch time</span>
                                <span className="font-mono">{(totalFetchMs / 1000).toFixed(1)}s</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══════════ Live Progress (during refresh) ═══════════ */}
            {isRefreshing && progress.length > 0 && (
                <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-400">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Syncing: {progress.length}/{totalSheets} sheets
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-3">
                            <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${(progress.length / totalSheets) * 100}%` }}
                            />
                        </div>
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
                    </CardContent>
                </Card>
            )}

            {/* ═══════════ Benchmark — Grouped by Spreadsheet ═══════════ */}
            <Card className="border-border bg-muted/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Server className="h-4 w-4 text-cyan-400" />
                        Benchmark — {cachedSheets.length} sheets cached
                        {totalFetchMs > 0 && (
                            <Badge variant="outline" className="ml-auto border-border text-muted-foreground text-[10px]">
                                <Clock className="mr-1 h-3 w-3" /> Total: {(totalFetchMs / 1000).toFixed(1)}s
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {groups.length > 0 ? (
                        <div className="space-y-4">
                            {groups.map((group) => {
                                const groupSheets = cachedSheets.filter(s =>
                                    s.key.startsWith(group.spreadsheetId + "::")
                                );
                                return (
                                    <div key={group.spreadsheetId}>
                                        {/* Spreadsheet header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                            <span className="text-sm font-medium text-foreground">{group.label}</span>
                                            <span className="text-[10px] text-muted-foreground/50">{group.sheets.length} sheets</span>
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
                                                            {sheet.rows.toLocaleString()} rows
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
                            <p>Menunggu worker cycle pertama...</p>
                            <p className="text-[10px] mt-1">Benchmark muncul setelah worker selesai fetch data</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Timestamp */}
            <p className="mt-4 text-center text-[11px] text-muted-foreground/40">
                Worker Sync Control Panel · Auto-refreshes via SSE
            </p>
        </div>
    );
}
