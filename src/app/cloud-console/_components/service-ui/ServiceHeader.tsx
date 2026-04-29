import React from "react";
import { type LucideIcon } from "lucide-react";

export type HealthStatus = "healthy" | "stale" | "error" | "paused" | "running" | "unknown";

export const HEALTH_CONFIG: Record<HealthStatus, { dot: string; text: string; label: string }> = {
    healthy: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Healthy" },
    running: { dot: "bg-blue-400", text: "text-blue-400", label: "Running" },
    stale:   { dot: "bg-amber-400", text: "text-amber-400", label: "Stale" },
    error:   { dot: "bg-red-400", text: "text-red-400", label: "Error" },
    paused:  { dot: "bg-slate-400", text: "text-slate-400", label: "Paused" },
    unknown: { dot: "bg-slate-600", text: "text-slate-500", label: "Unknown" },
};

export function ServiceHeader({
    title,
    subtitle,
    icon: Icon,
    health,
}: {
    title: string;
    subtitle: string;
    icon?: LucideIcon;
    health?: HealthStatus;
}) {
    const hc = health ? HEALTH_CONFIG[health] : null;

    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                {Icon && (
                <div className="relative">
                    <div className="absolute -inset-1 rounded-2xl bg-linear-to-br from-blue-500 to-cyan-600 opacity-20 blur-lg" />
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-cyan-600">
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                </div>
                )}
                <div>
                    <h1 className="ds-heading text-xl">{title}</h1>
                    <p className="ds-body">{subtitle}</p>
                </div>
            </div>
            {hc && (
                <div className={`flex items-center gap-2 text-xs font-medium ${hc.text}`}>
                    <span className={`h-2 w-2 rounded-full ${hc.dot}`} />
                    {hc.label}
                </div>
            )}
        </div>
    );
}
