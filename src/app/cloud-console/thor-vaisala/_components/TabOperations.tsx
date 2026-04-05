"use client";

/**
 * Tab 3: Operations — Pure read-only display.
 * Layout:
 *   1. 8 compact stat cards (4 runtime + 4 validation) in a single row
 *   2. Collapsible "Runtime" section (performance, BQ, BBOX)
 *   3. Collapsible "Validation" section (status, columns, excluded)
 * Visual Standard: Spreadsheet Sync v2.0
 */

import { useMemo, useState } from "react";
import {
    Clock, Zap, Radio, Activity,
    Database, MapPin, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet,
    ChevronRight,
} from "lucide-react";
import type { ThorConfig } from "../_lib/types";
import { fmtWIB, fmtAgo } from "../_lib/api";
import { ServiceSection, ServiceGrid } from "../../_components/service-ui";

interface Props {
    config: Partial<ThorConfig>;
}

/* ── Compact stat card — smaller than ServiceStatCard ── */
function MiniCard({ label, value, icon, alert }: {
    label: string; value: string | number; icon: React.ReactNode; alert?: boolean;
}) {
    return (
        <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
            alert ? 'border-red-500/30 bg-red-500/5' : 'border-border/40 bg-muted/10'
        }`}>
            <div className="shrink-0">{icon}</div>
            <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground/60 leading-none">{label}</div>
                <div className="text-[12px] font-medium text-foreground/80 leading-tight mt-0.5 truncate">
                    {String(value ?? "—")}
                </div>
            </div>
        </div>
    );
}

/* ── Collapsible excluded reason row ── */
function ExcludedRow({ reason, count, towers }: { reason: string; count: number; towers?: string[] }) {
    const [open, setOpen] = useState(false);
    const hasTowers = towers && towers.length > 0;
    return (
        <div>
            <button
                onClick={() => hasTowers && setOpen(o => !o)}
                className={`flex items-center justify-between w-full py-1.5 border-b border-border/20 text-left ${hasTowers ? 'cursor-pointer hover:bg-muted/10' : 'cursor-default'}`}
            >
                <span className="flex items-center gap-1">
                    {hasTowers && (
                        <ChevronRight className={`h-3 w-3 text-muted-foreground/40 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
                    )}
                    <span className="text-[10px] text-muted-foreground/60">{reason}</span>
                </span>
                <span className="text-[10px] font-mono text-red-400/70">{count}</span>
            </button>
            {open && hasTowers && (
                <div className="flex flex-wrap gap-1 py-1.5 pl-4">
                    {towers.map((t, j) => (
                        <span key={j} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/5 text-red-400/60 border border-red-500/10">
                            {t}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TabOperations({ config }: Props) {
    const c = config as Record<string, any>;

    const configStatus = String(c.CONFIG_STATUS || "not_configured");

    const towerCols = useMemo(() => {
        try { return JSON.parse(c.TOWER_COLUMNS || '[]') as { role: string; header: string; letter: string }[]; }
        catch { return []; }
    }, [c.TOWER_COLUMNS]);

    const excludedReasons = useMemo(() => {
        try { return JSON.parse(c.TOWER_EXCLUDED_REASONS || '[]') as { reason: string; count: number; towers: string[] }[]; }
        catch { return []; }
    }, [c.TOWER_EXCLUDED_REASONS]);

    return (
        <div className="space-y-5">
            {/* ── Stat Cards: 2 rows × 4 cols ── */}
            <div className="space-y-2">
                {/* Runtime row */}
                <div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-semibold mb-1">Runtime</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <MiniCard label="Last Run" value={fmtWIB(c.LAST_FETCH_TS)}
                            icon={<Clock className="h-3.5 w-3.5 text-blue-400/60" />} />
                        <MiniCard label="Strikes" value={c.LAST_INSERT_COUNT ?? "—"}
                            icon={<Zap className="h-3.5 w-3.5 text-amber-400/60" />} />
                        <MiniCard label="API" value={String(c.API_STATUS || "—")}
                            icon={<Radio className="h-3.5 w-3.5 text-emerald-400/60" />}
                            alert={c.API_STATUS === 'error' || c.API_STATUS === 'auth_failed'} />
                        <MiniCard label="Config" value={String(c.CONFIG_STATUS || "—")}
                            icon={<Activity className="h-3.5 w-3.5 text-cyan-400/60" />}
                            alert={c.CONFIG_STATUS === 'need_validate'} />
                    </div>
                </div>
                {/* Validation row */}
                <div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-semibold mb-1">Validation</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <MiniCard label="Valid Towers" value={c.TOWER_COUNT ?? "—"}
                            icon={<MapPin className="h-3.5 w-3.5 text-emerald-400/60" />} />
                        <MiniCard label="Total Rows" value={c.TOWER_TOTAL_ROWS ?? "—"}
                            icon={<FileSpreadsheet className="h-3.5 w-3.5 text-blue-400/60" />} />
                        <MiniCard label="Excluded" value={c.TOWER_EXCLUDED ?? "—"}
                            icon={<XCircle className="h-3.5 w-3.5 text-red-400/60" />}
                            alert={(c.TOWER_EXCLUDED || 0) > 0} />
                        <MiniCard label="Validated" value={fmtWIB(c.TOWER_LAST_VALIDATED)}
                            icon={<CheckCircle2 className="h-3.5 w-3.5 text-cyan-400/60" />} />
                    </div>
                </div>
            </div>

            {/* ── Runtime (collapsible) ── */}
            <ServiceSection title="Runtime" icon={<Activity className="h-3.5 w-3.5" />} defaultOpen>
                <div className="space-y-4">
                    {/* Last Run Performance */}
                    <ServiceGrid items={[
                        { label: "Fetch Timestamp", value: c.LAST_FETCH_TS ? `${fmtWIB(c.LAST_FETCH_TS)} (${fmtAgo(c.LAST_FETCH_TS)})` : "—" },
                        { label: "Inserted Strikes", value: c.LAST_INSERT_COUNT ?? "—" },
                        { label: "Runtime", value: c.LAST_RUNTIME_MS ? `${c.LAST_RUNTIME_MS}ms` : "—" },
                        { label: "Validation Time", value: c.LAST_VALIDATION_MS ? `${c.LAST_VALIDATION_MS}ms` : "—" },
                        { label: "Total", value: c.LAST_TOTAL_MS ? `${c.LAST_TOTAL_MS}ms` : "—" },
                        { label: "Status", value: c.lastStatus || "—", highlight: c.lastStatus === 'success' ? 'emerald' : c.lastStatus === 'error' ? 'amber' : undefined },
                    ]} copiedField={null} onCopy={() => {}} />

                    {/* BQ + BBOX inline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded border border-border/30 p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Database className="h-3 w-3 text-muted-foreground/50" />
                                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold">BigQuery</span>
                            </div>
                            <div className="space-y-1">
                                {[
                                    ["Dataset", c.bq_dataset],
                                    ["Strikes", c.bq_table_strikes],
                                    ["Towers", c.bq_table_towers],
                                    ["Sync Log", c.bq_table_sync_log],
                                    ["Prediction", c.bq_table_prediction],
                                    ["Enrichment", c.bq_table_enrichment],
                                ].filter(([, v]) => v).map(([label, value]) => (
                                    <div key={String(label)} className="flex items-center justify-between py-0.5">
                                        <span className="text-[10px] text-muted-foreground/60">{String(label)}</span>
                                        <span className="text-[10px] font-mono text-foreground/70 truncate ml-2">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded border border-border/30 p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <MapPin className="h-3 w-3 text-muted-foreground/50" />
                                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold">Auto-BBOX</span>
                            </div>
                            <div className="space-y-1">
                                {[
                                    ["Min Lat", c.BBOX_MIN_LAT],
                                    ["Max Lat", c.BBOX_MAX_LAT],
                                    ["Min Lon", c.BBOX_MIN_LON],
                                    ["Max Lon", c.BBOX_MAX_LON],
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="flex items-center justify-between py-0.5">
                                        <span className="text-[10px] text-muted-foreground/60">{String(label)}</span>
                                        <span className="text-[10px] font-mono text-foreground/70">{String(value ?? "—")}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </ServiceSection>

            {/* ── Validation (collapsible) ── */}
            <ServiceSection title="Validation" icon={<CheckCircle2 className="h-3.5 w-3.5" />} defaultOpen>
                <div className="space-y-4">
                    {/* Status banner */}
                    <div className={`flex items-center gap-2.5 rounded border py-2 px-3 ${
                        configStatus === 'validated' ? 'border-emerald-500/20 bg-emerald-500/5' :
                        configStatus === 'error' ? 'border-red-500/20 bg-red-500/5' :
                        'border-amber-500/20 bg-amber-500/5'
                    }`}>
                        {configStatus === 'validated'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            : configStatus === 'error'
                                ? <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                : <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        }
                        <span className="text-[11px] font-medium">{configStatus.replace(/_/g, ' ').toUpperCase()}</span>
                        {c.CONFIG_REASON && <span className="text-[10px] text-muted-foreground ml-1">— {c.CONFIG_REASON}</span>}
                        {c.CONFIG_ERROR && <span className="text-[10px] text-red-400 ml-1">— {c.CONFIG_ERROR}</span>}
                    </div>

                    {/* API Validation */}
                    <ServiceGrid items={[
                        { label: "API Status", value: c.API_STATUS || "—", highlight: c.API_STATUS === 'connected' ? 'emerald' : 'amber' },
                        { label: "API Error", value: c.API_ERROR || "—" },
                        { label: "Notifier Status", value: c.NOTIFIER_STATUS || "—", highlight: c.NOTIFIER_STATUS === 'connected' ? 'emerald' : 'amber' },
                        { label: "Notifier Error", value: c.NOTIFIER_ERROR || "—" },
                    ]} copiedField={null} onCopy={() => {}} />

                    {/* Column detection */}
                    {towerCols.length > 0 && (
                        <div className="rounded border border-border/30 p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <FileSpreadsheet className="h-3 w-3 text-muted-foreground/50" />
                                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold">Column Detection</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
                                {towerCols.map((col, i) => (
                                    <div key={i} className="flex items-center justify-between py-1 border-b border-border/20">
                                        <span className="text-[10px] text-muted-foreground/60">{col.role}</span>
                                        <span className="text-[10px] font-mono text-foreground/70">
                                            {col.header}
                                            <span className="text-muted-foreground/30 ml-1">(Col {col.letter})</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Excluded reasons */}
                    {excludedReasons.length > 0 && (
                        <div className="rounded border border-red-500/15 p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <XCircle className="h-3 w-3 text-red-400/50" />
                                <span className="text-[10px] text-red-400/60 uppercase tracking-wider font-semibold">
                                    Excluded ({c.TOWER_EXCLUDED} rows)
                                </span>
                            </div>
                            <div className="space-y-0">
                                {excludedReasons.map((r, i) => (
                                    <ExcludedRow key={i} reason={r.reason} count={r.count} towers={r.towers} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ServiceSection>
        </div>
    );
}
