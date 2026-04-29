"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * SummaryCard1 — Shared component: Total hero number + breakdown items with mini bar.
 *
 * Shows a big total number at top, then N clickable breakdown items
 * each with label, count, progress bar, and percentage.
 * Min bar width = 10%.
 *
 * USAGE:
 *   <SummaryCard1
 *     title="Total CE Jaringan"
 *     total={10779}
 *     items={[
 *       { key: false, label: "Open", count: 10053, color: "#EF4444" },
 *       { key: true, label: "Close", count: 726, color: "#22C55E" },
 *     ]}
 *     activeKey={doneFilter}
 *     onFilter={setDoneFilter}
 *   />
 */

const MIN_BAR_PCT = 10;

interface SummaryItem {
    key: boolean | string;
    label: string;
    count: number;
    color: string;
}

interface SummaryCard1Props {
    title: string;
    total: number;
    items: SummaryItem[];
    activeKey: boolean | string | null;
    onFilter: (val: boolean | string | null) => void;
    shadowColor?: string;
    unit?: string;
    note?: string;
}

function SummaryCard1Inner({
    title,
    total,
    items,
    activeKey,
    onFilter,
    shadowColor = "rgba(0,0,0,0.4)",
    unit = "item",
    note,
}: SummaryCard1Props) {
    const anyActive = activeKey !== null;

    return (
        <Card className="border-border py-0 gap-0 w-full min-w-[240px]">
            <CardContent className="px-3 py-2.5 flex flex-col gap-0">
                {/* Hero total */}
                <div className="text-center mb-1.5">
                    <p className="flex items-baseline justify-center gap-1">
                        <span className="ds-kpi">{total.toLocaleString("id-ID")}</span>
                        <span className="ds-small">{unit}</span>
                    </p>
                    <p className="ds-title">{title}</p>
                </div>

                {/* Breakdown items */}
                <div className="flex flex-col gap-1">
                    {items.map(k => {
                        const pct = total > 0 ? (k.count / total) * 100 : 0;
                        const barWidth = Math.max(pct, MIN_BAR_PCT);
                        const isActive = activeKey === k.key;
                        return (
                            <button key={k.label} type="button"
                                onClick={() => onFilter(activeKey === k.key ? null : k.key)}
                                data-active={isActive || undefined}
                                data-dimmed={anyActive && !isActive || undefined}
                                className="ds-kpi-btn gap-1 px-3 py-2"
                                style={isActive ? { backgroundColor: `${k.color}15`, boxShadow: `0 0 0 1.5px ${k.color}60, 0 6px 20px ${shadowColor}` } : undefined}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="ds-data" style={{ color: k.color }}>{k.label}</span>
                                    <span className="flex items-baseline gap-1">
                                        <span className="ds-kpi text-xl" style={{ color: isActive ? k.color : "var(--foreground)" }}>
                                            {k.count.toLocaleString("id-ID")}
                                        </span>
                                        <span className="ds-small">{unit}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full ds-transition"
                                            style={{ width: `${barWidth}%`, backgroundColor: k.color, opacity: isActive ? 1 : 0.65 }} />
                                    </div>
                                    <span className="ds-small tabular-nums flex-none">{pct.toFixed(1)}%</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Optional note */}
                {note && (
                    <p className="ds-small text-muted-foreground/70 mt-2 pt-2 border-t border-border/50 italic">
                        {note}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export const SummaryCard1 = memo(SummaryCard1Inner);
