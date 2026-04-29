"use client";
import { useCallback, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
    ECHART_COLORS,
    ECHART_FONT,
    CHART,
    getTooltipPreset,
} from "@/lib/chart-tokens";

/* ═══ TYPES ═══ */
export type DonutItem = {
    name: string;
    value: number;
    itemStyle: Record<string, unknown>;
};

/* ═══ enforceMinSlice ═══ */
function enforceMinSlice(items: DonutItem[], minPct: number): number[] {
    const total = items.reduce((s, d) => s + d.value, 0);
    if (total === 0) return items.map(() => 0);
    const minVal     = (minPct / 100) * total;
    const isSmall    = items.map(d => (d.value / total) * 100 < minPct);
    const smallCount = isSmall.filter(Boolean).length;
    const largeSum   = items.reduce((s, d, i) => isSmall[i] ? s : s + d.value, 0);
    const scale      = largeSum > 0 ? (total - smallCount * minVal) / largeSum : 1;
    return items.map((d, i) => isSmall[i] ? minVal : d.value * scale);
}

/* ═══ wordWrap — manual word-wrap at maxChars boundary ═══ */
function wordWrap(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
        if (cur && (cur.length + 1 + w.length) > maxChars) {
            lines.push(cur);
            cur = w;
        } else {
            cur = cur ? cur + " " + w : w;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

/* ═══ DONUT FACTORY — zero hardcoded values, responsive ═══ */
export function useMkDonut() {
    const D = CHART.donut;
    const M = D.mobile;
    const { resolvedTheme } = useTheme();
    const themeKey = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";
    const ec = ECHART_COLORS[themeKey];

    /* Detect breakpoint via window width (SSR-safe) — sm/md/lg */
    const [bp, setBp] = useState<"sm" | "md" | "lg">("lg");
    useEffect(() => {
        const check = () => {
            const w = window.innerWidth;
            setBp(w < 640 ? "sm" : w < 1024 ? "md" : "lg");
        };
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);
    const isMobile = bp === "sm";

    const mkDonut = useCallback((rawData: DonutItem[], selectedName?: string | null) => {
        /* Responsive values — 3 breakpoints for label scaling */
        const responsive = {
            sm: { radius: [M.innerRadius, M.outerRadius], font: 9,  maxChars: 10, lineH: { name: 12, pct: 11 }, line: [14, 10] },
            md: { radius: [D.innerRadius, D.outerRadius], font: 10, maxChars: 11, lineH: { name: 14, pct: 12 }, line: [18, 14] },
            lg: { radius: [D.innerRadius, D.outerRadius], font: D.label.fontSize, maxChars: D.labelMaxChars, lineH: D.label.lineHeight, line: [D.labelLine.length, D.labelLine.length2] },
        };
        const r = responsive[bp];
        const rInner = r.radius[0];
        const rOuter = r.radius[1];
        const rMaxChars = r.maxChars;
        const rLabelFont = r.font;
        const rLineLen = r.line[0];
        const rLineLen2 = r.line[1];

        /* Group slices beyond maxSlices into "Lainnya" */
        let data = rawData;
        if (D.maxSlices && rawData.length > D.maxSlices) {
            const sorted = [...rawData].sort((a, b) => b.value - a.value);
            const top = sorted.slice(0, D.maxSlices - 1);
            const rest = sorted.slice(D.maxSlices - 1);
            const restTotal = rest.reduce((s, d) => s + d.value, 0);
            if (restTotal > 0) {
                top.push({ name: "Lainnya", value: restTotal, itemStyle: { color: ec.textMuted } });
            }
            data = top;
        }

        const hasSelection = !!selectedName;
        const realTotal = data.reduce((s, d) => s + d.value, 0);

        const byName  = new Map(data.map(d => [d.name, d]));
        const realVal = (name: string) => byName.get(name)?.value ?? 0;
        const realPct = (name: string) =>
            realTotal > 0 ? (realVal(name) / realTotal) * 100 : 0;

        const visual = enforceMinSlice(data, D.minSlicePct);

        const outerData = data.map((d, i) => {
            const isSelected = selectedName === d.name;
            const isDimmed = hasSelection && !isSelected;
            return {
                name: d.name,
                value: visual[i],
                selected: isSelected,
                itemStyle: {
                    ...d.itemStyle,
                    opacity: isDimmed ? D.opacity.dimmed : D.opacity.normal,
                    ...(isSelected ? {
                        shadowBlur: D.emphasis.selectedShadowBlur,
                        shadowColor: (d.itemStyle.color as string) ?? "transparent",
                    } : {}),
                },
                label: { show: d.value > 0, opacity: isDimmed ? D.opacity.labelDimmed : D.opacity.normal },
                labelLine: { show: d.value > 0, lineStyle: { opacity: isDimmed ? D.opacity.lineDimmed : D.opacity.normal } },
                emphasis: { disabled: d.value === 0 },
            };
        });

        const innerData = data.map((d, i) => {
            const isDimmed = hasSelection && selectedName !== d.name;
            return {
                name: d.name,
                value: visual[i],
                label: {
                    show: d.value > 0,
                    color: isDimmed ? ec.insideLabelDim : ec.insideLabel,
                },
            };
        });

        const tp = getTooltipPreset(themeKey);

        return {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "item" as const,
                ...tp,
                formatter: (p: { seriesIndex: number; name: string; value: number; percent: number }) =>
                    p.seriesIndex === 0 && realVal(p.name) > 0
                        ? `<b>${p.name}</b><br/>Jumlah: <b>${realVal(p.name)}</b> (${realPct(p.name).toFixed(1)}%)`
                        : "",
            },
            series: [
                {
                    type: "pie" as const,
                    radius: [rInner, rOuter],
                    center: ["50%", "50%"] as [string, string],
                    startAngle: D.startAngle,
                    padAngle: D.padAngle,
                    itemStyle: {
                        borderRadius: D.borderRadius,
                        borderColor: ec.cardBg,
                        borderWidth: D.borderWidth,
                    },
                    selectedMode: "single" as const,
                    selectedOffset: D.selectedOffset,
                    minAngle: D.minAngle,
                    avoidLabelOverlap: true,
                    emphasis: {
                        scale: true,
                        scaleSize: D.emphasis.scaleSize,
                        itemStyle: { shadowBlur: D.emphasis.shadowBlur, shadowColor: D.emphasis.shadowColor },
                    },
                    label: {
                        show: true,
                        alignTo: D.label.alignTo,
                        color: ec.textStrong,
                        formatter: (p: { name: string }) => {
                            const pct = realPct(p.name);
                            const lines = wordWrap(p.name, rMaxChars);
                            return lines.map(l => `{nm|${l}}`).join("\n") + `\n{pct|${pct.toFixed(1)}%}`;
                        },
                        rich: {
                            nm: {
                                fontSize: rLabelFont,
                                fontWeight: ECHART_FONT.weight.bold,
                                color: ec.textStrong,
                                lineHeight: r.lineH.name,
                            },
                            pct: {
                                fontSize: rLabelFont,
                                fontWeight: ECHART_FONT.weight.bold,
                                color: ec.textStrong,
                                lineHeight: r.lineH.pct,
                            },
                        },
                    },
                    labelLine: {
                        show: true,
                        length: rLineLen,
                        length2: rLineLen2,
                        smooth: D.labelLine.smooth,
                        lineStyle: { width: D.labelLine.width },
                    },
                    data: outerData,
                    animationDuration: D.animationDuration,
                    animationType: D.animationType,
                    animationEasing: D.animationEasing,
                    animationDurationUpdate: D.animationDurationUpdate,
                    animationEasingUpdate: D.animationEasingUpdate,
                },
                {
                    type: "pie" as const,
                    z: 10,
                    radius: [rInner, rOuter],
                    center: ["50%", "50%"] as [string, string],
                    startAngle: D.startAngle,
                    padAngle: D.padAngle,
                    silent: true,
                    itemStyle: { color: "transparent", borderWidth: 0 },
                    emphasis: { disabled: true },
                    label: {
                        show: true,
                        position: D.insideLabel.position,
                        fontSize: ECHART_FONT.insideLabel,
                        fontWeight: ECHART_FONT.weight.bold,
                        formatter: (p: { name: string }) => {
                            const v = realVal(p.name);
                            return v > 0 ? `${v}` : "";
                        },
                    },
                    labelLine: { show: false },
                    data: innerData,
                    animationDuration: D.animationDuration,
                    animationType: D.animationType,
                    animationEasing: D.animationEasing,
                    animationDurationUpdate: D.animationDurationUpdate,
                    animationEasingUpdate: D.animationEasingUpdate,
                },
            ],
            graphic: [{
                type: "text" as const,
                left: "center",
                top: D.center.top,
                style: {
                    text: `${realTotal}`,
                    fill: ec.textStrong,
                    fontSize: ECHART_FONT.kpi,
                    fontWeight: ECHART_FONT.weight.bold,
                    textAlign: "center" as const,
                },
            }],
        };
    }, [D, M, ec, themeKey, bp]);

    return { mkDonut, D, isMobile };
}
