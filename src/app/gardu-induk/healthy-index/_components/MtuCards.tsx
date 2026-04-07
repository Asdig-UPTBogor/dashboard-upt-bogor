/**
 * MtuCards — compact per-MTU breakdown with stacked bar.
 * Click → cross-filter. No icons, no glow, data-dense.
 */
"use client";

import { memo, useState } from "react";
import { useCrossFilter } from "./CrossFilterProvider";
import { COLORS, STATUS_HI_ORDER } from "./design-tokens";
import type { HiStats } from "./useHealthyIndexData";

interface Props {
    /** Full unfiltered stats — ensures all MTU cards always appear for navigation */
    allStats: HiStats;
    /** Filtered stats — drives the displayed count + stacked bar composition */
    stats: HiStats;
}

function MtuCardsInner({ allStats, stats }: Props) {
    const { filters, toggle, hasFilters } = useCrossFilter();
    const [hovered, setHovered] = useState<string | null>(null);

    // Always list MTU types from allStats so cards never disappear when filtering
    const mtuEntries = Object.entries(allStats.perMtu).sort(
        ([, a], [, b]) => (b.total || 0) - (a.total || 0),
    );

    if (mtuEntries.length === 0) return null;

    // Any filter active (including non-mtu filters like statusHi, prioritas, etc.)
    const anyFilterActive = hasFilters;
    const anyMtuActive = !!filters.mtu;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {mtuEntries.map(([mtu]) => {
                // Filtered data for this MTU (may be 0 if filter excludes it)
                const filteredData = stats.perMtu[mtu];
                const filteredTotal = filteredData?.total || 0;
                // Full total always from allStats (shown as context when 0)
                const allTotal = allStats.perMtu[mtu]?.total || 0;

                const isActive = filters.mtu === mtu;
                const isHovered = hovered === mtu;
                // "Has match" = has units in current filtered view
                const hasMatch = filteredTotal > 0;
                // Dim when: mtu filter on another card, OR other filter active and this card has 0 matches
                const isDimmed = anyMtuActive
                    ? !isActive
                    : anyFilterActive && !hasMatch;

                const scale = isActive ? 1.04 : isHovered ? 1.06 : isDimmed ? 0.97 : 1;

                return (
                    <button
                        key={mtu}
                        type="button"
                        className={`rounded-sm border px-2 py-1.5 text-left select-none ${
                            isActive
                                ? "border-indigo-400/50 bg-indigo-500/10"
                                : hasMatch && anyFilterActive && !anyMtuActive
                                ? "border-indigo-400/20 bg-indigo-500/5"
                                : "border-border/30 bg-card"
                        }`}
                        style={{
                            transform: `scale(${scale})`,
                            opacity: isActive ? 1 : isDimmed ? 0.45 : 1,
                            zIndex: isHovered || isActive ? 20 : 1,
                            position: "relative",
                            transition: "transform 200ms ease-out, opacity 300ms ease-out, box-shadow 200ms ease-out",
                            boxShadow: isHovered
                                ? "0 0 0 1.5px rgba(255,255,255,0.35), 0 4px 14px rgba(0,0,0,0.35)"
                                : isActive
                                ? "0 0 0 1.5px rgba(129,140,248,0.5), 0 4px 14px rgba(0,0,0,0.3)"
                                : hasMatch && anyFilterActive && !anyMtuActive
                                ? "0 0 0 1px rgba(129,140,248,0.25)"
                                : "none",
                        }}
                        onMouseEnter={() => setHovered(mtu)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => toggle("mtu", mtu)}
                    >
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-xs font-semibold truncate">{mtu}</span>
                            <span className="text-base font-bold tabular-nums leading-none">
                                {/* Show filtered count; if 0 and other filter active, show 0/allTotal */}
                                {anyFilterActive && !anyMtuActive
                                    ? hasMatch
                                        ? filteredTotal.toLocaleString("id-ID")
                                        : <span className="text-xs text-muted-foreground/50">0/{allTotal}</span>
                                    : allTotal.toLocaleString("id-ID")}
                            </span>
                        </div>
                        {/* Stacked bar — reflects filtered composition */}
                        <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                            {STATUS_HI_ORDER.map((status) => {
                                const count = (filteredData ?? allStats.perMtu[mtu])?.[status] || 0;
                                const total = anyFilterActive && !anyMtuActive ? filteredTotal : allTotal;
                                if (count === 0 || total === 0) return null;
                                const pct = (count / total) * 100;
                                return (
                                    <div
                                        key={status}
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: COLORS.statusHi[status],
                                        }}
                                        title={`${status}: ${count}`}
                                    />
                                );
                            })}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

export const MtuCards = memo(MtuCardsInner);
