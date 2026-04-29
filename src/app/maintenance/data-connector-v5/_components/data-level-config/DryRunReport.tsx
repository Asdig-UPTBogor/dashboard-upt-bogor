"use client";

/**
 * Data Level Config — dry-run result display + 3 action buttons.
 */

import { Loader2, Save, Highlighter, Clock, FileText } from "lucide-react";
import type { DryRunResult } from "./types";
import { pct } from "./constants";

export function DryRunReport({
    result,
    saving,
    highlighting,
    onSave,
    onHighlight,
}: {
    result: DryRunResult;
    saving: boolean;
    highlighting: boolean;
    onSave: () => void;
    onHighlight: () => void;
}) {
    const enrichedPct = pct(result.rowsEnriched, result.rowsTotal);
    const rejectedPct = pct(result.rowsRejected, result.rowsTotal);

    return (
        <section className="rounded-lg border border-border/60 bg-card overflow-hidden">
            <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/40">
                <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 opacity-70" />
                    <span className="ds-label">Hasil Dry Run</span>
                </div>
                <span className="ds-small opacity-60 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(result.runAt).toLocaleString("id-ID")}
                </span>
            </header>

            <div className="p-4 space-y-3">
                {/* Summary stat tiles */}
                <div className="grid grid-cols-3 gap-2">
                    <StatBox
                        label="Total Row"
                        value={result.rowsTotal.toLocaleString("id-ID")}
                        tone="neutral"
                    />
                    <StatBox
                        label="Ter-enrich"
                        value={result.rowsEnriched.toLocaleString("id-ID")}
                        sub={`${enrichedPct}%`}
                        tone="success"
                    />
                    <StatBox
                        label="Rejected"
                        value={result.rowsRejected.toLocaleString("id-ID")}
                        sub={`${rejectedPct}%`}
                        tone={result.rowsRejected > 0 ? "warn" : "neutral"}
                    />
                </div>

                {/* Progress bar — enriched vs rejected */}
                {result.rowsTotal > 0 && (
                    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-white/5">
                        <div
                            className="bg-emerald-500/70"
                            style={{ width: `${enrichedPct}%` }}
                            title={`${enrichedPct}% enriched`}
                        />
                        <div
                            className="bg-amber-500/70"
                            style={{ width: `${rejectedPct}%` }}
                            title={`${rejectedPct}% rejected`}
                        />
                    </div>
                )}

                {/* Reject breakdown */}
                {Object.keys(result.rejectReasons).length > 0 && (
                    <div>
                        <div className="ds-label mb-1.5 opacity-80">Breakdown reject:</div>
                        <div className="space-y-0.5 rounded-md border border-border/40 bg-white/[0.015]">
                            {Object.entries(result.rejectReasons).map(([reason, count], i, arr) => (
                                <div
                                    key={reason}
                                    className={`ds-transition flex items-center justify-between px-2.5 py-1.5 hover:bg-white/[0.03] ${
                                        i < arr.length - 1 ? "border-b border-border/20" : ""
                                    }`}
                                >
                                    <code className="ds-small text-foreground/80 font-mono">
                                        {reason}
                                    </code>
                                    <span className="ds-data text-amber-400">{count} row</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sample reject — defensive: backend kadang ga return sample array (lastDryRun stale) */}
                {Array.isArray(result.sample) && result.sample.length > 0 && (
                    <div>
                        <div className="ds-label mb-1.5 opacity-80">
                            Sample rejected ({result.sample.length}):
                        </div>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto rounded-md border border-border/40 bg-white/[0.015] p-1">
                            {result.sample.map((row, i) => (
                                <div
                                    key={i}
                                    className="ds-transition flex items-baseline gap-2 px-2 py-1 rounded hover:bg-white/[0.04]"
                                >
                                    <span className="ds-small opacity-60 font-mono shrink-0">
                                        #{row.row_number}
                                    </span>
                                    <code className="ds-small text-red-300 font-mono shrink-0">
                                        {row.reason}
                                    </code>
                                    <span className="ds-small opacity-80 truncate">
                                        {row.reason_message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <footer className="flex items-center gap-2 px-4 py-3 border-t border-border/40 bg-background/30">
                <button
                    onClick={onSave}
                    disabled={saving || result.rowsRejected > 0}
                    title={
                        result.rowsRejected > 0
                            ? `Save di-disable. Masih ada ${result.rowsRejected} row reject — betulin dulu (Highlight dulu) atau accept reject via tombol Force di bawah.`
                            : "Save config + trigger re-sync FK enrichment"
                    }
                    className="ds-transition cursor-pointer flex items-center gap-1.5 text-sm h-9 px-4 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-emerald-500/20"
                >
                    {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Save className="w-3.5 h-3.5" />
                    )}
                    Save &amp; Commit
                    {result.rowsRejected === 0 && (
                        <span className="ds-data text-emerald-950/70">100% ✓</span>
                    )}
                </button>
                {result.rowsRejected > 0 && (
                    <>
                        <button
                            onClick={onHighlight}
                            disabled={highlighting}
                            className="ds-transition cursor-pointer flex items-center gap-1.5 text-sm h-9 px-4 rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Warnai cell bermasalah di Sheet, betulin di sana"
                        >
                            {highlighting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Highlighter className="w-3.5 h-3.5" />
                            )}
                            Highlight & betulin di Sheet
                        </button>
                        <button
                            onClick={() => {
                                if (
                                    confirm(
                                        `Force save dengan ${result.rowsRejected} row reject?\n\nRow reject TIDAK akan dapat FK ID — di Dashboard nanti ga ke-tampil filter/aggregate yang depend ke hirarki.\n\nKalau OK, lanjut.`
                                    )
                                ) {
                                    onSave();
                                }
                            }}
                            disabled={saving}
                            className="ds-transition cursor-pointer flex items-center gap-1.5 text-sm h-9 px-3 rounded-md border border-red-500/40 bg-red-500/5 hover:bg-red-500/15 text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Lanjutkan save walau ada reject (row reject tidak dapat FK)"
                        >
                            <Save className="w-3.5 h-3.5" />
                            Force Save
                        </button>
                    </>
                )}
            </footer>
        </section>
    );
}

function StatBox({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: string;
    sub?: string;
    tone: "neutral" | "success" | "warn";
}) {
    const toneMap = {
        neutral: "border-border/50 bg-background/40 text-foreground/90",
        success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
        warn: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    } as const;
    return (
        <div
            className={`ds-transition rounded-md border px-3 py-2 ${toneMap[tone]} hover:brightness-110`}
        >
            <div className="ds-small opacity-60">{label}</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="ds-kpi text-base">{value}</span>
                {sub && <span className="ds-data opacity-70">{sub}</span>}
            </div>
        </div>
    );
}
