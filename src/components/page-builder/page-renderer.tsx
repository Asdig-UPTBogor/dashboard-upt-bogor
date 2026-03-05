"use client";

import { useState, useMemo, useCallback } from "react";
import {
    RefreshCw, Clock, AlertTriangle, Search,
    Shield, Zap, Building2, Radio, Filter,
    BarChart3, Table2, PieChart, LayoutGrid,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageData } from "@/hooks/usePageData";
import type { PageLayoutConfig, WidgetConfig } from "@/lib/page-layout-types";
import {
    KpiCard,
    DonutChartWidget,
    BarChartWidget,
    HorizontalBarWidget,
    DataTableWidget,
    COLORS,
    type DataTableColumn,
} from "@/components/page-builder/widgets";
import type { LucideIcon } from "lucide-react";

/* ── Icon resolver ── */
const ICON_MAP: Record<string, LucideIcon> = {
    Shield, Zap, Building2, Radio, Filter,
    BarChart3, Table2, PieChart, LayoutGrid, Clock,
};

function resolveIcon(name?: string): LucideIcon {
    return (name && ICON_MAP[name]) || LayoutGrid;
}

/* ── Color resolver ── */
function resolveColor(color?: string): string {
    if (!color) return COLORS.indigo;
    if (color.startsWith("#")) return color;
    return (COLORS as Record<string, string>)[color] || COLORS.indigo;
}

/* ━━━━━━━━━━━━━━━━━━ PAGE RENDERER ━━━━━━━━━━━━━━━━━━ */

interface PageRendererProps {
    config: PageLayoutConfig;
}

export function PageRenderer({ config }: PageRendererProps) {
    const { sheets, loading, error, fetchedAt, refetch, getSheet } = usePageData(config.pagePath);

    /* ── Cross-filter state ── */
    const [filters, setFilters] = useState<Record<string, string | null>>({});
    const [searchTerm, setSearchTerm] = useState("");

    /* ── Get all data from sheets ── */
    const allData = useMemo(() => {
        const result: Record<string, Record<string, unknown>[]> = {};
        sheets.forEach((s) => {
            result[s.sheetName] = (s.rows || []) as unknown as Record<string, unknown>[];
        });
        return result;
    }, [sheets]);

    /* ── Apply cross-filter ── */
    const getFilteredData = useCallback(
        (source: string): Record<string, unknown>[] => {
            let rows = allData[source] || [];

            // Apply active filters
            Object.entries(filters).forEach(([col, val]) => {
                if (val) {
                    rows = rows.filter((r) => String(r[col] || "") === val);
                }
            });

            // Apply search
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                rows = rows.filter((r) =>
                    Object.values(r).some((v) => String(v || "").toLowerCase().includes(s))
                );
            }

            return rows;
        },
        [allData, filters, searchTerm]
    );

    /* ── Filter toggle ── */
    const handleFilterClick = useCallback(
        (column: string, value: string) => {
            setFilters((prev) => ({
                ...prev,
                [column]: prev[column] === value ? null : value,
            }));
        },
        []
    );

    const clearFilters = useCallback(() => {
        setFilters({});
        setSearchTerm("");
    }, []);

    const hasFilters = Object.values(filters).some(Boolean) || searchTerm;

    /* ── Render a single widget ── */
    const renderWidget = (widget: WidgetConfig) => {
        const data = getFilteredData(widget.source);
        const Icon = resolveIcon(widget.icon);

        switch (widget.type) {
            case "kpi-card": {
                let value: string | number = 0;
                if (widget.aggregate === "count" || !widget.aggregate) {
                    value = data.length.toLocaleString();
                } else if (widget.aggregate === "unique" && widget.column) {
                    value = new Set(data.map((r) => String(r[widget.column!] || "")).filter(Boolean)).size.toLocaleString();
                } else if (widget.column) {
                    const nums = data.map((r) => Number(r[widget.column!])).filter((n) => !isNaN(n));
                    if (widget.aggregate === "sum") value = nums.reduce((a, b) => a + b, 0).toLocaleString();
                    else if (widget.aggregate === "avg") value = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length).toLocaleString() : "0";
                    else if (widget.aggregate === "min") value = Math.min(...nums).toLocaleString();
                    else if (widget.aggregate === "max") value = Math.max(...nums).toLocaleString();
                }
                return (
                    <KpiCard
                        label={widget.label || widget.title || widget.column || "Total"}
                        value={value}
                        icon={Icon}
                        color={resolveColor(widget.color)}
                    />
                );
            }

            case "donut-chart":
                return (
                    <DonutChartWidget
                        title={widget.title || `Distribusi ${widget.column}`}
                        icon={Icon}
                        data={data}
                        column={widget.column || ""}
                        maxSlices={widget.maxItems || 10}
                        colorMap={widget.colorMap}
                        clickable={widget.clickToFilter}
                        onSliceClick={
                            widget.clickToFilter
                                ? (value) => handleFilterClick(widget.filterColumn || widget.column || "", value)
                                : undefined
                        }
                        badgeText={widget.clickToFilter ? "Klik untuk filter" : undefined}
                        height={widget.h * 150}
                    />
                );

            case "bar-chart":
                return (
                    <BarChartWidget
                        title={widget.title || `Chart ${widget.column}`}
                        icon={Icon}
                        data={data}
                        column={widget.column || ""}
                        maxBars={widget.maxItems || 15}
                        height={widget.h * 150}
                    />
                );

            case "horizontal-bar":
                return (
                    <HorizontalBarWidget
                        title={widget.title || `Distribusi ${widget.column}`}
                        icon={Icon}
                        data={data}
                        column={widget.column || ""}
                        maxBars={widget.maxItems || 8}
                        height={widget.h * 130}
                    />
                );

            case "data-table": {
                const columns: DataTableColumn[] = widget.tableColumns ||
                    (widget.columns || []).map((col) => ({
                        key: col,
                        label: col,
                    }));
                return (
                    <DataTableWidget
                        title={widget.title || "Data"}
                        icon={Icon}
                        data={data}
                        columns={columns}
                        onCellClick={
                            widget.clickToFilter
                                ? (col, val) => handleFilterClick(col, val)
                                : undefined
                        }
                    />
                );
            }

            default:
                return (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground text-sm">
                            Widget type &quot;{widget.type}&quot; belum tersedia
                        </CardContent>
                    </Card>
                );
        }
    };

    /* ── Sort widgets by position (top-left to bottom-right) ── */
    const sortedWidgets = useMemo(
        () => [...config.widgets].sort((a, b) => a.y - b.y || a.x - b.x),
        [config.widgets]
    );

    /* ── Group widgets into rows ── */
    const widgetRows = useMemo(() => {
        const rows: WidgetConfig[][] = [];
        let currentY = -1;
        let currentRow: WidgetConfig[] = [];

        sortedWidgets.forEach((w) => {
            if (w.y !== currentY) {
                if (currentRow.length > 0) rows.push(currentRow);
                currentRow = [w];
                currentY = w.y;
            } else {
                currentRow.push(w);
            }
        });
        if (currentRow.length > 0) rows.push(currentRow);
        return rows;
    }, [sortedWidgets]);

    const PageIcon = resolveIcon(config.icon);

    /* ━━━━ LOADING ━━━━ */
    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-80" />
            </div>
        );
    }

    /* ━━━━ ERROR — show as banner, not blocking ━━━━ */
    const dataWarning = error && !loading;

    /* ━━━━ RENDER ━━━━ */
    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <PageIcon className="h-6 w-6 text-indigo-400" />
                        {config.title}
                    </h1>
                    {config.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                            {config.description}
                            <span className="text-emerald-400 ml-2">
                                <Clock className="h-3 w-3 inline" />{" "}
                                <span suppressHydrationWarning>
                                    {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("id-ID") : "—"}
                                </span>
                            </span>
                        </p>
                    )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Reset Filter
                        </button>
                    )}
                    <button onClick={refetch} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors">
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Data warning banner ── */}
            {dataWarning && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-300">
                        Data belum tersedia — pastikan data source sudah terhubung di{" "}
                        <a href="/maintenance/data-source" className="underline hover:text-amber-200">Data Source Manager</a>
                    </span>
                    <button onClick={refetch} className="ml-auto text-xs px-2 py-1 rounded border border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
                        <RefreshCw className="h-3 w-3 inline mr-1" /> Retry
                    </button>
                </div>
            )}

            {/* ── Search (if cross-filter enabled) ── */}
            {config.crossFilter && (
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari data..."
                            className="w-full text-xs pl-7 pr-3 py-1.5 rounded-md border bg-background text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>
            )}

            {/* ── Active filter badges ── */}
            {hasFilters && (
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-xs text-muted-foreground">Filter aktif:</span>
                    {Object.entries(filters).map(([col, val]) =>
                        val ? (
                            <Badge
                                key={col}
                                variant="secondary"
                                className="text-xs cursor-pointer"
                                onClick={() => handleFilterClick(col, val)}
                            >
                                {col}: {val} ✕
                            </Badge>
                        ) : null
                    )}
                    {searchTerm && (
                        <Badge variant="secondary" className="text-xs">
                            Cari: &quot;{searchTerm}&quot;
                        </Badge>
                    )}
                </div>
            )}

            {/* ── Widget Grid ── */}
            {widgetRows.map((row, rowIdx) => {
                // Calculate grid template based on widget widths
                const totalW = row.reduce((sum, w) => sum + w.w, 0);
                const gridCols = totalW <= 4 ? `grid-cols-${totalW}` : "grid-cols-12";

                return (
                    <div key={rowIdx} className={`grid ${gridCols} gap-4`}>
                        {row.map((widget) => (
                            <div
                                key={widget.id}
                                className={`col-span-${widget.w}`}
                                style={{
                                    gridColumn: `span ${widget.w} / span ${widget.w}`,
                                }}
                            >
                                {renderWidget(widget)}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
