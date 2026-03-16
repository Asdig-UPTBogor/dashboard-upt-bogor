/**
 * WA Notifier Health Proxy — GET /api/serverless-hub/wa-notifier/health
 *
 * Proxies dashboard requests to the deployed WA Notifier CR `/health` endpoint.
 * On-demand only — wakes CR for ~1-2s to get live health + stats.
 * No Cloud Scheduler needed.
 */

import { NextResponse } from "next/server";
import { getSchedulerJob } from "@/lib/generic-scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    try {
        // Fetch dynamic URL from Cloud Scheduler
        const jobInfo = await getSchedulerJob("wa-notifier-health");
        if (!jobInfo.targetUri) {
            throw new Error("Could not determine service URL from Cloud Scheduler");
        }
        
        const targetUrl = jobInfo.targetUri;
        // The audience for GoogleAuth is the base URL without /health
        const audienceUrl = targetUrl.replace(/\/health$/, "");

        const { GoogleAuth } = await import("google-auth-library");
        const auth = new GoogleAuth();
        const client = await auth.getIdTokenClient(audienceUrl);
        const tokenRes = await client.getRequestHeaders();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
                ...tokenRes,
                "Accept": "application/json",
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return NextResponse.json(
                { ok: false, error: `CR responded with ${response.status}` },
                { status: 502 },
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err) {
        // Fallback or failure
        return NextResponse.json(
            {
                ok: false,
                error: err instanceof Error ? err.message : "Health check failed",
                offline: true,
            },
            { status: 502 },
        );
    }
}
