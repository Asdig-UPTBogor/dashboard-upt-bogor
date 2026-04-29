"use client";

/**
 * DeleteNodeDialog — konfirmasi hapus BQ table node dari canvas.
 *
 * Impact yang dijelasin:
 *   - Page Dashboard tidak akan render data sesuai visualisasi saat ini
 *   - Relasi/edge yang connect ke tabel ini akan hilang
 *   - Config bq_table_levels TIDAK terhapus (hanya mapping canvas yang di-reset)
 *
 * Full-screen overlay + backdrop blur. Card center. Ghost cancel + destructive confirm.
 */

import { AlertTriangle, Trash2, X } from "lucide-react";

export function DeleteNodeDialog({
    open,
    tableName,
    pageLabel,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    tableName: string;
    pageLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/30 shrink-0">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="ds-title">Hapus dari canvas?</h2>
                            <p className="ds-small font-mono truncate mt-0.5">{tableName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="ds-transition p-1 rounded hover:bg-muted opacity-50 hover:opacity-100 cursor-pointer"
                        aria-label="Batal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body — impact list */}
                <div className="px-5 py-4 space-y-3">
                    <p className="ds-label uppercase tracking-wider opacity-80">
                        Dampak
                    </p>
                    <ul className="space-y-2">
                        <Impact>
                            Page Dashboard <span className="font-mono text-foreground">&quot;{pageLabel}&quot;</span>{" "}
                            tidak akan render data sesuai visualisasi saat ini.
                        </Impact>
                        <Impact>
                            Relasi/edge yang connect ke tabel ini akan hilang.
                        </Impact>
                        <Impact>
                            Config di <span className="font-mono text-foreground">bq_table_levels</span>{" "}
                            <strong>TIDAK terhapus</strong> (hanya mapping canvas yang di-reset).
                        </Impact>
                    </ul>
                </div>

                {/* Footer — actions */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20 rounded-b-xl">
                    <button
                        onClick={onCancel}
                        className="ds-transition px-4 py-2 rounded-md text-sm hover:bg-muted cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        className="ds-transition flex items-center gap-1.5 px-4 py-2 rounded-md bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 text-red-400 text-sm font-medium cursor-pointer"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus dari Canvas
                    </button>
                </div>
            </div>
        </div>
    );
}

function Impact({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex gap-2 ds-body">
            <span className="text-red-400 shrink-0 mt-1">•</span>
            <span>{children}</span>
        </li>
    );
}
