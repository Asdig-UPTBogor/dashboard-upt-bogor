"use client";

/**
 * Cloud Console — Spreadsheet Sync V5
 *
 * Pattern: Core+Units + Service Reporter via Firestore real-time.
 *
 * Terminology (human-friendly Bahasa Indonesia):
 *   Spreadsheet  = 1 Google Sheet dokumen (source data)
 *   Lembar       = 1 tab di dalam Spreadsheet
 *   BQ Dataset   = folder di BigQuery
 *   BQ Table     = tabel di BQ (1 Lembar → 1 BQ Table)
 *   Kolom Wajib  = pkColumn (penanda baris valid)
 *   Hirarki      = UPT / ULTG / GI / BAY / FLAT (enrichment level)
 *
 * 5 Tabs: Overview / Spreadsheet / Sync History / Quality / Drift
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    RefreshCw, FileSpreadsheet, Layers, Database, Server, Clock, CloudCog,
    ChevronDown, ChevronRight, ExternalLink, CheckCircle2, XCircle, AlertTriangle,
    AlertCircle, Activity, Gauge, Play, Pause, Zap, Trash2, Plus, Filter,
} from "lucide-react";
import {
    useFirestoreConfig, useFirestoreDataSources,
} from "../_components/useFirestore";
import {
    ServiceHeader, ServiceTabs, ServiceStatCard,
    ServiceSection, ServiceGrid, ServiceToast,
    type HealthStatus,
} from "../_components/service-ui";
import { HierarchyTree1, type HierarchyNode } from "@/components/shared/HierarchyTree1";
import { SyncTimeline1, type SyncEvent } from "@/components/shared/SyncTimeline1";

/* ══════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════ */

type Tab = "overview" | "spreadsheet" | "history" | "quality" | "drift";

const TABS = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "spreadsheet", label: "Spreadsheet", icon: FileSpreadsheet },
    { id: "history", label: "Sync History", icon: Clock },
    { id: "quality", label: "Quality", icon: AlertTriangle },
    { id: "drift", label: "Drift", icon: Zap },
];

interface HealthData {
    summary: {
        total_datasets: number;
        total_rows: number;
        total_valid: number;
        total_rejected: number;
        overall_valid_pct: number;
        excellent: number;
        good: number;
        warning: number;
        critical: number;
    };
    datasets: Array<{
        dataset_name: string;
        row_count_total: number;
        row_count_valid: number;
        row_count_rejected: number;
        valid_pct: number;
        last_sync_status: string;
        last_synced_at: string;
        health_status: "excellent" | "good" | "warning" | "critical";
    }>;
}

interface RejectedRow {
    rejection_key: string;
    spreadsheet_id: string;
    spreadsheet_name: string;
    source_dataset: string;
    source_sheet: string;
    row_number: number;
    column_name: string;
    cell_value: string | null;
    reason_code: string;
    reason_message: string | null;
    last_seen_at: { value: string } | string;
    spreadsheet_url: string;
}

interface DriftAlert {
    level: "high" | "medium" | "low";
    kind: string;
    dataset: string;
    sheet?: string;
    detail: string;
    spreadsheetUrl?: string;
}

type DataSourceSheet = {
    bqTable?: string;
    tabName?: string;
    levelRef?: string | null;
    syncState?: {
        contentHash?: string | null;
        lastSyncAt?: string | null;
        rowCount?: number;
        syncStatus?: string;
        driftEventId?: string | null;
    };
    schema?: {
        columns?: string[];
        skippedColumns?: string[];
    };
};

type DataSource = {
    id: string;
    identity?: {
        name?: string;
        url?: string;
        driveId?: string;
        isMasterHierarchy?: boolean;
    };
    syncControl?: {
        enabled?: boolean;
        status?: string;
        lastDriveModified?: string | null;
        lastSyncAt?: string | null;
    };
    sheets?: Record<string, DataSourceSheet>;
    audit?: {
        createdAt?: string;
        updatedAt?: string;
    };
};

type ServiceConfig = {
    infra_type?: string;
    infra_service_name?: string;
    infra_region?: string;
    infra_runtime?: string;
    infra_url?: string;
    infra_entry_point?: string;
    infra_memory?: string;
    infra_timeout?: string;
    infra_revision?: string;
    infra_cold_start_at?: string;
    scheduler_job_id?: string;
    scheduler_state?: string;
    scheduler_schedule?: string;
    scheduler_timezone?: string;
    scheduler_target_url?: string;
    scheduler_next_run?: string;
    scheduler_last_attempt?: string;
    scheduler_last_status_code?: number | null;
    scheduler_attempt_deadline?: string;
    lastStatus?: "running" | "success" | "error";
    lastAction?: string;
    lastRun?: string;
    lastStartedAt?: string;
    lastDurationMs?: number;
    lastResult?: Record<string, any>;
    lastError?: string;
};

/* ══════════════════════════════════════════════════════
   FORMAT HELPERS
   ══════════════════════════════════════════════════════ */

function fmtNum(n: number | undefined | null): string {
    if (n === undefined || n === null) return "—";
    return Number(n).toLocaleString("id-ID");
}

function fmtMs(ms: number | undefined): string {
    if (ms === undefined || ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function fmtAgo(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = Date.now() - new Date(iso).getTime();
    if (d < 0) return "—";
    if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
    return `${Math.floor(d / 86400_000)}d ago`;
}

function fmtWIB(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour12: false,
            day: "2-digit", month: "short",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return String(iso);
    }
}

function cronToHuman(cron: string | undefined): string {
    if (!cron) return "—";
    const m = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (m) return `setiap ${m[1]} menit`;
    return cron;
}

function getHealth(cfg: ServiceConfig | null, health: HealthData | null): HealthStatus {
    if (cfg?.lastStatus === "running") return "running";
    if (cfg?.lastStatus === "error") return "error";
    if (!health) return "unknown";
    const s = health.summary;
    if (s.critical > 0) return "error";
    if (s.warning > 0) return "paused";
    if (s.excellent + s.good === s.total_datasets && s.total_datasets > 0) return "healthy";
    return "unknown";
}

const CONTROL_API = "/api/console/services/spreadsheet-sync/control";

async function controlAction(body: Record<string, unknown>) {
    const r = await fetch(CONTROL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return r.json();
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════ */

export default function SpreadsheetSyncV5Page() {
    const cfg = useFirestoreConfig<ServiceConfig>("spreadsheet_sync_v5");
    const rawDataSources = useFirestoreDataSources();

    const dataSources = useMemo(() => {
        return (rawDataSources as DataSource[])
            .sort((a, b) =>
                (a.identity?.name || a.id).localeCompare(b.identity?.name || b.id)
            );
    }, [rawDataSources]);

    const [tab, setTab] = useState<Tab>("overview");
    const [health, setHealth] = useState<HealthData | null>(null);
    const [tree, setTree] = useState<HierarchyNode[] | null>(null);
    const [rejected, setRejected] = useState<RejectedRow[] | null>(null);
    const [history, setHistory] = useState<SyncEvent[] | null>(null);
    const [drift, setDrift] = useState<DriftAlert[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [busyActions, setBusyActions] = useState<Set<string>>(new Set());

    const showFeedback = useCallback((msg: string, ok: boolean) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 3000);
    }, []);

    const setBusy = useCallback((key: string, busy: boolean) => {
        setBusyActions((p) => {
            const n = new Set(p);
            if (busy) n.add(key);
            else n.delete(key);
            return n;
        });
    }, []);

    const loadAll = useCallback(async () => {
        const [h, t, r, hist, d] = await Promise.all([
            fetch("/api/data-sources/ss-v5/health").then((r) => r.json()).catch(() => null),
            fetch("/api/data-sources/ss-v5/hierarchy-tree").then((r) => r.json()).catch(() => null),
            fetch("/api/data-sources/ss-v5/rejected-rows?status=active&limit=500")
                .then((r) => r.json()).catch(() => ({ rows: [] })),
            fetch("/api/data-sources/ss-v5/sync-history?hours=24&limit=100")
                .then((r) => r.json()).catch(() => ({ history: [] })),
            fetch("/api/data-sources/ss-v5/drift").then((r) => r.json()).catch(() => ({ alerts: [] })),
        ]);
        setHealth(h);
        setTree(t?.tree ?? null);
        setRejected(r?.rows ?? []);
        setHistory(hist?.history ?? []);
        setDrift(d?.alerts ?? []);
    }, []);

    useEffect(() => {
        setLoading(true);
        loadAll().finally(() => setLoading(false));
    }, [loadAll]);

    /* ── Global control ── */
    const handleGlobalPauseResume = useCallback(async () => {
        const isPaused = cfg?.scheduler_state === "PAUSED";
        setBusy("global-pause", true);
        try {
            const d = await controlAction({ action: isPaused ? "resume" : "pause" });
            if (d.ok) {
                showFeedback(isPaused ? "Scheduler di-resume" : "Scheduler di-pause", true);
            } else {
                showFeedback(`Gagal: ${d.error}`, false);
            }
        } finally {
            setBusy("global-pause", false);
        }
    }, [cfg?.scheduler_state, showFeedback, setBusy]);

    const handleGlobalTrigger = useCallback(async () => {
        setBusy("global-trigger", true);
        try {
            const d = await controlAction({ action: "trigger" });
            if (d.ok) {
                showFeedback("Sync full-cycle triggered — running", true);
                setTimeout(() => loadAll(), 20_000);
            } else {
                showFeedback(`Gagal: ${d.error}`, false);
            }
        } finally {
            setBusy("global-trigger", false);
        }
    }, [showFeedback, setBusy, loadAll]);

    /* ── Per-dataset control ── */
    const handleDatasetAction = useCallback(
        async (dataset: string, action: "pause" | "resume" | "trigger" | "delete") => {
            const key = `${dataset}-${action}`;
            setBusy(key, true);
            try {
                const payload: any = { action, dataset };
                if (action === "delete") {
                    if (!window.confirm(`Hapus data source "${dataset}"? Ini akan drop BQ table + _internal.ext_*.`)) {
                        setBusy(key, false);
                        return;
                    }
                    payload.confirm = true;
                }
                const d = await controlAction(payload);
                if (d.ok) {
                    showFeedback(
                        action === "trigger"
                            ? `Sync "${dataset}" running`
                            : action === "delete"
                            ? `"${dataset}" dihapus`
                            : action === "pause"
                            ? `"${dataset}" di-pause`
                            : `"${dataset}" di-resume`,
                        true
                    );
                    if (action === "trigger") setTimeout(() => loadAll(), 15_000);
                } else {
                    showFeedback(`Gagal: ${d.error}`, false);
                }
            } finally {
                setBusy(key, false);
            }
        },
        [showFeedback, setBusy, loadAll]
    );

    const toggle = useCallback((id: string) => {
        setExpanded((p) => {
            const n = new Set(p);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }, []);

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    }, []);

    const healthByDataset = useMemo(() => {
        const map: Record<string, HealthData["datasets"][number]> = {};
        if (health) for (const d of health.datasets) map[d.dataset_name] = d;
        return map;
    }, [health]);

    const lastSyncIso = useMemo(() => {
        if (cfg?.lastRun) return cfg.lastRun;
        if (!health) return null;
        let max = 0;
        for (const d of health.datasets) {
            const ms = d.last_synced_at ? new Date(d.last_synced_at).getTime() : 0;
            if (ms > max) max = ms;
        }
        return max > 0 ? new Date(max).toISOString() : null;
    }, [cfg?.lastRun, health]);

    const healthStatus = getHealth(cfg, health);
    const isRunning = cfg?.lastStatus === "running";
    const isPaused = cfg?.scheduler_state === "PAUSED";

    /* ══════════════════════════════════════════════════
       RENDER
       ══════════════════════════════════════════════════ */

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">
            {feedback && <ServiceToast message={feedback.msg} ok={feedback.ok} />}

            <ServiceHeader
                title="Spreadsheet Sync"
                subtitle="Google Sheets → BigQuery · Platform V5 (Core + Units)"
                icon={CloudCog}
                health={healthStatus}
            />

            {/* ═══════════ Status Bar ═══════════ */}
            <div className="border-y border-border py-3 mb-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="flex items-center gap-1.5">
                        <span className="ds-small opacity-80">Sync terakhir</span>
                        <span className="ds-data text-foreground/70">
                            {fmtWIB(lastSyncIso)}
                        </span>
                        <span className="ds-small opacity-60">({fmtAgo(lastSyncIso)})</span>
                    </span>

                    {cfg?.lastDurationMs != null && (
                        <span className="flex items-center gap-1.5">
                            <span className="ds-small opacity-80">Durasi</span>
                            <span className="ds-data">{fmtMs(cfg.lastDurationMs)}</span>
                        </span>
                    )}

                    <span
                        className={`ds-label px-1.5 py-0.5 rounded ${
                            cfg?.lastStatus === "success"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : cfg?.lastStatus === "error"
                                ? "bg-red-500/10 text-red-400"
                                : cfg?.lastStatus === "running"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                    >
                        {isRunning && <RefreshCw className="inline h-3 w-3 mr-1 animate-spin" />}
                        {cfg?.lastStatus || "—"}
                    </span>

                    {health && (
                        <span className="flex items-center gap-1.5">
                            <span className="ds-small opacity-80">Data valid</span>
                            <span className="ds-data text-emerald-400">
                                {health.summary.overall_valid_pct}%
                            </span>
                            <span className="ds-small opacity-60">
                                ({fmtNum(health.summary.total_valid)} / {fmtNum(health.summary.total_rows)})
                            </span>
                        </span>
                    )}

                    <span className="ml-auto flex items-center gap-1.5">
                        <span className="ds-small opacity-80">Scheduler</span>
                        <span
                            className={`ds-data ${
                                isPaused ? "text-amber-400" : "text-foreground/70"
                            }`}
                        >
                            {isPaused ? "PAUSED" : cronToHuman(cfg?.scheduler_schedule)}
                        </span>
                        {!isPaused && cfg?.scheduler_next_run && (
                            <>
                                <span className="ds-small opacity-60">·</span>
                                <span className="ds-small opacity-80">
                                    next {fmtWIB(cfg.scheduler_next_run)}
                                </span>
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* ═══════════ Global Action Bar ═══════════ */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                <button
                    type="button"
                    onClick={handleGlobalPauseResume}
                    disabled={busyActions.has("global-pause") || isRunning}
                    className={`ds-label ds-transition cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md disabled:opacity-50 ${
                        isPaused
                            ? "bg-emerald-600/80 text-white hover:bg-emerald-600"
                            : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    }`}
                >
                    {isPaused ? (
                        <>
                            <Play className="h-3.5 w-3.5" />
                            Resume Scheduler
                        </>
                    ) : (
                        <>
                            <Pause className="h-3.5 w-3.5" />
                            Pause Scheduler
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={handleGlobalTrigger}
                    disabled={busyActions.has("global-trigger") || isRunning}
                    className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
                >
                    <RefreshCw
                        className={`h-3.5 w-3.5 ${isRunning || busyActions.has("global-trigger") ? "animate-spin" : ""}`}
                    />
                    {isRunning ? "Sedang sync…" : "Jalankan Full Cycle"}
                </button>

                <button
                    type="button"
                    onClick={loadAll}
                    className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                </button>

                <a
                    href="/maintenance/add-spreadsheet"
                    className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Spreadsheet
                </a>

                <span className="ml-auto ds-small opacity-80">
                    {dataSources.length} Spreadsheet · {health?.summary.total_datasets ?? "—"} BQ Dataset
                </span>
            </div>

            <ServiceTabs tabs={TABS} activeTab={tab} onChange={(id) => setTab(id as Tab)} />

            {loading && (
                <div className="flex h-64 items-center justify-center ds-body">
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Memuat…
                </div>
            )}

            {!loading && tab === "overview" && <OverviewTab health={health} tree={tree} cfg={cfg} />}

            {!loading && tab === "spreadsheet" && (
                <SpreadsheetTab
                    dataSources={dataSources}
                    healthByDataset={healthByDataset}
                    expanded={expanded}
                    onToggle={toggle}
                    busy={busyActions}
                    onAction={handleDatasetAction}
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                    cfg={cfg}
                />
            )}

            {!loading && tab === "history" && <HistoryTab events={history ?? []} />}

            {!loading && tab === "quality" && <QualityTab rejected={rejected ?? []} />}

            {!loading && tab === "drift" && <DriftTab alerts={drift ?? []} />}

            <div className="mt-8 pt-4 border-t border-border/30">
                <p className="ds-small opacity-60 font-mono">
                    {cfg?.infra_service_name || "ss-sync"} · {cfg?.infra_region || "asia-southeast2"}
                    {cfg?.infra_revision ? ` · rev:${cfg.infra_revision.split("-").pop()}` : ""}
                </p>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════
   OVERVIEW TAB
   ══════════════════════════════════════════════════════ */

function OverviewTab({
    health, tree, cfg,
}: {
    health: HealthData | null;
    tree: HierarchyNode[] | null;
    cfg: ServiceConfig | null;
}) {
    if (!health) {
        return (
            <div className="text-center py-12 ds-body opacity-60">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Data ringkasan tidak tersedia.
            </div>
        );
    }

    const s = health.summary;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ServiceStatCard
                    label="BQ Datasets"
                    value={fmtNum(s.total_datasets)}
                    icon={<Database className="h-4 w-4 text-blue-400/60" />}
                />
                <ServiceStatCard
                    label="Total Baris"
                    value={fmtNum(s.total_rows)}
                    icon={<Layers className="h-4 w-4 text-indigo-400/60" />}
                />
                <ServiceStatCard
                    label="Baris Valid"
                    value={fmtNum(s.total_valid)}
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-400/60" />}
                />
                <ServiceStatCard
                    label="Rejected"
                    value={fmtNum(s.total_rejected)}
                    icon={<XCircle className="h-4 w-4 text-amber-400/60" />}
                    alert={s.total_rejected > 0}
                />
            </div>

            <ServiceSection
                title="Distribusi Kualitas Data"
                icon={<Gauge className="h-3.5 w-3.5" />}
                noCollapse
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                        { key: "excellent", label: "Excellent", count: s.excellent, color: "text-emerald-400" },
                        { key: "good", label: "Good", count: s.good, color: "text-blue-400" },
                        { key: "warning", label: "Warning", count: s.warning, color: "text-amber-400" },
                        { key: "critical", label: "Critical", count: s.critical, color: "text-red-400" },
                    ].map((h) => (
                        <div
                            key={h.key}
                            className="flex items-center justify-between rounded border border-border/30 bg-muted/10 px-3 py-2"
                        >
                            <span className="ds-small uppercase tracking-wide">
                                {h.label}
                            </span>
                            <span className={`ds-data ${h.color}`}>
                                {h.count}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="ds-small">Tingkat Validitas Keseluruhan</span>
                        <span
                            className={`ds-data ${
                                s.overall_valid_pct >= 95
                                    ? "text-emerald-400"
                                    : s.overall_valid_pct >= 80
                                    ? "text-amber-400"
                                    : "text-red-400"
                            }`}
                        >
                            {s.overall_valid_pct}%
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                s.overall_valid_pct >= 95
                                    ? "bg-emerald-400/60"
                                    : s.overall_valid_pct >= 80
                                    ? "bg-amber-400/60"
                                    : "bg-red-400/60"
                            }`}
                            style={{ width: `${Math.max(1, Math.min(100, s.overall_valid_pct))}%` }}
                        />
                    </div>
                </div>
            </ServiceSection>

            <ServiceSection
                title="Hirarki Master — UPT → ULTG → GI"
                icon={<Layers className="h-3.5 w-3.5" />}
                noCollapse
            >
                <p className="ds-small opacity-80 mb-3">
                    Sumber kebenaran dari <code className="font-mono">ss_platform.dim_*</code> —
                    dipakai semua Spreadsheet untuk enrichment FK.
                </p>
                {tree ? (
                    <HierarchyTree1 data={tree} expandedByDefault="first-level" variant="full" />
                ) : (
                    <div className="text-center py-8 ds-body opacity-60">
                        Tree tidak tersedia
                    </div>
                )}
            </ServiceSection>

            {cfg && (
                <ServiceSection
                    title="Info Platform"
                    icon={<Server className="h-3.5 w-3.5" />}
                    noCollapse
                >
                    <ServiceGrid
                        items={[
                            { label: "Service", value: cfg.infra_service_name },
                            { label: "Region", value: cfg.infra_region },
                            { label: "Runtime", value: cfg.infra_runtime },
                            { label: "Revision", value: cfg.infra_revision },
                            { label: "Scheduler Job", value: cfg.scheduler_job_id },
                            { label: "Scheduler Cron", value: cfg.scheduler_schedule },
                            {
                                label: "Status Scheduler",
                                value: cfg.scheduler_state,
                                highlight: cfg.scheduler_state === "ENABLED" ? "emerald" : "amber",
                            },
                            {
                                label: "Sync Berikutnya",
                                value: cfg.scheduler_next_run
                                    ? `${fmtWIB(cfg.scheduler_next_run)} (${fmtAgo(cfg.scheduler_next_run)})`
                                    : undefined,
                            },
                        ]}
                    />
                </ServiceSection>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════
   SPREADSHEET TAB — list + per-dataset actions
   ══════════════════════════════════════════════════════ */

function SpreadsheetTab({
    dataSources, healthByDataset, expanded, onToggle, busy, onAction, cfg,
}: {
    dataSources: DataSource[];
    healthByDataset: Record<string, HealthData["datasets"][number]>;
    expanded: Set<string>;
    onToggle: (id: string) => void;
    busy: Set<string>;
    onAction: (dataset: string, action: "pause" | "resume" | "trigger" | "delete") => void;
    copiedField: string | null;
    onCopy: (text: string, field: string) => void;
    cfg: ServiceConfig | null;
}) {
    if (dataSources.length === 0) {
        return (
            <div className="text-center py-12 ds-body opacity-60">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Belum ada Spreadsheet terdaftar.
                <p className="ds-small mt-2">
                    <a
                        href="/maintenance/add-spreadsheet"
                        className="ds-transition text-emerald-400 hover:text-emerald-300"
                    >
                        → Tambah Spreadsheet via Wizard
                    </a>
                </p>
            </div>
        );
    }

    const healthColor: Record<string, string> = {
        excellent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        good: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        critical: "bg-red-500/10 text-red-400 border-red-500/20",
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="ds-title">Spreadsheet Terdaftar</h2>
                    <p className="ds-small mt-0.5">
                        1 Spreadsheet = 1 Google Sheet dokumen · N Lembar (tab) → 1 BQ Dataset
                    </p>
                </div>
                <span className="ds-small">
                    {dataSources.length} Spreadsheet
                </span>
            </div>

            <div className="border-t border-border">
                {dataSources.map((ss, idx) => {
                    const isOpen = expanded.has(ss.id);
                    const sheetEntries = ss.sheets ? Object.entries(ss.sheets) : [];
                    const bqDs = ss.id;
                    const h = healthByDataset[bqDs];
                    const enabled = ss.syncControl?.enabled !== false;
                    const spreadsheetName = ss.identity?.name || ss.id;
                    const spreadsheetUrl = ss.identity?.url;
                    const isMaster = ss.identity?.isMasterHierarchy ?? false;
                    const busyPause = busy.has(`${ss.id}-pause`) || busy.has(`${ss.id}-resume`);
                    const busyTrigger = busy.has(`${ss.id}-trigger`);
                    const busyDelete = busy.has(`${ss.id}-delete`);

                    return (
                        <div
                            key={ss.id}
                            className={`${idx > 0 ? "border-t border-border/50" : ""} ${
                                !enabled ? "opacity-60" : ""
                            }`}
                        >
                            <div className="flex items-center gap-3 py-3 px-1 group">
                                <button
                                    type="button"
                                    onClick={() => onToggle(ss.id)}
                                    className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
                                >
                                    {isOpen ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4" />
                                    )}
                                </button>

                                <div
                                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                        !enabled
                                            ? "bg-slate-500"
                                            : h?.health_status === "excellent"
                                            ? "bg-emerald-400"
                                            : h?.health_status === "good"
                                            ? "bg-blue-400"
                                            : h?.health_status === "warning"
                                            ? "bg-amber-400"
                                            : h?.health_status === "critical"
                                            ? "bg-red-400"
                                            : "bg-slate-600"
                                    }`}
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />
                                        <span className="ds-label truncate">{spreadsheetName}</span>
                                        {isMaster && (
                                            <span className="ds-label rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 uppercase tracking-wider">
                                                master
                                            </span>
                                        )}
                                        <span className="ds-small opacity-60 font-mono">
                                            → BQ Dataset:{" "}
                                            <span className="text-foreground/60">{bqDs}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ds-data text-muted-foreground">
                                    <span>{sheetEntries.length} Lembar</span>
                                    {h && (
                                        <>
                                            <span>·</span>
                                            <span className="text-foreground/60">
                                                {fmtNum(h.row_count_total)} baris
                                            </span>
                                            {h.row_count_rejected > 0 && (
                                                <span className="text-amber-400">
                                                    {fmtNum(h.row_count_rejected)} rej
                                                </span>
                                            )}
                                            <span
                                                className={`ds-label rounded border px-1.5 py-0.5 uppercase tracking-wide ${
                                                    healthColor[h.health_status] || ""
                                                }`}
                                            >
                                                {h.health_status}
                                            </span>
                                        </>
                                    )}

                                    {/* Per-dataset actions */}
                                    <div className="flex items-center gap-1 ml-2 border-l border-border/40 pl-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAction(ss.id, "trigger");
                                            }}
                                            disabled={busyTrigger}
                                            title="Sync sekarang"
                                            className="p-1 rounded text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
                                        >
                                            <RefreshCw
                                                className={`h-3.5 w-3.5 ${busyTrigger ? "animate-spin" : ""}`}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAction(ss.id, enabled ? "pause" : "resume");
                                            }}
                                            disabled={busyPause}
                                            title={enabled ? "Pause sync" : "Resume sync"}
                                            className={`p-1 rounded hover:bg-muted/40 disabled:opacity-50 transition-colors ${
                                                enabled
                                                    ? "text-amber-400/70 hover:text-amber-300"
                                                    : "text-emerald-400/70 hover:text-emerald-300"
                                            }`}
                                        >
                                            {enabled ? (
                                                <Pause className="h-3.5 w-3.5" />
                                            ) : (
                                                <Play className="h-3.5 w-3.5" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAction(ss.id, "delete");
                                            }}
                                            disabled={busyDelete}
                                            title="Hapus"
                                            className="p-1 rounded text-red-400/60 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                        {spreadsheetUrl && (
                                            <a
                                                href={spreadsheetUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1 rounded text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                                                title="Buka Google Sheet"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="pb-3 pl-9 pr-1">
                                    {h && (
                                        <div className="flex flex-wrap items-center gap-3 mb-3 ds-small">
                                            <span className="ds-data">
                                                {fmtNum(h.row_count_valid)} valid
                                            </span>
                                            <span className="text-border">·</span>
                                            <span className="ds-data text-emerald-400">
                                                {h.valid_pct}%
                                            </span>
                                            <span className="text-border">·</span>
                                            <span className="opacity-80">
                                                Sync terakhir {fmtWIB(h.last_synced_at)}{" "}
                                                ({fmtAgo(h.last_synced_at)})
                                            </span>
                                            <span className="text-border">·</span>
                                            <span
                                                className={
                                                    h.last_sync_status === "success"
                                                        ? "text-emerald-400"
                                                        : h.last_sync_status === "error"
                                                        ? "text-red-400"
                                                        : ""
                                                }
                                            >
                                                {h.last_sync_status}
                                            </span>
                                        </div>
                                    )}

                                    {sheetEntries.length === 0 ? (
                                        <p className="ds-small opacity-60 italic">
                                            Belum ada Lembar dikonfigurasi
                                        </p>
                                    ) : (
                                        <div className="rounded border border-border/30 bg-muted/5 overflow-hidden">
                                            <div className="grid grid-cols-[1.2fr_1fr_1fr_80px_70px] gap-2 px-3 py-1.5 border-b border-border/30 bg-muted/10 ds-small uppercase tracking-wider font-semibold">
                                                <span>Tab Name</span>
                                                <span>BQ Table</span>
                                                <span>Level Ref</span>
                                                <span className="text-right">Rows</span>
                                                <span>Status</span>
                                            </div>
                                            {sheetEntries.map(([sheetTabId, sh]) => {
                                                const tableName =
                                                    sh.bqTable ||
                                                    `n_${(sh.tabName ?? sheetTabId).replace(/[^A-Za-z0-9_]/g, "_")}`;
                                                const syncStatus = sh.syncState?.syncStatus ?? "idle";
                                                return (
                                                    <div
                                                        key={sheetTabId}
                                                        className="grid grid-cols-[1.2fr_1fr_1fr_80px_70px] gap-2 px-3 py-1.5 border-b border-border/20 last:border-b-0"
                                                    >
                                                        <span className="ds-data text-foreground/80 truncate">
                                                            {sh.tabName ?? sheetTabId}
                                                        </span>
                                                        <span className="ds-data opacity-80 truncate">
                                                            {tableName}
                                                        </span>
                                                        {sh.levelRef ? (
                                                            <span className="ds-data opacity-80 truncate font-mono">
                                                                {sh.levelRef}
                                                            </span>
                                                        ) : (
                                                            <span className="ds-small opacity-40 italic">unset</span>
                                                        )}
                                                        <span className="text-right ds-data opacity-80">
                                                            {sh.syncState?.rowCount?.toLocaleString("id-ID") ?? "—"}
                                                        </span>
                                                        <span
                                                            className={`ds-data uppercase tracking-wider ${
                                                                syncStatus === "halted"
                                                                    ? "text-red-400/80"
                                                                    : syncStatus === "syncing"
                                                                    ? "text-blue-400/80"
                                                                    : "opacity-60"
                                                            }`}
                                                        >
                                                            {syncStatus}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════
   HISTORY TAB — SyncTimeline1
   ══════════════════════════════════════════════════════ */

function HistoryTab({ events }: { events: SyncEvent[] }) {
    const [filterDataset, setFilterDataset] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string>("");

    const datasets = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) set.add(e.dataset_name);
        return Array.from(set).sort();
    }, [events]);

    const filtered = useMemo(() => {
        return events.filter(
            (e) =>
                (!filterDataset || e.dataset_name === filterDataset) &&
                (!filterStatus || e.status === filterStatus)
        );
    }, [events, filterDataset, filterStatus]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="ds-small">Filter</span>
                </div>
                <select
                    value={filterDataset}
                    onChange={(e) => setFilterDataset(e.target.value)}
                    className="ds-data cursor-pointer rounded border border-border bg-background px-2 py-1"
                >
                    <option value="">Semua Dataset</option>
                    {datasets.map((d) => (
                        <option key={d} value={d}>
                            {d}
                        </option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="ds-data cursor-pointer rounded border border-border bg-background px-2 py-1"
                >
                    <option value="">Semua Status</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                    <option value="partial">Partial</option>
                    <option value="skipped">Skipped</option>
                </select>
                <span className="ml-auto ds-small opacity-80">
                    {filtered.length} / {events.length} event · 24 jam terakhir
                </span>
            </div>

            <SyncTimeline1 events={filtered} maxItems={200} />
        </div>
    );
}

/* ══════════════════════════════════════════════════════
   QUALITY TAB
   ══════════════════════════════════════════════════════ */

function QualityTab({ rejected }: { rejected: RejectedRow[] }) {
    const grouped = useMemo(() => {
        const map: Record<
            string,
            {
                dataset: string;
                sheet: string;
                reason: string;
                count: number;
                url: string;
                spreadsheetName: string;
            }
        > = {};
        for (const r of rejected) {
            const k = `${r.source_dataset}::${r.source_sheet}::${r.reason_code}`;
            if (!map[k]) {
                map[k] = {
                    dataset: r.source_dataset,
                    sheet: r.source_sheet,
                    reason: r.reason_code,
                    count: 0,
                    url: r.spreadsheet_url,
                    spreadsheetName: r.spreadsheet_name,
                };
            }
            map[k].count++;
        }
        return Object.values(map).sort((a, b) => b.count - a.count);
    }, [rejected]);

    if (rejected.length === 0) {
        return (
            <div className="text-center py-12 text-emerald-400/60">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                <p className="ds-label">Semua baris valid</p>
                <p className="ds-small mt-1">
                    Tidak ada rejected rows tertunda.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <h2 className="ds-title text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {rejected.length} Baris Bermasalah — Perlu Fix di Spreadsheet
                </h2>
                <p className="ds-small mt-1">
                    Buka Spreadsheet → cell merah sudah di-highlight otomatis tiap 15 menit. Fix cell →
                    sync berikutnya auto-resolve.
                </p>
            </div>

            {/* ── Group Summary ── */}
            <div className="rounded-lg border border-border/40 bg-muted/5 overflow-hidden">
                <div className="grid grid-cols-[130px_1fr_1fr_70px_auto] gap-2 px-4 py-2 border-b border-border/40 bg-muted/10 ds-small uppercase tracking-wider font-semibold">
                    <span>Alasan</span>
                    <span>Spreadsheet → Lembar</span>
                    <span>BQ Dataset</span>
                    <span className="text-right">Jumlah</span>
                    <span></span>
                </div>
                {grouped.map((g) => (
                    <div
                        key={`${g.dataset}::${g.sheet}::${g.reason}`}
                        className="grid grid-cols-[130px_1fr_1fr_70px_auto] gap-2 items-center px-4 py-2 border-b border-border/20 last:border-b-0 hover:bg-muted/10 ds-transition"
                    >
                        <span className="ds-label rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-red-400 uppercase tracking-wide w-fit">
                            {g.reason}
                        </span>
                        <span className="ds-small truncate">
                            <span className="text-foreground/80">{g.spreadsheetName}</span>
                            <span className="opacity-60"> · </span>
                            <span className="font-mono opacity-80">{g.sheet}</span>
                        </span>
                        <span className="ds-small font-mono opacity-70 truncate">
                            {g.dataset}
                        </span>
                        <span className="ds-data text-amber-400 text-right">
                            {g.count}
                        </span>
                        {g.url && (
                            <a
                                href={g.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-blue-400 hover:bg-blue-500/10"
                            >
                                <ExternalLink className="h-3 w-3" /> Buka
                            </a>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Per-row Detail (G20: deep-link to cell) ── */}
            <div className="rounded-lg border border-border/40 bg-muted/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-border/40 bg-muted/10 flex items-center justify-between">
                    <h3 className="ds-label uppercase tracking-wide">Detail Baris (klik → buka cell spesifik)</h3>
                    <span className="ds-small opacity-80">{rejected.length} baris · max 500</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr_60px_130px_auto] gap-2 px-4 py-2 border-b border-border/40 bg-muted/10 ds-small uppercase tracking-wider font-semibold">
                    <span>Alasan</span>
                    <span>Lembar</span>
                    <span>Kolom</span>
                    <span className="text-right">Row</span>
                    <span>Nilai</span>
                    <span></span>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                    {rejected.slice(0, 500).map((r) => {
                        const cellUrl = buildCellUrl(r);
                        return (
                            <div
                                key={r.rejection_key}
                                className="grid grid-cols-[100px_1fr_1fr_60px_130px_auto] gap-2 items-center px-4 py-1.5 border-b border-border/20 last:border-b-0 hover:bg-muted/10 ds-transition"
                            >
                                <span className="ds-label rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-red-400 uppercase tracking-wide w-fit">
                                    {r.reason_code}
                                </span>
                                <span className="ds-data opacity-80 truncate">{r.source_sheet}</span>
                                <span className="ds-data opacity-80 truncate">{r.column_name || "—"}</span>
                                <span className="ds-data opacity-70 text-right">{r.row_number}</span>
                                <span className="ds-small truncate font-mono opacity-80" title={r.cell_value ?? ""}>
                                    {r.cell_value ?? <span className="italic opacity-50">kosong</span>}
                                </span>
                                {cellUrl ? (
                                    <a
                                        href={cellUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-blue-400 hover:bg-blue-500/10"
                                        title="Buka cell di Google Sheet"
                                    >
                                        <ExternalLink className="h-3 w-3" /> Cell
                                    </a>
                                ) : (
                                    <span className="ds-small opacity-40">—</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * G20: Build deep-link ke cell spesifik di Google Sheet.
 * Format: https://docs.google.com/spreadsheets/d/{ID}/edit?gid={SHEET_ID}&range={COL}{ROW}
 *
 * NOTE: API rejected-rows sekarang return `spreadsheet_url` sebagai URL spreadsheet generic
 * (tanpa gid+range). Untuk real deep-link butuh sheet_id numeric dari Sheets API metadata.
 * Saat ini backend belum simpan gid — fallback ke spreadsheet_url + range hint.
 */
function buildCellUrl(r: RejectedRow): string | null {
    if (!r.spreadsheet_id) return null;
    // Column letter dari column_name: kalau bisa, pakai. Kalau tidak, pakai kolom A sebagai fallback.
    // Row number selalu ada (INT64 dari BQ).
    const row = r.row_number;
    if (!row || row < 1) return null;
    // Generic deep-link pakai range hint — user harus klik sheet tab sendiri.
    // TODO: backend populate `sheet_gid` saat sync, lalu include di API response untuk exact deep-link.
    const base = `https://docs.google.com/spreadsheets/d/${r.spreadsheet_id}/edit`;
    const range = `A${row}:Z${row}`;
    return `${base}?range=${encodeURIComponent(range)}`;
}

/* ══════════════════════════════════════════════════════
   DRIFT TAB — schema changes detection
   ══════════════════════════════════════════════════════ */

function DriftTab({ alerts }: { alerts: DriftAlert[] }) {
    if (alerts.length === 0) {
        return (
            <div className="text-center py-12 text-emerald-400/60">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                <p className="ds-label">Tidak ada schema drift</p>
                <p className="ds-small mt-1">
                    Semua kolom yang di-mapping masih cocok dengan Spreadsheet.
                </p>
            </div>
        );
    }

    const levelColor: Record<string, string> = {
        high: "bg-red-500/10 text-red-400 border-red-500/20",
        medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    };

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-border/40 bg-muted/5 p-4">
                <h2 className="ds-title flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Schema Drift Detection
                </h2>
                <p className="ds-small mt-1">
                    Deteksi perubahan struktur Sheet yang bisa bikin sync gagal: kolom dihapus, di-rename,
                    atau Lembar hilang.
                </p>
            </div>

            <div className="space-y-2">
                {alerts.map((a, i) => (
                    <div
                        key={i}
                        className={`rounded-lg border p-3 ${levelColor[a.level] || "border-border/40"}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="ds-label uppercase tracking-wider w-16">
                                [{a.level}]
                            </span>
                            <span className="ds-data text-foreground/80">
                                {a.dataset}
                                {a.sheet && (
                                    <>
                                        <span className="opacity-60"> · </span>
                                        {a.sheet}
                                    </>
                                )}
                            </span>
                            <span className="ml-auto ds-small uppercase tracking-wider font-semibold opacity-70">
                                {a.kind}
                            </span>
                            {a.spreadsheetUrl && (
                                <a
                                    href={a.spreadsheetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ds-label ds-transition cursor-pointer inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted/20"
                                >
                                    <ExternalLink className="h-3 w-3" /> Sheet
                                </a>
                            )}
                        </div>
                        <p className="ds-small mt-2 text-foreground/80">{a.detail}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
