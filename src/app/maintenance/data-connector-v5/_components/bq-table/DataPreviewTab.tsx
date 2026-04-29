"use client";

/**
 * DataPreviewTab — paginated rows, 100 per page.
 */

import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE, type PreviewResponse } from "./useTableMeta";

export function DataPreviewTab({
    preview,
    loading,
    page,
    onPrev,
    onNext,
}: {
    preview: PreviewResponse | null;
    loading: boolean;
    page: number;
    onPrev: () => void;
    onNext: () => void;
}) {
    const totalRows = preview?.totalRows ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const canPrev = page > 1;
    const canNext = page < totalPages;

    const previewCols = preview?.columns ?? [];
    const orderedCols = [
        ...previewCols.filter((c) => !c.name.startsWith("_")),
        ...previewCols.filter((c) => c.name.startsWith("_")),
    ];

    return (
        <section className="space-y-3">
            {/* Pagination controls */}
            <div className="flex items-center justify-between">
                <div className="ds-small opacity-70">
                    {totalRows > 0 ? (
                        <>
                            Page <span className="font-mono">{page}</span> / {totalPages} ·{" "}
                            Show <span className="font-mono">{PAGE_SIZE}</span> per page
                        </>
                    ) : loading ? "Loading..." : "0 rows"}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrev}
                        disabled={!canPrev || loading}
                        className="ds-transition cursor-pointer flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-3 h-3" />
                        Prev
                    </button>
                    <button
                        onClick={onNext}
                        disabled={!canNext || loading}
                        className="ds-transition cursor-pointer flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Data table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    </div>
                ) : orderedCols.length === 0 ? (
                    <div className="p-5 text-center ds-small opacity-60">No columns</div>
                ) : (
                    <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
                        <table className="w-full text-xs">
                            <thead className="bg-muted/40 sticky top-0">
                                <tr>
                                    {orderedCols.map((c) => (
                                        <th
                                            key={c.name}
                                            className={`text-left px-3 py-2 ds-label whitespace-nowrap ${
                                                c.name.startsWith("_") ? "opacity-50" : ""
                                            }`}
                                        >
                                            <div className="font-mono">{c.name}</div>
                                            <div className="ds-small opacity-50 font-mono">{c.type}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(preview?.rows ?? []).map((row, i) => (
                                    <tr key={i} className="hover:bg-white/5 ds-transition">
                                        {orderedCols.map((c) => (
                                            <td
                                                key={c.name}
                                                className={`px-3 py-1.5 whitespace-nowrap ${
                                                    c.name.startsWith("_") ? "opacity-60 font-mono" : ""
                                                }`}
                                            >
                                                {formatCell(row[c.name])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}

function formatCell(v: unknown): React.ReactNode {
    if (v === null || v === undefined || v === "") {
        return <span className="opacity-30">—</span>;
    }
    if (typeof v === "boolean") return String(v);
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    const s = String(v);
    if (s.length > 80) {
        return <span title={s}>{s.slice(0, 80)}…</span>;
    }
    return s;
}
