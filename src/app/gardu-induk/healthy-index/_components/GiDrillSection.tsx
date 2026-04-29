/**
 * GiDrillSection — GI list.
 *
 * Design System v2:
 *  • Typography: ds-small, ds-label, ds-small, ds-data, ds-data
 *  • Colors: var(--ds-*) tokens — theme-aware
 *  • Transitions: ds-transition, ds-transition-fast
 */
"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiStats } from "./useHealthyIndexData";

interface Props {
    /** allStats: unfiltered — for ULTG buttons & perGiBay lookup */
    allStats: HiStats;
    /** stats: filtered by active filters — for GI list */
    stats: HiStats;
}

function giScore(s: Record<string, number>): number {
    const total = s.total || 1;
    return (
        (s["CRITICAL"] || 0) * 4 +
        (s["POOR"] || 0) * 3 +
        (s["FAIR"] || 0) * 2 +
        (s["GOOD"] || 0) * 1
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

// ── Section ───────────────────────────────────────────────────────────────────
function GiDrillSectionInner({ allStats, stats }: Props) {
    const { filters, toggle } = useCrossFilter();

    const selectedGi = filters.gi ?? null;

    // Gunakan allStats.perGi agar semua GI selalu tampil (stats sudah ter-filter, akan hide GI lain)
    // GI terpilih selalu naik ke posisi teratas
    const sortedGis = useMemo(() => {
        const entries = Object.entries(allStats.perGi).sort(([, a], [, b]) => healthPct(a) - healthPct(b));
        if (!selectedGi) return entries;
        const idx = entries.findIndex(([gi]) => gi === selectedGi);
        if (idx <= 0) return entries;
        const result = [...entries];
        const [picked] = result.splice(idx, 1);
        return [picked, ...result];
    }, [allStats.perGi, selectedGi]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 py-2 flex flex-row items-center justify-between select-none shrink-0 border-b" style={{ borderColor: "var(--ds-border-subtle)" }}>
                <span className="ds-small shrink-0">
                    Kondisi per GI
                </span>
                <div className="flex flex-row items-center gap-0">
                    {allStats.uniqueUltg.map((ultg) => {
                        const isActive = filters.ultg === ultg;
                        return (
                            <button
                                key={ultg}
                                onClick={() => toggle("ultg", ultg)}
                                className={cn(
                                    "flex items-center ds-small ds-transition-fast shrink-0 cursor-pointer",
                                    isActive ? "text-foreground" : "text-ds-text-tertiary hover:text-ds-text-secondary",
                                )}
                            >
                                <span className="mx-2 text-border/50">|</span>
                                {ultg}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* GI list */}
            <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1">
                {sortedGis.map(([gi, s]) => {
                    const hp         = healthPct(s);
                    const color      = scoreToColor(1 - hp / 100);
                    const isSelected = gi === selectedGi;

                    const bayCount = Object.keys(allStats.perGiBay?.[gi] ?? {}).length;

                    if (isSelected) {
                        // ── Expanded highlighted card ─────────────────────
                        return (
                            <div
                                key={gi}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggle("gi", gi)}
                                onKeyDown={(e) => e.key === "Enter" && toggle("gi", gi)}
                                className="my-1 rounded-md px-3 py-3 cursor-pointer select-none ds-transition-slow outline-none"
                                style={{
                                    background: `${color}18`,
                                    border: `1px solid ${color}45`,
                                    boxShadow: `0 0 0 1px ${color}15, 0 4px 16px ${color}10`,
                                }}
                            >
                                {/* Name row */}
                                <div className="flex items-start justify-between gap-2">
                                    <span className="ds-label text-ds-text-primary leading-tight flex-1">
                                        {gi}
                                    </span>
                                    <span
                                        className="ds-kpi text-2xl shrink-0"
                                        style={{ color }}
                                    >
                                        {hp}%
                                    </span>
                                </div>
                                {/* Bay count */}
                                <span className="ds-small mt-0.5 block" style={{ color: `${color}99` }}>
                                    {bayCount} bay
                                </span>
                                {/* Mini health bar */}
                                <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--ds-border-default)" }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${hp}%`, background: color }}
                                    />
                                </div>
                            </div>
                        );
                    }

                    // ── Compact row ───────────────────────────────────────
                    return (
                        <div
                            key={gi}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggle("gi", gi)}
                            onKeyDown={(e) => e.key === "Enter" && toggle("gi", gi)}
                            className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer select-none ds-transition hover:bg-ds-hover outline-none"
                        >
                            <span className="flex-1 ds-label text-ds-text-primary">
                                {gi}
                            </span>
                            <span className="ds-small shrink-0 tabular-nums">
                                {bayCount}b
                            </span>
                            <span
                                className="ds-data shrink-0 min-w-9 text-right"
                                style={{ color }}
                            >
                                {hp}%
                            </span>
                        </div>
                    );
                })}
            </div>

            <p className="ds-small text-ds-text-tertiary text-center pb-1 shrink-0">
                Klik GI untuk drill detail · terburuk di atas
            </p>
        </div>
    );
}

export const GiDrillSection = memo(GiDrillSectionInner);


