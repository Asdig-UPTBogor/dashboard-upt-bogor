/**
 * DonutPairSection — Two side-by-side donut charts.
 *
 * Design System v2:
 *  • Colors: ECHART_COLORS[theme] — theme-aware for canvas
 *  • Transitions: ds-transition
 */
"use client";

import { memo, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import {
    COLORS,
    PRIORITAS_ORDER,
    USIA_ORDER,
    CHART,
    ECHART_COLORS,
    ECHART_FONT,
    getTooltipPreset,
} from "./design-tokens";
import type { HiRow } from "./useHealthyIndexData";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
    filteredRows: HiRow[];
}

/**
 * Generic donut option builder — reused for both donuts.
 */
function buildDonutOption(
    data: { name: string; value: number; color: string }[],
    activeValue: string | null,
    theme: "dark" | "light",
) {
    const ec = ECHART_COLORS[theme];
    const total = data.reduce((s, d) => s + d.value, 0);

    return {
        backgroundColor: "transparent",
        tooltip: {
            ...getTooltipPreset(theme),
            trigger: "item" as const,
            formatter: (p: { name: string; value: number; percent: number }) =>
                `<b>${p.name}</b><br/>${p.value} unit (${p.percent.toFixed(1)}%)`,
        },
        series: [
            {
                type: "pie" as const,
                radius: [CHART.donut.innerRadius, CHART.donut.outerRadius],
                center: ["50%", "50%"],
                avoidLabelOverlap: true,
                itemStyle: { borderRadius: 4, borderColor: ec.cardBg, borderWidth: 1 },
                label: {
                    show: true,
                    position: "outside" as const,
                    color: ec.text,
                    fontSize: ECHART_FONT.label,
                    formatter: (p: { name: string; value: number }) =>
                        `{name|${p.name}}\n{val|${p.value}}`,
                    rich: {
                        name: { fontSize: ECHART_FONT.label, color: ec.textMuted, lineHeight: 14 },
                        val: { fontSize: ECHART_FONT.data, fontWeight: ECHART_FONT.weight.bold, color: ec.text, lineHeight: 18 },
                    },
                },
                emphasis: {
                    label: { show: true, fontSize: ECHART_FONT.tooltip, fontWeight: "bold" },
                    scaleSize: CHART.donut.emphasis.scaleSize,
                },
                data: data.map((d) => ({
                    name: d.name,
                    value: d.value,
                    itemStyle: {
                        color: d.color,
                        opacity: activeValue && activeValue !== d.name ? COLORS.dimOpacity : 1,
                    },
                })),
            },
        ],
        graphic: [
            {
                type: "text" as const,
                left: "center",
                top: "center",
                style: {
                    text: `${total}`,
                    fill: ec.textStrong,
                    fontSize: ECHART_FONT.kpi,
                    fontWeight: ECHART_FONT.weight.bold,
                    textAlign: "center" as const,
                },
            },
        ],
        animationType: CHART.animation.type,
        animationDuration: CHART.animation.duration,
    };
}

function DonutPairImpl({ filteredRows }: Props) {
    const { resolvedTheme } = useTheme();
    const theme = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";
    const { filters, toggle } = useCrossFilter();

    // Prioritas donut
    const prioritasOption = useMemo(() => {
        const counts: Record<string, number> = {};
        PRIORITAS_ORDER.forEach((p) => (counts[p] = 0));
        for (const row of filteredRows) {
            if (row.prioritas && counts[row.prioritas] !== undefined) {
                counts[row.prioritas]++;
            }
        }
        const data = PRIORITAS_ORDER.map((p) => ({
            name: p,
            value: counts[p] || 0,
            color: COLORS.prioritas[p] || COLORS.gridLine,
        }));
        return buildDonutOption(data, filters.prioritas, theme);
    }, [filteredRows, filters.prioritas, theme]);

    // Status Usia donut
    const usiaOption = useMemo(() => {
        const counts: Record<string, number> = {};
        USIA_ORDER.forEach((u) => (counts[u] = 0));
        for (const row of filteredRows) {
            if (row.statusUsia && counts[row.statusUsia] !== undefined) {
                counts[row.statusUsia]++;
            }
        }
        const data = USIA_ORDER.map((u) => ({
            name: u,
            value: counts[u] || 0,
            color: COLORS.statusUsia[u] || COLORS.gridLine,
        }));
        return buildDonutOption(data, filters.statusUsia, theme);
    }, [filteredRows, filters.statusUsia, theme]);

    return (
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {/* Prioritas */}
            <Card className="border-border py-0 gap-0">
                <CardHeader className="px-3 py-2 pb-0">
                    <CardTitle>Prioritas Penggantian</CardTitle>
                </CardHeader>
                <CardContent className="p-1 pt-0">
                    <ReactECharts
                        option={prioritasOption}
                        style={{ height: 240 }}
                        onEvents={{
                            click: (p: { name?: string }) => {
                                if (p.name) toggle("prioritas", p.name);
                            },
                        }}
                        notMerge
                    />
                </CardContent>
            </Card>

            {/* Status Usia */}
            <Card className="border-border py-0 gap-0">
                <CardHeader className="px-3 py-2 pb-0">
                    <CardTitle>Status Usia</CardTitle>
                </CardHeader>
                <CardContent className="p-1 pt-0">
                    <ReactECharts
                        option={usiaOption}
                        style={{ height: 240 }}
                        onEvents={{
                            click: (p: { name?: string }) => {
                                if (p.name) toggle("statusUsia", p.name);
                            },
                        }}
                        notMerge
                    />
                </CardContent>
            </Card>
        </div>
    );
}

export const DonutPairSection = memo(DonutPairImpl);
