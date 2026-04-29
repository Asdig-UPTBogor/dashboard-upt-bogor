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

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiStats } from "./useHealthyIndexData";
import { COLORS, STATUS_HI_ORDER, STATUS_HI_LABEL } from "./design-tokens";

interface Props {
    stats: HiStats;
}

function StatusHiBarInner({ stats }: Props) {
    const { filters, toggle } = useCrossFilter();
    const total = stats.total;
    const active = filters.statusHi;
    const anyActive = active != null && active !== "";

    const MIN_BAR_PCT = 10;

    const rawItems = STATUS_HI_ORDER.map((s) => {
        const count = Object.values(stats.perUltg).reduce((sum, u) => sum + (u.perStatus[s] || 0), 0);
        return {
            key: s,
            color: COLORS.statusHi[s],
            count,
            pct: total > 0 ? (count / total) * 100 : 0,
        };
    });

    // Enforce minimum visual width for bar segments (like donut minSlicePct)
    const nonZero = rawItems.filter(i => i.count > 0);
    const small = nonZero.filter(i => i.pct < MIN_BAR_PCT);
    const large = nonZero.filter(i => i.pct >= MIN_BAR_PCT);
    const reserved = small.length * MIN_BAR_PCT;
    const largeSum = large.reduce((s, i) => s + i.pct, 0);
    const scale = largeSum > 0 ? (100 - reserved) / largeSum : 1;

    const items = rawItems.map(item => ({
        ...item,
        barPct: item.count === 0 ? 0
            : item.pct < MIN_BAR_PCT ? MIN_BAR_PCT
            : item.pct * scale,
    }));

    return (
        <Card className="border-border py-0 gap-0 w-full">
            <CardContent className="px-5 pt-4 pb-5 flex flex-col gap-4">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <p className="ds-title">
                        Status Healthy Index
                    </p>
                </div>

                {/* ── 5 columns (cards at top) ── */}
                <div className="grid grid-cols-5 gap-3">
                    {items.map((item) => {
                        const isActive = active === item.key;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => toggle("statusHi", item.key)}
                                data-active={isActive || undefined}
                                data-dimmed={anyActive && !isActive || undefined}
                                className="ds-kpi-btn"
                                style={isActive ? {
                                    backgroundColor: `${item.color}12`,
                                    boxShadow: `0 0 0 1.5px ${item.color}70, 0 6px 20px rgba(0,0,0,0.4)`,
                                } : undefined}
                            >
                                {/* big number + unit */}
                                <span className="flex items-baseline gap-1 mt-1">
                                    <span
                                        className="ds-kpi"
                                        style={{ color: isActive ? item.color : "var(--foreground)" }}
                                    >
                                        {item.count.toLocaleString("id-ID")}
                                    </span>
                                    <span className="ds-small">unit</span>
                                </span>

                                {/* label */}
                                <span
                                    className="ds-title"
                                    style={{ color: item.color, opacity: isActive ? 1 : 0.85 }}
                                >
                                    {STATUS_HI_LABEL[item.key] ?? item.key}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Critical Ratio bar (below cards) ── */}
                <div className="flex items-center gap-3">
                    <span className="ds-body flex-none whitespace-nowrap">
                        Critical Ratio
                    </span>
                    <div className="ds-segmented-bar-lg flex-1">
                        {items.map((item) => {
                            if (item.count === 0) return null;
                            const isActive = active === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    className="flex items-center justify-center"
                                    data-active={isActive || undefined}
                                    style={{
                                        width: `${item.barPct}%`,
                                        backgroundColor: item.color,
                                        opacity: isActive ? 1 : anyActive ? 0.3 : 0.82,
                                    }}
                                    onClick={() => toggle("statusHi", item.key)}
                                    title={`${item.key}: ${item.count.toLocaleString("id-ID")} (${item.pct.toFixed(1)}%)`}
                                >
                                    <div className="ds-seg-shine" />
                                    <span className="ds-overlay px-1 text-center whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                        {item.pct.toFixed(1)}%
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}

export const StatusHiBar = memo(StatusHiBarInner);
