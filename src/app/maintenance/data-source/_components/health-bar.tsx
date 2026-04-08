"use client";

import { Progress } from "@/components/ui/progress";

/**
 * HealthBar — shadcn Progress bar with percentage label.
 * Color-coded: green (>=90), amber (>=60), red (<60).
 */
export function HealthBar({ score }: { score: number }) {
    const colorClass = score >= 90
        ? "[&>div]:bg-emerald-400"
        : score >= 60
            ? "[&>div]:bg-amber-400"
            : "[&>div]:bg-red-400";
    const textClass = score >= 90
        ? "text-emerald-400"
        : score >= 60
            ? "text-amber-400"
            : "text-red-400";

    return (
        <div className="flex items-center gap-2">
            <Progress
                value={score}
                className={`h-1.5 w-24 bg-white/[0.06] ${colorClass}`}
            />
            <span className={`text-xs font-semibold ${textClass}`}>
                {score}%
            </span>
        </div>
    );
}
