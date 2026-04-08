"use client";
/**
 * MapLegend — Split legend system (Thor FE reference)
 *
 * - TowerLegend: Always visible (static) — voltage colors
 * - StrikeLegend: Only visible when strike layer is active (dynamic)
 *
 * Both collapsible with chevron toggle, adaptive dark/light theme.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface LegendBarProps {
    mapStyle?: string;
    children: React.ReactNode;
    title: string;
}

/* ── Shared collapsible legend bar ── */
function LegendBar({ mapStyle = "dark", children, title }: LegendBarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isLight = mapStyle === "light" || mapStyle === "osm";
    const cardBg = isLight ? "bg-white/70" : "bg-black/60";
    const cardBorder = isLight ? "border-black/20" : "border-white/20";
    const btnText = isLight ? "text-gray-600" : "text-zinc-400";

    return (
        <div className={`flex items-center backdrop-blur-md border rounded-md ${cardBg} ${cardBorder}`}>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`flex items-center justify-center w-6 h-6 ${btnText} hover:opacity-80 transition-opacity`}
                title={isCollapsed ? `Show ${title}` : `Hide ${title}`}
            >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
            </button>

            <div className={`w-px h-5 ${isLight ? "bg-black/10" : "bg-white/10"}`} />

            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[350px] opacity-100"}`}>
                {children}
            </div>
        </div>
    );
}

/* ── Tower Legend (static — always visible) ── */
export function TowerLegend({ mapStyle = "dark" }: { mapStyle?: string }) {
    const isLight = mapStyle === "light" || mapStyle === "osm";
    const labelText = isLight ? "text-gray-600" : "text-gray-400";
    const titleText = isLight ? "text-gray-700" : "text-gray-500";

    const items = [
        { color: "#3b82f6", label: "500kV" },
        { color: "#ef4444", label: "150kV" },
        { color: "#eab308", label: "70kV" },
    ];

    return (
        <LegendBar mapStyle={mapStyle} title="Tower Legend">
            <div className="flex items-center whitespace-nowrap px-2 py-1 gap-3 text-xs">
                <span className={`${titleText} font-medium`}>Tower:</span>
                {items.map((item) => (
                    <div key={item.label} className="flex items-center gap-1">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color, boxShadow: `0 0 4px ${item.color}40` }}
                        />
                        <span className={labelText}>{item.label}</span>
                    </div>
                ))}
            </div>
        </LegendBar>
    );
}

/* ── Strike Legend (dynamic — only when strike layer ON) ── */
export function StrikeLegend({ mapStyle = "dark" }: { mapStyle?: string }) {
    const isLight = mapStyle === "light" || mapStyle === "osm";
    const labelText = isLight ? "text-gray-600" : "text-gray-400";
    const titleText = isLight ? "text-gray-700" : "text-gray-500";

    const items = [
        { color: "#f97316", label: "Single" },
        { color: "#ef4444", label: "Multi" },
    ];

    return (
        <LegendBar mapStyle={mapStyle} title="Strike Legend">
            <div className="flex items-center whitespace-nowrap px-2 py-1 gap-3 text-xs">
                <span className={`${titleText} font-medium`}>Strike:</span>
                {items.map((item) => (
                    <div key={item.label} className="flex items-center gap-1">
                        <span
                            style={{
                                fontSize: "10px",
                                lineHeight: 1,
                                textShadow: `0 0 6px ${item.color}`,
                                filter: `drop-shadow(0 0 2px ${item.color})`,
                            }}
                        >⚡</span>
                        <span className={labelText}>{item.label}</span>
                    </div>
                ))}
            </div>
        </LegendBar>
    );
}
