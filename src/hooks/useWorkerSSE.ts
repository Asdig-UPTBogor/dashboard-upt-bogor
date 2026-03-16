/**
 * useWorkerStatus — Generic Serverless Hub status hook.
 *
 * Fetches service status from two APIs:
 *   1. POST /api/serverless-hub/{serviceId}/control { action: "status" }
 *      → scheduler state + _settings config
 *   2. GET  /api/serverless-hub/{serviceId}/config
 *      → spreadsheets[] (individual Firestore docs with sheets{}, lastSync{})
 *
 * Polling: refreshes every POLL_INTERVAL_MS (60s) for live status.
 * Also exposes refetch() for immediate refresh after user actions.
 *
 * Output shape matches what page.tsx reads:
 *   status.cfStatus.lastRun          ← _settings.lastFullSync
 *   status.cfStatus.lastStatus       ← _settings.lastSyncStatus
 *   status.cfStatus.lastDurationMs   ← _settings.lastSyncDurationMs
 *   status.cfStatus.isStale          ← computed: lastSync > 2x interval
 *   status.cfStatus.spreadsheets[]   ← from config API
 *   status.scheduler                 ← from control API
 *   status.syncSnapshot.sheets[]     ← SheetBenchmark[] built from sheets{}
 *   status.worker.isPaused           ← from scheduler/automation state
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkerStatus = Record<string, any>;

const POLL_INTERVAL_MS = 60_000; // 60s — keeps countdown + status fresh

// ────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────

export function useWorkerStatus(serviceId: string = "spreadsheet-sync") {
    const [status, setStatus] = useState<WorkerStatus | null>(null);
    const mountedRef = useRef(true);

    // Build API URLs from serviceId — no hardcoded paths
    const controlUrl = `/api/serverless-hub/${serviceId}/control`;
    const configUrl = `/api/serverless-hub/${serviceId}/config`;

    const fetchStatus = useCallback(async () => {
        try {
            const [controlRes, configRes] = await Promise.all([
                fetch(controlUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "status" }),
                }),
                fetch(configUrl),
            ]);
            if (!controlRes.ok || !configRes.ok) return;

            const control = await controlRes.json();
            const configData = await configRes.json();
            if (!mountedRef.current) return;

            const spreadsheets = configData.spreadsheets || [];
            const settings = control.config || {};

            // ── Build SheetBenchmark[] from per-sheet Firestore data ──
            const benchmarks = buildSheetBenchmarks(spreadsheets);

            // ── Compute isStale: last sync > 2x expected interval ──
            const intervalMs = (settings.syncIntervalMinutes || 30) * 60_000;
            const lastSyncMs = settings.lastFullSync
                ? new Date(settings.lastFullSync).getTime()
                : 0;
            const isStale = lastSyncMs > 0
                ? (Date.now() - lastSyncMs) > intervalMs * 2
                : false;

            setStatus({
                scheduler: control.scheduler || null,
                cfStatus: {
                    spreadsheets,
                    // Field names must match what page.tsx reads:
                    lastRun: settings.lastFullSync || null,           // page.tsx line 335
                    lastStatus: settings.lastSyncStatus || null,      // page.tsx line 338
                    lastDurationMs: settings.lastSyncDurationMs || 0, // page.tsx line 336
                    isStale,                                          // page.tsx line 108
                },
                syncSnapshot: { sheets: benchmarks },
                worker: {
                    isPaused: control.automation?.isPaused ?? !control.scheduler?.enabled,
                },
            });
        } catch {
            // Network errors are non-fatal — status stays at previous value
        }
    }, [controlUrl, configUrl]);

    // ── Mount + polling ──
    useEffect(() => {
        mountedRef.current = true;
        void fetchStatus();
        const id = setInterval(fetchStatus, POLL_INTERVAL_MS);
        return () => {
            mountedRef.current = false;
            clearInterval(id);
        };
    }, [fetchStatus]);

    return { status, refetch: fetchStatus };
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

/**
 * Build SheetBenchmark[] from spreadsheet docs' sheets{} maps.
 *
 * Each sheet entry in Firestore has:
 *   - syncMs:    BQ write duration (written by CF)
 *   - rowCount:  data rows (written by CF)
 *   - sizeBytes: BQ table storage (written by CF)
 *
 * Output key format: "{spreadsheetId}::{sheetName}"
 * This key is used by page.tsx getBenchmark() to filter per spreadsheet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSheetBenchmarks(spreadsheets: any[]): Array<Record<string, unknown>> {
    const benchmarks: Array<Record<string, unknown>> = [];

    for (const ss of spreadsheets) {
        const sheetsMap = ss.sheets || {};
        for (const [sheetName, meta] of Object.entries(sheetsMap)) {
            const m = meta as Record<string, unknown>;
            benchmarks.push({
                key: `${ss.spreadsheetId}::${sheetName}`,
                spreadsheetId: ss.spreadsheetId,
                sheetName,
                tableName: m.tableName || `n_${sheetName}`,
                fetchMs: (m.syncMs as number) || 0,       // CF writes syncMs
                rows: (m.rowCount as number) || 0,         // CF writes rowCount
                cols: (m.columnCount as number) || 0,      // CF writes columnCount
                sizeBytes: (m.sizeBytes as number) || 0,   // CF writes sizeBytes
            });
        }
    }

    return benchmarks;
}
