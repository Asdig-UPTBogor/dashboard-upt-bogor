/**
 * Rate Limit & Worker Status API — SSE Dual-Mode
 *
 * GET /api/rate-limit             → JSON snapshot (backward compatible)
 * GET /api/rate-limit (SSE mode)  → real-time event stream
 *
 * SSE mode is activated when the client sends Accept: text/event-stream header
 * (automatically done by EventSource in the browser).
 *
 * Events streamed:
 *   - "status"        → initial snapshot on connect
 *   - "cycle-start"   → worker begins a new fetch cycle
 *   - "progress"      → one sheet fetched (success or failure)
 *   - "cache-updated" → entire cycle finished, data is fresh
 *   - "heartbeat"     → keep-alive every 30s to prevent timeout
 */

import { NextResponse } from "next/server";
import { rateLimitCounter } from "@/lib/rate-limit-counter";
import { sheetCache } from "@/lib/sheet-cache";
import {
    getWorkerStatus,
    workerEmitter,
    type WorkerProgressEvent,
    type WorkerCycleDoneEvent,
    type WorkerCycleStartEvent,
} from "@/lib/background-prefetch";
import { getDriftReport } from "@/lib/drift-store";

export const dynamic = "force-dynamic";

/** Build a JSON snapshot of the current system state */
function buildSnapshot() {
    const drift = getDriftReport();
    return {
        ...rateLimitCounter.getStatus(),
        cache: sheetCache.getStatus(),
        worker: getWorkerStatus(),
        drift: drift ? {
            overallHealth: drift.overallHealth,
            issueCount: drift.summary.issueCount,
            timestamp: drift.timestamp,
            issues: drift.summary.issues,
        } : null,
    };
}

export async function GET(req: Request) {
    const acceptHeader = req.headers.get("accept") || "";
    const isSSE = acceptHeader.includes("text/event-stream");

    // ── JSON mode (backward compatible) ──
    if (!isSSE) {
        return NextResponse.json(buildSnapshot());
    }

    // ── SSE mode — real-time event stream ──
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            /** Helper: send a named SSE event */
            const send = (event: string, data: unknown) => {
                try {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    );
                } catch {
                    // Controller may be closed — ignore
                }
            };

            // 1. Send initial snapshot immediately
            send("status", buildSnapshot());

            // 2. Register event listeners for worker events
            const onCycleStart = (d: WorkerCycleStartEvent) => send("cycle-start", d);
            const onProgress = (d: WorkerProgressEvent) => send("progress", d);
            const onCycleDone = (d: WorkerCycleDoneEvent) => send("cache-updated", d);
            const onStatus = () => send("status", buildSnapshot());
            const onDriftReport = (d: unknown) => send("drift-report", d);

            workerEmitter.on("cycle-start", onCycleStart);
            workerEmitter.on("progress", onProgress);
            workerEmitter.on("cycle-done", onCycleDone);
            workerEmitter.on("status", onStatus);
            workerEmitter.on("drift-report", onDriftReport);

            // 3. Heartbeat to keep connection alive (prevents proxy/LB timeout)
            const heartbeatId = setInterval(() => {
                send("heartbeat", { ts: Date.now() });
            }, 30_000);

            // 4. Cleanup when client disconnects
            const cleanup = () => {
                workerEmitter.off("cycle-start", onCycleStart);
                workerEmitter.off("progress", onProgress);
                workerEmitter.off("cycle-done", onCycleDone);
                workerEmitter.off("status", onStatus);
                workerEmitter.off("drift-report", onDriftReport);
                clearInterval(heartbeatId);
                try { controller.close(); } catch { /* already closed */ }
            };

            // Listen for client abort (tab close, navigation, etc.)
            req.signal.addEventListener("abort", cleanup);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", // Disable nginx buffering for SSE
        },
    });
}
