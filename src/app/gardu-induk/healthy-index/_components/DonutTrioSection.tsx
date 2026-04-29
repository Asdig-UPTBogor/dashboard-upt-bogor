/**
 * DonutTrioSection — Three side-by-side donut charts (ECharts SVG renderer).
 *
 * Key design decisions:
 *  1. enforceMinSlice    — min 10% visual share; closures keep real values
 *                          for formatters so tooltip/label show correct data
 *  2. Single-line labels — "{nm|Name} {sub|pct%}" on ONE line eliminates
 *                          the multi-line labelRect.height ambiguity that
 *                          caused the labelLine to miss center on 2-line text
 *  3. Inner label series — no per-item itemStyle → series color:"transparent"
 *                          never overridden → no 2-donut hover artifact
 *  4. avoidLabelOverlap  — ECharts native overlap handling; no labelLayout
 *                          needed since single-line labels always center correctly
 *  5. SVG renderer       — sharper on retina, lighter than canvas for small datasets
 */
"use client";

import { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import {
    COLORS,
    ECHART_COLORS,
    ECHART_FONT,
    STATUS_HI_ORDER,
    STATUS_HI_LABEL,
    PRIORITAS_ORDER,
    USIA_ORDER,
    CHART,
    getTooltipPreset,
} from "./design-tokens";
import type { HiRow, HiStats } from "./useHealthyIndexData";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
    allStats: HiStats;
    allRows: HiRow[];
    stats: HiStats;
    filteredRows: HiRow[];
}

type DonutItem = { name: string; displayName?: string; value: number; color: string };

const LABEL_TO_KEY: Record<string, string> = {};
for (const [k, v] of Object.entries(STATUS_HI_LABEL)) { LABEL_TO_KEY[v] = k; }

/** UPPERCASE → Title Case: "SANGAT TUA" → "Sangat Tua" */
function toTitleCase(s: string): string {
    return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Ensure every slice occupies at least minPct% of the visual circle.
 * Small slices are bumped up; large slices are scaled down proportionally.
 * Returns visual values — real values kept via closures in formatters.
 */
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

function buildDonutOption(
    items: DonutItem[],
    activeValue: string | null,
    theme: "dark" | "light",
) {
    const D  = CHART.donut;
    const ec = ECHART_COLORS[theme];

    const realTotal = items.reduce((s, d) => s + d.value, 0);

    // Closures — formatters read real values, never ECharts redistributed values
    const byName  = new Map(items.map(d => [d.displayName ?? d.name, d]));
    const realVal = (name: string) => byName.get(name)?.value ?? 0;
    const realPct = (name: string) =>
        realTotal > 0 ? (realVal(name) / realTotal) * 100 : 0;

    const visual = enforceMinSlice(items, D.minSlicePct);

    // Outer series data — per-item colors + active/dim state
    const outerData = items.map((d, i) => {
        const chartName = d.displayName ?? d.name;
        const isActive  = activeValue === d.name;
        const isDimmed  = !!(activeValue && !isActive);
        return {
            name:      chartName,
            value:     visual[i],
            selected:  isActive,
            itemStyle: {
                color:      d.color,
                opacity:    isDimmed ? 0.15 : 1,
                shadowBlur: isActive ? 12 : 0,
                shadowColor: isActive ? d.color : "transparent",
            },
            label:    { show: d.value > 0 },
            labelLine: { show: d.value > 0 },
            emphasis: { disabled: d.value === 0 },
        };
    });

    // Inner label data — NO per-item itemStyle so series color:"transparent" wins
    const innerData = items.map((d, i) => {
        const isActive = activeValue === d.name;
        const isDimmed = !!(activeValue && !isActive);
        return {
            name:  d.displayName ?? d.name,
            value: visual[i],
            label: {
                show:  d.value > 0,
                color: isDimmed ? ec.insideLabelDim : ec.insideLabel,
            },
        };
    });

    return {
        backgroundColor: "transparent",
        tooltip: {
            ...getTooltipPreset(theme),
            trigger: "item" as const,
            formatter: (p: { name: string }) => {
                const v   = realVal(p.name);
                const pct = realPct(p.name);
                return v > 0
                    ? `<b>${p.name}</b><br/>Jumlah: <b>${v}</b> (${pct.toFixed(1)}%)`
                    : "";
            },
        },
        series: [
            /* ── Outer series: colored slices + rich outside labels ── */
            {
                type: "pie" as const,
                radius: [D.innerRadius, D.outerRadius],
                center: ["50%", "50%"] as [string, string],
                startAngle: 0,
                padAngle: D.padAngle,
                itemStyle: {
                    borderRadius: D.borderRadius,
                    borderColor:  ec.cardBg,
                    borderWidth:  2,
                },
                selectedMode:   "single" as const,
                selectedOffset: D.selectedOffset,
                avoidLabelOverlap: true,
                emphasis: {
                    scale:     true,
                    scaleSize: D.emphasis.scaleSize,
                    itemStyle: { shadowBlur: 16, shadowColor: D.emphasis.shadowColor },
                },
                label: {
                    show:      true,
                    color:     ec.text,
                    alignTo:   D.label.alignTo,
                    formatter: (p: { name: string }) => {
                        const pct = realPct(p.name);
                        const raw = p.name;
                        const nm  = raw.length > D.labelMaxChars
                            ? raw.slice(0, D.labelMaxChars - 1) + "…"
                            : raw;
                        return `{nm|${nm}} {sub|${pct.toFixed(0)}%}`;
                    },
                    rich: {
                        nm:  {
                            fontSize:   ECHART_FONT.label,
                            fontWeight: ECHART_FONT.weight.bold,
                            color:      ec.textStrong,
                        },
                        sub: {
                            fontSize:   ECHART_FONT.label,
                            color:      ec.textStrong,
                        },
                    },
                },
                labelLine: {
                    show:    true,
                    length:  D.labelLine.length,
                    length2: D.labelLine.length2,
                    smooth:  D.labelLine.smooth,
                    lineStyle: { color: ec.textMuted, width: D.labelLine.width },
                },
                data: outerData,
                animationDuration:       D.animationDuration,
                animationType:           D.animationType,
                animationEasing:         D.animationEasing,
                animationDurationUpdate: D.animationDurationUpdate,
                animationEasingUpdate:   D.animationEasingUpdate,
            },
            /* ── Inner label series: count inside slices ── */
            {
                type:   "pie" as const,
                z:      10,
                radius: [D.innerRadius, D.outerRadius],
                center: ["50%", "50%"] as [string, string],
                startAngle: 0,
                padAngle:   D.padAngle,
                silent:     true,
                itemStyle:  { color: "transparent", borderWidth: 0 },
                emphasis:   { disabled: true },
                label: {
                    show:       true,
                    position:   D.insideLabel.position,
                    fontSize:   ECHART_FONT.insideLabel,
                    fontWeight: ECHART_FONT.weight.bold,
                    formatter:  (p: { name: string }) => {
                        const v = realVal(p.name);
                        return v > 0 ? `${v}` : "";
                    },
                },
                labelLine: { show: false },
                data:      innerData,
                animationDuration:       D.animationDuration,
                animationType:           D.animationType,
                animationEasing:         D.animationEasing,
                animationDurationUpdate: D.animationDurationUpdate,
                animationEasingUpdate:   D.animationEasingUpdate,
            },
        ],
        graphic: [{
            type:  "text" as const,
            left:  "center",
            top:   "43%",
            style: {
                text:       `${realTotal}`,
                fill:       ec.textStrong,
                fontSize:   ECHART_FONT.kpi,
                fontWeight: ECHART_FONT.weight.bold,
                textAlign:  "center" as const,
            },
        }],
    };
}

function DonutTrioImpl({ allStats, allRows }: Props) {
    const { filters, toggle } = useCrossFilter();
    const { resolvedTheme }   = useTheme();
    const theme = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";
    const [open, setOpen] = useState(true);

    const statusHiOption = useMemo(() => {
        const data: DonutItem[] = STATUS_HI_ORDER.map(s => ({
            name:        s,
            displayName: STATUS_HI_LABEL[s] ?? s,
            value:       s === "VERY GOOD" ? allStats.veryGood
                       : s === "GOOD"      ? allStats.good
                       : s === "FAIR"      ? allStats.fair
                       : s === "POOR"      ? allStats.poor
                       :                    allStats.critical,
            color: COLORS.statusHi[s],
        })).filter(d => d.value > 0);
        return buildDonutOption(data, filters.statusHi, theme);
    }, [allStats, filters.statusHi, theme]);

    const prioritasOption = useMemo(() => {
        const counts: Record<string, number> = {};
        PRIORITAS_ORDER.forEach(p => (counts[p] = 0));
        for (const row of allRows) {
            if (row.prioritas && counts[row.prioritas] !== undefined) counts[row.prioritas]++;
        }
        const data: DonutItem[] = PRIORITAS_ORDER.map(p => ({
            name:  p,
            displayName: toTitleCase(p),
            value: counts[p] || 0,
            color: COLORS.prioritas[p] || COLORS.gridLine,
        })).filter(d => d.value > 0);
        return buildDonutOption(data, filters.prioritas, theme);
    }, [allRows, filters.prioritas, theme]);

    const usiaOption = useMemo(() => {
        const counts: Record<string, number> = {};
        USIA_ORDER.forEach(u => (counts[u] = 0));
        for (const row of allRows) {
            if (row.statusUsia && counts[row.statusUsia] !== undefined) counts[row.statusUsia]++;
        }
        const data: DonutItem[] = USIA_ORDER.map(u => ({
            name:  u,
            displayName: toTitleCase(u),
            value: counts[u] || 0,
            color: COLORS.statusUsia[u] || COLORS.gridLine,
        })).filter(d => d.value > 0);
        return buildDonutOption(data, filters.statusUsia, theme);
    }, [allRows, filters.statusUsia, theme]);

    const donuts = [
        {
            key:     "statusHi",
            title:   "Status Healthy Index",
            option:  statusHiOption,
            onClick: (p: { name?: string }) => {
                if (p.name) toggle("statusHi", LABEL_TO_KEY[p.name] ?? p.name);
            },
        },
        {
            key:     "prioritas",
            title:   "Prioritas Penggantian",
            option:  prioritasOption,
            onClick: (p: { name?: string }) => { if (p.name) toggle("prioritas", p.name); },
        },
        {
            key:     "statusUsia",
            title:   "Status Usia",
            option:  usiaOption,
            onClick: (p: { name?: string }) => { if (p.name) toggle("statusUsia", p.name); },
        },
    ];

    return (
        <Card className="border-border py-0 gap-0">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center justify-between px-3 text-left hover:bg-ds-hover ds-transition cursor-pointer"
                style={{ paddingTop: open ? "4px" : "8px", paddingBottom: open ? "0px" : "8px" }}
            >
                <span className="ds-small ds-transition" style={{ opacity: open ? 0 : 1 }}>
                    Sebaran Status HI, Prioritas &amp; Usia
                </span>
                <ChevronDown
                    className="h-4 w-4 text-muted-foreground ds-transition ml-auto"
                    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
            </button>
            <div className="overflow-hidden ds-transition-slow" style={{ maxHeight: open ? "600px" : "0px" }}>
                <CardContent className="px-4 pt-2 pb-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {donuts.map(({ key, title, option, onClick }) => (
                            <div key={key} className="flex flex-col">
                                <CardTitle className="text-center pt-0 pb-0 leading-none">
                                    {title}
                                </CardTitle>
                                <ReactECharts
                                    option={option}
                                    opts={{ renderer: "svg" }}
                                    style={{ height: 280 }}
                                    onEvents={{ click: onClick }}
                                    notMerge
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </div>
        </Card>
    );
}

export const DonutTrioSection = memo(DonutTrioImpl);
