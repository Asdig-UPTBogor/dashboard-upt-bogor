/**
 * DonutTrioSection — Three side-by-side donut charts in one card:
 *  1. Status Healthy Index  (VERY GOOD → CRITICAL)
 *  2. Prioritas Penggantian (P0, P1, P2)
 *  3. Status Usia           (MUDA, TUA, SANGAT TUA)
 *
 * Two-series ECharts pattern (mirrors ce-donut-factory):
 *  - Series 1: outside labels (name + %) — avoidLabelOverlap + labelLayout shiftY
 *  - Series 2: inside value count — silent, transparent items
 *  - Centre graphic: total number
 *  - Cross-filter: click slice → toggle dimension filter
 */
"use client";

import { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import {
    COLORS,
    STATUS_HI_ORDER,
    PRIORITAS_ORDER,
    USIA_ORDER,
    CHART,
} from "./design-tokens";
import type { HiRow, HiStats } from "./useHealthyIndexData";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
    stats: HiStats;
    filteredRows: HiRow[];
}

type DonutItem = { name: string; value: number; color: string };

/* Word-wrap helper — same as ce-donut-factory */
function wrapLabel(name: string, maxLen = 14): string {
    if (name.length <= maxLen) return name;
    const words = name.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
        if (cur && cur.length + 1 + w.length > maxLen) {
            lines.push(cur);
            cur = w;
        } else {
            cur = cur ? cur + " " + w : w;
        }
    }
    if (cur) lines.push(cur);
    if (lines.length > 2)
        return lines[0] + "\n" + lines.slice(1).join(" ").slice(0, maxLen - 1) + "…";
    return lines.join("\n");
}

function buildDonutOption(data: DonutItem[], activeValue: string | null) {
    const D = CHART.donut;
    const total = data.reduce((s, d) => s + d.value, 0);

    /* Series 1: outer labels — name + % */
    const outerData = data.map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        const isActive = activeValue === d.name;
        const isDimmed = !!(activeValue && !isActive);
        return {
            name: d.name,
            value: d.value,
            itemStyle: {
                color: d.color,
                opacity: isDimmed ? COLORS.dimOpacity : 1,
                shadowBlur: isActive ? 12 : 0,
                shadowColor: isActive ? d.color : "transparent",
            },
            label: { show: d.value > 0 && pct >= 1 },
            labelLine: { show: d.value > 0 && pct >= 1 },
            emphasis: { disabled: d.value === 0 },
        };
    });

    /* Series 2: inner value count — transparent overlay */
    const innerData = data.map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        return {
            name: d.name,
            value: d.value,
            itemStyle: { color: "transparent", borderColor: "transparent" },
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
            borderColor: "rgba(129,140,248,0.3)",
            borderWidth: 1,
            textStyle: { color: "#d4d4d8", fontSize: 12 },
            confine: true,
            formatter: (p: { name: string; value: number; percent: number }) =>
                p.value > 0
                    ? `<b>${p.name}</b><br/>Jumlah: <b>${p.value}</b> (${p.percent.toFixed(1)}%)`
                    : "",
        },
        series: [
            /* ── Series 1: outside labels ── */
            {
                type: "pie" as const,
                radius: [D.innerRadius, D.outerRadius],
                center: ["50%", "50%"] as [string, string],
                startAngle: 0,
                padAngle: D.padAngle,
                itemStyle: {
                    borderRadius: D.borderRadius,
                    borderColor: "#18181b",
                    borderWidth: 2,
                },
                selectedMode: "single" as const,
                selectedOffset: D.selectedOffset,
                avoidLabelOverlap: true,
                emphasis: {
                    scale: true,
                    scaleSize: D.emphasis.scaleSize,
                    itemStyle: { shadowBlur: 20, shadowColor: "rgba(129,140,248,0.4)" },
                },
                label: {
                    show: true,
                    color: "#d4d4d8",
                    alignTo: "edge" as const,
                    edgeDistance: "5%",
                    formatter: (p: { name: string; percent: number }) => {
                        const nm = wrapLabel(p.name, 14);
                        return `{nm|${nm}}\n{pct|${p.percent.toFixed(0)}%}`;
                    },
                    rich: {
                        nm: {
                            fontSize: 11,
                            fontWeight: "bold" as const,
                            color: "#d4d4d8",
                            lineHeight: 16,
                        },
                        pct: {
                            fontSize: 11,
                            color: "#d4d4d8",
                            lineHeight: 14,
                        },
                    },
                },
                labelLine: {
                    show: true,
                    length: 6,
                    length2: 4,
                    smooth: 0.3,
                    lineStyle: { color: "#a1a1aa", width: 1 },
                },
                labelLayout: {
                    hideOverlap: true,
                    moveOverlap: "shiftY" as const,
                },
                data: outerData,
                animationDuration: 800,
                animationType: "scale" as const,
                animationEasing: "cubicOut" as const,
                animationDurationUpdate: 400,
                animationEasingUpdate: "cubicInOut" as const,
            },
            /* ── Series 2: value count inside donut ── */
            {
                type: "pie" as const,
                radius: [D.innerRadius, D.outerRadius],
                center: ["50%", "50%"] as [string, string],
                startAngle: 0,
                padAngle: D.padAngle,
                silent: true,
                itemStyle: { color: "transparent", borderColor: "transparent" },
                label: {
                    show: true,
                    position: "inside" as const,
                    fontSize: 11,
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
        /* Centre total */
        graphic: [
            {
                type: "text" as const,
                left: "center",
                top: "43%",
                style: {
                    text: `${total}`,
                    fill: "#ffffff",
                    fontSize: 18,
                    fontWeight: 700,
                    textAlign: "center" as const,
                },
            },
        ],
    };
}

function DonutTrioImpl({ stats, filteredRows }: Props) {
    const { filters, toggle } = useCrossFilter();
    const [open, setOpen] = useState(true);

    /* ── Status HI donut ── */
    const statusHiOption = useMemo(() => {
        const data: DonutItem[] = STATUS_HI_ORDER.map((s) => ({
            name: s,
            value:
                s === "VERY GOOD" ? stats.veryGood
                : s === "GOOD"      ? stats.good
                : s === "FAIR"      ? stats.fair
                : s === "POOR"      ? stats.poor
                : stats.critical,
            color: COLORS.statusHi[s],
        })).filter((d) => d.value > 0);
        return buildDonutOption(data, filters.statusHi);
    }, [stats, filters.statusHi]);

    /* ── Prioritas donut ── */
    const prioritasOption = useMemo(() => {
        const counts: Record<string, number> = {};
        PRIORITAS_ORDER.forEach((p) => (counts[p] = 0));
        for (const row of filteredRows) {
            if (row.prioritas && counts[row.prioritas] !== undefined) counts[row.prioritas]++;
        }
        const data: DonutItem[] = PRIORITAS_ORDER.map((p) => ({
            name: p,
            value: counts[p] || 0,
            color: COLORS.prioritas[p] || COLORS.gridLine,
        })).filter((d) => d.value > 0);
        return buildDonutOption(data, filters.prioritas);
    }, [filteredRows, filters.prioritas]);

    /* ── Status Usia donut ── */
    const usiaOption = useMemo(() => {
        const counts: Record<string, number> = {};
        USIA_ORDER.forEach((u) => (counts[u] = 0));
        for (const row of filteredRows) {
            if (row.statusUsia && counts[row.statusUsia] !== undefined) counts[row.statusUsia]++;
        }
        const data: DonutItem[] = USIA_ORDER.map((u) => ({
            name: u,
            value: counts[u] || 0,
            color: COLORS.statusUsia[u] || COLORS.gridLine,
        })).filter((d) => d.value > 0);
        return buildDonutOption(data, filters.statusUsia);
    }, [filteredRows, filters.statusUsia]);

    const donuts = [
        {
            key: "statusHi",
            title: "Status Healthy Index",
            option: statusHiOption,
            onClick: (p: { name?: string }) => { if (p.name) toggle("statusHi", p.name); },
        },
        {
            key: "prioritas",
            title: "Prioritas Penggantian",
            option: prioritasOption,
            onClick: (p: { name?: string }) => { if (p.name) toggle("prioritas", p.name); },
        },
        {
            key: "statusUsia",
            title: "Status Usia",
            option: usiaOption,
            onClick: (p: { name?: string }) => { if (p.name) toggle("statusUsia", p.name); },
        },
    ];

    return (
        <Card className="border-border/30 rounded-sm py-0 gap-0">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center justify-between px-3 text-left hover:bg-white/3 transition-colors"
                style={{ paddingTop: open ? "4px" : "8px", paddingBottom: open ? "0px" : "8px" }}
            >
                <span
                    className="text-xs font-semibold transition-opacity duration-200"
                    style={{ opacity: open ? 0 : 1 }}
                >
                    Sebaran Status HI, Prioritas &amp; Usia
                </span>
                <ChevronDown
                    className="h-4 w-4 text-muted-foreground transition-transform duration-200 ml-auto"
                    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
            </button>
            <div
                className="overflow-hidden transition-[max-height] duration-300 ease-out"
                style={{ maxHeight: open ? "600px" : "0px" }}
            >
                <CardContent className="px-2 pt-1 pb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                        {donuts.map(({ key, title, option, onClick }) => (
                            <div key={key} className="flex flex-col">
                                <p className="text-xs font-semibold text-muted-foreground text-center pt-0 pb-0 uppercase tracking-wider leading-none">
                                    {title}
                                </p>
                                <ReactECharts
                                    option={option}
                                    style={{ height: 260 }}
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
