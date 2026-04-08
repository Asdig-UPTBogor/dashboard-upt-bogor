"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_COLORS, countBy } from "./shared";
import { useChartTheme } from "./use-chart-theme";
import { type LucideIcon } from "lucide-react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface DonutChartWidgetProps {
    /** Title displayed in card header */
    title: string;
    /** Lucide icon for the header */
    icon?: LucideIcon;
    /** Row data array */
    data: Record<string, unknown>[];
    /** Column name to group by (e.g. "Merk", "Status") */
    column: string;
    /** Max number of slices to show (default: 10) */
    maxSlices?: number;
    /** Chart height in pixels (default: 280) */
    height?: number;
    /** Custom color mapping { "Operasi": "#34d399", ... } */
    colorMap?: Record<string, string>;
    /** Show legend (default: true) */
    showLegend?: boolean;
    /** Enable click-to-filter (triggers onSliceClick) */
    clickable?: boolean;
    /** Called when user clicks a slice */
    onSliceClick?: (value: string) => void;
    /** Badge text in header (e.g. "Top 10 · Klik filter") */
    badgeText?: string;
}

export function DonutChartWidget({
    title,
    icon: Icon,
    data,
    column,
    maxSlices = 10,
    height = 280,
    colorMap,
    showLegend = true,
    clickable = false,
    onSliceClick,
    badgeText,
}: DonutChartWidgetProps) {
    const theme = useChartTheme();

    const distribution = useMemo(
        () => countBy(data, column).slice(0, maxSlices),
        [data, column, maxSlices]
    );

    const option = useMemo(
        () => ({
            backgroundColor: "transparent",
            textStyle: { fontFamily: "inherit", color: theme.textMuted },
            tooltip: {
                trigger: "item" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 12 },
                formatter: "{b}: {c} ({d}%)",
            },
            ...(showLegend
                ? {
                    legend: {
                        bottom: 0,
                        textStyle: { color: theme.textMuted, fontSize: 9 },
                        itemWidth: 8,
                        itemHeight: 8,
                        type: "scroll" as const,
                    },
                }
                : {}),
            series: [
                {
                    type: "pie" as const,
                    radius: ["35%", "65%"],
                    center: ["50%", showLegend ? "42%" : "50%"],
                    padAngle: 2,
                    itemStyle: { borderRadius: 5 },
                    label: { show: !showLegend, color: theme.textMuted, fontSize: 10, formatter: "{b}\n{c}" },
                    emphasis: {
                        label: { show: true, fontSize: 12, fontWeight: "bold" as const, color: theme.emphasisText },
                        scaleSize: 5,
                    },
                    data: distribution.map(([name, value], i) => ({
                        name,
                        value,
                        itemStyle: {
                            color: colorMap?.[name] || CHART_COLORS[i % CHART_COLORS.length],
                        },
                    })),
                },
            ],
            animationType: "scale",
            animationDuration: 1000,
        }),
        [distribution, colorMap, showLegend, theme]
    );

    const handleClick = useMemo(() => {
        if (!clickable || !onSliceClick) return undefined;
        return { click: (params: { name?: string }) => params.name && onSliceClick(params.name) };
    }, [clickable, onSliceClick]);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4 text-primary" />}
                    {title}
                    {badgeText && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {badgeText}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ReactECharts
                    option={option}
                    style={{ height }}
                    onEvents={handleClick}
                />
            </CardContent>
        </Card>
    );
}
