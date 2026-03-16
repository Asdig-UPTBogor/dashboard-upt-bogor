/**
 * Sync Now — POST /api/serverless-hub/spreadsheet-sync/sync-now
 * 
 * Awaits full CF pipeline completion. Used by the global SyncButton
 * in AppHeader so spinner shows until CF finishes.
 * 
 * Unlike the fire-and-forget trigger in control/route.ts,
 * this endpoint blocks until CF responds.
 */

import { NextResponse } from "next/server";
import { WORKERS } from "@/lib/worker-registry";
import { getSchedulerJob } from "@/lib/generic-scheduler";
import { triggerService } from "@/lib/generic-scheduler";
import { writeAuditLog } from "@/lib/cloud-logging-writer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
    const serviceId = "spreadsheet-sync";
    const worker = WORKERS[serviceId];

    if (!worker) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    try {
        const job = await getSchedulerJob(worker.schedulerJobId);
        if (!job?.targetUri) {
            return NextResponse.json({ error: "No CF target URL" }, { status: 500 });
        }

        await writeAuditLog(serviceId, "manual_sync",
            "Global sync triggered via header button");

        // Await full CF completion
        const result = await triggerService(job.targetUri);

        await writeAuditLog(serviceId, "manual_sync_result",
            `CF pipeline finished: HTTP ${result.status} ${result.ok ? "OK" : "FAIL"}`);

        return NextResponse.json({
            ok: result.ok,
            status: result.status,
            duration: "complete",
        });
    } catch (err) {
        await writeAuditLog(serviceId, "manual_sync_error",
            `Global sync failed: ${err instanceof Error ? err.message : "Unknown"}`);
        return NextResponse.json({
            ok: false,
            error: err instanceof Error ? err.message : "Sync failed",
        }, { status: 502 });
    }
}
