"use client";

/**
 * Notifier — Multi-Channel Notification Gateway (V2)
 *
 * 5-tab architecture per CC Standard v2.4 YGGDRASIL.
 * All data from Firestore `service_runtime_configs/notifier` via onSnapshot.
 *
 * Tabs:
 *   1. Status     — delivery stats, CC standard, busy state, infra
 *   2. Groups     — multi-channel routing targets (WA + TG)
 *   3. Provider   — provider cards, capabilities, subscription
 *   4. Logs       — delivery history (BQ, placeholder)
 *   5. Settings   — config admin, kill switch, tuning, test send
 */

import { useState, useCallback, useMemo } from "react";
import {
    Bell, Activity, Users, Radio, ScrollText, Settings,
    CheckCircle, XCircle, Clock, AlertTriangle,
    Zap, Heart, Server, Cloud,
    Plus, Pencil, Trash2, RefreshCw, Send,
    Shield, Timer, ToggleRight, ToggleLeft,
    ArrowRightLeft, Power, RotateCcw,
    Database, Wifi, WifiOff, ExternalLink,
    ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { useFirestoreConfig } from "../_components/useFirestore";
import { useFirestoreContext } from "../_components/FirestoreProvider";
import { useLogPanel } from "../_components/LogContext";
import {
    ServiceHeader,
    ServiceTabs,
    ServiceSkeleton as LoadingSkeleton,
    ServiceToast as Toast,
    ServiceSection,
    ServiceGrid,
    ServiceStatCard,
} from "../_components/service-ui";
import { CLOUD_CONSOLE_API } from "@/lib/cloud-console-api";

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface NotifierConfig {
    // §1 Config Admin
    IS_ACTIVE?: boolean;
    ACTIVE_PROVIDER?: string;
    COOLDOWN_TEXT_SEC?: number;
    COOLDOWN_MEDIA_SEC?: number;
    MAX_RESTART_PER_HOUR?: number;
    RESTART_THRESHOLD_SEC?: number;
    MAX_ATTEMPTS_PER_DELIVERY?: number;
    BUSY_WAIT_SEC?: number;

    // §2 Groups
    groups?: Record<string, GroupEntry>;

    // §3 Provider Config
    providers?: Record<string, ProviderConfig>;

    // §4 Provider Snapshot
    provider_snapshot?: ProviderSnapshot;

    // §5 Subscription
    subscription?: Record<string, SubscriptionInfo>;

    // §6-7 Infra
    infra_type?: string;
    infra_function_name?: string;
    infra_region?: string;
    infra_memory?: string;
    infra_cpu?: string;
    infra_runtime?: string;
    infra_min_instances?: number;
    infra_max_instances?: number;
    infra_last_deploy?: string;
    infra_url?: string;
    infra_service_account?: string;
    infra_revision?: string;

    // §7 Pub/Sub
    pubsub_topic?: string;
    pubsub_subscription?: string;
    pubsub_type?: string;
    pubsub_ordering?: boolean;
    pubsub_dlq_topic?: string;
    pubsub_ack_deadline?: number;
    pubsub_retry_min_backoff?: string;
    pubsub_retry_max_backoff?: string;

    // §8 CC Standard
    lastRun?: string;
    lastStatus?: string;
    lastDurationMs?: number;

    // §9 Delivery Telemetry
    LAST_DELIVERY_PROVIDER?: string;
    LAST_DELIVERY_GROUP?: string;
    LAST_DELIVERY_TYPE?: string;
    LAST_DELIVERY_STATUS?: string;
    LAST_DELIVERY_ATTEMPT?: number;
    LAST_DELIVERY_ERROR?: string | null;
    TOTAL_DELIVERED_TODAY?: number;
    TOTAL_FAILED_TODAY?: number;

    // §10 Busy State
    busy_state?: BusyState;

    [key: string]: unknown;
}

interface GroupEntry {
    wa_chat_id?: string | null;
    wa_group_name?: string | null;
    wa_member_count?: number | null;
    tg_chat_id?: string | null;
    tg_group_name?: string | null;
    tg_member_count?: number | null;
    label?: string;
    added_at?: string;
    added_by?: string;
    verified_at?: string | null;
}

interface ProviderConfig {
    base_url?: string;
    token_secret?: string;
    auth_type?: string;
    enabled?: boolean;
}

interface ProviderSnapshot {
    provider?: string;
    bot_name?: string;
    bot_phone?: string;
    connected?: boolean;
    capabilities?: Record<string, boolean>;
    switched_at?: string;
    switched_by?: string;
}

interface SubscriptionInfo {
    paid_at?: string;
    expires_at?: string;
    cost_idr?: number;
    reminder_days?: number[];
    reminder_group?: string;
    auto_remind?: boolean;
}

interface BusyState {
    busy_count?: number;
    busy_since?: string | null;
    restart_count?: number;
    restart_hour?: string | null;
}

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

const CONFIG_API = `${CLOUD_CONSOLE_API}/services/notifier/config`;

function fmtWIB(ts?: string | null): string {
    if (!ts) return "—";
    try {
        return new Date(ts).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
            day: "2-digit", month: "short",
            hour12: false,
        });
    } catch { return ts; }
}

function fmtAgo(ts?: string | null): string {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 0) return "future";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function fmtBool(v: unknown): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "true";
    return false;
}

function fmtNum(v: unknown, fallback = 0): number {
    if (typeof v === "number") return v;
    if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? fallback : n; }
    return fallback;
}

function statusColor(s?: string): string {
    switch (s) {
        case "delivered": return "text-emerald-400";
        case "busy_retry": return "text-amber-400";
        case "failed": case "error": case "dlq": return "text-red-400";
        case "disabled": return "text-slate-400";
        default: return "text-muted-foreground";
    }
}

function statusBadge(s?: string): { bg: string; text: string } {
    switch (s) {
        case "delivered": return { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" };
        case "busy_retry": return { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400" };
        case "failed": case "error": case "dlq": return { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400" };
        case "disabled": return { bg: "bg-slate-500/10 border-slate-500/30", text: "text-slate-400" };
        default: return { bg: "bg-muted border-border", text: "text-muted-foreground" };
    }
}

function daysUntil(dateStr?: string): number | null {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return diff;
}

/* ═══════════════════════════════════════════════════
   Tab Definitions
   ═══════════════════════════════════════════════════ */

type MainTab = "status" | "groups" | "provider" | "logs" | "settings";

const TABS = [
    { id: "status" as MainTab, label: "Status", icon: Activity },
    { id: "groups" as MainTab, label: "Groups", icon: Users },
    { id: "provider" as MainTab, label: "Provider", icon: Radio },
    { id: "logs" as MainTab, label: "Logs", icon: ScrollText },
    { id: "settings" as MainTab, label: "Settings", icon: Settings },
];

/* ═══════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════ */

export default function NotifierPage() {
    const [activeTab, setActiveTab] = useState<MainTab>("status");
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

    const { isLoadingConfigs } = useFirestoreContext();
    const fsConfig = useFirestoreConfig<NotifierConfig>("wa_notifier"); // legacy doc ID
    const rawConfig = fsConfig || {} as NotifierConfig;
    const configLoading = isLoadingConfigs; // true only during initial Firestore fetch

    const { injectLog } = useLogPanel();

    const showFeedback = useCallback((msg: string, ok: boolean) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 3000);
    }, []);

    // ── V1 → V2 field compatibility layer ──
    // Legacy doc uses V1 naming (COOLDOWN_TEXT, WA_PROVIDER, etc.)
    // V2 dashboard expects (COOLDOWN_TEXT_SEC, ACTIVE_PROVIDER, etc.)
    // This normalizer supports BOTH, preferring V2 if present.
    const config = useMemo((): NotifierConfig => {
        const r = rawConfig as Record<string, unknown>;
        return {
            ...rawConfig,
            // §1 — Config Admin (V1→V2 mapping)
            IS_ACTIVE: r.IS_ACTIVE as boolean,
            ACTIVE_PROVIDER: (r.ACTIVE_PROVIDER || r.WA_PROVIDER) as string,
            COOLDOWN_TEXT_SEC: fmtNum(r.COOLDOWN_TEXT_SEC ?? r.COOLDOWN_TEXT, 5),
            COOLDOWN_MEDIA_SEC: fmtNum(r.COOLDOWN_MEDIA_SEC ?? r.COOLDOWN_MEDIA, 15),
            MAX_ATTEMPTS_PER_DELIVERY: fmtNum(r.MAX_ATTEMPTS_PER_DELIVERY ?? r.MAX_ATTEMPTS, 3),
            MAX_RESTART_PER_HOUR: fmtNum(r.MAX_RESTART_PER_HOUR, 2),
            RESTART_THRESHOLD_SEC: fmtNum(r.RESTART_THRESHOLD_SEC ?? r.AUTO_RESTART_THRESHOLD, 120),
            BUSY_WAIT_SEC: fmtNum(r.BUSY_WAIT_SEC ?? r.RESTART_RECOVERY, 15),
        };
    }, [rawConfig]);

    // Derived state
    const isActive = fmtBool(config.IS_ACTIVE);
    const activeProvider = (config.ACTIVE_PROVIDER as string) || "—";
    const snapshot = config.provider_snapshot;
    const busyState = config.busy_state || {} as BusyState;

    const healthStatus = useMemo(() => {
        if (!isActive) return "paused" as const;
        if (config.lastStatus === "error" || config.lastStatus === "dlq") return "error" as const;
        if (busyState.busy_count && busyState.busy_count > 0) return "stale" as const;
        return "healthy" as const;
    }, [isActive, config.lastStatus, busyState.busy_count]);

    if (configLoading) return <LoadingSkeleton />;

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">
            {feedback && <Toast message={feedback.msg} ok={feedback.ok} />}

            {/* Header */}
            <ServiceHeader
                title="Notifier"
                subtitle="Notification Gateway · CF Gen2"
                icon={Bell}
                health={healthStatus}
            />

            {/* Status Bar */}
            <div className="border-y border-border py-3 mb-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">Gateway</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}>{isActive ? "Active" : "Disabled"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">Provider</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            {activeProvider}
                        </span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">Connection</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            snapshot?.connected
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                        }`}>{snapshot?.connected ? "Connected" : "Disconnected"}</span>
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                        <span className="text-muted-foreground/50">Last run</span>
                        <span className="font-mono tabular-nums text-foreground/70">{fmtWIB(config.lastRun as string)}</span>
                        <span className="text-muted-foreground/40">({fmtAgo(config.lastRun as string)})</span>
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <ServiceTabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as MainTab)} />

            {/* Tab Content */}
            {activeTab === "status" && <TabStatus config={config} />}
            {activeTab === "groups" && <TabGroups config={config} showFeedback={showFeedback} injectLog={injectLog} />}
            {activeTab === "provider" && <TabProvider config={config} />}
            {activeTab === "logs" && <TabLogs />}
            {activeTab === "settings" && <TabSettings config={config} showFeedback={showFeedback} injectLog={injectLog} />}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Tab 1: Status
   ═══════════════════════════════════════════════════ */

function TabStatus({ config }: { config: NotifierConfig }) {
    const snapshot = config.provider_snapshot;
    const busy = config.busy_state || {} as BusyState;
    const hasBusy = snapshot?.capabilities?.has_busy !== false;

    return (
        <div className="space-y-5">
            {/* Top Row — 3 stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Active Provider */}
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Radio className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Active Provider</span>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-foreground capitalize">{config.ACTIVE_PROVIDER || "—"}</span>
                            <span className={`h-2 w-2 rounded-full ${
                                snapshot?.connected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400"
                            }`} />
                        </div>
                        <div className="text-xs text-muted-foreground/60 space-y-0.5">
                            <div>Bot: <span className="text-foreground/70">{snapshot?.bot_name || "—"}</span></div>
                            <div>Phone: <span className="font-mono text-foreground/70">{snapshot?.bot_phone || "—"}</span></div>
                        </div>
                    </div>
                </div>

                {/* Today Counters */}
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Today</span>
                    </div>
                    <div className="flex gap-6">
                        <div>
                            <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                                {fmtNum(config.TOTAL_DELIVERED_TODAY)}
                            </div>
                            <div className="text-xs text-muted-foreground/60 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-emerald-400/50" /> Delivered
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-red-400 tabular-nums">
                                {fmtNum(config.TOTAL_FAILED_TODAY)}
                            </div>
                            <div className="text-xs text-muted-foreground/60 flex items-center gap-1">
                                <XCircle className="h-3 w-3 text-red-400/50" /> Failed
                            </div>
                        </div>
                    </div>
                </div>

                {/* Last Delivery */}
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Send className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Last Delivery</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold capitalize ${statusColor(config.LAST_DELIVERY_STATUS)}`}>
                                {config.LAST_DELIVERY_STATUS || "—"}
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground/60 space-y-0.5">
                            <div>Group: <span className="text-foreground/70">{config.LAST_DELIVERY_GROUP || "—"}</span></div>
                            <div>Type: <span className="text-foreground/70">{config.LAST_DELIVERY_TYPE || "—"}</span></div>
                            <div>Attempt: <span className="text-foreground/70">{config.LAST_DELIVERY_ATTEMPT ?? "—"}</span></div>
                            <div>Time: <span className="font-mono text-foreground/70">{fmtWIB(config.lastRun as string)}</span></div>
                        </div>
                        {config.LAST_DELIVERY_ERROR && (
                            <div className="text-xs text-red-400 bg-red-500/5 rounded px-2 py-1 mt-1 font-mono">
                                {config.LAST_DELIVERY_ERROR}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Middle Row — CC Standard + Busy State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ServiceSection title="CC Standard" icon={<Heart className="h-3.5 w-3.5" />} noCollapse>
                    <ServiceGrid items={[
                        { label: "lastRun", value: fmtWIB(config.lastRun as string) },
                        { label: "lastStatus", value: config.lastStatus || "—", highlight: config.lastStatus === "delivered" ? "emerald" : config.lastStatus === "error" ? "amber" : undefined },
                        { label: "lastDurationMs", value: config.lastDurationMs != null ? `${config.lastDurationMs}ms` : "—" },
                    ]} />
                </ServiceSection>

                {hasBusy && (
                    <ServiceSection title="Busy State" icon={<AlertTriangle className="h-3.5 w-3.5" />} noCollapse>
                        <ServiceGrid items={[
                            { label: "busy_count", value: fmtNum(busy.busy_count), highlight: fmtNum(busy.busy_count) > 0 ? "amber" : "emerald" },
                            { label: "busy_since", value: busy.busy_since ? fmtWIB(busy.busy_since) : "— (Ready)" },
                            { label: "restart_count", value: fmtNum(busy.restart_count) },
                            { label: "restart_hour", value: busy.restart_hour || "—" },
                        ]} />
                        <div className="mt-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                fmtNum(busy.busy_count) > 0
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                            }`}>
                                {fmtNum(busy.busy_count) > 0 ? `Busy (${busy.busy_count}×)` : "Ready"}
                            </span>
                        </div>
                    </ServiceSection>
                )}
            </div>

            {/* Bottom Row — Infrastructure */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ServiceSection title="Cloud Function" icon={<Server className="h-3.5 w-3.5" />} defaultOpen={false}>
                    <ServiceGrid items={[
                        { label: "Function", value: config.infra_function_name },
                        { label: "Region", value: config.infra_region },
                        { label: "Memory", value: config.infra_memory },
                        { label: "CPU", value: config.infra_cpu },
                        { label: "Runtime", value: config.infra_runtime },
                        { label: "Instances", value: `${config.infra_min_instances ?? "—"}/${config.infra_max_instances ?? "—"}` },
                        { label: "Revision", value: config.infra_revision },
                        { label: "Last Deploy", value: fmtWIB(config.infra_last_deploy as string) },
                    ]} />
                </ServiceSection>

                <ServiceSection title="Pub/Sub" icon={<Cloud className="h-3.5 w-3.5" />} defaultOpen={false}>
                    <ServiceGrid items={[
                        { label: "Topic", value: config.pubsub_topic },
                        { label: "Subscription", value: config.pubsub_subscription },
                        { label: "Type", value: config.pubsub_type },
                        { label: "Ordering", value: config.pubsub_ordering != null ? String(config.pubsub_ordering) : "—", highlight: config.pubsub_ordering ? "emerald" : undefined },
                        { label: "DLQ Topic", value: config.pubsub_dlq_topic },
                        { label: "Ack Deadline", value: config.pubsub_ack_deadline ? `${config.pubsub_ack_deadline}s` : "—" },
                        { label: "Retry Backoff", value: config.pubsub_retry_min_backoff && config.pubsub_retry_max_backoff
                            ? `${config.pubsub_retry_min_backoff} – ${config.pubsub_retry_max_backoff}` : "—" },
                    ]} />
                </ServiceSection>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Tab 2: Groups
   ═══════════════════════════════════════════════════ */

function TabGroups({ config, showFeedback, injectLog }: {
    config: NotifierConfig;
    showFeedback: (msg: string, ok: boolean) => void;
    injectLog: (serviceId: string, message: string, level?: "info" | "warn" | "error" | "success") => void;
}) {
    const groups = config.groups || {};
    const groupEntries = Object.entries(groups);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                    {groupEntries.length} group{groupEntries.length !== 1 ? "s" : ""} configured
                </div>
                <button
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                        bg-blue-500/10 text-blue-400 border border-blue-500/20
                        hover:bg-blue-500/20 transition-colors"
                    onClick={() => showFeedback("Group CRUD requires backend API routes (coming soon)", false)}
                >
                    <Plus className="h-3 w-3" /> Add Group
                </button>
            </div>

            {/* Table */}
            {groupEntries.length === 0 ? (
                <div className="rounded-lg border border-border/50 bg-muted/5 p-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground/60">No groups configured</p>
                    <p className="text-xs text-muted-foreground/40 mt-1">Groups will appear here after CF Notifier starts</p>
                </div>
            ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50">
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Name</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Label</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">WA Group</th>
                                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">WA #</th>
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">TG Group</th>
                                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">TG #</th>
                                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Verified</th>
                                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupEntries.map(([name, g]) => (
                                    <tr key={name} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                                        <td className="px-3 py-2.5 font-mono font-medium text-foreground/80">{name}</td>
                                        <td className="px-3 py-2.5 text-foreground/70">{g.label || "—"}</td>
                                        <td className="px-3 py-2.5 text-foreground/60 max-w-[160px] truncate" title={g.wa_group_name || ""}>
                                            {g.wa_group_name || <span className="text-muted-foreground/40">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center tabular-nums text-foreground/60">
                                            {g.wa_member_count ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-foreground/60 max-w-[160px] truncate" title={g.tg_group_name || ""}>
                                            {g.tg_group_name || <span className="text-muted-foreground/40">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center tabular-nums text-foreground/60">
                                            {g.tg_member_count ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {g.verified_at ? (
                                                <span className="text-emerald-400" title={`Verified: ${fmtWIB(g.verified_at)}`}>
                                                    <CheckCircle className="h-3.5 w-3.5 inline" />
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/40">
                                                    <XCircle className="h-3.5 w-3.5 inline" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-1">
                                                <button title="Edit" className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors">
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button title="Verify" className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-blue-400 transition-colors">
                                                    <RefreshCw className="h-3 w-3" />
                                                </button>
                                                <button title="Delete" className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-red-400 transition-colors">
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-3 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-300/70 leading-relaxed">
                    Groups are multi-channel routing targets. Each group can have both WhatsApp and Telegram chat IDs.
                    The active provider determines which channel is used for delivery.
                    Use <strong>Verify</strong> to fetch latest group name and member count from the provider API.
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Tab 3: Provider
   ═══════════════════════════════════════════════════ */

function TabProvider({ config }: { config: NotifierConfig }) {
    const providers = config.providers || {};
    const snapshot = config.provider_snapshot;
    const subscriptions = config.subscription || {};
    const activeId = config.ACTIVE_PROVIDER || "";

    const PROVIDER_ORDER = ["maxchat", "waha", "telegram"];
    const sortedProviders = PROVIDER_ORDER
        .filter(p => providers[p])
        .map(p => [p, providers[p]] as [string, ProviderConfig]);

    // Include any providers not in the standard order
    Object.entries(providers).forEach(([name, cfg]) => {
        if (!PROVIDER_ORDER.includes(name)) sortedProviders.push([name, cfg]);
    });

    return (
        <div className="space-y-4">
            {sortedProviders.length === 0 ? (
                <div className="rounded-lg border border-border/50 bg-muted/5 p-8 text-center">
                    <Radio className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground/60">No providers configured</p>
                    <p className="text-xs text-muted-foreground/40 mt-1">Provider config will be populated after CF deployment</p>
                </div>
            ) : (
                sortedProviders.map(([name, prov]) => {
                    const isActive = name === activeId;
                    const sub = subscriptions[name];
                    const daysLeft = daysUntil(sub?.expires_at);
                    const caps = isActive ? snapshot?.capabilities : {};

                    return (
                        <div key={name} className={`rounded-lg border overflow-hidden ${
                            isActive ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50 bg-muted/5"
                        }`}>
                            {/* Provider Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-foreground capitalize">{name}</span>
                                    {isActive ? (
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                            ACTIVE
                                        </span>
                                    ) : prov.enabled ? (
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            Available
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                            Disabled
                                        </span>
                                    )}
                                </div>
                                {!isActive && prov.enabled && (
                                    <button className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md
                                        bg-blue-500/10 text-blue-400 border border-blue-500/20
                                        hover:bg-blue-500/20 transition-colors">
                                        <ArrowRightLeft className="h-3 w-3" /> Switch
                                    </button>
                                )}
                            </div>

                            {/* Provider Details */}
                            <div className="p-4">
                                <ServiceGrid items={[
                                    { label: "Base URL", value: prov.base_url },
                                    { label: "Auth Type", value: prov.auth_type },
                                    { label: "Token Secret", value: prov.token_secret ? `••• (${prov.token_secret})` : "—" },
                                    ...(isActive && snapshot ? [
                                        { label: "Bot Name", value: snapshot.bot_name },
                                        { label: "Bot Phone", value: snapshot.bot_phone },
                                        { label: "Connected", value: snapshot.connected ? "Yes" : "No", highlight: (snapshot.connected ? "emerald" : "amber") as "emerald" | "amber" },
                                    ] : []),
                                ]} />

                                {/* Capabilities (active provider only) */}
                                {isActive && caps && Object.keys(caps).length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-border/30">
                                        <span className="text-xs text-muted-foreground/50 uppercase tracking-wider block mb-2">Capabilities</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(caps).map(([cap, val]) => (
                                                <span key={cap} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                    val ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground/40"
                                                }`}>
                                                    {cap.replace("has_", "")}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Subscription info */}
                                {sub && (
                                    <div className="mt-3 pt-3 border-t border-border/30">
                                        <span className="text-xs text-muted-foreground/50 uppercase tracking-wider block mb-2">Subscription</span>
                                        <ServiceGrid items={[
                                            { label: "Paid At", value: sub.paid_at },
                                            { label: "Expires", value: sub.expires_at ? `${sub.expires_at} (${daysLeft}d left)` : "—",
                                              highlight: daysLeft !== null && daysLeft <= 7 ? "amber" : undefined },
                                            { label: "Cost", value: sub.cost_idr ? `Rp ${sub.cost_idr.toLocaleString("id-ID")}` : "—" },
                                            { label: "Reminder", value: sub.reminder_days ? `H-${sub.reminder_days.join(", H-")}` : "—" },
                                        ]} />
                                    </div>
                                )}

                                {/* Action buttons (active provider) */}
                                {isActive && (
                                    <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-2">
                                        <ActionBtn icon={<Send className="h-3 w-3" />} label="Test Send" />
                                        {caps?.has_restart && <ActionBtn icon={<RotateCcw className="h-3 w-3" />} label="Restart" />}
                                        {caps?.has_reboot && <ActionBtn icon={<Power className="h-3 w-3" />} label="Reboot" color="amber" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

function ActionBtn({ icon, label, color = "blue" }: { icon: React.ReactNode; label: string; color?: string }) {
    const colors = color === "amber"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
        : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20";
    return (
        <button className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${colors}`}>
            {icon} {label}
        </button>
    );
}

/* ═══════════════════════════════════════════════════
   Tab 4: Logs (Placeholder — needs BQ backend)
   ═══════════════════════════════════════════════════ */

function TabLogs() {
    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/5 p-8 text-center">
                <ScrollText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground/60">Delivery Log</p>
                <p className="text-xs text-muted-foreground/40 mt-1 max-w-md mx-auto">
                    Delivery history will be available after the CF Notifier backend is deployed.
                    Logs are stored in BigQuery <code className="text-xs font-mono bg-muted/30 px-1 py-0.5 rounded">notifier_delivery_log</code> and queried via Dashboard BE API.
                </p>
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground/40">
                    <span className="flex items-center gap-1"><Database className="h-3 w-3" /> BigQuery source</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Filter by date/group/status</span>
                    <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Expandable rows</span>
                </div>
            </div>

            <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-3 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-300/70 leading-relaxed">
                    For real-time Cloud Logging (system logs), use the <strong>LogPanel</strong> in the sidebar —
                    check the Notifier checkbox in the Service Explorer to open it.
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Tab 5: Settings
   ═══════════════════════════════════════════════════ */

function TabSettings({ config, showFeedback, injectLog }: {
    config: NotifierConfig;
    showFeedback: (msg: string, ok: boolean) => void;
    injectLog: (serviceId: string, message: string, level?: "info" | "warn" | "error" | "success") => void;
}) {
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({
        IS_ACTIVE: fmtBool(config.IS_ACTIVE),
        COOLDOWN_TEXT_SEC: fmtNum(config.COOLDOWN_TEXT_SEC, 5),
        COOLDOWN_MEDIA_SEC: fmtNum(config.COOLDOWN_MEDIA_SEC, 15),
        MAX_ATTEMPTS_PER_DELIVERY: fmtNum(config.MAX_ATTEMPTS_PER_DELIVERY, 3),
        BUSY_WAIT_SEC: fmtNum(config.BUSY_WAIT_SEC, 30),
        MAX_RESTART_PER_HOUR: fmtNum(config.MAX_RESTART_PER_HOUR, 2),
        RESTART_THRESHOLD_SEC: fmtNum(config.RESTART_THRESHOLD_SEC, 120),
    });

    // Test send state
    const [testGroup, setTestGroup] = useState("");
    const [testType, setTestType] = useState("text");
    const [testMessage, setTestMessage] = useState("");
    const [sendingTest, setSendingTest] = useState(false);

    const groups = config.groups || {};
    const groupNames = Object.keys(groups);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const res = await fetch(CONFIG_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showFeedback(`Config saved: ${data.updated?.join(", ")}`, true);
                injectLog("notifier", `[CONFIG] Updated: ${data.updated?.join(", ")}`, "success");
            } else {
                showFeedback(`Save failed: ${data.error || "unknown"}`, false);
                injectLog("notifier", `[CONFIG] Save failed: ${data.error}`, "error");
            }
        } catch (e) {
            showFeedback(`Network error: ${(e as Error).message}`, false);
        } finally {
            setSaving(false);
        }
    }, [draft, showFeedback, injectLog]);

    const handleTestSend = useCallback(async () => {
        if (!testGroup || !testMessage.trim()) {
            showFeedback("Select a group and enter a message", false);
            return;
        }
        setSendingTest(true);
        try {
            // This will publish to Pub/Sub via Dashboard BE API
            showFeedback("Test Send requires Pub/Sub backend (coming soon)", false);
        } finally {
            setSendingTest(false);
        }
    }, [testGroup, testMessage, showFeedback]);

    return (
        <div className="space-y-5">
            {/* Kill Switch */}
            <ServiceSection title="Kill Switch" icon={<Shield className="h-3.5 w-3.5" />} noCollapse>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[12px] font-medium text-foreground">IS_ACTIVE</div>
                        <div className="text-xs text-muted-foreground/60">Master switch — all deliveries blocked when OFF</div>
                    </div>
                    <button
                        onClick={() => setDraft(d => ({ ...d, IS_ACTIVE: !d.IS_ACTIVE }))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                            draft.IS_ACTIVE
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}
                    >
                        {draft.IS_ACTIVE ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {draft.IS_ACTIVE ? "ON" : "OFF"}
                    </button>
                </div>
            </ServiceSection>

            {/* Delivery Config */}
            <ServiceSection title="Delivery Config" icon={<Timer className="h-3.5 w-3.5" />} noCollapse>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TuneField label="Cooldown Text" unit="sec" value={draft.COOLDOWN_TEXT_SEC}
                        onChange={v => setDraft(d => ({ ...d, COOLDOWN_TEXT_SEC: v }))} />
                    <TuneField label="Cooldown Media" unit="sec" value={draft.COOLDOWN_MEDIA_SEC}
                        onChange={v => setDraft(d => ({ ...d, COOLDOWN_MEDIA_SEC: v }))} />
                    <TuneField label="Max Attempts" unit="×" value={draft.MAX_ATTEMPTS_PER_DELIVERY}
                        onChange={v => setDraft(d => ({ ...d, MAX_ATTEMPTS_PER_DELIVERY: v }))} />
                    <TuneField label="Busy Wait" unit="sec" value={draft.BUSY_WAIT_SEC}
                        onChange={v => setDraft(d => ({ ...d, BUSY_WAIT_SEC: v }))} />
                </div>
            </ServiceSection>

            {/* Auto-Restart */}
            <ServiceSection title="Auto-Restart" icon={<Zap className="h-3.5 w-3.5" />} noCollapse>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TuneField label="Max Restart/Hour" unit="×" value={draft.MAX_RESTART_PER_HOUR}
                        onChange={v => setDraft(d => ({ ...d, MAX_RESTART_PER_HOUR: v }))} />
                    <TuneField label="Restart Threshold" unit="sec" value={draft.RESTART_THRESHOLD_SEC}
                        onChange={v => setDraft(d => ({ ...d, RESTART_THRESHOLD_SEC: v }))} />
                </div>
            </ServiceSection>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 text-[12px] font-medium rounded-lg
                        bg-blue-500/15 text-blue-400 border border-blue-500/25
                        hover:bg-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors"
                >
                    {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                    {saving ? "Saving..." : "Save Config"}
                </button>
            </div>

            {/* Test Send */}
            <ServiceSection title="Test Send" icon={<Send className="h-3.5 w-3.5" />} defaultOpen={false}>
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground/70 mb-1 block">Group</label>
                            <select
                                value={testGroup}
                                onChange={e => setTestGroup(e.target.value)}
                                className="w-full h-8 px-3 text-[12px] rounded-md border border-border/50
                                    bg-muted/20 text-foreground/80 outline-none"
                            >
                                <option value="">Select group...</option>
                                {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground/70 mb-1 block">Type</label>
                            <select
                                value={testType}
                                onChange={e => setTestType(e.target.value)}
                                className="w-full h-8 px-3 text-[12px] rounded-md border border-border/50
                                    bg-muted/20 text-foreground/80 outline-none"
                            >
                                <option value="text">Text</option>
                                <option value="image">Image</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground/70 mb-1 block">Message</label>
                        <textarea
                            value={testMessage}
                            onChange={e => setTestMessage(e.target.value)}
                            placeholder="Enter test message..."
                            rows={3}
                            className="w-full px-3 py-2 text-[12px] rounded-md border border-border/50
                                bg-muted/20 text-foreground/80 placeholder:text-muted-foreground/30
                                outline-none resize-none"
                        />
                    </div>
                    <button
                        onClick={handleTestSend}
                        disabled={sendingTest}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md
                            bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
                            hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                        <Send className="h-3 w-3" /> Send Test
                    </button>
                </div>
            </ServiceSection>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   TuneField — Number input with unit label
   ═══════════════════════════════════════════════════ */

function TuneField({ label, unit, value, onChange }: {
    label: string; unit: string; value: number; onChange: (v: number) => void;
}) {
    return (
        <div>
            <label className="text-xs text-muted-foreground/70 mb-1 block">{label}</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value}
                    onChange={e => onChange(Number(e.target.value) || 0)}
                    className="w-full h-8 px-3 text-[12px] font-mono rounded-md border border-border/50
                        bg-muted/20 text-foreground/80 outline-none
                        focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-muted-foreground/50 whitespace-nowrap">{unit}</span>
            </div>
        </div>
    );
}
