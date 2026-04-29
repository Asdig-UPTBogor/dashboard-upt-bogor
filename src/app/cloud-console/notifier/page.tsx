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

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
    Bell, Activity, Users, Radio, ScrollText, Settings,
    CheckCircle, XCircle, Clock, AlertTriangle,
    Zap, Heart, Server, Cloud,
    Plus, Pencil, Trash2, RefreshCw, Send, Loader2,
    Shield, Timer, ToggleRight, ToggleLeft,
    ArrowRightLeft, Power, RotateCcw,
    Database, Wifi, WifiOff, ExternalLink,
    ChevronDown, ChevronRight, Info, CheckCircle2,
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

    // §7 Eventarc
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
    const fsConfig = useFirestoreConfig<NotifierConfig>("notifier");
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
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="flex items-center gap-1">
                        <span className="ds-label">Gateway</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}>{isActive ? "Active" : "Disabled"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="ds-label">Provider</span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            {activeProvider}
                        </span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="ds-label">Connection</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            snapshot?.connected
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                        }`}>{snapshot?.connected ? "Connected" : "Disconnected"}</span>
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                        <span className="ds-label">Last run</span>
                        <span className="ds-small font-mono tabular-nums">{fmtWIB(config.lastRun as string)}</span>
                        <span className="ds-small">({fmtAgo(config.lastRun as string)})</span>
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <ServiceTabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as MainTab)} />

            {/* Tab Content */}
            {activeTab === "status" && <TabStatus config={config} />}
            {activeTab === "groups" && <TabGroups config={config} showFeedback={showFeedback} injectLog={injectLog} />}
            {activeTab === "provider" && <TabProvider config={config} />}
            {activeTab === "logs" && <TabLogs groups={config.groups} />}
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
                        <div className="space-y-0.5">
                            <div className="ds-label">Bot: <span className="ds-small">{snapshot?.bot_name || "—"}</span></div>
                            <div className="ds-label">Phone: <span className="ds-small font-mono">{snapshot?.bot_phone || "—"}</span></div>
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
                            <div className="ds-small flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-emerald-400/50" /> Delivered
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-red-400 tabular-nums">
                                {fmtNum(config.TOTAL_FAILED_TODAY)}
                            </div>
                            <div className="ds-small flex items-center gap-1">
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
                        <div className="space-y-0.5">
                            <div className="ds-label">Group: <span className="ds-small">{config.LAST_DELIVERY_GROUP || "—"}</span></div>
                            <div className="ds-label">Type: <span className="ds-small">{config.LAST_DELIVERY_TYPE || "—"}</span></div>
                            <div className="ds-label">Attempt: <span className="ds-small">{config.LAST_DELIVERY_ATTEMPT ?? "—"}</span></div>
                            <div className="ds-label">Time: <span className="ds-small font-mono">{fmtWIB(config.lastRun as string)}</span></div>
                        </div>
                        {config.LAST_DELIVERY_ERROR && (
                            <div className="text-xs text-red-400 bg-red-500/5 rounded px-2 py-1 mt-1 font-mono">
                                {parseError(config.LAST_DELIVERY_ERROR)}
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

                <ServiceSection title="Eventarc Trigger" icon={<Cloud className="h-3.5 w-3.5" />} defaultOpen={false}>
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
    const [verifying, setVerifying] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [addKey, setAddKey] = useState("");
    const [addChatId, setAddChatId] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [editingGroup, setEditingGroup] = useState<string | null>(null);
    const [editChatId, setEditChatId] = useState("");
    const [editLoading, setEditLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [resolveResult, setResolveResult] = useState<{chatId:string;groupName:string|null;memberCount:number|null;resolvedFrom:string} | null>(null);
    const [resolving, setResolving] = useState(false);

    const groups = config.groups || {};
    const groupEntries = Object.entries(groups);

    const handleVerifySync = async (groupName: string, waChatId: string) => {
        if (!waChatId) {
            showFeedback("WhatsApp Chat ID is required for verification", false);
            return;
        }
        setVerifying(groupName);
        try {
            const res = await fetch(`/api/console/services/notifier/actions/verify-group`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupName, wa_chat_id: waChatId }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showFeedback(`Group '${groupName}' synced successfully`, true);
                injectLog("notifier", `[SYNC] Group '${groupName}' verified from provider`, "success");
            } else {
                showFeedback(`Sync failed: ${data.error || "unknown"}`, false);
            }
        } catch (e) {
            showFeedback(`Network error: ${(e as Error).message}`, false);
        } finally {
            setVerifying(null);
        }
    };

    // Auto-resolve invite link saat user paste
    const handleChatIdChange = async (val: string) => {
        setAddChatId(val);
        setResolveResult(null);
        // Jika input mengandung invite link, auto-resolve
        if (val.includes('chat.whatsapp.com/')) {
            setResolving(true);
            try {
                const res = await fetch(`/api/console/services/notifier/actions/resolve-invite`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ input: val }),
                });
                const data = await res.json();
                if (data.ok) {
                    setResolveResult(data);
                }
            } catch { /* silent */ }
            finally { setResolving(false); }
        }
    };

    const handleAddGroup = async () => {
        const key = addKey.trim();
        const chatId = resolveResult?.chatId || addChatId.trim();
        if (!key || !chatId) {
            showFeedback("Group Key dan WA Chat ID wajib diisi.", false);
            return;
        }
        setAddLoading(true);
        try {
            const res = await fetch(`/api/console/services/notifier/actions/add-group`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupName: key, wa_chat_id: addChatId.trim() || chatId }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showFeedback(data.message, true);
                injectLog("notifier", `[GROUP] Added: ${key} → ${data.resolvedChatId || chatId}`, "success");
                setAddKey("");
                setAddChatId("");
                setResolveResult(null);
                setShowAddForm(false);
            } else {
                showFeedback(data.error || "Add group failed", false);
            }
        } catch (e) {
            showFeedback(`Network error: ${(e as Error).message}`, false);
        } finally {
            setAddLoading(false);
        }
    };

    const handleEditGroup = async (groupName: string) => {
        const chatId = editChatId.trim();
        if (!chatId) {
            showFeedback("WA Chat ID wajib diisi.", false);
            return;
        }
        setEditLoading(true);
        try {
            const res = await fetch(`/api/console/services/notifier/actions/edit-group`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupName, wa_chat_id: chatId }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showFeedback(data.message, true);
                injectLog("notifier", `[GROUP] Edited: ${groupName} → ${chatId}`, "success");
                setEditingGroup(null);
                setEditChatId("");
            } else {
                showFeedback(data.error || "Edit group failed", false);
            }
        } catch (e) {
            showFeedback(`Network error: ${(e as Error).message}`, false);
        } finally {
            setEditLoading(false);
        }
    };

    const handleDeleteGroup = async (groupName: string) => {
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/console/services/notifier/actions/delete-group`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupName }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showFeedback(data.message, true);
                injectLog("notifier", `[GROUP] Deleted: ${groupName}`, "warn");
                setDeleteConfirm(null);
            } else {
                showFeedback(data.error || "Delete group failed", false);
            }
        } catch (e) {
            showFeedback(`Network error: ${(e as Error).message}`, false);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="ds-small">
                    {groupEntries.length} group{groupEntries.length !== 1 ? "s" : ""} configured
                </div>
                <button
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                        bg-blue-500/10 text-blue-400 border border-blue-500/20
                        hover:bg-blue-500/20 transition-colors"
                    onClick={() => { setShowAddForm(!showAddForm); setEditingGroup(null); }}
                >
                    <Plus className="h-3 w-3" /> Add Group
                </button>
            </div>

            {/* Add Group Form */}
            {showAddForm && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
                    <div className="text-xs font-semibold text-blue-400">Add New Group</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="ds-small mb-1 block">Group Key (snake_case)</label>
                            <input
                                type="text"
                                placeholder="thor_alert"
                                value={addKey}
                                onChange={(e) => setAddKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                className="w-full px-3 py-1.5 text-xs rounded-md border border-border/50 bg-background
                                    text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                        </div>
                        <div>
                            <label className="ds-small mb-1 block">WA Chat ID atau Invite Link</label>
                            <input
                                type="text"
                                placeholder="Paste invite link atau 120363...@g.us"
                                value={addChatId}
                                onChange={(e) => handleChatIdChange(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs rounded-md border border-border/50 bg-background
                                    text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
                            />
                        </div>
                    </div>
                    {/* Resolve Preview */}
                    {resolving && (
                        <div className="flex items-center gap-2 text-[10px] text-blue-400 animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" /> Resolving invite link...
                        </div>
                    )}
                    {resolveResult && (
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Invite link resolved!
                            </div>
                            <div className="text-muted-foreground">
                                <span className="ds-small font-mono">{resolveResult.chatId}</span>
                                {resolveResult.groupName && (
                                    <span className="ml-2">— {resolveResult.groupName}</span>
                                )}
                                {resolveResult.memberCount && (
                                    <span className="ml-1 ds-small">({resolveResult.memberCount} members)</span>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => { setShowAddForm(false); setAddKey(""); setAddChatId(""); setResolveResult(null); }}
                            className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        >Cancel</button>
                        <button
                            onClick={handleAddGroup}
                            disabled={addLoading || !addKey.trim() || (!addChatId.trim() && !resolveResult)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white
                                hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >{addLoading ? "Adding..." : "Add Group"}</button>
                    </div>
                    <div className="ds-small">
                        💡 Paste invite link WA atau masukkan Chat ID langsung. Group Key = routing contract (dipakai producer saat publish ke Pub/Sub).
                    </div>
                </div>
            )}

            {/* Table */}
            {groupEntries.length === 0 ? (
                <div className="rounded-lg border border-border/50 bg-muted/5 p-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="ds-body">No groups configured</p>
                    <p className="ds-small mt-1">Klik &quot;Add Group&quot; untuk menambah group baru</p>
                </div>
            ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50">
                                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Name</th>
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
                                        <td className="px-3 py-2.5 ds-data">{name}</td>
                                        <td className="px-3 py-2.5 ds-small max-w-[200px] truncate" title={g.wa_group_name || ""}>
                                            {g.wa_group_name || <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center ds-small tabular-nums">
                                            {g.wa_member_count ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 ds-small max-w-[160px] truncate" title={g.tg_group_name || ""}>
                                            {g.tg_group_name || <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center ds-small tabular-nums">
                                            {g.tg_member_count ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {g.verified_at ? (
                                                <span className="text-emerald-400" title={`Verified: ${fmtWIB(g.verified_at)}`}>
                                                    <CheckCircle className="h-3.5 w-3.5 inline" />
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    <XCircle className="h-3.5 w-3.5 inline" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-1">
                                                <button title="Verify Sync" 
                                                    onClick={() => handleVerifySync(name, g.wa_chat_id || "")}
                                                    disabled={verifying === name}
                                                    className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-blue-400 transition-colors disabled:opacity-30">
                                                    <RefreshCw className={`h-3 w-3 ${verifying === name ? "animate-spin" : ""}`} />
                                                </button>
                                                <button title="Edit Chat ID"
                                                    onClick={() => { setEditingGroup(editingGroup === name ? null : name); setEditChatId(g.wa_chat_id || ""); setShowAddForm(false); }}
                                                    className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-amber-400 transition-colors">
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button title="Delete"
                                                    onClick={() => setDeleteConfirm(deleteConfirm === name ? null : name)}
                                                    className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-red-400 transition-colors">
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                            {/* Inline Edit */}
                                            {editingGroup === name && (
                                                <div className="mt-2 flex gap-1.5 items-center">
                                                    <input
                                                        type="text"
                                                        value={editChatId}
                                                        onChange={(e) => setEditChatId(e.target.value)}
                                                        placeholder="WA Chat ID"
                                                        className="flex-1 px-2 py-1 text-[10px] rounded border border-border/50 bg-background
                                                            text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                                    />
                                                    <button
                                                        onClick={() => handleEditGroup(name)}
                                                        disabled={editLoading || !editChatId.trim()}
                                                        className="px-2 py-1 text-[10px] font-medium rounded bg-amber-500/80 text-white
                                                            hover:bg-amber-600 disabled:opacity-40 transition-colors"
                                                    >{editLoading ? "..." : "Save"}</button>
                                                </div>
                                            )}
                                            {/* Delete Confirm */}
                                            {deleteConfirm === name && (
                                                <div className="mt-2 flex gap-1.5 items-center justify-center">
                                                    <span className="text-[10px] text-red-400">Hapus?</span>
                                                    <button
                                                        onClick={() => handleDeleteGroup(name)}
                                                        disabled={deleteLoading}
                                                        className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/80 text-white
                                                            hover:bg-red-600 disabled:opacity-40 transition-colors"
                                                    >{deleteLoading ? "..." : "Ya"}</button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(null)}
                                                        className="px-2 py-0.5 text-[10px] rounded text-muted-foreground hover:text-foreground transition-colors"
                                                    >Batal</button>
                                                </div>
                                            )}
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
                    <p className="ds-body">No providers configured</p>
                    <p className="ds-small mt-1">Provider config will be populated after CF deployment</p>
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
                                        <span className="ds-label uppercase tracking-wider block mb-2">Capabilities</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(caps).map(([cap, val]) => (
                                                <span key={cap} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                    val ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
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
                                        <span className="ds-label uppercase tracking-wider block mb-2">Subscription</span>
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

// Parse error string — handle raw JSON dari data lama
// Contoh lama: 'MaxChat HTTP 403: {"statusCode":403,"error":"Forbidden","message":"Account is expired"}'
// Contoh baru: 'MaxChat HTTP 403: Account is expired'
function parseError(err: string | null | undefined): string {
    if (!err) return '';
    const jsonMatch = err.match(/: (\{.*\})$/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            const prefix = err.substring(0, err.indexOf(': {'));
            const msg = parsed.message || parsed.error || jsonMatch[1];
            return `${prefix}: ${msg}`;
        } catch { /* bukan valid JSON */ }
    }
    return err;
}

// Format WhatsApp-style text → HTML
// *bold* → <strong>, _italic_ → <em>, line breaks preserved
function formatWAText(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/```([^`]+)```/g, '<code class="bg-muted/20 px-1 rounded">$1</code>')
        ;
}

/* ═══════════════════════════════════════════════════
   Tab 4: Logs — BQ Delivery Log Viewer
   ═══════════════════════════════════════════════════ */

interface DeliveryLogRow {
    event_id: string;
    pubsub_message_id: string | null;
    group_key: string;
    group_name: string | null;
    chat_id: string;
    source: string;
    channel: string;
    type: string;
    text: string | null;
    provider: string;
    status: 'delivered' | 'failed' | 'skipped' | 'dropped';
    provider_message_id: string | null;
    error: string | null;
    priority: string | null;
    duration_ms: number | null;
    enqueued_at: unknown;  // BQ SDK returns { value: "..." } object
    delivered_at: unknown;
    image_gcs_path: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    delivered: { bg: 'bg-green-500/10', text: 'text-green-400', icon: <CheckCircle className="h-3 w-3" /> },
    failed: { bg: 'bg-red-500/10', text: 'text-red-400', icon: <XCircle className="h-3 w-3" /> },
    skipped: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: <AlertTriangle className="h-3 w-3" /> },
    dropped: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', icon: <XCircle className="h-3 w-3" /> },
};

const PAGE_SIZE = 25;

function TabLogs({ groups }: { groups?: Record<string, GroupEntry> }) {
    // Reverse map: chat_id → group key + group name
    const chatIdMap = useMemo(() => {
        const map: Record<string, { key: string; name: string }> = {};
        if (!groups) return map;
        for (const [key, g] of Object.entries(groups)) {
            if (g.wa_chat_id) map[g.wa_chat_id] = { key, name: g.wa_group_name || key };
            if (g.tg_chat_id) map[g.tg_chat_id] = { key, name: g.tg_group_name || key };
        }
        return map;
    }, [groups]);
    const [rows, setRows] = useState<DeliveryLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const fetchLogs = useCallback(async (filterStatus: string, pageOffset: number) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String(pageOffset),
            });
            if (filterStatus) params.set('status', filterStatus);

            const url = `${CLOUD_CONSOLE_API}/services/notifier/actions/delivery-logs?${params}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');

            setRows(data.rows || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs(statusFilter, offset);
    }, [fetchLogs, statusFilter, offset]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

    // BQ SDK returns TIMESTAMP sebagai { value: "2026-..." } atau string biasa
    const formatTime = (raw: unknown) => {
        try {
            const iso = typeof raw === 'object' && raw !== null && 'value' in raw
                ? String((raw as { value: string }).value)
                : String(raw);
            const d = new Date(iso);
            if (isNaN(d.getTime())) return String(raw);
            // Convert ke WIB (UTC+7)
            const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
            const dd = String(wib.getUTCDate()).padStart(2, '0');
            const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
            const mm = months[wib.getUTCMonth()];
            const hh = String(wib.getUTCHours()).padStart(2, '0');
            const mi = String(wib.getUTCMinutes()).padStart(2, '0');
            const ss = String(wib.getUTCSeconds()).padStart(2, '0');
            return `${dd} ${mm} ${hh}:${mi}:${ss}`;
        } catch { return String(raw); }
    };


    return (
        <div className="space-y-4">
            {/* Header + Filter */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">Delivery Logs</h3>
                    <span className="ds-small">
                        {total.toLocaleString()} total
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Status filter pills */}
                    {['', 'delivered', 'failed', 'skipped', 'dropped'].map((s) => (
                        <button
                            key={s || 'all'}
                            onClick={() => { setStatusFilter(s); setOffset(0); }}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                statusFilter === s
                                    ? 'border-primary/50 bg-primary/10 text-primary'
                                    : 'border-border/30 text-muted-foreground/50 hover:text-muted-foreground hover:border-border/50'
                            }`}
                        >
                            {s || 'All'}
                        </button>
                    ))}
                    {/* Refresh */}
                    <button
                        onClick={() => fetchLogs(statusFilter, offset)}
                        disabled={loading}
                        className="p-1.5 rounded-md border border-border/30 text-muted-foreground/50 hover:text-muted-foreground hover:border-border/50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span className="text-xs text-red-300">{error}</span>
                </div>
            )}

            {/* Table */}
            <div className="rounded-lg border border-border/30 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-muted/10 border-b border-border/20">
                            <th className="text-left px-3 py-2 ds-label w-[130px]">Time (WIB)</th>
                            <th className="text-left px-3 py-2 ds-label">Group</th>
                            <th className="text-left px-3 py-2 ds-label w-[55px]">Ch</th>
                            <th className="text-left px-3 py-2 ds-label w-[60px]">Type</th>
                            <th className="text-left px-3 py-2 ds-label w-[80px]">Source</th>
                            <th className="text-left px-3 py-2 ds-label w-[85px]">Status</th>
                            <th className="text-left px-3 py-2 ds-label w-[60px]">ms</th>
                            <th className="text-left px-3 py-2 ds-label">Message</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                        {loading && rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center">
                                    <Loader2 className="h-5 w-5 text-muted-foreground/30 animate-spin mx-auto" />
                                </td>
                            </tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center">
                                    <ScrollText className="h-8 w-8 text-muted-foreground/15 mx-auto mb-2" />
                                    <p className="ds-small">No delivery logs yet</p>
                                </td>
                            </tr>
                        )}
                        {rows.map((row) => {
                            const style = STATUS_STYLES[row.status] || STATUS_STYLES.dropped;
                            const isExpanded = expandedRow === row.event_id;
                            return (
                                <React.Fragment key={row.event_id}>
                                    <tr
                                        onClick={() => setExpandedRow(isExpanded ? null : row.event_id)}
                                        className={`cursor-pointer transition-colors hover:bg-muted/5 ${
                                            isExpanded ? 'bg-muted/10' : ''
                                        }`}
                                    >
                                        <td className="px-3 py-2 ds-small font-mono">
                                            {formatTime(row.delivered_at)}
                                        </td>
                                        <td className="px-3 py-2 font-medium">{row.group_name || row.group_key}</td>
                                        <td className="px-3 py-2 ds-small">{row.channel}</td>
                                        <td className="px-3 py-2 ds-small">{row.type}</td>
                                        <td className="px-3 py-2 ds-small">{row.source}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
                                                {style.icon} {row.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 ds-small font-mono text-muted-foreground/60">
                                            {row.duration_ms != null ? row.duration_ms : '—'}
                                        </td>
                                        <td className="px-3 py-2 ds-small truncate max-w-[200px]">
                                            {row.error
                                                ? <span className="text-red-400/80">{parseError(row.error)}</span>
                                                : (row.text || '—').substring(0, 60)}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr key={`${row.event_id}-detail`}>
                                            <td colSpan={8} className="px-4 py-3 bg-muted/5 border-t border-border/10">
                                                <div className="flex gap-6">
                                                    {/* Left: Metadata */}
                                                    <div className="flex-shrink-0 space-y-1 min-w-[320px]">
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Event ID</span>
                                                            <span className="ds-small font-mono">{row.event_id}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Pub/Sub Msg ID</span>
                                                            <span className="ds-small font-mono">{row.pubsub_message_id || '—'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Group</span>
                                                            <span className="ds-small">{row.group_name || row.group_key}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Chat ID</span>
                                                            <span className="ds-small font-mono">{row.chat_id}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Channel</span>
                                                            <span className="ds-small">{row.channel}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Priority</span>
                                                            <span className="ds-small">{row.priority || 'normal'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Provider</span>
                                                            <span className="ds-small">{row.provider}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Provider Msg ID</span>
                                                            <span className="ds-small font-mono">{row.provider_message_id || '—'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Duration</span>
                                                            <span className="ds-small font-mono">{row.duration_ms != null ? `${row.duration_ms} ms` : '—'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Enqueued</span>
                                                            <span className="ds-small font-mono">{formatTime(row.enqueued_at)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                            <span className="ds-label">Delivered</span>
                                                            <span className="ds-small font-mono">{formatTime(row.delivered_at)}</span>
                                                        </div>
                                                        {row.image_gcs_path && (
                                                            <div className="flex items-center justify-between py-1 border-b border-border/30">
                                                                <span className="ds-label">Image</span>
                                                                <span className="ds-small font-mono text-blue-400 truncate max-w-[180px]">{row.image_gcs_path}</span>
                                                            </div>
                                                        )}
                                                        {row.error && (
                                                            <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/10">
                                                                <span className="text-red-400 text-[10px] uppercase tracking-wider font-medium">Error</span>
                                                                <div className="text-red-400 font-mono text-xs mt-0.5">{parseError(row.error)}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Right: Message Preview */}
                                                    {row.text && (
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Message Preview</span>
                                                            <div
                                                                className="mt-1 p-3 rounded-lg bg-background/50 border border-border/20 text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto"
                                                                dangerouslySetInnerHTML={{ __html: formatWAText(row.text) }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between ds-small">
                    <span>Page {currentPage} of {totalPages}</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                            disabled={offset === 0}
                            className="px-2 py-1 rounded border border-border/30 hover:border-border/50 disabled:opacity-30 transition-colors"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => setOffset(offset + PAGE_SIZE)}
                            disabled={currentPage >= totalPages}
                            className="px-2 py-1 rounded border border-border/30 hover:border-border/50 disabled:opacity-30 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            {/* Info footer */}
            <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-3 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-300/70 leading-relaxed">
                    Data dari BigQuery <code className="font-mono bg-muted/30 px-1 py-0.5 rounded">dispatch.delivery_log</code>.
                    Untuk system logs real-time, gunakan <strong>LogPanel</strong> di sidebar.
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
    const [testType, setTestType] = useState("text");
    const [testMessage, setTestMessage] = useState("");
    const [sendingTest, setSendingTest] = useState(false);

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
        if (!testMessage.trim()) {
            showFeedback("Enter a test message", false);
            return;
        }
        setSendingTest(true);
        try {
            const res = await fetch(`/api/console/services/notifier/actions/test-send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: testMessage.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showFeedback(`Event triggered via Eventarc (Maintenance)`, true);
                injectLog("notifier", `[TEST] Event triggered: ${data.event_id}`, "success");
            } else {
                showFeedback(`Test failed: ${data.error || "unknown"}`, false);
            }
        } catch (e) {
            showFeedback(`Network error: ${(e as Error).message}`, false);
        } finally {
            setSendingTest(false);
        }
    }, [testMessage, showFeedback, injectLog]);

    return (
        <div className="space-y-5">
            {/* Kill Switch */}
            <ServiceSection title="Kill Switch" icon={<Shield className="h-3.5 w-3.5" />} noCollapse>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[12px] font-medium text-foreground">IS_ACTIVE</div>
                        <div className="ds-small">Master switch — all deliveries blocked when OFF</div>
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
                        <div className="opacity-60 grayscale-[0.5]">
                            <label className="ds-label mb-1 block">Group Target</label>
                            <div className="h-8 px-3 flex items-center text-[11px] font-mono rounded-md border border-border/50 bg-muted/20 text-blue-400">
                                maintenance (locked)
                            </div>
                        </div>
                        <div>
                            <label className="ds-label mb-1 block">Type</label>
                            <select
                                value={testType}
                                onChange={e => setTestType(e.target.value)}
                                className="w-full h-8 px-3 text-[12px] rounded-md border border-border/50
                                    bg-muted/20 text-foreground/80 outline-none"
                            >
                                <option value="text">Text Only</option>
                                <option disabled value="image">Image (Coming Soon)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="ds-label mb-1 block">Message</label>
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
            <label className="ds-label mb-1 block">{label}</label>
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
                <span className="ds-small whitespace-nowrap">{unit}</span>
            </div>
        </div>
    );
}
