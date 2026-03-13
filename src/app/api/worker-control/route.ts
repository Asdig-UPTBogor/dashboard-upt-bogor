import { NextResponse } from "next/server";
import { proxyDashboardSyncWorker, requireDashboardSyncWorkerUrl } from "@/lib/dashboard-sync-worker";
import {
    getDashboardSyncScheduler,
    pauseDashboardSyncScheduler,
    resumeDashboardSyncScheduler,
    updateDashboardSyncSchedulerInterval,
} from "@/lib/cloud-scheduler";

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

function normalizeWorkerStatus(
    workerStatus: Record<string, unknown>,
    scheduler: {
        enabled: boolean;
        nextRunAt: string | null;
        intervalSec: number;
        schedule: string;
        state: string;
        timeZone: string;
    }
) {
    const worker = ((workerStatus.worker as Record<string, unknown> | undefined) || {});
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
        ...workerStatus,
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

async function readJsonResponse(response: Response) {
    const text = await response.text();
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        throw new Error(text || `Upstream request failed (${response.status})`);
    }
}

function buildFallbackWorkerStatus(
    scheduler: {
        enabled: boolean;
        nextRunAt: string | null;
        intervalSec: number;
        schedule: string;
        state: string;
        timeZone: string;
    },
    message: string
) {
    return {
        worker: {
            config: {
                refreshIntervalMs: scheduler.intervalSec * 1000,
                fetchDelayMs: 0,
                paused: !scheduler.enabled,
                pauseReason: !scheduler.enabled ? "manual" : null,
            },
            intervalSec: scheduler.intervalSec,
            secondsUntilRefresh: getSecondsUntilNextRun(scheduler.nextRunAt, false),
            isPaused: !scheduler.enabled,
            pauseReason: !scheduler.enabled ? "manual" : null,
            executionPaused: false,
            executionPauseReason: null,
            isRefreshing: false,
            phase: null,
            runStartedAt: null,
            lastRefreshAt: null,
            progress: null,
            groups: [],
            availability: "degraded",
            error: message,
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
            executionPaused: false,
            executionPauseReason: null,
        },
        scheduler,
    };
}

async function patchWorkerExecution(body: Record<string, unknown>) {
    const upstream = await proxyDashboardSyncWorker("/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return readJsonResponse(upstream);
}

async function triggerWorkerRefresh(body: Record<string, unknown> = { action: "refresh" }) {
    const upstream = await proxyDashboardSyncWorker("/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return readJsonResponse(upstream);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        requireDashboardSyncWorkerUrl();
        if (body.action === "refresh") {
            const payload = await triggerWorkerRefresh(body);
            return NextResponse.json(payload);
        }

        let scheduler = await getDashboardSyncScheduler();
        const workerConfigPatch: Record<string, unknown> = { action: "config" };
        let shouldPatchWorker = false;
        let workerPayload: Record<string, unknown> | null = null;
        let refreshPayload: Record<string, unknown> | null = null;

        if (typeof body.refreshIntervalMs === "number" && body.refreshIntervalMs >= 60_000) {
            scheduler = await updateDashboardSyncSchedulerInterval(body.refreshIntervalMs / 1000);
        }

        if (typeof body.paused === "boolean") {
            workerPayload = await patchWorkerExecution({
                action: "config",
                paused: body.paused,
                reason:
                    typeof body.reason === "string" && body.reason.trim()
                        ? body.reason.trim()
                        : body.paused
                            ? "manual"
                            : null,
            });
            scheduler = body.paused
                ? await pauseDashboardSyncScheduler()
                : await resumeDashboardSyncScheduler();
            if (!body.paused) {
                refreshPayload = await triggerWorkerRefresh({ action: "refresh" });
            }
        }

        if (typeof body.fetchDelayMs === "number" && body.fetchDelayMs >= 0) {
            workerConfigPatch.fetchDelayMs = body.fetchDelayMs;
            shouldPatchWorker = true;
        }
        if (typeof body.bigQueryDataset === "string" && body.bigQueryDataset.trim()) {
            workerConfigPatch.bigQueryDataset = body.bigQueryDataset.trim();
            shouldPatchWorker = true;
        }
        if (typeof body.page === "string" || body.page === null) {
            workerConfigPatch.page = body.page;
            shouldPatchWorker = true;
        }
        if (["off", "dry-run", "write"].includes(body.qcWritebackMode)) {
            workerConfigPatch.qcWritebackMode = body.qcWritebackMode;
            shouldPatchWorker = true;
        }

        if (shouldPatchWorker) {
            workerPayload = await patchWorkerExecution(workerConfigPatch);
        }

        const normalizedWorkerPayload = workerPayload
            ? normalizeWorkerStatus(workerPayload, scheduler)
            : null;

        return NextResponse.json({
            ok: true,
            scheduler,
            automation: {
                source: "cloud-scheduler",
                enabled: scheduler.enabled,
                isPaused: !scheduler.enabled,
                schedule: scheduler.schedule,
                state: scheduler.state,
                timeZone: scheduler.timeZone,
                nextRunAt: scheduler.nextRunAt,
                intervalSec: scheduler.intervalSec,
            },
            worker: normalizedWorkerPayload?.worker || null,
            config: normalizedWorkerPayload?.worker?.config || null,
            refresh: refreshPayload,
        });
    } catch (error) {
        console.error("[worker-control] API Error:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}

export async function GET() {
    try {
        requireDashboardSyncWorkerUrl();
        const scheduler = await getDashboardSyncScheduler();
        try {
            const upstream = await proxyDashboardSyncWorker("/snapshot");
            const workerStatus = await readJsonResponse(upstream);
            return NextResponse.json(normalizeWorkerStatus(workerStatus || {}, scheduler));
        } catch (workerError) {
            const message = workerError instanceof Error ? workerError.message : "Worker unavailable";
            return NextResponse.json(buildFallbackWorkerStatus(scheduler, message));
        }
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
