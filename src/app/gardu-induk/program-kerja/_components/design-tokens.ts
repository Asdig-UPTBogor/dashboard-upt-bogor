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

/* ═══ WARNA — shadcn preset b1GeGklyk (warm amber) ═══ */
export const COLORS = {
  /* Preset chart colors — langsung dari CSS variables */
  chart1: "#ffd230",   // --chart-1
  chart2: "#fe9a00",   // --chart-2
  chart3: "#e17100",   // --chart-3
  chart4: "#bb4d00",   // --chart-4
  chart5: "#973c00",   // --chart-5

  /* Semantic */
  selesai: "#34d399",  // emerald — tetap hijau untuk "done"
  belum: "#ff6467",    // --destructive — merah untuk "belum"

  /* Mapped aliases — old names → preset equivalents */
  indigo: "#ffd230",   // was #818cf8 → now chart-1 (amber)
  teal: "#fe9a00",     // was #2dd4bf → now chart-2
  amber: "#ffd230",    // was #fbbf24 → now chart-1
  emerald: "#34d399",  // tetap hijau
  rose: "#ff6467",     // was #fb7185 → now destructive
  blue: "#e17100",     // was #60a5fa → now chart-3
  purple: "#bb4d00",   // was #c084fc → now chart-4
  cyan: "#973c00",     // was #22d3ee → now chart-5
  orange: "#fe9a00",   // was #fb923c → now chart-2
  pink: "#ff6467",     // was #f472b6 → now destructive

  /* Extended palette — preset 5 + complementary neutral tones */
  palette: ["#ffd230", "#fe9a00", "#e17100", "#bb4d00", "#973c00", "#fafafa", "#9f9fa9", "#e4e4e7", "#27272a", "#ff6467"],

  /* Surface colors — match preset exactly */
  background: "#09090b",  // --background
  card: "#18181b",         // --card
  foreground: "#fafafa",   // --foreground
  muted: "#27272a",        // --muted
  mutedFg: "#9f9fa9",      // --muted-foreground
  primary: "#e4e4e7",      // --primary
  destructive: "#ff6467",  // --destructive

  cardBorder: "rgba(255,255,255,0.10)",  // --border
  cardBg: "#18181b",       // solid card, bukan transparent
  tooltipBg: "#18181b",    // solid tooltip
  tooltipBorder: "rgba(255,255,255,0.10)",
  gridLine: "rgba(255,255,255,0.08)",
  accentGlow: "rgba(255,210,48,0.3)",  // glow dari chart-1
} as const;

/* ═══ LAYOUT ═══ */
export const LAYOUT = {
  sectionGap: "gap-4",
  cardGap: "gap-2",
  cardPadding: "p-2",
  cardPaddingTight: "p-1",
  headerPadding: "p-2 pb-1",
  tableRowHeight: "h-7",
  tableFontSize: "text-xs",
  tableHeaderSize: "text-xs",
} as const;

/* ═══ FONT ═══ */
export const TEXT = {
  kpiValue: "text-2xl",
  kpiLabel: "text-xs",
  kpiSuffix: "text-xs",
  cardTitle: "text-sm",
  badge: "text-xs",
  chartLabel: 10,
  chartAxisLabel: 11,
  chartTooltip: 12,
  donutCenter: 26,
  donutCenterLabel: 10,
} as const;

/* ═══ CHART ═══ */
export const CHART = {
  donut: {
    innerRadius: "40%",       // inner hole
    outerRadius: "85%",       // outer edge
    center: ["50%", "50%"] as [string, string],
    startAngle: 0,
    padAngle: 0,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#18181b",
    labelFontSize: 11,
    labelLineLength1: 15,
    labelLineLength2: 20,
    labelLineSmooth: 0.3,
    labelLineColor: "#a1a1aa",
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
