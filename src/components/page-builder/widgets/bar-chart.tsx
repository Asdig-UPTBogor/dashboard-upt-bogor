"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_COLORS, countBy } from "./shared";
import { useChartTheme } from "./use-chart-theme";
import { type LucideIcon } from "lucide-react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface BarChartWidgetProps {
    /** Title displayed in card header */
    title: string;
    /** Lucide icon for the header */
    icon?: LucideIcon;
    /** Row data array */
    data: Record<string, unknown>[];
    /** Column name for categories (X-axis) */
    column: string;
    /** Max number of bars to show (default: 15) */
    maxBars?: number;
    /** Chart height in pixels (default: 300) */
    height?: number;
    /** Optional label formatter for x-axis values */
    labelFormatter?: (label: string) => string;
    /** Badge text in header */
    badgeText?: string;
    /** Custom colors array (overrides default palette) */
    colors?: string[];
}

export function BarChartWidget({
    title,
    icon: Icon,
    data,
    column,
    maxBars = 15,
    height = 300,
    labelFormatter,
    badgeText,
    colors,
}: BarChartWidgetProps) {
    const theme = useChartTheme();

    const distribution = useMemo(
        () => countBy(data, column).slice(0, maxBars),
        [data, column, maxBars]
    );

    const palette = colors || CHART_COLORS;

    const option = useMemo(
        () => ({
            backgroundColor: "transparent",
            textStyle: { fontFamily: "inherit", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 12 },
            },
            grid: { top: 10, right: 16, bottom: 80, left: 48 },
            xAxis: {
                type: "category" as const,
                data: distribution.map(([name]) =>
                    labelFormatter ? labelFormatter(name) : name
                ),
                axisLabel: { fontSize: 8, color: theme.textMuted, rotate: 45, interval: 0 },
                axisLine: { lineStyle: { color: theme.gridLine } },
            },
            yAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: theme.textMuted },
                splitLine: {
                    lineStyle: { color: theme.gridLine, type: "dashed" as const },
                },
            },
            series: [
                {
                    type: "bar" as const,
                    data: distribution.map(([, value], i) => ({
                        value,
                        itemStyle: {
                            color: {
                                type: "linear" as const,
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                    { offset: 0, color: palette[i % palette.length] },
                                    { offset: 1, color: palette[(i + 3) % palette.length] },
                                ],
                            },
                            borderRadius: [4, 4, 0, 0],
                        },
                    })),
                    barMaxWidth: 30,
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 15,
                            shadowColor: "rgba(129,140,248,0.5)",
                        },
                    },
                },
            ],
            animationDuration: 1200,
            animationEasing: "elasticOut",
        }),
        [distribution, labelFormatter, palette, theme]
    );

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
                <ReactECharts option={option} style={{ height }} />
            </CardContent>
        </Card>
    );
}
