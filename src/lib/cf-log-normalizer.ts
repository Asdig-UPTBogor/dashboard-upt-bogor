/**
 * CF Log Normalizer — Cloud Function (sheet-bq-sync) specific.
 *
 * Handles two log formats:
 *   OLD: console.log(JSON.stringify({ sheet, table, rows, dataset }))
 *   NEW: console.log('[STAGE] Human-readable message')
 *
 * Each worker has its own normalizer because log domains are different:
 *   - CF: stages = sync, bigquery, sheets, qc, firestore, config
 *   - Thor: stages = config, fetch, resolve, write, notify, summary
 */

import type { LoggingEntry, NormalizedLogEntry } from "./cloud-logging";

/* ── Compact formatting helpers ── */

/** 1234 → "1.2k", 31256 → "31.3k", 999 → "999" */
function fmtNum(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
}

/** 1500ms → "1.5s", 63047ms → "1m 3s", 500ms → "500ms" */
function fmtDuration(ms: number): string {
    if (ms >= 60_000) {
        const m = Math.floor(ms / 60_000);
        const s = Math.round((ms % 60_000) / 1000);
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    if (ms >= 1_000) return (ms / 1_000).toFixed(1).replace(/\.0$/, "") + "s";
    return `${Math.round(ms)}ms`;
}


/* ── Severity mapping ── */

function mapSeverity(severity?: string): NormalizedLogEntry["level"] {
    switch ((severity || "INFO").toUpperCase()) {
        case "ERROR":
        case "CRITICAL":
        case "ALERT":
        case "EMERGENCY":
            return "error";
        case "WARNING":
            return "warn";
        default:
            return "info";
    }
}

/* ── Stage extraction ── */

function extractStage(msg: string, payload: Record<string, unknown>): string {
    // NEW format: [STAGE] prefix
    const m = msg.match(/^\[(\w+)\]/);
    if (m) {
        const tag = m[1].toUpperCase();
        const stageMap: Record<string, string> = {
            SYNC: "sync", BQ: "bigquery", SHEETS: "sheets",
            QC: "qc", FS: "firestore", CONFIG: "config",
        };
        if (stageMap[tag]) return stageMap[tag];
    }

    // Structured payload
    if (typeof payload.stage === "string") return payload.stage;

    // OLD format: keyword detection
    if (msg.includes("batchGet") || msg.includes("📥")) return "sheets";
    if (msg.includes("BigQuery") || msg.includes("WRITE_TRUNCATE") || msg.includes("→")) return "bigquery";
    if (msg.includes("hierarchy") || msg.includes("schema drift")) return "qc";
    if (msg.includes("Firestore") || msg.includes("data_sources")) return "firestore";
    if (msg.includes("Sync complete") || msg.includes("sync started") ||
        msg.includes("📦") || msg.includes("📋") || msg.includes("☁️") ||
        msg.includes("⏸️") || msg.includes("Starting:")) return "sync";

    // OLD JSON payload with sheet/table keys
    if (payload.sheet && payload.table && payload.rows !== undefined) return "bigquery";

    return "general";
}

/* ── Run ID extraction ── */

function extractRunId(entry: LoggingEntry): string | null {
    const payload = entry.jsonPayload || {};
    if (typeof payload.runId === "string") return payload.runId;
    if (typeof payload.execution_id === "string") return payload.execution_id;
    if (entry.labels?.execution_id) return entry.labels.execution_id;
    if (entry.trace) {
        const parts = entry.trace.split("/");
        return parts[parts.length - 1]?.substring(0, 12) || null;
    }
    return null;
}

/* ── Message formatting ── */

function formatMessage(entry: LoggingEntry): string {
    const payload = entry.jsonPayload || {};
    let msg = "";

    if (typeof payload.message === "string") {
        msg = payload.message;
    } else {
        const text = entry.textPayload || "";
        if (!text.trim() || /^[═─\s]+$/.test(text.trim())) return text;

        // Parse JSON textPayload (OLD CF format)
        if (text.startsWith("{")) {
            try {
                const parsed = JSON.parse(text) as Record<string, unknown>;
                if (parsed.sheet && parsed.table) {
                    const rows = fmtNum(parsed.rows as number || 0);
                    const qc = (parsed.qcIssues as number) > 0 ? ` · ${fmtNum(parsed.qcIssues as number)} qc` : "";
                    msg = `${parsed.sheet} → ${parsed.table} (${rows} rows${qc})`;
                } else if (parsed.sheet && parsed.error) {
                    msg = `${parsed.sheet} → ${parsed.table}: ${parsed.error}`;
                } else {
                    msg = Object.entries(parsed)
                        .filter(([k]) => k !== "severity")
                        .map(([k, v]) => `${k}=${v}`)
                        .join(" · ");
                }
            } catch {
                msg = text;
            }
        } else {
            msg = text;
        }
    }

    // Strip [STAGE] prefix and leading emojis
    msg = msg.replace(/^\[(SYNC|BQ|SHEETS|QC|FS|CONFIG)\]\s*/i, "");
    msg = msg.replace(/^[✅❌⚠️☁️📦📥📋🔍⏸️🔄📊✓]\s*/u, "").trim();

    // Compact verbose system messages
    msg = compactMessage(msg);

    return msg;
}

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
    if (/^Function execution (started|took)\b/.test(msg)) {
        const took = msg.match(/took\s+(\d+)\s*ms/)?.[1];
        return took ? `execution: ${fmtDuration(Number(took))}` : "execution started";
    }

    // Compact durations: "1500ms" → "1.5s", "63047ms" → "1m 3s"
    msg = msg.replace(/(\d[\d,]*)\s*ms\b/g, (_, n) => fmtDuration(Number(n.replace(/,/g, ""))));
    // Compact large durations in seconds: "78.5s" stays, already compact

    // Compact row/number counts: "31,256 rows" → "31.3k rows"
    msg = msg.replace(/([\d,]+)\s+(rows?|sheets?|spreadsheets?|tables?|issues?|errors?)/gi, (_, n, unit) => {
        const num = Number(n.replace(/,/g, ""));
        return `${fmtNum(num)} ${unit}`;
    });

    // Compact bytes: "45678" in "45678 bytes" → "44.6KB"
    msg = msg.replace(/(\d[\d,]*)\s*bytes?/gi, (_, n) => {
        const bytes = Number(n.replace(/,/g, ""));
        if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + "MB";
        if (bytes >= 1_024) return (bytes / 1_024).toFixed(0) + "KB";
        return bytes + "B";
    });

    return msg;
}

/* ── Level detection (content-aware) ── */

function detectLevel(msg: string, base: NormalizedLogEntry["level"]): NormalizedLogEntry["level"] {
    if (base === "error") return "error";
    const lower = msg.toLowerCase();
    if (lower.includes("✅") || lower.includes("✓") || lower.includes("sync complete") ||
        lower.includes("rows written") || lower.includes("complete in") || lower.includes("success")) {
        return "success";
    }
    if (lower.includes("⚠") || lower.includes("skipping") || lower.includes("drift") ||
        lower.includes("not available") || lower.includes("disabled")) {
        return "warn";
    }
    if (lower.includes("❌") || lower.includes("fatal") || lower.includes("failed")) {
        return "error";
    }
    return base;
}

/* ── Source detection ── */

function detectSource(entry: LoggingEntry): string {
    const resourceType = entry.resource?.type || "";
    if (resourceType === "cloud_scheduler_job") return "cloud-scheduler";
    if (entry.logName?.includes("serverless-hub-audit")) return "dashboard-config";
    return "cloud-function";
}

/* ── CS / Audit message formatting ── */

function formatSchedulerMessage(entry: LoggingEntry): string {
    const jp = entry.jsonPayload || {};
    const debug = jp.debugInfo as string || "";
    const url = jp.url as string || jp.targetUrl as string || "";
    const httpMatch = debug.match(/HTTP response code number = (\d+)/);
    if (httpMatch) {
        return `Scheduler finished trigger · HTTP ${httpMatch[1]}`;
    }
    if (jp.scheduledTime) {
        const shortUrl = url ? url.split("/").pop() || url : "";
        return `Scheduler triggered${shortUrl ? ` → ${shortUrl}` : ""}`;
    }
    return debug || entry.textPayload || "Scheduler event";
}

function formatAuditMessage(entry: LoggingEntry): string {
    const jp = entry.jsonPayload || {};
    const action = jp.action as string || "unknown";
    const detail = jp.detail as string || "";
    return detail || action;
}

/* ── Main normalizer ── */

export function normalizeCfLogEntry(entry: LoggingEntry): NormalizedLogEntry {
    const source = detectSource(entry);

    // Cloud Scheduler entries
    if (source === "cloud-scheduler") {
        return {
            id: entry.insertId || `cs-${entry.timestamp}`,
            timestamp: entry.timestamp || new Date().toISOString(),
            level: "info",
            stage: "scheduler",
            runId: null,
            message: formatSchedulerMessage(entry),
            source,
            meta: entry.jsonPayload || null,
        };
    }

    // Dashboard audit entries
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

    // Cloud Function entries (existing logic)
    const message = formatMessage(entry);
    const payload = entry.jsonPayload || {};
    const rawLevel = mapSeverity(entry.severity);

    return {
        id: entry.insertId || `${entry.timestamp}|${message}`,
        timestamp: entry.timestamp || new Date().toISOString(),
        level: detectLevel(message, rawLevel),
        stage: extractStage(message, payload),
        runId: extractRunId(entry),
        message,
        source,
        meta: entry.jsonPayload || null,
    };
}
