/* ── Widget Component Registry ──
 * Central barrel export for all Page Builder widgets.
 * Import widgets from here: import { KpiCard, DonutChartWidget } from "@/components/page-builder/widgets"
 */

export { KpiCard, type KpiCardProps } from "./kpi-card";
export { DonutChartWidget, type DonutChartWidgetProps } from "./donut-chart";
export { BarChartWidget, type BarChartWidgetProps } from "./bar-chart";
export { HorizontalBarWidget, type HorizontalBarWidgetProps } from "./horizontal-bar";
export { DataTableWidget, type DataTableWidgetProps, type DataTableColumn } from "./data-table";
export { COLORS, CHART_COLORS, ECHART_BASE, ECHART_TOOLTIP, countBy } from "./shared";

/* ── Widget Type Registry ──
 * Maps widget type strings (used in layout configs) to component metadata.
 * The PageRenderer will use this to resolve "bar-chart" → BarChartWidget etc.
 */
export const WIDGET_TYPES = {
    "kpi-card": { label: "🔢 Kartu KPI", description: "Angka besar dengan ikon" },
    "donut-chart": { label: "🍩 Donut Chart", description: "Pie/donut chart untuk distribusi" },
    "bar-chart": { label: "📊 Bar Chart", description: "Bar chart vertikal" },
    "horizontal-bar": { label: "📊 Horizontal Bar", description: "Bar chart horizontal" },
    "data-table": { label: "📋 Tabel Data", description: "Tabel dengan pagination" },
} as const;

export type WidgetType = keyof typeof WIDGET_TYPES;
