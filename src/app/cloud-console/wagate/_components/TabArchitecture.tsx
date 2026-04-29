"use client";

/**
 * TabArchitecture — WaGate data flow end-to-end.
 *
 * Struktur (sama dengan Dispatch TabArchitecture):
 *   1. Outbound flow — API Caller → WaGate HTTP → Baileys WS → WhatsApp
 *   2. Inbound flow  — WhatsApp → Baileys WS → WaGate → Webhook fire ke Dispatch
 *   3. Data layer    — Firestore (4 collection) + BigQuery (4 table) + GCS (2 bucket)
 *   4. Recent activity — 5 message terakhir dari BQ
 *
 * Thin orchestrator. Zero hardcode — semua data dari live API + FS config.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Cloud, Database, HardDrive, Workflow } from 'lucide-react';
import type { MessageLogRow } from '../_lib/types';
import { fetchMessageLogs, fmtAgo, getWagateStatus } from '../_lib/api';

interface Props {
    config?: unknown;
    showFeedback?: (msg: string, ok: boolean) => void;
}

interface SessionStatus {
    status?: string;
    connected?: boolean;
    bot?: { name?: string; phone?: string } | null;
    extra?: { uptime_sec?: number; reconnect_count?: number };
}

export default function TabArchitecture({ config, showFeedback }: Props) {
    void showFeedback;
    const cfg = (config || {}) as Record<string, unknown>;
    const [session, setSession] = useState<SessionStatus | null>(null);
    const [recent, setRecent] = useState<MessageLogRow[]>([]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [s, msgs] = await Promise.all([
                    getWagateStatus().catch(() => null) as Promise<SessionStatus | null>,
                    fetchMessageLogs({ limit: 5 }).catch(() => ({ rows: [] })),
                ]);
                if (cancelled) return;
                setSession(s);
                setRecent(msgs.rows || []);
            } catch { /* non-fatal */ }
        };
        load();
        const id = setInterval(load, 15_000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    // Config derivation — preferensi urutan: session live → FS provider_snapshot → default.
    // Fix race condition: saat initial fetch belum selesai, fallback ke FS biar tidak tampil "WS disconnected" palsu.
    const snapshot = (cfg.provider_snapshot || {}) as {
        status?: string; ws_connected?: boolean;
        bot_name?: string; bot_phone?: string;
        last_cold_start_duration_ms?: number;
        reconnect_count?: number;
    };
    const botIdentity = (cfg.bot_identity || {}) as { phone?: string; push_name?: string };

    const sessionLoaded = session !== null;
    const sessionStatus = session?.status || snapshot.status || (sessionLoaded ? 'unknown' : 'loading…');
    const wsConnected = session?.connected ?? snapshot.ws_connected ?? false;
    const botName = session?.bot?.name || botIdentity.push_name || snapshot.bot_name || '—';
    const botPhone = session?.bot?.phone || botIdentity.phone || snapshot.bot_phone || '—';
    const uptimeSec = (session?.extra as { uptime_sec?: number })?.uptime_sec || 0;
    const reconnectCount = (session?.extra as { reconnect_count?: number })?.reconnect_count ?? snapshot.reconnect_count ?? 0;

    const infraRevision = (cfg.infra_revision as string) || '—';
    const infraMinInst = cfg.infra_min_instances;
    const infraMaxInst = cfg.infra_max_instances;
    const infraMemory = (cfg.infra_memory as string) || '—';

    const today = (cfg.TOTAL_SENT_TODAY as number) ?? 0;
    const todayReceived = (cfg.TOTAL_RECEIVED_TODAY as number) ?? 0;
    const todayFailed = (cfg.TOTAL_FAILED_TODAY as number) ?? 0;
    const lastRun = (cfg.lastRun as string) || null;

    return (
        <div className="space-y-6">
            {/* Info header */}
            <div className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/5 p-3">
                <Workflow className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                <div className="ds-small text-muted-foreground/80 leading-relaxed">
                    <strong className="text-foreground/90">Architecture</strong> — arsitektur data flow WaGate end-to-end: outbound, inbound, data layer, recent activity.
                </div>
            </div>

            {/* ── FLOW 1 · OUTBOUND ───────────────────────────── */}
            <SectionCard
                eyebrow="Flow 1"
                title="Outbound"
                subtitle="API caller → WaGate HTTP → Baileys WebSocket → WhatsApp"
                icon={<Workflow className="h-3.5 w-3.5 text-blue-400/70" />}
            >
                <div className="flex flex-wrap items-stretch gap-y-2 gap-x-1">
                    <PipeNode
                        seq="01"
                        label="API Caller"
                        primary="Dispatch / Dashboard"
                        sub="HTTP + X-Api-Key + ID token"
                    />
                    <Flow label="POST /api/send*" />
                    <PipeNode
                        seq="02"
                        label="WaGate HTTP"
                        primary={infraRevision.replace(/^wagate-/, '')}
                        mono
                        sub={infraMemory && typeof infraMinInst === 'number' ? `${infraMemory} · ${infraMinInst}–${infraMaxInst ?? '—'} inst` : '—'}
                        footer={`uptime ${formatUptime(uptimeSec)}`}
                        accent="blue"
                    />
                    <Flow label="Baileys WS" />
                    <PipeNode
                        seq="03"
                        label="WhatsApp Server"
                        primary="Meta"
                        sub={wsConnected ? 'WS connected' : 'WS disconnected'}
                        footer={`reconnect count: ${reconnectCount}`}
                        accent={wsConnected ? 'emerald' : 'amber'}
                    />
                    <Flow />
                    <PipeNode
                        seq="04"
                        label="Delivered"
                        primary="User phone"
                        sub={`${today} ✓ · ${todayFailed} ✗ hari ini`}
                        footer={lastRun ? `last ${fmtAgo(lastRun)}` : undefined}
                        accent={todayFailed > 0 ? 'amber' : 'emerald'}
                    />
                </div>
                <Caption>
                    <strong className="text-foreground/80">Pipeline internal:</strong>
                    <span className="text-muted-foreground/70"> auth middleware (X-Api-Key + optional ID token) → rate limiter per (session, chat_id) → `queueOrSend` (send immediate atau queue kalau WS down) → Baileys `sock.sendMessage()` → delivery log BQ + finalize FS telemetry.</span>
                </Caption>
            </SectionCard>

            {/* ── FLOW 2 · INBOUND ────────────────────────────── */}
            <SectionCard
                eyebrow="Flow 2"
                title="Inbound"
                subtitle="User WA reply → Baileys WS event → WaGate log + webhook ke Dispatch"
                icon={<Workflow className="h-3.5 w-3.5 text-emerald-400/70" />}
            >
                <div className="flex flex-wrap items-stretch gap-y-2 gap-x-1">
                    <PipeNode seq="01" label="User WhatsApp" primary="reply chat" sub="ke bot YGGDRASIL" />
                    <Flow label="WebSocket" />
                    <PipeNode
                        seq="02"
                        label="Baileys Event"
                        primary="messages.upsert"
                        mono
                        sub="type='notify'"
                    />
                    <Flow label="event handler" />
                    <PipeNode
                        seq="03"
                        label="WaGate"
                        primary={botName}
                        sub={`received: ${todayReceived}`}
                        accent="blue"
                    />
                    <Flow label="HTTP + HMAC" />
                    <PipeNode
                        seq="04"
                        label="Dispatch"
                        primary="/webhook"
                        mono
                        sub="HMAC SHA-512 signed"
                    />
                </div>
                <Caption>
                    <strong className="text-foreground/80">Pipeline internal:</strong>
                    <span className="text-muted-foreground/70"> Baileys handler `messages.upsert` → write BQ `message_log` (direction=inbound) + contacts cache update → `storeSentMessage` (kalau fromMe) → fire webhook HMAC SHA-512 ke Dispatch `/webhook` (non-blocking).</span>
                </Caption>
            </SectionCard>

            {/* ── FLOW 3 · DATA LAYER ─────────────────────────── */}
            <SectionCard
                eyebrow="Flow 3"
                title="Data Layer"
                subtitle="Firestore (state & cache) · BigQuery (audit) · GCS (media & session)"
                icon={<Database className="h-3.5 w-3.5 text-amber-400/70" />}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StorageCard
                        icon={<Cloud className="h-3.5 w-3.5 text-amber-400/70" />}
                        title="Firestore"
                        rows={[
                            { k: 'config runtime', v: 'service_runtime_configs/wagate', note: 'admin config + §1-§11 telemetry' },
                            { k: 'auth creds', v: 'wagate_auth_states/{session}', note: 'Baileys creds + signal keys subcol' },
                            { k: 'offline queue', v: 'wagate_queue/{ulid}', note: 'TTL 24h via _expire_at' },
                            { k: 'msg cache', v: 'wagate_sent_messages/{msgId}', note: 'TTL 7d — getMessage callback' },
                        ]}
                    />
                    <StorageCard
                        icon={<Database className="h-3.5 w-3.5 text-blue-400/70" />}
                        title="BigQuery"
                        rows={[
                            { k: 'delivery audit', v: 'wagate.delivery_log', note: 'outbound send result' },
                            { k: 'message log', v: 'wagate.message_log', note: 'inbound + outbound messages' },
                            { k: 'system events', v: 'wagate.event_log', note: 'session.status, groups.*, call' },
                            { k: 'audit trail', v: 'wagate.audit_log', note: 'security audit — auth + admin' },
                        ]}
                    />
                    <StorageCard
                        icon={<HardDrive className="h-3.5 w-3.5 text-sky-400/70" />}
                        title="GCS"
                        rows={[
                            { k: 'media archive', v: 'wagate-media/', note: 'outbound + inbound media' },
                            { k: 'session data', v: 'wagate-session-data/', note: 'Cloud Run FUSE mount' },
                        ]}
                    />
                </div>
            </SectionCard>

            {/* ── FLOW 4 · RECENT ACTIVITY ───────────────────── */}
            <SectionCard
                eyebrow="Live"
                title="Recent Activity"
                subtitle="5 message terakhir · auto-refresh 15 detik"
            >
                {recent.length === 0 ? (
                    <div className="ds-small text-muted-foreground/60 py-6 text-center">Belum ada aktivitas.</div>
                ) : (
                    <div className="rounded-md border border-border/30 divide-y divide-border/20 overflow-hidden">
                        {recent.map((r, i) => <RecentRow key={`${r.message_id || i}-${i}`} row={r} />)}
                    </div>
                )}
            </SectionCard>

            {/* Session ringkas status */}
            <SectionCard eyebrow="Session" title="WhatsApp Session" subtitle="status koneksi Baileys → WhatsApp server">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <StatCell label="Status" value={sessionStatus} accent={wsConnected ? 'emerald' : 'amber'} />
                    <StatCell label="Bot" value={botName} />
                    <StatCell label="Phone" value={botPhone} mono />
                    <StatCell label="Uptime" value={formatUptime(uptimeSec)} mono />
                </div>
            </SectionCard>
        </div>
    );
}

/* ── SectionCard ───────────────────────────────────────────── */

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

/* ── PipeNode ─────────────────────────────────────────────── */

type Accent = 'blue' | 'emerald' | 'amber' | 'muted';
const ACCENT: Record<Accent, { border: string; bg: string; seqBg: string; seqText: string }> = {
    blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/[0.04]', seqBg: 'bg-blue-500/10', seqText: 'text-blue-300' },
    emerald: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/[0.04]', seqBg: 'bg-emerald-500/10', seqText: 'text-emerald-300' },
    amber: { border: 'border-amber-500/25', bg: 'bg-amber-500/[0.04]', seqBg: 'bg-amber-500/10', seqText: 'text-amber-300' },
    muted: { border: 'border-border/40', bg: 'bg-background', seqBg: 'bg-muted/30', seqText: 'text-muted-foreground/70' },
};

interface PipeNodeProps {
    seq: string;
    label: string;
    primary: string;
    sub?: string;
    footer?: string;
    mono?: boolean;
    accent?: Accent;
}

function PipeNode({ seq, label, primary, sub, footer, mono, accent = 'muted' }: PipeNodeProps) {
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
            <span className={`text-xs font-semibold text-foreground truncate block ${mono ? 'font-mono' : ''}`}>
                {primary}
            </span>
            {sub && <div className="ds-small text-muted-foreground/70 text-[11px] mt-1 truncate">{sub}</div>}
            {footer && <div className="ds-small text-muted-foreground/50 text-[10px] mt-0.5 truncate">{footer}</div>}
        </div>
    );
}

function Flow({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center shrink-0 px-1 self-center">
            {label && <span className="text-[9px] text-muted-foreground/45 tracking-wide">{label}</span>}
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
        </div>
    );
}

/* ── StorageCard ──────────────────────────────────────────── */

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
                        <span className="ds-small text-muted-foreground/60 w-[90px] shrink-0 leading-snug">{r.k}</span>
                        <div className="flex-1 min-w-0">
                            <div className="font-mono text-foreground/85 truncate text-[10.5px]">{r.v}</div>
                            <div className="ds-small text-muted-foreground/50 text-[10px] truncate">{r.note}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── RecentRow ────────────────────────────────────────────── */

function RecentRow({ row }: { row: MessageLogRow }) {
    const dir = row.direction === 'outbound' ? 'OUT' : 'IN';
    const dirColor = row.direction === 'outbound' ? 'text-blue-400' : 'text-emerald-400';
    const ts = typeof row.timestamp_wib === 'string' ? row.timestamp_wib : (row.timestamp_wib as { value: string } | undefined)?.value;
    const chatType = row.chat_type || '—';
    const body = row.body || (row.has_media ? `[${row.media_type || 'media'}]` : '—');
    return (
        <div className="flex items-center gap-3 px-4 py-2 text-[11px] hover:bg-muted/10">
            <span className="font-mono tabular-nums text-muted-foreground/60 w-[60px] shrink-0">
                {ts ? fmtAgo(ts) : '—'}
            </span>
            <span className={`font-medium uppercase shrink-0 w-[36px] ${dirColor}`}>{dir}</span>
            <span className="text-foreground/85 w-[110px] shrink-0 truncate font-mono text-[10px]">
                {row.from_name || row.from_id || '—'}
            </span>
            <span className="text-muted-foreground/40 shrink-0">→</span>
            <span className="text-foreground/70 flex-1 truncate">{body}</span>
            <span className="ds-small text-muted-foreground/60 uppercase font-mono shrink-0 w-[60px]">
                {chatType}
            </span>
        </div>
    );
}

/* ── StatCell ─────────────────────────────────────────────── */

function StatCell({ label, value, accent, mono }: { label: string; value: string; accent?: Accent; mono?: boolean }) {
    const color = accent === 'emerald' ? 'text-emerald-400'
        : accent === 'amber' ? 'text-amber-400'
        : accent === 'blue' ? 'text-blue-400'
        : 'text-foreground';
    return (
        <div className="rounded-md border border-border/40 bg-background px-3 py-2">
            <div className="ds-label uppercase tracking-wider text-[10px]">{label}</div>
            <div className={`text-xs font-semibold truncate mt-0.5 ${color} ${mono ? 'font-mono' : ''}`}>{value}</div>
        </div>
    );
}

/* ── Caption ──────────────────────────────────────────────── */

function Caption({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-4 pt-3 border-t border-border/20 ds-small leading-relaxed">
            {children}
        </div>
    );
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatUptime(seconds: number): string {
    if (!seconds || seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm > 0 ? `${h}j ${mm}m` : `${h}j`;
}
