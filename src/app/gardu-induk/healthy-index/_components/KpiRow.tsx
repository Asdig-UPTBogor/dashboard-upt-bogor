/**
 * KpiRow — ULTG breakdown card.
 * Sits beside StatusHiBar. Shows per-ULTG totals with
 * proportional bars, click = cross-filter by ULTG.
 */
"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiStats } from "./useHealthyIndexData";
import { COLORS } from "./design-tokens";

const ULTG_COLORS = [COLORS.teal, COLORS.purple] as const;

interface Props {
    stats: HiStats;
}

function KpiRowInner({ stats }: Props) {
    const { filters, toggle } = useCrossFilter();
    const active = filters.ultg;
    const anyActive = active != null && active !== "";

    const ultgEntries = Object.entries(stats.perUltg)
        .sort(([, a], [, b]) => b.total - a.total);

    const total = stats.total;

    return (
        <Card className="border-border py-0 gap-0 w-full">
            <CardContent className="px-4 py-3 flex flex-col gap-0">

                {/* Total hero — top */}
                <div className="text-center mb-2">
                    <p className="ds-kpi">{total.toLocaleString("id-ID")}</p>
                    <p className="ds-small">Total Unit MTU</p>
                </div>

                {/* ULTG items */}
                <div className="flex flex-col gap-1">
                    {ultgEntries.map(([name, data], i) => {
                        const pct = total > 0 ? (data.total / total) * 100 : 0;
                        const color = ULTG_COLORS[i] ?? ULTG_COLORS[0];
                        const isActive = active === name;

                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => toggle("ultg", name)}
                                data-active={isActive || undefined}
                                data-dimmed={anyActive && !isActive || undefined}
                                className="ds-kpi-btn gap-1 px-3 py-2"
                                style={isActive ? {
                                    backgroundColor: `${color}15`,
                                    boxShadow: `0 0 0 1.5px ${color}60, 0 6px 20px rgba(0,0,0,0.4)`,
                                } : undefined}
                            >
                                {/* name + count */}
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="ds-label" style={{ color }}>
                                        {name}
                                    </span>
                                    <span className="flex items-baseline gap-1">
                                        <span
                                            className="ds-kpi text-xl"
                                            style={{ color: isActive ? color : "var(--foreground)" }}
                                        >
                                            {data.total.toLocaleString("id-ID")}
                                        </span>
                                        <span className="ds-small">unit</span>
                                    </span>
                                </div>

                                {/* bar + pct */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full ds-transition"
                                            style={{
                                                width: `${pct}%`,
                                                backgroundColor: color,
                                                opacity: isActive ? 1 : 0.65,
                                            }}
                                        />
                                    </div>
                                    <span className="ds-small tabular-nums flex-none">
                                        {pct.toFixed(1)}%
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

export const KpiRow = memo(KpiRowInner);
