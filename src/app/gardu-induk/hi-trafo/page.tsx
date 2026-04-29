"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    Activity, Filter, RefreshCw, Building2, Search, BarChart3,
    CheckCircle2, AlertTriangle, XCircle, Zap, ChevronLeft, ChevronRight, Gauge,
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

const STATUS_HI_COLORS: Record<string, { color: string }> = {
    "VERY GOOD": { color: C.emerald }, "GOOD": { color: "#22c55e" },
    "FAIR": { color: C.amber }, "POOR": { color: C.orange }, "VERY POOR": { color: C.rose },
};

const CRITICALITY_COLORS: Record<string, string> = {
    "SANGAT TINGGI": C.rose, "TINGGI": C.orange, "SEDANG": C.amber, "RENDAH": C.emerald,
};

const PRIORITAS_COLORS: Record<string, string> = {
    "P1": C.rose, "P2": C.orange, "P3": C.amber, "P4": C.teal, "P5": C.emerald,
};

const COL = {
    ULTG: "Master ULTG", GI: "Gi", GI_MASTER: "Master Gardu Induk",
    BAY: "Bay", BAY_MASTER: "Master Bay", MTU: "MTU", PHASA: "Phasa",
    MVA: "MVA", MEREK: "Merek", TIPE: "Tipe", SERIAL: "Serial Id",
    THN_BUAT: "Tahun Buat", THN_OPS: "Tahun Operasi",
    CRITICALITY: "Criticality Gi", PRIORITAS: "Prioritas Penggantian",
    JUSTIFIKASI: "Justifikasi Prioritas", STATUS_USIA: "Status Usia",
    RENCANA: "Rencana", STATUS_HI: "Status Hi", NILAI_HI: "Nilai Hi",
} as const;

interface TrafoRow {
    ultg: string; gi: string; bay: string; mtu: string; phasa: string;
    mva: string; merek: string; tipe: string; serialId: string;
    tahunBuat: string; tahunOperasi: string; criticalityGi: string;
    prioritas: string; justifikasi: string; statusUsia: string;
    rencana: string; statusHi: string; nilaiHi: number;
}

export default function HiTrafoPage() {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/gardu-induk/hi-trafo");
    const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);

    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string | null>(null);
    const [filterStatusHI, setFilterStatusHI] = useState<string | null>(null);
    const [filterCriticality, setFilterCriticality] = useState<string | null>(null);
    const [filterPrioritas, setFilterPrioritas] = useState<string | null>(null);
    const [searchBay, setSearchBay] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    const rows: TrafoRow[] = useMemo(() =>
        rawData.map(r => ({
            ultg: r[COL.ULTG] || "",
            gi: r[COL.GI] || r[COL.GI_MASTER] || "",
            bay: r[COL.BAY] || r[COL.BAY_MASTER] || "",
            mtu: r[COL.MTU] || "",
            phasa: r[COL.PHASA] || "",
            mva: r[COL.MVA] || "",
            merek: r[COL.MEREK] || "",
            tipe: r[COL.TIPE] || "",
            serialId: r[COL.SERIAL] || "",
            tahunBuat: r[COL.THN_BUAT] || "",
            tahunOperasi: r[COL.THN_OPS] || "",
            criticalityGi: r[COL.CRITICALITY] || "",
            prioritas: r[COL.PRIORITAS] || "",
            justifikasi: r[COL.JUSTIFIKASI] || "",
            statusUsia: r[COL.STATUS_USIA] || "",
            rencana: r[COL.RENCANA] || "",
            statusHi: (r[COL.STATUS_HI] || "").toUpperCase().trim(),
            nilaiHi: parseFloat(r[COL.NILAI_HI] || "0") || 0,
        })).filter(t => t.bay.length > 0 && t.gi.length > 0),
        [rawData]);

    // Unique lists
    const ultgList = useMemo(() => [...new Set(rows.map(r => r.ultg))].filter(Boolean).sort(), [rows]);
    const giList = useMemo(() => {
        let list = rows;
        if (filterULTG) list = list.filter(r => r.ultg === filterULTG);
        return [...new Set(list.map(r => r.gi))].filter(Boolean).sort();
    }, [rows, filterULTG]);
    const statusHIList = useMemo(() => [...new Set(rows.map(r => r.statusHi))].filter(Boolean).sort(), [rows]);
    const criticalityList = useMemo(() => [...new Set(rows.map(r => r.criticalityGi))].filter(Boolean), [rows]);
    const prioritasList = useMemo(() => [...new Set(rows.map(r => r.prioritas))].filter(Boolean).sort(), [rows]);

    const filtered = useMemo(() => {
        let data = rows;
        if (filterULTG) data = data.filter(r => r.ultg === filterULTG);
        if (filterGI) data = data.filter(r => r.gi === filterGI);
        if (filterStatusHI) data = data.filter(r => r.statusHi === filterStatusHI);
        if (filterCriticality) data = data.filter(r => r.criticalityGi === filterCriticality);
        if (filterPrioritas) data = data.filter(r => r.prioritas === filterPrioritas);
        if (searchBay) data = data.filter(r =>
            r.bay.toLowerCase().includes(searchBay.toLowerCase()) ||
            r.gi.toLowerCase().includes(searchBay.toLowerCase()) ||
            r.merek.toLowerCase().includes(searchBay.toLowerCase()));
        return data;
    }, [rows, filterULTG, filterGI, filterStatusHI, filterCriticality, filterPrioritas, searchBay]);

    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterGI(null); setFilterStatusHI(null);
        setFilterCriticality(null); setFilterPrioritas(null);
        setSearchBay(""); setPage(0);
    }, []);

    const hasFilters = filterULTG || filterGI || filterStatusHI || filterCriticality || filterPrioritas || searchBay;

    // ── KPIs ──
    const totalTrafo = filtered.length;
    const avgHI = totalTrafo > 0 ? (filtered.reduce((s, r) => s + r.nilaiHi, 0) / totalTrafo).toFixed(1) : "0";
    const goodCount = filtered.filter(r => ["VERY GOOD", "GOOD"].includes(r.statusHi)).length;
    const fairCount = filtered.filter(r => r.statusHi === "FAIR").length;
    const poorCount = filtered.filter(r => ["POOR", "VERY POOR"].includes(r.statusHi)).length;

    // ── Charts ──

    // 1. Status HI Distribution (donut — Monitoring Tower Kritis pattern)
    const statusDonut = useMemo(() => {
        const distMap: Record<string, number> = {};
        filtered.forEach(r => { if (r.statusHi) distMap[r.statusHi] = (distMap[r.statusHi] || 0) + 1; });
        const order = ["VERY GOOD", "GOOD", "FAIR", "POOR", "VERY POOR"];
        const data = order.filter(s => distMap[s]).map(name => ({
            name, value: distMap[name],
            itemStyle: {
                color: STATUS_HI_COLORS[name]?.color || C.indigo,
                opacity: filterStatusHI && filterStatusHI !== name ? 0.08 : 1,
                shadowBlur: filterStatusHI === name ? 12 : 0,
                shadowColor: filterStatusHI === name ? (STATUS_HI_COLORS[name]?.color || C.indigo) : "transparent",
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
                    `<strong>${p.name}</strong><br/>Trafo: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: "#d4d4d8", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "trafo", fontSize: 11, fill: "#a1a1aa", textAlign: "center" as const },
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
    }, [filtered, filterStatusHI]);

    // 2. Criticality Distribution (donut)
    const critDonut = useMemo(() => {
        const distMap: Record<string, number> = {};
        filtered.forEach(r => { if (r.criticalityGi) distMap[r.criticalityGi] = (distMap[r.criticalityGi] || 0) + 1; });
        const data = Object.entries(distMap).map(([name, value]) => ({
            name, value,
            itemStyle: {
                color: CRITICALITY_COLORS[name] || C.purple,
                opacity: filterCriticality && filterCriticality !== name ? 0.08 : 1,
                shadowBlur: filterCriticality === name ? 12 : 0,
                shadowColor: filterCriticality === name ? (CRITICALITY_COLORS[name] || C.purple) : "transparent",
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
                    `<strong>${p.name}</strong><br/>GI: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: "#d4d4d8", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "criticality", fontSize: 11, fill: "#a1a1aa", textAlign: "center" as const },
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
    }, [filtered, filterCriticality]);

    // 3. HI per GI (horizontal bar, sorted by avg HI)
    const hiPerGI = useMemo(() => {
        const giMap: Record<string, { sum: number; count: number }> = {};
        filtered.forEach(r => {
            if (!giMap[r.gi]) giMap[r.gi] = { sum: 0, count: 0 };
            giMap[r.gi].sum += r.nilaiHi;
            giMap[r.gi].count++;
        });
        const sorted = Object.entries(giMap)
            .map(([gi, v]) => ({ gi: gi.replace(/^GI\s*/i, "").replace(/\s*\d+kV\s*/i, " ").trim(), avg: Math.round(v.sum / v.count), count: v.count }))
            .sort((a, b) => a.avg - b.avg);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const, backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText, fontSize: 11 },
                formatter: (params: { name: string; value: number }[]) => {
                    const p = Array.isArray(params) ? params[0] : params;
                    const item = sorted.find(s => s.gi === p.name);
                    return `${p.name}<br/>Rata-rata HI: <b>${p.value}</b><br/>Jumlah Trafo: ${item?.count || 0}`;
                },
            },
            grid: { top: 10, right: 50, bottom: 8, left: 150 },
            yAxis: {
                type: "category" as const, data: sorted.map(g => g.gi),
                axisLabel: { fontSize: 9, color: "#d4d4d8", width: 140, overflow: "truncate" as const },
                axisLine: { show: false }, axisTick: { show: false },
            },
            xAxis: {
                type: "value" as const, max: 100,
                axisLabel: { fontSize: 10, color: theme.textMuted },
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            },
            series: [{
                type: "bar" as const, barWidth: 16,
                data: sorted.map(g => ({
                    value: g.avg,
                    itemStyle: {
                        color: g.avg >= 71 ? C.emerald : g.avg >= 50 ? C.amber : C.rose,
                        borderRadius: [0, 6, 6, 0],
                    },
                })),
                label: { show: true, position: "right" as const, fontSize: 10, fontWeight: "bold" as const, color: theme.emphasisText },
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
            }],
            animationDuration: 1000,
        };
    }, [filtered, theme]);

    // 4. Prioritas Penggantian distribution (bar)
    const prioritasChart = useMemo(() => {
        const pMap: Record<string, number> = {};
        filtered.forEach(r => { if (r.prioritas) pMap[r.prioritas] = (pMap[r.prioritas] || 0) + 1; });
        const keys = Object.keys(pMap).sort();
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const, backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText, fontSize: 11 },
            },
            grid: { top: 10, right: 16, bottom: 30, left: 40 },
            xAxis: {
                type: "category" as const, data: keys,
                axisLabel: { fontSize: 11, color: "#d4d4d8", fontWeight: "bold" as const },
                axisLine: { show: false }, axisTick: { show: false },
            },
            yAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: theme.textMuted },
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            },
            series: [{
                type: "bar" as const, barWidth: 40,
                data: keys.map(k => ({
                    value: pMap[k],
                    itemStyle: { color: PRIORITAS_COLORS[k] || C.indigo, borderRadius: [6, 6, 0, 0] },
                })),
                label: { show: true, position: "top" as const, fontSize: 12, fontWeight: "bold" as const, color: theme.emphasisText },
            }],
            animationDuration: 1000,
        };
    }, [filtered, theme]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    useEffect(() => { setPage(0); }, [filterULTG, filterGI, filterStatusHI, filterCriticality, filterPrioritas, searchBay]);

    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-80" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md"><CardContent className="p-6 text-center">
                    <p className="text-destructive font-semibold mb-2">Error Loading Data</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                </CardContent></Card>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="ds-heading flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" />
                        Health Index Trafo
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Data MTU Trafo — {rows.length} unit
                        {hasFilters && ` (menampilkan ${filtered.length})`}
                    </p>
                </div>
                <DataFreshness />
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {[
                    { label: "Total Trafo", value: totalTrafo.toString(), icon: Gauge, color: C.indigo, glow: "rgba(129,140,248,0.15)" },
                    { label: "Rata-rata HI", value: avgHI, icon: Activity, color: C.cyan, glow: "rgba(34,211,238,0.15)" },
                    { label: "GOOD+", value: goodCount.toString(), icon: CheckCircle2, color: C.emerald, glow: "rgba(52,211,153,0.15)" },
                    { label: "FAIR", value: fairCount.toString(), icon: AlertTriangle, color: C.amber, glow: "rgba(251,191,36,0.15)" },
                    { label: "POOR+", value: poorCount.toString(), icon: XCircle, color: C.rose, glow: "rgba(251,113,133,0.15)" },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
                            <div className="absolute inset-0 opacity-30"
                                style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.glow}, transparent 60%)` }} />
                            <CardContent className="p-3 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xl md:text-2xl font-bold leading-none">{kpi.value}</p>
                                        <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: kpi.color }}>{kpi.label}</p>
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

            {/* ── Filters ── */}
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

                        <SelectNative value={filterStatusHI || ""} onChange={e => setFilterStatusHI(e.target.value || null)}>
                            <option value="">Semua Status HI</option>
                            {statusHIList.map(s => <option key={s} value={s}>{s}</option>)}
                        </SelectNative>

                        <SelectNative value={filterCriticality || ""} onChange={e => setFilterCriticality(e.target.value || null)}>
                            <option value="">Criticality</option>
                            {criticalityList.map(c => <option key={c} value={c}>{c}</option>)}
                        </SelectNative>

                        <SelectNative value={filterPrioritas || ""} onChange={e => setFilterPrioritas(e.target.value || null)}>
                            <option value="">Prioritas</option>
                            {prioritasList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input type="text" value={searchBay} onChange={e => setSearchBay(e.target.value)}
                                placeholder="Cari bay/merek..."
                                className="h-8 pl-8 pr-2 text-xs w-44" />
                        </div>

                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                                <RefreshCw className="h-3 w-3" /> Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Charts Row 1: Status HI + Criticality ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Distribusi Status HI
                            <Badge variant="secondary" className="ml-auto text-xs">{filtered.length} trafo</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={statusDonut} style={{ height: 280 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" /> Criticality Gardu Induk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={critDonut} style={{ height: 280 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ── Charts Row 2: HI per GI + Prioritas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Rata-rata HI per Gardu Induk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={hiPerGI} style={{ height: Math.max(280, ((hiPerGI.yAxis as { data?: string[] })?.data?.length || 0) * 30) }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> Prioritas Penggantian
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={prioritasChart} style={{ height: 280 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ── Data Table ── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary" /> Detail Trafo
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {filtered.length} data — Halaman {page + 1}/{totalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8.75">No</TableHead>
                                    <TableHead>ULTG</TableHead>
                                    <TableHead>Gardu Induk</TableHead>
                                    <TableHead>Bay</TableHead>
                                    <TableHead className="text-center">MVA</TableHead>
                                    <TableHead>Merek</TableHead>
                                    <TableHead className="text-center">Thn Buat</TableHead>
                                    <TableHead className="text-center">Criticality</TableHead>
                                    <TableHead className="text-center">Prioritas</TableHead>
                                    <TableHead className="text-center">Nilai HI</TableHead>
                                    <TableHead className="text-center">Status HI</TableHead>
                                    <TableHead>Rencana</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => {
                                    const hiColor = STATUS_HI_COLORS[r.statusHi]?.color || C.indigo;
                                    const critColor = CRITICALITY_COLORS[r.criticalityGi] || C.purple;
                                    const prioColor = PRIORITAS_COLORS[r.prioritas] || C.indigo;
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground text-xs">{page * PAGE_SIZE + i + 1}</TableCell>
                                            <TableCell className="text-xs">
                                                <Badge variant="outline" className="text-xs px-1 py-0">{r.ultg}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{r.gi}</TableCell>
                                            <TableCell className="text-xs font-medium min-w-40">{r.bay}</TableCell>
                                            <TableCell className="text-xs text-center font-semibold">{r.mva}</TableCell>
                                            <TableCell className="text-xs">{r.merek}</TableCell>
                                            <TableCell className="text-xs text-center">{r.tahunBuat}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-xs px-1.5 py-0"
                                                    style={{ backgroundColor: `${critColor}20`, color: critColor, border: `1px solid ${critColor}30` }}>
                                                    {r.criticalityGi}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-xs px-1.5 py-0 font-bold"
                                                    style={{ backgroundColor: `${prioColor}20`, color: prioColor, border: `1px solid ${prioColor}30` }}>
                                                    {r.prioritas}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center text-xs font-bold" style={{ color: hiColor }}>
                                                {r.nilaiHi}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-xs px-1.5 py-0"
                                                    style={{ backgroundColor: `${hiColor}20`, color: hiColor, border: `1px solid ${hiColor}30` }}>
                                                    {r.statusHi}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{r.rencana}</TableCell>
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
