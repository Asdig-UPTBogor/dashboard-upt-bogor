/**
 * BayUnitListPane — Flat list of MTU units for a selected Bay.
 *
 * Design System v2:
 *  • Typography: ds-small, ds-small, ds-data, ds-data
 *  • Colors: var(--ds-*) tokens — theme-aware
 *  • Transitions: ds-transition-fast
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
            <div className="flex items-center gap-2 px-2 py-1.5 border-b shrink-0 bg-card/60" style={{ borderColor: "var(--ds-border-subtle)" }}>
                <div style={{ width: W.hi }}    className="ds-small shrink-0">HI</div>
                <div style={{ width: W.mtu }}   className="ds-small shrink-0">MTU</div>
                <div style={{ width: W.gi }}    className="ds-small shrink-0">GI</div>
                <div style={{ width: W.bay }}   className="ds-small shrink-0">Bay</div>
                <div style={{ width: W.merek }} className="ds-small shrink-0">Merek / Tipe</div>
                <div style={{ width: W.serial }} className="ds-small shrink-0">Serial</div>
                <div style={{ width: W.usia }}  className="ds-small shrink-0">Usia</div>
                <div style={{ width: W.prio }}  className="ds-small shrink-0">Prio</div>
            </div>

            {/* ── Data rows ── */}
            <div className="flex flex-col overflow-y-auto flex-1 min-h-0">
                {sorted.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center ds-small text-ds-text-tertiary select-none">
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
                                        : "var(--ds-text-tertiary)";

                        return (
                            <button
                                key={i}
                                onClick={() => onSelectUnit?.(row)}
                                className="flex items-center gap-2 px-2 py-1.5 border-b hover:bg-ds-hover ds-transition-fast text-left w-full outline-none cursor-pointer"
                                style={{ borderColor: "var(--ds-border-subtle)" }}
                            >
                                {/* HI score */}
                                <div
                                    className="ds-data shrink-0"
                                    style={{ width: W.hi, color }}
                                >
                                    {row.nilaiHi.toFixed(1)}
                                </div>

                                {/* MTU type */}
                                <div
                                    className="ds-data truncate shrink-0"
                                    style={{ width: W.mtu, color }}
                                >
                                    {row.mtu || "—"}
                                </div>

                                {/* GI */}
                                <div
                                    className="ds-small text-ds-text-secondary truncate shrink-0"
                                    style={{ width: W.gi }}
                                    title={row.gi}
                                >
                                    {row.gi || "—"}
                                </div>

                                {/* Bay */}
                                <div
                                    className="ds-small text-ds-text-tertiary truncate shrink-0"
                                    style={{ width: W.bay }}
                                    title={row.bay}
                                >
                                    {row.bay || "—"}
                                </div>

                                {/* Merek / Tipe */}
                                <div
                                    className="ds-small text-ds-text-tertiary truncate shrink-0"
                                    style={{ width: W.merek }}
                                    title={[row.merek, row.tipe].filter(Boolean).join(" / ")}
                                >
                                    {[row.merek, row.tipe].filter(Boolean).join(" / ") || "—"}
                                </div>

                                {/* Serial */}
                                <div
                                    className="ds-data text-ds-text-tertiary truncate shrink-0"
                                    style={{ width: W.serial }}
                                >
                                    {row.serialId || "—"}
                                </div>

                                {/* Usia */}
                                <div
                                    className="ds-small text-ds-text-tertiary shrink-0"
                                    style={{ width: W.usia }}
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
                            </button>
                        );
                    })
                )}
            </div>

            {/* Footer hint */}
            {sorted.length > 0 && (
                <p className="ds-small text-center py-1 shrink-0 select-none tabular-nums">
                    {sorted.length} unit · HI terendah di atas · klik baris = detail
                </p>
            )}
        </div>
    );
}

export const BayUnitListPane = memo(BayUnitListPaneInner);
