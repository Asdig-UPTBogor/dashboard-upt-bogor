import React from "react";
import { type LucideIcon } from "lucide-react";

export type HealthStatus = "healthy" | "stale" | "error" | "paused" | "running" | "unknown";

export const HEALTH_CONFIG: Record<HealthStatus, { dot: string; text: string; label: string }> = {
    healthy: { dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]", text: "text-emerald-400", label: "Healthy" },
    running: { dot: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)] animate-pulse", text: "text-blue-400", label: "Running" },
    stale:   { dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]", text: "text-amber-400", label: "Stale" },
    error:   { dot: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]", text: "text-red-400", label: "Error" },
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
    icon: LucideIcon;
    health?: HealthStatus;
}) {
    const hc = health ? HEALTH_CONFIG[health] : null;

    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 opacity-20 blur-lg" />
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600">
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
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
