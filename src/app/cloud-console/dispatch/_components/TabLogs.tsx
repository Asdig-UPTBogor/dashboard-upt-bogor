"use client";

/**
 * Tab Logs — Delivery log viewer (BQ dispatch.delivery_log).
 * Filter status, pagination, expandable row detail.
 */

import { useState, useEffect, useCallback } from 'react';
import { ScrollText, ChevronDown, ChevronRight, RefreshCw, Info } from 'lucide-react';

import { fetchDeliveryLogs, fmtWIB, fmtAgo, fmtMs } from '../_lib/api';
import type { DeliveryLogRow, DispatchGroup } from '../_lib/types';

const PAGE_SIZE = 50;
const STATUS_FILTERS = ['all', 'delivered', 'failed', 'skipped', 'dropped'] as const;

export default function TabLogs({ groups }: { groups?: Record<string, DispatchGroup> }) {
    const [rows, setRows] = useState<DeliveryLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchDeliveryLogs({
                limit: PAGE_SIZE,
                offset,
                status: statusFilter === 'all' ? undefined : statusFilter,
            });
            setRows(result.rows);
            setTotal(result.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal load');
        } finally {
            setLoading(false);
        }
    }, [offset, statusFilter]);

    useEffect(() => {
        load();
    }, [load]);

    function handleFilterChange(s: typeof STATUS_FILTERS[number]) {
        setStatusFilter(s);
        setOffset(0);
    }

    const groupNameLookup = (key: string) => groups?.[key]?.wa_group_name || key;

    return (
        <div className="space-y-4">
            {/* Info domain */}
            <div className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/5 p-3">
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span className="ds-small text-muted-foreground/80">
                    <strong className="text-foreground/90">Tab Logs</strong> — audit outbound delivery. Filter by status, klik row untuk detail.
                </span>
            </div>

            {/* Header + Filter */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-muted-foreground/60" />
                    <span className="ds-label uppercase tracking-wider">
                        Delivery Logs ({total.toLocaleString()})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md border border-border overflow-hidden">
                        {STATUS_FILTERS.map((s) => (
                            <button
                                key={s}
                                onClick={() => handleFilterChange(s)}
                                className={`px-2.5 py-1 text-xs capitalize ${
                                    statusFilter === s
                                        ? 'bg-blue-500/10 text-blue-400'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="rounded-lg border border-border/50 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-muted/20 border-b border-border/50">
                        <tr className="text-left">
                            <th className="px-2 py-2 w-6"></th>
                            <th className="px-3 py-2 ds-label">Time</th>
                            <th className="px-3 py-2 ds-label">Group</th>
                            <th className="px-3 py-2 ds-label" title="Provider aktual yang kirim pesan (wagate/waha)">Provider</th>
                            <th className="px-3 py-2 ds-label">Type</th>
                            <th className="px-3 py-2 ds-label">Source</th>
                            <th className="px-3 py-2 ds-label">Status</th>
                            <th className="px-3 py-2 ds-label">ms</th>
                            <th className="px-3 py-2 ds-label">Message</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {rows.length === 0 && !loading && (
                            <tr><td colSpan={9} className="px-3 py-8 text-center ds-small">
                                Tidak ada log.
                            </td></tr>
                        )}
                        {rows.map((r) => {
                            const isExp = expanded === r.event_id;
                            const statusColor =
                                r.status === 'delivered' ? 'text-emerald-400' :
                                r.status === 'failed' ? 'text-red-400' :
                                r.status === 'skipped' ? 'text-slate-400' :
                                'text-amber-400';
                            return (
                                <>
                                    <tr
                                        key={r.event_id}
                                        onClick={() => setExpanded(isExp ? null : r.event_id)}
                                        className="hover:bg-muted/5 cursor-pointer"
                                    >
                                        <td className="px-2 py-2">
                                            {isExp ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                        </td>
                                        <td className="px-3 py-2 font-mono tabular-nums ds-small">
                                            {fmtWIB(r.delivered_at)}
                                        </td>
                                        <td className="px-3 py-2 text-foreground/80">{groupNameLookup(r.group_key)}</td>
                                        <td className="px-3 py-2 font-mono ds-small uppercase">{r.provider || r.channel || '—'}</td>
                                        <td className="px-3 py-2 ds-small">{r.type}</td>
                                        <td className="px-3 py-2 ds-small text-muted-foreground/70">{r.source}</td>
                                        <td className={`px-3 py-2 font-mono font-medium ${statusColor}`}>{r.status}</td>
                                        <td className="px-3 py-2 font-mono tabular-nums ds-small">{fmtMs(r.duration_ms)}</td>
                                        <td className="px-3 py-2 text-foreground/60 max-w-md truncate">{r.text || '—'}</td>
                                    </tr>
                                    {isExp && (
                                        <tr key={`${r.event_id}-exp`} className="bg-muted/5">
                                            <td colSpan={9} className="px-6 py-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                                                    <ExpField label="Event ID" value={r.event_id} mono />
                                                    <ExpField label="Pub/Sub Msg ID" value={r.pubsub_message_id || '—'} mono />
                                                    <ExpField label="Chat ID" value={r.chat_id} mono />
                                                    <ExpField label="Group Key" value={r.group_key} />
                                                    <ExpField label="Group Name" value={r.group_name || '—'} />
                                                    <ExpField label="Channel" value={r.channel} />
                                                    <ExpField label="Type" value={r.type} />
                                                    <ExpField label="Priority" value={r.priority || 'normal'} />
                                                    <ExpField label="Provider" value={r.provider} />
                                                    <ExpField label="Provider Msg ID" value={r.provider_message_id || '—'} mono />
                                                    <ExpField label="Duration" value={fmtMs(r.duration_ms)} />
                                                    <ExpField label="Enqueued" value={`${fmtWIB(r.enqueued_at)} (${fmtAgo(r.enqueued_at)})`} />
                                                    <ExpField label="Delivered" value={`${fmtWIB(r.delivered_at)} (${fmtAgo(r.delivered_at)})`} />
                                                    <ExpField label="Image GCS" value={r.image_gcs_path || '—'} mono />
                                                    {r.error && (
                                                        <div className="md:col-span-2 mt-1 rounded border border-red-500/20 bg-red-500/5 p-2">
                                                            <div className="ds-label text-red-400 mb-1">Error</div>
                                                            <div className="text-xs font-mono text-red-300/80">{r.error}</div>
                                                        </div>
                                                    )}
                                                    {r.text && r.text.length > 100 && (
                                                        <div className="md:col-span-2 mt-1 rounded border border-border/30 bg-muted/10 p-2">
                                                            <div className="ds-label mb-1">Full Message (max 500 char)</div>
                                                            <div className="text-xs text-foreground/70 whitespace-pre-wrap break-words">{r.text}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between ds-small">
                    <span>
                        {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} dari {total.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                            disabled={offset === 0 || loading}
                            className="px-2.5 py-1 rounded-md border border-border hover:text-foreground disabled:opacity-30"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setOffset(offset + PAGE_SIZE)}
                            disabled={offset + PAGE_SIZE >= total || loading}
                            className="px-2.5 py-1 rounded-md border border-border hover:text-foreground disabled:opacity-30"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            <div className="ds-small text-muted-foreground/60">
                Data dari BigQuery <code className="font-mono bg-muted/30 px-1 py-0.5 rounded">dispatch.delivery_log</code>.
            </div>
        </div>
    );
}

function ExpField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex justify-between gap-2 py-0.5 border-b border-border/20 last:border-0">
            <span className="text-muted-foreground/60 shrink-0">{label}</span>
            <span className={`truncate text-foreground/80 ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    );
}
