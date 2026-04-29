// @ts-nocheck - reference copy from Claude Designer, canonical source in src/lib/
/**
 * ═══════════════════════════════════════════════════════
 * UPT Bogor — Design Tokens v2.0
 * Visual language: CE Next Level Dashboard
 * ═══════════════════════════════════════════════════════
 * Cara pakai:
 *   Ubah warna?        → edit COLORS
 *   Ubah gap/padding?  → edit LAYOUT
 *   Ubah donut shape?  → edit CHART.donut
 *   Ubah bar height?   → edit CHART.bar
 */

/* ═══ WARNA ═══ */
export const COLORS = {
  /* Chart palette — CE Next Level exact */
  blue:    "#5b8def",
  teal:    "#4cc9c0",
  amber:   "#f3c14b",   /* primary accent */
  emerald: "#3ecf8e",
  rose:    "#e5484d",   /* critical / open */
  orange:  "#f08a3e",
  purple:  "#b07cf0",
  cyan:    "#4cc9c0",
  green:   "#8dd884",
  indigo:  "#5b8def",
  pink:    "#f08a3e",

  /* Semantic status */
  selesai: "#3ecf8e",   /* close / done / very-good */
  belum:   "#e5484d",   /* open  / pending / critical */
  nonTarget: "#f3c14b", /* non-target / fair */

  /* Ordered palette for donuts / bars */
  palette: [
    "#5b8def",  /* 0: blue    */
    "#4cc9c0",  /* 1: teal    */
    "#f3c14b",  /* 2: amber   */
    "#f08a3e",  /* 3: orange  */
    "#b07cf0",  /* 4: purple  */
    "#3ecf8e",  /* 5: emerald */
    "#e5484d",  /* 6: red     */
    "#8dd884",  /* 7: green   */
    "#60a5fa",  /* 8: sky     */
    "#f472b6",  /* 9: pink    */
  ],

  /* Condition scale (CE Next Level) */
  condVeryGood: "#3ecf8e",
  condGood:     "#8dd884",
  condFair:     "#f3c14b",
  condPoor:     "#f08a3e",
  condCritical: "#e5484d",

  /* Card / tooltip */
  cardBorder:    "rgba(255,255,255,0.06)",
  cardBg:        "rgba(255,255,255,0.03)",
  tooltipBg:     "rgba(11,13,16,0.97)",
  tooltipBorder: "rgba(243,193,75,0.25)",
  gridLine:      "rgba(255,255,255,0.04)",
  accentGlow:    "rgba(243,193,75,0.25)",
} as const;

/* ═══ LAYOUT ═══ */
export const LAYOUT = {
  sectionGap:      "gap-3",
  cardGap:         "gap-2",
  cardPadding:     "p-2",
  cardPaddingTight:"p-1.5",
  headerPadding:   "px-3 py-2",
  tableRowHeight:  "h-7",
  tableFontSize:   "text-xs",
  tableHeaderSize: "text-[10.5px]",
} as const;

/* ═══ FONT ═══ */
export const TEXT = {
  kpiValue:       "text-2xl",
  kpiLabel:       "text-[10.5px]",
  kpiSuffix:      "text-xs",
  cardTitle:      "text-sm",
  badge:          "text-xs",
  chartLabel:     10,
  chartAxisLabel: 11,
  chartTooltip:   12,
  donutCenter:    24,
  donutCenterLabel: 10,
} as const;

/* ═══ CHART ═══ */
export const CHART = {
  donut: {
    innerRadius: "40%",
    outerRadius: "82%",
    center:      ["50%", "50%"] as [string, string],
    startAngle:  0,
    padAngle:    2,
    borderRadius: 5,
    borderWidth:  2,
    borderColor:  "#12151a",    /* --card dark */
    labelFontSize:    11,
    labelLineLength1: 14,
    labelLineLength2: 18,
    labelLineSmooth:  0.3,
    labelLineColor:   "#6b7380",
    labelLineWidth:   1,
    selectedOffset:   8,
    dimOpacity:       0.08,
    glowBlur:         16,
    animDuration:     700,
  },

  bar: {
    rowHeight:    28,
    barWidth:     "60%",
    borderRadius: [0, 5, 5, 0] as [number, number, number, number],
    leftMargin:   240,
    rightMargin:  52,
    labelWidth:   230,
    labelTruncate:45,
    bgOpacity:    0.03,
    /* Gradient per progress level */
    gradient: {
      full:   { from: "#059669", to: "#3ecf8e" },
      high:   { from: "#3b82f6", to: "#4cc9c0" },
      medium: { from: "#5b4fd4", to: "#5b8def" },
      zero:   { from: "#374151", to: "#4b5563" },
    },
    animDuration: 600,
  },

  kpi: {
    iconSize:   "h-4 w-4",
    iconBgSize: "p-1.5",
  },
} as const;

/* ═══ ANIMATION ═══ */
export const ANIM = {
  chartEasing:      "cubicOut" as const,
  hoverTransition:  "transition-all duration-200 ease-out",
  filterTransition: "transition-all duration-300 ease-out",
  chartTransition:  "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
} as const;

/* ═══ CONDITION BADGE HELPER ═══ */
export function conditionClass(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("very") || c.includes("sangat baik")) {
    return "bg-emerald-500/12 text-emerald-400 border border-emerald-500/25";
  }
  if (c.includes("good") || c.includes("baik")) {
    return "bg-green-500/12 text-green-400 border border-green-500/25";
  }
  if (c.includes("fair") || c.includes("sedang")) {
    return "bg-amber-500/12 text-amber-400 border border-amber-500/25";
  }
  if (c.includes("poor") || c.includes("buruk")) {
    return "bg-orange-500/12 text-orange-400 border border-orange-500/25";
  }
  if (c.includes("critical") || c.includes("kritis")) {
    return "bg-red-500/12 text-red-400 border border-red-500/25";
  }
  if (c.includes("close") || c.includes("selesai")) {
    return "bg-emerald-500/12 text-emerald-400 border border-emerald-500/25";
  }
  if (c.includes("open") || c.includes("belum")) {
    return "bg-red-500/12 text-red-400 border border-red-500/25";
  }
  return "bg-zinc-500/12 text-zinc-400 border border-zinc-500/25";
}
