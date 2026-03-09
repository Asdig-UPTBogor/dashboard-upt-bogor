"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
    Filter, RefreshCw, Search, ChevronLeft, ChevronRight, Layers,
    Building2, Radio, MapPin, FileImage,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
    red: "#ef4444", green: "#22c55e", yellow: "#eab308",
};

export default function SLDTowerPage() {
    const [rawData, setRawData] = useState<Record<string, string>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterULTG, setFilterULTG] = useState("");
    const [filterGI, setFilterGI] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    useEffect(() => {
        fetch("/api/sld-tower")
            .then(r => r.json())
            .then(json => {
                if (json.error) setError(json.error);
                else setRawData(json.data || []);
                setLoading(false);
            })
            .catch(e => { setError(String(e)); setLoading(false); });
    }, []);

    // Unique lists for dropdowns
    const ultgList = useMemo(() => [...new Set(rawData.map(r => r["ULTG"]).filter(Boolean))].sort(), [rawData]);
    const giList = useMemo(() => {
        let src = rawData;
        if (filterULTG) src = src.filter(r => r["ULTG"] === filterULTG);
        return [...new Set(src.map(r => r["GARDU INDUK"]).filter(Boolean))].sort();
    }, [rawData, filterULTG]);

    // Filtered data
    const filtered = useMemo(() => {
        let result = rawData;
        if (filterULTG) result = result.filter(r => r["ULTG"] === filterULTG);
        if (filterGI) result = result.filter(r => r["GARDU INDUK"] === filterGI);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => Object.values(r).some(v => v.toLowerCase().includes(q)));
        }
        return result;
    }, [rawData, filterULTG, filterGI, searchQuery]);

    // KPIs
    const totalTower = filtered.length;
    const totalULTG = useMemo(() => new Set(filtered.map(r => r["ULTG"]).filter(Boolean)).size, [filtered]);
    const totalGI = useMemo(() => new Set(filtered.map(r => r["GARDU INDUK"]).filter(Boolean)).size, [filtered]);
    const totalPenghantar = useMemo(() => new Set(filtered.map(r => r["PENGHANTAR"]).filter(Boolean)).size, [filtered]);

    // Chart: Tower per ULTG
    const towerPerULTG = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const u = r["ULTG"] || "N/A"; counts[u] = (counts[u] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [filtered]);

    // Chart: Tower per GI (top 15)
    const towerPerGI = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const g = r["GARDU INDUK"] || "N/A"; counts[g] = (counts[g] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    }, [filtered]);

    const echartBase = {
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: "#a1a1aa" },
    };

    // Bar chart option
    const barOption = useMemo(() => ({
        ...echartBase,
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: "rgba(15,15,30,0.9)",
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: "#e4e4e7", fontSize: 12 },
        },
        grid: { top: 10, right: 16, bottom: 60, left: 48 },
        xAxis: {
            type: "category" as const,
            data: towerPerULTG.map(([name]) => name),
            axisLabel: { fontSize: 10, color: "#71717a", rotate: 30 },
            axisLine: { lineStyle: { color: "#27272a" } },
        },
        yAxis: {
            type: "value" as const,
            axisLabel: { fontSize: 10, color: "#71717a" },
            splitLine: { lineStyle: { color: "#27272a", type: "dashed" as const } },
        },
        series: [{
            type: "bar" as const,
            data: towerPerULTG.map(([, count], i) => ({
                value: count,
                itemStyle: {
                    color: {
                        type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: [C.indigo, C.teal, C.amber, C.purple, C.pink, C.emerald][i % 6] },
                            { offset: 1, color: [C.purple, C.emerald, C.orange, C.rose, C.cyan, C.blue][i % 6] },
                        ],
                    },
                    borderRadius: [4, 4, 0, 0],
                },
            })),
            emphasis: { itemStyle: { shadowBlur: 15, shadowColor: "rgba(129,140,248,0.5)" } },
            barMaxWidth: 50,
        }],
        animationDuration: 1200,
        animationEasing: "elasticOut",
    }), [towerPerULTG]);

    // Donut chart option
    const donutColors = [C.amber, C.indigo, C.teal, C.pink, C.purple, C.emerald, C.rose, C.blue, C.cyan, C.orange];
    const donutOption = useMemo(() => ({
        ...echartBase,
        tooltip: {
            trigger: "item" as const,
            backgroundColor: "rgba(15,15,30,0.9)",
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: "#e4e4e7" },
            formatter: "{b}: {c} ({d}%)",
        },
        legend: {
            type: "scroll" as const,
            bottom: 0,
            textStyle: { color: "#a1a1aa", fontSize: 9 },
            itemWidth: 8, itemHeight: 8,
        },
        series: [{
            type: "pie" as const,
            radius: ["35%", "70%"],
            center: ["50%", "42%"],
            padAngle: 3,
            itemStyle: { borderRadius: 6 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" as const, color: "#fff" }, scaleSize: 5 },
            data: towerPerGI.map(([name, value], i) => ({
                name: name.replace("GI ", "").replace("GIS ", "").replace("GITET ", ""),
                value,
                itemStyle: { color: donutColors[i % donutColors.length] },
            })),
        }],
        animationType: "scale",
        animationDuration: 1000,
    }), [towerPerGI]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => { setPage(0); }, [searchQuery, filterULTG, filterGI]);

    const clearFilters = () => {
        setFilterULTG("");
        setFilterGI("");
        setSearchQuery("");
    };

    const hasFilters = filterULTG || filterGI || searchQuery;

    // Table columns
    const tableHeaders = ["NO", "ULTG", "GARDU INDUK", "PENGHANTAR", "NO TOWER", "SINGLE LINE DIAGRAM TOWER", "STATUS"];

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileImage className="h-6 w-6 text-indigo-400" />
                        SLD Tower
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Single Line Diagram Tower — {rawData.length.toLocaleString()} records
                        {hasFilters && ` (menampilkan ${filtered.length.toLocaleString()})`}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Reset Filter
                        </button>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                        <RefreshCw className="h-3 w-3 mr-1" /> Auto-refresh 5 menit
                    </Badge>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Jumlah Data", value: totalTower, icon: Layers, color: C.indigo },
                    { label: "Jumlah ULTG", value: totalULTG, icon: Building2, color: C.teal },
                    { label: "Jumlah Gardu Induk", value: totalGI, icon: MapPin, color: C.amber },
                    { label: "Jumlah Penghantar", value: totalPenghantar, icon: Radio, color: C.purple },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                            <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.color}15, transparent 60%)` }} />
                            <CardContent className="p-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xl md:text-2xl font-extrabold leading-none">{kpi.value.toLocaleString()}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider" style={{ color: kpi.color }}>
                                            {kpi.label}
                                        </p>
                                    </div>
                                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                        <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-7">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Distribusi Tower per ULTG
                            <Badge variant="secondary" className="ml-auto text-[9px]">{towerPerULTG.length} ULTG</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={barOption} style={{ height: 300 }} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" /> Distribusi Tower per Gardu Induk
                            <Badge variant="secondary" className="ml-auto text-[9px]">Top 15</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={donutOption} style={{ height: 300 }} />
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <SelectNative value={filterULTG} onChange={e => { setFilterULTG(e.target.value); setFilterGI(""); }} className="w-40 text-xs">
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>
                        <SelectNative value={filterGI} onChange={e => setFilterGI(e.target.value)} className="w-52 text-xs">
                            <option value="">Semua Gardu Induk</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari tower, penghantar..."
                                className="pl-9" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Active filters */}
            {hasFilters && (
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-xs text-muted-foreground">Filter aktif:</span>
                    {filterULTG && <Badge variant="secondary" className="text-xs">ULTG: {filterULTG}</Badge>}
                    {filterGI && <Badge variant="secondary" className="text-xs">GI: {filterGI}</Badge>}
                    {searchQuery && <Badge variant="secondary" className="text-xs">Search: &quot;{searchQuery}&quot;</Badge>}
                </div>
            )}

            {/* Data Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <FileImage className="h-4 w-4 text-primary" /> Detail SLD Tower
                        <Badge variant="secondary" className="ml-auto text-[9px]">
                            {filtered.length.toLocaleString()} data — Halaman {page + 1}/{totalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {tableHeaders.map((h, i) => (
                                        <TableHead key={i} className="whitespace-nowrap text-xs">{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => (
                                    <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{r["NO"] || (page * PAGE_SIZE + i + 1)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px]">{r["ULTG"] || "-"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">{r["GARDU INDUK"] || "-"}</TableCell>
                                        <TableCell className="text-xs max-w-[250px] truncate" title={r["PENGHANTAR"]}>{r["PENGHANTAR"] || "-"}</TableCell>
                                        <TableCell className="text-xs font-mono">{r["NO TOWER"] || "-"}</TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate" title={r["SINGLE LINE DIAGRAM TOWER"]}>{r["SINGLE LINE DIAGRAM TOWER"] || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[9px] bg-amber-500/15 text-amber-500 border-amber-500/30">
                                                On Progress Update
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {paginatedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={tableHeaders.length} className="h-24 text-center">
                                            Tidak ada data ditemukan.
                                        </TableCell>
                                    </TableRow>
                                )}
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
