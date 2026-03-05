"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    LayoutGrid, Save, Eye, Plus,
    Trash2, Settings, X,
    BarChart3, PieChart, Table2, Hash,
    AlignLeft, Columns3, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WIDGET_TYPES, type WidgetType, COLORS } from "@/components/page-builder/widgets";
import type { WidgetConfig, PageLayoutConfig } from "@/lib/page-layout-types";

/* ── Dynamic import for react-grid-layout (needs window) ── */
const GridLayout = dynamic(
    () => import("react-grid-layout").then((mod) => mod.default),
    { ssr: false }
);

/* ── Import verticalCompactor for layout compaction ── */
import { verticalCompactor } from "react-grid-layout";

/* ── Icon map for widget types ── */
const WIDGET_ICONS: Record<WidgetType, typeof BarChart3> = {
    "kpi-card": Hash,
    "donut-chart": PieChart,
    "bar-chart": BarChart3,
    "horizontal-bar": AlignLeft,
    "data-table": Table2,
};

import { getAllPages, type FlatPage } from "@/lib/sidebar-config";

/* ── Available pages (dynamically from sidebar config, excluding maintenance except test-page) ── */
const AVAILABLE_PAGES = getAllPages().filter(
    (p) => !p.path.startsWith("/maintenance") || p.path === "/maintenance/test-page"
);

/* ── Group pages by section for display ── */
const GROUPED_PAGES = AVAILABLE_PAGES.reduce<Record<string, FlatPage[]>>((acc, page) => {
    if (!acc[page.section]) acc[page.section] = [];
    acc[page.section].push(page);
    return acc;
}, {});

/* ── Default widget size per type ── */
const DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
    "kpi-card": { w: 3, h: 2 },
    "donut-chart": { w: 4, h: 3 },
    "bar-chart": { w: 8, h: 3 },
    "horizontal-bar": { w: 6, h: 3 },
    "data-table": { w: 12, h: 4 },
};

function createWidget(type: WidgetType, y: number): WidgetConfig {
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const size = DEFAULT_SIZE[type];
    return {
        id, type, source: "", column: "",
        x: 0, y,
        ...size,
        title: WIDGET_TYPES[type].label.replace(/^[^ ]+ /, ""),
        aggregate: type === "kpi-card" ? "count" : undefined,
        label: type === "kpi-card" ? "Total" : undefined,
        icon: "LayoutGrid",
        color: "indigo",
        maxItems: type === "data-table" ? undefined : 10,
        clickToFilter: type === "donut-chart" || type === "data-table",
    } as WidgetConfig;
}

/* ━━━━━━━━━━━━━━━━━━ MAIN PAGE ━━━━━━━━━━━━━━━━━━ */

export default function PageBuilderPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedPage, setSelectedPage] = useState("");
    const [pageTitle, setPageTitle] = useState("");
    const [crossFilter, setCrossFilter] = useState(true);

    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
    const [availableSheets, setAvailableSheets] = useState<string[]>([]);
    const [availableColumns, setAvailableColumns] = useState<Record<string, string[]>>({});
    const [saving, setSaving] = useState(false);
    const [gridReady, setGridReady] = useState(false);
    const [loadingLayout, setLoadingLayout] = useState(false);
    const [isEditingExisting, setIsEditingExisting] = useState(false);

    const selectedWidget = widgets.find((w) => w.id === selectedWidgetId) || null;

    /* ── Delayed grid mount (CSR only) ── */
    useEffect(() => {
        setGridReady(true);
    }, []);

    /* ── Load existing layout + sheets when page is selected ── */
    useEffect(() => {
        if (!selectedPage) return;
        const loadPageData = async () => {
            setLoadingLayout(true);
            try {
                // 1️⃣  Fetch existing layout for this page
                const layoutRes = await fetch("/api/page-layouts");
                const layoutData = await layoutRes.json();
                const existingLayout = (layoutData.layouts || []).find(
                    (l: { pagePath: string }) => l.pagePath === selectedPage
                );
                if (existingLayout?.widgets?.length) {
                    setWidgets(existingLayout.widgets);
                    setPageTitle(existingLayout.title || pageTitle);
                    setCrossFilter(existingLayout.crossFilter ?? true);
                    setIsEditingExisting(true);
                } else {
                    setWidgets([]);
                    setIsEditingExisting(false);
                }

                // 2️⃣  Fetch available sheets & columns
                const res = await fetch(`/api/page-data?page=${encodeURIComponent(selectedPage)}`);
                const data = await res.json();
                if (data.sheets) {
                    const sheetNames = data.sheets.map((s: { sheetName: string }) => s.sheetName);
                    setAvailableSheets(sheetNames);
                    const colMap: Record<string, string[]> = {};
                    data.sheets.forEach((s: { sheetName: string; rows: Record<string, unknown>[] }) => {
                        if (s.rows?.length > 0) {
                            colMap[s.sheetName] = Object.keys(s.rows[0]);
                        }
                    });
                    setAvailableColumns(colMap);
                }
            } catch {
                console.error("Failed to load page data");
            } finally {
                setLoadingLayout(false);
            }
        };
        loadPageData();
    }, [selectedPage]);

    /* ── Widget CRUD ── */
    const addWidget = useCallback((type: WidgetType) => {
        const maxY = widgets.length > 0 ? Math.max(...widgets.map((w) => w.y + w.h)) : 0;
        const newWidget = createWidget(type, maxY);
        if (availableSheets.length > 0) newWidget.source = availableSheets[0];
        setWidgets((prev) => [...prev, newWidget]);
        setSelectedWidgetId(newWidget.id);
    }, [widgets, availableSheets]);

    const removeWidget = useCallback((id: string) => {
        setWidgets((prev) => prev.filter((w) => w.id !== id));
        if (selectedWidgetId === id) setSelectedWidgetId(null);
    }, [selectedWidgetId]);

    const updateWidget = useCallback((id: string, updates: Partial<WidgetConfig>) => {
        setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
    }, []);

    /* ── Grid layout sync ── */
    const gridLayout = useMemo(() =>
        widgets.map((w) => ({
            i: w.id,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            minW: w.type === "kpi-card" ? 2 : 3,
            minH: w.type === "kpi-card" ? 2 : 2,
        })),
        [widgets]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleLayoutChange = useCallback((newLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
        setWidgets((prev) =>
            prev.map((w) => {
                const item = newLayout.find((l) => l.i === w.id);
                if (item) return { ...w, x: item.x, y: item.y, w: item.w, h: item.h };
                return w;
            })
        );
    }, []);

    /* ── Save ── */
    const handleSave = useCallback(async () => {
        if (!selectedPage || widgets.length === 0) return;
        setSaving(true);
        const config: PageLayoutConfig = {
            pagePath: selectedPage,
            title: pageTitle || AVAILABLE_PAGES.find((p) => p.path === selectedPage)?.label || "Dashboard",
            mode: "manual",
            crossFilter,
            widgets,
        };
        try {
            const res = await fetch("/api/page-layouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (res.ok) alert("✅ Layout berhasil disimpan! Halaman akan otomatis ter-update.");
            else alert("❌ Gagal menyimpan layout");
        } catch {
            alert("❌ Error menyimpan layout");
        } finally { setSaving(false); }
    }, [selectedPage, pageTitle, crossFilter, widgets]);

    /* ━━━━ RENDER ━━━━ */
    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LayoutGrid className="h-6 w-6 text-indigo-400" />
                        Page Builder
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Drag, resize, dan konfigurasi widget untuk membangun halaman dashboard
                    </p>
                </div>
                <div className="flex gap-2">
                    {widgets.length > 0 && (
                        <button
                            onClick={handleSave}
                            disabled={saving || !selectedPage}
                            className="flex items-center gap-1 text-xs px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
                        >
                            <Save className="h-3 w-3" />
                            {saving ? "Menyimpan..." : "Simpan Layout"}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Step Indicator ── */}
            <div className="flex gap-4 items-center">
                {[
                    { step: 1, label: "Pilih Halaman" },
                    { step: 2, label: "Susun Widget" },
                ].map(({ step, label }) => (
                    <button
                        key={step}
                        onClick={() => step <= (selectedPage ? 2 : 1) && setCurrentStep(step)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all ${currentStep === step
                            ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                            : currentStep > step
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                    >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep > step ? "bg-emerald-500 text-white" : currentStep === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                            {currentStep > step ? "✓" : step}
                        </span>
                        {label}
                    </button>
                ))}
            </div>

            {/* ══════════ STEP 1: Select Page ══════════ */}
            {currentStep === 1 && (
                <Card>
                    <CardHeader><CardTitle className="text-sm">Pilih Halaman Target</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                            Pilih halaman dashboard yang ingin dibuat/diubah layout-nya:
                        </p>
                        <div className="space-y-4">
                            {Object.entries(GROUPED_PAGES).map(([section, pages]) => (
                                <div key={section}>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{section}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {pages.map((page) => (
                                            <button
                                                key={page.path}
                                                onClick={() => {
                                                    setSelectedPage(page.path);
                                                    setPageTitle(page.label);
                                                    setCurrentStep(2);
                                                }}
                                                className={`p-3 rounded-lg border text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 ${selectedPage === page.path ? "border-indigo-500 bg-indigo-500/10" : ""
                                                    }`}
                                            >
                                                <p className="text-sm font-medium">{page.label}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{page.path}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ══════════ STEP 2: Widget Canvas ══════════ */}
            {currentStep === 2 && selectedPage && (
                <div className="grid grid-cols-12 gap-4">

                    {/* ── LEFT: Widget Palette ── */}
                    <div className="col-span-12 lg:col-span-2">
                        <Card className="sticky top-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs">Widget Library</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                {(Object.entries(WIDGET_TYPES) as [WidgetType, { label: string; description: string }][]).map(
                                    ([type, meta]) => {
                                        const Icon = WIDGET_ICONS[type];
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => addWidget(type)}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors text-left group"
                                            >
                                                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
                                                <div>
                                                    <p className="font-medium">{meta.label.replace(/^[^ ]+ /, "")}</p>
                                                    <p className="text-[9px] text-muted-foreground">{meta.description}</p>
                                                </div>
                                                <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        );
                                    }
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── CENTER: Grid Canvas ── */}
                    <div className="col-span-12 lg:col-span-7">
                        <Card className="min-h-[500px]">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Columns3 className="h-4 w-4 text-primary" />
                                        Canvas — {pageTitle}
                                        <Badge variant="secondary" className="text-[9px]">{widgets.length} widget</Badge>
                                        {isEditingExisting && (
                                            <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✏️ Edit Mode</Badge>
                                        )}
                                    </CardTitle>
                                    <p className="text-[9px] text-muted-foreground">12 kolom • drag untuk pindah • tarik sudut untuk resize</p>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-8">
                                {loadingLayout ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <Clock className="h-8 w-8 mb-3 animate-spin opacity-30" />
                                        <p className="text-sm font-medium">Memuat layout...</p>
                                    </div>
                                ) : widgets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <LayoutGrid className="h-12 w-12 mb-3 opacity-30" />
                                        <p className="text-sm font-medium">Canvas Kosong</p>
                                        <p className="text-xs mt-1">Klik widget dari panel kiri untuk menambahkan</p>
                                    </div>
                                ) : gridReady ? (
                                    <GridLayout
                                        className="layout"
                                        layout={gridLayout}
                                        width={680}
                                        gridConfig={{
                                            cols: 12,
                                            rowHeight: 40,
                                            margin: [12, 12] as const,
                                            containerPadding: [12, 12] as const,
                                            maxRows: Infinity,
                                        }}
                                        dragConfig={{
                                            enabled: true,
                                            bounded: false,
                                            handle: ".drag-handle",
                                            threshold: 3,
                                        }}
                                        resizeConfig={{
                                            enabled: true,
                                            handles: ["se"] as const,
                                        }}
                                        compactor={verticalCompactor}
                                        onLayoutChange={handleLayoutChange}
                                    >
                                        {widgets.map((widget) => {
                                            const Icon = WIDGET_ICONS[widget.type];
                                            const isSelected = selectedWidgetId === widget.id;
                                            return (
                                                <div
                                                    key={widget.id}
                                                    className={`rounded-lg border transition-all overflow-hidden ${isSelected
                                                        ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/5"
                                                        : "border-border bg-card hover:border-zinc-500"
                                                        }`}
                                                    onClick={() => setSelectedWidgetId(widget.id)}
                                                >
                                                    {/* Widget header (drag handle) */}
                                                    <div className="drag-handle flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-grab active:cursor-grabbing border-b border-border/50">
                                                        <Icon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                                                        <span className="text-[10px] font-medium truncate flex-1">
                                                            {widget.title || WIDGET_TYPES[widget.type].label}
                                                        </span>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <Badge variant="outline" className="text-[7px] px-1 py-0">{widget.w}×{widget.h}</Badge>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
                                                                className="p-0.5 rounded hover:bg-destructive/20 text-destructive/50 hover:text-destructive"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Widget preview body */}
                                                    <div className="p-3 flex flex-col items-center justify-center h-[calc(100%-32px)] text-muted-foreground">
                                                        <Icon className="h-8 w-8 mb-1 opacity-20" />
                                                        <p className="text-[9px] text-center">
                                                            {widget.source ? `${widget.source}` : "Belum ada data"}
                                                            {widget.column ? ` → ${widget.column}` : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </GridLayout>
                                ) : (
                                    <Skeleton className="h-40 w-full" />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── RIGHT: Property Editor ── */}
                    <div className="col-span-12 lg:col-span-3">
                        <Card className="sticky top-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs flex items-center gap-2">
                                    <Settings className="h-3 w-3" />
                                    {selectedWidget ? "Properti Widget" : "Pengaturan Halaman"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!selectedWidget ? (
                                    <>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Judul Halaman</label>
                                            <input type="text" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)}
                                                className="w-full text-xs px-3 py-1.5 rounded-md border bg-background mt-1" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Halaman Target</label>
                                            <p className="text-xs font-mono mt-1 text-indigo-400">{selectedPage}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cross Filter</label>
                                            <button onClick={() => setCrossFilter(!crossFilter)}
                                                className={`w-10 h-5 rounded-full transition-colors ${crossFilter ? "bg-primary" : "bg-muted"}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${crossFilter ? "translate-x-5" : "translate-x-0.5"}`} />
                                            </button>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sheet Tersedia</label>
                                            <div className="space-y-1 mt-1">
                                                {loadingLayout ? (
                                                    <Skeleton className="h-6 w-full" />
                                                ) : availableSheets.length === 0 ? (
                                                    <p className="text-[10px] text-muted-foreground italic">
                                                        Belum ada sheet terhubung.{" "}
                                                        <a href="/maintenance/data-source" className="text-indigo-400 underline">Hubungkan di Data Source Manager</a>
                                                    </p>
                                                ) : (
                                                    availableSheets.map((s) => (
                                                        <Badge key={s} variant="secondary" className="text-[9px] mr-1">{s}</Badge>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Judul</label>
                                            <input type="text" value={selectedWidget.title || ""}
                                                onChange={(e) => updateWidget(selectedWidget.id, { title: e.target.value })}
                                                className="w-full text-xs px-3 py-1.5 rounded-md border bg-background mt-1" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sumber Data (Sheet)</label>
                                            <select value={selectedWidget.source || ""}
                                                onChange={(e) => updateWidget(selectedWidget.id, { source: e.target.value, column: "" })}
                                                className="w-full text-xs px-3 py-1.5 rounded-md border bg-background mt-1">
                                                <option value="">— Pilih Sheet —</option>
                                                {availableSheets.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        {selectedWidget.type !== "data-table" && (
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kolom</label>
                                                <select value={selectedWidget.column || ""}
                                                    onChange={(e) => updateWidget(selectedWidget.id, { column: e.target.value })}
                                                    className="w-full text-xs px-3 py-1.5 rounded-md border bg-background mt-1">
                                                    <option value="">— Pilih Kolom —</option>
                                                    {(availableColumns[selectedWidget.source || ""] || []).map((c) => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {selectedWidget.type === "kpi-card" && (
                                            <>
                                                <div>
                                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Label</label>
                                                    <input type="text" value={selectedWidget.label || ""}
                                                        onChange={(e) => updateWidget(selectedWidget.id, { label: e.target.value })}
                                                        className="w-full text-xs px-3 py-1.5 rounded-md border bg-background mt-1" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Agregasi</label>
                                                    <select value={selectedWidget.aggregate || "count"}
                                                        onChange={(e) => updateWidget(selectedWidget.id, { aggregate: e.target.value as WidgetConfig["aggregate"] })}
                                                        className="w-full text-xs px-3 py-1.5 rounded-md border bg-background mt-1">
                                                        <option value="count">COUNT (hitung baris)</option>
                                                        <option value="unique">UNIQUE (nilai unik)</option>
                                                        <option value="sum">SUM (jumlahkan)</option>
                                                        <option value="avg">AVERAGE (rata-rata)</option>
                                                        <option value="min">MIN (minimum)</option>
                                                        <option value="max">MAX (maximum)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Warna</label>
                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                                        {Object.entries(COLORS).slice(0, 8).map(([name, hex]) => (
                                                            <button key={name}
                                                                onClick={() => updateWidget(selectedWidget.id, { color: name })}
                                                                className={`w-6 h-6 rounded-md border-2 transition-all ${selectedWidget.color === name ? "border-foreground scale-110" : "border-transparent"
                                                                    }`}
                                                                style={{ backgroundColor: hex }} title={name} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {(selectedWidget.type === "donut-chart" || selectedWidget.type === "bar-chart" || selectedWidget.type === "horizontal-bar") && (
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Item</label>
                                                <input type="number" min={3} max={30} value={selectedWidget.maxItems || 10}
                                                    onChange={(e) => updateWidget(selectedWidget.id, { maxItems: parseInt(e.target.value) })}
                                                    className="w-full text-xs px-3 py-1.5 rounded-md border bg-background mt-1" />
                                            </div>
                                        )}
                                        {(selectedWidget.type === "donut-chart" || selectedWidget.type === "data-table") && (
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Click to Filter</label>
                                                <button onClick={() => updateWidget(selectedWidget.id, { clickToFilter: !selectedWidget.clickToFilter })}
                                                    className={`w-10 h-5 rounded-full transition-colors ${selectedWidget.clickToFilter ? "bg-primary" : "bg-muted"}`}>
                                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${selectedWidget.clickToFilter ? "translate-x-5" : "translate-x-0.5"}`} />
                                                </button>
                                            </div>
                                        )}
                                        <div className="pt-2 border-t">
                                            <button onClick={() => setSelectedWidgetId(null)}
                                                className="w-full text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors">
                                                ← Kembali ke Pengaturan Halaman
                                            </button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
