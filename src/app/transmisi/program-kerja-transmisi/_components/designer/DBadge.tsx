"use client";

import type { ReactNode } from "react";

/**
 * DBadge — replicate Claude Designer Badge pattern.
 * Pakai color-mix(in oklab, color X%, transparent) untuk subtle bg.
 * Tones: neutral, very-good, good, fair, poor, critical, accent.
 */

type Tone = "neutral" | "very-good" | "good" | "fair" | "poor" | "critical" | "accent";

const TONE_COLOR: Record<Tone, string> = {
    neutral: "var(--muted-foreground)",
    "very-good": "var(--chart-2)",  // emerald
    good: "var(--chart-2)",
    fair: "var(--chart-3)",         // amber
    poor: "var(--chart-4)",         // orange
    critical: "var(--chart-7)",     // red
    accent: "var(--chart-3)",       // amber primary
};

interface DBadgeProps {
    tone?: Tone;
    /** Custom color overrides tone */
    color?: string;
    children: ReactNode;
    dot?: boolean;
    size?: "sm" | "md";
}

export function DBadge({ tone = "neutral", color, children, dot = false, size = "md" }: DBadgeProps) {
    const c = color ?? TONE_COLOR[tone];
    const mixPct = tone === "fair" || tone === "poor" || tone === "critical" ? 18 : 14;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: size === "sm" ? "2px 8px" : "3px 10px",
                background: `color-mix(in oklab, ${c} ${mixPct}%, transparent)`,
                color: c,
                borderRadius: 999,
                fontSize: size === "sm" ? 11 : 12,
                fontWeight: 500,
                lineHeight: 1.4,
                whiteSpace: "nowrap",
            }}
        >
            {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />}
            {children}
        </span>
    );
}
