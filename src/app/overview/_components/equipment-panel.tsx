"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EQUIPMENT_TYPES, C } from "./types";
import { MOTION } from "@/lib/chart-tokens";
import type { EquipmentCounts } from "./types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface EquipmentPanelProps {
    equipmentHeatmapData: { name: string; fullName: string; counts: EquipmentCounts }[];
    equipmentBarOption: object;
    globalEquipmentCounts: EquipmentCounts;
    expandedGI: string | null;
    setExpandedGI: (gi: string | null) => void;
}

export function EquipmentPanel({
    equipmentHeatmapData,
    equipmentBarOption,
    globalEquipmentCounts,
    expandedGI,
    setExpandedGI,
}: EquipmentPanelProps) {
    // Only show the top 15 GIs for the heatmap grid (the rest are in the bar chart)
    const topGIs = equipmentHeatmapData.slice(0, 15);
    const maxTotal = Math.max(...topGIs.map((d) => d.counts.total), 1);

    return (
        <div className="space-y-3">
            {/* Heatmap Grid: Equipment per GI */}
            <Card className="shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-primary" /> Peralatan per Gardu Induk
                        <span className="text-xs text-muted-foreground font-normal ml-1">— Klik GI untuk detail</span>
                        <Badge variant="secondary" className="ml-auto text-xs">{equipmentHeatmapData.length} GI</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Header row */}
                    <div className="grid gap-px mb-1" style={{ gridTemplateColumns: `140px repeat(${EQUIPMENT_TYPES.length}, 1fr) 60px` }}>
                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider px-1 py-0.5">Gardu Induk</div>
                        {EQUIPMENT_TYPES.map((eq) => (
                            <div key={eq.key} className="text-xs text-center font-bold uppercase tracking-wider px-0.5 py-0.5" style={{ color: eq.color }}>{eq.label}</div>
                        ))}
                        <div className="text-xs text-muted-foreground font-bold text-right px-1 py-0.5">Total</div>
                    </div>

                    {/* Data rows */}
                    <div className="space-y-px">
                        {topGIs.map((item, i) => {
                            const isActive = expandedGI === item.fullName;
                            return (
                                <motion.div
                                    key={item.fullName}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: MOTION.dur.slow, delay: i * MOTION.stagger.fast, ease: MOTION.ease.out }}
                                    className="grid gap-px rounded-md cursor-pointer hover:bg-muted/40 transition-all duration-200 group"
                                    style={{
                                        gridTemplateColumns: `140px repeat(${EQUIPMENT_TYPES.length}, 1fr) 60px`,
                                        backgroundColor: isActive ? `${C.indigo}12` : undefined,
                                        border: isActive ? `1px solid ${C.indigo}30` : '1px solid transparent',
                                    }}
                                    onClick={() => setExpandedGI(isActive ? null : item.fullName)}
                                >
                                    <div className="text-xs font-medium truncate px-1.5 py-1.5 flex items-center gap-1">
                                        <div
                                            className="h-1.5 w-1.5 rounded-full shrink-0 transition-all"
                                            style={{
                                                backgroundColor: isActive ? C.indigo : `${C.indigo}40`,
                                            }}
                                        />
                                        <span className="truncate">{item.name}</span>
                                    </div>
                                    {EQUIPMENT_TYPES.map((eq) => {
                                        const val = item.counts[eq.key] || 0;
                                        const intensity = val > 0 ? Math.min(val / Math.max(globalEquipmentCounts[eq.key] * 0.3, 1), 1) : 0;
                                        return (
                                            <div key={eq.key} className="flex items-center justify-center py-1.5">
                                                <motion.div
                                                    className="rounded-sm flex items-center justify-center text-xs font-bold tabular-nums"
                                                    style={{
                                                        width: 28,
                                                        height: 22,
                                                        backgroundColor: val > 0 ? `${eq.color}${Math.round(15 + intensity * 30).toString(16).padStart(2, '0')}` : 'transparent',
                                                        color: val > 0 ? eq.color : 'transparent',
                                                        border: val > 0 ? `1px solid ${eq.color}25` : '1px solid transparent',
                                                    }}
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ duration: MOTION.dur.slow, delay: i * MOTION.stagger.fast + 0.1 }}
                                                >
                                                    {val > 0 ? val : ""}
                                                </motion.div>
                                            </div>
                                        );
                                    })}
                                    <div className="text-xs font-bold tabular-nums text-right px-1.5 py-1.5 flex items-center justify-end">
                                        <motion.span
                                            style={{ color: isActive ? C.indigo : undefined }}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: i * 0.03 + 0.2 }}
                                        >
                                            {item.counts.total}
                                        </motion.span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Totals row */}
                    <div className="grid gap-px mt-2 pt-2 border-t border-border/30" style={{ gridTemplateColumns: `140px repeat(${EQUIPMENT_TYPES.length}, 1fr) 60px` }}>
                        <div className="text-xs font-bold uppercase tracking-wider px-1.5 py-1 text-muted-foreground">Total</div>
                        {EQUIPMENT_TYPES.map((eq) => (
                            <div key={eq.key} className="flex items-center justify-center py-1">
                                <span className="text-xs font-bold tabular-nums" style={{ color: eq.color }}>{globalEquipmentCounts[eq.key]}</span>
                            </div>
                        ))}
                        <div className="text-xs font-bold tabular-nums text-right px-1.5 py-1" style={{ color: C.cyan }}>
                            {globalEquipmentCounts.total}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stacked Bar Chart: Equipment per GI */}
            <Card className="shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-primary" /> Distribusi Peralatan per GI
                        <span className="text-xs text-muted-foreground font-normal ml-1">— Stacked by Tipe Peralatan</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ReactECharts
                        option={equipmentBarOption}
                        style={{ height: Math.max(300, equipmentHeatmapData.length * 26 + 60) }}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
