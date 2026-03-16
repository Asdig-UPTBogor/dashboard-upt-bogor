/**
 * WA Notifier Log Normalizer — Cloud Run (wa-notifier) specific.
 *
 * Handles WA Notifier CR stdout logs and normalizes them for LogPanel display.
 * Stages: send, process, busy, restart, health, config, runtime
 *
 * Each worker has its own normalizer because log domains are different:
 *   - CF (sheet-bq-sync): sync, bigquery, sheets, qc, firestore, config
 *   - Thor: config, fetch, resolve, write, notify, summary
 *   - WA Notifier: send, process, busy, restart, health, config
 */

import type { LoggingEntry, NormalizedLogEntry } from "./cloud-logging";

type LogLevel = "info" | "warn" | "error" | "success";

/* ── Stage inference from message content ── */

function inferStage(message: string): string {
    const text = message.toLowerCase();

    // Send / enqueue stage
    if (text.includes("enqueue") || text.includes("push task") || text.includes("/send") ||
        text.includes("queued") || text.includes("accepted")) return "send";

    // Process / delivery stage
    if (text.includes("/process") || text.includes("sending to") || text.includes("dispatch") ||
        text.includes("delivered") || text.includes("send message")) return "process";

    // Busy detection
    if (text.includes("busy") || text.includes("503") || text.includes("wait")) return "busy";

    // Restart / recovery
    if (text.includes("restart") || text.includes("recovery") || text.includes("restarting")) return "restart";

    // Health check
    if (text.includes("health") || text.includes("/health") || text.includes("ping") ||
        text.includes("reachable")) return "health";

    // Config / provider
    if (text.includes("config") || text.includes("active") || text.includes("provider") ||
        text.includes("is_active") || text.includes("environment")) return "config";

    // Instance lifecycle
    if (text.includes("instance") || text.includes("listening") || text.includes("port") ||
        text.includes("started") || text.includes("stopped")) return "runtime";

    return "runtime";
}

/* ── Level inference from severity + content ── */

function inferLevel(severity: string, message: string): LogLevel {
    const normalizedSeverity = severity?.toUpperCase();
    const text = message.toLowerCase();

    // Hard severity override
    if (normalizedSeverity === "ERROR" || normalizedSeverity === "CRITICAL") return "error";
    if (normalizedSeverity === "WARNING") return "warn";

    // Content-based detection
    if (text.includes("sent successfully") || text.includes("delivered") ||
        text.includes("200 ok") || text.includes("success") ||
        text.includes("✅") || text.includes("done")) return "success";

    if (text.includes("busy") || text.includes("503") || text.includes("retry") ||
        text.includes("wait") || text.includes("⚠")) return "warn";

    if (text.includes("failed") || text.includes("error") || text.includes("❌") ||
        text.includes("timeout") || text.includes("rejected")) return "error";

    return "info";
}

/* ── Message extraction ── */

function normalizeMessage(payload: Record<string, string>, textPayload?: string): string {
    return payload.message || textPayload || JSON.stringify(payload);
}

/* ── Run/trace ID extraction ── */

function inferRunId(message: string, payload: Record<string, string>): string | null {
    const direct = payload.runId || payload.run_id || payload.message_key;
    if (direct) return direct;

    // Try to extract any UUID-like trace
    const match = message.match(/[a-f0-9-]{8,36}/i);
    return match ? match[0] : null;
}

/* ── Source detection ── */

function detectSource(entry: LoggingEntry): string {
    const resourceType = entry.resource?.type || "";
    if (resourceType === "cloud_scheduler_job") return "cloud-scheduler";
    if (entry.logName?.includes("serverless-hub-audit")) return "dashboard-config";
    return "wa-notifier";
}

/* ── Compact system messages ── */

function compactMessage(msg: string): string {
    if (msg.includes("Starting new instance") && msg.includes("Reason:")) {
        const reason = msg.match(/Reason:\s*(\w+)/)?.[1] || "unknown";
        return `instance starting (${reason.toLowerCase()})`;
    }
    if (msg.includes("Instance stopped") || msg.includes("Shutting down")) {
        return "instance stopped";
    }
    if (msg.includes("Listening on port") || msg.includes("ready to accept")) {
        const port = msg.match(/port\s+(\d+)/)?.[1] || "";
        return port ? `listening on :${port}` : "ready";
    }
    return msg;
}

/* ── Scheduler / audit formatting (shared pattern) ── */

function formatSchedulerMessage(entry: LoggingEntry): string {
    const jp = entry.jsonPayload || {};
    const debug = jp.debugInfo as string || "";
    const httpMatch = debug.match(/HTTP response code number = (\d+)/);
    if (httpMatch) return `Health check · HTTP ${httpMatch[1]}`;
    if (jp.scheduledTime) return "Health check triggered";
    return debug || entry.textPayload || "Scheduler event";
}

function formatAuditMessage(entry: LoggingEntry): string {
    const jp = entry.jsonPayload || {};
    const detail = jp.detail as string || "";
    const action = jp.action as string || "unknown";
    return detail || action;
}

/* ═══════════════════════════════════════════════════
   Main normalizer — exported for use in worker-registry
   ═══════════════════════════════════════════════════ */

export function normalizeWaNotifierLogEntry(entry: LoggingEntry): NormalizedLogEntry {
    const source = detectSource(entry);

    // Cloud Scheduler entries (health check triggers)
    if (source === "cloud-scheduler") {
        return {
            id: entry.insertId || `cs-${entry.timestamp}`,
            timestamp: entry.timestamp || new Date().toISOString(),
            level: "info",
            stage: "health",
            runId: null,
            message: formatSchedulerMessage(entry),
            source,
            meta: entry.jsonPayload || null,
        };
    }

    // Dashboard audit entries (config changes via Serverless Hub UI)
    if (source === "dashboard-config") {
        const jp = entry.jsonPayload || {};
        const action = jp.action as string || "";
        const severity = ["paused", "disabled"].includes(action) ? "warn" as const : "info" as const;
        return {
            id: entry.insertId || `audit-${entry.timestamp}`,
            timestamp: entry.timestamp || new Date().toISOString(),
            level: severity,
            stage: "config",
            runId: null,
            message: formatAuditMessage(entry),
            source,
            meta: entry.jsonPayload || null,
        };
    }

    // WA Notifier CR entries (main logs)
    const payload = (entry.jsonPayload as Record<string, string> | undefined) || {};
    const textPayload = entry.textPayload || "";
    const timestamp = entry.timestamp || new Date().toISOString();
    const message = compactMessage(normalizeMessage(payload, textPayload));
    const severity = payload.severity || entry.severity || "INFO";
    const insertId = entry.insertId || "";

    return {
        id: insertId ? `${timestamp}|${insertId}` : `${timestamp}|${message}`,
        timestamp,
        level: inferLevel(severity, message),
        stage: inferStage(message),
        runId: inferRunId(message, payload),
        message,
        source,
        meta: entry.jsonPayload || null,
    };
}
