import { NextResponse } from "next/server";
import { proxyDashboardSyncWorker, requireDashboardSyncWorkerUrl } from "@/lib/dashboard-sync-worker";
import { listDashboardSyncSchedulerLogs } from "@/lib/cloud-scheduler-logs";

interface WorkerLogEntry {
    at: string;
    level?: "info" | "warn" | "error" | "success";
    stage?: string;
    runId?: string | null;
    message: string;
    meta?: Record<string, unknown> | null;
}

export async function GET() {
    try {
        requireDashboardSyncWorkerUrl();
        const [upstream, schedulerLogs] = await Promise.all([
            proxyDashboardSyncWorker("/logs"),
            listDashboardSyncSchedulerLogs(40),
        ]);

        let workerLogs: Array<{
            timestamp: string;
            level: "info" | "warn" | "error" | "success";
            stage: string;
            runId: string | null;
            message: string;
            meta: Record<string, unknown> | null;
            source: string;
        }> = [];

        if (upstream.ok) {
            const payload = await upstream.json() as { logs?: WorkerLogEntry[] };

            workerLogs = (payload.logs || []).map((entry) => ({
                timestamp: entry.at,
                level: entry.level || deriveLevel(entry.message),
                stage: entry.stage || "worker",
                runId: entry.runId || null,
                message: formatWorkerMessage(entry),
                meta: entry.meta || null,
                source: "dashboard-sync-worker",
            }));
        } else {
            const rawText = await upstream.text();
            workerLogs = [{
                timestamp: new Date().toISOString(),
                level: upstream.status === 429 ? "warn" : "error",
                stage: "worker",
                runId: null,
                message: upstream.status === 429
                    ? "Worker logs temporarily unavailable · Worker instance is busy"
                    : `Worker logs unavailable · HTTP ${upstream.status}`,
                meta: rawText ? { error: rawText } : null,
                source: "dashboard-sync-worker",
            }];
        }

        const logs = [...workerLogs, ...schedulerLogs].sort((a, b) => (
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ));

        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}

function deriveLevel(message: string): "info" | "warn" | "error" | "success" {
    const lower = message.toLowerCase();
    if (lower.includes("error") || lower.includes("failed")) return "error";
    if (lower.includes("warn")) return "warn";
    if (lower.includes("[ok]") || lower.includes("success")) return "success";
    return "info";
}

function formatWorkerMessage(entry: WorkerLogEntry): string {
    const meta = entry.meta || {};

    if (entry.stage === "sheets") {
        if (entry.level === "success") {
            const rowCount = typeof meta.rowCount === "number" ? `${meta.rowCount.toLocaleString("id-ID")} row` : null;
            const fetchMs = typeof meta.fetchMs === "number" ? `${meta.fetchMs}ms` : null;
            return [entry.message, rowCount, fetchMs].filter(Boolean).join(" · ");
        }

        if (entry.level === "error") {
            const rawError = typeof meta.error === "string" ? meta.error : "";
            const shortError = rawError.includes("Quota exceeded")
                ? "quota Sheets API tercapai"
                : rawError || "fetch gagal";
            const fetchMs = typeof meta.fetchMs === "number" ? `${meta.fetchMs}ms` : null;
            return [entry.message, shortError, fetchMs].filter(Boolean).join(" · ");
        }
    }

    if (entry.stage === "qc") {
        const totalInvalidRows = typeof meta.totalInvalidRows === "number"
            ? `${meta.totalInvalidRows.toLocaleString("id-ID")} invalid row`
            : null;
        const checkedSheets = typeof meta.checkedSheets === "number"
            ? `${meta.checkedSheets} checked sheet`
            : null;
        return [entry.message, checkedSheets, totalInvalidRows].filter(Boolean).join(" · ");
    }

    if (entry.stage === "bigquery") {
        const current = typeof meta.current === "number" ? meta.current : null;
        const total = typeof meta.total === "number" ? meta.total : null;
        const page = typeof meta.page === "string" ? meta.page : null;
        const pageCount = typeof meta.pageCount === "number" ? `${meta.pageCount} page` : null;
        const changedPageCount = typeof meta.changedPageCount === "number" ? meta.changedPageCount : null;
        const skippedPageCount = typeof meta.skippedPageCount === "number" ? meta.skippedPageCount : null;
        const datasetId = typeof meta.datasetId === "string" ? meta.datasetId : null;
        if (page && current !== null && total !== null) {
            return [entry.message, `${current}/${total}`, datasetId].filter(Boolean).join(" · ");
        }
        if (changedPageCount !== null || skippedPageCount !== null) {
            const changed = changedPageCount !== null ? `${changedPageCount} changed` : null;
            const skipped = skippedPageCount !== null ? `${skippedPageCount} skipped` : null;
            return [entry.message, changed, skipped, pageCount, datasetId].filter(Boolean).join(" · ");
        }
        return [entry.message, pageCount, datasetId].filter(Boolean).join(" · ");
    }

    if (entry.stage === "source") {
        const changedSheetCount = typeof meta.changedSheetCount === "number" ? `${meta.changedSheetCount} changed sheet` : null;
        const unchangedSheetCount = typeof meta.unchangedSheetCount === "number" ? `${meta.unchangedSheetCount} unchanged sheet` : null;
        const newSheetCount = typeof meta.newSheetCount === "number" ? `${meta.newSheetCount} new sheet` : null;
        const removedSheetCount = typeof meta.removedSheetCount === "number" ? `${meta.removedSheetCount} removed sheet` : null;
        return [entry.message, changedSheetCount, unchangedSheetCount, newSheetCount, removedSheetCount].filter(Boolean).join(" · ");
    }

    if (entry.stage === "firestore") {
        const rawError = typeof meta.error === "string" ? meta.error : "";
        const shortError = rawError.includes("DEADLINE_EXCEEDED")
            ? "status Firestore timeout"
            : rawError || "persist status gagal";
        return [entry.message, shortError].filter(Boolean).join(" · ");
    }

    if (entry.stage === "summary" && entry.message === "Run started (fetch)") {
        const page = typeof meta.page === "string" && meta.page ? meta.page : "All Pages";
        return `Run started · ${page}`;
    }

    if (entry.stage === "sheets" && entry.message.startsWith("Fetching ")) {
        const uniqueSheetCount = typeof meta.uniqueSheetCount === "number" ? `${meta.uniqueSheetCount} sheet` : null;
        const groupCount = typeof meta.groupCount === "number" ? `${meta.groupCount} source group` : null;
        return [entry.message, uniqueSheetCount, groupCount].filter(Boolean).join(" · ");
    }

    if (entry.stage === "qc" && entry.message === "Running hierarchy QC") {
        const fetchedSheets = typeof meta.fetchedSheets === "number" ? `${meta.fetchedSheets} fetched sheet` : null;
        return [entry.message, fetchedSheets].filter(Boolean).join(" · ");
    }

    if (entry.stage === "summary" && entry.message === "Sync run completed") {
        const pageCount = typeof meta.pageCount === "number" ? `${meta.pageCount} page` : null;
        const uniqueSheetCount = typeof meta.uniqueSheetCount === "number" ? `${meta.uniqueSheetCount} sheet` : null;
        const errorSheets = typeof meta.errorSheets === "number" ? `${meta.errorSheets} error` : null;
        const sourceChanged = typeof meta.sourceChangedSheets === "number" ? `${meta.sourceChangedSheets} source changed` : null;
        return [entry.message, pageCount, uniqueSheetCount, errorSheets, sourceChanged].filter(Boolean).join(" · ");
    }

    return entry.message;
}
