/**
 * Serverless Hub — Logs API (per service)
 *
 * GET /api/serverless-hub/[serviceId]/logs?limit=50
 *
 * Single source: Cloud Logging.
 * One query fetches ALL log sources (CF + Cloud Scheduler + Dashboard Audit)
 * using the multi-resource filter in cloud-logging.ts.
 *
 * No Firestore audit log, no separate Cloud Scheduler API query.
 */

import { NextResponse } from "next/server";
import { WORKERS, getNormalizer } from "@/lib/worker-registry";
import { queryCloudLogs } from "@/lib/cloud-logging";


export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ serviceId: string }> };



export async function GET(request: Request, { params }: RouteParams) {
    const { serviceId } = await params;
    const worker = WORKERS[serviceId];

    if (!worker) {
        return NextResponse.json(
            { error: `Unknown service: ${serviceId}` },
            { status: 404 }
        );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    try {
        // Single Cloud Logging query — CF + CS + Audit all in one
        const entries = await queryCloudLogs({
            serviceName: worker.logServiceName,
            serviceType: worker.logServiceType,
            limit,
            normalizer: getNormalizer(serviceId),
            schedulerJobId: worker.schedulerJobId,
            serviceId,
        });

        return NextResponse.json({
            ok: true,
            count: entries.length,
            logs: entries,
        });
    } catch (error) {
        console.error(`[serverless-hub/${serviceId}/logs]`, error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
