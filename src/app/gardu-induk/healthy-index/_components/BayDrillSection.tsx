/**
 * BayDrillSection — Level-2 drill: Bay breakdown per GI.
 *
 * Design System v2:
 *  • Typography: ds-small, ds-small, ds-label, ds-body, ds-data, ds-data, ds-small
 *  • Colors: var(--ds-*) tokens — theme-aware
 *  • Transitions: ds-transition-fast
 */
"use client";

import { memo, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCrossFilter } from "./CrossFilterProvider";
import { COLORS, STATUS_HI_LABEL } from "./design-tokens";
import type { HiStats, HiRow } from "./useHealthyIndexData";

interface Props {
    allStats: HiStats;
    allRows: HiRow[];
    stats: HiStats;
    filteredRows: HiRow[];
    onSelectUnit?: (row: HiRow) => void;
}

const STATUS_ORDER = ["CRITICAL", "POOR", "FAIR", "GOOD", "VERY GOOD"] as const;

// ── Unit Detail Panel — shown when a single cell (square) is clicked ─────────
function UnitDetailPanel({ row, onBack }: { row: HiRow; onBack: () => void }) {
    const sColor = COLORS.statusHi[row.statusHi] ?? "#94a3b8";
    const YEAR_NOW = new Date().getFullYear();
    const thnOps  = parseInt(row.tahunOperasi);
    const thnBuat = parseInt(row.tahunBuat);
    // Valid year range: 1950–current; anything else (row index, empty, garbage) → "—"
    const isValidYear = (y: number) => !isNaN(y) && y >= 1950 && y <= YEAR_NOW;
    const usia = isValidYear(thnOps)  ? `${YEAR_NOW - thnOps} tahun`
               : isValidYear(thnBuat) ? `${YEAR_NOW - thnBuat} tahun`
               : "—";
    const prioColor = row.prioritas === "P0" ? "#fb7185"
                    : row.prioritas === "P1" ? "#fb923c"
                    : row.prioritas === "P2" ? "#fbbf24"
                    : "var(--ds-text-tertiary)";

    const Field = ({ label, value, color }: { label: string; value: string; color?: string }) => (
        <div className="flex flex-col gap-0.5">
            <span className="ds-small">{label}</span>
            <span
                className="ds-label leading-tight"
                style={{ color: color ?? "var(--ds-text-primary)" }}
            >
                {value || "—"}
            </span>
        </div>
    );

    return (
        <>
            {/* Header */}
            <div className="flex items-center gap-2 px-2 py-2 border-b shrink-0" style={{ borderColor: "var(--ds-border-subtle)" }}>
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-ds-text-tertiary hover:text-ds-text-primary ds-transition-fast outline-none shrink-0 cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="ds-small">Kembali</span>
                </button>
                <div className="h-3 w-px shrink-0" style={{ background: "var(--ds-border-default)" }} />
                <span
                    className="ds-data px-1.5 py-0.5 rounded-sm shrink-0"
                    style={{ background: sColor + "20", color: sColor, border: `1px solid ${sColor}40` }}
                >
                    {STATUS_HI_LABEL[row.statusHi] ?? row.statusHi}
                </span>
                <span className="ds-data text-ds-text-primary truncate">{row.mtu}</span>
                {/* HI score badge */}
                <span
                    className="ml-auto ds-kpi text-base shrink-0"
                    style={{ color: sColor }}
                >
                    {row.nilaiHi.toFixed(1)}
                </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-4">
                {/* Location block */}
                <div
                    className="rounded-md p-3 flex flex-col gap-2.5"
                    style={{ background: sColor + "08", border: `1px solid ${sColor}20` }}
                >
                    <span className="ds-small" style={{ color: sColor }}>Lokasi</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                        <Field label="ULTG" value={row.ultg} />
                        <Field label="Gardu Induk" value={row.gi} />
                        <Field label="Bay" value={row.bay} />
                        <Field label="Tegangan / Phasa" value={[row.tegangan, row.phasa].filter(Boolean).join(" · ")} />
                    </div>
                </div>

                {/* Equipment block */}
                <div className="rounded-md p-3 flex flex-col gap-2.5" style={{ border: "1px solid var(--ds-border-subtle)" }}>
                    <span className="ds-small">Peralatan</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                        <Field label="Merek" value={row.merek} />
                        <Field label="Tipe / Model" value={row.tipe} />
                        <Field label="Serial ID" value={row.serialId} />
                        <Field label="Tahun Buat" value={row.tahunBuat} />
                        <Field label="Tahun Operasi" value={row.tahunOperasi} />
                        <Field label="Usia" value={usia} />
                        <Field label="Status Usia" value={row.statusUsia} />
                        <Field label="Prioritas" value={row.prioritas} color={prioColor} />
                    </div>
                </div>

                {/* Criticality */}
                {row.criticalityGi && (
                    <div className="rounded-md p-3 flex flex-col gap-1.5" style={{ border: "1px solid var(--ds-border-subtle)" }}>
                        <span className="ds-small">Kritikalitas GI</span>
                        <span className="ds-body">{row.criticalityGi}</span>
                    </div>
                )}

                {/* Justifikasi */}
                {row.justifikasi && (
                    <div className="rounded-md p-3 flex flex-col gap-1.5" style={{ border: "1px solid var(--ds-border-subtle)" }}>
                        <span className="ds-small">Justifikasi</span>
                        <p className="ds-body">{row.justifikasi}</p>
                    </div>
                )}

                {/* Rencana */}
                {row.rencana && (
                    <div className="rounded-md p-3 flex flex-col gap-1.5" style={{ background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.15)" }}>
                        <span className="ds-small text-yellow-400/50">Rencana Tindak Lanjut</span>
                        <p className="ds-body">{row.rencana}</p>
                    </div>
                )}
            </div>
        </>
    );
}

// ── Status Rows Panel — shown when no GI is selected ─────────────────────────
// Baris = kondisi HI (CRITICAL → VERY GOOD), kotak ke kanan dikelompokkan per MTU tipe
function MtuColumnsPanel({
    allStats, filteredRows, drill, setDrill, onSelectUnit,
}: {
    allStats: HiStats;
    filteredRows: HiRow[];
    drill: { status: string; mtu: string } | null;
    setDrill: (v: { status: string; mtu: string } | null) => void;
    onSelectUnit?: (row: HiRow) => void;
}) {
    const { filters, toggle, drillToGiBay } = useCrossFilter();
    const selectedStatus = filters.statusHi ?? null;
    const selectedMtu    = filters.mtu      ?? null;

    // Lookup: filteredRows grouped by statusHi → mtu → rows
    // Reacts to GI / Bay cross-filter so squares show only matching units
    const rowsByStatusMtu = useMemo(() => {
        const map: Record<string, Record<string, HiRow[]>> = {};
        for (const row of filteredRows) {
            if (!map[row.statusHi]) map[row.statusHi] = {};
            if (!map[row.statusHi][row.mtu]) map[row.statusHi][row.mtu] = [];
            map[row.statusHi][row.mtu].push(row);
        }
        return map;
    }, [filteredRows]);

    // Waffle: computed from filteredRows — reacts to GI / Bay filter
    const statusRows = useMemo(() =>
        STATUS_ORDER
            .map((status) => {
                const sColor = COLORS.statusHi[status];
                const mtuCountMap: Record<string, number> = {};
                for (const row of filteredRows) {
                    if (row.statusHi === status) {
                        mtuCountMap[row.mtu] = (mtuCountMap[row.mtu] || 0) + 1;
                    }
                }
                const mtuGroups = Object.entries(mtuCountMap)
                    .map(([mtu, count]) => ({ mtu, count }))
                    .filter((g) => g.count > 0)
                    .sort((a, b) => b.count - a.count);
                const total = mtuGroups.reduce((n, g) => n + g.count, 0);
                return { status, sColor, total, mtuGroups };
            })
            .filter((r) => r.total > 0),
    [filteredRows]);

    // Drill detail rows
    const drillRows = useMemo(() => {
        if (!drill) return [];
        return filteredRows.filter(
            (r) => r.statusHi === drill.status && r.mtu === drill.mtu,
        ).sort((a, b) => a.nilaiHi - b.nilaiHi);
    }, [drill, filteredRows]);


    // ── MTU-type detail panel ─────────────────────────────────────────────────
    if (drill) {
        const sColor = COLORS.statusHi[drill.status];
        const YEAR_NOW = new Date().getFullYear();

        // col widths (px) — used consistently in header + rows
        const W = { hi: 36, gi: 96, bay: 96, merek: 104, serial: 80, usia: 48, prio: 36 };

        return (
            <>
                {/* Detail header */}
                <div className="flex items-center gap-2 px-2 py-2 border-b shrink-0" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    <button
                        onClick={() => setDrill(null)}
                        className="flex items-center gap-1 text-ds-text-tertiary hover:text-ds-text-primary ds-transition-fast outline-none shrink-0 cursor-pointer"
                        aria-label="Kembali ke waffle chart"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span className="ds-small">Kembali</span>
                    </button>
                    <div className="h-3 w-px shrink-0" style={{ background: "var(--ds-border-default)" }} />
                    <span
                        className="ds-data px-1.5 py-0.5 rounded-sm shrink-0"
                        style={{ background: sColor + "20", color: sColor, border: `1px solid ${sColor}40` }}
                    >
                        {STATUS_HI_LABEL[drill.status] ?? drill.status}
                    </span>
                    <span className="ds-data text-ds-text-primary truncate">{drill.mtu}</span>
                    <span className="ds-small shrink-0 ml-auto">{drillRows.length} unit</span>
                </div>

                {/* Column headers */}
                <div className="flex items-center gap-2 px-2 py-1 border-b shrink-0 bg-card/80" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    <div style={{ width: W.hi }}  className="ds-small shrink-0">HI</div>
                    <div style={{ width: W.gi }}  className="ds-small shrink-0">GI</div>
                    <div style={{ width: W.bay }} className="ds-small shrink-0">Bay</div>
                    <div style={{ width: W.merek }} className="ds-small shrink-0">Merek / Tipe</div>
                    <div style={{ width: W.serial }} className="ds-small shrink-0">Serial</div>
                    <div style={{ width: W.usia }} className="ds-small shrink-0">Usia</div>
                    <div style={{ width: W.prio }} className="ds-small shrink-0">Prio</div>
                </div>

                {/* Data rows */}
                <div className="flex flex-col overflow-y-auto flex-1 min-h-0">
                    {drillRows.map((row, i) => {
                        const rowColor = COLORS.statusHi[row.statusHi] ?? sColor;
                        const thnOps  = parseInt(row.tahunOperasi);
                        const thnBuat = parseInt(row.tahunBuat);
                        const isValidYear = (y: number) => !isNaN(y) && y >= 1950 && y <= YEAR_NOW;
                        const usia    = isValidYear(thnOps)  ? `${YEAR_NOW - thnOps} th`
                                      : isValidYear(thnBuat) ? `${YEAR_NOW - thnBuat} th`
                                      : "—";
                        const prioColor = row.prioritas === "P0" ? "#fb7185"
                                        : row.prioritas === "P1" ? "#fb923c"
                                        : row.prioritas === "P2" ? "#fbbf24"
                                        : "var(--ds-text-tertiary)";
                        return (
                            <div
                                key={i}
                                className="flex items-center gap-2 px-2 py-1.5 border-b hover:bg-ds-hover ds-transition-fast"
                                style={{ borderColor: "var(--ds-border-subtle)" }}
                            >
                                {/* HI */}
                                <div className="ds-data shrink-0" style={{ width: W.hi, color: rowColor }}>
                                    {row.nilaiHi.toFixed(1)}
                                </div>
                                {/* GI */}
                                <button
                                    onClick={() => toggle("gi", row.gi)}
                                    className="ds-small text-ds-text-secondary hover:text-emerald-400 truncate text-left ds-transition-fast outline-none shrink-0 cursor-pointer"
                                    style={{ width: W.gi }}
                                    title={row.gi}
                                >
                                    {row.gi || "—"}
                                </button>
                                {/* Bay */}
                                <button
                                    onClick={() => toggle("bay", row.bay)}
                                    className="ds-small text-ds-text-tertiary hover:text-emerald-400 truncate text-left ds-transition-fast outline-none shrink-0 cursor-pointer"
                                    style={{ width: W.bay }}
                                    title={row.bay}
                                >
                                    {row.bay || "—"}
                                </button>
                                {/* Merek / Tipe */}
                                <div
                                    className="ds-small text-ds-text-tertiary truncate shrink-0"
                                    style={{ width: W.merek }}
                                    title={`${row.merek} / ${row.tipe}`}
                                >
                                    {row.merek || "—"}{row.tipe ? ` / ${row.tipe}` : ""}
                                </div>
                                {/* Serial */}
                                <div
                                    className="ds-data text-ds-text-tertiary truncate shrink-0"
                                    style={{ width: W.serial }}
                                    title={row.serialId}
                                >
                                    {row.serialId || "—"}
                                </div>
                                {/* Usia */}
                                <div
                                    className="ds-small text-ds-text-tertiary shrink-0"
                                    style={{ width: W.usia }}
                                    title={`Operasi: ${row.tahunOperasi || "?"} · Dibuat: ${row.tahunBuat || "?"}`}
                                >
                                    {usia}
                                </div>
                                {/* Prioritas */}
                                <div
                                    className="ds-data shrink-0"
                                    style={{ width: W.prio, color: prioColor }}
                                >
                                    {row.prioritas || "—"}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="ds-small text-center py-1 shrink-0">
                    Klik GI / Bay = drill filter · Terburuk di atas
                </p>
            </>
        );
    }

    // ── Waffle chart ──────────────────────────────────────────────────────────
    return (
        <>
            {/* Status blocks */}
            <div className="flex flex-col overflow-y-auto flex-1 py-2 gap-2 px-2">
                {statusRows.map(({ status, sColor, total, mtuGroups }) => {
                    const isStatusSel = selectedStatus === status;
                    const isStatusDim = !!(selectedStatus && !isStatusSel);
                    return (
                        <div
                            key={status}
                            className="rounded-md transition-opacity duration-200"
                            style={{
                                opacity: isStatusDim ? 0.15 : 1,
                                border: `1px solid ${sColor}22`,
                                background: sColor + "08",
                            }}
                        >
                            {/* Block header — status label + count */}
                            <button
                                onClick={() => toggle("statusHi", status)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 ds-transition-fast outline-none cursor-pointer",
                                    isStatusSel ? "opacity-100" : "opacity-70 hover:opacity-100",
                                )}
                                style={{ borderBottom: `1px solid ${sColor}18` }}
                                aria-label={`Filter kondisi ${STATUS_HI_LABEL[status] ?? status}`}
                            >
                                <span className="ds-data tracking-wide" style={{ color: sColor }}>
                                    {STATUS_HI_LABEL[status] ?? status}
                                </span>
                                <span className="ds-data opacity-60" style={{ color: sColor }}>
                                    {total} unit
                                </span>
                            </button>

                            {/* MTU rows — one shared grid per status block.
                                 max-content on col 1 = browser measures ALL labels → width = widest one.
                                 Each button spans all 4 columns via gridColumn 1/-1 then uses
                                 subgrid so its children inherit the shared track sizes. */}
                            <div
                                className="py-1"
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "max-content 1px 1fr max-content",
                                    rowGap: "1px",
                                }}
                            >
                                {mtuGroups.map(({ mtu, count }) => {
                                    const isMtuDim = !!(selectedMtu && selectedMtu !== mtu);
                                    const MAX_SQ = 48;
                                    const shown = Math.min(count, MAX_SQ);
                                    const overflow = count - shown;
                                    return (
                                        <button
                                            key={mtu}
                                            onClick={() => { toggle("mtu", mtu); setDrill({ status, mtu }); }}
                                            title={`${mtu}: ${count} unit · klik untuk filter & lihat detail`}
                                            className={cn(
                                                "py-1 ds-transition-fast outline-none hover:bg-ds-hover rounded-sm cursor-pointer",
                                                isMtuDim ? "opacity-20" : "",
                                            )}
                                            style={{
                                                gridColumn: "1 / -1",
                                                display: "grid",
                                                gridTemplateColumns: "subgrid",
                                                alignItems: "center",
                                            }}
                                        >
                                            {/* Col 1 — label (width = shared max-content across block) */}
                                            <span
                                                className="ds-data whitespace-nowrap text-right pr-2 pl-3"
                                                style={{ color: sColor }}
                                            >
                                                {mtu}
                                            </span>

                                            {/* Col 2 — divider */}
                                            <div className="self-stretch" style={{ background: sColor + "30" }} />

                                            {/* Col 3 — squares */}
                                            <div className="flex flex-wrap items-center gap-0.5 ml-2 pr-2 py-0.5 min-w-0">
                                                <TooltipProvider delayDuration={100}>
                                                {Array.from({ length: shown }).map((_, i) => {
                                                    const row = rowsByStatusMtu[status]?.[mtu]?.[i];
                                                    return (
                                                        <Tooltip key={i}>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    onClick={(e) => {
                                                                        if (!row) return;
                                                                        e.stopPropagation();
                                                                        drillToGiBay(row.gi, row.bay);
                                                                        toggle("mtu", row.mtu);
                                                                        onSelectUnit?.(row);
                                                                    }}
                                                                    className="w-5 h-5 rounded shrink-0 ds-transition-fast hover:scale-150 cursor-pointer"
                                                                    style={{
                                                                        background: sColor,
                                                                        outline: "2px solid transparent",
                                                                    }}
                                                                    onMouseEnter={e => { e.currentTarget.style.outline = `2px solid ${sColor}`; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.outline = `2px solid transparent`; }}
                                                                />
                                                            </TooltipTrigger>
                                                            {row && (
                                                                <TooltipContent
                                                                    side="top"
                                                                    sideOffset={6}
                                                                    className="p-0 border-0 bg-transparent shadow-none"
                                                                >
                                                                    <div
                                                                        className="flex flex-col gap-1 rounded-md px-3 py-2 ds-small"
                                                                        style={{
                                                                            background: "var(--ds-surface-overlay)",
                                                                            backdropFilter: "blur(12px)",
                                                                            border: `1px solid ${sColor}40`,
                                                                            boxShadow: `0 4px 20px var(--ds-shadow-heavy), 0 0 0 1px ${sColor}20`,
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-1.5">
                                                                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: sColor }} />
                                                                            <span className="font-semibold" style={{ color: sColor }}>
                                                                                {STATUS_HI_LABEL[status] ?? status}
                                                                            </span>
                                                                            <span className="ml-auto font-bold tabular-nums" style={{ color: sColor }}>
                                                                                {row.nilaiHi.toFixed(1)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="h-px w-full" style={{ background: `${sColor}25` }} />
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="ds-small text-ds-text-tertiary w-6 shrink-0">GI</span>
                                                                            <span className="text-ds-text-primary font-medium truncate max-w-40">{row.gi || "—"}</span>
                                                                        </div>
                                                                        {row.bay && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="ds-small text-ds-text-tertiary w-6 shrink-0">Bay</span>
                                                                                <span className="text-ds-text-secondary truncate max-w-40">{row.bay}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="h-px w-full mt-0.5" style={{ background: `${sColor}20` }} />
                                                                        <p className="ds-small text-ds-text-tertiary text-center">
                                                                            klik → filter GI · Bay · MTU
                                                                        </p>
                                                                    </div>
                                                                </TooltipContent>
                                                            )}
                                                        </Tooltip>
                                                    );
                                                })}
                                                </TooltipProvider>
                                                {overflow > 0 && (
                                                    <span
                                                        className="ds-data ml-1 opacity-60"
                                                        style={{ color: sColor }}
                                                    >
                                                        +{overflow}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Col 4 — count */}
                                            <span
                                                className="ds-data pr-3 opacity-60"
                                                style={{ color: sColor }}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="ds-small text-center pb-1 shrink-0">
                Tiap kotak = 1 MTU · Klik baris = filter tipe · Klik kotak = filter GI+Bay+MTU
            </p>
        </>
    );
}

// ── Section ───────────────────────────────────────────────────────────────────
function BayDrillSectionInner({ allStats, allRows, stats, filteredRows, onSelectUnit }: Props) {
    const [drill, setDrill] = useState<{ status: string; mtu: string } | null>(null);
    const { filters, toggle } = useCrossFilter();
    const selectedStatus = filters.statusHi ?? null;

    // Breadcrumb: GI → Bay → MTU type (drill)
    const crumbs = useMemo(() => {
        const out: { label: string; onClear: () => void }[] = [];
        if (filters.gi)  out.push({ label: filters.gi,  onClear: () => { toggle("gi", filters.gi!); setDrill(null); } });
        if (filters.bay) out.push({ label: filters.bay, onClear: () => { toggle("bay", filters.bay!); setDrill(null); } });
        if (drill)       out.push({ label: drill.mtu,   onClear: () => setDrill(null) });
        return out;
    }, [filters.gi, filters.bay, drill, toggle]);

    const statusPills = useMemo(() =>
        STATUS_ORDER
            .map((status) => {
                const sColor = COLORS.statusHi[status];
                const total = Object.values(allStats.perMtu).reduce(
                    (n, counts) => n + (counts[status] || 0), 0,
                );
                return { status, sColor, total };
            })
            .filter((r) => r.total > 0),
    [allStats.perMtu]);

    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 flex flex-row items-center gap-2 select-none shrink-0 border-b flex-wrap" style={{ borderColor: "var(--ds-border-subtle)" }}>
                <span className="ds-small shrink-0">
                    Per Tipe MTU
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {statusPills.map(({ status, sColor, total }) => {
                        const isActive = selectedStatus === status;
                        const isDimmed = !!(selectedStatus && !isActive);
                        return (
                            <button
                                key={status}
                                onClick={() => toggle("statusHi", status)}
                                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ds-data ds-transition-fast outline-none shrink-0 cursor-pointer"
                                style={{
                                    background: isActive ? sColor + "28" : sColor + "12",
                                    border: `1px solid ${sColor}${isActive ? "70" : "30"}`,
                                    color: sColor,
                                    boxShadow: isActive ? `0 0 0 1.5px ${sColor}40` : "none",
                                    opacity: isDimmed ? 0.4 : 1,
                                }}
                                aria-label={`Filter ${STATUS_HI_LABEL[status] ?? status}`}
                            >
                                {STATUS_HI_LABEL[status] ?? status}
                                <span className="opacity-60 tabular-nums">{total}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Breadcrumb — visible only when GI / Bay / drill is active */}
            {crumbs.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-1.5 border-b shrink-0 overflow-x-auto" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    {crumbs.map((crumb, i) => (
                        <div key={i} className="flex items-center gap-1 shrink-0">
                            {i > 0 && (
                                <svg className="w-2.5 h-2.5 text-ds-text-tertiary shrink-0" fill="none" viewBox="0 0 8 12">
                                    <path d="M1.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                            <button
                                onClick={crumb.onClear}
                                className="ds-small text-ds-text-tertiary hover:text-ds-text-primary ds-transition-fast truncate max-w-35 outline-none cursor-pointer"
                                title={`Klik untuk hapus filter: ${crumb.label}`}
                            >
                                {crumb.label}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="px-1.5 pb-2 pt-0 relative flex-1 min-h-0 flex flex-col">
                <MtuColumnsPanel
                    allStats={allStats}
                    filteredRows={filteredRows}
                    drill={drill}
                    setDrill={setDrill}
                    onSelectUnit={onSelectUnit}
                />
            </div>
        </div>
    );
}

export const BayDrillSection = memo(BayDrillSectionInner);
