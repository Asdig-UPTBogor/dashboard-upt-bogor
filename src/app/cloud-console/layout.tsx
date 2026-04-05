"use client";

/**
 * Cloud Console Layout — ServiceExplorer sidebar + content + log panels.
 *
 * Architecture:
 *   Left: ServiceExplorer (reads from Firestore via API)
 *   Center: Children (service page)
 *   Right: LogPanel(s) — one per checked service, 300px each
 *
 * Log System (Optimized — Self-Healing):
 *   - On checkbox: fetch backfill per service via REST API
 *   - 1 shared SSE tail for real-time updates (new entries only)
 *   - SSE sends ENRICHED status events: tail_started, tail_retrying, tail_failed, etc.
 *   - Layout handles ALL status events → streamStatus state machine
 *   - Per-service buffer (each service gets its own entries array)
 *   - On uncheck: clear that service's buffer
 *   - On reconnect (stream_expired): re-backfill all checked services
 *   - LogProvider wired for service pages to inject/refresh logs
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ServiceExplorer } from "./_components/ServiceExplorer";
import { LogPanel } from "./_components/LogPanel";
import { LogProvider } from "./_components/LogContext";
import { CLOUD_CONSOLE_API, CONSOLE_LOG_STREAM_URL } from "@/lib/cloud-console-api";
import { FirestoreProvider } from "./_components/FirestoreProvider";
import { useFirestoreRegistry } from "./_components/useFirestore";

export interface ServiceInfo {
    id: string;
    name: string;
    icon: string;
    color: string;
    status: string;
    serviceType?: 'cloud_function' | 'cloud_run';
    routePath?: string;
    description?: string;
    subtitle?: string;
    schedulerJobId?: string;
    configCollection?: string;
}

export interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "warn" | "error" | "success" | "debug";
    stage: string;
    message: string;
    serviceId?: string;
    source?: string;
    runId?: string | null;
    metrics?: Record<string, number>;
    meta?: Record<string, unknown>;
}

/** Stream status — drives the KREDIBEL indicator in LogPanel */
export type StreamStatus =
    | "connecting"    // SSE establishing
    | "backfilling"   // SSE connected, backfill received
    | "tailing"       // tailEntries active, data flowing
    | "retrying"      // tail error, auto-retrying
    | "failed"        // tail failed after max retries
    | "offline";      // SSE disconnected

const MAX_ENTRIES_PER_SERVICE = 300;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
// If no data received for 5 min while "tailing", consider stale
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export default function ServerlessHubLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <FirestoreProvider>
            <InnerLayout>{children}</InnerLayout>
        </FirestoreProvider>
    );
}

function InnerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [checkedServices, setCheckedServices] = useState<Set<string>>(new Set());
    const [entriesMap, setEntriesMap] = useState<Record<string, LogEntry[]>>({});
    const [loadingLogs, setLoadingLogs] = useState<Set<string>>(new Set());

    // Stream status state machine (replaces simple boolean `connected`)
    const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
    const [lastDataReceived, setLastDataReceived] = useState<number>(0);
    const [tailRetryInfo, setTailRetryInfo] = useState<{ attempt: number; maxRetries: number } | null>(null);

    // Tick every 30s so isStale useMemo re-evaluates Date.now()
    const [staleTick, setStaleTick] = useState(0);
    useEffect(() => {
        const iv = setInterval(() => setStaleTick(t => t + 1), 30_000);
        return () => clearInterval(iv);
    }, []);

    const esRef = useRef<EventSource | null>(null);
    const streamStatusRef = useRef<StreamStatus>(streamStatus);
    useEffect(() => { streamStatusRef.current = streamStatus; }, [streamStatus]);
    const retryCountRef = useRef(0);
    const checkedRef = useRef<Set<string>>(new Set());

    // Keep ref in sync with state
    useEffect(() => {
        checkedRef.current = checkedServices;
    }, [checkedServices]);

    const registry = useFirestoreRegistry();
    const services = useMemo(() => {
        if (!registry) return [];
        return Object.entries(registry)
            .filter(([, def]) => (def as ServiceInfo).status !== "disabled")
            .map(([id, def]) => ({ id, ...(def as Omit<ServiceInfo, "id">) }));
    }, [registry]);

    // ── Fetch backfill for a specific service ──
    const fetchServiceLogs = useCallback(async (serviceId: string) => {
        setLoadingLogs((prev) => new Set(prev).add(serviceId));
        try {
            const res = await fetch(`${CLOUD_CONSOLE_API}/logs/${serviceId}?limit=200&hours=1`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const entries = (data.entries || []) as LogEntry[];

            setEntriesMap((prev) => ({
                ...prev,
                [serviceId]: entries.slice(-MAX_ENTRIES_PER_SERVICE),
            }));
        } catch (err) {
            console.error(`[layout] Failed to fetch logs for ${serviceId}:`, err);
            setEntriesMap((prev) => ({ ...prev, [serviceId]: prev[serviceId] || [] }));
        } finally {
            setLoadingLogs((prev) => {
                const next = new Set(prev);
                next.delete(serviceId);
                return next;
            });
        }
    }, []);

    // ── Re-backfill all checked services (called after SSE reconnect) ──
    const reBackfillChecked = useCallback(() => {
        checkedRef.current.forEach((serviceId) => {
            fetchServiceLogs(serviceId);
        });
    }, [fetchServiceLogs]);

    // ── 1 Shared SSE connection (with full status event handling) ──
    useEffect(() => {
        let reconnectTimeout: ReturnType<typeof setTimeout>;

        function connect() {
            setStreamStatus("connecting");
            const es = new EventSource(CONSOLE_LOG_STREAM_URL);
            esRef.current = es;

            es.onopen = () => {
                // SSE HTTP connected — but tail may not be active yet
                // Don't set "tailing" here — wait for tail_started event
                setStreamStatus("backfilling");
                retryCountRef.current = 0;
            };

            es.onmessage = (event) => {
                try {
                    const entry = JSON.parse(event.data) as LogEntry;
                    if (!entry.id || !entry.timestamp || !entry.serviceId) return;

                    // Track last data received time (for stale detection)
                    setLastDataReceived(Date.now());

                    // Only buffer entries for checked services
                    if (!checkedRef.current.has(entry.serviceId)) return;

                    setEntriesMap((prev) => {
                        const existing = prev[entry.serviceId!] || [];
                        if (existing.some((e) => e.id === entry.id)) return prev;
                        const updated = [...existing, entry].slice(-MAX_ENTRIES_PER_SERVICE);
                        return { ...prev, [entry.serviceId!]: updated };
                    });
                } catch {
                    /* ignore */
                }
            };

            // Handle ALL status events from SSE route
            es.addEventListener("status", (event) => {
                try {
                    const data = JSON.parse((event as MessageEvent).data);

                    switch (data.type) {
                        case "backfill_complete":
                            // Backfill done — status stays "backfilling" until tail starts
                            break;

                        case "tail_started":
                            setStreamStatus("tailing");
                            setTailRetryInfo(null);
                            break;

                        case "tail_retrying":
                            setStreamStatus("retrying");
                            setTailRetryInfo({
                                attempt: data.attempt,
                                maxRetries: data.maxRetries,
                            });
                            break;

                        case "tail_failed":
                            setStreamStatus("failed");
                            setTailRetryInfo(null);
                            break;

                        case "tail_error":
                            // Transient — server will retry automatically
                            // Don't change status here, wait for tail_retrying
                            break;

                        case "heartbeat":
                            // Enriched heartbeat: { mode, lastEntryTime, entriesDelivered, tailRetryCount }
                            if (data.mode === "tailing" && streamStatusRef.current !== "tailing") {
                                setStreamStatus("tailing");
                            } else if (data.mode === "retrying" && streamStatusRef.current !== "retrying") {
                                setStreamStatus("retrying");
                            } else if (data.mode === "failed" && streamStatusRef.current !== "failed") {
                                setStreamStatus("failed");
                            }
                            break;

                        case "stream_expired":
                            // SSE lifetime expired — reconnect + re-backfill
                            setStreamStatus("connecting");
                            es.close();
                            esRef.current = null;
                            // Re-backfill all checked services to cover gap
                            reBackfillChecked();
                            connect();
                            break;

                        case "error":
                            console.error("[layout] SSE error:", data.message);
                            break;
                    }
                } catch {
                    /* ignore */
                }
            });

            es.onerror = () => {
                setStreamStatus("offline");
                es.close();
                esRef.current = null;
                const delay = Math.min(
                    RECONNECT_BASE_MS * Math.pow(2, retryCountRef.current),
                    RECONNECT_MAX_MS,
                );
                retryCountRef.current++;
                reconnectTimeout = setTimeout(() => {
                    reBackfillChecked();
                    connect();
                }, delay);
            };
        }

        connect();
        return () => {
            clearTimeout(reconnectTimeout);
            esRef.current?.close();
            esRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Stale detection: if tailing but no data for 5 min ──
    // staleTick forces re-evaluation every 30s so Date.now() stays fresh
    const isStale = useMemo(() => {
        if (streamStatus !== "tailing") return false;
        if (lastDataReceived === 0) return false;
        return Date.now() - lastDataReceived > STALE_THRESHOLD_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamStatus, lastDataReceived, staleTick]);

    // ── Toggle service log panel ──
    const handleToggleLog = useCallback(
        (serviceId: string) => {
            setCheckedServices((prev) => {
                const next = new Set(prev);
                if (next.has(serviceId)) {
                    next.delete(serviceId);
                    setEntriesMap((prevMap) => {
                        const updated = { ...prevMap };
                        delete updated[serviceId];
                        return updated;
                    });
                } else {
                    next.add(serviceId);
                    fetchServiceLogs(serviceId);
                }
                return next;
            });
        },
        [fetchServiceLogs],
    );

    const handleCloseLog = useCallback(
        (serviceId: string) => {
            setCheckedServices((prev) => {
                const next = new Set(prev);
                next.delete(serviceId);
                return next;
            });
            setEntriesMap((prev) => {
                const updated = { ...prev };
                delete updated[serviceId];
                return updated;
            });
        },
        [],
    );

    // ── Inject user action into log stream (instant, no Cloud Logging delay) ──
    const injectLog = useCallback((serviceId: string, message: string, level: "info" | "warn" | "error" | "success" = "info") => {
        const entry: LogEntry = {
            id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            level,
            stage: "console",
            message,
            serviceId,
            source: "dashboard",
        };
        setEntriesMap((prev) => {
            const existing = prev[serviceId] || [];
            return { ...prev, [serviceId]: [...existing, entry].slice(-MAX_ENTRIES_PER_SERVICE) };
        });
    }, []);

    // ── Refresh logs for a service (re-fetch backfill) ──
    const refreshLogs = useCallback((serviceId: string) => {
        fetchServiceLogs(serviceId);
    }, [fetchServiceLogs]);

    // ── Get checked service defs (for rendering panels) ──
    const checkedServiceDefs = services.filter((s) => checkedServices.has(s.id));

    // ── LogContext value for service pages ──
    const logContextValue = useMemo(() => ({
        injectLog,
        refreshLogs,
    }), [injectLog, refreshLogs]);

    return (
        <LogProvider value={logContextValue}>
            <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6 gap-1.5 p-1.5 overflow-hidden">
                {/* Explorer sidebar */}
                <div className="shrink-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <ServiceExplorer
                        services={services}
                        checkedServices={checkedServices}
                        onToggleLog={handleToggleLog}
                    />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                    {children}
                </div>

                {/* Log panels — one per checked service, 300px each */}
                {checkedServiceDefs.map((svc) => (
                    <div
                        key={svc.id}
                        className="shrink-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                        style={{ width: 300 }}
                    >
                        <LogPanel
                            serviceId={svc.id}
                            serviceName={svc.name}
                            serviceColor={svc.color}
                            entries={entriesMap[svc.id] || []}
                            streamStatus={streamStatus}
                            isStale={isStale}
                            lastDataReceived={lastDataReceived}
                            tailRetryInfo={tailRetryInfo}
                            loading={loadingLogs.has(svc.id)}
                            onClose={() => handleCloseLog(svc.id)}
                            onRefresh={() => refreshLogs(svc.id)}
                            injectUserAction={injectLog}
                        />
                    </div>
                ))}
            </div>
        </LogProvider>
    );
}
