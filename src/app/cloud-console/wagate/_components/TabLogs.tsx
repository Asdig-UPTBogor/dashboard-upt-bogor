"use client";

/**
 * Tab Logs — BigQuery viewer mirror pattern Notifier tab.
 *
 * Pattern (mirror `/cloud-console/notifier` TabLogs):
 *   - Status filter pills (All + per-status)
 *   - Inline expand row (bukan modal) — click row → detail di bawah row
 *   - Left pane: metadata grid · Right pane: message preview / media viewer
 *   - Media (image/PDF/audio/video) preview langsung via signed URL GCS (15 min expiry)
 *
 * 4 sub-tab: Delivery · Messages · Events · Audit
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import {
    ScrollText, Inbox, Activity, Shield, RefreshCw, Loader2, XCircle, CheckCircle2,
    AlertCircle, Info, Image as ImageIcon, FileText, Mic, Video, ExternalLink,
    Download, ArrowDown, ArrowUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    fetchDeliveryLogs, fetchMessageLogs, fetchEventLogs, fetchAuditLogs,
    getWagateMediaUrl,
} from '../_lib/api';
import type { DeliveryLogRow, MessageLogRow, EventLogRow, AuditLogRow } from '../_lib/types';
import { DEFAULT_LOG_PAGE_SIZE } from '../_lib/constants';

const PAGE_SIZE = DEFAULT_LOG_PAGE_SIZE;

// ─── Helpers ─────────────────────────────────────────────────────

function formatTimeWIB(raw: unknown): string {
    try {
        const iso = typeof raw === 'object' && raw !== null && 'value' in raw
            ? String((raw as { value: string }).value)
            : String(raw);
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(raw);
        const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
        const dd = String(wib.getUTCDate()).padStart(2, '0');
        const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        const mm = months[wib.getUTCMonth()];
        const hh = String(wib.getUTCHours()).padStart(2, '0');
        const mi = String(wib.getUTCMinutes()).padStart(2, '0');
        const ss = String(wib.getUTCSeconds()).padStart(2, '0');
        return `${dd} ${mm} ${hh}:${mi}:${ss}`;
    } catch { return String(raw); }
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    sent:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
    delivered: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
    success:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
    failed:    { bg: 'bg-red-500/10',     text: 'text-red-400',     icon: <XCircle className="h-2.5 w-2.5" /> },
    error:     { bg: 'bg-red-500/10',     text: 'text-red-400',     icon: <XCircle className="h-2.5 w-2.5" /> },
    denied:    { bg: 'bg-red-500/10',     text: 'text-red-400',     icon: <XCircle className="h-2.5 w-2.5" /> },
    queued:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   icon: <AlertCircle className="h-2.5 w-2.5" /> },
    inbound:   { bg: 'bg-blue-500/10',    text: 'text-blue-400',    icon: <ArrowDown className="h-2.5 w-2.5" /> },
    outbound:  { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    icon: <ArrowUp className="h-2.5 w-2.5" /> },
};

function StatusPill({ status }: { status: string }) {
    const s = STATUS_STYLE[status] || { bg: 'bg-muted/20', text: 'text-muted-foreground', icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>
            {s.icon} {status}
        </span>
    );
}

// ─── Media Viewer (inline, click row to render) ──────────────────

function MediaViewer({ path }: { path: string }) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null); setUrl(null);
        getWagateMediaUrl(path).then((r) => {
            if (cancelled) return;
            if (r.ok && r.url) setUrl(r.url);
            else setError(r.error || 'Failed to sign URL');
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [path]);

    const ext = path.split('.').pop()?.toLowerCase() || '';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
    const isPdf = ext === 'pdf';
    const isAudio = ['ogg', 'mp3', 'wav', 'm4a', 'opus'].includes(ext);
    const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
    const Icon = isImage ? ImageIcon : isPdf ? FileText : isAudio ? Mic : isVideo ? Video : FileText;

    return (
        <div className="rounded-lg border border-border/30 bg-muted/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-blue-400" />
                <span className="ds-label text-muted-foreground">Media</span>
                <code className="ds-small font-mono text-muted-foreground truncate">{path.split('/').pop()}</code>
            </div>
            {loading && <div className="flex items-center gap-2 ds-small"><Loader2 className="h-3 w-3 animate-spin" /> Signing URL…</div>}
            {error && <div className="ds-small text-red-400">{error}</div>}
            {url && isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="media" className="max-h-64 rounded border border-border/30" />
            )}
            {url && isPdf && <iframe src={url} className="w-full h-96 rounded border border-border/30 bg-white" title="PDF preview" />}
            {url && isAudio && <audio controls src={url} className="w-full" />}
            {url && isVideo && <video controls src={url} className="max-h-64 rounded border border-border/30" />}
            {url && (
                <div className="flex items-center gap-2 pt-1">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ds-small text-blue-400 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Open in new tab
                    </a>
                    <a href={url} download className="inline-flex items-center gap-1 ds-small text-muted-foreground hover:text-foreground">
                        <Download className="h-3 w-3" /> Download
                    </a>
                    <span className="ml-auto ds-small text-muted-foreground">URL expires 15 min</span>
                </div>
            )}
        </div>
    );
}

// ─── Delivery Logs ───────────────────────────────────────────────

function DeliveryView() {
    const [rows, setRows] = useState<DeliveryLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [opFilter, setOpFilter] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await fetchDeliveryLogs({ limit: PAGE_SIZE, offset, status: statusFilter, operation: opFilter });
            setRows(r.rows); setTotal(r.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'fetch failed');
            setRows([]); setTotal(0);
        } finally { setLoading(false); }
    }, [offset, statusFilter, opFilter]);

    useEffect(() => { load(); }, [load]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const operations = useMemo(() => Array.from(new Set(rows.map(r => r.operation))).sort(), [rows]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <h3 className="ds-title">Delivery Logs</h3>
                    <span className="ds-small text-muted-foreground">{total.toLocaleString()} · BQ wagate.delivery_log</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                    {['', 'sent', 'failed', 'queued'].map((s) => (
                        <button key={s || 'all'} onClick={() => { setStatusFilter(s); setOffset(0); }}
                            className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${statusFilter === s ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground/60 hover:text-muted-foreground hover:border-border/50'}`}>
                            {s || 'All'}
                        </button>
                    ))}
                    {operations.length > 0 && (
                        <select value={opFilter} onChange={(e) => { setOpFilter(e.target.value); setOffset(0); }}
                            className="px-2 py-1 text-[11px] rounded-md border border-border/30 bg-background text-muted-foreground">
                            <option value="">All operations</option>
                            {operations.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                    )}
                    <button onClick={load} disabled={loading}
                        className="p-1.5 rounded-md border border-border/30 text-muted-foreground/60 hover:text-muted-foreground hover:border-border/50 disabled:opacity-50">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span className="ds-small text-red-300">{error}</span>
                </div>
            )}

            <div className="rounded-lg border border-border/30 overflow-hidden">
                <table className="w-full text-[12px]">
                    <thead>
                        <tr className="bg-muted/10 border-b border-border/20">
                            <th className="text-left px-3 py-2 ds-label w-[130px]">Time (WIB)</th>
                            <th className="text-left px-3 py-2 ds-label w-[120px]">Operation</th>
                            <th className="text-left px-3 py-2 ds-label">Chat</th>
                            <th className="text-left px-3 py-2 ds-label w-[80px]">Status</th>
                            <th className="text-left px-3 py-2 ds-label w-[60px]">ms</th>
                            <th className="text-left px-3 py-2 ds-label w-[40px]">Media</th>
                            <th className="text-left px-3 py-2 ds-label">Text / Error</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                        {loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center"><Loader2 className="h-5 w-5 text-muted-foreground/30 animate-spin mx-auto" /></td></tr>}
                        {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center"><ScrollText className="h-8 w-8 text-muted-foreground/15 mx-auto mb-2" /><p className="ds-small">No delivery logs yet</p></td></tr>}
                        {rows.map((row) => {
                            const open = expanded === row.event_id;
                            return (
                                <React.Fragment key={row.event_id}>
                                    <tr onClick={() => setExpanded(open ? null : row.event_id)}
                                        className={`cursor-pointer transition-colors hover:bg-muted/5 ${open ? 'bg-muted/10' : ''}`}>
                                        <td className="px-3 py-2 ds-small font-mono">{formatTimeWIB(row.sent_at)}</td>
                                        <td className="px-3 py-2 font-medium">{row.operation}</td>
                                        <td className="px-3 py-2 ds-small font-mono truncate max-w-[200px]">{row.chat_id}</td>
                                        <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                                        <td className="px-3 py-2 ds-small font-mono text-muted-foreground/60">{row.duration_ms ?? '—'}</td>
                                        <td className="px-3 py-2">{row.media_gcs_path ? <ImageIcon className="h-3.5 w-3.5 text-blue-400" /> : <span className="text-muted-foreground/30">—</span>}</td>
                                        <td className="px-3 py-2 ds-small truncate max-w-[240px]">
                                            {row.error ? <span className="text-red-400/80">{row.error}</span> : (row.text || '—')}
                                        </td>
                                    </tr>
                                    {open && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-3 bg-muted/5 border-t border-border/10">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <div className="space-y-1 min-w-0">
                                                        {[
                                                            ['Event ID', row.event_id],
                                                            ['Operation', row.operation],
                                                            ['Chat ID', row.chat_id],
                                                            ['Chat Type', row.chat_type],
                                                            ['Caller', row.caller || '—'],
                                                            ['Provider Msg ID', row.provider_message_id || '—'],
                                                            ['Duration', row.duration_ms != null ? `${row.duration_ms} ms` : '—'],
                                                            ['Queued', formatTimeWIB(row.queued_at)],
                                                            ['Sent', formatTimeWIB(row.sent_at)],
                                                            ['ACK Status', row.ack_status ?? '—'],
                                                            ['ACK Updated', formatTimeWIB(row.ack_updated_at)],
                                                            ['Media GCS', row.media_gcs_path || '—'],
                                                        ].map(([k, v]) => (
                                                            <div key={String(k)} className="flex items-center justify-between py-1 border-b border-border/30">
                                                                <span className="ds-label text-muted-foreground">{k}</span>
                                                                <span className="ds-small font-mono break-all text-right max-w-[260px]">{String(v)}</span>
                                                            </div>
                                                        ))}
                                                        {row.error && (
                                                            <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/10">
                                                                <span className="ds-label text-red-400">Error</span>
                                                                <div className="ds-small text-red-400 font-mono mt-0.5 break-all">{row.error}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-3 min-w-0">
                                                        {row.text && (
                                                            <div>
                                                                <span className="ds-label uppercase tracking-wider text-muted-foreground">Text</span>
                                                                <div className="mt-1 p-3 rounded-lg bg-background/50 border border-border/20 ds-body whitespace-pre-wrap break-words max-h-[240px] overflow-y-auto">
                                                                    {row.text}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {row.media_gcs_path && <MediaViewer path={row.media_gcs_path} />}
                                                    </div>
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

            {totalPages > 1 && (
                <div className="flex items-center justify-between ds-small">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} className="px-2 py-1 rounded border border-border/30 hover:border-border/50 disabled:opacity-30">← Prev</button>
                        <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={page >= totalPages} className="px-2 py-1 rounded border border-border/30 hover:border-border/50 disabled:opacity-30">Next →</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Message Logs ────────────────────────────────────────────────

function MessageView() {
    const [rows, setRows] = useState<MessageLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirFilter, setDirFilter] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetchMessageLogs({ limit: PAGE_SIZE, offset, direction: dirFilter });
            setRows(r.rows); setTotal(r.total); setError(null);
        } catch (err) { setRows([]); setTotal(0); setError(err instanceof Error ? err.message : 'fetch failed'); }
        finally { setLoading(false); }
    }, [offset, dirFilter]);

    useEffect(() => { load(); }, [load]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const page = Math.floor(offset / PAGE_SIZE) + 1;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <h3 className="ds-title">Message Logs</h3>
                    <span className="ds-small text-muted-foreground">{total.toLocaleString()} · inbound + outbound</span>
                </div>
                <div className="flex items-center gap-1">
                    {['', 'inbound', 'outbound'].map((d) => (
                        <button key={d || 'all'} onClick={() => { setDirFilter(d); setOffset(0); }}
                            className={`px-2.5 py-1 text-[11px] rounded-md border ${dirFilter === d ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground/60 hover:text-muted-foreground hover:border-border/50'}`}>
                            {d || 'All'}
                        </button>
                    ))}
                    <button onClick={load} disabled={loading} className="p-1.5 rounded-md border border-border/30 text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-50">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 ds-small text-red-400">
                    Gagal memuat: {error}
                </div>
            )}
            <div className="rounded-lg border border-border/30 overflow-hidden">
                <table className="w-full text-[12px]">
                    <thead>
                        <tr className="bg-muted/10 border-b border-border/20">
                            <th className="text-left px-3 py-2 ds-label w-[130px]">Time (WIB)</th>
                            <th className="text-left px-3 py-2 ds-label w-[90px]">Direction</th>
                            <th className="text-left px-3 py-2 ds-label">From</th>
                            <th className="text-left px-3 py-2 ds-label">To</th>
                            <th className="text-left px-3 py-2 ds-label w-[60px]">Media</th>
                            <th className="text-left px-3 py-2 ds-label">Body</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                        {loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground/30" /></td></tr>}
                        {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center"><Inbox className="h-8 w-8 text-muted-foreground/15 mx-auto mb-2" /><p className="ds-small">No message logs yet</p></td></tr>}
                        {rows.map((row) => {
                            const open = expanded === row.event_id;
                            return (
                                <React.Fragment key={row.event_id}>
                                    <tr onClick={() => setExpanded(open ? null : row.event_id)} className={`cursor-pointer hover:bg-muted/5 ${open ? 'bg-muted/10' : ''}`}>
                                        <td className="px-3 py-2 ds-small font-mono">{formatTimeWIB(row.timestamp_wib)}</td>
                                        <td className="px-3 py-2"><StatusPill status={row.direction} /></td>
                                        <td className="px-3 py-2 ds-small font-mono truncate max-w-[180px]">
                                            {row.from_id}
                                            {row.from_name && <span className="ml-1 text-muted-foreground">({row.from_name})</span>}
                                        </td>
                                        <td className="px-3 py-2 ds-small font-mono truncate max-w-[180px]">{row.to_id}</td>
                                        <td className="px-3 py-2">{row.has_media ? <Badge variant="outline" className="ds-small">{row.media_type || 'yes'}</Badge> : <span className="text-muted-foreground/30">—</span>}</td>
                                        <td className="px-3 py-2 ds-small truncate max-w-[280px]">{row.body || '—'}</td>
                                    </tr>
                                    {open && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-3 bg-muted/5 border-t border-border/10">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <div className="space-y-1 min-w-0">
                                                        {[
                                                            ['Event ID', row.event_id],
                                                            ['Message ID', row.message_id],
                                                            ['Direction', row.direction],
                                                            ['Chat Type', row.chat_type],
                                                            ['From', row.from_id],
                                                            ['From Name', row.from_name || '—'],
                                                            ['To', row.to_id],
                                                            ['Has Media', String(row.has_media)],
                                                            ['Media Type', row.media_type || '—'],
                                                            ['Media GCS', row.media_gcs_path || '—'],
                                                            ['Quoted Msg ID', row.quoted_message_id || '—'],
                                                            ['Timestamp', formatTimeWIB(row.timestamp_wib)],
                                                        ].map(([k, v]) => (
                                                            <div key={String(k)} className="flex items-center justify-between py-1 border-b border-border/30">
                                                                <span className="ds-label text-muted-foreground">{k}</span>
                                                                <span className="ds-small font-mono break-all text-right max-w-[260px]">{String(v)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="space-y-3 min-w-0">
                                                        {row.body && (
                                                            <div>
                                                                <span className="ds-label uppercase tracking-wider text-muted-foreground">Body</span>
                                                                <div className="mt-1 p-3 rounded-lg bg-background/50 border border-border/20 ds-body whitespace-pre-wrap break-words max-h-[240px] overflow-y-auto">{row.body}</div>
                                                            </div>
                                                        )}
                                                        {row.media_gcs_path && <MediaViewer path={row.media_gcs_path} />}
                                                    </div>
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

            {totalPages > 1 && (
                <div className="flex items-center justify-between ds-small">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} className="px-2 py-1 rounded border border-border/30 hover:border-border/50 disabled:opacity-30">← Prev</button>
                        <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={page >= totalPages} className="px-2 py-1 rounded border border-border/30 hover:border-border/50 disabled:opacity-30">Next →</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Event / Audit generic ───────────────────────────────────────

function GenericLogView<T extends { event_id: string }>({
    title, description, rows, loading, total, offset, onOffset, onReload, headers, renderRow, error,
}: {
    title: string;
    description: string;
    rows: T[];
    loading: boolean;
    total: number;
    offset: number;
    onOffset: (n: number) => void;
    onReload: () => void;
    headers: string[];
    renderRow: (row: T) => React.ReactNode[];
    error?: string | null;
}) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const page = Math.floor(offset / PAGE_SIZE) + 1;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="ds-title">{title}</h3>
                    <span className="ds-small text-muted-foreground">{total.toLocaleString()} · {description}</span>
                </div>
                <button onClick={onReload} disabled={loading} className="p-1.5 rounded-md border border-border/30 text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 ds-small text-red-400">
                    Gagal memuat: {error}
                </div>
            )}
            <div className="rounded-lg border border-border/30 overflow-hidden">
                <table className="w-full text-[12px]">
                    <thead>
                        <tr className="bg-muted/10 border-b border-border/20">
                            {headers.map((h) => <th key={h} className="text-left px-3 py-2 ds-label">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                        {loading && rows.length === 0 && <tr><td colSpan={headers.length} className="px-3 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground/30" /></td></tr>}
                        {!loading && rows.length === 0 && <tr><td colSpan={headers.length} className="px-3 py-8 text-center"><Activity className="h-8 w-8 text-muted-foreground/15 mx-auto mb-2" /><p className="ds-small">No logs yet</p></td></tr>}
                        {rows.map((row) => {
                            const open = expanded === row.event_id;
                            const cells = renderRow(row);
                            return (
                                <React.Fragment key={row.event_id}>
                                    <tr onClick={() => setExpanded(open ? null : row.event_id)} className={`cursor-pointer hover:bg-muted/5 ${open ? 'bg-muted/10' : ''}`}>
                                        {cells.map((c, i) => <td key={i} className="px-3 py-2 ds-small">{c}</td>)}
                                    </tr>
                                    {open && (
                                        <tr>
                                            <td colSpan={headers.length} className="px-4 py-3 bg-muted/5 border-t border-border/10">
                                                <pre className="ds-small font-mono whitespace-pre-wrap break-all bg-background/50 border border-border/20 p-3 rounded-lg max-h-[320px] overflow-auto">
{JSON.stringify(row, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between ds-small">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} className="px-2 py-1 rounded border border-border/30 disabled:opacity-30">← Prev</button>
                        <button onClick={() => onOffset(offset + PAGE_SIZE)} disabled={page >= totalPages} className="px-2 py-1 rounded border border-border/30 disabled:opacity-30">Next →</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function EventView() {
    const [rows, setRows] = useState<EventLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await fetchEventLogs({ limit: PAGE_SIZE, offset }); setRows(r.rows); setTotal(r.total); setError(null); }
        catch (err) { setRows([]); setTotal(0); setError(err instanceof Error ? err.message : 'fetch failed'); }
        finally { setLoading(false); }
    }, [offset]);
    useEffect(() => { load(); }, [load]);

    return (
        <GenericLogView
            title="Event Logs"
            description="BQ wagate.event_log · Baileys events"
            rows={rows} loading={loading} total={total} offset={offset}
            error={error}
            onOffset={setOffset} onReload={load}
            headers={['Time (WIB)', 'Event Type', 'Session', 'Payload Preview']}
            renderRow={(row) => [
                <span key="t" className="font-mono">{formatTimeWIB(row.timestamp_wib)}</span>,
                <Badge key="e" variant="outline" className="ds-small">{row.event_type}</Badge>,
                <span key="s" className="font-mono">{row.session}</span>,
                <span key="p" className="truncate max-w-[340px] block text-muted-foreground">{row.payload?.substring(0, 120) || '—'}</span>,
            ]}
        />
    );
}

function AuditView() {
    const [rows, setRows] = useState<AuditLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await fetchAuditLogs({ limit: PAGE_SIZE, offset }); setRows(r.rows); setTotal(r.total); setError(null); }
        catch (err) { setRows([]); setTotal(0); setError(err instanceof Error ? err.message : 'fetch failed'); }
        finally { setLoading(false); }
    }, [offset]);
    useEffect(() => { load(); }, [load]);

    return (
        <GenericLogView
            title="Audit Logs"
            description="BQ wagate.audit_log · API call audit"
            rows={rows} loading={loading} total={total} offset={offset}
            error={error}
            onOffset={setOffset} onReload={load}
            headers={['Time (WIB)', 'Caller', 'Action', 'Resource', 'Result', 'ms']}
            renderRow={(row) => [
                <span key="t" className="font-mono">{formatTimeWIB(row.timestamp_wib)}</span>,
                <span key="c">{row.caller_identity} <span className="text-muted-foreground">({row.caller_type})</span></span>,
                <Badge key="a" variant="outline" className="ds-small">{row.action}</Badge>,
                <span key="r" className="truncate max-w-[200px] block font-mono">{row.resource || '—'}</span>,
                <StatusPill key="s" status={row.result} />,
                <span key="m" className="font-mono text-muted-foreground">{row.duration_ms ?? '—'}</span>,
            ]}
        />
    );
}

// ─── Main ────────────────────────────────────────────────────────

function TabLogsImpl() {
    return (
        <Tabs defaultValue="delivery" className="space-y-4">
            <TabsList>
                <TabsTrigger value="delivery"><ScrollText />Delivery</TabsTrigger>
                <TabsTrigger value="messages"><Inbox />Messages</TabsTrigger>
                <TabsTrigger value="events"><Activity />Events</TabsTrigger>
                <TabsTrigger value="audit"><Shield />Audit</TabsTrigger>
            </TabsList>
            <TabsContent value="delivery"><DeliveryView /></TabsContent>
            <TabsContent value="messages"><MessageView /></TabsContent>
            <TabsContent value="events"><EventView /></TabsContent>
            <TabsContent value="audit"><AuditView /></TabsContent>
            <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-3 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="ds-small text-blue-300/70 leading-relaxed">
                    Click row untuk detail + preview media (image/PDF/audio/video) via signed URL GCS 15 min.
                    Pattern mirror Notifier tab. Data real-time BigQuery.
                </div>
            </div>
        </Tabs>
    );
}

const TabLogs = memo(TabLogsImpl);
export default TabLogs;
