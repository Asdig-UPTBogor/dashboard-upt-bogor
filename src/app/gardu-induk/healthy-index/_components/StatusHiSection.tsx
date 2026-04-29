/**
 * StatusHiSection — collapsible stacked horizontal bar: Status HI per MTU type.
 *
 * Design System v2:
 *  • Colors: ECHART_COLORS[theme] — theme-aware for canvas
 *  • Transitions: ds-transition
 */
"use client";

import { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import { COLORS, STATUS_HI_ORDER, STATUS_HI_LABEL, CHART, ECHART_COLORS, ECHART_FONT, getTooltipPreset } from "./design-tokens";
import type { HiStats } from "./useHealthyIndexData";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
    stats: HiStats;
}

function StatusHiSectionInner({ stats }: Props) {
    const { resolvedTheme } = useTheme();
    const theme = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";
    const ec = ECHART_COLORS[theme];
    const { filters, toggle } = useCrossFilter();
    const [open, setOpen] = useState(true);

    /* ── Stacked horizontal bar per MTU ── */
    const barOption = useMemo(() => {
        const mtuNames = Object.keys(stats.perMtu).sort(
            (a, b) => (stats.perMtu[b].total || 0) - (stats.perMtu[a].total || 0),
        );
        if (mtuNames.length === 0) return null;

        const series = STATUS_HI_ORDER.map((status) => ({
            name: STATUS_HI_LABEL[status] ?? status,
            type: "bar" as const,
            stack: "total",
            barMaxWidth: CHART.bar.barMaxWidth,
            emphasis: { focus: "series" as const },
            data: mtuNames.map((mtu) => {
                const count = stats.perMtu[mtu]?.[status] || 0;
                const dimByStatus = !!(filters.statusHi && filters.statusHi !== status);
                const dimByMtu = !!(filters.mtu && filters.mtu !== mtu);
                const opacity = dimByStatus || dimByMtu ? COLORS.dimOpacity : 1;
                return { value: count, itemStyle: { color: COLORS.statusHi[status], opacity } };
            }),
        }));

        const chartHeight = Math.max(180, mtuNames.length * (CHART.bar.rowHeight ?? 30) + 60);

        return {
            option: {
                backgroundColor: "transparent",
                tooltip: {
                    ...getTooltipPreset(theme),
                    trigger: "axis" as const,
                    axisPointer: { type: "shadow" as const },
                },
                legend: {
                    show: true,
                    bottom: 0,
                    textStyle: { color: ec.textMuted, fontSize: ECHART_FONT.label },
                    itemWidth: 10,
                    itemHeight: 10,
                    itemGap: 12,
                },
                grid: { left: 65, right: 16, top: 8, bottom: 36 },
                xAxis: {
                    type: "value" as const,
                    axisLabel: { color: ec.textMuted, fontSize: ECHART_FONT.label },
                    splitLine: { lineStyle: { color: ec.gridLine } },
                },
                yAxis: {
                    type: "category" as const,
                    data: mtuNames,
                    axisLabel: { color: ec.text, fontSize: ECHART_FONT.label, fontWeight: ECHART_FONT.weight.bold },
                    axisTick: { show: false },
                    axisLine: { show: false },
                },
                series,
                animationType: CHART.animation.type,
                animationDuration: CHART.animation.duration,
            },
            height: chartHeight,
        };
    }, [stats.perMtu, filters.statusHi, filters.mtu, theme, ec]);

    const onBarClick = (params: { name?: string }) => {
        if (params.name) toggle("mtu", params.name);
    };

    return (
        <Card className="border-border py-0 gap-0">
            <CardHeader
                className="cursor-pointer select-none px-3 py-2"
                onClick={() => setOpen((prev) => !prev)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle>Status HI per Jenis MTU</CardTitle>
                    <ChevronDown
                        className={`h-4 w-4 text-muted-foreground ds-transition ${
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
                        {barOption && (
                            <ReactECharts
                                option={barOption.option}
                                style={{ height: barOption.height }}
                                onEvents={{ click: onBarClick }}
                                notMerge
                            />
                        )}
                    </CardContent>
                </div>
            </div>
        </Card>
    );
}

export const StatusHiSection = memo(StatusHiSectionInner);
