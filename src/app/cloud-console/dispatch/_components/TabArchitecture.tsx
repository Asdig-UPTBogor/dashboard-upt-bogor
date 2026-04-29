"use client";

/**
 * TabArchitecture — Arsitektur Data Flow Dispatch end-to-end.
 *
 * Struktur elegan:
 *   - Outbound flow (platform → WhatsApp)
 *   - Inbound flow (user reply → BQ log)
 *   - Data layer (Firestore + BigQuery)
 *   - Recent activity (5 event terakhir realtime)
 *
 * Pattern: SectionCard + horizontal pipeline. No Unicode numbering — pakai styled
 * pill badge untuk stage sequence. Typography hierarchy clean.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Cloud, Database, Workflow } from 'lucide-react';
import type { DispatchConfig, WahaStatus, DeliveryLogRow } from '../_lib/types';
import { fmtAgo, fetchDeliveryLogs } from '../_lib/api';
import { resolveProviders } from '../_lib/selectors';
import type { ProviderStatusMap } from '../_hooks/useProviderStatus';
import { InfoHeader } from './primitives';
import { getTabDef } from '../_config/tabs';
import type { LastActivity } from './flow/FlowDiagram';

interface Props {
    config: DispatchConfig;
    providerStatuses: ProviderStatusMap;
}

export default function TabArchitecture({ config, providerStatuses }: Props) {
    const tabDef = getTabDef('architecture');
    const { primary, secondary } = resolveProviders(config);

    // Last activity → Stage 1 (Platform) info. Poll 15s.
    const [lastActivity, setLastActivity] = useState<LastActivity | null>(null);
    const [recent, setRecent] = useState<DeliveryLogRow[]>([]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const { rows } = await fetchDeliveryLogs({ limit: 5 });
                if (cancelled) return;
                setRecent(rows);
                if (rows.length > 0) {
                    const r = rows[0];
                    setLastActivity({
                        source: r.source || '—',
                        groupKey: r.group_key || '—',
                        groupName: r.group_name || '—',
                        chatId: r.chat_id || '—',
                        type: r.type || '—',
                        at: (typeof r.delivered_at === 'string' ? r.delivered_at : (r.delivered_at as { value: string } | undefined)?.value) || '',
                    });
                }
            } catch { /* non-fatal */ }
        };
        load();
        const id = setInterval(load, 15_000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

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

    return (
        <div className="space-y-6">
            <InfoHeader title={tabDef.label} domain={tabDef.domain} />

            {/* ── OUTBOUND FLOW ─────────────────────────────────── */}
            <SectionCard
                eyebrow="Flow 1"
                title="Outbound"
                subtitle="Platform publisher → antrian → Dispatch → gateway → WhatsApp"
                icon={<Workflow className="h-3.5 w-3.5 text-blue-400/70" />}
            >
                <div className="flex flex-wrap items-stretch gap-y-2 gap-x-1">
                    <PipeNode
                        seq="01"
                        label="Platform"
                        primary={lastActivity ? lastActivity.source : 'belum ada'}
                        primaryPrefix="Last:"
                        sub={lastActivity ? `key: ${lastActivity.groupKey}` : 'menunggu publisher'}
                        footer={lastActivity ? fmtAgo(lastActivity.at) : undefined}
                    />
                    <Flow />
                    <PipeNode
                        seq="02"
                        label="Antrian Pub/Sub"
                        primary={cfg.pubsub_topic || '—'}
                        mono
                        sub={cfg.pubsub_subscription ? `sub: ${cfg.pubsub_subscription}` : '—'}
                        footer={cfg.pubsub_ack_deadline ? `ACK ${cfg.pubsub_ack_deadline}s · retry ${cfg.pubsub_max_delivery ?? '—'}×` : undefined}
                    />
                    <Flow />
                    <PipeNode
                        seq="03"
                        label="Dispatch"
                        primary={(cfg.infra_revision || '—').replace(/^dispatch-/, '')}
                        mono
                        sub={cfg.infra_memory ? `${cfg.infra_memory} · ${cfg.infra_min_instances ?? 0}–${cfg.infra_max_instances ?? '—'} inst` : '—'}
                        footer={successRate !== null ? `${successRate}% success today` : 'belum ada delivery'}
                        badge={dispatchState}
                        accent="blue"
                    />
                    <Flow />
                    <GatewayBlock primary={primary} secondary={secondary} wagate={providerStatuses.wagate} />
                    <Flow />
                    <PipeNode
                        seq="05"
                        label="Sampai di"
                        primary={lastActivity?.groupName || 'WhatsApp'}
                        sub={`${deliveredToday} ✓ · ${failedToday} ✗ hari ini`}
                        footer={config.lastRun ? `last ${fmtAgo(config.lastRun)}` : undefined}
                        accent={failedToday > 0 ? 'amber' : 'emerald'}
                    />
                </div>

                <CaptionBlock>
                    <strong className="text-foreground/80">Pipeline internal Dispatch:</strong>
                    <span className="text-muted-foreground/70"> parse payload → idempotency check → resolve group → send via gateway (retry 3× lalu fallback secondary) → log ke BigQuery → ACK Pub/Sub.</span>
                </CaptionBlock>
            </SectionCard>

            {/* ── INBOUND FLOW ──────────────────────────────────── */}
            <SectionCard
                eyebrow="Flow 2"
                title="Inbound"
                subtitle="User reply di WhatsApp → gateway terima → webhook → Dispatch log"
                icon={<Workflow className="h-3.5 w-3.5 text-emerald-400/70" />}
            >
                <div className="flex flex-wrap items-stretch gap-y-2 gap-x-1">
                    <PipeNode seq="01" label="User WhatsApp" primary="reply" sub="chat balik ke bot" />
                    <Flow label="WebSocket" />
                    <PipeNode seq="02" label="Gateway" primary={primary} uppercase sub="terima event realtime" />
                    <Flow label="HMAC HTTP" />
                    <PipeNode seq="03" label="Dispatch" primary="/webhook" mono sub="verify · parse · route" accent="blue" />
                    <Flow label="stream insert" />
                    <PipeNode seq="04" label="Log BigQuery" primary="message_log" mono sub="direction = inbound" />
                </div>

                <CaptionBlock>
                    <strong className="text-foreground/80">Pipeline internal:</strong>
                    <span className="text-muted-foreground/70"> verify HMAC dual-key (wagate/waha) → parse via adapter per-provider → route by event type (message / ACK / session.status / group / call) → tulis BigQuery.</span>
                </CaptionBlock>
            </SectionCard>

            {/* ── DATA LAYER ────────────────────────────────────── */}
            <SectionCard
                eyebrow="Flow 3"
                title="Data Layer"
                subtitle="Tempat data Dispatch nyangkut — Firestore untuk state, BigQuery untuk audit"
                icon={<Database className="h-3.5 w-3.5 text-amber-400/70" />}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StorageCard
                        icon={<Cloud className="h-3.5 w-3.5 text-amber-400/70" />}
                        title="Firestore"
                        rows={[
                            { k: 'config runtime', v: 'service_runtime_configs/dispatch', note: 'IS_ACTIVE, PRIMARY/SECONDARY, groups' },
                            { k: 'idempotency', v: 'delivery_attempts/{msgId}', note: 'cap 3× attempt, TTL 24h' },
                            { k: 'delivery ACKs', v: 'message_acks/{msgId}', note: 'read receipt dari WhatsApp' },
                            { k: 'fallback log', v: 'delivery_log_fallback/{eventId}', note: 'bila BigQuery insert gagal' },
                        ]}
                    />
                    <StorageCard
                        icon={<Database className="h-3.5 w-3.5 text-blue-400/70" />}
                        title="BigQuery"
                        rows={[
                            { k: 'outbound audit', v: 'dispatch.delivery_log', note: '20+ kolom · partitioned by delivered_at' },
                            { k: 'inbound msg', v: 'waha.message_log', note: 'pesan masuk + outbound confirm' },
                            { k: 'system events', v: 'waha.event_log', note: 'session.status, groups.*, call' },
                        ]}
                    />
                </div>
            </SectionCard>

            {/* ── RECENT ACTIVITY ───────────────────────────────── */}
            <SectionCard
                eyebrow="Live"
                title="Recent Activity"
                subtitle="5 delivery terakhir · auto-refresh 15 detik"
            >
                {recent.length === 0 ? (
                    <div className="ds-small text-muted-foreground/60 py-6 text-center">Belum ada aktivitas.</div>
                ) : (
                    <div className="rounded-md border border-border/30 divide-y divide-border/20 overflow-hidden">
                        {recent.map((r, i) => <RecentRow key={`${r.event_id}-${i}`} row={r} />)}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

/* ── SectionCard — elegant shell untuk tiap flow section ────── */

interface SectionCardProps {
    eyebrow: string;
    title: string;
    subtitle: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

function SectionCard({ eyebrow, title, subtitle, icon, children }: SectionCardProps) {
    return (
        <div className="rounded-lg border border-border/50 bg-muted/5 overflow-hidden">
            <header className="border-b border-border/30 px-5 py-3.5">
                <div className="flex items-center gap-3">
                    {icon && <div className="shrink-0">{icon}</div>}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3">
                            <span className="ds-label uppercase tracking-[0.14em] text-[10px] text-muted-foreground/60">
                                {eyebrow}
                            </span>
                            <h3 className="ds-title text-[15px]">{title}</h3>
                        </div>
                        <p className="ds-small text-muted-foreground/70 mt-0.5 leading-relaxed">{subtitle}</p>
                    </div>
                </div>
            </header>
            <div className="p-5">{children}</div>
        </div>
    );
}

/* ── PipeNode — stage card ─────────────────────────────────── */

type Accent = 'blue' | 'emerald' | 'amber' | 'muted';
const ACCENT: Record<Accent, { border: string; bg: string; seqBg: string; seqText: string; dot: string }> = {
    blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/[0.04]', seqBg: 'bg-blue-500/10', seqText: 'text-blue-300', dot: 'bg-blue-400' },
    emerald: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/[0.04]', seqBg: 'bg-emerald-500/10', seqText: 'text-emerald-300', dot: 'bg-emerald-400' },
    amber: { border: 'border-amber-500/25', bg: 'bg-amber-500/[0.04]', seqBg: 'bg-amber-500/10', seqText: 'text-amber-300', dot: 'bg-amber-400' },
    muted: { border: 'border-border/40', bg: 'bg-background', seqBg: 'bg-muted/30', seqText: 'text-muted-foreground/70', dot: 'bg-muted-foreground/40' },
};

interface PipeNodeProps {
    seq: string;
    label: string;
    primary: string;
    primaryPrefix?: string;
    sub?: string;
    footer?: string;
    mono?: boolean;
    uppercase?: boolean;
    badge?: { label: string; tone: Accent };
    accent?: Accent;
}

function PipeNode({ seq, label, primary, primaryPrefix, sub, footer, mono, uppercase, badge, accent = 'muted' }: PipeNodeProps) {
    const a = ACCENT[accent];
    return (
        <div className={`rounded-md border ${a.border} ${a.bg} px-3 py-2.5 flex-1 min-w-[140px] max-w-[200px]`}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${a.seqBg} ${a.seqText} tracking-wider`}>
                    {seq}
                </span>
                <span className="ds-label uppercase tracking-wider text-[10px] text-muted-foreground/70 truncate">
                    {label}
                </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
                <span className={`text-xs font-semibold text-foreground truncate ${mono ? 'font-mono' : ''} ${uppercase ? 'uppercase' : ''}`}>
                    {primaryPrefix && <span className="text-muted-foreground/60 mr-1 font-normal">{primaryPrefix}</span>}
                    {primary}
                </span>
                {badge && (
                    <span className={`text-[9px] font-medium px-1 rounded uppercase shrink-0 ${ACCENT[badge.tone].seqBg} ${ACCENT[badge.tone].seqText}`}>
                        {badge.label}
                    </span>
                )}
            </div>
            {sub && <div className="ds-small text-muted-foreground/70 text-[11px] mt-1 truncate">{sub}</div>}
            {footer && <div className="ds-small text-muted-foreground/50 text-[10px] mt-0.5 truncate">{footer}</div>}
        </div>
    );
}

/* ── Flow connector ───────────────────────────────────────── */

function Flow({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center shrink-0 px-1 self-center">
            {label && <span className="text-[9px] text-muted-foreground/45 tracking-wide">{label}</span>}
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
        </div>
    );
}

/* ── GatewayBlock — 3 chip vertical (primary/secondary/future) ─ */

interface GatewayBlockProps {
    primary: string;
    secondary: string;
    wagate: WahaStatus | null;
}

function GatewayBlock({ primary, secondary, wagate }: GatewayBlockProps) {
    return (
        <div className="flex flex-col gap-1 min-w-[215px] max-w-[235px] shrink-0">
            <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground/70 tracking-wider">04</span>
                <span className="ds-label uppercase tracking-wider text-[10px] text-muted-foreground/70">Gateway</span>
            </div>
            <GatewayChip name="WaGate" role={roleOf('wagate', primary, secondary)} status={wagate} />
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
    primary: { border: 'border-primary/40 bg-primary/[0.06]', label: 'Primary', labelTone: 'bg-primary/10 text-primary' },
    secondary: { border: 'border-border/50 bg-background', label: 'Secondary', labelTone: 'bg-muted/30 text-muted-foreground' },
    future: { border: 'border-dashed border-border/30', label: 'Future', labelTone: 'bg-amber-500/10 text-amber-400' },
    inactive: { border: 'border-border/30 bg-muted/10', label: 'Off', labelTone: 'bg-muted/20 text-muted-foreground/50' },
};

function GatewayChip({ name, role, status }: { name: string; role: GatewayRole; status: WahaStatus | null }) {
    const s = ROLE_STYLE[role];
    const connected = !!status?.connected;
    const dotColor = role === 'future' ? 'bg-muted-foreground/30'
        : role === 'primary' ? (connected ? 'bg-emerald-400' : 'bg-red-400')
        : role === 'secondary' ? (connected ? 'bg-emerald-400/70' : 'bg-slate-500')
        : 'bg-muted-foreground/30';
    return (
        <div className={`rounded-md border ${s.border} px-2.5 py-1.5`}>
            <div className="flex items-center justify-between gap-1.5 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-[11.5px] font-semibold uppercase truncate">{name}</span>
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

/* ── Storage card ─────────────────────────────────────────── */

interface StorageCardProps {
    icon: React.ReactNode;
    title: string;
    rows: Array<{ k: string; v: string; note: string }>;
}

function StorageCard({ icon, title, rows }: StorageCardProps) {
    return (
        <div className="rounded-md border border-border/40 bg-background p-4">
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <span className="ds-label uppercase tracking-wider">{title}</span>
            </div>
            <div className="space-y-1.5">
                {rows.map((r) => (
                    <div key={r.k} className="flex items-start gap-3 text-[11px]">
                        <span className="ds-small text-muted-foreground/60 w-[100px] shrink-0 leading-snug">{r.k}</span>
                        <div className="flex-1 min-w-0">
                            <div className="font-mono text-foreground/85 truncate">{r.v}</div>
                            <div className="ds-small text-muted-foreground/50 text-[10px] truncate">{r.note}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Recent activity row ──────────────────────────────────── */

function RecentRow({ row }: { row: DeliveryLogRow }) {
    const statusColor =
        row.status === 'delivered' ? 'text-emerald-400' :
        row.status === 'failed' ? 'text-red-400' :
        row.status === 'dropped' ? 'text-amber-400' :
        'text-slate-400';
    const deliveredAt = typeof row.delivered_at === 'string' ? row.delivered_at : (row.delivered_at as { value: string } | undefined)?.value;
    return (
        <div className="flex items-center gap-3 px-4 py-2 text-[11px] hover:bg-muted/10">
            <span className="font-mono tabular-nums text-muted-foreground/60 w-[60px] shrink-0">
                {deliveredAt ? fmtAgo(deliveredAt) : '—'}
            </span>
            <span className="text-foreground/85 w-[110px] shrink-0 truncate font-medium">{row.source || '—'}</span>
            <span className="text-muted-foreground/40 shrink-0">→</span>
            <span className="text-foreground/70 flex-1 truncate">{row.group_name || row.group_key || '—'}</span>
            <span className="ds-small text-muted-foreground/60 uppercase font-mono shrink-0 w-[60px]">
                {row.provider || row.channel || '—'}
            </span>
            <span className={`font-medium uppercase shrink-0 w-[70px] ${statusColor}`}>{row.status}</span>
            <span className="ds-small text-muted-foreground/50 font-mono tabular-nums shrink-0 w-[50px] text-right">
                {row.duration_ms ? `${row.duration_ms}ms` : '—'}
            </span>
        </div>
    );
}

/* ── Caption block ─────────────────────────────────────────── */

function CaptionBlock({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-4 pt-3 border-t border-border/20 ds-small leading-relaxed">
            {children}
        </div>
    );
}

/* ── Dispatch state derivation ─────────────────────────────── */

function getDispatchState(config: DispatchConfig): { label: string; tone: Accent } {
    const lastRun = config.lastRun ? new Date(config.lastRun).getTime() : 0;
    const secSinceLast = lastRun > 0 ? (Date.now() - lastRun) / 1000 : Infinity;
    if (secSinceLast < 60) return { label: 'processing', tone: 'emerald' };
    if (secSinceLast < 300) return { label: 'warm', tone: 'emerald' };
    if (secSinceLast < 1800) return { label: 'idle', tone: 'amber' };
    return { label: 'cold', tone: 'muted' };
}
