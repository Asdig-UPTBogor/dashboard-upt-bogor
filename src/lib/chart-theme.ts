/**
 * UPT Bogor — ECharts Unified Theme v2.0
 * Visual: CE Next Level Dashboard
 *
 * Usage:
 *   import { makeDonutOption, makeBarOption, CHART_BASE } from "@/lib/chart-theme";
 */

import type { EChartsOption } from "echarts";

/* ── Palette ── */
export const PALETTE = [
  "#5b8def",  // blue
  "#4cc9c0",  // teal
  "#f3c14b",  // amber
  "#f08a3e",  // orange
  "#b07cf0",  // purple
  "#3ecf8e",  // emerald
  "#e5484d",  // red
  "#8dd884",  // green
] as const;

/* ── Base ── */
export const CHART_BASE: Partial<EChartsOption> = {
  backgroundColor: "transparent",
  textStyle: {
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#6b7380",
  },
};

/* ── Tooltip ── */
export const TOOLTIP_STYLE = {
  backgroundColor: "#0b0d10",
  borderColor: "rgba(243,193,75,0.22)",
  borderWidth: 1,
  borderRadius: 8,
  padding: [10, 14] as [number, number],
  textStyle: { color: "#e6eaf0", fontSize: 12 },
  extraCssText:
    "backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,0.45),0 0 0 1px rgba(243,193,75,0.08);",
} as const;

/* ── Axis (shared) ── */
export const AXIS_STYLE = {
  axisLine:  { show: false },
  axisTick:  { show: false },
  axisLabel: {
    fontSize: 11,
    color: "#6b7380",
    fontFamily: "'JetBrains Mono', monospace",
  },
  splitLine: {
    lineStyle: { color: "rgba(255,255,255,0.04)", type: "dashed" as const },
  },
} as const;

/* ── Bar gradient ── */
export type LinearGradient = {
  type: "linear"; x: number; y: number; x2: number; y2: number;
  colorStops: { offset: number; color: string }[];
};

export function barGradient(pct: number): LinearGradient {
  const [from, to] =
    pct >= 100 ? ["#059669", "#3ecf8e"] :
    pct >= 50  ? ["#3b82f6", "#4cc9c0"] :
    pct > 0    ? ["#5b4fd4", "#5b8def"] :
                 ["#374151", "#4b5563"];
  return {
    type: "linear", x: 0, y: 0, x2: 1, y2: 0,
    colorStops: [{ offset: 0, color: from }, { offset: 1, color: to }],
  };
}

/* ══════════════════════════════════════════════════════════
   DONUT CHART — polished ECharts config
   ══════════════════════════════════════════════════════════ */

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

interface DonutOptions {
  /** Text shown below center number. Default: "total" */
  centerLabel?: string;
  /** Currently selected slice name — others will dim */
  selected?: string | null;
  /** Show outer labels with lines. Default: true */
  showLabels?: boolean;
  /** Inner hole radius. Default: "42%" */
  innerRadius?: string;
  /** Outer radius. Default: "80%" */
  outerRadius?: string;
  /** Chart center. Default: ["50%", "45%"] */
  center?: [string, string];
  /** Max label characters before truncate. Default: 18 */
  maxLabelLen?: number;
  /** Animation duration ms. Default: 700 */
  animDuration?: number;
}

export function makeDonutOption(
  data: DonutSlice[],
  options: DonutOptions = {},
): EChartsOption {
  const {
    centerLabel    = "total",
    selected       = null,
    showLabels     = true,
    innerRadius    = "42%",
    outerRadius    = "80%",
    center         = ["50%", "45%"],
    maxLabelLen    = 18,
    animDuration   = 700,
  } = options;

  const total = data.reduce((s, d) => s + d.value, 0);

  // Auto-assign palette if no color provided
  const slices = data.map((d, i) => ({
    ...d,
    color: d.color ?? PALETTE[i % PALETTE.length],
  }));

  // Center number — show selected value or total
  const centerNum = selected
    ? (slices.find(d => d.name === selected)?.value ?? total)
    : total;

  const truncate = (s: string) =>
    s.length > maxLabelLen ? s.slice(0, maxLabelLen - 1) + "…" : s;

  return {
    ...CHART_BASE,

    tooltip: {
      trigger: "item",
      ...TOOLTIP_STYLE,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `<div style="font-weight:700;color:#e6eaf0;margin-bottom:4px">${p.name}</div>` +
        `<span style="color:#6b7380">Jumlah: </span>` +
        `<b style="color:#f3c14b">${p.value.toLocaleString("id-ID")}</b>` +
        `<span style="color:#6b7380"> (${p.percent.toFixed(1)}%)</span>`,
    },

    /* Center text via graphic layer */
    graphic: [
      {
        type: "text",
        left: "center",
        top: center[1] === "50%" ? "42%" : "36%",
        z: 10,
        style: {
          text: centerNum.toLocaleString("id-ID"),
          fontSize: 28,
          fontWeight: "bold",
          fontFamily: "'JetBrains Mono', monospace",
          fill: selected
            ? (slices.find(d => d.name === selected)?.color ?? "#f3c14b")
            : "#e6eaf0",
          textAlign: "center",
        },
      },
      {
        type: "text",
        left: "center",
        top: center[1] === "50%" ? "55%" : "50%",
        z: 10,
        style: {
          text: selected
            ? truncate(selected)
            : centerLabel,
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          fill: "#6b7380",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 1,
        },
      },
    ],

    series: [
      {
        type: "pie",
        radius:   [innerRadius, outerRadius],
        center,
        startAngle: 90,       // start from top
        padAngle:   2,        // gap between slices (degrees)
        itemStyle: {
          borderRadius: 6,
          borderColor:  "#0b0d10",
          borderWidth:  2,
        },

        selectedMode: "single",
        selectedOffset: 10,

        emphasis: {
          scale: true,
          scaleSize: 10,
          itemStyle: {
            shadowBlur:  24,
            shadowColor: "rgba(243,193,75,0.35)",
          },
          label: {
            fontSize: 12,
            fontWeight: "bold" as const,
            color: "#f3c14b",
          },
        },

        /* Outer labels */
        label: {
          show: showLabels,
          color: "#a8b0bd",
          fontSize: 11,
          fontFamily: "'Inter', sans-serif",
          alignTo: "labelLine" as const,
          bleedMargin: 5,
          distanceToLabelLine: 4,
          formatter: (p: { name: string; value: number; percent: number }) => {
            const isSelected = selected && p.name === selected;
            const nameColor  = isSelected ? "#f3c14b" : "#a8b0bd";
            const valColor   = isSelected ? "#f3c14b" : "#f3c14b";
            return [
              `{name|${truncate(p.name)}}`,
              `{val|${p.value.toLocaleString("id-ID")}} {pct|(${p.percent.toFixed(0)}%)}`,
            ].join("\n");
          },
          rich: {
            name: {
              fontSize: 11,
              fontFamily: "'Inter', sans-serif",
              color: "#a8b0bd",
              lineHeight: 16,
              fontWeight: "500",
            },
            val: {
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#f3c14b",
              fontWeight: "bold",
            },
            pct: {
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#6b7380",
            },
          },
        },

        labelLine: {
          show: showLabels,
          length:  16,
          length2: 20,
          smooth:  0.4,
          minTurnAngle: 25,
          lineStyle: { color: "#323944", width: 1, type: "solid" as const },
        },

        /* Slices — dim non-selected */
        data: slices.map((d) => {
          const isSelected = selected ? d.name === selected : false;
          const isDimmed   = selected ? !isSelected : false;
          return {
            name:  d.name,
            value: d.value,
            itemStyle: {
              color: d.color,
              opacity: isDimmed ? 0.2 : 1,
            },
            emphasis: {
              itemStyle: {
                color: d.color,
                opacity: 1,
                shadowBlur:  20,
                shadowColor: d.color + "55",
              },
            },
            ...(isSelected ? { selected: true } : {}),
          };
        }),

        animationDuration: animDuration,
        animationEasing:       "cubicOut" as const,
        animationDurationUpdate: 400,
        animationEasingUpdate:   "cubicInOut" as const,
      },
    ],
  } as unknown as EChartsOption;
}

/* ══════════════════════════════════════════════════════════
   PROGRESS BAR DONUT — simpler, no labels, just ring
   Cocok untuk mini donut di KPI strip atau collapsible header
   ══════════════════════════════════════════════════════════ */

export function makeProgressDonut(
  value: number,
  max: number,
  color: string,
  size = 40,
): EChartsOption {
  const pct = max > 0 ? value / max : 0;
  return {
    backgroundColor: "transparent",
    series: [
      {
        type: "pie",
        radius: ["68%", "100%"],
        center: ["50%", "50%"],
        startAngle: 90,
        silent: true,
        label: { show: false },
        labelLine: { show: false },
        data: [
          {
            value: pct * 100,
            itemStyle: {
              color,
              borderRadius: 4,
            },
          },
          {
            value: (1 - pct) * 100,
            itemStyle: { color: "rgba(255,255,255,0.05)", borderRadius: 0 },
          },
        ],
        animationDuration: 600,
        animationEasing: "cubicOut" as const,
      },
    ],
  };
}

/* ══════════════════════════════════════════════════════════
   DONUT FACTORY — hook pattern (cocok untuk class component)
   Sama seperti useMkDonut yang ada di ce-donut-factory.ts
   ══════════════════════════════════════════════════════════ */

import { useCallback } from "react";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";

export function useDonutFactory() {
  const theme = useChartTheme();

  const mkDonut = useCallback(
    (data: { name: string; value: number; itemStyle?: { color: string } }[], selected?: string | null) => {
      return makeDonutOption(
        data.map(d => ({ name: d.name, value: d.value, color: d.itemStyle?.color })),
        { selected, showLabels: true },
      );
    },
    [theme],
  );

  return { mkDonut };
}
