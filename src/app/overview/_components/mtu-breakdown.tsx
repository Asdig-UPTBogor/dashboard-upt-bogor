"use client";

import { useState } from "react";
import { Settings2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EQUIPMENT_TYPES } from "./types";
import type { EquipmentCounts } from "./types";

interface MtuBreakdownProps {
    globalEquipmentCounts: EquipmentCounts;
}

export function MtuBreakdown({ globalEquipmentCounts }: MtuBreakdownProps) {
    const [open, setOpen] = useState(false);

    const eqItems = EQUIPMENT_TYPES.map((eq) => ({
        label: eq.label,
        value: globalEquipmentCounts[eq.key],
        color: eq.color,
    }));

    return (
        <Card className="shadow-none">
            <CardContent className="py-0 px-0">
                {/* Collapsible Header */}
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors rounded-lg"
                >
                    <Settings2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">MTU Breakdown</span>
                    <Badge variant="secondary" className="text-[9px] ml-1 tabular-nums">{globalEquipmentCounts.total} unit</Badge>
                    {/* Mini inline preview when collapsed */}
                    {!open && (
                        <div className="flex gap-1.5 ml-2">
                            {eqItems.filter((e) => e.value > 0).map((eq) => (
                                <span key={eq.label} className="text-[8px] font-semibold tabular-nums" style={{ color: eq.color }}>
                                    {eq.label.substring(0, 3)}: {eq.value}
                                </span>
                            ))}
                        </div>
                    )}
                    <motion.div
                        className="ml-auto"
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </motion.div>
                </button>

                {/* Collapsible Content */}
                <AnimatePresence initial={false}>
                    {open && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-3 pt-1">
                                <div className="flex gap-1 items-end">
                                    {eqItems.map((eq, i) => {
                                        const maxVal = Math.max(...eqItems.map((e) => e.value), 1);
                                        const pct = (eq.value / maxVal) * 100;
                                        return (
                                            <motion.div
                                                key={eq.label}
                                                className="flex-1 flex flex-col items-center gap-1"
                                                initial={{ opacity: 0, scaleY: 0 }}
                                                animate={{ opacity: 1, scaleY: 1 }}
                                                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                                                style={{ transformOrigin: "bottom" }}
                                            >
                                                <span className="text-xs font-bold tabular-nums" style={{ color: eq.color }}>{eq.value}</span>
                                                <motion.div
                                                    className="w-full rounded-t-md"
                                                    style={{ backgroundColor: eq.color, minHeight: 4 }}
                                                    initial={{ height: 0 }}
                                                    animate={{ height: Math.max(4, pct * 0.4) }}
                                                    transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                                                />
                                                <span className="text-[8px] text-muted-foreground text-center leading-tight truncate w-full">{eq.label}</span>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
