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

    // oklch / hsl values need to be wrapped in css color functions
    // We convert via a temp element to get a usable hex/rgb
    const el = document.createElement("div");
    el.style.color = raw.startsWith("oklch") || raw.startsWith("hsl")
        ? raw
        : `oklch(${raw})`;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);

    return computed || fallback;
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
            text: resolveColor("--foreground", isDark ? "#d4d4d8" : "#18181b"),
            textMuted: resolveColor("--muted-foreground", isDark ? "#a1a1aa" : "#71717a"),
            gridLine: resolveColor("--border", isDark ? "#3f3f46" : "#e4e4e7"),
            surface: "transparent",
            tooltipBg: isDark ? "rgba(15,15,30,0.92)" : "rgba(255,255,255,0.95)",
            tooltipText: resolveColor("--foreground", isDark ? "#d4d4d8" : "#18181b"),
            emphasisText: resolveColor("--foreground", isDark ? "#ffffff" : "#09090b"),
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
