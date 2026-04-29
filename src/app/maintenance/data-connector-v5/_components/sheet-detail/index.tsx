"use client";

/**
 * SheetDetail — Info detail per-sheet (V2).
 * Props: datasetId (= Firestore doc id), sheetTabId (string — numeric sheetTabId).
 *
 * Source: data_sources_v2/{datasetId}.sheets[sheetTabId]
 *
 * Show:
 *   - Config (bqTable, tabName, levelRef ke bq_table_levels)
 *   - Sync state (contentHash, rowCount, syncStatus, driftEventId)
 *   - Rejected row count + breakdown (dari ss_platform.rejected_rows)
 */

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, ExternalLink } from "lucide-react";
import { useFirestoreDataSourcesV2 } from "../shared/useFirestore";
import { ConfigSection } from "./ConfigSection";
import { DataQualitySection } from "./DataQualitySection";
import type {
    RejectBreakdown,
    RejectedRowLite,
    SheetSyncState,
} from "./types";

export default function SheetDetail({
    datasetId,
    sheetTabId,
}: {
    datasetId: string;
    sheetTabId: string;
}) {
    const { dataSources } = useFirestoreDataSourcesV2();
    const [syncState, setSyncState] = useState<SheetSyncState | null>(null);
    const [rejectBreakdown, setRejectBreakdown] = useState<RejectBreakdown[]>([]);
    const [loading, setLoading] = useState(true);

    const ds = useMemo(
        () => dataSources.find((d) => d.id === datasetId),
        [dataSources, datasetId]
    );
    const sheetCfg = ds?.sheets?.[sheetTabId] ?? null;

    useEffect(() => {
        if (!sheetCfg?.tabName) return;
        (async () => {
            setLoading(true);
            try {
                const rej = await fetch(
                    `/api/data-sources/ss-v5/rejected-rows?dataset=${encodeURIComponent(datasetId)}&limit=1000`
                )
                    .then((r) => r.json())
                    .catch(() => ({ rows: [], summary: {} }));

                // Filter rejected ke sheet ini (match tabName atau bqTable)
                const rejRowsForSheet: RejectedRowLite[] = (rej.rows || []).filter(
                    (r: RejectedRowLite) =>
                        r.source_sheet === sheetCfg.tabName ||
                        r.source_sheet === sheetCfg.bqTable
                );
                const byReason: Record<string, number> = {};
                for (const r of rejRowsForSheet) {
                    const code = r.reason_code ?? "UNKNOWN";
                    byReason[code] = (byReason[code] || 0) + 1;
                }
                setRejectBreakdown(
                    Object.entries(byReason).map(([reason_code, count]) => ({ reason_code, count }))
                );
                setSyncState({
                    dataset_name: datasetId,
                    sheet_name: sheetCfg.tabName,
                    row_count_total: sheetCfg.syncState?.rowCount,
                    last_synced_at: sheetCfg.syncState?.lastSyncAt ?? undefined,
                    last_sync_status: sheetCfg.syncState?.syncStatus,
                    row_count_rejected: rejRowsForSheet.length,
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [datasetId, sheetCfg]);

    if (!ds) {
        return (
            <div className="p-6">
                <p className="ds-small opacity-60">Dataset {datasetId} tidak ditemukan di Firestore</p>
            </div>
        );
    }

    if (!sheetCfg) {
        return (
            <div className="p-6">
                <p className="ds-small opacity-60">
                    Sheet tabId &quot;{sheetTabId}&quot; tidak terdaftar di config {datasetId}
                </p>
            </div>
        );
    }

    const tabName = sheetCfg.tabName;
    const bqTable = sheetCfg.bqTable;
    const levelRef = sheetCfg.levelRef;

    const spreadsheetUrl =
        ds.identity?.url ||
        `https://docs.google.com/spreadsheets/d/${ds.identity?.driveId ?? ""}`;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-5">
            <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-indigo-400 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="ds-small opacity-60 font-mono truncate">{datasetId}</p>
                    <h2 className="ds-heading truncate">{tabName}</h2>
                    <p className="ds-small opacity-70 mt-1">
                        BQ target: <span className="font-mono">{bqTable}</span>
                    </p>
                </div>
            </div>

            <ConfigSection
                sheetTabId={sheetTabId}
                levelRef={levelRef}
                datasetId={datasetId}
                tableName={bqTable}
            />

            <DataQualitySection
                loading={loading}
                syncState={syncState}
                rejectBreakdown={rejectBreakdown}
                datasetId={datasetId}
                tableName={bqTable}
            />

            {/* Spreadsheet link */}
            <section>
                <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener"
                    className="ds-transition cursor-pointer inline-flex items-center gap-2 ds-small text-indigo-400 hover:underline"
                >
                    Buka Spreadsheet sumber <ExternalLink className="h-3 w-3" />
                </a>
            </section>
        </div>
    );
}
