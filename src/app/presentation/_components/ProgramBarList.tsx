"use client";

import type { ProgramItem } from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";

interface Props {
    items: ProgramItem[];
    accent: string;
    /** Narrow mode (split 2 col) → label & bar lebih kecil */
    narrow?: boolean;
}

/**
 * Pure CSS bar list — bukan ECharts canvas.
 * Setiap row: nama (kiri) · bar track + fill (tengah) · % (kanan).
 * Konsisten saat di-screenshot / di-print, ga ada canvas blur.
 */
export function ProgramBarList({ items, accent, narrow = false }: Props) {
    return (
        <div className={narrow ? "barlist barlist-narrow" : "barlist"}>
            {items.map((it, i) => {
                const p = it.totalTarget === 0 ? 0 : (it.totalRealisasi / it.totalTarget) * 100;
                const empty = it.totalTarget === 0;
                return (
                    <div className="bar-row" key={`${it.no}-${i}`}>
                        <div className="bar-label" title={it.namaProgram}>
                            {it.namaProgram}
                        </div>
                        <div className="bar-track">
                            {!empty && (
                                <div
                                    className="bar-fill"
                                    style={{
                                        width: `${Math.max(2, Math.min(100, p))}%`,
                                        background: accent,
                                    }}
                                />
                            )}
                        </div>
                        <div className="bar-pct" style={{ color: empty ? "var(--deck-fg-3)" : accent }}>
                            {empty ? "—" : `${p.toFixed(1)}%`}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
