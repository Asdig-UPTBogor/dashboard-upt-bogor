"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ProgramItem } from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
    items: ProgramItem[];
    accent: string;
    height?: number;
    /** Narrow mode (split 2 col) → label lebih kecil, grid kiri lebih sempit */
    narrow?: boolean;
}

/**
 * Horizontal bar chart 1 kategori.
 * - Wide mode (1 col, full slide width 1760px): label ~720px, font 18-22px
 * - Narrow mode (split 2 col, ~860px each): label ~440px, font 14-17px
 */
export function ProgramRankingChart({ items, accent, height = 840, narrow = false }: Props) {
    /* ECharts render bottom-up, jadi reverse supaya item pertama tampil paling atas */
    const reversed = useMemo(() => [...items].reverse(), [items]);

    const option = useMemo(() => {
        const yLabels = reversed.map((it) => it.namaProgram);
        const data = reversed.map((it) => {
            const p = it.totalTarget === 0 ? 0 : (it.totalRealisasi / it.totalTarget) * 100;
            return {
                value: Number(p.toFixed(1)),
                itemStyle: { color: accent, borderRadius: [0, 6, 6, 0] },
                label: {
                    show: true,
                    position: "right" as const,
                    color: "#ffffff",
                    fontSize: narrow ? 17 : 22,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono, monospace)",
                    formatter: `${p.toFixed(1)}%`,
                    distance: narrow ? 10 : 14,
                },
            };
        });

        return {
            grid: narrow
                ? { left: 440, right: 100, top: 14, bottom: 14, containLabel: false }
                : { left: 720, right: 140, top: 16, bottom: 16, containLabel: false },
            xAxis: {
                type: "value",
                max: 100,
                show: false,
                splitLine: { show: false },
            },
            yAxis: {
                type: "category",
                data: yLabels,
                axisTick: { show: false },
                axisLine: { show: false },
                splitLine: { show: false },
                axisLabel: {
                    color: "#ffffff",
                    fontSize: narrow ? 14 : 18,
                    fontWeight: 500,
                    fontFamily: "var(--font-sans, system-ui)",
                    width: narrow ? 420 : 700,
                    overflow: "break",
                    align: "right",
                    lineHeight: narrow ? 20 : 26,
                    margin: narrow ? 12 : 16,
                },
            },
            series: [
                {
                    type: "bar",
                    barWidth: narrow ? 24 : 32,
                    data,
                    backgroundStyle: { color: "rgba(255,255,255,.05)", borderRadius: [0, 6, 6, 0] },
                    showBackground: true,
                    animation: false,
                },
            ],
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                backgroundColor: "#131313",
                borderColor: "#262626",
                textStyle: { color: "#ffffff", fontSize: 13 },
                formatter: (params: { dataIndex: number }[]) => {
                    const idx = params[0]?.dataIndex;
                    if (idx == null) return "";
                    const it = reversed[idx];
                    const p = it.totalTarget === 0 ? 0 : (it.totalRealisasi / it.totalTarget) * 100;
                    return `
                        <div style="font-weight:600;margin-bottom:6px;max-width:400px;white-space:normal">${it.namaProgram}</div>
                        <div style="color:#a1a1aa;font-size:12px">
                            Target: <strong style="color:#fff">${it.totalTarget.toLocaleString("id-ID")}</strong> ·
                            Realisasi: <strong style="color:#fff">${it.totalRealisasi.toLocaleString("id-ID")}</strong> ·
                            Progress: <strong style="color:${accent}">${p.toFixed(1)}%</strong>
                        </div>
                    `;
                },
            },
        };
    }, [reversed, accent, narrow]);

    return (
        <ReactECharts
            option={option}
            style={{ width: "100%", height }}
            notMerge={true}
            opts={{ renderer: "canvas" }}
        />
    );
}
