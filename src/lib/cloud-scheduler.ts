import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/dashboard-config";

const PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const LOCATION =
    process.env.CLOUD_SCHEDULER_LOCATION ||
    "asia-southeast2";

const JOB_ID =
    process.env.DASHBOARD_SYNC_SCHEDULER_JOB_ID ||
    "dashboard-sync-trigger";

const SCHEDULER_BASE_URL = `https://cloudscheduler.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/jobs/${JOB_ID}`;
const SCHEDULER_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

type SchedulerState = "ENABLED" | "PAUSED" | "DISABLED" | string;

type SchedulerJobResponse = {
    name?: string;
    state?: SchedulerState;
    schedule?: string;
    scheduleTime?: string;
    timeZone?: string;
    httpTarget?: {
        uri?: string;
        httpMethod?: string;
    };
};

const googleAuth = getGoogleAuth(SCHEDULER_SCOPES);

async function getAccessToken() {
    const client = await googleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token =
        typeof tokenResponse === "string"
            ? tokenResponse
            : tokenResponse?.token || "";

    if (!token) {
        throw new Error("Failed to get Cloud Scheduler access token");
    }

    return token;
}

async function schedulerRequest<T>(suffix = "", init: RequestInit = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const token = await getAccessToken();
        const response = await fetch(`${SCHEDULER_BASE_URL}${suffix}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(init.headers || {}),
            },
            cache: "no-store",
        });

        if (response.ok) {
            if (response.status === 204) {
                return null as T;
            }
            return response.json() as Promise<T>;
        }

        const text = await response.text();
        const shouldRetry =
            attempt === 0 &&
            response.status === 401 &&
            text.includes("ACCESS_TOKEN_EXPIRED");

        if (shouldRetry) {
            continue;
        }

        throw new Error(`Cloud Scheduler request failed (${response.status}): ${text}`);
    }

    throw new Error("Cloud Scheduler request failed after retry");
}

function intervalSecToCron(intervalSec: number) {
    const safe = Math.max(60, Math.round(intervalSec));
    const intervalMinutes = Math.max(1, Math.ceil(safe / 60));
    return intervalMinutes <= 1 ? "* * * * *" : `*/${intervalMinutes} * * * *`;
}

function cronToIntervalSec(schedule: string | undefined) {
    if (!schedule) return 60;
    const trimmed = schedule.trim();
    if (trimmed === "* * * * *") return 60;
    const match = trimmed.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (match) {
        return Number.parseInt(match[1], 10) * 60;
    }
    return 60;
}

function normalizeSchedulerJob(job: SchedulerJobResponse) {
    return {
        jobId: JOB_ID,
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

export async function getDashboardSyncScheduler() {
    const job = await schedulerRequest<SchedulerJobResponse>();
    return normalizeSchedulerJob(job);
}

export async function updateDashboardSyncSchedulerInterval(intervalSec: number) {
    const job = await schedulerRequest<SchedulerJobResponse>("?updateMask=schedule,timeZone", {
        method: "PATCH",
        body: JSON.stringify({
            schedule: intervalSecToCron(intervalSec),
            timeZone: "Asia/Jakarta",
        }),
    });
    return normalizeSchedulerJob(job);
}

export async function pauseDashboardSyncScheduler() {
    await schedulerRequest(":pause", { method: "POST", body: "{}" });
    return getDashboardSyncScheduler();
}

export async function resumeDashboardSyncScheduler() {
    await schedulerRequest(":resume", { method: "POST", body: "{}" });
    return getDashboardSyncScheduler();
}
