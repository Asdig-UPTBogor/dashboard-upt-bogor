"use client";

/**
 * Spreadsheet Sync — Tabbed Service Page
 * Design Standard v2.0 (God Mode)
 *
 * Layout: Header → Status Bar → [Control | Detail | Settings] → Footer
 * Data: 100% onSnapshot (no polling, no bootstrap hack)
 * Fields: scheduler_* and infra_* namespaces
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Play, Pause, RefreshCw,
    FileSpreadsheet, Timer, CloudCog, ToggleLeft, ToggleRight,
    ExternalLink, ChevronDown, ChevronRight, Copy, Check,
    Server, Clock, Layers, Gauge, Activity,
} from "lucide-react";
import { useFirestoreConfig, useFirestoreDataSources } from "../_components/useFirestore";
import { 
    ServiceHeader, ServiceTabs, ServiceStatCard, 
    ServiceSection, ServiceGrid, ServiceToast,
    type HealthStatus 
} from "../_components/service-ui";

/* ── Types ── */

type SheetDetail = {
    rowCount: number;
    columnCount: number;
    sizeBytes: number;
    tableName: string;
    syncMs: number;
    columns?: string[];
    hierarchyLevel?: string;
};

type CfSpreadsheet = {
    id: string;
    spreadsheetId: string;
    name: string;
    dataset: string;
    syncEnabled: boolean;
    syncMode: string;
    sheetCount: number;
    sheets?: Record<string, SheetDetail>;
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

/* ── API ── */

import { CLOUD_CONSOLE_API } from "@/lib/cloud-console-api";

const CONTROL_API = `${CLOUD_CONSOLE_API}/services/spreadsheet-sync/control`;
const CONFIG_API = `${CLOUD_CONSOLE_API}/services/spreadsheet-sync/config`;

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

type Health = HealthStatus;

function getHealth(cf: Record<string, unknown> | undefined, paused: boolean): Health {
    const status = cf?.lastStatus as string | undefined;
    if (status === 'running') return 'running';
    if (paused) return "paused";
    if (!cf) return "unknown";
    if (status === "error") return "error";
    if (status === "success") return "healthy";
    return "unknown";
}

    // The HC map is now inside ServiceHeader, but we still calculate health locally.
    
    /* ── Tab type ── */
    type Tab = "control" | "detail" | "settings";
    
    const TABS = [
        { id: "control", label: "Control", icon: Layers },
        { id: "detail", label: "Detail", icon: Server },
        { id: "settings", label: "Settings", icon: CloudCog },
    ];
    
    /* ═══════════════════════════════════════════════════ */
    
    export default function SpreadsheetSyncPage() {
        /* ── Real-time data via Firestore onSnapshot (Design v2.0) ── */
        const cf = useFirestoreConfig('spreadsheet_sync');
        const rawDataSources = useFirestoreDataSources();
    
    const spreadsheets = useMemo(() => {
        return rawDataSources
            .filter(d => !d.id.startsWith('_'))
            .map(d => ({
                ...d,
                name: d.spreadsheetName || d.name || d.id,
            } as CfSpreadsheet));
    }, [rawDataSources]);

    const [activeTab, setActiveTab] = useState<Tab>("control");

    /* ── Scheduler from scheduler_* fields (Design Standard v2.0 §3C) ── */
    const sched = useMemo(() => {
        if (!cf || !cf.scheduler_state) return undefined;
        return {
            state: cf.scheduler_state as string,
            schedule: (cf.scheduler_schedule || '') as string,
            timezone: (cf.scheduler_timezone || 'Asia/Jakarta') as string,
            nextRunTime: (cf.scheduler_next_run || null) as string | null,
            lastAttempt: (cf.scheduler_last_attempt || null) as string | null,
            jobId: (cf.scheduler_job_id || '') as string,
            targetUrl: (cf.scheduler_target_url || null) as string | null,
            deadline: (cf.scheduler_attempt_deadline || null) as string | null,
            lastStatusCode: cf.scheduler_last_status_code,
        };
    }, [cf]);

    // Parse interval from cron: "*/15 * * * *" → 15
    const intervalFromCron = useMemo(() => {
        if (!sched?.schedule) return 0;
        const m = sched.schedule.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
        return m ? parseInt(m[1], 10) : 0;
    }, [sched?.schedule]);

    /* ── Infra from infra_* fields (Design Standard v2.0 §3D) ── */
    const infra = useMemo(() => {
        if (!cf || (!cf.infra_service_name && !cf.infra_region)) return null;
        return {
            type: cf.infra_type, name: cf.infra_service_name, revision: cf.infra_revision,
            region: cf.infra_region, memory: cf.infra_memory, cpu: cf.infra_cpu,
            timeout: cf.infra_timeout, url: cf.infra_url, runtime: cf.infra_runtime,
            port: cf.infra_port, minInstances: cf.infra_min_instances,
            maxInstances: cf.infra_max_instances, concurrency: cf.infra_concurrency,
            image: cf.infra_image, lastDeploy: cf.infra_last_deploy,
            coldStartAt: cf.infra_cold_start_at, configuration: cf.infra_configuration,
        };
    }, [cf]);

    /* ── UI State ── */
    const [intervalMin, setIntervalMin] = useState("");
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const syncRunning = cf?.lastStatus === 'running';
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [localPaused, setLocalPaused] = useState<boolean | null>(null);
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const isPaused = localPaused !== null ? localPaused : (sched?.state === 'PAUSED' || sched?.state === '2');
    const health = getHealth(cf, isPaused);

    const showFeedback = useCallback((msg: string, ok: boolean) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 3000);
    }, []);

    /* ── Ticker for countdown ── */
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

    const countdown = useMemo(() => {
        const nr = sched?.nextRunTime;
        if (!nr || isPaused) return null;
        let ms = new Date(nr).getTime();
        if (Number.isNaN(ms)) return null;
        // If next_run is in the past, project forward using cron interval
        if (ms <= now && intervalFromCron > 0) {
            const stepMs = intervalFromCron * 60 * 1000;
            while (ms <= now) ms += stepMs;
        }
        return Math.max(0, Math.floor((ms - now) / 1000));
    }, [sched?.nextRunTime, isPaused, now, intervalFromCron]);

    /* ── Sync interval from scheduler_* ── */
    useEffect(() => {
        if (!dirty && intervalFromCron > 0) {
            setIntervalMin(String(intervalFromCron));
        }
    }, [intervalFromCron, dirty]);

    useEffect(() => {
        if (sched) setLocalPaused(null);
    }, [sched]);

    const lastDurationMs = (cf?.lastDurationMs as number) || 0;
    const lastRun = cf?.lastRun as string | undefined;

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
        if (syncRunning) { showFeedback("Sync is already running", false); return; }
        setTriggering(true);
        try {
            const res = await controlAction({ action: "trigger" });
            const data = await res.json();
            if (data.ok && data.success) {
                showFeedback(isPaused ? "Sync triggered (scheduler paused)" : "Sync triggered", true);
            } else {
                showFeedback(`Trigger failed: ${data.error || "Unknown error"}`, false);
            }
        } catch {
            showFeedback("Network error", false);
        }
        setTriggering(false);
    }, [showFeedback, syncRunning, isPaused]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        const v = Math.max(1, parseInt(intervalMin) || 1);
        try {
            const res = await controlAction({ action: "interval", intervalSec: v * 60 });
            const data = await res.json();
            if (!data.ok) {
                showFeedback(`Scheduler update failed: ${data.error || "Unknown error"}`, false);
                setSaving(false);
                return;
            }
            showFeedback(`Interval saved: ${v} min`, true);
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

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    }, []);

    /* ── Computed ── */
    const totalSheets = spreadsheets.reduce((s, x) => s + (x.sheetCount || 0), 0);
    const lastResult = cf?.lastResult as Record<string, number> | undefined;

    /* ── Render ── */
    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">

            {/* Feedback Toast */}
            {feedback && <ServiceToast message={feedback.msg} ok={feedback.ok} />}

            {/* ═══════════ Header ═══════════ */}
            <ServiceHeader
                title="Spreadsheet Sync"
                subtitle="Sheets → BigQuery · Automated Pipeline"
                icon={CloudCog}
                health={health}
            />

            {/* ═══════════ Status Bar (always visible) ═══════════ */}
            <div className="border-y border-border py-3 mb-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    {/* Left: Last sync + Duration + Status */}
                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">Last sync</span>
                        <span className="font-mono tabular-nums text-foreground/70">{fmtWIB(lastRun)}</span>
                        <span className="text-muted-foreground/40">({fmtAgo(lastRun)})</span>
                    </span>
                    {lastDurationMs > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="text-muted-foreground/50">Duration</span>
                            <span className="font-mono tabular-nums">{fmtMs(lastDurationMs)}</span>
                        </span>
                    )}
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        cf?.lastStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                        cf?.lastStatus === 'error' ? 'bg-red-500/10 text-red-400' :
                        cf?.lastStatus === 'running' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-muted text-muted-foreground'
                    }`}>
                        {cf?.lastStatus === 'running' && <RefreshCw className="inline h-3 w-3 mr-1 animate-spin" />}
                        {cf?.lastStatus || '—'}
                    </span>

                    {/* Right: Next sync */}
                    <span className="ml-auto flex items-center gap-1">
                        <span className="text-muted-foreground/50">Next sync</span>
                        {isPaused ? (
                            <span className="text-muted-foreground/40 italic">Paused</span>
                        ) : syncRunning ? (
                            <span className="text-cyan-400/70 flex items-center gap-1">
                                <RefreshCw className="h-3 w-3 animate-spin" />Syncing…
                            </span>
                        ) : countdown !== null && countdown > 0 ? (
                            <span className="font-mono tabular-nums text-foreground/70">
                                {sched?.nextRunTime ? new Date((() => {
                                    let ms = new Date(sched.nextRunTime).getTime();
                                    if (ms <= now && intervalFromCron > 0) {
                                        const step = intervalFromCron * 60 * 1000;
                                        while (ms <= now) ms += step;
                                    }
                                    return ms;
                                })()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : ''}
                                <span className="text-muted-foreground/40 mx-0.5">|</span>
                                <span className="text-muted-foreground/50">{fmtCountdown(countdown)}</span>
                            </span>
                        ) : sched ? (
                            <span className="font-mono tabular-nums text-foreground/50">≤ 1 min</span>
                        ) : (
                            <span className="text-muted-foreground/40">—</span>
                        )}
                    </span>
                </div>
            </div>

            {/* ═══════════ Tab Navigation ═══════════ */}
            <ServiceTabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as Tab)} />

            {/* ═══════════ Tab Content ═══════════ */}

            {/* ─── Control Tab ─── */}
            {activeTab === "control" && (
                <div className="space-y-6">
                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        <div className="flex items-center gap-2">
                            <button onClick={handlePauseResume} disabled={saving || syncRunning}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    isPaused
                                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                        : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                }`}>
                                {isPaused ? <><Play className="h-3.5 w-3.5" />Resume</> : <><Pause className="h-3.5 w-3.5" />Pause</>}
                            </button>
                            <button onClick={handleTrigger} disabled={triggering || syncRunning}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all disabled:opacity-50">
                                <RefreshCw className={`h-3.5 w-3.5 ${triggering || syncRunning ? "animate-spin" : ""}`} />
                                {syncRunning ? "Syncing…" : triggering ? "Triggering…" : "Run Now"}
                            </button>
                        </div>

                        <div className="w-px h-6 bg-border" />

                        {/* Interval */}
                        <div className="flex items-center gap-2">
                            <Timer className="h-3.5 w-3.5 text-muted-foreground/50" />
                            <span className="text-xs text-muted-foreground">Interval</span>
                            <div className="flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-1">
                                <input type="text" inputMode="numeric" value={intervalMin}
                                    onFocus={e => e.currentTarget.select()}
                                    onChange={e => { setIntervalMin(e.target.value.replace(/[^\d]/g, "") || "1"); setDirty(true); }}
                                    className="w-8 bg-transparent text-xs font-mono tabular-nums text-foreground outline-none text-center" />
                                <span className="text-xs text-muted-foreground">min</span>
                            </div>
                            {dirty && (
                                <button onClick={handleSave} disabled={saving}
                                    className="px-2 py-1 rounded text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors">
                                    {saving ? "..." : "Save"}
                                </button>
                            )}
                        </div>

                        {/* Scheduler info */}
                        {sched && (
                            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground/50">
                                <span className="font-mono">{sched.schedule}</span>
                                <span>{sched.timezone}</span>
                            </div>
                        )}
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <ServiceStatCard label="Sources" value={lastResult?.spreadsheets ?? spreadsheets.length} icon={<FileSpreadsheet className="h-4 w-4 text-blue-400/60" />} />
                        <ServiceStatCard label="Sheets" value={lastResult?.sheets ?? totalSheets} icon={<Layers className="h-4 w-4 text-indigo-400/60" />} />
                        <ServiceStatCard label="Rows" value={(lastResult?.rows ?? 0).toLocaleString()} icon={<Server className="h-4 w-4 text-cyan-400/60" />} />
                        <ServiceStatCard label="QC Issues" value={lastResult?.qcIssues ?? 0}
                            icon={<Clock className="h-4 w-4 text-amber-400/60" />}
                            alert={(lastResult?.qcIssues ?? 0) > 0} />
                    </div>

                    {/* API Quota Usage */}
                    {intervalFromCron > 0 && (() => {
                        const sources = lastResult?.spreadsheets ?? spreadsheets.length;
                        const callsPerRun = sources * 2;
                        const runsPerHour = Math.floor(60 / intervalFromCron);
                        const callsPerHour = callsPerRun * runsPerHour;
                        const limitPerHour = 18000;
                        const pct = (callsPerHour / limitPerHour) * 100;
                        return (
                            <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                                <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                                    <Gauge className="h-3.5 w-3.5 text-muted-foreground/50" />
                                    Google Sheets API Quota
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
                                    {[
                                        { label: "API Calls / Run", val: `${callsPerRun} requests`, sub: `${sources} sources × 2 calls` },
                                        { label: "Runs / Hour", val: `${runsPerHour}×`, sub: `every ${intervalFromCron} min` },
                                        { label: "Total Calls / Hour", val: `${callsPerHour} requests` },
                                        { label: "Quota Limit", val: "300 req/min · 18,000 req/hr" },
                                    ].map(({ label, val, sub }) => (
                                        <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30">
                                            <span className="text-xs text-muted-foreground">{label}</span>
                                            <span className="text-xs font-mono tabular-nums text-foreground/80">
                                                {val}
                                                {sub && <span className="text-muted-foreground/40 ml-1.5">({sub})</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                                        <span>Usage</span>
                                        <span className={`font-mono tabular-nums font-medium ${pct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {pct.toFixed(2)}% of limit
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-amber-400' : pct > 50 ? 'bg-blue-400/60' : 'bg-emerald-400/50'}`}
                                            style={{ width: `${Math.max(1, Math.min(100, pct))}%` }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ─── Detail Tab ─── */}
            {activeTab === "detail" && (
                <div className="space-y-8">
                    {/* Infrastructure */}
                    {infra && (
                        <ServiceSection title="Infrastructure" icon={<Server className="h-3.5 w-3.5" />} noCollapse>
                            <ServiceGrid items={[
                                { label: "Service Type", value: infra.type === 'cloud_function' ? 'Cloud Function (Gen 2)' : infra.type },
                                { label: "Service Name", value: infra.name },
                                { label: "Active Revision", value: infra.revision },
                                { label: "Region", value: infra.region },
                                { label: "Memory", value: infra.memory },
                                { label: "CPU", value: infra.cpu || '—' },
                                { label: "Timeout", value: infra.timeout ? `${infra.timeout}s` : undefined },
                                { label: "Port", value: infra.port },
                                { label: "Runtime", value: infra.runtime },
                                { label: "Min Instances", value: infra.minInstances },
                                { label: "Max Instances", value: infra.maxInstances },
                                { label: "Concurrency", value: infra.concurrency },
                                { label: "Last Cold Start", value: infra.coldStartAt ? fmtWIB(infra.coldStartAt) + ` (${fmtAgo(infra.coldStartAt)})` : undefined },
                            ]} copyFields={{
                                "Service URL": infra.url,
                                "Container Image": infra.image,
                            }} copiedField={copiedField} onCopy={copyToClipboard} />
                        </ServiceSection>
                    )}

                    {/* Scheduler */}
                    {sched && (
                        <ServiceSection title="Cloud Scheduler" icon={<Clock className="h-3.5 w-3.5" />} noCollapse>
                            <ServiceGrid items={[
                                { label: "Job ID", value: sched.jobId },
                                { label: "State", value: sched.state, highlight: sched.state === 'PAUSED' ? 'amber' : sched.state === 'ENABLED' ? 'emerald' : undefined },
                                { label: "Cron Schedule", value: sched.schedule },
                                { label: "Timezone", value: sched.timezone },
                                { label: "Next Scheduled Run", value: sched.nextRunTime ? `${fmtWIB(sched.nextRunTime)} (${fmtAgo(sched.nextRunTime)})` : undefined },
                                { label: "Last Attempt", value: sched.lastAttempt ? fmtWIB(sched.lastAttempt) : undefined },
                                { label: "Last Status", value: sched.lastStatusCode === 0 ? 'OK (0)' : sched.lastStatusCode != null ? `Error (code ${sched.lastStatusCode})` : undefined,
                                  highlight: sched.lastStatusCode === 0 ? 'emerald' : sched.lastStatusCode != null ? 'amber' : undefined },
                                { label: "Attempt Deadline", value: sched.deadline },
                            ]} copyFields={{
                                "Target URL": sched.targetUrl,
                            }} copiedField={copiedField} onCopy={copyToClipboard} />
                        </ServiceSection>
                    )}


                    {!infra && !sched && (
                        <div className="text-center py-12 text-muted-foreground/30 text-sm">
                            <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>Waiting for telemetry data...</p>
                            <p className="text-xs mt-1">Data will appear after the worker runs at least once.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Settings Tab ─── */}
            {activeTab === "settings" && (
                <div className="space-y-6">
                    {/* Global toggle */}
                    <div className="flex items-center justify-between py-3 border-b border-border">
                        <div>
                            <div className="text-sm font-medium text-foreground">Global Sync</div>
                            <div className="text-xs text-muted-foreground">Enable or disable all sync operations</div>
                        </div>
                        <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            cf?.globalEnabled
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>
                            {cf?.globalEnabled ? "Enabled" : "Disabled"}
                        </div>
                    </div>

                    {/* Data Sources */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-foreground">Data Sources</h3>
                            <span className="text-xs text-muted-foreground">{spreadsheets.length} registered</span>
                        </div>

                        <div className="border-t border-border">
                            {spreadsheets.length > 0 ? (
                                spreadsheets.map((ss, idx) => {
                                    const isOpen = expanded.has(ss.id);
                                    const ls = ss.lastSync;
                                    const ok = ls?.status === "success";
                                    const sheetEntries = ss.sheets ? Object.entries(ss.sheets) : [];
                                    const ssTotalSize = sheetEntries.reduce((s, [, sh]) => s + (sh.sizeBytes || 0), 0);
                                    const ssTotalMs = sheetEntries.reduce((s, [, sh]) => s + (sh.syncMs || 0), 0);

                                    return (
                                        <div key={ss.id} className={`${idx > 0 ? "border-t border-border/50" : ""} ${!ss.syncEnabled ? "opacity-50" : ""}`}>
                                            <div className="flex items-center gap-3 py-3 px-1 group">
                                                <button onClick={() => toggle(ss.id)} className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors">
                                                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </button>
                                                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${!ss.syncEnabled ? "bg-slate-500" : ok ? "bg-emerald-400" : ls?.status === "error" ? "bg-red-400" : "bg-slate-600"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-medium text-foreground">{ss.name}</span>
                                                    <span className="text-xs text-muted-foreground/40 font-mono ml-2">{ss.dataset}</span>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0 text-xs font-mono tabular-nums text-muted-foreground">
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

                                            {isOpen && (
                                                <div className="pb-3 pl-9 pr-1">
                                                    {ls && (
                                                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
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
                                                    {!ls && <p className="text-xs text-muted-foreground/40 italic mb-2">No sync data yet</p>}

                                                    {sheetEntries.length > 0 && (
                                                        <div className="space-y-0">
                                                            {sheetEntries.map(([sheetName, sh]) => {
                                                                const slow = (sh.syncMs || 0) > 2000;
                                                                const sizeMB = sh.sizeBytes > 0 ? (sh.sizeBytes / 1048576).toFixed(2) : null;
                                                                return (
                                                                    <div key={sheetName} className="flex items-baseline py-[3px]">
                                                                        <span className="text-xs text-foreground/70 w-44 truncate shrink-0">{sheetName}</span>
                                                                        <span className="text-xs text-muted-foreground/30 font-mono w-40 truncate shrink-0">{sh.tableName}</span>
                                                                        <span className="ml-auto flex items-center gap-3 text-xs font-mono tabular-nums text-muted-foreground/50">
                                                                            {sh.rowCount > 0 && <span>{sh.rowCount.toLocaleString()} rows</span>}
                                                                            {sh.columnCount > 0 && <span>{sh.columnCount} cols</span>}
                                                                            {sizeMB && <span>{sizeMB}MB</span>}
                                                                            <span className={`w-12 text-right ${slow ? "text-amber-400" : ""}`}>{fmtMs(sh.syncMs || 0)}</span>
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {ls?.errors && ls.errors.length > 0 && (
                                                        <div className="mt-2 text-xs text-red-400 space-y-0.5">
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
                    </div>
                </div>
            )}

            {/* ═══════════ Footer ═══════════ */}
            <div className="mt-8 pt-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground/30 font-mono">
                    {infra?.name || "—"} · {infra?.region || "—"}{infra?.revision ? ` · rev:${infra.revision.split('-').pop()}` : ""}
                </p>
            </div>
        </div>
    );
}


