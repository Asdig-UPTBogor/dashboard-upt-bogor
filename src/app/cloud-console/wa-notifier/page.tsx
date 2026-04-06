"use client";

/**
 * WA Notifier — WhatsApp Gateway Management Page (Enhanced)
 *
 * Vercel-style flat design — consistent with spreadsheet-sync page.
 * Reads config from Firestore via Cloud Console generic API routes.
 * All values from Firestore, zero hardcoded operational values.
 *
 * Sections:
 *   1. Header — service name, health badge
 *   2. Control Bar — IS_ACTIVE toggle, provider badge, test send, reload
 *   3. Live Health — on-demand /health from CR (stats, busy state, provider)
 *   4. Tuning — cooldown, restart threshold, max attempts (editable)
 *   5. Provider Info — MaxChat endpoints (read-only display)
 *   6. Info Card — cara kerja
 */

import { useState, useEffect, useCallback } from "react";
import {
    MessageSquare, RefreshCw, Wifi, WifiOff,
    Activity, Settings, Send, FlaskConical,
    ToggleRight, ToggleLeft,
    Timer, Shield, Zap, Heart,
    CheckCircle, XCircle, Clock, AlertTriangle,
    TrendingUp, Radio,
} from "lucide-react";
import { useFirestoreConfig } from "../_components/useFirestore";
import { useFirestoreContext } from "../_components/FirestoreProvider";

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface WaNotifierConfig {
    IS_ACTIVE: boolean;
    WA_PROVIDER: string;
    MAXCHAT_API_URL: string;
    MAXCHAT_BUSY_URL: string;
    MAXCHAT_RESTART_URL: string;
    MAXCHAT_PING_URL: string;
    MAXCHAT_TOKEN: string;
    COOLDOWN_TEXT: number;
    COOLDOWN_MEDIA: number;
    MAX_ATTEMPTS: number;
    AUTO_RESTART_THRESHOLD: number;
    MAX_RESTART_PER_HOUR: number;
    RESTART_RECOVERY: number;
    CLOUD_TASKS_QUEUE: string;
    CLOUD_TASKS_LOCATION: string;
    _cr_infra?: {
        serviceName?: string;
        region?: string;
        memory?: string;
        url?: string;
    };
}

/** Health response from WA Notifier CR /health endpoint */
interface CrHealthData {
    ok: boolean;
    provider: string;
    provider_reachable: boolean;
    provider_busy: boolean;
    provider_status: string;
    stats: {
        totalSent: number;
        totalFailed: number;
        totalBusy: number;
        totalEnqueued: number;
        lastSentAt: string | null;
        lastFailedAt: string | null;
        startedAt: string;
        successRate: string;
    };
    busy_state: {
        isBusy: boolean;
        busySinceMs: number | null;
        busyCount: number;
        restartsThisHour: number;
    };
    timestamp: string;
    offline?: boolean;
}

/* ═══════════════════════════════════════════════════
   API helpers
   ═══════════════════════════════════════════════════ */

import { CLOUD_CONSOLE_API } from "@/lib/cloud-console-api";

const CONFIG_API = `${CLOUD_CONSOLE_API}/services/notifier/config`;
const HEALTH_API = `${CLOUD_CONSOLE_API}/services/notifier/actions/health`;
const TEST_SEND_API = `${CLOUD_CONSOLE_API}/services/notifier/actions/test-send`;

async function fetchHealth(): Promise<CrHealthData | null> {
    try {
        const res = await fetch(HEALTH_API);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function patchConfig(fields: Record<string, unknown>): Promise<boolean> {
    try {
        const res = await fetch(CONFIG_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        });
        const data = await res.json();
        return !!data.ok;
    } catch {
        return false;
    }
}

async function sendTestMessage(): Promise<{ ok: boolean; detail?: string; message_key?: string }> {
    try {
        const res = await fetch(TEST_SEND_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        return await res.json();
    } catch {
        return { ok: false, detail: "Request failed" };
    }
}

/* ═══════════════════════════════════════════════════
   Format helpers
   ═══════════════════════════════════════════════════ */

function fmtBool(v: unknown): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.toUpperCase() === "TRUE" || v === "1";
    return false;
}

function fmtNum(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function fmtAge(isoStr: string): string {
    const ms = Date.now() - new Date(isoStr).getTime();
    if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
    return `${Math.round(ms / 86_400_000)}d ago`;
}

/* ═══════════════════════════════════════════════════
   Reusable UI Components
   ═══════════════════════════════════════════════════ */

function Stat({ label, value, unit, color }: {
    label: string; value: string | number; unit?: string; color?: string;
}) {
    return (
        <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground/50">{label}</span>
            <span className={`font-mono tabular-nums ${color || "text-foreground/80"}`}>{value}</span>
            {unit && <span className="text-muted-foreground/40 text-[10px]">{unit}</span>}
        </div>
    );
}

function TuneField({ label, value, unit, onChange, min = 1, max = 999 }: {
    label: string; value: number; unit: string;
    onChange: (v: number) => void; min?: number; max?: number;
}) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-40 shrink-0">{label}</span>
            <div className="flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-1">
                <input type="text" inputMode="numeric"
                    value={String(value)}
                    onFocus={e => e.currentTarget.select()}
                    onChange={e => {
                        const raw = e.target.value.replace(/[^\d]/g, "");
                        const n = Math.max(min, Math.min(max, parseInt(raw) || min));
                        onChange(n);
                    }}
                    className="w-12 bg-transparent text-xs font-mono tabular-nums text-foreground outline-none text-center"
                />
                <span className="text-[10px] text-muted-foreground">{unit}</span>
            </div>
        </div>
    );
}

function ConfigDisplay({ label, value, masked }: {
    label: string; value: string; masked?: boolean;
}) {
    const [visible, setVisible] = useState(!masked);
    const display = masked && !visible ? "••••••••" : (value || "—");

    return (
        <div>
            <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">{label}</label>
            <div className="relative group">
                <div className="w-full h-7 pl-3 pr-8 flex items-center text-[11px] font-mono rounded-md border border-border/40 bg-muted/20 text-foreground/60 overflow-hidden select-none">
                    <span className="truncate">{display}</span>
                </div>
                {masked && value && (
                    <button type="button" onClick={() => setVisible(!visible)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 opacity-40 hover:opacity-100 transition-opacity text-muted-foreground text-[10px]">
                        {visible ? "hide" : "show"}
                    </button>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Health Status
   ═══════════════════════════════════════════════════ */

type Health = "online" | "offline" | "loading";

const HC: Record<Health, { dot: string; text: string; label: string }> = {
    online:  { dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]", text: "text-emerald-400", label: "Online" },
    offline: { dot: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]", text: "text-red-400", label: "Offline" },
    loading: { dot: "bg-slate-500 animate-pulse", text: "text-slate-400", label: "Loading..." },
};

/* ═══════════════════════════════════════════════════
   Live Health Stats Card
   ═══════════════════════════════════════════════════ */

function HealthPanel({ data, loading, onRefresh }: {
    data: CrHealthData | null;
    loading: boolean;
    onRefresh: () => void;
}) {
    if (loading) {
        return (
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    Pinging WA Notifier CR... (cold start ~2s)
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-red-400">
                        <XCircle className="h-3.5 w-3.5" />
                        CR Unreachable — mungkin sedang sleep atau error
                    </div>
                    <button onClick={onRefresh}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const { stats, busy_state } = data;
    const uptime = fmtAge(stats.startedAt);

    return (
        <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Heart className="h-3 w-3" /> MaxChat Provider · Live
                    <span className="text-[9px] font-normal text-muted-foreground/40 normal-case tracking-normal ml-1">auto-refresh 30s</span>
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/50">
                        Updated {fmtAge(data.timestamp)}
                    </span>
                    <button onClick={onRefresh}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/50 hover:border-border">
                        ↻
                    </button>
                </div>
            </div>

            {/* Provider status + Busy */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    {data.provider_reachable
                        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span className="text-xs text-foreground/80">
                        MaxChat {data.provider_reachable ? "Reachable" : "Unreachable"}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {data.provider_busy
                        ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        : <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                    <span className={`text-xs ${data.provider_busy ? "text-amber-400" : "text-foreground/80"}`}>
                        {data.provider_busy ? "Busy" : "Ready"}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground">Uptime {uptime}</span>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Enqueued" value={stats.totalEnqueued} icon={<Send className="h-3 w-3" />} color="text-blue-400" />
                <StatCard label="Sent" value={stats.totalSent} icon={<CheckCircle className="h-3 w-3" />} color="text-emerald-400" />
                <StatCard label="Failed" value={stats.totalFailed} icon={<XCircle className="h-3 w-3" />} color={stats.totalFailed > 0 ? "text-red-400" : "text-muted-foreground/50"} />
                <StatCard label="Busy Hits" value={stats.totalBusy} icon={<AlertTriangle className="h-3 w-3" />} color={stats.totalBusy > 0 ? "text-amber-400" : "text-muted-foreground/50"} />
                <StatCard label="Success Rate" value={stats.successRate} icon={<TrendingUp className="h-3 w-3" />} color="text-emerald-400" />
            </div>

            {/* Busy state detail */}
            {busy_state.isBusy && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                    <Radio className="h-3.5 w-3.5 animate-pulse" />
                    MaxChat sedang BUSY — retry otomatis berjalan, restarts jam ini: {busy_state.restartsThisHour}
                </div>
            )}

            {/* Last activity */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50">
                {stats.lastSentAt && <span>Last sent: {fmtAge(stats.lastSentAt)}</span>}
                {stats.lastFailedAt && <span>Last failed: {fmtAge(stats.lastFailedAt)}</span>}
                {!stats.lastSentAt && !stats.lastFailedAt && <span>Belum ada pengiriman sejak instance start</span>}
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color }: {
    label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
    return (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/30">
            <div className={color}>{icon}</div>
            <div>
                <div className={`text-sm font-bold font-mono tabular-nums ${color}`}>{value}</div>
                <div className="text-[9px] text-muted-foreground/50">{label}</div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════ */

export default function WaNotifierPage() {

    /* ── State ── */
    const [config, setConfig] = useState<Partial<WaNotifierConfig>>({});
    const [configLoading, setConfigLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

    /* Health state */
    const [healthData, setHealthData] = useState<CrHealthData | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);

    /* Test send state */
    const [testSending, setTestSending] = useState(false);

    /* ── Derived values ── */
    const isActive = fmtBool(config.IS_ACTIVE);
    const provider = (config.WA_PROVIDER as string) || "maxchat";
    const cooldownText = fmtNum(config.COOLDOWN_TEXT, 5);
    const cooldownMedia = fmtNum(config.COOLDOWN_MEDIA, 15);
    const maxAttempts = fmtNum(config.MAX_ATTEMPTS, 5);
    const autoRestartThreshold = fmtNum(config.AUTO_RESTART_THRESHOLD, 120);
    const maxRestartPerHour = fmtNum(config.MAX_RESTART_PER_HOUR, 2);
    const restartRecovery = fmtNum(config.RESTART_RECOVERY, 15);
    const health: Health = configLoading ? "loading" : isActive ? "online" : "offline";
    const hc = HC[health];

    /* ── Tuning state ── */
    const [tuning, setTuning] = useState({
        COOLDOWN_TEXT: cooldownText,
        COOLDOWN_MEDIA: cooldownMedia,
        MAX_ATTEMPTS: maxAttempts,
        AUTO_RESTART_THRESHOLD: autoRestartThreshold,
        MAX_RESTART_PER_HOUR: maxRestartPerHour,
        RESTART_RECOVERY: restartRecovery,
    });

    /* ── Real-time Config via Context ── */
    const fsConfig = useFirestoreConfig<Partial<WaNotifierConfig>>('notifier');
    const { isLoadingConfigs } = useFirestoreContext();

    useEffect(() => {
        // Wait for FirestoreProvider to finish loading the collection
        if (isLoadingConfigs) return;

        // Once loaded, set config (even if null/empty — doc might not exist yet)
        if (fsConfig) {
            setConfig(fsConfig);
            if (configLoading) {
                setTuning({
                    COOLDOWN_TEXT: fmtNum(fsConfig.COOLDOWN_TEXT, 5),
                    COOLDOWN_MEDIA: fmtNum(fsConfig.COOLDOWN_MEDIA, 15),
                    MAX_ATTEMPTS: fmtNum(fsConfig.MAX_ATTEMPTS, 5),
                    AUTO_RESTART_THRESHOLD: fmtNum(fsConfig.AUTO_RESTART_THRESHOLD, 120),
                    MAX_RESTART_PER_HOUR: fmtNum(fsConfig.MAX_RESTART_PER_HOUR, 2),
                    RESTART_RECOVERY: fmtNum(fsConfig.RESTART_RECOVERY, 15),
                });
                setDirty(false);
            }
        }
        // Stop loading regardless (doc exists or not)
        setConfigLoading(false);
    }, [fsConfig, configLoading, isLoadingConfigs]);

    /* ── Load health (on-demand) ── */
    const loadHealth = useCallback(async () => {
        setHealthLoading(true);
        const data = await fetchHealth();
        setHealthData(data);
        setHealthLoading(false);
    }, []);

    useEffect(() => {
        loadHealth(); // Initial fetch
        // Auto-refresh health every 30 seconds while page is open
        const interval = setInterval(loadHealth, 30_000);
        return () => clearInterval(interval);
    }, [loadHealth]);

    /* ── Feedback ── */
    const showFeedback = useCallback((msg: string, ok: boolean) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 4000);
    }, []);

    /* ── Actions ── */
    const toggleActive = useCallback(async () => {
        const newValue = !isActive;
        setSaving(true);
        const ok = await patchConfig({ IS_ACTIVE: newValue });
        if (ok) {
            setConfig(prev => ({ ...prev, IS_ACTIVE: newValue }));
            showFeedback(`WA Notifier ${newValue ? "activated" : "deactivated"}`, true);
        } else {
            showFeedback("Failed to update IS_ACTIVE", false);
        }
        setSaving(false);
    }, [isActive, showFeedback]);

    const handleSaveTuning = useCallback(async () => {
        setSaving(true);
        const ok = await patchConfig(tuning);
        if (ok) {
            setConfig(prev => ({ ...prev, ...tuning }));
            setDirty(false);
            showFeedback("Tuning params saved to Firestore", true);
        } else {
            showFeedback("Failed to save tuning params", false);
        }
        setSaving(false);
    }, [tuning, showFeedback]);

    const updateTuning = useCallback((key: keyof typeof tuning, value: number) => {
        setTuning(prev => ({ ...prev, [key]: value }));
        setDirty(true);
    }, []);

    const handleRefresh = useCallback(async () => {
        await loadHealth();
        showFeedback("Health reloaded (Config is real-time)", true);
    }, [loadHealth, showFeedback]);

    const handleTestSend = useCallback(async () => {
        setTestSending(true);
        const result = await sendTestMessage();
        if (result.ok) {
            showFeedback(`✅ Test message queued: ${result.message_key?.substring(0, 8)}...`, true);
        } else {
            showFeedback(`❌ Test send failed: ${result.detail || "Unknown error"}`, false);
        }
        setTestSending(false);
    }, [showFeedback]);

    /* ── Loading ── */
    if (configLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
                <span className="text-sm text-muted-foreground">Loading WA Notifier config...</span>
            </div>
        );
    }

    /* ═══════════════════════════════════════════════════
       Render
       ═══════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">

            {/* Toast */}
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
                        <div className="absolute -inset-1 rounded-2xl bg-linear-to-br from-emerald-500 to-green-600 opacity-20 blur-lg" />
                        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-green-600">
                            <MessageSquare className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground">WA Notifier</h1>
                        <p className="text-xs text-muted-foreground">
                            WhatsApp Gateway · {provider === "maxchat" ? "MaxChat" : provider.toUpperCase()} · Cloud Tasks
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-2 text-xs font-medium ${hc.text}`}>
                    <span className={`h-2 w-2 rounded-full ${hc.dot}`} />
                    {hc.label}
                </div>
            </div>

            {/* ═══════════ Control Bar ═══════════ */}
            <div className="border-y border-border py-4 mb-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    {/* IS_ACTIVE toggle */}
                    <button onClick={toggleActive} disabled={saving}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            isActive
                                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                : "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        }`}>
                        {isActive
                            ? <><ToggleRight className="h-3.5 w-3.5" />Active</>
                            : <><ToggleLeft className="h-3.5 w-3.5" />Inactive</>}
                    </button>

                    {/* Provider badge */}
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                        provider === "maxchat"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    }`}>
                        <Send className="h-3 w-3" />
                        {provider === "maxchat" ? "MaxChat" : provider.toUpperCase()}
                    </div>

                    <div className="w-px h-6 bg-border" />

                    {/* Test Send */}
                    <button onClick={handleTestSend} disabled={testSending || !isActive}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                        {testSending
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <FlaskConical className="h-3.5 w-3.5" />}
                        {testSending ? "Sending..." : "Test Send"}
                    </button>

                    {/* Reload */}
                    <button onClick={handleRefresh}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-all">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reload
                    </button>

                    {/* Queue / region info */}
                    <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="text-muted-foreground/50">Queue</span>
                            <span className="font-mono text-foreground/70">{config.CLOUD_TASKS_QUEUE || "wa-notifier-queue"}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-muted-foreground/50">Region</span>
                            <span className="font-mono text-foreground/70">{config.CLOUD_TASKS_LOCATION || "asia-southeast2"}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══════════ Stats Summary ═══════════ */}
            <div className="flex items-center gap-6 mb-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-emerald-400/60" />
                    <Stat label="Provider" value={provider === "maxchat" ? "MaxChat" : provider} />
                </div>
                <div className="flex items-center gap-1.5">
                    {isActive
                        ? <Wifi className="h-3.5 w-3.5 text-emerald-400/60" />
                        : <WifiOff className="h-3.5 w-3.5 text-red-400/60" />}
                    <Stat label="Status" value={isActive ? "Ready" : "Disabled"} color={isActive ? "text-emerald-400" : "text-red-400"} />
                </div>
                <Stat label="Text Cooldown" value={`${cooldownText}s`} />
                <Stat label="Media Cooldown" value={`${cooldownMedia}s`} />
                <Stat label="Max Attempts" value={maxAttempts} />

                {config._cr_infra && (
                    <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground/50">
                        {config._cr_infra.serviceName && <span className="font-mono">{config._cr_infra.serviceName}</span>}
                        {config._cr_infra.memory && <span>{config._cr_infra.memory}</span>}
                        {config._cr_infra.region && <span>{config._cr_infra.region}</span>}
                    </div>
                )}
            </div>

            {/* ═══════════ Live Health Panel ═══════════ */}
            <div className="mb-6">
                <HealthPanel data={healthData} loading={healthLoading} onRefresh={loadHealth} />
            </div>

            {/* ═══════════ Tuning Section ═══════════ */}
            <div className="border-t border-border pt-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        Delivery Tuning
                    </h2>
                    {dirty && (
                        <button onClick={handleSaveTuning} disabled={saving}
                            className="px-3 py-1 rounded text-[11px] font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50">
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/10">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Timer className="h-3 w-3" /> Smart Cooldown
                        </h3>
                        <TuneField label="Text cooldown" value={tuning.COOLDOWN_TEXT} unit="sec"
                            onChange={v => updateTuning("COOLDOWN_TEXT", v)} min={1} max={60} />
                        <TuneField label="Media cooldown" value={tuning.COOLDOWN_MEDIA} unit="sec"
                            onChange={v => updateTuning("COOLDOWN_MEDIA", v)} min={5} max={120} />
                        <TuneField label="Max attempts" value={tuning.MAX_ATTEMPTS} unit="times"
                            onChange={v => updateTuning("MAX_ATTEMPTS", v)} min={1} max={20} />
                    </div>

                    <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/10">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Zap className="h-3 w-3" /> Auto-Restart (WF Tukang Surat v3.1)
                        </h3>
                        <TuneField label="Busy threshold" value={tuning.AUTO_RESTART_THRESHOLD} unit="sec"
                            onChange={v => updateTuning("AUTO_RESTART_THRESHOLD", v)} min={30} max={600} />
                        <TuneField label="Max restart/hour" value={tuning.MAX_RESTART_PER_HOUR} unit="times"
                            onChange={v => updateTuning("MAX_RESTART_PER_HOUR", v)} min={1} max={10} />
                        <TuneField label="Recovery wait" value={tuning.RESTART_RECOVERY} unit="sec"
                            onChange={v => updateTuning("RESTART_RECOVERY", v)} min={5} max={60} />
                    </div>
                </div>
            </div>

            {/* ═══════════ Provider Config ═══════════ */}
            <div className="border-t border-border pt-6 mb-6">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Provider Configuration
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ConfigDisplay label="Messages API" value={config.MAXCHAT_API_URL || ""} />
                    <ConfigDisplay label="Busy Check" value={config.MAXCHAT_BUSY_URL || ""} />
                    <ConfigDisplay label="Restart Endpoint" value={config.MAXCHAT_RESTART_URL || ""} />
                    <ConfigDisplay label="Ping / Health" value={config.MAXCHAT_PING_URL || ""} />
                    <ConfigDisplay label="API Token" value={config.MAXCHAT_TOKEN || ""} masked />
                    <ConfigDisplay label="Provider" value={provider} />
                </div>
            </div>

            {/* ═══════════ Info Card ═══════════ */}
            <div className="border-t border-border pt-6">
                <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0 mt-0.5">
                            <MessageSquare className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-[12px] font-semibold text-foreground mb-1">Cara Kerja</h3>
                            <ul className="text-[11px] text-muted-foreground space-y-1">
                                <li>• Service lain kirim <strong className="text-foreground/80">POST /send</strong> → Notifier push ke <strong className="text-foreground/80">Cloud Tasks queue</strong></li>
                                <li>• Cloud Tasks dispatch serial → Notifier kirim ke <strong className="text-foreground/80">{provider === "maxchat" ? "MaxChat" : provider}</strong></li>
                                <li>• MaxChat busy? → <strong className="text-foreground/80">Smart Retry</strong> (attempt tidak habis) + Auto-Restart setelah {autoRestartThreshold}s</li>
                                <li>• Tuning di atas bisa diubah online — simpan ke <strong className="text-foreground/80">Firestore</strong>, CR baca saat proses</li>
                                <li>• <strong className="text-foreground/80">Test Send</strong> kirim pesan tes ke grup maintenance — verifikasi pipeline end-to-end</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground/30 font-mono">
                    wa-notifier · {config._cr_infra?.region || "asia-southeast2"} · cloud-run · cloud-tasks · on-demand health
                </p>
            </div>
        </div>
    );
}
