"use client";
import { useCallback } from "react";
import { COLORS, TEXT, CHART, ANIM } from "@/app/gardu-induk/program-kerja/_components/design-tokens";

/* ═══ TYPES ═══ */
export type DonutItem = {
    name: string;
    value: number;
    itemStyle: Record<string, unknown>;
};

/* ═══ DONUT FACTORY ═══ */
export function useMkDonut() {
    const D = CHART.donut;

    const mkDonut = useCallback((rawData: DonutItem[], selectedName?: string | null) => {
        const hasSelection = !!selectedName;

        const outerData = rawData.map(d => {
            const isSelected = selectedName === d.name;
            const isDimmed = hasSelection && !isSelected;
            return {
                ...d,
                itemStyle: {
                    ...d.itemStyle,
                    opacity: isDimmed ? 0.25 : 1,
                    ...(isSelected ? {
                        shadowBlur: 16,
                        shadowColor: "rgba(129,140,248,0.6)",
                        borderColor: "#818cf8",
                        borderWidth: 3,
                    } : {}),
                },
                label: { show: d.value > 0, opacity: isDimmed ? 0.4 : 1 },
                labelLine: { show: d.value > 0, lineStyle: { opacity: isDimmed ? 0.3 : 1 } },
                emphasis: { disabled: d.value === 0 },
            };
        });

        const innerData = rawData.map(d => {
            const isDimmed = hasSelection && selectedName !== d.name;
            return {
                name: d.name,
                value: d.value,
                itemStyle: { color: "transparent", borderColor: "transparent", borderWidth: 0 },
                label: { show: d.value > 0, opacity: isDimmed ? 0.3 : 1 },
                labelLine: { show: false },
            };
        });

        return {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "item" as const,
                backgroundColor: COLORS.tooltipBg,
                borderColor: COLORS.tooltipBorder,
                borderWidth: 1,
                textStyle: { color: "#d4d4d8", fontSize: TEXT.chartTooltip },
                confine: true,
                formatter: (p: { seriesIndex: number; name: string; value: number; percent: number }) =>
                    p.seriesIndex === 0 && p.value > 0
                        ? `<b>${p.name}</b><br/>Jumlah: <b>${p.value}</b> (${p.percent.toFixed(1)}%)`
                        : "",
            },
            series: [
                {
                    type: "pie" as const,
                    radius: [D.innerRadius, D.outerRadius],
                    center: D.center,
                    startAngle: D.startAngle,
                    padAngle: D.padAngle,
                    itemStyle: {
                        borderRadius: D.borderRadius,
                        borderColor: D.borderColor,
                        borderWidth: D.borderWidth,
                    },
                    minAngle: 20,
                    avoidLabelOverlap: true,
                    emphasis: {
                        focus: "none" as const,
                        scale: true,
                        scaleSize: 8,
                        label: { show: true, fontWeight: "bold" as const },
                    },
                    label: {
                        show: true,
                        color: "#d4d4d8",
                        formatter: (p: { name: string; value: number; percent: number }) =>
                            `${p.name} ${p.value} (${p.percent.toFixed(0)}%)`,
                        fontSize: D.labelFontSize,
                        lineHeight: 14,
                        alignTo: "edge" as const,
                        edgeDistance: 8,
                        overflow: "break" as const,
                    },
                    labelLine: {
                        show: true,
                        length: 10,
                        length2: 8,
                        smooth: D.labelLineSmooth,
                        lineStyle: { color: D.labelLineColor, width: 2 },
                    },
                    labelLayout: {
                        hideOverlap: false,
                        moveOverlap: "shiftY" as const,
                    },
                    data: outerData,
                    animationDuration: D.animDuration,
                    animationEasing: ANIM.chartEasing,
                    animationType: "scale" as const,
                    animationDurationUpdate: 400,
                    animationEasingUpdate: "cubicInOut" as const,
                },
                {
                    type: "pie" as const,
                    radius: [D.innerRadius, D.outerRadius],
                    center: D.center,
                    startAngle: D.startAngle,
                    padAngle: D.padAngle,
                    minAngle: 20,
                    silent: true,
                    z: 10,
                    itemStyle: { color: "transparent", borderColor: "transparent", borderWidth: 0 },
                    emphasis: { disabled: true },
                    label: {
                        show: true,
                        position: "inside" as const,
                        fontSize: 11,
                        color: "#ffffff",
                        fontWeight: "bold" as const,
                        textShadowColor: "rgba(0,0,0,0.7)",
                        textShadowBlur: 4,
                        formatter: (p: { value: number }) =>
                            p.value > 0 ? `${p.value}` : "",
                    },
                    labelLine: { show: false },
                    data: innerData,
                },
            ],
        };
    }, [D]);

    return { mkDonut, D };
}
