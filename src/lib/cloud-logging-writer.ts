/**
 * Cloud Logging Writer — write structured audit entries to Cloud Logging.
 *
 * Used by control/route.ts to log config changes (pause/resume/trigger/interval)
 * directly to Cloud Logging instead of Firestore.
 *
 * Log name: projects/{project}/logs/serverless-hub-audit
 * Resource: global (dashboard-initiated actions)
 * Payload: { service, action, detail, source: "dashboard" }
 */

import { getGoogleAuthOptions } from "@/lib/dashboard-config";
import { GCP_PROJECT_ID } from "@/lib/gcp-config";

const LOG_NAME = `projects/${GCP_PROJECT_ID}/logs/serverless-hub-audit`;

export async function writeAuditLog(
    serviceId: string,
    action: string,
    detail: string
): Promise<void> {
    try {
        const { GoogleAuth } = await import("google-auth-library");
        const auth = new GoogleAuth(
            getGoogleAuthOptions(["https://www.googleapis.com/auth/logging.write"])
        );
        const client = await auth.getClient();
        const t = await client.getAccessToken();
        const token = typeof t === "string" ? t : t.token || "";
        if (!token) return;

        const res = await fetch("https://logging.googleapis.com/v2/entries:write", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                logName: LOG_NAME,
                resource: { type: "global", labels: {} },
                entries: [{
                    severity: action === "paused" || action === "disabled" ? "WARNING" : "INFO",
                    jsonPayload: {
                        service: serviceId,
                        action,
                        detail,
                        source: "dashboard",
                        at: new Date().toISOString(),
                    },
                }],
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            console.error(`[cloud-logging-writer] Write failed (${res.status}): ${body}`);
        } else {
            console.log(`[cloud-logging-writer] Audit logged: ${serviceId}/${action}`);
        }
    } catch (e) {
        // Non-fatal — audit logging should never block operations
        console.error("[cloud-logging-writer] writeAuditLog failed:", (e as Error).message);
    }
}
