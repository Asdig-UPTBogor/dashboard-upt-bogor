import { NextResponse } from "next/server";
import {
    setWorkerPaused, triggerWorkerRefresh, getWorkerPaused, getPauseReason,
    setWorkerConfig, getWorkerConfig, type PauseReason,
} from "@/lib/background-prefetch";
import { getDriftReport } from "@/lib/drift-store";
import { isQcWritebackEnabled, setQcWritebackEnabled } from "@/lib/qc-writeback";
import { getQcReport } from "@/lib/qc-store";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (typeof body.paused === "boolean") {
            const reason: PauseReason = body.reason ?? "manual";
            setWorkerPaused(body.paused, reason);
            return NextResponse.json({ success: true, paused: body.paused, reason });
        }

        if (body.action === "refresh") {
            triggerWorkerRefresh();
            return NextResponse.json({ success: true, message: "Refresh triggered" });
        }

        if (body.action === "config") {
            const patch: Record<string, number> = {};
            if (typeof body.refreshIntervalMs === "number" && body.refreshIntervalMs >= 10_000) {
                patch.refreshIntervalMs = body.refreshIntervalMs;
            }
            if (typeof body.fetchDelayMs === "number" && body.fetchDelayMs >= 0) {
                patch.fetchDelayMs = body.fetchDelayMs;
            }
            setWorkerConfig(patch);
            return NextResponse.json({ success: true, config: getWorkerConfig() });
        }

        if (body.action === "qc-writeback") {
            const enabled = body.enabled === true;
            setQcWritebackEnabled(enabled);
            return NextResponse.json({ success: true, qcWriteback: enabled });
        }

        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    } catch (error) {
        console.error("[worker-control] API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET() {
    const drift = getDriftReport();
    const qc = getQcReport();
    return NextResponse.json({
        paused: getWorkerPaused(),
        reason: getPauseReason(),
        config: getWorkerConfig(),
        qcWriteback: isQcWritebackEnabled(),
        qc: qc ? {
            lastRun: qc.lastRun,
            totalErrors: qc.totalErrors,
            sheets: [...qc.results.values()].map(r => ({
                spreadsheetId: r.spreadsheetId,
                sheetName: r.sheetName,
                total: r.total,
                invalid: r.invalid,
                written: r.written,
                lastRun: r.lastRun,
            })),
        } : null,
        drift: drift ? {
            overallHealth: drift.overallHealth,
            issueCount: drift.summary.issueCount,
            timestamp: drift.timestamp,
            issues: drift.summary.issues,
        } : null,
    });
}
