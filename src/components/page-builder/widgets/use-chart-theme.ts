"use client";

import { useState, useEffect } from "react";

/**
 * useChartTheme — resolves CSS theme variables into hex values
 * for ECharts (which needs raw color strings, not CSS vars).
 *
 * Listens for theme changes (class mutations on <html>) and
 * re-resolves colors when the user toggles dark/light mode.
 */

function resolveColor(varName: string, fallback: string): string {
    if (typeof window === "undefined") return fallback;
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
    if (!raw) return fallback;

    // Convert oklch/hsl via canvas — paling akurat untuk semua color space
    try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return fallback;
        ctx.fillStyle = raw;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
    } catch {
        return fallback;
    }
}

export interface ChartThemeColors {
    /** Main text color (foreground) — axis labels, legends */
    text: string;
    /** Muted text color — secondary labels, descriptions */
    textMuted: string;
    /** Grid line / axis line color */
    gridLine: string;
    /** Card/surface background */
    surface: string;
    /** Tooltip background */
    tooltipBg: string;
    /** Tooltip text color */
    tooltipText: string;
    /** Emphasis/highlight text color */
    emphasisText: string;
}

export function useChartTheme(): ChartThemeColors {
    const [colors, setColors] = useState<ChartThemeColors>(() => resolve());

    function resolve(): ChartThemeColors {
        if (typeof window === "undefined") {
            // SSR defaults (dark)
            return {
                text: "#d4d4d8",
                textMuted: "#a1a1aa",
                gridLine: "#3f3f46",
                surface: "transparent",
                tooltipBg: "rgba(15,15,30,0.9)",
                tooltipText: "#d4d4d8",
                emphasisText: "#ffffff",
            };
        }

        const isDark = document.documentElement.classList.contains("dark");

        return {
            text: resolveColor("--foreground", isDark ? "#fafafa" : "#09090b"),
            textMuted: resolveColor("--muted-foreground", isDark ? "#9f9fa9" : "#71717a"),
            gridLine: resolveColor("--border", isDark ? "#27272a" : "#e4e4e7"),
            surface: resolveColor("--card", isDark ? "#18181b" : "#ffffff"),
            tooltipBg: resolveColor("--card", isDark ? "#18181b" : "#ffffff"),
            tooltipText: resolveColor("--foreground", isDark ? "#fafafa" : "#09090b"),
            emphasisText: resolveColor("--foreground", isDark ? "#fafafa" : "#09090b"),
        };
    }

    useEffect(() => {
        // Re-resolve on theme toggle (class change on <html>)
        const observer = new MutationObserver(() => {
            setColors(resolve());
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });
        // Also resolve on first paint
        setColors(resolve());
        return () => observer.disconnect();
    }, []);

    return colors;
}
