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
    const items = [
        { label: "Total Gardu Induk", value: totalGI, icon: Building2, color: C.indigo },
        { label: "Total Bay", value: totalBay, icon: Zap, color: C.amber },
        { label: "Tipe GI", value: totalGITypes, icon: Radio, color: C.teal },
        { label: "Level Tegangan", value: totalVoltages, icon: Activity, color: C.purple },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                    <motion.div
                        key={kpi.label}
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <Card className="shadow-none">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
                                        <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-extrabold">{kpi.value}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
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
