"use client";

/**
 * FlowDiagram — Arsitektur Dispatch lengkap.
 *
 * 4 section:
 *   1. OUTBOUND FLOW — Publisher → Pub/Sub → Dispatch (D0-D5) → Gateway (3) → Destination
 *   2. INBOUND FLOW  — User reply → Gateway → Dispatch (W0-W7) webhook → BQ log
 *   3. DATA STORAGE  — Firestore & BigQuery tempat data nyangkut
 *   4. RECENT ACTIVITY — realtime feed N event terakhir
 *
 * Realtime: config dari Firestore onSnapshot (auto-update). Recent feed poll BQ 15s.
 * Zero hardcode — semua label resource dari service-reporter FS.
 */

import { useEffect, useState } from 'react';
import { ChevronRight, Database, Cloud, Server } from 'lucide-react';
import type { DispatchConfig, WahaStatus, DeliveryLogRow } from '../../_lib/types';
import { fmtAgo, fetchDeliveryLogs } from '../../_lib/api';

export interface LastActivity {
    /** Nama platform publisher (e.g. "thor-gen3") */
    source: string;
    /** Alias group di config Dispatch (e.g. "thor_alert") */
    groupKey: string;
    /** Nama WA group asli (e.g. "Lightning Monitoring UPT Bogor") */
    groupName: string;
    /** Jabber ID chat WA (e.g. "120363...@g.us") */
    chatId: string;
    /** Tipe pesan yang dikirim (text/image/document) */
    type: string;
    /** ISO timestamp */
    at: string;
}

interface FlowDiagramProps {
    config: DispatchConfig;
    primary: string;
    secondary: string;
    wagate: WahaStatus | null;
    waha: WahaStatus | null;
    lastActivity: LastActivity | null;
}

export function FlowDiagram({ config, primary, secondary, wagate, waha, lastActivity }: FlowDiagramProps) {
    const cfg = config as unknown as {
        pubsub_topic?: string; pubsub_subscription?: string; pubsub_ack_deadline?: number;
        pubsub_max_delivery?: number; pubsub_dlq_topic?: string;
        infra_revision?: string; infra_memory?: string;
        infra_min_instances?: number; infra_max_instances?: number;
    };

    const dispatchState = getDispatchState(config);
    const deliveredToday = config.TOTAL_DELIVERED_TODAY ?? 0;
    const failedToday = config.TOTAL_FAILED_TODAY ?? 0;
    const totalToday = deliveredToday + failedToday;
    const successRate = totalToday > 0 ? Math.round((deliveredToday / totalToday) * 100) : null;

    // Recent activity feed — poll 15s BQ delivery_log latest 5
    const [recent, setRecent] = useState<DeliveryLogRow[]>([]);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const { rows } = await fetchDeliveryLogs({ limit: 5 });
                if (!cancelled) setRecent(rows);
            } catch { /* non-fatal */ }
        };
        load();
        const id = setInterval(load, 15_000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    return (
        <div className="rounded-lg border border-border/50 bg-muted/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <span className="ds-label uppercase tracking-wider">Arsitektur Data Flow</span>
                <span className="ds-small text-muted-foreground/60">
                    outbound · inbound · storage · realtime activity
                </span>
            </div>

            {/* ═══ Section 1 · OUTBOUND FLOW ═══ */}
            <Section title="① Outbound — Platform → WhatsApp" sublabel="kirim pesan alert dari platform ke user">
                <div className="flex flex-wrap items-stretch gap-y-2 gap-x-1">
                    <Node
                        stage="A"
                        label="Platform Publisher"
                        rows={[
                            { mode: 'primary', text: lastActivity ? `Last: ${lastActivity.source}` : 'belum ada' },
                            { mode: 'sub', text: lastActivity ? `key: ${lastActivity.groupKey}` : 'menunggu publisher' },
                            { mode: 'footer', text: lastActivity ? fmtAgo(lastActivity.at) : '' },
                        ]}
                    />
                    <Arrow label="publish event" />
                    <Node
                        stage="B"
                        label="Antrian (Pub/Sub)"
                        rows={[
                            { mode: 'primary', text: cfg.pubsub_topic || '—', mono: true },
                            { mode: 'sub', text: cfg.pubsub_subscription ? `sub: ${cfg.pubsub_subscription}` : '—' },
                            { mode: 'footer', text: cfg.pubsub_ack_deadline ? `ACK ${cfg.pubsub_ack_deadline}s · retry ${cfg.pubsub_max_delivery ?? '—'}×` : '' },
                        ]}
                    />
                    <Arrow label="push" />
                    <Node
                        stage="C"
                        label="Dispatch D0-D5"
                        tone="action"
                        badge={dispatchState}
                        rows={[
                            { mode: 'primary', text: (cfg.infra_revision || '—').replace(/^dispatch-/, ''), mono: true },
                            { mode: 'sub', text: cfg.infra_memory ? `${cfg.infra_memory} · ${cfg.infra_min_instances ?? 0}–${cfg.infra_max_instances ?? '—'}` : '—' },
                            { mode: 'footer', text: successRate !== null ? `${successRate}% success today` : 'belum ada delivery' },
                        ]}
                    />
                    <Arrow label="HTTP sync" />
                    <GatewayStage primary={primary} secondary={secondary} wagate={wagate} waha={waha} />
                    <Arrow label="WS/API" />
                    <Node
                        stage="E"
                        label="Sampai di"
                        tone={failedToday > 0 ? 'warn' : 'ok'}
                        rows={[
                            { mode: 'primary', text: lastActivity?.groupName || 'WhatsApp' },
                            { mode: 'sub', text: `${deliveredToday} ✓ · ${failedToday} ✗ hari ini` },
                            { mode: 'footer', text: config.lastRun ? `last ${fmtAgo(config.lastRun)}` : '' },
                        ]}
                    />
                </div>
                <Legend>
                    D0-D5: parse → idempotency check → resolve group → send via gateway (retry 3× lalu fallback secondary) → log BQ → ACK Pub/Sub
                </Legend>
            </Section>

            {/* ═══ Section 2 · INBOUND FLOW ═══ */}
            <Section title="② Inbound — User reply → Log" sublabel="user kirim pesan balik ke bot, Dispatch catat">
                <div className="flex flex-wrap items-stretch gap-y-2 gap-x-1">
                    <Node stage="A" label="User WA" rows={[
                        { mode: 'primary', text: 'WhatsApp user' },
                        { mode: 'sub', text: 'reply ke bot' },
                    ]} />
                    <Arrow label="WebSocket" />
                    <Node stage="B" label="Gateway" rows={[
                        { mode: 'primary', text: primary, uppercase: true },
                        { mode: 'sub', text: 'terima event' },
                    ]} />
                    <Arrow label="HTTP HMAC" />
                    <Node
                        stage="C"
                        label="Dispatch W0-W7"
                        tone="action"
                        rows={[
                            { mode: 'primary', text: '/webhook', mono: true },
                            { mode: 'sub', text: 'verify HMAC · parse · route' },
                        ]}
                    />
                    <Arrow label="stream insert" />
                    <Node
                        stage="D"
                        label="Log BQ"
                        rows={[
                            { mode: 'primary', text: 'message_log' },
                            { mode: 'sub', text: 'direction=inbound' },
                        ]}
                    />
                </div>
                <Legend>
                    W0-W7: verify HMAC (dual-key wagate/waha) → parse via adapter sesuai provider → route by event type (message / ACK / session.status / group / call) → tulis BQ
                </Legend>
            </Section>

            {/* ═══ Section 3 · DATA STORAGE ═══ */}
            <Section title="③ Data Storage" sublabel="tempat data Dispatch nyangkut">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <StoragePanel icon={<Cloud className="h-3.5 w-3.5 text-amber-400/70" />} title="Firestore" rows={[
                        { k: 'config', v: 'service_runtime_configs/dispatch', note: 'IS_ACTIVE, PRIMARY/SECONDARY, groups' },
                        { k: 'idempotency', v: 'delivery_attempts/{msgId}', note: 'cap 3x attempt, TTL 24h' },
                        { k: 'acks', v: 'message_acks/{msgId}', note: 'ACK status dari WA' },
                        { k: 'fallback log', v: 'delivery_log_fallback/{eventId}', note: 'bila BQ insert gagal' },
                    ]} />
                    <StoragePanel icon={<Database className="h-3.5 w-3.5 text-blue-400/70" />} title="BigQuery" rows={[
                        { k: 'outbound audit', v: 'dispatch.delivery_log', note: '20+ kolom, partitioned by delivered_at' },
                        { k: 'inbound messages', v: 'waha.message_log', note: 'pesan masuk + outbound confirm' },
                        { k: 'system events', v: 'waha.event_log', note: 'session.status, groups.*, call' },
                    ]} />
                </div>
            </Section>

            {/* ═══ Section 4 · RECENT ACTIVITY ═══ */}
            <Section title="④ Recent Activity" sublabel="5 delivery terakhir · refresh 15 detik">
                <div className="rounded-md border border-border/40 bg-background">
                    {recent.length === 0 ? (
                        <div className="ds-small text-muted-foreground/60 p-3 text-center">Belum ada aktivitas.</div>
                    ) : (
                        <div className="divide-y divide-border/20">
                            {recent.map((r, i) => (
                                <RecentRow key={`${r.event_id}-${i}`} row={r} />
                            ))}
                        </div>
                    )}
                </div>
            </Section>
        </div>
    );
}

/* ── Stage 4 (outbound) · 3 gateway chip ─────────────────────── */

interface GatewayStageProps {
    primary: string; secondary: string;
    wagate: WahaStatus | null; waha: WahaStatus | null;
}

function GatewayStage({ primary, secondary, wagate, waha }: GatewayStageProps) {
    return (
        <div className="flex flex-col gap-1 min-w-[220px] max-w-[245px] shrink-0">
            <div className="flex items-center gap-1.5 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                <span className="ds-label uppercase tracking-wider text-[10px] text-muted-foreground/70">
                    D · Gateway
                </span>
            </div>
            <GatewayChip name="WaGate" role={roleOf('wagate', primary, secondary)} status={wagate} />
            <GatewayChip name="WAHA" role={roleOf('waha', primary, secondary)} status={waha} />
            <GatewayChip name="Telegram" role="future" status={null} />
        </div>
    );
}

function roleOf(key: string, primary: string, secondary: string): GatewayRole {
    if (primary === key) return 'primary';
    if (secondary === key) return 'secondary';
    return 'inactive';
}

type GatewayRole = 'primary' | 'secondary' | 'future' | 'inactive';

const ROLE_STYLE: Record<GatewayRole, { border: string; label: string; labelTone: string }> = {
    primary: { border: 'border-primary/40 bg-primary/5', label: 'PRIMARY', labelTone: 'bg-primary/10 text-primary' },
    secondary: { border: 'border-border/50 bg-background', label: 'SECONDARY', labelTone: 'bg-muted/30 text-muted-foreground' },
    future: { border: 'border-dashed border-border/30', label: 'FUTURE', labelTone: 'bg-amber-500/10 text-amber-400' },
    inactive: { border: 'border-border/30 bg-muted/10', label: '—', labelTone: 'bg-muted/20 text-muted-foreground/50' },
};

interface GatewayChipProps { name: string; role: GatewayRole; status: WahaStatus | null; }

function GatewayChip({ name, role, status }: GatewayChipProps) {
    const s = ROLE_STYLE[role];
    const connected = !!status?.connected;
    const dotColor = role === 'future' ? 'bg-muted-foreground/30'
        : role === 'primary' ? (connected ? 'bg-emerald-400' : 'bg-red-400')
        : role === 'secondary' ? (connected ? 'bg-emerald-400/70' : 'bg-slate-500')
        : 'bg-muted-foreground/30';
    return (
        <div className={`rounded-md border ${s.border} px-2 py-1.5`}>
            <div className="flex items-center justify-between gap-1.5 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-xs font-semibold uppercase truncate">{name}</span>
                </div>
                <span className={`text-[9px] font-medium px-1 rounded uppercase shrink-0 ${s.labelTone}`}>
                    {s.label}
                </span>
            </div>
            {role !== 'future' && role !== 'inactive' && status && (
                <div className="ds-small text-muted-foreground/70 text-[10px] truncate">
                    {status.bot?.name || '—'} · {status.status || '—'}
                </div>
            )}
            {role === 'future' && <div className="ds-small text-muted-foreground/60 text-[10px]">belum aktif</div>}
            {role === 'inactive' && <div className="ds-small text-muted-foreground/50 text-[10px]">tidak ter-assign</div>}
        </div>
    );
}

/* ── Data Storage panel ──────────────────────────────────────── */

interface StorageRow { k: string; v: string; note: string; }

interface StoragePanelProps {
    icon: React.ReactNode;
    title: string;
    rows: StorageRow[];
}

function StoragePanel({ icon, title, rows }: StoragePanelProps) {
    return (
        <div className="rounded-md border border-border/40 bg-background p-3">
            <div className="flex items-center gap-1.5 mb-2">
                {icon}
                <span className="ds-label uppercase tracking-wider">{title}</span>
            </div>
            <div className="space-y-1">
                {rows.map((r) => (
                    <div key={r.k} className="flex items-baseline gap-2 text-[11px]">
                        <span className="ds-small text-muted-foreground/60 w-[96px] shrink-0">{r.k}</span>
                        <span className="font-mono text-foreground/80 truncate">{r.v}</span>
                        <span className="ds-small text-muted-foreground/50 text-[10px] truncate">{r.note}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Recent activity row ─────────────────────────────────────── */

function RecentRow({ row }: { row: DeliveryLogRow }) {
    const statusColor =
        row.status === 'delivered' ? 'text-emerald-400' :
        row.status === 'failed' ? 'text-red-400' :
        row.status === 'dropped' ? 'text-amber-400' :
        'text-slate-400';
    const deliveredAt = typeof row.delivered_at === 'string' ? row.delivered_at : (row.delivered_at as { value: string } | undefined)?.value;
    return (
        <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] hover:bg-muted/10">
            <span className="font-mono tabular-nums text-muted-foreground/60 w-[60px] shrink-0">
                {deliveredAt ? fmtAgo(deliveredAt) : '—'}
            </span>
            <span className="text-foreground/80 w-[100px] shrink-0 truncate">{row.source || '—'}</span>
            <span className="text-muted-foreground/40">→</span>
            <span className="text-foreground/70 truncate flex-1">
                {row.group_name || row.group_key || '—'}
            </span>
            <span className="ds-small text-muted-foreground/60 uppercase font-mono shrink-0 w-[60px]">
                {row.provider || row.channel || '—'}
            </span>
            <span className={`font-medium uppercase shrink-0 w-[70px] ${statusColor}`}>
                {row.status}
            </span>
            <span className="ds-small text-muted-foreground/50 font-mono tabular-nums shrink-0 w-[50px] text-right">
                {row.duration_ms ? `${row.duration_ms}ms` : '—'}
            </span>
        </div>
    );
}

/* ── Section wrapper ─────────────────────────────────────────── */

function Section({ title, sublabel, children }: { title: string; sublabel?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-foreground/90">{title}</span>
                {sublabel && <span className="ds-small text-muted-foreground/60 text-[10px]">{sublabel}</span>}
            </div>
            {children}
        </div>
    );
}

function Legend({ children }: { children: React.ReactNode }) {
    return (
        <div className="ds-small text-muted-foreground/60 text-[10.5px] pl-1 leading-relaxed">
            {children}
        </div>
    );
}

/* ── Node (stage kecil) ──────────────────────────────────────── */

type Tone = 'ok' | 'warn' | 'err' | 'action' | 'muted' | 'neutral';

const TONE_BORDER: Record<Tone, string> = {
    ok: 'border-emerald-500/25 bg-emerald-500/5',
    warn: 'border-amber-500/25 bg-amber-500/5',
    err: 'border-red-500/25 bg-red-500/5',
    action: 'border-blue-500/30 bg-blue-500/5',
    muted: 'border-border/30 bg-muted/10',
    neutral: 'border-border/40 bg-background',
};

const TONE_DOT: Record<Tone, string> = {
    ok: 'bg-emerald-400',
    warn: 'bg-amber-400',
    err: 'bg-red-400',
    action: 'bg-blue-400',
    muted: 'bg-muted-foreground/40',
    neutral: 'bg-muted-foreground/30',
};

const BADGE_TONE: Record<Tone, string> = {
    ok: 'bg-emerald-500/10 text-emerald-400',
    warn: 'bg-amber-500/10 text-amber-400',
    err: 'bg-red-500/10 text-red-400',
    action: 'bg-blue-500/10 text-blue-400',
    muted: 'bg-muted/30 text-muted-foreground',
    neutral: 'bg-muted/20 text-muted-foreground',
};

interface Row {
    mode: 'primary' | 'sub' | 'footer';
    text: string;
    mono?: boolean;
    uppercase?: boolean;
}

interface NodeProps {
    stage: string;
    label: string;
    rows: Row[];
    badge?: { label: string; tone: Tone };
    tone?: Tone;
}

function Node({ stage, label, rows, badge, tone = 'neutral' }: NodeProps) {
    const primaryRow = rows.find((r) => r.mode === 'primary');
    const subRow = rows.find((r) => r.mode === 'sub');
    const footerRow = rows.find((r) => r.mode === 'footer');
    return (
        <div className={`rounded-md border ${TONE_BORDER[tone]} px-2.5 py-2 flex-1 min-w-[130px] max-w-[190px]`}>
            <div className="flex items-center gap-1.5 mb-1">
                <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />
                <span className="ds-label uppercase tracking-wider text-[10px] text-muted-foreground/70">
                    {stage} · {label}
                </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
                {primaryRow && (
                    <span className={`text-xs font-semibold text-foreground truncate ${primaryRow.mono ? 'font-mono' : ''} ${primaryRow.uppercase ? 'uppercase' : ''}`}>
                        {primaryRow.text}
                    </span>
                )}
                {badge && (
                    <span className={`text-[9px] font-medium px-1 rounded uppercase shrink-0 ${BADGE_TONE[badge.tone]}`}>
                        {badge.label}
                    </span>
                )}
            </div>
            {subRow?.text && <div className="ds-small text-muted-foreground/70 text-[11px] mt-0.5 truncate">{subRow.text}</div>}
            {footerRow?.text && <div className="ds-small text-muted-foreground/50 text-[10px] mt-0.5 truncate">{footerRow.text}</div>}
        </div>
    );
}

function Arrow({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center shrink-0 px-0.5">
            {label && <span className="ds-small text-[9px] text-muted-foreground/50">{label}</span>}
            <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
        </div>
    );
}

/* ── Dispatch state derivation ───────────────────────────────── */

function getDispatchState(config: DispatchConfig): { label: string; tone: Tone } {
    const lastRun = config.lastRun ? new Date(config.lastRun).getTime() : 0;
    const secSinceLast = lastRun > 0 ? (Date.now() - lastRun) / 1000 : Infinity;
    if (secSinceLast < 60) return { label: 'processing', tone: 'ok' };
    if (secSinceLast < 300) return { label: 'warm', tone: 'ok' };
    if (secSinceLast < 1800) return { label: 'idle', tone: 'warn' };
    return { label: 'cold', tone: 'muted' };
}

// Quiet unused imports (referenced for future extensions)
void Server;
