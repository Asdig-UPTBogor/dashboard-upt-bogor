"use client";

/**
 * DataQualitySection — Reject row count + breakdown + BQ table quick link.
 */

import { Loader2, CheckCircle2, Database, ExternalLink } from "lucide-react";
import type { RejectBreakdown, SheetSyncState } from "./types";

export function DataQualitySection({
    loading,
    syncState,
    rejectBreakdown,
    datasetId,
    tableName,
}: {
    loading: boolean;
    syncState: SheetSyncState | null;
    rejectBreakdown: RejectBreakdown[];
    datasetId: string;
    tableName?: string;
}) {
    return (
        <section>
            <h3 className="ds-small uppercase tracking-widest opacity-70 mb-3">
                Data Quality
            </h3>
            {loading ? (
                <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="ds-small opacity-80">Rejected Rows</span>
                        </div>
                        <p className="ds-kpi text-amber-400">
                            {(syncState?.row_count_rejected ?? 0).toLocaleString("id-ID")}
                        </p>
                        {rejectBreakdown.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                                {rejectBreakdown.map((r) => (
                                    <div key={r.reason_code} className="flex justify-between ds-small">
                                        <span className="opacity-70">{r.reason_code}</span>
                                        <span className="font-mono">{r.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Database className="h-4 w-4 text-blue-400" />
                            <span className="ds-small opacity-80">BQ Table</span>
                        </div>
                        <p className="text-sm font-mono">{tableName ?? "—"}</p>
                        <a
                            href={`https://console.cloud.google.com/bigquery?project=gcp-bridge-meshvpn&ws=!1m5!1m4!4m3!1sgcp-bridge-meshvpn!2s${datasetId}!3s${tableName ?? ""}`}
                            target="_blank"
                            rel="noopener"
                            className="ds-transition cursor-pointer inline-flex items-center gap-1 mt-2 ds-small text-indigo-400 hover:underline"
                        >
                            Buka di BQ Console <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </div>
            )}
        </section>
    );
}
