/**
 * MtuListSection — Section 2 of the 3-pane drill layout.
 *
 * Design System v2:
 *  • Typography: ds-small, ds-small, ds-data, ds-small
 *  • Colors: var(--ds-*) tokens — theme-aware
 *  • Transitions: ds-transition-fast
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
                <div className="w-8 h-8 rounded-full border flex items-center justify-center mb-1" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    <svg className="w-4 h-4 text-ds-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <p className="ds-small text-ds-text-tertiary text-center leading-relaxed">
                    Pilih Gardu Induk<br />untuk lihat daftar MTU
                </p>
            </div>
        );
    }

    // ── Header ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 shrink-0 border-b select-none" style={{ borderColor: "var(--ds-border-subtle)" }}>
                {/* Breadcrumb context */}
                <div className="flex items-center gap-1 ds-small min-w-0">
                    <button
                        onClick={() => toggle("gi", selectedGi)}
                        className="text-ds-text-tertiary hover:text-ds-text-primary ds-transition-fast truncate max-w-28 outline-none cursor-pointer"
                        title={selectedGi}
                    >
                        {selectedGi}
                    </button>
                    {selectedBay && (
                        <>
                            <svg className="w-2 h-2 text-ds-text-tertiary shrink-0" fill="none" viewBox="0 0 8 12">
                                <path d="M1.5 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <button
                                onClick={() => toggle("bay", selectedBay)}
                                className="text-ds-text-tertiary hover:text-ds-text-primary ds-transition-fast truncate max-w-28 outline-none cursor-pointer"
                                title={selectedBay}
                            >
                                {selectedBay}
                            </button>
                        </>
                    )}
                </div>
                <p className="ds-small text-ds-text-tertiary mt-0.5 tabular-nums">
                    {sortedRows.length} unit · terburuk di atas
                </p>
            </div>

            {/* MTU list ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {sortedRows.length === 0 ? (
                    <div className="flex items-center justify-center h-20 ds-small text-ds-text-tertiary">
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
                                    "w-full text-left px-3 py-2 border-b ds-transition-fast outline-none cursor-pointer",
                                    isSelected ? "bg-ds-hover" : "hover:bg-ds-hover",
                                )}
                                style={{ borderColor: "var(--ds-border-subtle)" }}
                            >
                                <div className="flex items-center gap-2">
                                    {/* Status bar */}
                                    <div
                                        className="w-0.5 self-stretch rounded-full shrink-0"
                                        style={{ background: sColor, minHeight: 16 }}
                                    />

                                    {/* MTU type */}
                                    <span
                                        className="ds-data shrink-0 w-14 truncate"
                                        style={{ color: sColor }}
                                    >
                                        {row.mtu}
                                    </span>

                                    {/* Bay — hanya tampil kalau belum filter Bay */}
                                    {!selectedBay && (
                                        <span className="ds-small text-ds-text-tertiary truncate flex-1 min-w-0 text-left">
                                            {row.bay}
                                        </span>
                                    )}

                                    {/* Ketika bay sudah dipilih: tampilkan merek saja */}
                                    {selectedBay && (
                                        <span className="ds-small text-ds-text-tertiary truncate flex-1 min-w-0 text-left">
                                            {row.merek || "—"}
                                        </span>
                                    )}

                                    {/* Prioritas badge */}
                                    {prioColor && (
                                        <span
                                            className="ds-data shrink-0"
                                            style={{ color: prioColor }}
                                        >
                                            {row.prioritas}
                                        </span>
                                    )}

                                    {/* HI score */}
                                    <span
                                        className="ds-data shrink-0 ml-auto"
                                        style={{ color: sColor }}
                                    >
                                        {row.nilaiHi.toFixed(1)}
                                    </span>
                                </div>

                                {/* Second line: tipe model */}
                                <div className="pl-4 mt-0.5">
                                    <span className="ds-small text-ds-text-tertiary truncate block">
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
