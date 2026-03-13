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
 *   - "sync-complete" → entire cycle finished, data is fresh
 *   - "heartbeat"     → keep-alive every 30s to prevent timeout
 */

import { NextResponse } from "next/server";
import { proxyDashboardSyncWorker, requireDashboardSyncWorkerUrl } from "@/lib/dashboard-sync-worker";
import { getDashboardSyncScheduler } from "@/lib/cloud-scheduler";

export const dynamic = "force-dynamic";

function getSecondsUntilNextRun(nextRunAt: string | null, isRefreshing: boolean) {
    if (!nextRunAt || isRefreshing) {
        return 0;
    }

    const nextRunMs = new Date(nextRunAt).getTime();
    if (Number.isNaN(nextRunMs)) {
        return 0;
    }

    return Math.max(0, Math.ceil((nextRunMs - Date.now()) / 1000));
}

function normalizeSnapshot(
    snapshot: Record<string, unknown>,
    scheduler: {
        enabled: boolean;
        nextRunAt: string | null;
        intervalSec: number;
        schedule: string;
        state: string;
        timeZone: string;
    }
) {
    const worker = ((snapshot.worker as Record<string, unknown> | undefined) || {});
    const rawConfig = ((worker.config as Record<string, unknown> | undefined) || {});
    const isRefreshing = Boolean(worker.isRefreshing);
    const executionPaused = Boolean(worker.isPaused);
    const executionPauseReason = (worker.pauseReason as string | null | undefined) ?? null;
    const normalizedConfig = {
        ...rawConfig,
        refreshIntervalMs: scheduler.intervalSec * 1000,
        paused: !scheduler.enabled,
        pauseReason: !scheduler.enabled ? "manual" : null,
    };

    return {
        ...snapshot,
        worker: {
            ...worker,
            config: normalizedConfig,
            intervalSec: scheduler.intervalSec,
            secondsUntilRefresh: getSecondsUntilNextRun(scheduler.nextRunAt, isRefreshing),
            isPaused: !scheduler.enabled,
            pauseReason: !scheduler.enabled ? "manual" : null,
            executionPaused,
            executionPauseReason,
        },
        automation: {
            source: "cloud-scheduler",
            enabled: scheduler.enabled,
            isPaused: !scheduler.enabled,
            schedule: scheduler.schedule,
            state: scheduler.state,
            timeZone: scheduler.timeZone,
            nextRunAt: scheduler.nextRunAt,
            intervalSec: scheduler.intervalSec,
            executionPaused,
            executionPauseReason,
        },
        scheduler,
    };
}

export async function GET(req: Request) {
    try {
        requireDashboardSyncWorkerUrl();
        const acceptHeader = req.headers.get("accept") || "";
        const isSSE = acceptHeader.includes("text/event-stream");
        if (!isSSE) {
            const [scheduler, upstream] = await Promise.all([
                getDashboardSyncScheduler(),
                proxyDashboardSyncWorker("/snapshot"),
            ]);
            const text = await upstream.text();
            const snapshot = JSON.parse(text) as Record<string, unknown>;
            return NextResponse.json(normalizeSnapshot(snapshot, scheduler));
        }

        const upstream = await proxyDashboardSyncWorker("/events", {
            headers: { Accept: "text/event-stream" },
        });

        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                "Content-Type": upstream.headers.get("content-type") || (isSSE ? "text/event-stream" : "application/json"),
                "Cache-Control": upstream.headers.get("cache-control") || "no-cache, no-transform",
                "Connection": upstream.headers.get("connection") || "keep-alive",
                "X-Accel-Buffering": upstream.headers.get("x-accel-buffering") || "no",
            },
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
