/**
 * Generic Cloud Scheduler operations for Serverless Hub.
 *
 * Unlike cloud-scheduler.ts (hardcoded for sheet-bq-sync-trigger),
 * this module accepts a jobId parameter from worker-registry.ts.
 *
 * Used by:
 *   /api/serverless-hub/[serviceId]/control
 */

import { getGoogleAuth, getGoogleAuthOptions } from "@/lib/dashboard-config";

const PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const LOCATION =
    process.env.CLOUD_SCHEDULER_LOCATION ||
    "asia-southeast2";

const SCHEDULER_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];
const googleAuth = getGoogleAuth(SCHEDULER_SCOPES);

/* ── Types ── */

type SchedulerJobResponse = {
    name?: string;
    state?: string;
    schedule?: string;
    scheduleTime?: string;
    timeZone?: string;
    httpTarget?: {
        uri?: string;
        httpMethod?: string;
    };
};

export type SchedulerJobInfo = {
    jobId: string;
    location: string;
    enabled: boolean;
    state: string;
    schedule: string;
    intervalSec: number;
    nextRunAt: string | null;
    timeZone: string;
    targetUri: string | null;
};

/* ── Helpers ── */

async function getAccessToken(): Promise<string> {
    const client = await googleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token || "";
    if (!token) throw new Error("Failed to get Cloud Scheduler access token");
    return token;
}

function jobUrl(jobId: string, suffix = ""): string {
    return `https://cloudscheduler.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/jobs/${jobId}${suffix}`;
}

async function schedulerRequest<T>(jobId: string, suffix = "", init: RequestInit = {}): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const token = await getAccessToken();
        const response = await fetch(jobUrl(jobId, suffix), {
            ...init,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(init.headers || {}),
            },
            cache: "no-store",
        });

        if (response.ok) {
            if (response.status === 204) return null as T;
            return response.json() as Promise<T>;
        }

        const text = await response.text();
        if (attempt === 0 && response.status === 401 && text.includes("ACCESS_TOKEN_EXPIRED")) {
            continue;
        }
        throw new Error(`Cloud Scheduler request failed (${response.status}): ${text}`);
    }
    throw new Error("Cloud Scheduler request failed after retry");
}

function intervalSecToCron(intervalSec: number): string {
    const intervalMinutes = Math.max(1, Math.ceil(Math.max(60, Math.round(intervalSec)) / 60));
    return intervalMinutes <= 1 ? "* * * * *" : `*/${intervalMinutes} * * * *`;
}

function cronToIntervalSec(schedule: string | undefined): number {
    if (!schedule) return 60;
    const trimmed = schedule.trim();
    if (trimmed === "* * * * *") return 60;
    const match = trimmed.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (match) return parseInt(match[1], 10) * 60;
    return 60;
}

function normalizeJob(jobId: string, job: SchedulerJobResponse): SchedulerJobInfo {
    return {
        jobId,
        location: LOCATION,
        enabled: job.state === "ENABLED",
        state: job.state || "UNKNOWN",
        schedule: job.schedule || "* * * * *",
        intervalSec: cronToIntervalSec(job.schedule),
        nextRunAt: job.scheduleTime || null,
        timeZone: job.timeZone || "Asia/Jakarta",
        targetUri: job.httpTarget?.uri || null,
    };
}

/* ── Public API ── */

/** Get scheduler job info by jobId */
export async function getSchedulerJob(jobId: string): Promise<SchedulerJobInfo> {
    const job = await schedulerRequest<SchedulerJobResponse>(jobId);
    return normalizeJob(jobId, job);
}

/** Pause a scheduler job */
export async function pauseSchedulerJob(jobId: string): Promise<SchedulerJobInfo> {
    await schedulerRequest(jobId, ":pause", { method: "POST", body: "{}" });
    return getSchedulerJob(jobId);
}

/** Resume a scheduler job */
export async function resumeSchedulerJob(jobId: string): Promise<SchedulerJobInfo> {
    await schedulerRequest(jobId, ":resume", { method: "POST", body: "{}" });
    return getSchedulerJob(jobId);
}

/** Update scheduler interval */
export async function updateSchedulerInterval(
    jobId: string,
    intervalSec: number,
): Promise<SchedulerJobInfo> {
    const job = await schedulerRequest<SchedulerJobResponse>(
        jobId,
        "?updateMask=schedule,timeZone",
        {
            method: "PATCH",
            body: JSON.stringify({
                schedule: intervalSecToCron(intervalSec),
                timeZone: "Asia/Jakarta",
            }),
        },
    );
    return normalizeJob(jobId, job);
}

/** Manually trigger a Cloud Function / Cloud Run service via HTTP POST */
export async function triggerService(targetUrl: string): Promise<{ ok: boolean; status: number; body: string }> {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth(getGoogleAuthOptions());
    const client = await auth.getIdTokenClient(targetUrl);
    const res = await client.request({ url: targetUrl, method: "POST" });
    return {
        ok: (res.status || 0) >= 200 && (res.status || 0) < 300,
        status: res.status || 0,
        body: typeof res.data === "string" ? res.data : JSON.stringify(res.data),
    };
}
