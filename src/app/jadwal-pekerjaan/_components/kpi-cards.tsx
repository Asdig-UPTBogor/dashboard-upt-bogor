"use client";

import { Building2, Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { C } from "../_lib/types";
import type { LucideIcon } from "lucide-react";

interface KpiItem {
    label: string;
    value: number | string;
    icon: LucideIcon;
    color: string;
}

interface KpiCardsProps {
    loading: boolean;
    totalEvents: number;
    giAktif: number;
    statusOk: number;
    statusAbk: number;
}

export function KpiCards({ loading, totalEvents, giAktif, statusOk, statusAbk }: KpiCardsProps) {
    const items: KpiItem[] = loading
        ? [
            { label: "Event Hari Ini", value: "—", icon: Wrench, color: C.amber },
            { label: "GI Terdampak", value: "—", icon: Building2, color: C.indigo },
            { label: "Status OK", value: "—", icon: CheckCircle2, color: C.emerald },
            { label: "Status ABK", value: "—", icon: AlertCircle, color: C.rose },
        ]
        : [
            { label: "Event Hari Ini", value: totalEvents, icon: Wrench, color: C.amber },
            { label: "GI Terdampak", value: giAktif, icon: Building2, color: C.indigo },
            { label: "Status OK", value: statusOk, icon: CheckCircle2, color: C.emerald },
            { label: "Status ABK", value: statusAbk, icon: AlertCircle, color: C.rose },
        ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((kpi) => {
                const Icon = kpi.icon;
                return (
                    <Card key={kpi.label} className="hover:shadow-sm transition-all duration-200">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
                                    <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                                </div>
                                <div>
                                    <p className="text-2xl font-extrabold">{kpi.value}</p>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
