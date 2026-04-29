"use client";

/**
 * ActionProgressModal — modal interaktif untuk show proses BE step-by-step + result akhir.
 *
 * Pattern:
 *   - Trigger: user klik action button (Test / Save / Rebuild)
 *   - Modal open dengan step list
 *   - Tiap step update real-time (pending → running → done/error)
 *   - Setelah semua step done → render result block (counts / counts per level / etc)
 *   - User klik [Close] untuk dismiss
 */

import { CheckCircle2, Loader2, AlertCircle, X, Clock } from "lucide-react";

export type StepStatus = "pending" | "running" | "done" | "error";

export interface ActionStep {
    label: string;
    status: StepStatus;
    detail?: string; // optional sub-text
    durationMs?: number;
}

export interface ActionResult {
    title: string;
    rows?: Array<{ label: string; value: string | number; tone?: "default" | "success" | "warn" }>;
    warnings?: string[];
}

export interface ActionState {
    open: boolean;
    title: string;
    steps: ActionStep[];
    result?: ActionResult;
    error?: string;
    canClose: boolean;
}

export const initialActionState: ActionState = {
    open: false,
    title: "",
    steps: [],
    canClose: true,
};

export function ActionProgressModal({
    state,
    onClose,
}: {
    state: ActionState;
    onClose: () => void;
}) {
    if (!state.open) return null;

    const totalDuration = state.steps.reduce((acc, s) => acc + (s.durationMs || 0), 0);
    const allDone = state.steps.every((s) => s.status === "done");
    const hasError = state.steps.some((s) => s.status === "error") || !!state.error;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={state.canClose ? onClose : undefined}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-border/60 bg-card shadow-2xl flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                            {hasError ? (
                                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                            ) : allDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            ) : (
                                <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                            )}
                            <h2 className="ds-title truncate">{state.title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={!state.canClose}
                            className="ds-transition cursor-pointer p-1.5 rounded-md hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={state.canClose ? "Tutup" : "Tunggu proses selesai..."}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </header>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {/* Steps progress */}
                        <div className="space-y-2">
                            {state.steps.map((step, i) => (
                                <StepRow key={i} step={step} index={i + 1} />
                            ))}
                        </div>

                        {/* Total duration kalau ada step done */}
                        {totalDuration > 0 && (
                            <div className="flex items-center gap-1.5 ds-small opacity-60 pt-2 border-t border-border/30">
                                <Clock className="w-3 h-3" />
                                Total: {formatDuration(totalDuration)}
                            </div>
                        )}

                        {/* Error block */}
                        {state.error && (
                            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="ds-label text-red-300 mb-1">Error</div>
                                        <pre className="ds-small text-red-200 whitespace-pre-wrap font-mono text-xs">
                                            {state.error}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Result block */}
                        {state.result && allDone && (
                            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <div className="ds-label text-emerald-300">{state.result.title}</div>
                                </div>
                                {state.result.rows && state.result.rows.length > 0 && (
                                    <div className="space-y-1">
                                        {state.result.rows.map((row, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between px-2 py-1 rounded bg-emerald-500/5"
                                            >
                                                <span className="ds-small opacity-80">{row.label}</span>
                                                <span
                                                    className={`ds-data font-mono ${
                                                        row.tone === "warn"
                                                            ? "text-amber-300"
                                                            : row.tone === "success"
                                                            ? "text-emerald-300"
                                                            : "text-foreground/90"
                                                    }`}
                                                >
                                                    {row.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {state.result.warnings && state.result.warnings.length > 0 && (
                                    <div className="border-t border-emerald-500/20 pt-2">
                                        <div className="ds-label text-amber-300 mb-1">⚠ Warnings</div>
                                        <ul className="ds-small text-amber-200 space-y-0.5 list-disc list-inside">
                                            {state.result.warnings.map((w, i) => (
                                                <li key={i}>{w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <footer className="shrink-0 flex items-center justify-end gap-2 border-t border-border/60 px-5 py-3 bg-background/30">
                        <button
                            onClick={onClose}
                            disabled={!state.canClose}
                            className="ds-transition cursor-pointer text-sm h-9 px-4 rounded-md border border-border bg-background hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {state.canClose ? "Close" : "Processing..."}
                        </button>
                    </footer>
                </div>
            </div>
        </>
    );
}

function StepRow({ step, index }: { step: ActionStep; index: number }) {
    const iconMap = {
        pending: (
            <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[10px] opacity-50 font-bold">
                {index}
            </div>
        ),
        running: (
            <div className="w-5 h-5 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center">
                <Loader2 className="w-3 h-3 text-blue-300 animate-spin" />
            </div>
        ),
        done: (
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-emerald-950" />
            </div>
        ),
        error: (
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <X className="w-3 h-3 text-red-950" />
            </div>
        ),
    };
    const toneMap = {
        pending: "opacity-50",
        running: "text-blue-200",
        done: "text-foreground/90",
        error: "text-red-300",
    };
    return (
        <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">{iconMap[step.status]}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`ds-body ${toneMap[step.status]}`}>{step.label}</span>
                    {step.durationMs != null && step.status === "done" && (
                        <span className="ds-small opacity-50 font-mono">
                            {formatDuration(step.durationMs)}
                        </span>
                    )}
                </div>
                {step.detail && <div className="ds-small opacity-70 mt-0.5">{step.detail}</div>}
            </div>
        </div>
    );
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
