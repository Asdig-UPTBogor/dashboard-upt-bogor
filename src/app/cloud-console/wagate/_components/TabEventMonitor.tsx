"use client";

/**
 * Tab Event Monitor — real-time Baileys event stream via SSE.
 *
 * §18 Data Contract: subscribe ke `/api/events/stream` (SSE) via Dashboard BE proxy.
 * Events: session.status, message.inbound, message.outbound, message.ack, message.edit,
 *         message.delete, groups.upsert, groups.update, group-participants.update.
 *
 * Features:
 *   - Live stream dengan auto-scroll
 *   - Filter by event type (multi-select)
 *   - Pause / Resume button
 *   - Clear buffer
 *   - Max 500 rows (oldest evicted)
 */

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
    Activity, Pause, Play, Trash2, Filter, Circle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CLOUD_CONSOLE_API } from '@/lib/cloud-console-api';
import { MAX_EVENT_STREAM_BUFFER, SSE_RECONNECT_DELAY_MS } from '../_lib/constants';

interface StreamEvent {
    id: string;
    event: string;
    session?: string;
    payload: Record<string, unknown>;
    timestamp: string;
    receivedAt: number;
}

const MAX_EVENTS = MAX_EVENT_STREAM_BUFFER;
const SSE_URL = `${CLOUD_CONSOLE_API}/services/wagate/actions/events-stream`;

const EVENT_COLOR: Record<string, string> = {
    'stream.hello': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'session.status': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'message.inbound': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'message.outbound': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    'message.ack': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'message.edit': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    'message.delete': 'bg-red-500/10 text-red-400 border-red-500/30',
    'groups.upsert': 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    'groups.update': 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    'group-participants.update': 'bg-violet-500/10 text-violet-400 border-violet-500/30',
};

function TabEventMonitorImpl({
    showFeedback,
}: {
    config: unknown;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    const [events, setEvents] = useState<StreamEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [paused, setPaused] = useState(false);
    const [filter, setFilter] = useState<string>('all');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const sourceRef = useRef<EventSource | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pausedRef = useRef(paused);
    pausedRef.current = paused;

    const connect = useCallback(() => {
        if (sourceRef.current) {
            sourceRef.current.close();
            sourceRef.current = null;
        }
        if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
        }
        try {
            const es = new EventSource(SSE_URL, { withCredentials: true });
            sourceRef.current = es;
            es.onopen = () => setConnected(true);
            es.onerror = () => {
                setConnected(false);
                // Auto-reconnect after 5s kalau upstream WaGate restart / network glitch
                es.close();
                sourceRef.current = null;
                if (!reconnectRef.current) {
                    reconnectRef.current = setTimeout(() => {
                        reconnectRef.current = null;
                        connect();
                    }, SSE_RECONNECT_DELAY_MS);
                }
            };
            es.onmessage = (msgEvt) => {
                if (pausedRef.current) return;
                try {
                    const data = JSON.parse(msgEvt.data);
                    const newEvt: StreamEvent = {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        event: data.event || 'unknown',
                        session: data.session,
                        payload: data.payload || {},
                        timestamp: data.timestamp || new Date().toISOString(),
                        receivedAt: Date.now(),
                    };
                    setEvents((prev) => {
                        const next = [newEvt, ...prev];
                        return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
                    });
                } catch (parseErr) {
                    console.warn('[TabEventMonitor] malformed SSE payload:', parseErr, msgEvt.data?.slice?.(0, 200));
                }
            };
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'SSE connect failed', false);
        }
    }, [showFeedback]);

    useEffect(() => {
        connect();
        return () => {
            if (sourceRef.current) {
                sourceRef.current.close();
                sourceRef.current = null;
            }
            if (reconnectRef.current) {
                clearTimeout(reconnectRef.current);
                reconnectRef.current = null;
            }
        };
    }, [connect]);

    // P1-6 fix: memoize filter + type count — sebelumnya O(n × types) tiap render,
    // dengan MAX_EVENTS=500 dan 10 type itu 5000 iter per render.
    const { filtered, eventTypes, countsByType } = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const e of events) {
            counts[e.event] = (counts[e.event] ?? 0) + 1;
        }
        const types = Object.keys(counts).sort();
        const filt = filter === 'all' ? events : events.filter((e) => e.event === filter);
        return { filtered: filt, eventTypes: types, countsByType: counts };
    }, [events, filter]);

    function toggleExpand(id: string) {
        setExpanded((p) => ({ ...p, [id]: !p[id] }));
    }

    function handleClear() {
        setEvents([]);
        setExpanded({});
    }

    function handleReconnect() {
        connect();
    }

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                        <Activity className={connected ? 'h-4 w-4 text-emerald-400' : 'h-4 w-4 text-red-400'} />
                        <CardTitle className="ds-title">Event Monitor</CardTitle>
                        <Circle className={`h-2 w-2 fill-current ${connected ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} />
                        <span className="ds-small text-muted-foreground">
                            {connected ? 'Connected' : 'Disconnected'} · {events.length} events
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
                            {paused ? <Play /> : <Pause />}
                            {paused ? 'Resume' : 'Pause'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClear} disabled={events.length === 0}>
                            <Trash2 /> Clear
                        </Button>
                        {!connected && (
                            <Button variant="outline" size="sm" onClick={handleReconnect}>
                                Reconnect
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-[240px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All events ({events.length})</SelectItem>
                                {eventTypes.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t} ({countsByType[t]})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Stream */}
                    {filtered.length === 0 ? (
                        <Alert className="border-border/30 bg-muted/5">
                            <AlertDescription className="ds-small text-muted-foreground">
                                {connected
                                    ? 'Menunggu event… coba send test message atau observe reconnect.'
                                    : 'Belum terhubung ke SSE stream. Klik Reconnect.'}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <ScrollArea className="h-[520px] rounded-lg border border-border/40">
                            <div className="divide-y divide-border/30">
                                {filtered.map((e) => {
                                    const isExpanded = !!expanded[e.id];
                                    const badgeClass = EVENT_COLOR[e.event] || 'bg-muted/20 text-muted-foreground border-border/30';
                                    return (
                                        <div key={e.id} className="p-3 hover:bg-muted/5">
                                            <button
                                                type="button"
                                                onClick={() => toggleExpand(e.id)}
                                                className="flex items-start gap-3 w-full text-left"
                                            >
                                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 mt-1 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 mt-1 text-muted-foreground" />}
                                                <Badge variant="outline" className={badgeClass}>{e.event}</Badge>
                                                {e.session && <Badge variant="secondary" className="ds-small">{e.session}</Badge>}
                                                <span className="ds-small text-muted-foreground ml-auto">
                                                    {new Date(e.timestamp).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })}
                                                </span>
                                            </button>
                                            {isExpanded && (
                                                <pre className="ds-small font-mono bg-muted/10 border border-border/30 rounded p-2 mt-2 overflow-x-auto whitespace-pre-wrap">
                                                    {JSON.stringify(e.payload, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

const TabEventMonitor = memo(TabEventMonitorImpl, (prev, next) =>
    prev.config === next.config && prev.showFeedback === next.showFeedback);
export default TabEventMonitor;
