/**
 * Thor Log Stream (SSE)
 *
 * Streams fresh Cloud Logging entries from thor-worker to the dashboard.
 * The client seeds recent history via /logs first, then this route only
 * pushes new lines to create a Drizzle-like terminal append effect.
 */

import { NextResponse } from "next/server";
import { getGoogleAuthOptions } from "@/lib/dashboard-config";
import { normalizeThorLogEntry } from "@/lib/thor-log-normalizer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_ID = "gcp-bridge-meshvpn";
const SERVICE_NAME = "thor-worker";
const POLL_INTERVAL_MS = 2500;
const HEARTBEAT_INTERVAL_MS = 15000;

interface StreamLogEntry {
    id: string;
    timestamp: string;
    level: "info" | "warn" | "error" | "success";
    stage: string;
    runId: string | null;
    message: string;
    source: string;
}

function normalizeEntry(entry: Record<string, unknown>): StreamLogEntry {
    const normalized = normalizeThorLogEntry(entry);
    return {
        id: normalized.id || `${normalized.timestamp}|${normalized.message}`,
        timestamp: normalized.timestamp,
        level: normalized.level,
        stage: normalized.stage,
        runId: normalized.runId,
        message: normalized.message,
        source: normalized.source,
    };
}

async function getAccessToken(): Promise<string> {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth(getGoogleAuthOptions(["https://www.googleapis.com/auth/logging.read"]));
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return typeof accessToken === "string" ? accessToken : accessToken.token || "";
}

async function fetchThorLogEntries(cursor: string, limit: number): Promise<StreamLogEntry[]> {
    const token = await getAccessToken();
    const response = await fetch("https://logging.googleapis.com/v2/entries:list", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            resourceNames: [`projects/${PROJECT_ID}`],
            filter: [
                'resource.type="cloud_run_revision"',
                `resource.labels.service_name="${SERVICE_NAME}"`,
                `timestamp >= "${cursor}"`,
            ].join(" AND "),
            orderBy: "timestamp asc",
            pageSize: limit,
        }),
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Logging API failed (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as { entries?: Record<string, unknown>[] };
    return (data.entries || []).map(normalizeEntry);
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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const cursorParam = searchParams.get("cursor");
    const initialCursor = cursorParam || new Date().toISOString();

    const encoder = new TextEncoder();
    const signal = request.signal;

    const stream = new ReadableStream({
        async start(controller) {
            let cursor = initialCursor;
            let lastHeartbeatAt = Date.now();
            const seenAtCursor = new Set<string>();

            const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

            enqueue(`: thor-log-stream connected ${new Date().toISOString()}\n\n`);

            while (!signal.aborted) {
                try {
                    const entries = await fetchThorLogEntries(cursor, 50);

                    for (const entry of entries) {
                        const entryTime = new Date(entry.timestamp).getTime();
                        const cursorTime = new Date(cursor).getTime();

                        if (Number.isFinite(cursorTime) && entryTime < cursorTime) {
                            continue;
                        }

                        if (entry.timestamp === cursor && seenAtCursor.has(entry.id)) {
                            continue;
                        }

                        if (entry.timestamp > cursor) {
                            cursor = entry.timestamp;
                            seenAtCursor.clear();
                        }

                        seenAtCursor.add(entry.id);
                        enqueue(`data: ${JSON.stringify(entry)}\n\n`);
                        lastHeartbeatAt = Date.now();
                    }

                    if (Date.now() - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
                        enqueue(`: heartbeat ${new Date().toISOString()}\n\n`);
                        lastHeartbeatAt = Date.now();
                    }
                } catch (error) {
                    enqueue(`event: error\ndata: ${JSON.stringify({ message: (error as Error).message })}\n\n`);
                }

                await sleep(POLL_INTERVAL_MS, signal);
            }

            controller.close();
        },
        cancel() {
            signal.dispatchEvent?.(new Event("abort"));
        },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
