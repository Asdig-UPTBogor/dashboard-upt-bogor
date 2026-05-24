"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import dynamic from "next/dynamic";
import {
    Activity, Filter, RefreshCw, Building2, MapPin, Zap,
    CheckCircle2, AlertTriangle, XCircle, BarChart3, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
    red: "#ef4444", green: "#22c55e", yellow: "#eab308",
};

// echartBase is now built dynamically from useChartTheme() inside the component

// Status HI color map
const STATUS_COLORS: Record<string, { color: string; bg: string; order: number }> = {
    "VERY GOOD": { color: C.emerald, bg: `${C.emerald}20`, order: 0 },
    "GOOD": { color: C.green, bg: `${C.green}20`, order: 1 },
    "FAIR": { color: C.amber, bg: `${C.amber}20`, order: 2 },
    "POOR": { color: C.orange, bg: `${C.orange}20`, order: 3 },
    "VERY POOR": { color: C.rose, bg: `${C.rose}20`, order: 4 },
};

const KONDISI_COLORS: Record<string, { color: string; bg: string }> = {
    "AMAN": { color: C.emerald, bg: `${C.emerald}20` },
    "WASPADA": { color: C.amber, bg: `${C.amber}20` },
    "KRITIS": { color: C.rose, bg: `${C.rose}20` },
};

function parseScore(val: string): number {
    if (!val) return 0;
    const cleaned = val.replace(/,/g, ".").trim();
    return parseFloat(cleaned) || 0;
}

interface TowerHI {
    ultg: string;
    gi: string;
    penghantar: string;
    namaTower: string;
    skorHI: number;
    statusHI: string;
    kondisi: string;
    kelengkapanData: string;
    lingkungan: string;
    pondasi: string;
    verticality: string;
    levelingTower: string;
    backToBack: string;
    struktur: string;
    il1Cui: string;
    il1LineWalker: string;
    towerEmergency: string;
}

interface HealthyIndexPageProps {
    embedded?: boolean;
}

export default function HealthyIndexPage({ embedded = false }: HealthyIndexPageProps = {}) {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/transmisi/healthy-index");
    const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);

    // Filters
    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string | null>(null);
    const [filterPenghantar, setFilterPenghantar] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [searchTower, setSearchTower] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 25;

    // Parse data
    const towers: TowerHI[] = useMemo(() =>
        rawData.map(r => ({
            ultg: r["ULTG"] || r["Master ULTG"] || "",
            gi: r["Gardu Induk"] || r["Master Gardu Induk"] || "",
            penghantar: r["Penghantar"] || "",
            namaTower: r["Nama Tower"] || "",
            skorHI: parseScore(r["Skor HI"]),
            statusHI: (r["Status HI"] || "").toUpperCase().trim(),
            kondisi: (r["Resume Kondisi"] || "").toUpperCase().trim(),
            kelengkapanData: r["Kelengkapan Data"] || "",
            lingkungan: r["Lingkungan"] || "",
            pondasi: r["Pondasi"] || "",
            verticality: r["Verticality"] || "",
            levelingTower: r["Leveling Tower"] || "",
            backToBack: r["Back to Back"] || "",
            struktur: r["Struktur"] || "",
            il1Cui: r["IL 1 CUI"] || "",
            il1LineWalker: r["IL 1 Line Walker"] || "",
            towerEmergency: r["Tower Emergency"] || "",
        })).filter(t => t.namaTower.length > 0),
        [rawData]);

    // Unique filter values
    const ultgList = useMemo(() => [...new Set(towers.map(t => t.ultg))].filter(Boolean).sort(), [towers]);
    const giList = useMemo(() => {
        let list = towers;
        if (filterULTG) list = list.filter(t => t.ultg === filterULTG);
        return [...new Set(list.map(t => t.gi))].filter(Boolean).sort();
    }, [towers, filterULTG]);
    const pengList = useMemo(() => {
        let list = towers;
        if (filterULTG) list = list.filter(t => t.ultg === filterULTG);
        if (filterGI) list = list.filter(t => t.gi === filterGI);
        return [...new Set(list.map(t => t.penghantar))].filter(Boolean).sort();
    }, [towers, filterULTG, filterGI]);
    const statusList = useMemo(() => [...new Set(towers.map(t => t.statusHI))].filter(Boolean).sort(), [towers]);

    // Filtered data
    const filtered = useMemo(() => {
        let data = towers;
        if (filterULTG) data = data.filter(t => t.ultg === filterULTG);
        if (filterGI) data = data.filter(t => t.gi === filterGI);
        if (filterPenghantar) data = data.filter(t => t.penghantar === filterPenghantar);
        if (filterStatus) data = data.filter(t => t.statusHI === filterStatus);
        if (searchTower) data = data.filter(t =>
            t.namaTower.toLowerCase().includes(searchTower.toLowerCase()));
        return data;
    }, [towers, filterULTG, filterGI, filterPenghantar, filterStatus, searchTower]);

    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterGI(null);
        setFilterPenghantar(null); setFilterStatus(null);
        setSearchTower(""); setPage(0);
    }, []);

    const hasFilters = filterULTG || filterGI || filterPenghantar || filterStatus || searchTower;

    // KPIs
    const avgHI = filtered.length > 0
        ? (filtered.reduce((a, t) => a + t.skorHI, 0) / filtered.length).toFixed(1)
        : "0";
    const minHI = filtered.length > 0
        ? filtered.reduce((m, t) => t.skorHI < m.skorHI ? t : m, filtered[0])
        : null;
    const maxHI = filtered.length > 0
        ? filtered.reduce((m, t) => t.skorHI > m.skorHI ? t : m, filtered[0])
        : null;

    // Status distribution
    const statusDist = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(t => { counts[t.statusHI] = (counts[t.statusHI] || 0) + 1; });
        return Object.entries(counts)
            .sort((a, b) => (STATUS_COLORS[a[0]]?.order ?? 99) - (STATUS_COLORS[b[0]]?.order ?? 99));
    }, [filtered]);

    // Kondisi distribution
    const kondisiDist = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(t => { counts[t.kondisi] = (counts[t.kondisi] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [filtered]);

    // Status per GI (stacked bar)
    const statusPerGI = useMemo(() => {
        const giMap: Record<string, Record<string, number>> = {};
        filtered.forEach(t => {
            if (!giMap[t.gi]) giMap[t.gi] = {};
            giMap[t.gi][t.statusHI] = (giMap[t.gi][t.statusHI] || 0) + 1;
        });
        const gis = Object.keys(giMap).sort();
        const statuses = ["VERY GOOD", "GOOD", "FAIR", "POOR", "VERY POOR"];
        return { gis, statuses, giMap };
    }, [filtered]);

    // Average HI per GI
    const avgHIperGI = useMemo(() => {
        const giScores: Record<string, { sum: number; count: number }> = {};
        filtered.forEach(t => {
            if (!giScores[t.gi]) giScores[t.gi] = { sum: 0, count: 0 };
            giScores[t.gi].sum += t.skorHI;
            giScores[t.gi].count++;
        });
        return Object.entries(giScores)
            .map(([gi, s]) => ({ gi, avg: s.sum / s.count, count: s.count }))
            .sort((a, b) => a.avg - b.avg);
    }, [filtered]);

    // ────── Charts ──────

    // 1. Status donut
    const donutOption = useMemo(() => {
        const total = statusDist.reduce((s, [, v]) => s + v, 0);
        const data = statusDist.map(([name, value]) => ({
            name, value,
            itemStyle: { color: STATUS_COLORS[name]?.color || C.indigo },
        }));
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "inherit", color: theme.textMuted },
            tooltip: {
                trigger: "item" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText },
                formatter: "{b}: {c} tower ({d}%)",
            },
            legend: {
                orient: "horizontal" as const,
                bottom: 0,
                itemWidth: 10, itemHeight: 10, itemGap: 14,
                textStyle: { color: theme.textMuted, fontSize: 10 },
                formatter: (name: string) => {
                    const item = data.find(d => d.name === name);
                    const pct = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                    return `${name}  ${item?.value || 0}  (${pct}%)`;
                },
            },
            graphic: [{
                type: "text" as const,
                left: "center", top: "38%",
                style: {
                    text: `${total}`,
                    fontSize: 26, fontWeight: "bold" as const,
                    fill: theme.text, textAlign: "center" as const,
                },
            }, {
                type: "text" as const,
                left: "center", top: "50%",
                style: {
                    text: "tower",
                    fontSize: 11, fill: theme.textMuted, textAlign: "center" as const,
                },
            }],
            series: [{
                type: "pie" as const,
                radius: ["44%", "70%"],
                center: ["50%", "44%"],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: false },
                emphasis: { scaleSize: 4 },
                data,
            }],
            animationType: "scale",
            animationDuration: 1000,
        };
    }, [statusDist, theme]);

    // 2. Kondisi pie
    const kondisiOption = useMemo(() => {
        const total = kondisiDist.reduce((s, [, v]) => s + v, 0);
        const data = kondisiDist.map(([name, value]) => ({
            name, value,
            itemStyle: { color: KONDISI_COLORS[name]?.color || C.purple },
        }));
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "inherit", color: theme.textMuted },
            tooltip: {
                trigger: "item" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText },
                formatter: "{b}: {c} ({d}%)",
            },
            legend: {
                orient: "horizontal" as const,
                bottom: 0,
                itemWidth: 10, itemHeight: 10, itemGap: 14,
                textStyle: { color: theme.textMuted, fontSize: 10 },
                formatter: (name: string) => {
                    const item = data.find(d => d.name === name);
                    const pct = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                    return `${name}  ${item?.value || 0}  (${pct}%)`;
                },
            },
            series: [{
                type: "pie" as const,
                radius: ["44%", "70%"],
                center: ["50%", "44%"],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: false },
                emphasis: { scaleSize: 4 },
                data,
            }],
            animationType: "scale",
            animationDuration: 1000,
        };
    }, [kondisiDist, theme]);

    // 3. Status per GI stacked bar
    const stackedBarOption = useMemo(() => {
        const { gis, statuses, giMap } = statusPerGI;
        const shortGI = gis.map(g => g.replace(/^GI\s*/i, "").replace(/\s*\d+kV\s*/i, " "));
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "inherit", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 11 },
            },
            legend: {
                data: statuses,
                textStyle: { color: theme.textMuted, fontSize: 9 },
                bottom: 0,
                itemWidth: 10, itemHeight: 10,
            },
            grid: { top: 10, right: 16, bottom: 50, left: 210 },
            yAxis: {
                type: "category" as const,
                data: shortGI,
                axisLabel: { fontSize: 9, color: theme.textMuted, width: 200, overflow: "truncate" as const },
                axisLine: { show: false },
                axisTick: { show: false },
                inverse: true,
            },
            xAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: theme.textMuted },
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            },
            series: statuses.map(status => ({
                name: status,
                type: "bar" as const,
                stack: "total",
                barWidth: 16,
                emphasis: { focus: "series" as const },
                itemStyle: {
                    color: STATUS_COLORS[status]?.color || C.indigo,
                    borderRadius: 0,
                },
                data: gis.map(gi => giMap[gi]?.[status] || 0),
            })),
            animationDuration: 1000,
        };
    }, [statusPerGI, theme]);

    // 4. Avg HI per GI horizontal bar
    const avgHIBarOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "inherit", color: theme.textMuted },
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontSize: 12 },
            formatter: (params: Array<{ name: string; value: number }>) => {
                if (!params.length) return "";
                const p = params[0];
                const info = avgHIperGI.find(g => g.gi === p.name);
                return `<b>${p.name}</b><br/>Avg HI: <b>${p.value.toFixed(1)}</b><br/>Tower: ${info?.count || 0}`;
            },
        },
        grid: { top: 8, right: 60, bottom: 8, left: 210 },
        yAxis: {
            type: "category" as const,
            data: avgHIperGI.map(g => g.gi),
            axisLabel: {
                fontSize: 9, color: theme.textMuted, width: 200,
                overflow: "truncate" as const, ellipsis: "…",
            },
            axisLine: { show: false },
            axisTick: { show: false },
            inverse: true,
        },
        xAxis: {
            type: "value" as const,
            axisLabel: { fontSize: 10, color: theme.textMuted },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
        },
        series: [{
            type: "bar" as const,
            data: avgHIperGI.map(g => ({
                value: Math.round(g.avg * 10) / 10,
                itemStyle: {
                    color: {
                        type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: g.avg >= 20
                            ? [{ offset: 0, color: "#059669" }, { offset: 1, color: C.emerald }]
                            : g.avg >= 15
                                ? [{ offset: 0, color: "#d97706" }, { offset: 1, color: C.amber }]
                                : [{ offset: 0, color: "#e11d48" }, { offset: 1, color: C.rose }],
                    },
                    borderRadius: [0, 6, 6, 0],
                },
            })),
            barWidth: 14,
            label: {
                show: true, position: "right" as const,
                fontSize: 10, fontWeight: "bold" as const,
                color: theme.text,
                formatter: (p: { value: number }) => p.value.toFixed(1),
            },
            showBackground: true,
            backgroundStyle: { color: "rgba(128,128,128,0.06)", borderRadius: [0, 6, 6, 0] },
        }],
        animationDuration: 1200,
        animationEasing: "cubicOut",
    }), [avgHIperGI, theme]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => { setPage(0); }, [filterULTG, filterGI, filterPenghantar, filterStatus, searchTower]);

    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-80" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <p className="text-destructive font-semibold mb-2">Error Loading Data</p>
                        <p className="text-sm text-muted-foreground">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            {!embedded && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="ds-heading flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" />
                        Healthy Index Transmisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Data HI Tower — {towers.length} tower
                        {hasFilters && ` (menampilkan ${filtered.length})`}
                    </p>
                </div>
                <DataFreshness />
            </div>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />

                        <SelectNative value={filterULTG || ""} onChange={e => { setFilterULTG(e.target.value || null); setFilterGI(null); setFilterPenghantar(null); }}>
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>

                        <SelectNative value={filterGI || ""} onChange={e => { setFilterGI(e.target.value || null); setFilterPenghantar(null); }}>
                            <option value="">Semua GI</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>

                        <SelectNative value={filterPenghantar || ""} onChange={e => setFilterPenghantar(e.target.value || null)} className="max-w-50">
                            <option value="">Semua Penghantar</option>
                            {pengList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <SelectNative value={filterStatus || ""} onChange={e => setFilterStatus(e.target.value || null)}>
                            <option value="">Semua Status HI</option>
                            {statusList.map(s => <option key={s} value={s}>{s}</option>)}
                        </SelectNative>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                type="text" value={searchTower} onChange={e => setSearchTower(e.target.value)}
                                placeholder="Cari tower..."
                                className="h-8 pl-8 pr-2 text-xs w-44"
                            />
                        </div>

                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                                <RefreshCw className="h-3 w-3" /> Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: "Total Tower", value: filtered.length, icon: MapPin, color: C.indigo, glow: "rgba(129,140,248,0.15)" },
                    { label: "Rata-rata HI", value: avgHI, icon: Activity, color: C.amber, glow: "rgba(251,191,36,0.15)" },
                    { label: "Status GOOD+", value: filtered.filter(t => ["VERY GOOD", "GOOD"].includes(t.statusHI)).length, icon: CheckCircle2, color: C.emerald, glow: "rgba(52,211,153,0.15)" },
                    { label: "Status FAIR", value: filtered.filter(t => t.statusHI === "FAIR").length, icon: AlertTriangle, color: C.orange, glow: "rgba(251,146,60,0.15)" },
                    { label: "Status POOR+", value: filtered.filter(t => ["POOR", "VERY POOR"].includes(t.statusHI)).length, icon: XCircle, color: C.rose, glow: "rgba(251,113,133,0.15)" },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-sm transition-all duration-200">
                            <div className="absolute inset-0 opacity-30"
                                style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.glow}, transparent 60%)` }} />
                            <CardContent className="p-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                        <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{kpi.value}</p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider" style={{ color: kpi.color }}>{kpi.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts Row 1: Status HI + Kondisi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Distribusi Status HI
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={donutOption} style={{ height: 300 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-primary" /> Resume Kondisi
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={kondisiOption} style={{ height: 300 }} />
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2: Status per GI + Avg HI per GI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> Status HI per Gardu Induk
                            <Badge variant="secondary" className="ml-auto text-xs">{statusPerGI.gis.length} GI</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={stackedBarOption} style={{ height: Math.max(300, statusPerGI.gis.length * 28) }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" /> Rata-rata Skor HI per GI
                            <Badge variant="secondary" className="ml-auto text-xs">rendah → tinggi</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={avgHIBarOption} style={{ height: Math.max(300, avgHIperGI.length * 28) }} />
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Detail Tower
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {filtered.length} tower — Halaman {page + 1}/{totalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10">No</TableHead>
                                    <TableHead>ULTG</TableHead>
                                    <TableHead>Gardu Induk</TableHead>
                                    <TableHead>Penghantar</TableHead>
                                    <TableHead>Nama Tower</TableHead>
                                    <TableHead className="text-center">Skor HI</TableHead>
                                    <TableHead className="text-center">Status HI</TableHead>
                                    <TableHead className="text-center">Kondisi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((t, i) => {
                                    const sc = STATUS_COLORS[t.statusHI] || { color: C.indigo, bg: `${C.indigo}20` };
                                    const kc = KONDISI_COLORS[t.kondisi] || { color: C.purple, bg: `${C.purple}20` };
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground text-xs">{page * PAGE_SIZE + i + 1}</TableCell>
                                            <TableCell className="text-xs">
                                                <Badge variant="outline" className="text-xs">{t.ultg}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">{t.gi}</TableCell>
                                            <TableCell className="text-xs max-w-37.5 truncate">{t.penghantar}</TableCell>
                                            <TableCell className="font-medium text-xs max-w-62.5 truncate">{t.namaTower}</TableCell>
                                            <TableCell className="text-center font-mono text-sm font-bold"
                                                style={{ color: sc.color }}>
                                                {t.skorHI.toFixed(1)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-xs"
                                                    style={{ backgroundColor: sc.bg, color: sc.color }}>
                                                    {t.statusHI}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-xs"
                                                    style={{ backgroundColor: kc.bg, color: kc.color }}>
                                                    {t.kondisi || "-"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                                className="h-8 text-xs gap-1">
                                <ChevronLeft className="h-3.5 w-3.5" /> Prev
                            </Button>
                            <div className="flex gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                                    let p: number;
                                    if (totalPages <= 5) p = idx;
                                    else if (page < 3) p = idx;
                                    else if (page > totalPages - 4) p = totalPages - 5 + idx;
                                    else p = page - 2 + idx;
                                    return (
                                        <Button key={p} variant={page === p ? "default" : "outline"} size="sm"
                                            onClick={() => setPage(p)} className="w-8 h-8 text-xs p-0">
                                            {p + 1}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                                className="h-8 text-xs gap-1">
                                Next <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
