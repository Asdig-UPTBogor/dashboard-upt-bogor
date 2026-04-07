/**
 * Design tokens for Healthy Index MTU page.
 * Centralised, single-source-of-truth: every visual constant lives here.
 * Import `COLORS`, `LAYOUT`, `TEXT`, `CHART`, `ANIM` to keep components
 * tiny and consistent.
 */

/* ── Colour palette ── */
export const COLORS = {
    /* Chart palette (ordered) */
    emerald: "#34d399",
    green: "#22c55e",
    amber: "#fbbf24",
    orange: "#fb923c",
    rose: "#fb7185",

    indigo: "#818cf8",
    teal: "#2dd4bf",
    purple: "#c084fc",
    blue: "#60a5fa",
    cyan: "#22d3ee",
    pink: "#f472b6",

    /* Semantic — Status HI */
    statusHi: {
        "VERY GOOD": "#34d399",
        GOOD: "#22c55e",
        FAIR: "#fbbf24",
        POOR: "#fb923c",
        CRITICAL: "#fb7185",
    } as Record<string, string>,

    /* Semantic — Prioritas */
    prioritas: {
        P0: "#fb7185",
        P1: "#fb923c",
        P2: "#2dd4bf",
    } as Record<string, string>,

    /* Semantic — Status Usia */
    statusUsia: {
        MUDA: "#34d399",
        TUA: "#fbbf24",
        "SANGAT TUA": "#fb7185",
    } as Record<string, string>,

    /* Semantic — Criticality GI */
    criticality: {
        EXTREME: "#fb7185",
        "SANGAT TINGGI": "#fb923c",
        TINGGI: "#fbbf24",
        MODERAT: "#60a5fa",
        RENDAH: "#34d399",
    } as Record<string, string>,

    /* UI chrome */
    cardBorder: "rgba(129,140,248,0.12)",
    cardBg: "rgba(15,15,30,0.45)",
    tooltipBg: "rgba(15,15,30,0.95)",
    gridLine: "rgba(63,63,70,0.3)",
    accentGlow: "rgba(129,140,248,0.15)",
    activeBorder: "rgba(129,140,248,0.5)",
    dimOpacity: 0.08,
} as const;

/* Ordered keys for consistent chart rendering */
export const STATUS_HI_ORDER = ["VERY GOOD", "GOOD", "FAIR", "POOR", "CRITICAL"] as const;

/* Indonesian label map — single source of truth for the whole page */
export const STATUS_HI_LABEL: Record<string, string> = {
    "VERY GOOD": "Sangat Baik",
    GOOD:        "Baik",
    FAIR:        "Cukup",
    POOR:        "Buruk",
    CRITICAL:    "Kritis",
};
export const PRIORITAS_ORDER = ["P0", "P1", "P2"] as const;
export const USIA_ORDER = ["MUDA", "TUA", "SANGAT TUA"] as const;

/* ── Layout ── */
export const LAYOUT = {
    sectionGap: "gap-2",
    cardGap: "gap-2",
    cardPadding: "p-2",
    tableCellH: "h-8",
    tableFontSize: "text-xs",
    tableHeaderFont: "text-[10px]",
    pageSize: 50,
} as const;

/* ── Typography ── */
export const TEXT = {
    kpiValue: "text-2xl font-bold tracking-tight",
    kpiLabel: "text-[11px] text-muted-foreground",
    sectionTitle: "text-sm font-semibold",
    badgeFont: "text-[9px] font-medium",
    chartLabel: 11,
    chartAxisLabel: 10,
    chartTooltip: 12,
} as const;

/* ── Chart presets ── */
export const CHART = {
    donut: {
        innerRadius: "44%",   // golden ratio: outer(72) / 1.618 ≈ 44.5%
        outerRadius: "78%",
        padAngle: 2,
        borderRadius: 6,
        selectedOffset: 10,
        emphasis: { scaleSize: 6 },
    },
    bar: {
        rowHeight: 28,
        barMaxWidth: 24,
        borderRadius: [0, 4, 4, 0],
    },
    animation: {
        type: "scale" as const,
        duration: 800,
        easing: "cubicOut" as const,
    },
} as const;

/* ── Animations ── */
export const ANIM = {
    easing: "ease-out",
    hoverCard: "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
    activeCard: "ring-2 ring-indigo-400/50 shadow-[0_0_20px_rgba(129,140,248,0.15)]",
    filterTransition: "transition-opacity duration-300",
    collapseTransition: "transition-[grid-template-rows] duration-300 ease-out",
} as const;
