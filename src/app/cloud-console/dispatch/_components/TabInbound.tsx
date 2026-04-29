"use client";

/**
 * Tab Inbound — BARU di Dispatch.
 * 2 sub-tab: Messages (waha.message_log) + Events (waha.event_log)
 * Berisi SEMUA chat WA (inbound + outbound) + system events.
 */

import { useState, useEffect, useCallback } from 'react';
import { Inbox, MessageSquare, Radio, RefreshCw, ChevronRight, ChevronDown, AlertCircle, Info } from 'lucide-react';

import { fetchInboundLogs, fetchEventLogs, fmtWIB, fmtAgo } from '../_lib/api';
import type { MessageLogRow, EventLogRow } from '../_lib/types';

type SubTab = 'messages' | 'events';
const PAGE_SIZE = 50;

export default function TabInbound() {
    const [subTab, setSubTab] = useState<SubTab>('messages');

    return (
        <div className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-400/90">
                    <strong>Inbound</strong> hanya aktif saat WAHA <code className="font-mono bg-muted/30 px-1 rounded">min-instances=1</code>.
                    Data di sini menampilkan pesan yang tercatat saat inbound enable. Saat min=0, tidak ada pesan baru.
                </div>
            </div>

            {/* Sub-tab switcher */}
            <div className="flex items-center gap-1 border-b border-border">
                <SubTabButton
                    active={subTab === 'messages'} onClick={() => setSubTab('messages')}
                    icon={<MessageSquare className="h-3.5 w-3.5" />} label="Messages"
                />
                <SubTabButton
                    active={subTab === 'events'} onClick={() => setSubTab('events')}
                    icon={<Radio className="h-3.5 w-3.5" />} label="Events"
                />
            </div>

            {subTab === 'messages' && <MessageTable />}
            {subTab === 'events' && <EventTable />}
        </div>
    );
}

function SubTabButton({ active, onClick, icon, label }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                active
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

/* ── Messages ── */

function MessageTable() {
    const [rows, setRows] = useState<MessageLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [direction, setDirection] = useState<string>('');
    const [chatType, setChatType] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchInboundLogs({
                limit: PAGE_SIZE, offset,
                direction: direction || undefined,
                chat_type: chatType || undefined,
            });
            setRows(result.rows);
            setTotal(result.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal load');
        } finally {
            setLoading(false);
        }
    }, [offset, direction, chatType]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-3">
            {/* Info domain */}
            <div className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/5 p-3">
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span className="ds-small text-muted-foreground/80">
                    <strong className="text-foreground/90">Tab Inbound</strong> — pesan yang masuk dari user (reply ke bot).
                    Gateway fire webhook HMAC-signed ke Dispatch. Read-only audit view.
                </span>
            </div>

            <div className="flex items-center justify-between">
                <span className="ds-label uppercase tracking-wider">
                    <Inbox className="inline h-3.5 w-3.5 mr-1 text-muted-foreground/60" />
                    Messages ({total.toLocaleString()})
                </span>
                <div className="flex items-center gap-2">
                    <FilterSelect value={direction} onChange={(v) => { setDirection(v); setOffset(0); }} options={[
                        { v: '', l: 'All directions' }, { v: 'inbound', l: 'Inbound' }, { v: 'outbound', l: 'Outbound' },
                    ]} />
                    <FilterSelect value={chatType} onChange={(v) => { setChatType(v); setOffset(0); }} options={[
                        { v: '', l: 'All types' }, { v: 'group', l: 'Group' }, { v: 'personal', l: 'Personal' },
                    ]} />
                    <RefreshButton onClick={load} loading={loading} />
                </div>
            </div>

            {error && <ErrorBanner msg={error} />}

            <div className="rounded-lg border border-border/50 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-muted/20 border-b border-border/50">
                        <tr className="text-left">
                            <th className="px-2 py-2 w-6"></th>
                            <th className="px-3 py-2 ds-label">Time</th>
                            <th className="px-3 py-2 ds-label">Dir</th>
                            <th className="px-3 py-2 ds-label">From</th>
                            <th className="px-3 py-2 ds-label">Chat</th>
                            <th className="px-3 py-2 ds-label">Body</th>
                            <th className="px-3 py-2 ds-label">Media</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {rows.length === 0 && !loading && (
                            <tr><td colSpan={7} className="px-3 py-8 text-center ds-small">Tidak ada pesan.</td></tr>
                        )}
                        {rows.map((r) => {
                            const isExp = expanded === r.event_id;
                            return (
                                <>
                                    <tr key={r.event_id} onClick={() => setExpanded(isExp ? null : r.event_id)}
                                        className="hover:bg-muted/5 cursor-pointer">
                                        <td className="px-2 py-2">{isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</td>
                                        <td className="px-3 py-2 font-mono ds-small">{fmtWIB(r.timestamp_wib)}</td>
                                        <td className="px-3 py-2">
                                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                                r.direction === 'inbound' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                                            }`}>{r.direction}</span>
                                        </td>
                                        <td className="px-3 py-2 text-foreground/80 max-w-32 truncate">{r.from_name || r.from_id}</td>
                                        <td className="px-3 py-2 ds-small">{r.chat_type}</td>
                                        <td className="px-3 py-2 text-foreground/60 max-w-md truncate">{r.body || '—'}</td>
                                        <td className="px-3 py-2 ds-small">{r.has_media ? '✓' : ''}</td>
                                    </tr>
                                    {isExp && (
                                        <tr key={`${r.event_id}-exp`} className="bg-muted/5">
                                            <td colSpan={7} className="px-6 py-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                                                    <ExpField label="Event ID" value={r.event_id} mono />
                                                    <ExpField label="Message ID" value={r.message_id} mono />
                                                    <ExpField label="From" value={r.from_id} mono />
                                                    <ExpField label="From Name" value={r.from_name || '—'} />
                                                    <ExpField label="To" value={r.to_id} mono />
                                                    <ExpField label="Chat Type" value={r.chat_type} />
                                                    <ExpField label="Source" value={r.source || '—'} />
                                                    <ExpField label="Media Type" value={r.media_type || '—'} />
                                                    <ExpField label="Media GCS" value={r.media_gcs_path || '—'} mono />
                                                    <ExpField label="Inserted" value={fmtWIB(r.inserted_at)} />
                                                    {r.body && (
                                                        <div className="md:col-span-2 mt-1 rounded border border-border/30 bg-muted/10 p-2">
                                                            <div className="ds-label mb-1">Body</div>
                                                            <div className="text-xs text-foreground/70 whitespace-pre-wrap break-words">{r.body}</div>
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

            <Pagination offset={offset} total={total} loading={loading} onPrev={() => setOffset(Math.max(0, offset - PAGE_SIZE))} onNext={() => setOffset(offset + PAGE_SIZE)} />

            <div className="ds-small text-muted-foreground/60">
                BQ: <code className="font-mono bg-muted/30 px-1 py-0.5 rounded">waha.message_log</code>.
            </div>
        </div>
    );
}

/* ── Events ── */

function EventTable() {
    const [rows, setRows] = useState<EventLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [eventType, setEventType] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchEventLogs({
                limit: PAGE_SIZE, offset,
                event_type: eventType || undefined,
            });
            setRows(result.rows);
            setTotal(result.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal load');
        } finally {
            setLoading(false);
        }
    }, [offset, eventType]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="ds-label uppercase tracking-wider">
                    <Radio className="inline h-3.5 w-3.5 mr-1 text-muted-foreground/60" />
                    Events ({total.toLocaleString()})
                </span>
                <div className="flex items-center gap-2">
                    <FilterSelect value={eventType} onChange={(v) => { setEventType(v); setOffset(0); }} options={[
                        { v: '', l: 'All types' },
                        { v: 'session.status', l: 'session.status' },
                        { v: 'group.join', l: 'group.join' },
                        { v: 'group.leave', l: 'group.leave' },
                    ]} />
                    <RefreshButton onClick={load} loading={loading} />
                </div>
            </div>

            {error && <ErrorBanner msg={error} />}

            <div className="rounded-lg border border-border/50 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-muted/20 border-b border-border/50">
                        <tr className="text-left">
                            <th className="px-2 py-2 w-6"></th>
                            <th className="px-3 py-2 ds-label">Time</th>
                            <th className="px-3 py-2 ds-label">Event Type</th>
                            <th className="px-3 py-2 ds-label">Session</th>
                            <th className="px-3 py-2 ds-label">Payload</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {rows.length === 0 && !loading && (
                            <tr><td colSpan={5} className="px-3 py-8 text-center ds-small">Tidak ada event.</td></tr>
                        )}
                        {rows.map((r) => {
                            const isExp = expanded === r.event_id;
                            return (
                                <>
                                    <tr key={r.event_id} onClick={() => setExpanded(isExp ? null : r.event_id)}
                                        className="hover:bg-muted/5 cursor-pointer">
                                        <td className="px-2 py-2">{isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</td>
                                        <td className="px-3 py-2 font-mono ds-small">{fmtWIB(r.timestamp_wib)}</td>
                                        <td className="px-3 py-2 font-mono text-blue-400">{r.event_type}</td>
                                        <td className="px-3 py-2 font-mono ds-small">{r.session}</td>
                                        <td className="px-3 py-2 text-foreground/60 max-w-xl truncate">
                                            {r.payload ? r.payload.substring(0, 100) : '—'}
                                        </td>
                                    </tr>
                                    {isExp && r.payload && (
                                        <tr key={`${r.event_id}-exp`} className="bg-muted/5">
                                            <td colSpan={5} className="px-6 py-3">
                                                <div className="text-xs">
                                                    <div className="ds-label mb-1">Payload</div>
                                                    <pre className="text-xs font-mono text-foreground/70 bg-muted/20 p-2 rounded border border-border/30 overflow-x-auto max-h-96">{formatJson(r.payload)}</pre>
                                                    <div className="mt-2 ds-small">
                                                        Inserted: {fmtWIB(r.inserted_at)} ({fmtAgo(r.inserted_at)})
                                                    </div>
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

            <Pagination offset={offset} total={total} loading={loading} onPrev={() => setOffset(Math.max(0, offset - PAGE_SIZE))} onNext={() => setOffset(offset + PAGE_SIZE)} />

            <div className="ds-small text-muted-foreground/60">
                BQ: <code className="font-mono bg-muted/30 px-1 py-0.5 rounded">waha.event_log</code>.
            </div>
        </div>
    );
}

/* ── shared ── */

function formatJson(s: string): string {
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

function FilterSelect({ value, onChange, options }: {
    value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)}
            className="h-7 px-2 text-xs rounded-md border border-border bg-muted/20 focus-visible:outline-none focus-visible:border-blue-500/50">
            {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
    );
}

function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
    return (
        <button onClick={onClick} disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
        </button>
    );
}

function ErrorBanner({ msg }: { msg: string }) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">{msg}</div>;
}

function Pagination({ offset, total, loading, onPrev, onNext }: {
    offset: number; total: number; loading: boolean; onPrev: () => void; onNext: () => void;
}) {
    if (total <= PAGE_SIZE) return null;
    return (
        <div className="flex items-center justify-between ds-small">
            <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} dari {total.toLocaleString()}</span>
            <div className="flex items-center gap-2">
                <button onClick={onPrev} disabled={offset === 0 || loading}
                    className="px-2.5 py-1 rounded-md border border-border hover:text-foreground disabled:opacity-30">Prev</button>
                <button onClick={onNext} disabled={offset + PAGE_SIZE >= total || loading}
                    className="px-2.5 py-1 rounded-md border border-border hover:text-foreground disabled:opacity-30">Next</button>
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
