/**
 * MtuListSection — Section 2 of the 3-pane drill layout.
 *
 * - No GI selected → empty state
 * - GI selected    → list semua unit MTU di GI tersebut (terburuk di atas)
 * - Bay selected   → list semua unit MTU di Bay tersebut
 *
 * Klik row → panggil onSelectUnit(row) → Section 3 tampilkan detail
 */
"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCrossFilter } from "./CrossFilterProvider";
import { COLORS, STATUS_HI_LABEL } from "./design-tokens";
import type { HiRow } from "./useHealthyIndexData";

interface Props {
    filteredRows: HiRow[];
    selectedUnit: HiRow | null;
    onSelectUnit: (row: HiRow) => void;
}

// Unique identity check untuk highlight row aktif
function isSameUnit(a: HiRow, b: HiRow): boolean {
    return a.gi === b.gi && a.bay === b.bay && a.mtu === b.mtu && a.serialId === b.serialId;
}

function MtuListSectionInner({ filteredRows, selectedUnit, onSelectUnit }: Props) {
    const { filters, toggle } = useCrossFilter();
    const selectedGi  = filters.gi  ?? null;
    const selectedBay = filters.bay ?? null;

    // Sort: worst HI first
    const sortedRows = useMemo(
        () => [...filteredRows].sort((a, b) => a.nilaiHi - b.nilaiHi),
        [filteredRows],
    );

    // ── Empty state ───────────────────────────────────────────────────────────
    if (!selectedGi) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4 select-none">
                <div className="w-8 h-8 rounded-full border border-border/20 flex items-center justify-center mb-1">
                    <svg className="w-4 h-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <p className="text-[10px] text-white/25 text-center leading-relaxed">
                    Pilih Gardu Induk<br />untuk lihat daftar MTU
                </p>
            </div>
        );
    }

    // ── Header ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 shrink-0 border-b border-border/20 select-none">
                {/* Breadcrumb context */}
                <div className="flex items-center gap-1 text-[9px] min-w-0">
                    <button
                        onClick={() => toggle("gi", selectedGi)}
                        className="text-white/50 hover:text-white/80 transition-colors truncate max-w-28 outline-none"
                        title={selectedGi}
                    >
                        {selectedGi}
                    </button>
                    {selectedBay && (
                        <>
                            <svg className="w-2 h-2 text-white/20 shrink-0" fill="none" viewBox="0 0 8 12">
                                <path d="M1.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <button
                                onClick={() => toggle("bay", selectedBay)}
                                className="text-white/50 hover:text-white/80 transition-colors truncate max-w-28 outline-none"
                                title={selectedBay}
                            >
                                {selectedBay}
                            </button>
                        </>
                    )}
                </div>
                <p className="text-[9px] text-white/25 mt-0.5 tabular-nums">
                    {sortedRows.length} unit · terburuk di atas
                </p>
            </div>

            {/* MTU list ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {sortedRows.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[10px] text-white/25">
                        Tidak ada data
                    </div>
                ) : (
                    sortedRows.map((row, i) => {
                        const sColor = COLORS.statusHi[row.statusHi] ?? "#94a3b8";
                        const isSelected = !!selectedUnit && isSameUnit(selectedUnit, row);
                        const prioColor = row.prioritas === "P0" ? "#fb7185"
                                        : row.prioritas === "P1" ? "#fb923c"
                                        : row.prioritas === "P2" ? "#fbbf24"
                                        : null;

                        return (
                            <button
                                key={i}
                                onClick={() => onSelectUnit(row)}
                                className={cn(
                                    "w-full text-left px-3 py-2 border-b border-border/5 transition-colors outline-none",
                                    isSelected ? "bg-white/6" : "hover:bg-white/3",
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    {/* Status bar */}
                                    <div
                                        className="w-0.5 self-stretch rounded-full shrink-0"
                                        style={{ background: sColor, minHeight: 16 }}
                                    />

                                    {/* MTU type */}
                                    <span
                                        className="text-[10px] font-bold shrink-0 w-14 truncate"
                                        style={{ color: sColor }}
                                    >
                                        {row.mtu}
                                    </span>

                                    {/* Bay — hanya tampil kalau belum filter Bay */}
                                    {!selectedBay && (
                                        <span className="text-[9px] text-white/40 truncate flex-1 min-w-0 text-left">
                                            {row.bay}
                                        </span>
                                    )}

                                    {/* Ketika bay sudah dipilih: tampilkan merek saja */}
                                    {selectedBay && (
                                        <span className="text-[9px] text-white/45 truncate flex-1 min-w-0 text-left">
                                            {row.merek || "—"}
                                        </span>
                                    )}

                                    {/* Prioritas badge */}
                                    {prioColor && (
                                        <span
                                            className="text-[8px] font-bold shrink-0 tabular-nums"
                                            style={{ color: prioColor }}
                                        >
                                            {row.prioritas}
                                        </span>
                                    )}

                                    {/* HI score */}
                                    <span
                                        className="text-[11px] font-bold tabular-nums shrink-0 ml-auto"
                                        style={{ color: sColor }}
                                    >
                                        {row.nilaiHi.toFixed(1)}
                                    </span>
                                </div>

                                {/* Second line: tipe model */}
                                <div className="pl-4 mt-0.5">
                                    <span className="text-[8px] text-white/30 truncate block">
                                        {[row.tipe, row.serialId].filter(Boolean).join(" · ") || "—"}
                                    </span>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export const MtuListSection = memo(MtuListSectionInner);
