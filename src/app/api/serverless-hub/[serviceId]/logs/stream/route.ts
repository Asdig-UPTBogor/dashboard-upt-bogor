/**
 * Serverless Hub — Log Stream SSE (per service)
 *
 * GET /api/serverless-hub/[serviceId]/logs/stream?cursor=...
 *
 * Uses shared createLogStream() with per-service normalizer.
 */

import { NextResponse } from "next/server";
import { WORKERS, getNormalizer } from "@/lib/worker-registry";
import { createLogStream } from "@/lib/cloud-logging";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const cursor = searchParams.get("cursor") || new Date(Date.now() - 300_000).toISOString();

    const stream = createLogStream({
        serviceName: worker.logServiceName,
        serviceType: worker.logServiceType,
        cursor,
        signal: request.signal,
        normalizer: getNormalizer(serviceId),
        pollMs: serviceId === "thor-vaisala" ? 2500 : 5000,
        schedulerJobId: worker.schedulerJobId,
        serviceId,
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
