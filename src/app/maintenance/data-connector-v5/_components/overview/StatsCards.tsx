"use client";

/**
 * StatsCards — reusable StatCard + StatusTile components for Overview.
 */

import type { StatColor } from "./types";

export function StatCard({
    label,
    value,
    icon,
    color,
    subtitle,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: StatColor;
    subtitle?: string;
}) {
    const colorMap: Record<StatColor, string> = {
        indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        red: "text-red-400 bg-red-500/10 border-red-500/20",
    };
    return (
        <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="ds-small opacity-80">{label}</span>
            </div>
            <p className="ds-kpi">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</p>
            {subtitle && <p className="ds-small opacity-70 mt-1">{subtitle}</p>}
        </div>
    );
}

export function StatusTile({
    label,
    count,
    color,
}: {
    label: string;
    count: number;
    color: "emerald" | "blue" | "amber" | "red";
}) {
    const colorMap = {
        emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        red: "bg-red-500/10 text-red-400 border-red-500/30",
    }[color];
    return (
        <div className={`rounded-lg border p-3 text-center ${colorMap}`}>
            <p className="ds-kpi">{count}</p>
            <p className="ds-small opacity-80 mt-1">{label}</p>
        </div>
    );
}

export function ActivityRow({
    icon,
    label,
    value,
    time,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    time?: string | null;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {icon}
                <span className="ds-label">{label}</span>
            </div>
            <div className="text-right">
                <p className="text-sm">{value}</p>
                {time && <p className="ds-small opacity-60">{new Date(time).toLocaleString("id-ID")}</p>}
            </div>
        </div>
    );
}
