/**
 * Chart Design Tokens — Shared ECharts configuration.
 *
 * Single source of truth for ALL ECharts visual constants across all pages.
 * ECharts renders to <canvas> or <svg> — cannot use CSS variables,
 * so we provide theme-aware color sets and font sizes here.
 *
 * USAGE:
 *   import { ECHART_COLORS, ECHART_FONT, CHART, getTooltipPreset } from "@/lib/chart-tokens";
 *   import { useTheme } from "next-themes";
 *
 *   const { resolvedTheme } = useTheme();
 *   const themeKey = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";
 *   const ec = ECHART_COLORS[themeKey];
 *
 *   // In ECharts option:
 *   label: { color: ec.text }
 *   graphic: { style: { fill: ec.textStrong } }
 *   tooltip: getTooltipPreset(themeKey)
 */

/* ── Status Scale — 5 anchor colors ────────────────────────── */
const STATUS_SCALE = [
    "#22C55E", // 1: Best  (green-500)
    "#3B82F6", // 2: Good  (blue-500)
    "#EAB308", // 3: Mid   (yellow-500)
    "#F97316", // 4: Poor  (orange-500)
    "#EF4444", // 5: Worst (red-500)
] as const;

/**
 * Auto-pick colors from the 5 anchors.
 *
 * getStatusScale(5) → all 5 colors
 * getStatusScale(3) → [green, yellow, red]  (picks 1, 3, 5)
 * getStatusScale(2) → [green, red]          (picks 1, 5)
 */
export function getStatusScale(n: number): string[] {
    if (n <= 1) return [STATUS_SCALE[0]];
    if (n >= 5) return [...STATUS_SCALE];
    const indices = Array.from({ length: n }, (_, i) =>
        Math.round((i * 4) / (n - 1)),
    );
    return indices.map((i) => STATUS_SCALE[i]);
}

/* ── Build color maps from scale ──────────────────────────── */
function zipColors<T extends readonly string[]>(
    keys: T,
    colors: string[],
): Record<string, string> {
    const map: Record<string, string> = {};
    keys.forEach((k, i) => { map[k] = colors[i] ?? STATUS_SCALE[4]; });
    return map;
}

/* ── Ordered keys ─────────────────────────────────────────── */
export const STATUS_HI_ORDER = ["GOOD", "VERY GOOD", "FAIR", "POOR", "CRITICAL"] as const;
export const PRIORITAS_ORDER = ["P0", "P1", "P2"] as const;
export const USIA_ORDER = ["MUDA", "TUA", "SANGAT TUA"] as const;
export const CRITICALITY_ORDER = ["RENDAH", "MODERAT", "TINGGI", "SANGAT TINGGI", "EXTREME"] as const;

/* ── Display label map ─────────────────────────────────────── */
export const STATUS_HI_LABEL: Record<string, string> = {
    "VERY GOOD": "Very Good",
    GOOD:        "Good",
    FAIR:        "Fair",
    POOR:        "Poor",
    CRITICAL:    "Critical",
};

const scale5 = getStatusScale(5);
const scale3 = getStatusScale(3);

/* ── Color palette ────────────────────────────────────────── */
export const COLORS = {
    /* Chart palette — 5 distinguishable hues for data viz */
    chart: {
        blue:   "#3B82F6",
        amber:  "#F59E0B",
        violet: "#8B5CF6",
        cyan:   "#06B6D4",
        pink:   "#EC4899",
    },

    /* Status maps — auto-generated from scale */
    statusHi:    zipColors(STATUS_HI_ORDER, scale5),
    prioritas:   zipColors(PRIORITAS_ORDER, [...scale3].reverse()),
    statusUsia:  zipColors(USIA_ORDER, scale3),
    criticality: zipColors(CRITICALITY_ORDER, scale5),

    /* Named chart colors for non-status data (e.g. ULTG breakdown) */
    teal:   "#06B6D4",
    purple: "#8B5CF6",

    /* UI chrome */
    tooltipBg: "rgba(11,11,11,0.97)",
    gridLine:  "rgba(255,255,255,0.06)",
    dimOpacity: 0.08,
} as const;

/* ── Theme-aware ECharts colors ──────────────────────────── */
export const ECHART_COLORS = {
    dark: {
        text:             "#B3B4B5",
        textStrong:       "#F5F5F5",
        textMuted:        "#808080",
        textDim:          "#555555",
        cardBg:           "#333338",  /* synced with --card oklch(0.20 0.006 260) */
        tooltipBg:        "rgba(11,11,11,0.96)",
        tooltipText:      "#F5F5F5",
        gridLine:         "rgba(255,255,255,0.06)",
        shadow:           "rgba(0,0,0,0.5)",
        insideLabel:      "#FFFFFF",
        insideLabelDim:   "rgba(255,255,255,0.2)",
    },
    light: {
        text:             "#334155",
        textStrong:       "#0F172A",
        textMuted:        "#64748B",
        textDim:          "#94A3B8",
        cardBg:           "#FFFFFF",
        tooltipBg:        "rgba(248,250,252,0.96)",
        tooltipText:      "#334155",
        gridLine:         "rgba(15,23,42,0.06)",
        shadow:           "rgba(0,0,0,0.12)",
        insideLabel:      "#FFFFFF",
        insideLabelDim:   "rgba(255,255,255,0.2)",
    },
} as const;

/* ── ECharts Typography (canvas px values) ───────────────── */
export const ECHART_FONT = {
    label:       12,
    tooltip:     12,
    data:        14,
    title:       16,
    kpi:         18,
    hero:        28,
    insideLabel: 11,
    family:     "ui-sans-serif, system-ui, sans-serif",
    familyMono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    weight: {
        normal:    400,
        medium:    500,
        bold:      700,
    },
} as const;

/* ── Chart presets (ECharts) ──────────────────────────────── */
export const CHART = {
    donut: {
        innerRadius:    "42%",
        outerRadius:    "76%",
        padAngle:       2,
        borderRadius:   6,
        borderWidth:    2,
        selectedOffset: 10,
        startAngle:     90,
        minAngle:       0,
        minSlicePct:    10,
        labelMaxChars:  12,
        labelMaxLines:  3,
        /** Max visible slices before grouping remainder into "Lainnya" */
        maxSlices:      10,
        /** Container height (px) — responsive per breakpoint */
        containerHeight: 290,
        containerHeightMobile: 310,
        /** Responsive overrides for small screens */
        mobile: {
            outerRadius:   "62%",
            innerRadius:   "34%",
            labelMaxChars: 12,
            labelLine:     { length: 18, length2: 12 },
            labelFontSize: 10,
        },
        /* Opacity states */
        opacity: {
            normal:       1,
            dimmed:       0.15,
            labelDimmed:  0.4,
            lineDimmed:   0.3,
        },
        /* Emphasis — hover/select glow */
        emphasis: {
            scaleSize:    6,
            shadowBlur:   16,
            shadowColor:  "rgba(255,255,255,0.15)",
            selectedShadowBlur: 12,
        },
        /* Label — outside the donut ring */
        label: {
            alignTo:    "none" as const,
            fontSize:   12,
            lineHeight: {
                name: 16,
                pct:  14,
            },
        },
        /* LabelLine — connector from slice to label */
        labelLine: {
            length:  24,
            length2: 18,
            smooth:  0.3,
            width:   1.5,
        },
        /* Inside label — count number inside slices */
        insideLabel: {
            position: "inside" as const,
        },
        /* Center graphic */
        center: {
            top: "43%",
        },
        /* Animation — snappy entrance, instant updates */
        animationType:       "expansion" as const,
        animationDuration:   500,
        animationEasing:     "cubicOut" as const,
        animationDurationUpdate: 250,
        animationEasingUpdate:   "cubicInOut" as const,
    },
    bar: {
        rowHeight:  28,
        barMaxWidth: 24,
        borderRadius: [0, 4, 4, 0] as number[],
    },
    animation: {
        type: "scale" as const,
        duration: 500,
        easing: "cubicOut" as const,
    },
} as const;

/** Reusable tooltip preset — theme-aware. */
export function getTooltipPreset(theme: "dark" | "light") {
    const ec = ECHART_COLORS[theme];
    return {
        backgroundColor: ec.tooltipBg,
        borderColor: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
        borderWidth: 1,
        textStyle: { color: ec.tooltipText, fontSize: ECHART_FONT.tooltip },
        confine: true,
    };
}

/* ── Layout ───────────────────────────────────────────────── */
export const LAYOUT = {
    sectionGap:    "gap-4",
    cardGap:       "gap-3",
    cardPadding:   "p-4",
    tableCellH:    "h-9",
    tableFontSize: "text-sm",
    tableHeaderFont: "text-xs",
    pageSize: 50,
} as const;

/* ── Animations — synced with globals.css --ds-duration-* ── */
export const ANIM = {
    easing: "ease-out",
    cardTransition: "transition-all duration-150",
    filterTransition: "transition-opacity duration-150",
    collapseTransition: "transition-[grid-template-rows] duration-300 ease-out",
    /* Duration tokens (ms) — for CSS/ECharts */
    duration: {
        fast:   100,
        normal: 200,
        slow:   300,
        slower: 500,
    },
    /* Easing tokens — for ECharts */
    easings: {
        default:  "cubicOut" as const,
        spring:   [0.34, 1.56, 0.64, 1] as const,
        easeOut:  [0.16, 1, 0.3, 1] as const,
        easeIn:   [0.4, 0, 1, 1] as const,
    },
} as const;

/**
 * Framer Motion tokens (seconds).
 * Separate export — `as const` on ANIM makes arrays readonly,
 * but Framer Motion requires mutable Easing (number[]).
 */
export const MOTION = {
    dur: {
        fast:     0.15,
        normal:   0.25,
        slow:     0.3,
        slower:   0.5,
        fill:     0.7,
    },
    ease: {
        out:    [0.16, 1, 0.3, 1] as [number, number, number, number],
        in:     [0.4, 0, 1, 1] as [number, number, number, number],
        spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
    },
    stagger: {
        fast:    0.03,
        normal:  0.05,
        slow:    0.08,
    },
    sectionDelay: 0.5,
};

/* ── Framer Motion transition presets ─────────────────────── */
const M = MOTION;

/** Standard collapse/expand (AccordionContent, collapsible cards) */
export const FM_COLLAPSE = {
    initial: { height: 0, opacity: 0 },
    animate: { height: "auto" as const, opacity: 1 },
    exit:    { height: 0, opacity: 0 },
    transition: { duration: M.dur.normal },
};

/** Standard enter — cards, panels, sections */
export const FM_ENTER = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: M.dur.slow, delay, ease: M.ease.out },
});

/** Staggered list item enter */
export const FM_STAGGER = (i: number, base = 0) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: M.dur.slow, delay: base + i * M.stagger.fast, ease: M.ease.out },
});

/** Section-level stagger (used by page.tsx wrappers) */
export const FM_SECTION = (index: number) => ({
    duration: M.dur.slow,
    delay: index * M.sectionDelay,
    ease: M.ease.out,
});

/** Bar/progress fill animation — slower for visual effect */
export const FM_FILL = (i: number) => ({
    initial: { scaleX: 0 },
    animate: { scaleX: 1 },
    transition: { duration: M.dur.fill, delay: i * M.stagger.normal, ease: M.ease.out },
});

/**
 * Status colors — synced with globals.css --ds-status-*
 * Use these in ECharts (canvas can't read CSS vars).
 * For HTML/Tailwind, use the CSS vars: text-ds-status-success, bg-ds-status-error, etc.
 */
export const STATUS_COLORS = {
    success:  "#22C55E",
    warning:  "#F59E0B",
    error:    "#EF4444",
    info:     "#3B82F6",
} as const;

/* ── Elevation (for ECharts shadow) — synced with --ds-elevation-* ── */
export const ELEVATION = {
    dark: {
        1: "0 1px 3px rgba(0,0,0,0.30)",
        2: "0 2px 8px rgba(0,0,0,0.40)",
        3: "0 4px 16px rgba(0,0,0,0.45)",
        4: "0 8px 32px rgba(0,0,0,0.50)",
    },
    light: {
        1: "0 1px 2px rgba(0,0,0,0.05)",
        2: "0 2px 8px rgba(0,0,0,0.08)",
        3: "0 4px 16px rgba(0,0,0,0.10)",
        4: "0 8px 32px rgba(0,0,0,0.14)",
    },
} as const;
