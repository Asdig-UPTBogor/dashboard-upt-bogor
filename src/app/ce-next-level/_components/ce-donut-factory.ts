"use client";
import { useCallback } from "react";
import { COLORS, TEXT, CHART, ANIM } from "@/app/gardu-induk/program-kerja/_components/design-tokens";

/* ═══ TYPES ═══ */
export type DonutItem = {
    name: string;
    value: number;
    itemStyle: Record<string, unknown>;
};

/* ═══ Word-wrap helper ═══ */
function wrapLabel(name: string, maxLen = 14): string {
    if (name.length <= maxLen) return name;
    const words = name.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
        if (cur && (cur.length + 1 + w.length) > maxLen) {
            lines.push(cur);
            cur = w;
        } else {
            cur = cur ? cur + " " + w : w;
        }
    }
    if (cur) lines.push(cur);
    // Max 2 lines
    if (lines.length > 2) return lines[0] + "\n" + lines.slice(1).join(" ").slice(0, maxLen - 1) + "…";
    return lines.join("\n");
}

/* ═══ DONUT FACTORY ═══
 *
 * Design:
 *   INSIDE donut  → value count (bold white)
 *   OUTSIDE label → Name (word-wrapped, bold) + Percentage below (muted, smaller)
 *   Labels auto-find space (hideOverlap + shiftY)
 */
export function useMkDonut() {
    const D = CHART.donut;

    const mkDonut = useCallback((rawData: DonutItem[]) => {
        const total = rawData.reduce((s, d) => s + d.value, 0);

        /* Outer series data — labels */
        const outerData = rawData.map(d => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            const show = d.value > 0 && pct >= 3;
            return {
                ...d,
                label: { show },
                labelLine: { show },
                emphasis: { disabled: d.value === 0 },
            };
        });

        /* Inner series data — value inside donut */
        const innerData = rawData.map(d => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            return {
                ...d,
                itemStyle: { ...d.itemStyle, color: "transparent", shadowBlur: 0 },
                emphasis: { disabled: true },
                label: { show: d.value > 0 && pct >= 8 },
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
                textStyle: { color: "#e4e4e7", fontSize: TEXT.chartTooltip },
                confine: true,
                formatter: (p: { name: string; value: number; percent: number }) =>
                    p.value > 0
                        ? `<b>${p.name}</b><br/>Jumlah: <b>${p.value}</b> (${p.percent.toFixed(1)}%)`
                        : "",
            },
            series: [
                /* ── Series 1: Outside labels (Name + % below) ── */
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
                    selectedMode: "single" as const,
                    selectedOffset: D.selectedOffset,
                    avoidLabelOverlap: true,
                    emphasis: {
                        scale: true,
                        scaleSize: 8,
                        itemStyle: { shadowBlur: 20, shadowColor: "rgba(129,140,248,0.4)" },
                    },
                    label: {
                        show: true,
                        color: "#d4d4d8",
                        alignTo: "labelLine" as const,
                        formatter: (p: { name: string; percent: number }) => {
                            const nm = wrapLabel(p.name, 14);
                            return `{nm|${nm}}\n{pct|${p.percent.toFixed(0)}%}`;
                        },
                        rich: {
                            nm: {
                                fontSize: D.labelFontSize,
                                fontWeight: "bold" as const,
                                color: "#e4e4e7",
                                lineHeight: 14,
                            },
                            pct: {
                                fontSize: D.labelFontSize - 1,
                                color: "#a1a1aa",
                                lineHeight: 13,
                            },
                        },
                    },
                    labelLine: {
                        show: true,
                        length: D.labelLineLength1,
                        length2: D.labelLineLength2,
                        smooth: D.labelLineSmooth,
                        lineStyle: { color: D.labelLineColor, width: D.labelLineWidth },
                    },
                    labelLayout: {
                        hideOverlap: true,
                        moveOverlap: "shiftY" as const,
                    },
                    data: outerData,
                    animationDuration: D.animDuration,
                    animationEasing: ANIM.chartEasing,
                    animationType: "scale" as const,
                    animationDurationUpdate: 400,
                    animationEasingUpdate: "cubicInOut" as const,
                },
                /* ── Series 2: Value count INSIDE donut ── */
                {
                    type: "pie" as const,
                    radius: [D.innerRadius, D.outerRadius],
                    center: D.center,
                    startAngle: D.startAngle,
                    padAngle: D.padAngle,
                    silent: true,
                    itemStyle: { color: "transparent", borderColor: "transparent" },
                    label: {
                        show: true,
                        position: "inside" as const,
                        fontSize: 13,
                        color: "#ffffff",
                        fontWeight: "bold" as const,
                        textShadowColor: "rgba(0,0,0,0.6)",
                        textShadowBlur: 4,
                        formatter: (p: { value: number; percent: number }) =>
                            p.percent >= 8 ? `${p.value}` : "",
                    },
                    labelLine: { show: false },
                    data: innerData,
                },
            ],
        };
    }, [D]);

    return { mkDonut, D };
}
