/**
 * GiBarSection — heatmap: Status HI × Gardu Induk.
 * Cell color = status HI color. Opacity = count density per column.
 * Sorted worst-first. Click cell → filter GI.
 */
"use client";

import { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import { useCrossFilter } from "./CrossFilterProvider";
import { COLORS, STATUS_HI_ORDER, CHART } from "./design-tokens";
import type { HiStats } from "./useHealthyIndexData";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
    stats: HiStats;
}

const STATUS_SHORT: Record<string, string> = {
    "VERY GOOD": "VG",
    GOOD: "GOOD",
    FAIR: "FAIR",
    POOR: "POOR",
    CRITICAL: "CRIT",
};

function GiBarSectionInner({ stats }: Props) {
    const theme = useChartTheme();
    const { filters, toggle } = useCrossFilter();
    const [open, setOpen] = useState(true);

    const chartOption = useMemo(() => {
        const entries = Object.entries(stats.perGi);
        if (entries.length === 0) return null;

        // Sort worst-first: highest % CRITICAL+POOR at top
        const sorted = [...entries].sort(([, a], [, b]) => {
            const badA = ((a["CRITICAL"] || 0) + (a["POOR"] || 0)) / (a.total || 1);
            const badB = ((b["CRITICAL"] || 0) + (b["POOR"] || 0)) / (b.total || 1);
            return badB - badA;
        });
        const giNames = sorted.map(([name]) => name);
        const xLabels = STATUS_HI_ORDER.map(s => STATUS_SHORT[s]);

        // Per-column max for opacity scaling
        const colMax: Record<string, number> = {};
        for (const status of STATUS_HI_ORDER) {
            colMax[status] = Math.max(1, ...giNames.map(gi => stats.perGi[gi]?.[status] || 0));
        }

        const selectedGi = filters.gi ?? null;

        const heatData = STATUS_HI_ORDER.flatMap((status, xIdx) =>
            giNames.map((gi, yIdx) => {
                const count = stats.perGi[gi]?.[status] || 0;
                const isGiDimmed = !!(selectedGi && selectedGi !== gi);
                const isStatusDimmed = !!(filters.statusHi && filters.statusHi !== status);
                const isDimmed = isGiDimmed || isStatusDimmed;
                const isSelectedRow = selectedGi === gi;

                // Opacity: 0.3 minimum when cell has data, scales to 1.0 at column max
                const baseOpacity = count === 0 ? 0 : 0.3 + 0.7 * (count / colMax[status]);
                const finalOpacity = isDimmed ? COLORS.dimOpacity : baseOpacity;

                return {
                    value: [xIdx, yIdx, count],
                    itemStyle: {
                        color: count === 0 ? "transparent" : COLORS.statusHi[status],
                        opacity: finalOpacity,
                        // Selected row: bright white border; others: subtle border
                        borderColor: isSelectedRow
                            ? "rgba(255,255,255,0.85)"
                            : count > 0 ? "rgba(0,0,0,0.15)" : "transparent",
                        borderWidth: isSelectedRow ? 2 : 1,
                        borderRadius: 3,
                    },
                };
            })
        );

        const ROW_H = 28;
        const chartHeight = Math.max(200, giNames.length * ROW_H + 52);

        return {
            option: {
                backgroundColor: "transparent",
                animation: true,
                animationDuration: 600,
                animationEasing: "cubicOut" as const,
                animationDurationUpdate: 500,
                animationEasingUpdate: "cubicInOut" as const,
                tooltip: {
                    trigger: "item" as const,
                    backgroundColor: theme.tooltipBg,
                    borderColor: "rgba(128,128,128,0.15)",
                    borderWidth: 1,
                    textStyle: { color: theme.tooltipText, fontSize: 11 },
                    confine: true,
                    formatter: (p: { value: [number, number, number] }) => {
                        const [xIdx, yIdx, count] = p.value;
                        const status = STATUS_HI_ORDER[xIdx];
                        const gi = giNames[yIdx];
                        if (!status || !gi) return "";
                        const total = stats.perGi[gi]?.total || 0;
                        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                        const mtuMap = stats.perGiMtu?.[gi]?.[status] ?? {};
                        const breakdown = Object.entries(mtuMap)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([mtu, c]) => `${c} ${mtu}`)
                            .join(" | ");
                        const color = COLORS.statusHi[status];
                        const detLine = breakdown
                            ? `<br/><span style="color:#94a3b8;font-size:10px">${breakdown}</span>`
                            : "";
                        return (
                            `<b>${gi}</b><br/>` +
                            `<span style="color:${color}">● ${status}</span>: <b>${count}</b> (${pct}%)` +
                            `${detLine}<br/>` +
                            `<span style="color:#64748b">Total GI: ${total} MTU</span>`
                        );
                    },
                },
                grid: { left: 178, right: 16, top: 8, bottom: 28 },
                xAxis: {
                    type: "category" as const,
                    data: xLabels,
                    position: "bottom" as const,
                    axisLabel: {
                        color: theme.textMuted,
                        fontSize: 9,
                        fontWeight: "bold" as const,
                        interval: 0,
                    },
                    axisTick: { show: false },
                    axisLine: { show: false },
                    splitArea: { show: false },
                },
                yAxis: {
                    type: "category" as const,
                    data: giNames,
                    axisLabel: {
                        fontSize: 10,
                        width: 168,
                        overflow: "truncate" as const,
                        // Rich text: highlight selected GI with arrow + bold white
                        formatter: (name: string) => {
                            if (selectedGi === name) {
                                return `{sel|▶ }{bold|${name}}`;
                            }
                            return `{normal|${name}}`;
                        },
                        rich: {
                            sel: {
                                color: "#818cf8",
                                fontSize: 10,
                            },
                            bold: {
                                color: "#ffffff",
                                fontWeight: "bold" as const,
                                fontSize: 10,
                            },
                            normal: {
                                color: theme.text,
                                fontSize: 10,
                            },
                        },
                    },
                    axisTick: { show: false },
                    axisLine: { show: false },
                    splitArea: { show: false },
                },
                visualMap: { show: false },
                series: [
                    {
                        type: "heatmap" as const,
                        data: heatData,
                        label: {
                            show: true,
                            overflow: "truncate" as const,
                            formatter: (p: { value: [number, number, number] }) => {
                                const [xIdx, yIdx, count] = p.value;
                                if (count === 0) return "";
                                const status = STATUS_HI_ORDER[xIdx];
                                const gi = giNames[yIdx];
                                const mtuMap = stats.perGiMtu?.[gi]?.[status] ?? {};
                                const sorted = Object.entries(mtuMap)
                                    .sort(([, a], [, b]) => (b as number) - (a as number));
                                const numTypes = sorted.length;
                                // Show more items when count is small; always show if ≤3 types
                                const maxShow = numTypes <= 3 ? numTypes : count <= 5 ? numTypes : 3;
                                const shown = sorted.slice(0, maxShow);
                                const hidden = numTypes - maxShow;
                                const parts = shown.map(([mtu, c]) => `${mtu}: ${c}`).join("  ");
                                const suffix = hidden > 0 ? `  {more|+${hidden}}` : "";
                                return parts
                                    ? `{tot|Total: ${count}}  {det|${parts}}${suffix}`
                                    : `{tot|Total: ${count}}`;
                            },
                            rich: {
                                tot: {
                                    color: "#ffffff",
                                    fontWeight: "bold" as const,
                                    fontSize: 11,
                                    textShadowColor: "rgba(0,0,0,0.8)",
                                    textShadowBlur: 3,
                                },
                                det: {
                                    color: "rgba(255,255,255,0.85)",
                                    fontSize: 10,
                                    textShadowColor: "rgba(0,0,0,0.6)",
                                    textShadowBlur: 2,
                                },
                                more: {
                                    color: "rgba(255,255,255,0.5)",
                                    fontSize: 9,
                                },
                            },
                        },
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 12,
                                shadowColor: "rgba(255,255,255,0.3)",
                            },
                        },
                    },
                ],
            },
            height: chartHeight,
        };
    }, [stats.perGi, stats.perGiMtu, filters.gi, filters.statusHi, theme]);

    const onCellClick = (params: { value?: [number, number, number] }) => {
        if (!params.value) return;
        const [, yIdx] = params.value;
        const sorted = [...Object.entries(stats.perGi)].sort(([, a], [, b]) => {
            const badA = ((a["CRITICAL"] || 0) + (a["POOR"] || 0)) / (a.total || 1);
            const badB = ((b["CRITICAL"] || 0) + (b["POOR"] || 0)) / (b.total || 1);
            return badB - badA;
        });
        const gi = sorted[yIdx]?.[0];
        if (gi) toggle("gi", gi);
    };

    return (
        <Card className="border-border rounded-lg py-0 gap-0">
            <CardHeader
                className="cursor-pointer select-none px-4 py-3"
                onClick={() => setOpen((prev) => !prev)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="ds-title">
                        Healthy Index per Gardu Induk
                    </CardTitle>
                    <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                            open ? "rotate-0" : "-rotate-90"
                        }`}
                    />
                </div>
            </CardHeader>
            <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <CardContent className="px-3 py-2 pt-0">
                        {chartOption && (
                            <ReactECharts
                                option={chartOption.option}
                                style={{ height: chartOption.height }}
                                onEvents={{ click: onCellClick }}
                                notMerge
                            />
                        )}
                    </CardContent>
                </div>
            </div>
        </Card>
    );
}

export const GiBarSection = memo(GiBarSectionInner);
