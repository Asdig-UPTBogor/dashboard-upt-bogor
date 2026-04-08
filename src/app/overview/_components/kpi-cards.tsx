"use client";

import { Building2, Zap, Radio, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { C } from "./types";

interface KpiCardsProps {
    totalGI: number;
    totalBay: number;
    totalGITypes: number;
    totalVoltages: number;
}

export function KpiCards({ totalGI, totalBay, totalGITypes, totalVoltages }: KpiCardsProps) {
    const primaryItems = [
        { label: "Gardu Induk", value: totalGI, icon: Building2, color: C.indigo },
        { label: "Total Bay", value: totalBay, icon: Zap, color: C.amber },
        { label: "Tipe GI", value: totalGITypes, icon: Radio, color: C.teal },
        { label: "Level Tegangan", value: totalVoltages, icon: Activity, color: C.rose },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {primaryItems.map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                    <motion.div
                        key={kpi.label}
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <Card className="shadow-none">
                            <CardContent className="p-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${kpi.color}18` }}>
                                        <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xl font-extrabold tabular-nums leading-none">{kpi.value}</p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5 truncate">{kpi.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                );
            })}
        </div>
    );
}
