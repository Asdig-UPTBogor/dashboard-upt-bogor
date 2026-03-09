"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    AlertTriangle, Filter, RefreshCw, MapPin, Search, BarChart3,
    CheckCircle2, Building2, XCircle, ShieldAlert, Eye, ChevronLeft, ChevronRight, Layers,
    Radio, Wifi, WifiOff,
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

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
    "IN PROGRESS": { color: C.amber, label: "In Progress" },
    "SELESAI": { color: C.emerald, label: "Selesai" },
    "OPEN": { color: C.rose, label: "Open" },
    "CLOSE": { color: C.emerald, label: "Close" },
};

const KONDISI_COLORS: Record<string, string> = {
    "LINGKUNGAN": C.teal,
    "KONSTRUKSI": C.orange,
    "PONDASI": C.rose,
    "KOROSI": C.amber,
    "GROUNDING": C.purple,
    "ISOLATOR": C.cyan,
    "PENGHANTAR": C.blue,
};

export default function AnomaliTowerPage() {
    const [rawData, setRawData] = useState<Record<string, string>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [filterKondisi, setFilterKondisi] = useState<string | null>(null);
    const [filterVenom, setFilterVenom] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    useEffect(() => {
        fetch("/api/anomali-tower")
            .then(r => r.json())
            .then(json => {
                if (json.error) setError(json.error);
                else setRawData(json.data || []);
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
    const statusList = useMemo(() => [...new Set(rawData.map(r => r["STATUS"]).filter(Boolean))].sort(), [rawData]);
    const kondisiList = useMemo(() => [...new Set(rawData.map(r => r["KONDISI KRITIS"]).filter(Boolean))].sort(), [rawData]);
    const venomList = useMemo(() => [...new Set(rawData.map(r => r["VENOM TERPASANG"]).filter(Boolean))].sort(), [rawData]);

    // Filtered data
    const filtered = useMemo(() => {
        let data = rawData;
        if (filterULTG) data = data.filter(r => r["ULTG"] === filterULTG);
        if (filterGI) data = data.filter(r => r["GARDU INDUK"] === filterGI);
        if (filterStatus) data = data.filter(r => r["STATUS"] === filterStatus);
        if (filterKondisi) data = data.filter(r => r["KONDISI KRITIS"] === filterKondisi);
        if (filterVenom) data = data.filter(r => r["VENOM TERPASANG"] === filterVenom);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r => Object.values(r).some(v => v.toLowerCase().includes(q)));
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
    const totalULTG = useMemo(() => new Set(filtered.map(r => r["ULTG"]).filter(Boolean)).size, [filtered]);
    const totalGI = useMemo(() => new Set(filtered.map(r => r["GARDU INDUK"]).filter(Boolean)).size, [filtered]);
    const totalPenghantar = useMemo(() => new Set(filtered.map(r => r["PENGHANTAR"]).filter(Boolean)).size, [filtered]);
    const venomOnline = filtered.filter(r => (r["ONLINE/OFFLINE"] || "").toUpperCase().includes("ONLINE")).length;
    const venomTerpasang = filtered.filter(r => (r["VENOM TERPASANG"] || "").toUpperCase().includes("TERPASANG") && !(r["VENOM TERPASANG"] || "").toUpperCase().includes("TIDAK")).length;

    // ── Charts ──

    // 1. Per ULTG bar chart
    const perULTGChart = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const u = r["ULTG"] || "N/A"; counts[u] = (counts[u] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return {
            ...echartBase,
            tooltip: { trigger: "axis" as const, backgroundColor: "rgba(15,15,30,0.95)", borderColor: "rgba(129,140,248,0.3)", textStyle: { color: "#e4e4e7", fontSize: 12 } },
            grid: { top: 10, right: 16, bottom: 60, left: 48 },
            xAxis: {
                type: "category" as const, data: sorted.map(([n]) => n),
                axisLabel: { fontSize: 10, color: "#71717a", rotate: 15 },
                axisLine: { lineStyle: { color: "#27272a" } },
            },
            yAxis: {
                type: "value" as const, axisLabel: { fontSize: 10, color: "#71717a" },
                splitLine: { lineStyle: { color: "#27272a", type: "dashed" as const } },
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
                label: { show: true, position: "top" as const, fontSize: 11, fontWeight: "bold" as const, color: "#e4e4e7" },
            }],
            animationDuration: 1200, animationEasing: "elasticOut",
        };
    }, [filtered]);

    // 2. Per Kondisi Kritis donut
    const kondisiDonut = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const k = r["KONDISI KRITIS"] || "N/A"; counts[k] = (counts[k] || 0) + 1; });
        const data = Object.entries(counts).map(([name, value]) => ({
            name, value,
            itemStyle: { color: KONDISI_COLORS[name.toUpperCase()] || C.indigo },
        }));
        const total = data.reduce((s, d) => s + d.value, 0);
        return {
            ...echartBase,
            tooltip: { trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)", borderColor: "rgba(129,140,248,0.3)", textStyle: { color: "#e4e4e7" }, formatter: "{b}: {c} ({d}%)" },
            legend: {
                type: "scroll" as const, bottom: 0,
                textStyle: { color: "#a1a1aa", fontSize: 9 }, itemWidth: 8, itemHeight: 8,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "36%",
                style: { text: `${total}`, fontSize: 24, fontWeight: "bold" as const, fill: "#e4e4e7", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "tower kritis", fontSize: 11, fill: "#71717a", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "70%"], center: ["50%", "42%"],
                padAngle: 3, itemStyle: { borderRadius: 6 },
                label: { show: false }, emphasis: { scaleSize: 4 }, data,
            }],
            animationType: "scale", animationDuration: 1000,
        };
    }, [filtered]);

    // 3. Status donut
    const statusDonut = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const s = r["STATUS"] || "N/A"; counts[s] = (counts[s] || 0) + 1; });
        const colors = [C.amber, C.emerald, C.rose, C.blue, C.purple, C.cyan];
        const data = Object.entries(counts).map(([name, value], i) => ({
            name, value,
            itemStyle: { color: STATUS_COLORS[name.toUpperCase()]?.color || colors[i % colors.length] },
        }));
        const total = data.reduce((s, d) => s + d.value, 0);
        return {
            ...echartBase,
            tooltip: { trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)", borderColor: "rgba(129,140,248,0.3)", textStyle: { color: "#e4e4e7" }, formatter: "{b}: {c} ({d}%)" },
            legend: {
                orient: "horizontal" as const, bottom: 0,
                itemWidth: 10, itemHeight: 10, itemGap: 16,
                textStyle: { color: "#d4d4d8", fontSize: 10 },
                formatter: (name: string) => {
                    const item = data.find(d => d.name === name);
                    const pct = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                    return `${name}  ${(item?.value || 0)}  (${pct}%)`;
                },
            },
            graphic: [{
                type: "text" as const, left: "center", top: "36%",
                style: { text: `${total}`, fontSize: 24, fontWeight: "bold" as const, fill: "#e4e4e7", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "total", fontSize: 11, fill: "#71717a", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["44%", "70%"], center: ["50%", "42%"],
                padAngle: 3, itemStyle: { borderRadius: 6 },
                label: { show: false }, emphasis: { scaleSize: 4 }, data,
            }],
            animationType: "scale", animationDuration: 1000,
        };
    }, [filtered]);

    // 4. Venom status donut
    const venomDonut = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const v = r["VENOM TERPASANG"] || "Tidak diketahui"; counts[v] = (counts[v] || 0) + 1; });
        const colors = [C.emerald, C.rose, C.amber, C.blue, C.purple];
        const data = Object.entries(counts).map(([name, value], i) => ({
            name, value, itemStyle: { color: colors[i % colors.length] },
        }));
        return {
            ...echartBase,
            tooltip: { trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)", borderColor: "rgba(129,140,248,0.3)", textStyle: { color: "#e4e4e7" }, formatter: "{b}: {c} ({d}%)" },
            legend: {
                type: "scroll" as const, bottom: 0,
                textStyle: { color: "#a1a1aa", fontSize: 9 }, itemWidth: 8, itemHeight: 8,
            },
            series: [{
                type: "pie" as const, radius: ["40%", "70%"], center: ["50%", "42%"],
                padAngle: 3, itemStyle: { borderRadius: 6 },
                label: { show: false }, emphasis: { scaleSize: 4 }, data,
            }],
            animationType: "scale", animationDuration: 1000,
        };
    }, [filtered]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => { setPage(0); }, [filterULTG, filterGI, filterStatus, filterKondisi, filterVenom, searchQuery]);

    if (loading) {
        return (
            <div className="space-y-4 p-4">
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
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-rose-500" />
                        Anomali Tower Transmisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Assesment Tower Dan Venom — {rawData.length.toLocaleString()} records
                        {hasFilters && ` (menampilkan ${filtered.length.toLocaleString()})`}
                    </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                    <RefreshCw className="h-3 w-3 mr-1" /> Auto-refresh 5 menit
                </Badge>
            </div>

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
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                            <div className="absolute inset-0 opacity-30"
                                style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.glow}, transparent 60%)` }} />
                            <CardContent className="p-3 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xl md:text-2xl font-extrabold leading-none">
                                            {kpi.value}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider" style={{ color: kpi.color }}>
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
                            <Badge variant="secondary" className="ml-auto text-[9px]">{ultgList.length} ULTG</Badge>
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
                                    const sc = STATUS_COLORS[r["STATUS"]?.toUpperCase()];
                                    const venomStatus = (r["VENOM TERPASANG"] || "").toUpperCase();
                                    const isVenomOn = venomStatus.includes("TERPASANG") && !venomStatus.includes("TIDAK");
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground text-[10px]">{r["NO"] || (page * PAGE_SIZE + i + 1)}</TableCell>
                                            <TableCell className="text-[10px]">
                                                <Badge variant="outline" className="text-[8px] px-1 py-0">{r["ULTG"] || "-"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] whitespace-nowrap">{r["GARDU INDUK"] || "-"}</TableCell>
                                            <TableCell className="text-[10px] max-w-[220px] truncate" title={r["PENGHANTAR"]}>{r["PENGHANTAR"] || "-"}</TableCell>
                                            <TableCell className="text-[10px] font-mono font-medium">{r["NO TOWER"] || "-"}</TableCell>
                                            <TableCell className="text-[10px]">
                                                <Badge variant="outline" className="text-[8px] px-1.5 py-0"
                                                    style={{
                                                        borderColor: `${KONDISI_COLORS[(r["KONDISI KRITIS"] || "").toUpperCase()] || C.indigo}50`,
                                                        color: KONDISI_COLORS[(r["KONDISI KRITIS"] || "").toUpperCase()] || C.indigo,
                                                    }}>
                                                    {r["KONDISI KRITIS"] || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-[8px] px-1.5 py-0"
                                                    style={{
                                                        backgroundColor: `${sc?.color || C.indigo}20`,
                                                        color: sc?.color || C.indigo,
                                                        border: `1px solid ${sc?.color || C.indigo}30`,
                                                    }}>
                                                    {sc?.label || r["STATUS"] || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px]">
                                                {isVenomOn ? (
                                                    <Badge className="text-[8px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                        <Wifi className="h-2.5 w-2.5 mr-0.5" /> Terpasang
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-[8px] px-1.5 py-0 bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                                        <WifiOff className="h-2.5 w-2.5 mr-0.5" /> Tidak
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-[10px] text-muted-foreground">{r["TAHUN TEMUAN"] || "-"}</TableCell>
                                            <TableCell className="text-[10px] max-w-[300px]">
                                                <div className="line-clamp-2" title={r["KETERANGAN"]}>{r["KETERANGAN"] || "-"}</div>
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
