/**
 * Serverless Hub — Control API (per service)
 *
 * POST /api/serverless-hub/[serviceId]/control
 *
 * Actions:
 *   { action: "pause" }                     → Pause Cloud Scheduler job
 *   { action: "resume" }                    → Resume Cloud Scheduler job
 *   { action: "trigger" }                   → Manual trigger via HTTP POST
 *   { action: "interval", intervalSec: N }  → Update scheduler interval
 *   { action: "status" }                    → Get scheduler + config status
 *
 * Uses worker-registry.ts for schedulerJobId.
 * Uses generic-scheduler.ts for all scheduler operations.
 * Uses worker-firestore.ts for config reads.
 */

import { NextResponse } from "next/server";
import { WORKERS } from "@/lib/worker-registry";
import {
    getSchedulerJob,
    pauseSchedulerJob,
    resumeSchedulerJob,
    updateSchedulerInterval,
    triggerService,
} from "@/lib/generic-scheduler";
import { readWorkerConfig, patchWorkerConfig, maskSensitiveFields } from "@/lib/worker-firestore";
import { writeAuditLog } from "@/lib/cloud-logging-writer";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ serviceId: string }> };

/** Build combined status for any service */
async function buildServiceStatus(serviceId: string) {
    const worker = WORKERS[serviceId];
    if (!worker) throw new Error(`Unknown service: ${serviceId}`);

    const [scheduler, config] = await Promise.all([
        getSchedulerJob(worker.schedulerJobId),
        readWorkerConfig(worker.configCollection, worker.configDocument),
    ]);

    const safeConfig = maskSensitiveFields(config, worker.sensitiveFields);

    return {
        serviceId,
        serviceName: worker.name,
        scheduler,
        config: safeConfig,
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
    };
}

export async function POST(request: Request, { params }: RouteParams) {
    const { serviceId } = await params;
    const worker = WORKERS[serviceId];

    if (!worker) {
        return NextResponse.json({ error: `Unknown service: ${serviceId}` }, { status: 404 });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Missing or invalid JSON body" }, { status: 400 });
        }
        const action = body.action as string;

        switch (action) {
            case "status": {
                const status = await buildServiceStatus(serviceId);
                return NextResponse.json({ ok: true, ...status });
            }

            case "pause": {
                const scheduler = await pauseSchedulerJob(worker.schedulerJobId);
                // Sync Firestore globalEnabled if applicable
                try {
                    await patchWorkerConfig(worker.configCollection, worker.configDocument, {
                        globalEnabled: false,
                    });
                } catch { /* some services may not have this field */ }
                await writeAuditLog(serviceId, "paused", "Scheduler paused via dashboard");
                return NextResponse.json({ ok: true, action: "pause", scheduler });
            }

            case "resume": {
                const scheduler = await resumeSchedulerJob(worker.schedulerJobId);
                try {
                    await patchWorkerConfig(worker.configCollection, worker.configDocument, {
                        globalEnabled: true,
                    });
                } catch { /* some services may not have this field */ }
                await writeAuditLog(serviceId, "enabled", "Scheduler resumed via dashboard");
                return NextResponse.json({ ok: true, action: "resume", scheduler });
            }

            case "trigger": {
                // Get target URL from scheduler job
                const job = await getSchedulerJob(worker.schedulerJobId);
                if (!job.targetUri) {
                    return NextResponse.json(
                        { ok: false, error: "No target URI found on scheduler job" },
                        { status: 400 },
                    );
                }
                try {
                    // Fire-and-forget: trigger CF in background, return immediately
                    await writeAuditLog(serviceId, "manual_trigger",
                        `Manual sync triggered via dashboard → ${job.targetUri}`);

                    // Fire CF trigger in background — don't await
                    triggerService(job.targetUri)
                        .then(async (result) => {
                            await writeAuditLog(serviceId, "manual_trigger_result",
                                `CF responded: HTTP ${result.status} ${result.ok ? "OK" : "FAIL"}`);
                        })
                        .catch(async (err) => {
                            await writeAuditLog(serviceId, "manual_trigger_result",
                                `CF trigger error: ${err instanceof Error ? err.message : "Unknown"}`);
                        });

                    return NextResponse.json({ ok: true, action: "trigger", triggered: true });
                } catch (err) {
                    await writeAuditLog(serviceId, "manual_trigger",
                        `Manual sync trigger failed — ${err instanceof Error ? err.message : "Unknown error"}`);
                    return NextResponse.json({
                        ok: false, action: "trigger", triggered: false,
                        error: err instanceof Error ? err.message : "Failed to trigger",
                    }, { status: 502 });
                }
            }

            case "interval": {
                const intervalSec = body.intervalSec as number;
                if (!intervalSec || intervalSec < 60) {
                    return NextResponse.json(
                        { ok: false, error: "intervalSec must be >= 60" },
                        { status: 400 },
                    );
                }
                const scheduler = await updateSchedulerInterval(worker.schedulerJobId, intervalSec);
                // Also update Firestore with the new interval if applicable
                try {
                    await patchWorkerConfig(worker.configCollection, worker.configDocument, {
                        syncIntervalMinutes: Math.round(intervalSec / 60),
                    });
                } catch { /* some services may not have this field */ }
                const minutes = Math.round(intervalSec / 60);
                await writeAuditLog(serviceId, "interval_changed",
                    `Sync interval changed to ${minutes} min via dashboard`);
                return NextResponse.json({ ok: true, action: "interval", scheduler });
            }

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}. Valid: status, pause, resume, trigger, interval` },
                    { status: 400 },
                );
        }
    } catch (error) {
        console.error(`[serverless-hub/${serviceId}/control] POST`, error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 },
        );
    }
}
