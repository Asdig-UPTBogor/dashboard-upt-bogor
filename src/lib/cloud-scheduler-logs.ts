import { getGoogleAuthOptions } from "@/lib/dashboard-config";

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "gcp-bridge-meshvpn";
const LOCATION = process.env.CLOUD_SCHEDULER_LOCATION || "asia-southeast2";
const JOB_ID = process.env.DASHBOARD_SYNC_SCHEDULER_JOB_ID || "dashboard-sync-trigger";

export type SchedulerLogEntry = {
    timestamp: string;
    level: "info" | "warn" | "error" | "success";
    stage: "scheduler";
    runId: string | null;
    message: string;
    source: "cloud-scheduler";
};

type LoggingEntry = {
    timestamp?: string;
    severity?: string;
    insertId?: string;
    httpRequest?: {
        status?: number;
    };
    jsonPayload?: Record<string, unknown>;
};

function mapSeverity(entry: LoggingEntry): SchedulerLogEntry["level"] {
    const status = entry.httpRequest?.status;
    if (typeof status === "number") {
        if (status === 429) return "info";
        if (status >= 500) return "error";
        if (status >= 400) return "warn";
        if (status >= 200 && status < 300) return "success";
    }

    switch ((entry.severity || "INFO").toUpperCase()) {
        case "ERROR":
            return "error";
        case "WARNING":
            return "warn";
        default:
            return "info";
    }
}

function formatSchedulerMessage(entry: LoggingEntry): string {
    const payload = entry.jsonPayload || {};
    const typeName = String(payload["@type"] || "");
    const url = typeof payload.url === "string" ? payload.url : null;
    const status = entry.httpRequest?.status;
    const scheduledTime = typeof payload.scheduledTime === "string"
        ? new Date(payload.scheduledTime).toLocaleTimeString("id-ID", {
            hour12: false,
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }) + " WIB"
        : null;

    if (typeName.includes("AttemptStarted")) {
        return ["Scheduler triggered worker", scheduledTime].filter(Boolean).join(" · ");
    }

    if (typeName.includes("AttemptFinished")) {
        const statusLabel = typeof status === "number" ? `HTTP ${status}` : null;
        if (status === 429) {
            return ["Scheduler skipped trigger", "Worker already busy", statusLabel].filter(Boolean).join(" · ");
        }
        return ["Scheduler finished trigger", statusLabel].filter(Boolean).join(" · ");
    }

    return ["Scheduler event", url].filter(Boolean).join(" · ");
}

export async function listDashboardSyncSchedulerLogs(limit = 50): Promise<SchedulerLogEntry[]> {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth(getGoogleAuthOptions(["https://www.googleapis.com/auth/logging.read"]));
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === "string" ? accessToken : accessToken.token || "";

    if (!token) {
        throw new Error("Failed to get Cloud Logging access token");
    }

    const response = await fetch("https://logging.googleapis.com/v2/entries:list", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            resourceNames: [`projects/${PROJECT_ID}`],
            filter: [
                'resource.type="cloud_scheduler_job"',
                `resource.labels.location="${LOCATION}"`,
                `resource.labels.job_id="${JOB_ID}"`,
            ].join(" AND "),
            orderBy: "timestamp desc",
            pageSize: limit,
        }),
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Cloud Logging request failed (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as { entries?: LoggingEntry[] };
    return (data.entries || []).map((entry) => ({
        timestamp: entry.timestamp || new Date().toISOString(),
        level: mapSeverity(entry),
        stage: "scheduler",
        runId: null,
        message: formatSchedulerMessage(entry),
        source: "cloud-scheduler" as const,
    }));
}
