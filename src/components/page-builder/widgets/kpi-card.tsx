"use client";

import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

export interface KpiCardProps {
    /** Display label (e.g. "Total Relay") */
    label: string;
    /** The value to display (already formatted) */
    value: string | number;
    /** Lucide icon component */
    icon: LucideIcon;
    /** Accent color hex (e.g. "#818cf8") */
    color: string;
}

export function KpiCard({ label, value, icon: Icon, color }: KpiCardProps) {
    return (
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <div>
                        <p className="text-2xl font-extrabold">{value}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            {label}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
