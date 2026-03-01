/* ── Page Layout Configuration Types ──
 * Defines the JSON schema for page layouts.
 * These configs are saved by the Page Builder and read by the PageRenderer.
 */

import type { WidgetType } from "@/components/page-builder/widgets";

/** Single widget instance in a layout */
export interface WidgetConfig {
    /** Unique widget ID within the page */
    id: string;
    /** Widget type (maps to WIDGET_TYPES registry) */
    type: WidgetType;
    /** Sheet name to pull data from */
    source: string;
    /** Primary column for the widget (category/label column) */
    column?: string;
    /** Additional columns (for tables, multi-series charts) */
    columns?: string[];
    /** Aggregation type */
    aggregate?: "count" | "unique" | "sum" | "avg" | "min" | "max";
    /** Display title (defaults to auto-generated) */
    title?: string;
    /** Max items to show (for charts) */
    maxItems?: number;
    /** Custom color map (for donut charts) */
    colorMap?: Record<string, string>;
    /** Whether clicks on this widget trigger cross-filter */
    clickToFilter?: boolean;
    /** Column to filter when clicked (defaults to same as `column`) */
    filterColumn?: string;

    /* ── Grid layout (react-grid-layout format) ── */
    /** Grid column position (0-based) */
    x: number;
    /** Grid row position (0-based) */
    y: number;
    /** Width in grid units (out of 12) */
    w: number;
    /** Height in grid units */
    h: number;

    /* ── KPI specific ── */
    /** Lucide icon name for KPI cards */
    icon?: string;
    /** Accent color hex for KPI cards */
    color?: string;
    /** Display label for KPI cards */
    label?: string;

    /* ── Bar chart specific ── */
    /** Label formatter function name */
    labelFormatter?: string;

    /* ── Table specific ── */
    /** Table column definitions */
    tableColumns?: {
        key: string;
        label: string;
        expandOnly?: boolean;
        clickable?: boolean;
        statusColors?: Record<string, string>;
        maxWidth?: string;
        mono?: boolean;
        bold?: boolean;
    }[];
}

/** Full page layout configuration */
export interface PageLayoutConfig {
    /** Page route path (e.g. "/proteksi/asset") */
    pagePath: string;
    /** Display title for the page */
    title: string;
    /** Page description / subtitle */
    description?: string;
    /** Lucide icon name for the page header */
    icon?: string;
    /** Layout mode: "auto" generates default layout, "manual" uses explicit widget configs */
    mode: "auto" | "manual";
    /** Enable cross-filtering between widgets */
    crossFilter?: boolean;
    /** Widget configurations */
    widgets: WidgetConfig[];
}
