/**
 * SyncTimeline1 — timeline visualization untuk sync_history events.
 * Reusable. Konsumsi dari /api/data-sources/ss-v5/sync-history.
 */
"use client";

import { CheckCircle2, XCircle, SkipForward, AlertTriangle, Clock } from "lucide-react";

export interface SyncEvent {
    run_id: string;
    started_at: { value: string } | string;
    finished_at?: { value: string } | string;
    trigger_source?: string;
    dataset_name: string;
    sheet_name: string;
    status: "success" | "error" | "skipped" | "partial";
    skipped_reason?: string | null;
    rows_read?: number;
    rows_written?: number;
    rows_rejected?: number;
    duration_ms?: number;
    error_message?: string | null;
}

interface Props {
    events: SyncEvent[];
    groupByCycle?: boolean;
    onEventClick?: (ev: SyncEvent) => void;
    maxItems?: number;
}

function getTs(v: { value: string } | string | undefined): string {
    if (!v) return "";
    return typeof v === "string" ? v : v.value;
}

function fmtTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return iso;
    }
}

function fmtAgo(iso: string): string {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
    return `${Math.floor(d / 86400_000)}d ago`;
}

function fmtMs(ms: number | undefined): string {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_META: Record<string, { icon: any; color: string; label: string }> = {
    success: { icon: CheckCircle2, color: "text-emerald-400", label: "OK" },
    error: { icon: XCircle, color: "text-red-400", label: "Error" },
    skipped: { icon: SkipForward, color: "text-muted-foreground/60", label: "Skip" },
    partial: { icon: AlertTriangle, color: "text-amber-400", label: "Partial" },
};

export function SyncTimeline1({ events, onEventClick, maxItems = 100 }: Props) {
    if (!events || events.length === 0) {
        return (
            <div className="py-12 text-center text-muted-foreground/40 text-sm">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Belum ada event sync dalam rentang ini</p>
            </div>
        );
    }

    const items = events.slice(0, maxItems);

    return (
        <div className="space-y-1">
            {items.map((ev) => {
                const meta = STATUS_META[ev.status] || STATUS_META.success;
                const Icon = meta.icon;
                const ts = getTs(ev.started_at);
                return (
                    <button
                        key={ev.run_id + ev.sheet_name + ts}
                        type="button"
                        onClick={() => onEventClick?.(ev)}
                        className="w-full flex items-center gap-3 rounded border border-border/20 bg-muted/5 px-3 py-2 text-left hover:bg-muted/10 transition-colors group"
                    >
                        <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />

                        <span className="font-mono tabular-nums text-xs text-muted-foreground/60 shrink-0 w-20">
                            {ts ? fmtTime(ts) : "—"}
                        </span>

                        <span className="flex-1 min-w-0">
                            <span className="text-xs text-foreground/80 font-mono truncate block">
                                {ev.dataset_name}
                                <span className="text-muted-foreground/40"> · </span>
                                {ev.sheet_name}
                            </span>
                        </span>

                        <span
                            className={`text-[10px] uppercase tracking-wider font-semibold shrink-0 w-12 ${meta.color}`}
                        >
                            {meta.label}
                        </span>

                        <span className="text-xs font-mono tabular-nums text-muted-foreground/60 shrink-0 w-48 text-right truncate">
                            {ev.status === "skipped" && ev.skipped_reason ? (
                                ev.skipped_reason
                            ) : ev.status === "error" ? (
                                <span className="text-red-400 truncate">
                                    {ev.error_message?.slice(0, 60) || "error"}
                                </span>
                            ) : (
                                <>
                                    {(ev.rows_written ?? 0).toLocaleString("id-ID")} /{" "}
                                    {(ev.rows_read ?? 0).toLocaleString("id-ID")} rows
                                    {(ev.rows_rejected ?? 0) > 0 && (
                                        <span className="text-amber-400">
                                            {" "}
                                            · {ev.rows_rejected} rej
                                        </span>
                                    )}
                                </>
                            )}
                        </span>

                        <span className="text-xs font-mono tabular-nums text-muted-foreground/40 shrink-0 w-14 text-right">
                            {fmtMs(ev.duration_ms)}
                        </span>

                        <span className="text-[10px] text-muted-foreground/30 shrink-0 w-16 text-right">
                            {ts ? fmtAgo(ts) : ""}
                        </span>
                    </button>
                );
            })}

            {events.length > maxItems && (
                <div className="text-center py-3 text-xs text-muted-foreground/50">
                    +{events.length - maxItems} event lebih lama (pakai filter untuk narrow down)
                </div>
            )}
        </div>
    );
}
