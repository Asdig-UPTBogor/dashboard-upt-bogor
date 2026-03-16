/**
 * Cloud Logging — Shared query + SSE stream helpers.
 *
 * Used by ALL worker log routes in the Serverless Hub.
 * Each worker provides its own normalizer function;
 * this module handles auth, query, and SSE plumbing.
 */

import { getGoogleAuthOptions } from "@/lib/dashboard-config";
import { GCP_PROJECT_ID } from "@/lib/gcp-config";

/* ── Types ── */

export interface LoggingEntry {
    timestamp?: string;
    severity?: string;
    insertId?: string;
    textPayload?: string;
    jsonPayload?: Record<string, unknown>;
    labels?: Record<string, string>;
    trace?: string;
    /** Resource info — used to detect log source (CF, CS, audit) */
    resource?: { type?: string; labels?: Record<string, string> };
    /** Log name — used to detect custom audit logs */
    logName?: string;
}

export interface NormalizedLogEntry {
    id: string;
    timestamp: string;
    level: "info" | "warn" | "error" | "success";
    stage: string;
    runId: string | null;
    message: string;
    source: string;
    meta?: Record<string, unknown> | null;
}

export type LogNormalizer = (entry: LoggingEntry) => NormalizedLogEntry;

/* ── Auth helper ── */
let _cachedToken: { token: string; expiresAt: number } | null = null;
let _authClient: InstanceType<typeof import("google-auth-library").GoogleAuth> | null = null;

async function getLoggingToken(): Promise<string> {
    // Return cached token if still valid (50 min TTL, tokens last 60 min)
    if (_cachedToken && Date.now() < _cachedToken.expiresAt) {
        return _cachedToken.token;
    }
    if (!_authClient) {
        const { GoogleAuth } = await import("google-auth-library");
        _authClient = new GoogleAuth(
            getGoogleAuthOptions(["https://www.googleapis.com/auth/logging.read"])
        );
    }
    const client = await _authClient.getClient();
    const t = await client.getAccessToken();
    const token = typeof t === "string" ? t : t.token || "";
    _cachedToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
    return token;
}

/* ── Build Cloud Logging filter ── */

/**
 * Build a Cloud Logging filter that covers multiple resource types in one query.
 *
 * Sources combined with OR:
 *   1. CF/CR logs: resource.type="cloud_run_revision" + service_name
 *   2. CS logs:    resource.type="cloud_scheduler_job" + job_id (if schedulerJobId provided)
 *   3. Audit logs: logName="serverless-hub-audit" + jsonPayload.service (if serviceId provided)
 */
function buildFilter(
    serviceName: string,
    serviceType: string,
    cursor?: string,
    extraFilter?: string,
    schedulerJobId?: string,
    serviceId?: string,
): string {
    // Build OR clauses for each log source
    const sources: string[] = [];

    // Source 1: CF / Cloud Run logs
    if (serviceType === "cloud_function") {
        sources.push(
            `(resource.type="cloud_function" AND resource.labels.function_name="${serviceName}")`
        );
    } else {
        sources.push(
            `(resource.type="cloud_run_revision" AND resource.labels.service_name="${serviceName}")`,
            `(resource.type="cloud_function" AND resource.labels.function_name="${serviceName}")`,
        );
    }

    // Source 2: Cloud Scheduler logs (trigger events)
    if (schedulerJobId) {
        sources.push(
            `(resource.type="cloud_scheduler_job" AND resource.labels.job_id="${schedulerJobId}")`
        );
    }

    // Source 3: Dashboard audit logs (pause/resume/trigger/interval)
    if (serviceId) {
        sources.push(
            `(logName="projects/${GCP_PROJECT_ID}/logs/serverless-hub-audit" AND jsonPayload.service="${serviceId}")`
        );
    }

    // Combine: (source1 OR source2 OR source3) AND conditions
    const filter = [`(${sources.join(" OR ")})`];

    if (cursor) {
        filter.push(`timestamp >= "${cursor}"`);
    }

    filter.push('severity!="DEBUG"');

    if (extraFilter) {
        filter.push(extraFilter);
    }

    return filter.join(" AND ");
}

/* ── Query logs (one-shot) ── */

export interface QueryOptions {
    serviceName: string;
    serviceType: string;
    limit?: number;
    normalizer: LogNormalizer;
    extraFilter?: string;
    /** If provided, also query Cloud Scheduler logs for this job */
    schedulerJobId?: string;
    /** If provided, also query dashboard audit logs for this service */
    serviceId?: string;
}

export async function queryCloudLogs(
    options: QueryOptions
): Promise<NormalizedLogEntry[]> {
    const { serviceName, serviceType, limit = 50, normalizer, extraFilter, schedulerJobId, serviceId } = options;
    const token = await getLoggingToken();

    const response = await fetch("https://logging.googleapis.com/v2/entries:list", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            resourceNames: [`projects/${GCP_PROJECT_ID}`],
            filter: buildFilter(serviceName, serviceType, undefined, extraFilter, schedulerJobId, serviceId),
            orderBy: "timestamp desc",
            pageSize: limit,
        }),
        cache: "no-store",
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Cloud Logging query failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as { entries?: LoggingEntry[] };
    return (data.entries || []).map(normalizer);
}

/* ── SSE Stream (polling loop → ReadableStream) ── */

export interface StreamOptions {
    serviceName: string;
    serviceType: string;
    cursor: string;
    signal: AbortSignal;
    normalizer: LogNormalizer;
    pollMs?: number;
    heartbeatMs?: number;
    extraFilter?: string;
    /** If provided, also stream Cloud Scheduler logs */
    schedulerJobId?: string;
    /** If provided, also stream dashboard audit logs */
    serviceId?: string;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal.aborted) {
            resolve();
            return;
        }
        const timer = setTimeout(() => {
            cleanup();
            resolve();
        }, ms);
        const cleanup = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
        };
        const onAbort = () => {
            cleanup();
            resolve();
        };
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

export function createLogStream(options: StreamOptions): ReadableStream {
    const {
        serviceName,
        serviceType,
        cursor: initialCursor,
        signal,
        normalizer,
        pollMs = 5000,
        heartbeatMs = 15000,
        extraFilter,
        schedulerJobId,
        serviceId,
    } = options;

    const encoder = new TextEncoder();

    return new ReadableStream({
        async start(controller) {
            let cursor = initialCursor;
            let lastHB = Date.now();
            const seenAtCursor = new Set<string>();

            const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
            send(`: log-stream connected ${new Date().toISOString()}\n\n`);

            while (!signal.aborted) {
                try {
                    const token = await getLoggingToken();
                    const res = await fetch(
                        "https://logging.googleapis.com/v2/entries:list",
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                resourceNames: [`projects/${GCP_PROJECT_ID}`],
                                filter: buildFilter(serviceName, serviceType, cursor, extraFilter, schedulerJobId, serviceId),
                                orderBy: "timestamp asc",
                                pageSize: 50,
                            }),
                            cache: "no-store",
                        }
                    );

                    if (!res.ok) {
                        throw new Error(`Logging API ${res.status}`);
                    }

                    const data = (await res.json()) as {
                        entries?: LoggingEntry[];
                    };
                    const entries = (data.entries || []).map(normalizer);

                    for (const entry of entries) {
                        const entryTime = new Date(entry.timestamp).getTime();
                        const cursorTime = new Date(cursor).getTime();

                        if (Number.isFinite(cursorTime) && entryTime < cursorTime) continue;
                        if (entry.timestamp === cursor && seenAtCursor.has(entry.id)) continue;

                        if (entry.timestamp > cursor) {
                            cursor = entry.timestamp;
                            seenAtCursor.clear();
                        }

                        seenAtCursor.add(entry.id);
                        send(`data: ${JSON.stringify(entry)}\n\n`);
                        lastHB = Date.now();
                    }

                    if (Date.now() - lastHB >= heartbeatMs) {
                        send(`: heartbeat ${new Date().toISOString()}\n\n`);
                        lastHB = Date.now();
                    }
                } catch (error) {
                    send(
                        `event: error\ndata: ${JSON.stringify({
                            message: (error as Error).message,
                        })}\n\n`
                    );
                }

                await sleep(pollMs, signal);
            }

            controller.close();
        },
        cancel() {
            signal.dispatchEvent?.(new Event("abort"));
        },
    });
}
