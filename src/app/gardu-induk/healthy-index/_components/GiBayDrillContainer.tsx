/**
 * GiBayDrillContainer — 2-pane drill layout.
 *
 * Pane 1  HierarchyMapPane — Pohon ULTG › GI › Bay › MTU (klik = cross-filter)
 * Pane 2  BayDrillSection  — Waffle chart (default & saat GI dipilih)
 *          BayDetailPane    — Tab per tipe MTU + detail unit (saat Bay dipilih)
 */
"use client";

import { memo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BayDrillSection } from "./BayDrillSection";
import { BayDetailPane } from "./BayDetailPane";
import { HierarchyMapPane } from "./HierarchyMapPane";
import { useCrossFilter } from "./CrossFilterProvider";
import type { HiStats, HiRow } from "./useHealthyIndexData";

interface Props {
    allStats: HiStats;
    allRows: HiRow[];
    stats: HiStats;
    filteredRows: HiRow[];
}

function GiBayDrillContainerInner({ allStats, allRows, stats, filteredRows }: Props) {
    const [open, setOpen] = useState(true);
    const { filters, toggle, clearAll } = useCrossFilter();

    // ── Breadcrumb ──
    const crumbs: { label: string; onClick?: () => void }[] = [
        {
            label: "Overview",
            onClick: filters.gi ? () => clearAll() : undefined,
        },
    ];
    if (filters.gi) crumbs.push({
        label: filters.gi,
        onClick: filters.bay
            ? () => toggle("bay", filters.bay!)
            : undefined,
    });
    if (filters.bay) crumbs.push({
        label: filters.bay,
    });

    /* Back action dari BayDetailPane: deselect bay → kembali ke waffle */
    const handleBackFromBay = () => toggle("bay", filters.bay!);

    return (
        <Card className="border-border/30 rounded-sm py-0 gap-0 sticky top-4">
            {/* ── Collapse toggle ── */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 text-left hover:bg-white/3 transition-colors"
                style={{ paddingTop: open ? "4px" : "8px", paddingBottom: open ? "0px" : "8px" }}
            >
                <span
                    className="text-xs font-semibold transition-opacity duration-200"
                    style={{ opacity: open ? 0 : 1 }}
                >
                    Kondisi per GI &amp; Detail MTU
                </span>
                <ChevronDown
                    className="h-4 w-4 text-muted-foreground transition-transform duration-200 ml-auto"
                    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
            </button>

            {/* ── 2-pane content ── */}
            <div
                className="overflow-hidden transition-[max-height] duration-300 ease-out"
                style={{ maxHeight: open ? "760px" : "0px" }}
            >
                <div className="flex flex-row" style={{ height: 720 }}>

                    {/* Pane 1 — Pohon ULTG › GI › Bay › MTU */}
                    <div className="w-72 shrink-0 flex flex-col min-h-0 border-r border-border/20">
                        <HierarchyMapPane allRows={allRows} />
                    </div>

                    {/* Pane 2 — waffle atau bay detail */}
                    <div className="flex-1 min-w-0 flex flex-col min-h-0">

                        {/* ── Drill address bar ── */}
                        <div className="shrink-0 flex items-center gap-0.5 px-3 py-1.5 border-b border-border/15 overflow-x-auto">
                            {crumbs.map((crumb, i) => (
                                <span key={i} className="flex items-center gap-0.5 shrink-0">
                                    {i > 0 && (
                                        <span className="text-xs text-white/15 px-0.5 select-none">›</span>
                                    )}
                                    {crumb.onClick ? (
                                        <button
                                            onClick={crumb.onClick}
                                            className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer outline-none max-w-40 truncate"
                                        >
                                            {crumb.label}
                                        </button>
                                    ) : (
                                        <span className={`text-xs max-w-56 truncate ${
                                            i === crumbs.length - 1
                                                ? "text-white/60 font-medium"
                                                : "text-white/20"
                                        }`}>
                                            {crumb.label}
                                        </span>
                                    )}
                                </span>
                            ))}
                        </div>

                        {filters.bay ? (
                            <BayDetailPane
                                rows={filteredRows}
                                onBack={handleBackFromBay}
                            />
                        ) : (
                            <BayDrillSection
                                allStats={allStats}
                                allRows={allRows}
                                stats={stats}
                                filteredRows={filteredRows}
                            />
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

export const GiBayDrillContainer = memo(GiBayDrillContainerInner);

