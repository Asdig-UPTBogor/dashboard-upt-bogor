/**
 * KpiRow — 4-column horizontal strip.
 * Pattern per card: title + hero number → segmented distribution bar → metric rows.
 * Segmented bar: proportional colored segments, click = cross-filter.
 * Metric rows: dot · label · mini-bar · count · %.
 */
"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiStats } from "./useHealthyIndexData";
import { COLORS, PRIORITAS_ORDER, USIA_ORDER } from "./design-tokens";

interface Props {
    stats: HiStats;
}

interface SegmentItem {
    key: string;
    label: string;
    color: string;
    count: number;
}

interface DistCardProps {
    title: string;
    total: number;
    hero?: number;
    heroLabel?: string;
    segments: SegmentItem[];
    activeValue: string | null | undefined;
    /** True when THIS card has an active filter — card scales up */
    cardActive: boolean;
    /** True when ANY card has an active filter — inactive cards dim */
    anyCardActive: boolean;
    onToggle: (val: string) => void;
}

function DistCard({ title, total, hero, heroLabel, segments, activeValue, cardActive, anyCardActive, onToggle }: DistCardProps) {
    const anyActive = activeValue != null && activeValue !== "";

    return (
        <div
            className="transition-all duration-300 ease-out"
            style={{
                transform: cardActive ? "scale(1.03)" : anyCardActive ? "scale(0.97)" : "scale(1)",
                zIndex: cardActive ? 10 : 1,
                opacity: anyCardActive && !cardActive ? 0.55 : 1,
                position: "relative",
            }}
        >
        <Card
            className="border-border/30 py-0 gap-0 transition-all duration-300"
            style={cardActive ? { boxShadow: "0 0 0 1.5px hsl(var(--border)), 0 4px 24px rgba(0,0,0,0.35)" } : {}}>
            <CardContent className="px-3 pt-2.5 pb-3 flex flex-col gap-2.5 h-full">

                {/* ── Header: title + optional hero number ── */}
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 leading-snug">{title}</p>
                    {hero !== undefined && (
                        <p className="flex-none text-right">
                            <span className="text-xl font-bold tabular-nums leading-none">{hero.toLocaleString("id-ID")}</span>
                            {heroLabel && (
                                <span className="ml-1 text-xs font-medium text-muted-foreground/70">{heroLabel}</span>
                            )}
                        </p>
                    )}
                </div>

                {/* ── Segmented distribution bar ── */}
                <div className="flex gap-0.5 h-2.5 rounded overflow-hidden">
                    {segments.map((seg) => {
                        const width = total > 0 ? (seg.count / total) * 100 : 0;
                        if (width === 0) return null;
                        const active = activeValue === seg.key;
                        return (
                            <button
                                key={seg.key}
                                type="button"
                                className={`h-full flex-none cursor-pointer ${
                                    active
                                        ? "opacity-100"
                                        : anyActive
                                        ? "opacity-25"
                                        : "opacity-75"
                                }`}
                                style={{
                                    width: `${width}%`,
                                    backgroundColor: seg.color,
                                    transition: "opacity 200ms ease, filter 150ms ease",
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.3)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
                                onClick={() => onToggle(seg.key)}
                                title={`${seg.label}: ${seg.count.toLocaleString("id-ID")} (${((seg.count / total) * 100).toFixed(1)}%)`}
                            />
                        );
                    })}
                </div>

                {/* ── Metric rows ── */}
                <div className="flex flex-col gap-0.5">
                    {segments.map((seg) => {
                        const pct = total > 0 ? (seg.count / total) * 100 : 0;
                        const active = activeValue === seg.key;
                        return (
                            <button
                                key={seg.key}
                                type="button"
                                className={`flex items-center gap-2 w-full text-left rounded px-1.5 py-1.25 transition-all duration-150 ${
                                    active ? "bg-muted/20" : "hover:bg-muted/15"
                                }`}
                                style={{
                                    outline: "1.5px solid transparent",
                                    outlineOffset: "0px",
                                    transition: "background-color 150ms, outline-color 150ms",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.outlineColor = "rgba(255,255,255,0.18)";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.outlineColor = "transparent";
                                }}
                                onClick={() => onToggle(seg.key)}
                            >
                                {/* color swatch */}
                                <div
                                    className="w-2 h-2 rounded-[2px] flex-none transition-opacity duration-200"
                                    style={{
                                        backgroundColor: seg.color,
                                        opacity: anyActive && !active ? 0.35 : 1,
                                    }}
                                />
                                {/* label */}
                                <span
                                    className="text-xs flex-1 min-w-0 truncate font-medium transition-colors duration-150"
                                    style={{ color: active ? "hsl(var(--foreground))" : anyActive ? "hsl(var(--muted-foreground) / 0.6)" : "hsl(var(--muted-foreground))" }}
                                >
                                    {seg.label}
                                </span>
                                {/* mini bar track */}
                                <div className="w-14 h-1.5 bg-border/20 rounded-full overflow-hidden flex-none">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%`, backgroundColor: seg.color, opacity: anyActive && !active ? 0.3 : 1 }}
                                    />
                                </div>
                                {/* count */}
                                <span
                                    className="text-xs font-bold tabular-nums w-9 text-right flex-none transition-opacity duration-150"
                                    style={{ opacity: anyActive && !active ? 0.45 : 1 }}
                                >
                                    {seg.count.toLocaleString("id-ID")}
                                </span>
                                {/* pct */}
                                <span className="text-xs font-medium text-muted-foreground/70 w-7 text-right flex-none">
                                    {pct.toFixed(0)}%
                                </span>
                            </button>
                        );
                    })}
                </div>

            </CardContent>
        </Card>
        </div>
    );
}

function KpiRowInner({ stats }: Props) {
    const { filters, toggle } = useCrossFilter();

    // Card 1 — by ULTG
    const ultgSegments: SegmentItem[] = Object.entries(stats.perUltg)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([name, data], i) => ({
            key: name,
            label: name,
            color: i === 0 ? COLORS.teal : COLORS.purple,
            count: data.total,
        }));

    // Card 2 — Prioritas
    const prioritasSegments: SegmentItem[] = PRIORITAS_ORDER.map((p) => ({
        key: p,
        label: p,
        color: COLORS.prioritas[p],
        count: stats.perPrioritas[p] || 0,
    })).filter((s) => s.count > 0);

    // Card 4 — Status Usia
    const usiaSegments: SegmentItem[] = USIA_ORDER.map((u) => ({
        key: u,
        label: u,
        color: COLORS.statusUsia[u],
        count: stats.perStatusUsia[u] || 0,
    })).filter((s) => s.count > 0);

    const activeCard = filters.ultg
        ? "ultg"
        : filters.prioritas
        ? "prioritas"
        : filters.statusUsia
        ? "statusUsia"
        : null;
    const anyCardActive = activeCard !== null;

    return (
        <div className="grid grid-cols-3 gap-2 items-stretch">
            <DistCard
                title="Total Unit MTU"
                total={stats.total}
                hero={stats.total}
                heroLabel="unit"
                segments={ultgSegments}
                activeValue={filters.ultg}
                cardActive={activeCard === "ultg"}
                anyCardActive={anyCardActive}
                onToggle={(val) => toggle("ultg", val)}
            />
            <DistCard
                title="Prioritas Penggantian"
                total={stats.total}
                segments={prioritasSegments}
                activeValue={filters.prioritas}
                cardActive={activeCard === "prioritas"}
                anyCardActive={anyCardActive}
                onToggle={(val) => toggle("prioritas", val)}
            />
            <DistCard
                title="Status Usia"
                total={stats.total}
                segments={usiaSegments}
                activeValue={filters.statusUsia}
                cardActive={activeCard === "statusUsia"}
                anyCardActive={anyCardActive}
                onToggle={(val) => toggle("statusUsia", val)}
            />
        </div>
    );
}

export const KpiRow = memo(KpiRowInner);
