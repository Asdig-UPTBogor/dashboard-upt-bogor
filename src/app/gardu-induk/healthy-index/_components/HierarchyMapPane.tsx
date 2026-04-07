/**
 * HierarchyMapPane — pohon navigasi ULTG › GI › Bay › MTU
 *
 * Tampil sebagai pane paling kanan di GiBayDrillContainer.
 * - Node tersorot = cocok dengan cross-filter aktif
 * - Klik GI      → toggle("gi")
 * - Klik Bay     → drillToGiBay()
 * - Klik MTU     → toggle("mtu")
 * - Node otomatis expand mengikuti filter aktif
 */
"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiRow } from "./useHealthyIndexData";

/* ── colour helper (green → yellow → red, t = 0..1 = bad..good) ── */
function scoreToColor(t: number): string {
    const stops = [
        [0x34, 0xd3, 0x99],
        [0xfb, 0xbf, 0x24],
        [0xfb, 0x71, 0x85],
    ] as const;
    const clamped = Math.max(0, Math.min(1, t));
    const [a, b, frac] = clamped < 0.5
        ? [stops[0], stops[1], clamped * 2]
        : [stops[1], stops[2], (clamped - 0.5) * 2];
    const r  = Math.round(a[0] + (b[0] - a[0]) * frac);
    const g  = Math.round(a[1] + (b[1] - a[1]) * frac);
    const bl = Math.round(a[2] + (b[2] - a[2]) * frac);
    return `rgb(${r},${g},${bl})`;
}

function avgHi(rows: HiRow[]): number {
    if (!rows.length) return 100;
    return rows.reduce((s, r) => s + r.nilaiHi, 0) / rows.length;
}

interface Props {
    allRows: HiRow[];
}

function HierarchyMapPaneInner({ allRows }: Props) {
    const { filters, toggle, drillToGiBay } = useCrossFilter();

    /* manual expand/collapse per node key */
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const toggleNode = useCallback((key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    /* Build full tree: ultg → gi → bay → mtu → HiRow[] */
    const tree = useMemo(() => {
        const map: Record<string, Record<string, Record<string, Record<string, HiRow[]>>>> = {};
        for (const row of allRows) {
            if (!map[row.ultg])                          map[row.ultg] = {};
            if (!map[row.ultg][row.gi])                  map[row.ultg][row.gi] = {};
            if (!map[row.ultg][row.gi][row.bay])         map[row.ultg][row.gi][row.bay] = {};
            if (!map[row.ultg][row.gi][row.bay][row.mtu]) map[row.ultg][row.gi][row.bay][row.mtu] = [];
            map[row.ultg][row.gi][row.bay][row.mtu].push(row);
        }
        return map;
    }, [allRows]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 py-2 shrink-0 border-b border-border/20 flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wide uppercase text-foreground/50 flex-1">
                    Peta Data
                </span>
                <span className="text-[10px] text-white/20 tabular-nums">{allRows.length}</span>
            </div>

            {/* Tree */}
            <div className="flex-1 min-h-0 overflow-y-auto py-1">
                {Object.keys(tree).sort().map((ultg) => {
                    const giMap    = tree[ultg];
                    const ultgRows = allRows.filter((r) => r.ultg === ultg);
                    const color    = scoreToColor(avgHi(ultgRows) / 100);
                    const key      = `u:${ultg}`;
                    const isActive = Object.keys(giMap).includes(filters.gi ?? "");
                    const isExp    = expanded.has(key) || isActive || filters.ultg === ultg;

                    return (
                        <div key={ultg}>
                            {/* ── ULTG row ── */}
                            <button
                                onClick={() => toggleNode(key)}
                                className="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors"
                            >
                                <ChevronRight
                                    className="w-3.5 h-3.5 shrink-0 text-white/30 transition-transform duration-150"
                                    style={{ transform: isExp ? "rotate(90deg)" : "rotate(0deg)" }}
                                />
                                <span className="text-sm font-bold text-white/75 truncate flex-1 text-left">
                                    {ultg || "—"}
                                </span>
                                <span className="text-xs font-bold tabular-nums shrink-0" style={{ color }}>
                                    {avgHi(ultgRows).toFixed(0)}%
                                </span>
                                <span className="text-[11px] text-white/20 tabular-nums shrink-0 w-6 text-right">{ultgRows.length}</span>
                            </button>

                            {/* ── GI level ── */}
                            {isExp && Object.keys(giMap).sort().map((gi) => {
                                const bayMap  = giMap[gi];
                                const giRows  = Object.values(bayMap).flatMap((bm) => Object.values(bm).flat());
                                const giClr   = scoreToColor(avgHi(giRows) / 100);
                                const gKey    = `g:${gi}`;
                                const isGiSel = filters.gi === gi;
                                const isGiExp = expanded.has(gKey) || isGiSel;

                                return (
                                    <div key={gi}>
                                        {/* GI row — full row is clickable for filter, chevron for expand */}
                                        <div
                                            className="flex items-center gap-1.5 pl-5 pr-2 py-1 transition-colors hover:bg-white/5 rounded-sm mx-1"
                                            style={{
                                                background: isGiSel ? `${giClr}18` : undefined,
                                                borderLeft: isGiSel ? `2px solid ${giClr}` : "2px solid transparent",
                                            }}
                                        >
                                            <button
                                                onClick={() => toggleNode(gKey)}
                                                className="shrink-0 p-0.5 -ml-0.5"
                                                aria-label="expand GI"
                                            >
                                                <ChevronRight
                                                    className="w-3 h-3 text-white/25 transition-transform duration-150"
                                                    style={{ transform: isGiExp ? "rotate(90deg)" : "rotate(0deg)" }}
                                                />
                                            </button>
                                            <button
                                                onClick={() => toggle("gi", gi)}
                                                className="flex-1 flex items-center gap-1.5 min-w-0 text-left outline-none"
                                            >
                                                <span
                                                    className="text-sm truncate flex-1"
                                                    style={{ color: isGiSel ? giClr : "rgba(255,255,255,0.65)", fontWeight: isGiSel ? 700 : 400 }}
                                                >
                                                    {gi}
                                                </span>
                                                <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: giClr }}>
                                                    {avgHi(giRows).toFixed(0)}%
                                                </span>
                                                <span className="text-[11px] text-white/20 tabular-nums shrink-0 w-5 text-right">{giRows.length}</span>
                                            </button>
                                        </div>

                                        {/* ── Bay level ── */}
                                        {isGiExp && Object.keys(bayMap).sort().map((bay) => {
                                            const mtuMap   = bayMap[bay];
                                            const bayRows  = Object.values(mtuMap).flat();
                                            const bayClr   = scoreToColor(avgHi(bayRows) / 100);
                                            const bKey     = `b:${gi}:${bay}`;
                                            const isBaySel = filters.gi === gi && filters.bay === bay;
                                            const isBayExp = expanded.has(bKey) || isBaySel;

                                            return (
                                                <div key={bay}>
                                                    <div
                                                        className="flex items-center gap-1.5 pl-9 pr-2 py-0.5 transition-colors hover:bg-white/5 rounded-sm mx-1"
                                                        style={{
                                                            background: isBaySel ? `${bayClr}14` : undefined,
                                                            borderLeft: isBaySel ? `2px solid ${bayClr}` : "2px solid transparent",
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() => toggleNode(bKey)}
                                                            className="shrink-0 p-0.5 -ml-0.5"
                                                            aria-label="expand Bay"
                                                        >
                                                            <ChevronRight
                                                                className="w-2.5 h-2.5 text-white/20 transition-transform duration-150"
                                                                style={{ transform: isBayExp ? "rotate(90deg)" : "rotate(0deg)" }}
                                                            />
                                                        </button>
                                                        <button
                                                            onClick={() => drillToGiBay(gi, bay)}
                                                            className="flex-1 flex items-center gap-1.5 min-w-0 text-left outline-none"
                                                        >
                                                            <span
                                                                className="text-xs truncate flex-1"
                                                                style={{ color: isBaySel ? bayClr : "rgba(255,255,255,0.45)", fontWeight: isBaySel ? 700 : 400 }}
                                                            >
                                                                {bay}
                                                            </span>
                                                            <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: bayClr }}>
                                                                {avgHi(bayRows).toFixed(0)}%
                                                            </span>
                                                            <span className="text-[11px] text-white/18 tabular-nums shrink-0 w-5 text-right">{bayRows.length}</span>
                                                        </button>
                                                    </div>

                                                    {/* ── MTU type level ── */}
                                                    {isBayExp && Object.keys(mtuMap).sort().map((mtu) => {
                                                        const mtuRows  = mtuMap[mtu];
                                                        const mtuClr   = scoreToColor(avgHi(mtuRows) / 100);
                                                        const isMtuSel = filters.mtu === mtu && isBaySel;
                                                        return (
                                                            <button
                                                                key={mtu}
                                                                onClick={() => { drillToGiBay(gi, bay); toggle("mtu", mtu); }}
                                                                className="flex w-full items-center gap-1.5 pl-12 pr-2 py-0.5 transition-colors hover:bg-white/5 rounded-sm mx-1"
                                                                style={{
                                                                    background: isMtuSel ? `${mtuClr}14` : undefined,
                                                                    borderLeft: isMtuSel ? `2px solid ${mtuClr}` : "2px solid transparent",
                                                                }}
                                                            >
                                                                <span
                                                                    className="text-xs truncate flex-1 text-left"
                                                                    style={{ color: isMtuSel ? mtuClr : "rgba(255,255,255,0.35)", fontWeight: isMtuSel ? 700 : 400 }}
                                                                >
                                                                    {mtu}
                                                                </span>
                                                                <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: mtuClr }}>
                                                                    {avgHi(mtuRows).toFixed(0)}%
                                                                </span>
                                                                <span className="text-[11px] text-white/15 tabular-nums shrink-0 w-4 text-right">{mtuRows.length}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            <p className="text-[9px] text-muted-foreground/20 text-center pb-1 shrink-0 select-none">
                Klik GI · Bay · MTU = filter · % = rata-rata HI
            </p>
        </div>
    );
}

export const HierarchyMapPane = memo(HierarchyMapPaneInner);
