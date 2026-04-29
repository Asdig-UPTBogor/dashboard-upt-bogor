"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * StatusKpiBar1 — Shared component: KPI cards per status + Close/Open bar.
 *
 * Pattern: HI StatusHiBar — KPI tiles row + thick segmented bar with % inside.
 */

const MIN_BAR_PCT = 10;

interface StatusItem {
    key: string;
    label?: string;
    count: number;
    color: string;
}

interface StatusKpiBar1Props {
    title: string;
    items: StatusItem[];
    activeStatus: string | null;
    onStatusFilter: (val: string | null) => void;
    close: number;
    open: number;
    activeDone: boolean | null;
    onDoneFilter: (val: boolean | null) => void;
    closeColor?: string;
    openColor?: string;
    shadowColor?: string;
    unit?: string;
    barLabel?: string;
}

function StatusKpiBar1Inner({
    title,
    items,
    activeStatus,
    onStatusFilter,
    close,
    open,
    activeDone,
    onDoneFilter,
    closeColor = "#22C55E",
    openColor = "#EF4444",
    shadowColor = "rgba(0,0,0,0.4)",
    unit = "item",
    barLabel = "Close / Open",
}: StatusKpiBar1Props) {
    const anyStatusActive = !!activeStatus;
    const total = close + open;
    const closePct = total > 0 ? (close / total) * 100 : 0;
    const openPct = total > 0 ? (open / total) * 100 : 0;

    /* Min 10% bar width, normalized */
    const cRaw = close > 0 ? Math.max(closePct, MIN_BAR_PCT) : 0;
    const oRaw = open > 0 ? Math.max(openPct, MIN_BAR_PCT) : 0;
    const barSum = cRaw + oRaw;
    const cBar = barSum > 0 ? (cRaw / barSum) * 100 : 0;
    const oBar = barSum > 0 ? (oRaw / barSum) * 100 : 0;

    const toggleDone = (key: boolean) => onDoneFilter(activeDone === key ? null : key);

    return (
        <Card className="border-border py-0 gap-0 w-full">
            <CardContent className="px-3.5 pt-3 pb-3.5 flex flex-col gap-2.5">
                <p className="ds-title">{title}</p>

                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
                    {items.map((item) => {
                        const isActive = activeStatus === item.key;
                        return (
                            <button key={item.key} type="button"
                                onClick={() => onStatusFilter(activeStatus === item.key ? null : item.key)}
                                data-active={isActive || undefined}
                                data-dimmed={anyStatusActive && !isActive || undefined}
                                className="ds-kpi-btn"
                                style={isActive ? { backgroundColor: `${item.color}12`, boxShadow: `0 0 0 1.5px ${item.color}70, 0 6px 20px ${shadowColor}` } : undefined}>
                                <span className="flex items-baseline gap-1">
                                    <span className="ds-kpi" style={{ color: isActive ? item.color : "var(--foreground)" }}>
                                        {item.count.toLocaleString("id-ID")}
                                    </span>
                                    <span className="ds-small">{unit}</span>
                                </span>
                                <span className="ds-title" style={{ color: item.color, opacity: isActive ? 1 : 0.85 }}>{item.label ?? item.key}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-1">
                    <div className="ds-segmented-bar-lg">
                        {close > 0 && (
                            <button type="button" className="flex items-center justify-center"
                                data-active={activeDone === true || undefined}
                                style={{ width: `${cBar}%`, backgroundColor: closeColor, opacity: activeDone === true ? 1 : activeDone === false ? 0.3 : 0.82 }}
                                onClick={() => toggleDone(true)}
                                title={`Close: ${close.toLocaleString("id-ID")} (${closePct.toFixed(1)}%)`}>
                                <div className="ds-seg-shine" />
                                <span className="ds-overlay px-1 text-center whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                    {closePct.toFixed(1)}%
                                </span>
                            </button>
                        )}
                        {open > 0 && (
                            <button type="button" className="flex items-center justify-center"
                                data-active={activeDone === false || undefined}
                                style={{ width: `${oBar}%`, backgroundColor: openColor, opacity: activeDone === false ? 1 : activeDone === true ? 0.3 : 0.82 }}
                                onClick={() => toggleDone(false)}
                                title={`Open: ${open.toLocaleString("id-ID")} (${openPct.toFixed(1)}%)`}>
                                <div className="ds-seg-shine" />
                                <span className="ds-overlay px-1 text-center whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                    {openPct.toFixed(1)}%
                                </span>
                            </button>
                        )}
                    </div>
                    <div className="flex">
                        {close > 0 && (
                            <span className="ds-data text-center" style={{ width: `${cBar}%`, color: closeColor }}>
                                Close
                            </span>
                        )}
                        {open > 0 && (
                            <span className="ds-data text-center" style={{ width: `${oBar}%`, color: openColor }}>
                                Open
                            </span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export const StatusKpiBar1 = memo(StatusKpiBar1Inner);
