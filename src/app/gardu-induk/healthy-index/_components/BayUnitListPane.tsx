/**
 * BayUnitListPane — Flat list of MTU units for a selected Bay.
 *
 * Dipakai ketika filters.bay sudah aktif (user klik Bay atau MTU dari HierarchyMapPane).
 * Menerima `rows` yang sudah difilter (filteredRows dari hook), termasuk filter mtu kalau aktif.
 * Tiap baris klikabel → buka UnitDetailPane via onSelectUnit.
 */
"use client";

import { memo, useMemo } from "react";
import { COLORS } from "./design-tokens";
import type { HiRow } from "./useHealthyIndexData";

interface Props {
    rows: HiRow[];
    onSelectUnit?: (row: HiRow) => void;
}

const YEAR_NOW = new Date().getFullYear();

/* col widths (px) */
const W = { hi: 36, mtu: 44, gi: 88, bay: 88, merek: 102, serial: 76, usia: 44, prio: 32 };

function isValidYear(y: number) {
    return !isNaN(y) && y >= 1950 && y <= YEAR_NOW;
}

function BayUnitListPaneInner({ rows, onSelectUnit }: Props) {
    const sorted = useMemo(
        () => [...rows].sort((a, b) => a.nilaiHi - b.nilaiHi),
        [rows],
    );

    return (
        <div className="flex flex-col flex-1 min-h-0">

            {/* ── Column headers ── */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/15 shrink-0 bg-card/60">
                <div style={{ width: W.hi }}    className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">HI</div>
                <div style={{ width: W.mtu }}   className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">MTU</div>
                <div style={{ width: W.gi }}    className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">GI</div>
                <div style={{ width: W.bay }}   className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">Bay</div>
                <div style={{ width: W.merek }} className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">Merek / Tipe</div>
                <div style={{ width: W.serial }} className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">Serial</div>
                <div style={{ width: W.usia }}  className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">Usia</div>
                <div style={{ width: W.prio }}  className="text-[8px] text-white/25 font-medium tracking-wide shrink-0 uppercase">Prio</div>
            </div>

            {/* ── Data rows ── */}
            <div className="flex flex-col overflow-y-auto flex-1 min-h-0">
                {sorted.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground/30 select-none">
                        Tidak ada data
                    </div>
                ) : (
                    sorted.map((row, i) => {
                        const color = COLORS.statusHi[row.statusHi] ?? "#94a3b8";
                        const thnOps  = parseInt(row.tahunOperasi);
                        const thnBuat = parseInt(row.tahunBuat);
                        const usia = isValidYear(thnOps)  ? `${YEAR_NOW - thnOps} th`
                                   : isValidYear(thnBuat) ? `${YEAR_NOW - thnBuat} th`
                                   : "—";
                        const prioColor = row.prioritas === "P0" ? "#fb7185"
                                        : row.prioritas === "P1" ? "#fb923c"
                                        : row.prioritas === "P2" ? "#fbbf24"
                                        : "rgba(255,255,255,0.3)";

                        return (
                            <button
                                key={i}
                                onClick={() => onSelectUnit?.(row)}
                                className="flex items-center gap-2 px-2 py-1.5 border-b border-border/5 hover:bg-white/4 transition-colors text-left w-full outline-none"
                            >
                                {/* HI score */}
                                <div
                                    className="text-[10px] font-bold tabular-nums shrink-0"
                                    style={{ width: W.hi, color }}
                                >
                                    {row.nilaiHi.toFixed(1)}
                                </div>

                                {/* MTU type */}
                                <div
                                    className="text-[9px] font-semibold truncate shrink-0"
                                    style={{ width: W.mtu, color }}
                                >
                                    {row.mtu || "—"}
                                </div>

                                {/* GI */}
                                <div
                                    className="text-[9px] text-white/65 truncate shrink-0"
                                    style={{ width: W.gi }}
                                    title={row.gi}
                                >
                                    {row.gi || "—"}
                                </div>

                                {/* Bay */}
                                <div
                                    className="text-[9px] text-white/55 truncate shrink-0"
                                    style={{ width: W.bay }}
                                    title={row.bay}
                                >
                                    {row.bay || "—"}
                                </div>

                                {/* Merek / Tipe */}
                                <div
                                    className="text-[9px] text-white/45 truncate shrink-0"
                                    style={{ width: W.merek }}
                                    title={[row.merek, row.tipe].filter(Boolean).join(" / ")}
                                >
                                    {[row.merek, row.tipe].filter(Boolean).join(" / ") || "—"}
                                </div>

                                {/* Serial */}
                                <div
                                    className="text-[9px] text-white/35 truncate shrink-0"
                                    style={{ width: W.serial }}
                                >
                                    {row.serialId || "—"}
                                </div>

                                {/* Usia */}
                                <div
                                    className="text-[9px] text-white/35 tabular-nums shrink-0"
                                    style={{ width: W.usia }}
                                >
                                    {usia}
                                </div>

                                {/* Prioritas */}
                                <div
                                    className="text-[9px] font-bold shrink-0"
                                    style={{ width: W.prio, color: prioColor }}
                                >
                                    {row.prioritas || "—"}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Footer hint */}
            {sorted.length > 0 && (
                <p className="text-[8px] text-white/15 text-center py-1 shrink-0 select-none tabular-nums">
                    {sorted.length} unit · HI terendah di atas · klik baris = detail
                </p>
            )}
        </div>
    );
}

export const BayUnitListPane = memo(BayUnitListPaneInner);
