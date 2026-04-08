/**
 * BayMtuSection — Section 2 of the 3-pane drill layout.
 *
 * Behaviour (mirip GI → Bay accordion):
 *  - Semua bay selalu tampil, diurutkan terburuk di atas
 *  - Tanpa filter GI → tampilkan bay dari SEMUA GI, dengan label GI kecil
 *  - Klik bay → highlight card + MTU list expand inline di bawahnya (accordion)
 *  - Bay lain tetap tampil, opacity sedikit redup
 *  - Klik unit MTU → onSelectUnit(row)
 */
"use client";

import { memo, useMemo } from "react";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiStats, HiRow } from "./useHealthyIndexData";

interface Props {
    allStats: HiStats;
    filteredRows: HiRow[];
    onSelectUnit: (row: HiRow) => void;
    onSelectMtuType: (type: string, rows: HiRow[]) => void;
    selectedMtuType: string | null;
}

// ── Health score helpers ──────────────────────────────────────────────────────
function giScore(s: Record<string, number>): number {
    const total = s.total || 1;
    return (
        (s["CRITICAL"] || 0) * 4 +
        (s["POOR"]     || 0) * 3 +
        (s["FAIR"]     || 0) * 2 +
        (s["GOOD"]     || 0) * 1
    ) / total;
}

function healthPct(s: Record<string, number>): number {
    return Math.round((1 - giScore(s) / 4) * 100);
}

function scoreToColor(t: number): string {
    const stops = [
        [0x34, 0xd3, 0x99],
        [0xfb, 0xbf, 0x24],
        [0xfb, 0x71, 0x85],
    ] as const;
    const clamped = Math.max(0, Math.min(1, t));
    const [a, b, frac] = clamped < 0.5
        ? [stops[0], stops[1], clamped * 2]
        : [stops[1], stops[2], (clamped - 0.5) * 2];
    const r  = Math.round(a[0] + (b[0] - a[0]) * frac);
    const g  = Math.round(a[1] + (b[1] - a[1]) * frac);
    const bl = Math.round(a[2] + (b[2] - a[2]) * frac);
    return `rgb(${r},${g},${bl})`;
}

// ── Component ─────────────────────────────────────────────────────────────────
function BayMtuSectionInner({ allStats, filteredRows, onSelectUnit, onSelectMtuType, selectedMtuType }: Props) {
    const { filters, toggle, drillToGiBay } = useCrossFilter();
    const gi  = filters.gi  ?? null;
    const bay = filters.bay ?? null;

    // Flat bay list — semua GI jika tidak ada GI terpilih, atau hanya GI terpilih
    // Bay terpilih selalu naik ke posisi teratas
    const allBays = useMemo(() => {
        const result: { bayName: string; giName: string; s: Record<string, number>; hp: number }[] = [];
        const perGiBay = allStats.perGiBay ?? {};
        const giKeys = gi ? [gi] : Object.keys(perGiBay);
        for (const giName of giKeys) {
            for (const [bayName, s] of Object.entries(perGiBay[giName] ?? {})) {
                result.push({
                    bayName,
                    giName,
                    s: s as Record<string, number>,
                    hp: healthPct(s as Record<string, number>),
                });
            }
        }
        result.sort((a, b) => a.hp - b.hp);
        if (bay) {
            const idx = result.findIndex((r) => r.bayName === bay);
            if (idx > 0) {
                const [picked] = result.splice(idx, 1);
                result.unshift(picked);
            }
        }
        return result;
    }, [gi, bay, allStats.perGiBay]);

    // MTU list for the selected bay (from filteredRows, already cross-filtered)
    const mtuList = useMemo(() => {
        if (!bay) return [];
        return [...filteredRows].sort((a, b) => a.nilaiHi - b.nilaiHi);
    }, [bay, filteredRows]);

    // Group MTU list by jenis (row.mtu = "CT", "LA", "TRAFO", ...)
    const mtuByType = useMemo(() => {
        const groups: Record<string, HiRow[]> = {};
        for (const row of mtuList) {
            if (!groups[row.mtu]) groups[row.mtu] = [];
            groups[row.mtu].push(row);
        }
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [mtuList]);

    const headerLabel = gi ? `Bay · ${gi}` : "Bay";

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 py-2 select-none shrink-0 border-b border-border/20 flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wide uppercase text-foreground/50 flex-1 truncate">
                    {headerLabel}
                </span>
                {bay && (
                    <span className="text-xs text-muted-foreground/40 shrink-0 tabular-nums">
                        {mtuList.length} unit
                    </span>
                )}
            </div>

            {/* Placeholder ketika tidak ada GI terpilih */}
            {!gi ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4 select-none">
                    <div className="w-7 h-7 rounded-full border border-border/20 flex items-center justify-center mb-1">
                        <svg className="w-3.5 h-3.5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                    <p className="text-xs text-white/25 leading-relaxed">
                        Pilih Gardu Induk<br />untuk lihat Bay
                    </p>
                </div>
            ) : (
                /* Bay list — accordion, hanya tampil setelah GI dipilih */
                <div className="flex-1 min-h-0 overflow-y-auto">
                {allBays.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4 select-none">
                        <p className="text-xs text-white/25 leading-relaxed">Belum ada data Bay</p>
                    </div>
                ) : allBays.map(({ bayName, giName, s, hp }) => {
                    const color      = scoreToColor(1 - hp / 100);
                    const isSelected = bayName === bay;
                    const isDimmed   = !!(bay && !isSelected);

                    return (
                        <div key={`${giName}:${bayName}`} style={{ opacity: isDimmed ? 0.45 : 1, transition: "opacity 0.2s" }}>
                            {/* Bay row */}
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => drillToGiBay(giName, bayName)}
                                onKeyDown={(e) => e.key === "Enter" && drillToGiBay(giName, bayName)}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none outline-none transition-all duration-200"
                                style={{
                                    borderLeft: `3px solid ${isSelected ? color : "transparent"}`,
                                    background:  isSelected ? `${color}15` : undefined,
                                }}
                            >
                                <div className="flex flex-col flex-1 min-w-0">
                                    <span className={`text-sm leading-tight transition-colors duration-200 ${isSelected ? "font-semibold text-white" : "text-foreground/85 hover:text-foreground"}`}>
                                        {bayName}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground/50 shrink-0 tabular-nums">
                                    {s.total ?? 0}
                                </span>
                                <span className="text-sm font-bold tabular-nums shrink-0 min-w-9 text-right" style={{ color }}>
                                    {hp}%
                                </span>
                            </div>

                            {/* MTU type list — accordion via CSS grid */}
                            <div
                                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                                style={{ gridTemplateRows: isSelected ? "1fr" : "0fr" }}
                            >
                                <div className="overflow-hidden py-1">
                                    {mtuByType.map(([type, rows]) => (
                                        <div
                                            key={type}
                                            role="button"
                                            tabIndex={isSelected ? 0 : -1}
                                            onClick={(e) => { e.stopPropagation(); onSelectMtuType(type, rows); }}
                                            onKeyDown={(e) => e.key === "Enter" && onSelectMtuType(type, rows)}
                                            className="flex items-center gap-2 pl-6 pr-3 py-1 cursor-pointer select-none outline-none hover:bg-white/5 transition-colors"
                                        >
                                            <span className="text-muted-foreground/40 text-xs shrink-0">└</span>
                                            <span className={`text-xs font-medium transition-colors ${selectedMtuType === type ? "text-white" : "text-foreground/70"}`}>
                                                {type}
                                            </span>
                                            <span className="text-xs text-muted-foreground/35 tabular-nums ml-auto">{rows.length}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
                </div>
            )}

            <p className="text-xs text-muted-foreground/25 text-center pb-1 shrink-0">
                {!gi ? "Pilih GI untuk lihat Bay" : bay ? "Klik jenis MTU untuk detail · klik bay lagi untuk deselect" : "Klik Bay untuk lihat MTU · terburuk di atas"}
            </p>
        </div>
    );
}

export const BayMtuSection = memo(BayMtuSectionInner);
