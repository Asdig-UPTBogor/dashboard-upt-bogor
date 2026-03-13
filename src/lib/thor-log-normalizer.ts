type LogLevel = "info" | "warn" | "error" | "success";

export interface ThorLogEntry {
    timestamp: string;
    level: LogLevel;
    stage: string;
    runId: string | null;
    message: string;
    source: string;
    id?: string;
}

function normalizeMessage(payload: Record<string, string>, textPayload?: string) {
    return payload.message || textPayload || JSON.stringify(payload);
}

function inferStage(message: string): string {
    const text = message.toLowerCase();
    if (text.includes("config") || text.includes("cache cleared") || text.includes("runtime config")) return "config";
    if (text.includes("tower")) return "resolve";
    if (text.includes("fetch") || text.includes("vaisala")) return "fetch";
    if (text.includes("filter")) return "filter";
    if (text.includes("append") || text.includes("sheet") || text.includes("header") || text.includes("write")) return "write";
    if (text.includes("wa ") || text.includes("maxchat") || text.includes("maintenance group") || text.includes("notification")) return "notify";
    if (text.includes("sync done") || text.includes("sync run") || text.includes("no_data") || text.includes("synced")) return "summary";
    if (text.includes("validasi") || text.includes("validate")) return "validate";
    return "runtime";
}

function inferRunId(message: string, payload: Record<string, string>): string | null {
    const direct = payload.runId || payload.run_id;
    if (direct) return direct;

    const match = message.match(/\b\d{4}-\d{2}-\d{2}t\d{2}[-:]\d{2}[-:]\d{2}(?:[-:.]\d+)?z\b/i);
    return match ? match[0] : null;
}

function inferLevel(severity: string, message: string): LogLevel {
    const normalizedSeverity = severity?.toUpperCase();
    const text = message.toLowerCase();

    if (normalizedSeverity === "ERROR") return "error";
    if (normalizedSeverity === "WARNING") return "warn";

    if (
        text.includes("sync done") ||
        text.includes("synced") ||
        text.includes("cache cleared") ||
        text.includes("validated") ||
        text.includes("validation ok") ||
        text.includes("notification sent") ||
        text.includes("success")
    ) {
        return "success";
    }

    return "info";
}

export function normalizeThorLogEntry(entry: Record<string, unknown>): ThorLogEntry {
    const payload = (entry.jsonPayload as Record<string, string> | undefined) || {};
    const textPayload = (entry.textPayload as string | undefined) || "";
    const timestamp = String(entry.timestamp || new Date().toISOString());
    const message = normalizeMessage(payload, textPayload);
    const severity = payload.severity || String(entry.severity || "INFO");
    const insertId = String(entry.insertId || "");

    return {
        id: insertId ? `${timestamp}|${insertId}` : `${timestamp}|${message}`,
        timestamp,
        level: inferLevel(severity, message),
        stage: inferStage(message),
        runId: inferRunId(message, payload),
        message,
        source: payload.source || "thor",
    };
}
