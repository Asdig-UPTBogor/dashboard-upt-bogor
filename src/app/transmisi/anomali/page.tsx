"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    Filter, RefreshCw, MapPin, Search, BarChart3,
    CheckCircle2, Building2, ChevronLeft, ChevronRight, Layers,
    Radio, Activity, AlertTriangle, Info
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

const echartBase = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, sans-serif", color: "#a1a1aa" },
};

export default function AnomaliTowerPage() {
    const [rawData, setRawData] = useState<Record<string, string>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string | null>(null);
    const [filterPenghantar, setFilterPenghantar] = useState<string | null>(null);
    const [filterKomponen, setFilterKomponen] = useState<string | null>(null);
    const [filterTingkat, setFilterTingkat] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    useEffect(() => {
        fetch("/api/anomali-tower")
            .then(r => r.json())
            .then(json => {
                if (json.error) setError(json.error);
                else {
                    const normalized = (json.data || []).map((r: any) => ({
                        ...r,
                        "ULTG": (r["Master ULTG"] || r["ULTG"] || "N/A").toUpperCase(),
                        "GARDU INDUK": r["Master Gardu Induk"] || r["Gardu Induk"] || "N/A",
                        "PENGHANTAR": r["Penghantar"] || r["PENGHANTAR"] || "N/A",
                        "NAMA TOWER": r["Bay"] || r["NAMA TOWER"] || "N/A",
                        "KOMPONEN": r["Komponen"] || r["KOMPONEN"] || "N/A",
                        "KONDISI": r["Kondisi"] || r["KONDISI"] || "N/A",
                        "TINGKAT": (r["Tingkat"] || r["STATUS"] || "N/A").toUpperCase(),
                        "KETERANGAN": r["Ket."] || r["KETERANGAN"] || "-",
                        "TANGGAL": r["Tanggal"] || r["TAHUN TEMUAN"] || "-",
                    })).filter((r: any) => r["NAMA TOWER"] !== "N/A");
                    setRawData(normalized);
                }
                setLoading(false);
            })
            .catch(e => { setError(String(e)); setLoading(false); });
    }, []);

    // Unique lists
    const ultgList = useMemo(() => [...new Set(rawData.map(r => r["ULTG"]).filter(Boolean))].sort(), [rawData]);
    const giList = useMemo(() => {
        let src = rawData;
        if (filterULTG) src = src.filter(r => r["ULTG"] === filterULTG);
        return [...new Set(src.map(r => r["GARDU INDUK"]).filter(Boolean))].sort();
    }, [rawData, filterULTG]);
    const penghantarList = useMemo(() => {
        let src = rawData;
        if (filterGI) src = src.filter(r => r["GARDU INDUK"] === filterGI);
        return [...new Set(src.map(r => r["PENGHANTAR"]).filter(Boolean))].sort();
    }, [rawData, filterGI]);
    const komponenList = useMemo(() => [...new Set(rawData.map(r => r["KOMPONEN"]).filter(Boolean))].sort(), [rawData]);
    const tingkatList = useMemo(() => [...new Set(rawData.map(r => r["TINGKAT"]).filter(Boolean))].sort(), [rawData]);

    // Filtered data
    const filtered = useMemo(() => {
        let data = rawData;
        if (filterULTG) data = data.filter(r => r["ULTG"] === filterULTG);
        if (filterGI) data = data.filter(r => r["GARDU INDUK"] === filterGI);
        if (filterPenghantar) data = data.filter(r => r["PENGHANTAR"] === filterPenghantar);
        if (filterKomponen) data = data.filter(r => r["KOMPONEN"] === filterKomponen);
        if (filterTingkat) data = data.filter(r => r["TINGKAT"] === filterTingkat);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r => Object.values(r).some(v => v.toLowerCase().includes(q)));
        }
        return data;
    }, [rawData, filterULTG, filterGI, filterPenghantar, filterKomponen, filterTingkat, searchQuery]);

    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterGI(null); setFilterPenghantar(null);
        setFilterKomponen(null); setFilterTingkat(null); setSearchQuery(""); setPage(0);
    }, []);

    const hasFilters = filterULTG || filterGI || filterPenghantar || filterKomponen || filterTingkat || searchQuery;

    // ── KPIs ──
    const totalData = filtered.length;
    const countMayor = filtered.filter(r => r["TINGKAT"] === "MAYOR").length;
    const countMinor = filtered.filter(r => r["TINGKAT"] === "MINOR").length;
    const totalULTGCount = new Set(filtered.map(r => r["ULTG"]).filter(Boolean)).size;

    // ── Charts ──

    // 1. Chart Tingkat (Mayor vs Minor) - Horizontal Stacked Bar per ULTG
    const tingkatPerULTGChart = useMemo(() => {
        const aggr: Record<string, { MAYOR: number, MINOR: number }> = {};
        filtered.forEach(r => {
            const u = r["ULTG"];
            const t = r["TINGKAT"];
            if (!aggr[u]) aggr[u] = { MAYOR: 0, MINOR: 0 };
            if (t === "MAYOR") aggr[u].MAYOR++;
            if (t === "MINOR") aggr[u].MINOR++;
        });
        
        const sorted = Object.entries(aggr).sort((a, b) => (b[1].MAYOR + b[1].MINOR) - (a[1].MAYOR + a[1].MINOR));
        const categories = sorted.map(([k]) => k);
        const mayorData = sorted.map(([, v]) => v.MAYOR);
        const minorData = sorted.map(([, v]) => v.MINOR);

        return {
            ...echartBase,
            tooltip: { trigger: "axis" as const, backgroundColor: "rgba(10,10,25,0.95)", borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7", fontSize: 11 }, axisPointer: { type: "shadow" as const, shadowStyle: { color: "rgba(129,140,248,0.06)" } } },
            legend: { data: ["MAYOR", "MINOR"], textStyle: { color: "#a1a1aa", fontSize: 11 }, bottom: 0 },
            grid: { top: 20, right: 30, bottom: 40, left: 100 },
            xAxis: { type: "value" as const, splitLine: { lineStyle: { color: "#1e1e2e", type: "dashed" as const } }, axisLabel: { fontSize: 10, color: "#71717a" } },
            yAxis: { type: "category" as const, data: categories, axisLabel: { fontSize: 10, color: "#a1a1aa" }, axisLine: { lineStyle: { color: "#27272a" } } },
            series: [
                {
                    name: "MAYOR", type: "bar" as const, stack: "total", barMaxWidth: 40,
                    itemStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "#9f1239" }, { offset: 1, color: C.rose }] }, borderRadius: [0, 0, 0, 0] },
                    label: { show: true, position: "inside", fontSize: 10, fontWeight: "bold", color: "#fff", formatter: (p: any) => p.value > 0 ? p.value : "" },
                    data: mayorData
                },
                {
                    name: "MINOR", type: "bar" as const, stack: "total", barMaxWidth: 40,
                    itemStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "#b45309" }, { offset: 1, color: C.amber }] }, borderRadius: [0, 4, 4, 0] },
                    label: { show: true, position: "inside", fontSize: 10, fontWeight: "bold", color: "#fff", formatter: (p: any) => p.value > 0 ? p.value : "" },
                    data: minorData
                }
            ],
            animationDuration: 1000
        };
    }, [filtered]);

    // 2. Chart Masing-masing ULTG (Total Distribusi Vertical)
    const ultgChart = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const u = r["ULTG"] || "N/A"; counts[u] = (counts[u] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        
        return {
            ...echartBase,
            tooltip: { trigger: "axis" as const, backgroundColor: "rgba(10,10,25,0.95)", borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7", fontSize: 11 }, axisPointer: { type: "shadow" as const, shadowStyle: { color: "rgba(129,140,248,0.06)" } } },
            grid: { top: 20, right: 20, bottom: 50, left: 40 },
            xAxis: {
                type: "category" as const, data: sorted.map(([n]) => n),
                axisLabel: { fontSize: 9, color: "#a1a1aa", rotate: 20 },
                axisLine: { lineStyle: { color: "#27272a" } },
                axisTick: { show: false },
            },
            yAxis: { type: "value" as const, splitLine: { lineStyle: { color: "#1e1e2e", type: "dashed" as const } }, axisLabel: { fontSize: 10, color: "#71717a" } },
            series: [{
                type: "bar" as const, data: sorted.map(([, v], i) => ({
                    value: v,
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: [C.indigo, C.teal, C.blue][i % 3] }, { offset: 1, color: ["#312e81", "#134e4a", "#1e3a8a"][i % 3] }] },
                        borderRadius: [4, 4, 0, 0]
                    },
                    emphasis: { itemStyle: { shadowBlur: 12, shadowColor: "rgba(129,140,248,0.4)" } },
                })),
                label: { show: true, position: "top", fontSize: 10, fontWeight: "bold", color: "#d4d4d8" },
                barMaxWidth: 60
            }],
            animationDuration: 1200
        };
    }, [filtered]);

    // 3. Chart Komponen Anomali (Horizontal Top 10)
    const komponenChart = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const k = r["KOMPONEN"] || "N/A"; counts[k] = (counts[k] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]).slice(-10); // Take Top 10 (ascending for horizontal)
        
        return {
            ...echartBase,
            tooltip: { trigger: "axis" as const, backgroundColor: "rgba(10,10,25,0.95)", borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7", fontSize: 11 }, axisPointer: { type: "shadow" as const, shadowStyle: { color: "rgba(129,140,248,0.06)" } } },
            grid: { top: 10, right: 40, bottom: 10, left: 240 },
            xAxis: { type: "value" as const, splitLine: { show: false }, axisLabel: { show: false } },
            yAxis: { 
                type: "category" as const, data: sorted.map(([n]) => n), 
                axisLabel: { fontSize: 10, color: "#a1a1aa", width: 230, overflow: "truncate", ellipsis: "..." }, 
                axisLine: { show: false }, axisTick: { show: false } 
            },
            series: [{
                type: "bar" as const, data: sorted.map(([, v]) => ({
                    value: v,
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "#4c1d95" }, { offset: 1, color: C.purple }] },
                        borderRadius: [0, 4, 4, 0]
                    }
                })),
                label: { show: true, position: "right", fontSize: 11, fontWeight: "bold", color: "#e4e4e7" },
                barMaxWidth: 30,
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 4, 4, 0] }
            }],
            animationDuration: 1200
        };
    }, [filtered]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    useEffect(() => { setPage(0); }, [filterULTG, filterGI, filterPenghantar, filterKomponen, filterTingkat, searchQuery]);

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
                <Skeleton className="h-80" />
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center h-96"><Card className="max-w-md"><CardContent className="p-6 text-center"><p className="text-destructive font-semibold mb-2">Error Loading Data</p><p className="text-sm text-muted-foreground">{error}</p></CardContent></Card></div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ───── Header ───── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-indigo-400" />
                        Anomali Tower
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Sistem Rekapitulasi Informasi Tower Anomali (SRINTAMI) — {rawData.length.toLocaleString()} total data
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Reset Filter
                        </button>
                    )}
                </div>
            </div>

            {/* ───── KPI Cards ───── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Total Anomali", value: totalData, icon: Layers, color: C.indigo },
                    { label: "Tingkat Mayor", value: countMayor, icon: AlertTriangle, color: C.rose },
                    { label: "Tingkat Minor", value: countMinor, icon: Activity, color: C.amber },
                    { label: "Total ULTG", value: totalULTGCount, icon: Building2, color: C.teal },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-border/40">
                            <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.color}25, transparent 70%)` }} />
                            <CardContent className="p-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-2xl font-extrabold leading-none tracking-tight">{kpi.value.toLocaleString()}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider" style={{ color: kpi.color }}>
                                            {kpi.label}
                                        </p>
                                    </div>
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                        <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* ───── Filters ───── */}
            <Card className="border-border/40 overflow-visible z-20">
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground ml-1 mr-2" />
                        
                        <SelectNative value={filterULTG || ""} onChange={e => { setFilterULTG(e.target.value || null); setFilterGI(null); setFilterPenghantar(null); }} className="w-36 text-xs bg-background/50">
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>
                        
                        <SelectNative value={filterGI || ""} onChange={e => { setFilterGI(e.target.value || null); setFilterPenghantar(null); }} className="w-44 text-xs bg-background/50">
                            <option value="">Semua Gardu Induk</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>
                        
                        <SelectNative value={filterPenghantar || ""} onChange={e => { setFilterPenghantar(e.target.value || null); }} className="w-48 text-xs bg-background/50">
                            <option value="">Semua Penghantar</option>
                            {penghantarList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <SelectNative value={filterKomponen || ""} onChange={e => { setFilterKomponen(e.target.value || null); }} className="w-40 text-xs bg-background/50">
                            <option value="">Semua Komponen</option>
                            {komponenList.map(k => <option key={k} value={k}>{k}</option>)}
                        </SelectNative>

                        <SelectNative value={filterTingkat || ""} onChange={e => { setFilterTingkat(e.target.value || null); }} className="w-36 text-xs bg-background/50">
                            <option value="">Semua Tingkat</option>
                            {tingkatList.map(t => <option key={t} value={t}>{t}</option>)}
                        </SelectNative>

                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari tower, nama..."
                                className="pl-9 h-9 text-xs bg-background/50" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ───── Graphic Layout ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-6 border-border/40 hover:border-border/80 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> Distribusi Mayor vs Minor per ULTG
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={tingkatPerULTGChart} style={{ height: 320 }} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-6 border-border/40 hover:border-border/80 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Total Anomali per ULTG
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={ultgChart} style={{ height: 320 }} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-12 border-border/40 hover:border-border/80 transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Radio className="h-4 w-4 text-primary" /> Top 10 Komponen Anomali
                            <Badge variant="secondary" className="ml-auto text-[9px]">{komponenList.length} Total Komponen</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={komponenChart} style={{ height: 360 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Data Table ───── */}
            <Card className="border-border/40 overflow-hidden">
                <CardHeader className="pb-2 bg-muted/20">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Tabel Rincian Anomali SRINTAMI
                        <Badge variant="secondary" className="ml-auto text-[9px] font-mono">
                            {filtered.length.toLocaleString()} Entries | Hal {page + 1}/{totalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="w-[40px] text-xs h-9">No</TableHead>
                                    <TableHead className="text-xs h-9">ULTG</TableHead>
                                    <TableHead className="text-xs h-9">Gardu Induk</TableHead>
                                    <TableHead className="text-xs h-9">Penghantar</TableHead>
                                    <TableHead className="text-xs h-9">Tower / Bay</TableHead>
                                    <TableHead className="text-xs h-9 max-w-[200px]">Komponen & Kondisi</TableHead>
                                    <TableHead className="text-center text-xs h-9">Tingkat</TableHead>
                                    <TableHead className="text-xs h-9 max-w-[200px]">Keterangan</TableHead>
                                    <TableHead className="text-xs h-9 text-right">Tanggal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => {
                                    const isMayor = r["TINGKAT"] === "MAYOR";
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="text-muted-foreground text-[10px] font-mono">{r["NO"] || (page * PAGE_SIZE + i + 1)}</TableCell>
                                            <TableCell className="text-[10px]">
                                                <Badge variant="outline" className="text-[9px] px-1.5 bg-background/50">{r["ULTG"]}</Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] font-medium whitespace-nowrap">{r["GARDU INDUK"]}</TableCell>
                                            <TableCell className="text-[10px] max-w-[150px] truncate" title={r["PENGHANTAR"]}>{r["PENGHANTAR"]}</TableCell>
                                            <TableCell className="text-[10px] font-mono font-semibold text-emerald-400">{r["NAMA TOWER"]}</TableCell>
                                            <TableCell className="text-[10px] max-w-[200px]">
                                                <div className="font-semibold text-[#e4e4e7] truncate" title={r["KOMPONEN"]}>{r["KOMPONEN"]}</div>
                                                <div className="text-muted-foreground text-[9px] truncate mt-0.5 text-orange-300" title={r["KONDISI"]}>{r["KONDISI"]}</div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={`text-[9px] px-2 py-0.5 ${isMayor ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`} variant="outline">
                                                    {r["TINGKAT"]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] max-w-[200px]">
                                                <div className="line-clamp-2 text-muted-foreground" title={r["KETERANGAN"]}>{r["KETERANGAN"]}</div>
                                            </TableCell>
                                            <TableCell className="text-[10px] text-right font-mono text-muted-foreground whitespace-nowrap">
                                                {r["TANGGAL"]}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 py-3 bg-muted/10 border-t">
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                                className="h-7 text-xs px-2 bg-background/50">
                                <ChevronLeft className="h-3 w-3 mr-1" /> Prev
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
                                            onClick={() => setPage(p)} className="w-7 h-7 text-xs p-0 bg-background/50">
                                            {p + 1}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                                className="h-7 text-xs px-2 bg-background/50">
                                Next <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
