/**
 * ═══════════════════════════════════════════════════════════════
 * DESIGN TOKENS — "Void Setup" untuk semua konstanta visual
 * ═══════════════════════════════════════════════════════════════
 * 
 * CARA PAKAI:
 * - Mau ubah warna?         → edit COLORS
 * - Mau ubah ukuran gap?    → edit LAYOUT
 * - Mau ubah tebal donut?   → edit CHART.donut.innerRadius / outerRadius
 * - Mau ubah tinggi bar?    → edit CHART.bar.rowHeight
 * 
 * Semua component import dari file ini. Ubah di sini = ubah everywhere.
 */

/* ═══ WARNA ═══ */
export const COLORS = {
  indigo: "#818cf8",
  teal: "#2dd4bf",
  amber: "#fbbf24",
  emerald: "#34d399",
  rose: "#fb7185",
  blue: "#60a5fa",
  purple: "#c084fc",
  cyan: "#22d3ee",
  orange: "#fb923c",
  pink: "#f472b6",

  selesai: "#34d399",
  belum: "#fb7185",

  palette: ["#818cf8", "#2dd4bf", "#fbbf24", "#fb7185", "#c084fc", "#60a5fa", "#22d3ee", "#fb923c", "#f472b6", "#34d399"],

  cardBorder: "rgba(255,255,255,0.06)",
  cardBg: "rgba(255,255,255,0.02)",
  tooltipBg: "rgba(15,15,30,0.95)",
  tooltipBorder: "rgba(129,140,248,0.3)",
  gridLine: "rgba(255,255,255,0.06)",
  accentGlow: "rgba(129,140,248,0.5)",
} as const;

/* ═══ LAYOUT ═══ */
export const LAYOUT = {
  sectionGap: "gap-4",
  cardGap: "gap-2",
  cardPadding: "p-2",
  cardPaddingTight: "p-1",
  headerPadding: "p-2 pb-1",
  tableRowHeight: "h-7",
  tableFontSize: "text-[10px]",
  tableHeaderSize: "text-[9px]",
} as const;

/* ═══ FONT ═══ */
export const TEXT = {
  kpiValue: "text-2xl",
  kpiLabel: "text-[11px]",
  kpiSuffix: "text-[11px]",
  cardTitle: "text-[13px]",
  badge: "text-[8px]",
  chartLabel: 8,
  chartAxisLabel: 10,
  chartTooltip: 11,
  donutCenter: 26,
  donutCenterLabel: 9,
} as const;

/* ═══ CHART ═══ */
export const CHART = {
  donut: {
    innerRadius: "40%",       // inner hole — kecil = lebih tebal
    outerRadius: "85%",       // outer edge — besar = chart mengisi wrapper
    center: ["50%", "52%"] as [string, string],
    startAngle: 0,
    padAngle: 0,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#18181b",
    labelFontSize: 9,
    labelLineLength1: 10,
    labelLineLength2: 8,
    labelLineSmooth: 0.3,
    labelLineColor: "#52525b",
    labelLineWidth: 1,
    selectedOffset: 8,
    dimOpacity: 0.08,
    glowBlur: 16,
    animDuration: 800,
  },

  bar: {
    // Normal state
    rowHeight: 28,
    barWidth: "60%",
    borderRadius: [0, 5, 5, 0] as [number, number, number, number],
    leftMargin: 240,
    rightMargin: 50,
    labelWidth: 230,
    labelTruncate: 45,
    bgOpacity: 0.03,
    // Focus state — saat bar diklik
    focusRowHeight: 42,       // bar yg diklik jadi lebih tinggi
    focusBarWidth: "85%",     // bar yg diklik jadi lebih lebar
    focusGlow: 16,
    dimOpacity: 0.12,
    // Gradient
    gradient: {
      full: { from: "#059669", to: "#34d399" },
      high: { from: "#3b82f6", to: "#22d3ee" },
      medium: { from: "#6366f1", to: "#818cf8" },
      zero: { from: "#374151", to: "#4b5563" },
    },
    animDuration: 600,
  },

  kpi: {
    iconSize: "h-4 w-4",
    iconBgSize: "p-1.5",
  },
} as const;

/* ═══ ANIMATION ═══ */
export const ANIM = {
  chartEasing: "cubicOut" as const,
  hoverTransition: "transition-all duration-200 ease-out",
  filterTransition: "transition-all duration-300 ease-out",
  chartTransition: "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
} as const;
