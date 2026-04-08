"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_COLORS, countBy } from "./shared";
import { useChartTheme } from "./use-chart-theme";
import { type LucideIcon } from "lucide-react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface HorizontalBarWidgetProps {
    /** Title displayed in card header */
    title: string;
    /** Lucide icon for the header */
    icon?: LucideIcon;
    /** Row data array */
    data: Record<string, unknown>[];
    /** Column name for categories (Y-axis labels) */
    column: string;
    /** Max number of bars to show (default: 8) */
    maxBars?: number;
    /** Chart height in pixels (default: 260) */
    height?: number;
    /** Left margin for labels in pixels (default: 120) */
    leftMargin?: number;
    /** Badge text in header */
    badgeText?: string;
}

export function HorizontalBarWidget({
    title,
    icon: Icon,
    data,
    column,
    maxBars = 8,
    height = 260,
    leftMargin = 120,
    badgeText,
}: HorizontalBarWidgetProps) {
    const theme = useChartTheme();

    const distribution = useMemo(
        () => countBy(data, column).slice(0, maxBars),
        [data, column, maxBars]
    );

    const option = useMemo(
        () => ({
            backgroundColor: "transparent",
            textStyle: { fontFamily: "inherit", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 11 },
            },
            grid: { top: 10, right: 24, bottom: 10, left: leftMargin },
            yAxis: {
                type: "category" as const,
                data: distribution.map(([name]) => name).reverse(),
                axisLabel: {
                    fontSize: 9,
                    color: theme.textMuted,
                    width: leftMargin - 10,
                    overflow: "truncate" as const,
                },
                axisLine: { show: false },
                axisTick: { show: false },
            },
            xAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: theme.textMuted },
                splitLine: {
                    lineStyle: { color: theme.gridLine, type: "dashed" as const },
                },
            },
            series: [
                {
                    type: "bar" as const,
                    data: distribution
                        .map(([, value], i) => ({
                            value,
                            itemStyle: {
                                color: CHART_COLORS[i % CHART_COLORS.length],
                                borderRadius: [0, 4, 4, 0],
                            },
                        }))
                        .reverse(),
                    barMaxWidth: 20,
                },
            ],
            animationDuration: 1000,
        }),
        [distribution, leftMargin, theme]
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
