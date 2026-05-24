"use client";

import { useId, useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    XAxis,
    YAxis,
} from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import type { ProgramItem } from "../program-kerja-data";

interface Props {
    items: ProgramItem[];
    accent: string;
    colorMap?: Record<string, string>;
    groupSort?: boolean;
    groupOrder?: string[];
    activeProgram?: string | null;
    onProgramClick?: (namaProgram: string) => void;
    /** Tinggi per row (px). Default 32 — compact dashboard. Slide deck pakai dinamis. */
    rowHeight?: number;
    /** Disable animation — slide deck export (PPTX/PNG) butuh static. */
    disableAnimation?: boolean;
    /** Font scale untuk semua text (label, axis, value). Default 1 (dashboard).
     *  Slide deck pakai 1.4-1.6 supaya readable di canvas 1920×1080 + tajam di Slides. */
    fontScale?: number;
    /** Fill parent height — chart auto-distribute rows by parent size, bukan formula N×rowHeight.
     *  Slide deck pakai true supaya bar mengisi penuh card tanpa overflow / x-axis kepotong. */
    fillHeight?: boolean;
}

const ROW_HEIGHT = 32;
const BAR_SIZE = 12;
const LABEL_GAP = 10;
const MIN_BAR_WIDTH = 1.5;
const activeBarExpand = BAR_SIZE * 0.6;
const ANIM_DURATION = 500;
const CHART_PADDING_BOTTOM = 28;
const YAXIS_MIN_WIDTH = 120;
const YAXIS_MAX_WIDTH = 560;
const YAXIS_DEFAULT_PX = 80;
const CHAR_WIDTH_RATIO = 0.55;
const TRANSITION = "height .25s ease, y .25s ease, fill-opacity .25s ease, filter .25s ease";

function estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * CHAR_WIDTH_RATIO;
}
function pickFontSize(charLen: number, scale = 1): number {
    if (charLen <= 36) return 12 * scale;
    if (charLen <= 50) return 11 * scale;
    if (charLen <= 64) return 10 * scale;
    return 9 * scale;
}

function computePct(realisasi: number, target: number): number {
    return target === 0 ? -1 : (realisasi / target) * 100;
}

export function ProgramRechartsBar({
    items,
    accent,
    colorMap,
    groupSort = false,
    groupOrder = ["abo", "lm"],
    activeProgram,
    onProgramClick,
    rowHeight = ROW_HEIGHT,
    disableAnimation = false,
    fontScale = 1,
    fillHeight = false,
}: Props) {
    /* Auto-scale bar thickness proportional ke rowHeight — keep visual balance */
    const barSize = Math.max(8, Math.min(32, Math.floor(rowHeight * 0.5)));
    const activeBarExpand = barSize * 0.6;
    const uid = useId().replace(/:/g, "");
    const hoverClass = `pbc-${uid}`;

    const sorted = useMemo(() => {
        const sortByPct = (a: ProgramItem, b: ProgramItem) =>
            computePct(b.totalRealisasi, b.totalTarget) - computePct(a.totalRealisasi, a.totalTarget);
        if (!groupSort) return [...items].sort(sortByPct);
        const groupIdx = (k: string) => {
            const i = groupOrder.indexOf(k);
            return i === -1 ? 999 : i;
        };
        return [...items].sort((a, b) => {
            const gd = groupIdx(a.programKerja) - groupIdx(b.programKerja);
            return gd !== 0 ? gd : sortByPct(a, b);
        });
    }, [items, groupSort, groupOrder]);

    const data = useMemo(
        () =>
            sorted.map((it) => {
                const empty = it.totalTarget === 0;
                const pct = empty ? 0 : (it.totalRealisasi / it.totalTarget) * 100;
                const color = colorMap?.[it.programKerja] ?? accent;
                return {
                    name: it.namaProgram,
                    value: empty ? 0 : Math.max(MIN_BAR_WIDTH, Math.min(100, pct)),
                    pctRaw: pct,
                    empty,
                    target: it.totalTarget,
                    realisasi: it.totalRealisasi,
                    color,
                    programKerja: it.programKerja,
                };
            }),
        [sorted, accent, colorMap],
    );

    const yAxisWidth = useMemo(() => {
        let maxPx = YAXIS_DEFAULT_PX;
        for (const it of sorted) {
            const w = estimateTextWidth(it.namaProgram, pickFontSize(it.namaProgram.length, fontScale));
            if (w > maxPx) maxPx = w;
        }
        return Math.min(YAXIS_MAX_WIDTH, Math.max(YAXIS_MIN_WIDTH, Math.ceil(maxPx) + LABEL_GAP + 4));
    }, [sorted]);

    const chartHeight = sorted.length * rowHeight + Math.ceil(CHART_PADDING_BOTTOM * fontScale);

    /** Animation key — hanya berubah saat data array CHANGE, ga saat activeProgram klik.
     *  Hasil: klik bar drill-down → Bar persist → no re-animate → label ga flicker. */
    const animKey = useMemo(
        () => sorted.map((it) => `${it.namaProgram}:${it.totalTarget}:${it.totalRealisasi}`).join("|"),
        [sorted],
    );


    if (items.length === 0) {
        return (
            <div className="ds-small" style={{ padding: 20, textAlign: "center", color: "var(--fg-2)" }}>
                Belum ada program.
            </div>
        );
    }

    const chartConfig = { value: { label: "Progress", color: accent } } satisfies ChartConfig;

    return (
        <>
            <style>{`.${hoverClass} { transition: filter .25s ease, fill-opacity .25s ease; } .${hoverClass}:hover { filter: drop-shadow(0 0 8px var(--bar-color)); }`}</style>
            <ChartContainer
                config={chartConfig}
                className="aspect-auto w-full !justify-start"
                style={fillHeight ? { height: "100%", minHeight: 0 } : { height: chartHeight }}
            >
                <BarChart
                    accessibilityLayer
                    data={data}
                    layout="vertical"
                    margin={{ top: 2, right: 130, left: 0, bottom: Math.ceil(28 * fontScale) }}
                    barCategoryGap={6}
                >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11 * fontScale}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        width={yAxisWidth}
                        interval={0}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        tick={(props: any) => {
                            const text: string = props.payload?.value ?? "";
                            const fs = pickFontSize(text.length, fontScale);
                            return (
                                <text
                                    x={props.x - LABEL_GAP}
                                    y={props.y}
                                    dy={4}
                                    textAnchor="end"
                                    fontSize={fs}
                                    fontWeight={500}
                                    fill="var(--fg-0)"
                                >
                                    {text}
                                </text>
                            );
                        }}
                    />
                    <ChartTooltip
                        cursor={false}
                        trigger="hover"
                        isAnimationActive={false}
                        offset={12}
                        allowEscapeViewBox={{ x: true, y: true }}
                        content={
                            <ChartTooltipContent
                                labelFormatter={(_label, payload) => {
                                    const item = (payload?.[0]?.payload || {}) as (typeof data)[number];
                                    return item.name;
                                }}
                                formatter={(_value, _name, item) => {
                                    const d = (item?.payload || {}) as (typeof data)[number];
                                    if (d.empty) {
                                        return <span style={{ color: "var(--fg-2)" }}>Tidak ada target</span>;
                                    }
                                    return (
                                        <span>
                                            <span style={{ color: accent, fontWeight: 700 }}>
                                                {d.pctRaw.toFixed(1)}%
                                            </span>
                                            <span style={{ color: "var(--fg-2)", marginLeft: 8 }}>
                                                {d.realisasi.toLocaleString("id-ID")} / {d.target.toLocaleString("id-ID")}
                                            </span>
                                        </span>
                                    );
                                }}
                            />
                        }
                    />
                    <Bar
                        key={animKey}
                        dataKey="value"
                        radius={[0, 4, 4, 0]}
                        barSize={barSize}
                        isAnimationActive={!disableAnimation}
                        animationDuration={ANIM_DURATION}
                        animationEasing="ease-out"
                        animationBegin={0}
                        /* Custom <rect> shape — width=0 on mount, CSS transition handle fill animation */
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        shape={(props: any) => {
                            const isActive = activeProgram === props.name;
                            const color = props.fill ?? accent;
                            const expand = isActive ? activeBarExpand : 0;
                            const isDimmed = !!activeProgram && !isActive;
                            /* Width dari Recharts native animation (interpolated per frame) */
                            return (
                                <rect
                                    x={props.x}
                                    y={(props.y ?? 0) - expand / 2}
                                    width={Math.max(0, props.width ?? 0)}
                                    height={(props.height ?? barSize) + expand}
                                    rx={4}
                                    ry={4}
                                    fill={color}
                                    fillOpacity={isDimmed ? 0.3 : 1}
                                    style={{
                                        /* CSS transition cuma untuk height/y (active state) + opacity/filter,
                                           width handle Recharts native animation */
                                        transition: TRANSITION,
                                        filter: isActive ? `drop-shadow(0 0 8px ${color}aa)` : "none",
                                    }}
                                    className={hoverClass}
                                />
                            );
                        }}
                        /* Hover effect: bar membesar via activeBar */
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        activeBar={(props: any) => {
                            const color = props.fill ?? accent;
                            return (
                                <rect
                                    x={props.x}
                                    y={(props.y ?? 0) - activeBarExpand / 2}
                                    width={Math.max(0, props.width ?? 0)}
                                    height={(props.height ?? barSize) + activeBarExpand}
                                    rx={4}
                                    ry={4}
                                    fill={color}
                                    style={{ filter: `drop-shadow(0 0 8px ${color}aa)` }}
                                />
                            );
                        }}
                        onClick={
                            onProgramClick
                                ? (entry: { name?: string }) =>
                                      entry.name && onProgramClick(entry.name)
                                : undefined
                        }
                        style={onProgramClick ? { cursor: "pointer" } : undefined}
                    >
                        {data.map((d) => (
                            <Cell
                                key={d.name}
                                fill={d.empty ? "var(--fg-3)" : d.color}
                                style={{ ["--bar-color" as string]: d.color }}
                            />
                        ))}
                        <LabelList
                            dataKey="pctRaw"
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            content={(props: any) => {
                                const idx = Number(props.index);
                                const d = data[idx];
                                if (!d) return null;
                                const x = (Number(props.x) || 0) + (Number(props.width) || 0) + 8;
                                const yMid = (Number(props.y) || 0) + (Number(props.height) || 0) / 2;
                                const isActive = activeProgram === d.name;
                                const isDimmed = !!activeProgram && !isActive;
                                const opacity = isDimmed ? 0.4 : 1;
                                if (d.empty) {
                                    return (
                                        <text
                                            x={x}
                                            y={yMid + 4}
                                            fontSize={12 * fontScale}
                                            fontWeight={700}
                                            fill="var(--fg-3)"
                                            textAnchor="start"
                                            opacity={opacity}
                                            style={{ fontVariantNumeric: "tabular-nums" }}
                                        >
                                            —
                                        </text>
                                    );
                                }
                                /* Format inline: "4/5 80%" — realisasi/target muted + persen bold accent */
                                return (
                                    <text
                                        x={x}
                                        y={yMid + 4}
                                        fontSize={12 * fontScale}
                                        textAnchor="start"
                                        opacity={opacity}
                                        style={{
                                            fontVariantNumeric: "tabular-nums",
                                            fontFamily: "var(--font-mono)",
                                        }}
                                    >
                                        <tspan fill="var(--fg-1)" fontWeight={500}>
                                            {d.realisasi.toLocaleString("id-ID")}
                                        </tspan>
                                        <tspan dx={2} fill="var(--fg-3)">/</tspan>
                                        <tspan dx={2} fill="var(--fg-1)" fontWeight={500}>
                                            {d.target.toLocaleString("id-ID")}
                                        </tspan>
                                        <tspan dx={8} fill={d.color} fontWeight={700}>
                                            {Math.round(d.pctRaw)}%
                                        </tspan>
                                    </text>
                                );
                            }}
                        />
                    </Bar>
                </BarChart>
            </ChartContainer>
        </>
    );
}
