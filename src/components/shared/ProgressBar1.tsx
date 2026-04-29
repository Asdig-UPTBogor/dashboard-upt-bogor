"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * ProgressBar — Reusable Close/Open progress component.
 *
 * Thin segmented bar + KPI cards (Close, Open, Total).
 * Min bar width = 10%. Click to filter.
 *
 * USAGE:
 *   <ProgressBar
 *     title="Progress Jaringan"
 *     close={726}
 *     open={10053}
 *     activeFilter={doneFilter}
 *     onFilter={setDoneFilter}
 *   />
 */

const MIN_BAR_PCT = 10;

interface ProgressBarProps {
    title: string;
    close: number;
    open: number;
    activeFilter: boolean | null;
    onFilter: (val: boolean | null) => void;
    closeColor?: string;
    openColor?: string;
    shadowColor?: string;
}

function ProgressBarInner({
    title,
    close,
    open,
    activeFilter,
    onFilter,
    closeColor = "#22C55E",
    openColor = "#EF4444",
    shadowColor = "rgba(0,0,0,0.4)",
}: ProgressBarProps) {
    const total = close + open;
    const closePct = total > 0 ? (close / total) * 100 : 0;
    const openPct = total > 0 ? (open / total) * 100 : 0;

    /* Enforce min 10% visual width */
    const closeBarPct = close > 0 ? Math.max(closePct, MIN_BAR_PCT) : 0;
    const openBarPct = open > 0 ? Math.max(openPct, MIN_BAR_PCT) : 0;
    /* Normalize so they add up to 100 */
    const barTotal = closeBarPct + openBarPct;
    const closeBar = barTotal > 0 ? (closeBarPct / barTotal) * 100 : 0;
    const openBar = barTotal > 0 ? (openBarPct / barTotal) * 100 : 0;

    const toggle = (key: boolean) => onFilter(activeFilter === key ? null : key);

    const items = [
        { key: true as const, n: close, pct: closePct, label: "Close", color: closeColor },
        { key: false as const, n: open, pct: openPct, label: "Open", color: openColor },
    ];

    return (
        <Card className="border-border py-0 gap-0 w-full">
            <CardContent className="px-5 pt-3 pb-4 flex flex-col gap-3">
                <p className="ds-title">{title}</p>

                <div className="flex items-center gap-4">
                    {/* Thin segmented bar */}
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="ds-segmented-bar">
                            {close > 0 && (
                                <button type="button" className="flex items-center justify-center"
                                    data-active={activeFilter === true || undefined}
                                    style={{
                                        width: `${closeBar}%`,
                                        backgroundColor: closeColor,
                                        opacity: activeFilter === true ? 1 : activeFilter === false ? 0.3 : 0.82,
                                    }}
                                    onClick={() => toggle(true)}>
                                    <div className="ds-seg-shine" />
                                </button>
                            )}
                            {open > 0 && (
                                <button type="button" className="flex items-center justify-center"
                                    data-active={activeFilter === false || undefined}
                                    style={{
                                        width: `${openBar}%`,
                                        backgroundColor: openColor,
                                        opacity: activeFilter === false ? 1 : activeFilter === true ? 0.3 : 0.82,
                                    }}
                                    onClick={() => toggle(false)}>
                                    <div className="ds-seg-shine" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* KPI cards — compact */}
                    {items.map(k => {
                        const isActive = activeFilter === k.key;
                        const anyActive = activeFilter !== null;
                        return (
                            <button key={k.label} type="button"
                                onClick={() => toggle(k.key)}
                                data-active={isActive || undefined}
                                data-dimmed={anyActive && !isActive || undefined}
                                className="ds-kpi-btn gap-1 px-3 py-2"
                                style={isActive ? {
                                    backgroundColor: `${k.color}12`,
                                    boxShadow: `0 0 0 1.5px ${k.color}70, 0 6px 20px ${shadowColor}`,
                                } : undefined}>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="ds-kpi text-xl" style={{ color: isActive ? k.color : "var(--foreground)" }}>
                                        {k.n.toLocaleString("id-ID")}
                                    </span>
                                    <span className="ds-small tabular-nums">{k.pct.toFixed(1)}%</span>
                                </div>
                                <span className="ds-label" style={{ color: k.color, opacity: isActive ? 1 : 0.85 }}>
                                    {k.label}
                                </span>
                            </button>
                        );
                    })}
                    <div className="ds-kpi-btn gap-1 px-3 py-2 pointer-events-none">
                        <span className="ds-kpi text-xl">{total.toLocaleString("id-ID")}</span>
                        <span className="ds-small">Total</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export const ProgressBar1 = memo(ProgressBarInner);
