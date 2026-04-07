/**
 * StatusHiBar — full-width Status Healthy Index card.
 * Pinned at the very top of the page (outside sortable sections).
 *
 * Layout:
 *  • Thick segmented distribution bar (click to filter)
 *  • 5 columns — one per status — each: big number + label + % + individual bar
 *  • Active column: scale up + full opacity; others: dim + scale down (spotlight)
 */
"use client";

import { memo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiStats } from "./useHealthyIndexData";
import { COLORS, STATUS_HI_ORDER, STATUS_HI_LABEL } from "./design-tokens";

interface Props {
    stats: HiStats;
}

function StatusHiBarInner({ stats }: Props) {
    const { filters, toggle } = useCrossFilter();
    const [hoveredSeg, setHoveredSeg] = useState<string | null>(null);
    const [hoveredCol, setHoveredCol] = useState<string | null>(null);

    const total = stats.total;
    const active = filters.statusHi;
    const anyActive = active != null && active !== "";

    const items = STATUS_HI_ORDER.map((s) => ({
        key: s,
        color: COLORS.statusHi[s],
        count: Object.values(stats.perUltg).reduce((sum, u) => sum + (u.perStatus[s] || 0), 0),
        pct: total > 0
            ? (Object.values(stats.perUltg).reduce((sum, u) => sum + (u.perStatus[s] || 0), 0) / total) * 100
            : 0,
    }));

    return (
        <Card className="border-border/30 py-0 gap-0">
            <CardContent className="px-4 pt-3 pb-4 flex flex-col gap-3">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Status Healthy Index
                    </p>
                    <p className="text-xs font-medium text-muted-foreground/70 tabular-nums">
                        {total.toLocaleString("id-ID")} unit
                    </p>
                </div>

                {/* ── Critical Ratio : segmented bar with inline pct ── */}
                <div className="flex items-center gap-3">
                    {/* label kiri */}
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 flex-none whitespace-nowrap">
                        Critical Ratio
                    </span>
                    {/* bar */}
                    <div
                        className="flex gap-0.5 h-9 rounded-md overflow-hidden flex-1"
                        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}
                    >
                        {[...items].reverse().map((item) => {
                            if (item.pct === 0) return null;
                            const isActive = active === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    className="h-full flex-none cursor-pointer relative flex items-center justify-center overflow-hidden"
                                    style={{
                                        width: `${item.pct}%`,
                                        backgroundColor: item.color,
                                        opacity: isActive ? 1 : anyActive ? 0.3 : 0.82,
                                        filter: isActive
                                            ? `brightness(1.2) drop-shadow(0 0 6px ${item.color})`
                                            : hoveredSeg === item.key
                                            ? `brightness(1.25)`
                                            : "none",
                                        boxShadow: isActive
                                            ? `inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)`
                                            : `inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.15)`,
                                        transition: "filter 150ms ease, opacity 300ms ease",
                                    }}
                                    onMouseEnter={() => setHoveredSeg(item.key)}
                                    onMouseLeave={() => setHoveredSeg(null)}
                                    onClick={() => toggle("statusHi", item.key)}
                                    title={`${item.key}: ${item.count.toLocaleString("id-ID")} (${item.pct.toFixed(1)}%)`}
                                >
                                    {/* subtle shine */}
                                    <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent pointer-events-none" />
                                    <span className="text-xs font-bold tabular-nums text-white leading-none select-none px-1 text-center whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                        {item.pct.toFixed(1)}%
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── 5 columns ── */}
                <div className="grid grid-cols-5 gap-2">
                    {items.map((item) => {
                        const isActive = active === item.key;
                        const isHoveredCol = hoveredCol === item.key;
                        const colScale = isActive ? 1.04 : isHoveredCol ? 1.07 : anyActive ? 0.96 : 1;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => toggle("statusHi", item.key)}
                                onMouseEnter={() => setHoveredCol(item.key)}
                                onMouseLeave={() => setHoveredCol(null)}
                                className="flex flex-col gap-2 rounded-md px-3 py-3 text-left relative overflow-hidden"
                                style={{
                                    backgroundColor: isActive ? `${item.color}12` : isHoveredCol ? `${item.color}0a` : "transparent",
                                    transform: `scale(${colScale})`,
                                    opacity: anyActive && !isActive ? 0.5 : 1,
                                    boxShadow: isActive
                                        ? `0 0 0 1.5px ${item.color}70, 0 4px 16px rgba(0,0,0,0.3)`
                                        : isHoveredCol
                                        ? `0 0 0 1.5px rgba(255,255,255,0.3), 0 4px 14px rgba(0,0,0,0.3)`
                                        : "none",
                                    zIndex: isHoveredCol || isActive ? 20 : 1,
                                    position: "relative",
                                    transition: "transform 200ms ease-out, opacity 300ms ease-out, box-shadow 200ms ease-out, background-color 200ms ease",
                                }}
                            >
                                {/* top accent line */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-0.5 transition-opacity duration-300"
                                    style={{
                                        backgroundColor: item.color,
                                        opacity: isActive ? 1 : anyActive ? 0.4 : 0.6,
                                    }}
                                />

                                {/* big number */}
                                <span
                                    className="text-3xl font-bold tabular-nums leading-none mt-1"
                                    style={{ color: isActive ? item.color : "hsl(var(--foreground))" }}
                                >
                                    {item.count.toLocaleString("id-ID")}
                                </span>

                                {/* label */}
                                <span
                                    className="text-xs font-semibold leading-tight"
                                    style={{ color: item.color, opacity: isActive ? 1 : 0.85 }}
                                >
                                    {STATUS_HI_LABEL[item.key] ?? item.key}
                                </span>

                                {/* pct + bar row */}
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${item.pct}%`,
                                                backgroundColor: item.color,
                                                opacity: isActive ? 1 : 0.65,
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground/70 tabular-nums flex-none">
                                        {item.pct.toFixed(1)}%
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

            </CardContent>
        </Card>
    );
}

export const StatusHiBar = memo(StatusHiBarInner);
