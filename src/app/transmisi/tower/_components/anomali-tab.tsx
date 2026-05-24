"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    AlertTriangle, Filter, RefreshCw, MapPin, Search,
    CheckCircle2, Building2, ShieldAlert, Eye, ChevronLeft, ChevronRight, Layers,
    Radio, Wifi, WifiOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
    "IN PROGRESS": { color: C.amber, label: "In Progress" },
    "SELESAI": { color: C.emerald, label: "Selesai" },
    "OPEN": { color: C.rose, label: "Open" },
    "CLOSE": { color: C.emerald, label: "Close" },
};

const KONDISI_COLORS: Record<string, string> = {
    "LINGKUNGAN": C.teal, "KONSTRUKSI": C.orange, "PONDASI": C.rose,
    "KOROSI": C.amber, "GROUNDING": C.purple, "ISOLATOR": C.cyan, "PENGHANTAR": C.blue,
};

const COL = {
    NO: "NO", ULTG: "ULTG", GI: "GARDU INDUK", PENGHANTAR: "PENGHANTAR",
    NO_TOWER: "NO TOWER", DATA_PENGHANTAR: "DATA PENGHANTAR", STATUS: "STATUS",
    KETERANGAN: "KETERANGAN", VENOM: "VENOM TERPASANG", ID: "ID", NO_HP: "NO HP",
    ONLINE: "ONLINE/OFFLINE", TAHUN: "TAHUN TEMUAN", KONDISI: "KONDISI KRITIS",
    LINK: "LINK VENOM",
} as const;

interface AnomaliTowerPageProps {
    embedded?: boolean;
}

export default function AnomaliTowerPage({ embedded = false }: AnomaliTowerPageProps = {}) {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/transmisi/anomali");
    const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);

    // Filters
    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [filterKondisi, setFilterKondisi] = useState<string | null>(null);
    const [filterVenom, setFilterVenom] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    // Unique lists for filters
    const ultgList = useMemo(() => [...new Set(rawData.map(r => r[COL.ULTG]).filter(Boolean))].sort(), [rawData]);
    const giList = useMemo(() => {
        let src = rawData;
        if (filterULTG) src = src.filter(r => r[COL.ULTG] === filterULTG);
        return [...new Set(src.map(r => r[COL.GI]).filter(Boolean))].sort();
    }, [rawData, filterULTG]);
    const statusList = useMemo(() => [...new Set(rawData.map(r => r[COL.STATUS]).filter(Boolean))].sort(), [rawData]);
    const kondisiList = useMemo(() => [...new Set(rawData.map(r => r[COL.KONDISI]).filter(Boolean))].sort(), [rawData]);
    const venomList = useMemo(() => [...new Set(rawData.map(r => r[COL.VENOM]).filter(Boolean))].sort(), [rawData]);

    // Filtered data
    const filtered = useMemo(() => {
        let data = rawData;
        if (filterULTG) data = data.filter(r => r[COL.ULTG] === filterULTG);
        if (filterGI) data = data.filter(r => r[COL.GI] === filterGI);
        if (filterStatus) data = data.filter(r => r[COL.STATUS] === filterStatus);
        if (filterKondisi) data = data.filter(r => r[COL.KONDISI] === filterKondisi);
        if (filterVenom) data = data.filter(r => r[COL.VENOM] === filterVenom);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
        }
        return data;
    }, [rawData, filterULTG, filterGI, filterStatus, filterKondisi, filterVenom, searchQuery]);

    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterGI(null); setFilterStatus(null);
        setFilterKondisi(null); setFilterVenom(null); setSearchQuery(""); setPage(0);
    }, []);

    const hasFilters = filterULTG || filterGI || filterStatus || filterKondisi || filterVenom || searchQuery;

    // ── KPIs ──
    const totalData = filtered.length;
    const totalULTG = useMemo(() => new Set(filtered.map(r => r[COL.ULTG]).filter(Boolean)).size, [filtered]);
    const totalGI = useMemo(() => new Set(filtered.map(r => r[COL.GI]).filter(Boolean)).size, [filtered]);
    const totalPenghantar = useMemo(() => new Set(filtered.map(r => r[COL.PENGHANTAR]).filter(Boolean)).size, [filtered]);
    const venomOnline = filtered.filter(r => (r[COL.ONLINE] || "").toUpperCase().includes("ONLINE")).length;
    const venomTerpasang = filtered.filter(r => (r[COL.VENOM] || "").toUpperCase().includes("TERPASANG") && !(r[COL.VENOM] || "").toUpperCase().includes("TIDAK")).length;

    // ── Charts ──

    // 1. Per ULTG bar chart
    const perULTGChart = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const u = r[COL.ULTG] || "N/A"; counts[u] = (counts[u] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
            tooltip: { trigger: "axis" as const, backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText, fontSize: 12 } },
            grid: { top: 10, right: 16, bottom: 60, left: 48 },
            xAxis: {
                type: "category" as const, data: sorted.map(([n]) => n),
                axisLabel: { fontSize: 10, color: theme.textMuted, rotate: 15 },
                axisLine: { lineStyle: { color: theme.gridLine } },
            },
            yAxis: {
                type: "value" as const, axisLabel: { fontSize: 10, color: theme.textMuted },
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            },
            series: [{
                type: "bar" as const, barMaxWidth: 60,
                data: sorted.map(([, v], i) => ({
                    value: v,
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: [C.indigo, C.teal, C.amber][i % 3] }, { offset: 1, color: [C.purple, C.emerald, C.orange][i % 3] }] },
                        borderRadius: [4, 4, 0, 0],
                    },
                })),
                label: { show: true, position: "top" as const, fontSize: 11, fontWeight: "bold" as const, color: theme.emphasisText },
            }],
            animationDuration: 1200, animationEasing: "elasticOut",
        };
    }, [filtered, theme]);

    // 2. Per Kondisi Kritis donut (Monitoring Tower Kritis pattern)
    const kondisiDonut = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const k = r[COL.KONDISI] || "N/A"; counts[k] = (counts[k] || 0) + 1; });
        const data = Object.entries(counts).map(([name, value]) => ({
            name, value,
            itemStyle: {
                color: KONDISI_COLORS[name.toUpperCase()] || C.indigo,
                opacity: filterKondisi && filterKondisi !== name ? 0.08 : 1,
                shadowBlur: filterKondisi === name ? 12 : 0,
                shadowColor: filterKondisi === name ? (KONDISI_COLORS[name.toUpperCase()] || C.indigo) : "transparent",
            },
        }));
        const total = data.reduce((s, d) => s + d.value, 0);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif" },
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", borderWidth: 1,
                textStyle: { color: "#d4d4d8", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Tower: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: "#d4d4d8", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "tower kritis", fontSize: 11, fill: filterKondisi ? C.orange : "#a1a1aa", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "45%"],
                padAngle: 2, itemStyle: { borderRadius: 6 },
                label: {
                    show: true, fontSize: 11, color: "#d4d4d8",
                    formatter: (p: { name: string; value: number; percent: number }) =>
                        `{name|${p.name}}\n{val|${p.value}} ({pct|${p.percent.toFixed(0)}%})`,
                    rich: {
                        name: { fontSize: 11, color: "#d4d4d8", fontWeight: "bold" as const, lineHeight: 16 },
                        val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" as const },
                        pct: { fontSize: 11, color: "#d4d4d8" },
                    },
                },
                labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#a1a1aa", width: 1.5 } },
                selectedMode: "single" as const, selectedOffset: 10,
                emphasis: { scaleSize: 6, label: { fontSize: 12 } },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [filtered, filterKondisi]);

    // 3. Status donut
    const statusDonut = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const s = r[COL.STATUS] || "N/A"; counts[s] = (counts[s] || 0) + 1; });
        const colors = [C.amber, C.emerald, C.rose, C.blue, C.purple, C.cyan];
        const data = Object.entries(counts).map(([name, value], i) => ({
            name, value,
            itemStyle: {
                color: STATUS_COLORS[name.toUpperCase()]?.color || colors[i % colors.length],
                opacity: filterStatus && filterStatus !== name ? 0.08 : 1,
                shadowBlur: filterStatus === name ? 12 : 0,
                shadowColor: filterStatus === name ? (STATUS_COLORS[name.toUpperCase()]?.color || colors[i % colors.length]) : "transparent",
            },
        }));
        const total = data.reduce((s, d) => s + d.value, 0);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif" },
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", borderWidth: 1,
                textStyle: { color: "#d4d4d8", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Tower: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: "#d4d4d8", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "total", fontSize: 11, fill: filterStatus ? C.emerald : "#a1a1aa", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "45%"],
                padAngle: 2, itemStyle: { borderRadius: 6 },
                label: {
                    show: true, fontSize: 11, color: "#d4d4d8",
                    formatter: (p: { name: string; value: number; percent: number }) =>
                        `{name|${p.name}}\n{val|${p.value}} ({pct|${p.percent.toFixed(0)}%})`,
                    rich: {
                        name: { fontSize: 11, color: "#d4d4d8", fontWeight: "bold" as const, lineHeight: 16 },
                        val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" as const },
                        pct: { fontSize: 11, color: "#d4d4d8" },
                    },
                },
                labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#a1a1aa", width: 1.5 } },
                selectedMode: "single" as const, selectedOffset: 10,
                emphasis: { scaleSize: 6, label: { fontSize: 12 } },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [filtered, filterStatus]);

    // 4. Venom status donut
    const venomDonut = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const v = r[COL.VENOM] || "Tidak diketahui"; counts[v] = (counts[v] || 0) + 1; });
        const colors = [C.emerald, C.rose, C.amber, C.blue, C.purple];
        const data = Object.entries(counts).map(([name, value], i) => ({
            name, value,
            itemStyle: {
                color: colors[i % colors.length],
                opacity: filterVenom && filterVenom !== name ? 0.08 : 1,
                shadowBlur: filterVenom === name ? 12 : 0,
                shadowColor: filterVenom === name ? colors[i % colors.length] : "transparent",
            },
        }));
        const total = data.reduce((s, d) => s + d.value, 0);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif" },
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", borderWidth: 1,
                textStyle: { color: "#d4d4d8", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Tower: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: "#d4d4d8", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "venom", fontSize: 11, fill: filterVenom ? C.emerald : "#a1a1aa", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "45%"],
                padAngle: 2, itemStyle: { borderRadius: 6 },
                label: {
                    show: true, fontSize: 11, color: "#d4d4d8",
                    formatter: (p: { name: string; value: number; percent: number }) =>
                        `{name|${p.name}}\n{val|${p.value}} ({pct|${p.percent.toFixed(0)}%})`,
                    rich: {
                        name: { fontSize: 11, color: "#d4d4d8", fontWeight: "bold" as const, lineHeight: 16 },
                        val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" as const },
                        pct: { fontSize: 11, color: "#d4d4d8" },
                    },
                },
                labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#a1a1aa", width: 1.5 } },
                selectedMode: "single" as const, selectedOffset: 10,
                emphasis: { scaleSize: 6, label: { fontSize: 12 } },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [filtered, filterVenom]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    useEffect(() => { setPage(0); }, [filterULTG, filterGI, filterStatus, filterKondisi, filterVenom, searchQuery]);

    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
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
                        <ShieldAlert className="h-6 w-6 text-rose-500" />
                        Anomali Tower Transmisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Assesment Tower Dan Venom — {rawData.length.toLocaleString()} records
                        {hasFilters && ` (menampilkan ${filtered.length.toLocaleString()})`}
                    </p>
                </div>
                <DataFreshness />
            </div>
            )}

            {/* ───── KPI Cards ───── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                    { label: "Jumlah Data", value: totalData.toLocaleString(), icon: Layers, color: C.indigo, glow: "rgba(129,140,248,0.15)" },
                    { label: "Jumlah ULTG", value: totalULTG.toLocaleString(), icon: Building2, color: C.teal, glow: "rgba(45,212,191,0.15)" },
                    { label: "Jumlah GI", value: totalGI.toLocaleString(), icon: MapPin, color: C.amber, glow: "rgba(251,191,36,0.15)" },
                    { label: "Penghantar", value: totalPenghantar.toLocaleString(), icon: Radio, color: C.purple, glow: "rgba(192,132,252,0.15)" },
                    { label: "Venom Terpasang", value: venomTerpasang.toLocaleString(), icon: Wifi, color: C.emerald, glow: "rgba(52,211,153,0.15)" },
                    { label: "Venom Online", value: venomOnline.toLocaleString(), icon: Eye, color: C.cyan, glow: "rgba(34,211,238,0.15)" },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
                            <div className="absolute inset-0 opacity-30"
                                style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.glow}, transparent 60%)` }} />
                            <CardContent className="p-3 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xl md:text-2xl font-bold leading-none">
                                            {kpi.value}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider" style={{ color: kpi.color }}>
                                            {kpi.label}
                                        </p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                        <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* ───── Filters ───── */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />

                        <SelectNative value={filterULTG || ""} onChange={e => { setFilterULTG(e.target.value || null); setFilterGI(null); }}>
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>

                        <SelectNative value={filterGI || ""} onChange={e => setFilterGI(e.target.value || null)}>
                            <option value="">Semua GI</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>

                        <SelectNative value={filterStatus || ""} onChange={e => setFilterStatus(e.target.value || null)}>
                            <option value="">Semua Status</option>
                            {statusList.map(s => <option key={s} value={s}>{s}</option>)}
                        </SelectNative>

                        <SelectNative value={filterKondisi || ""} onChange={e => setFilterKondisi(e.target.value || null)}>
                            <option value="">Semua Kondisi</option>
                            {kondisiList.map(k => <option key={k} value={k}>{k}</option>)}
                        </SelectNative>

                        <SelectNative value={filterVenom || ""} onChange={e => setFilterVenom(e.target.value || null)}>
                            <option value="">Semua Venom</option>
                            {venomList.map(v => <option key={v} value={v}>{v}</option>)}
                        </SelectNative>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari tower..."
                                className="h-8 pl-8 pr-2 text-xs w-48" />
                        </div>

                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                                <RefreshCw className="h-3 w-3" /> Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ───── Charts Row 1: Per ULTG + Kondisi Kritis ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-7">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Tower Kritis per ULTG
                            <Badge variant="secondary" className="ml-auto text-xs">{ultgList.length} ULTG</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={perULTGChart} style={{ height: 280 }} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-primary" /> Kondisi Kritis
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={kondisiDonut} style={{ height: 280 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Charts Row 2: Status + Venom ───── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" /> Status Penanganan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={statusDonut} style={{ height: 280 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-primary" /> Status Venom
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={venomDonut} style={{ height: 280 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Data Table ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Detail Assesment Tower Dan Venom
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {filtered.length.toLocaleString()} data — Halaman {page + 1}/{totalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">No</TableHead>
                                    <TableHead>ULTG</TableHead>
                                    <TableHead>Gardu Induk</TableHead>
                                    <TableHead>Penghantar</TableHead>
                                    <TableHead>No Tower</TableHead>
                                    <TableHead>Kondisi Kritis</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead>Venom</TableHead>
                                    <TableHead>Tahun</TableHead>
                                    <TableHead className="max-w-[300px]">Keterangan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => {
                                    const sc = STATUS_COLORS[r[COL.STATUS]?.toUpperCase()];
                                    const venomStatus = (r[COL.VENOM] || "").toUpperCase();
                                    const isVenomOn = venomStatus.includes("TERPASANG") && !venomStatus.includes("TIDAK");
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground text-xs">{r[COL.NO] || (page * PAGE_SIZE + i + 1)}</TableCell>
                                            <TableCell className="text-xs">
                                                <Badge variant="outline" className="text-xs px-1 py-0">{r[COL.ULTG] || "-"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{r[COL.GI] || "-"}</TableCell>
                                            <TableCell className="text-xs max-w-[220px] truncate" title={r[COL.PENGHANTAR]}>{r[COL.PENGHANTAR] || "-"}</TableCell>
                                            <TableCell className="text-xs font-mono font-medium">{r[COL.NO_TOWER] || "-"}</TableCell>
                                            <TableCell className="text-xs">
                                                <Badge variant="outline" className="text-xs px-1.5 py-0"
                                                    style={{
                                                        borderColor: `${KONDISI_COLORS[(r[COL.KONDISI] || "").toUpperCase()] || C.indigo}50`,
                                                        color: KONDISI_COLORS[(r[COL.KONDISI] || "").toUpperCase()] || C.indigo,
                                                    }}>
                                                    {r[COL.KONDISI] || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-xs px-1.5 py-0"
                                                    style={{
                                                        backgroundColor: `${sc?.color || C.indigo}20`,
                                                        color: sc?.color || C.indigo,
                                                        border: `1px solid ${sc?.color || C.indigo}30`,
                                                    }}>
                                                    {sc?.label || r[COL.STATUS] || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {isVenomOn ? (
                                                    <Badge className="text-xs px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                        <Wifi className="h-2.5 w-2.5 mr-0.5" /> Terpasang
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-xs px-1.5 py-0 bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                                        <WifiOff className="h-2.5 w-2.5 mr-0.5" /> Tidak
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{r[COL.TAHUN] || "-"}</TableCell>
                                            <TableCell className="text-xs max-w-[300px]">
                                                <div className="line-clamp-2" title={r[COL.KETERANGAN]}>{r[COL.KETERANGAN] || "-"}</div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

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
