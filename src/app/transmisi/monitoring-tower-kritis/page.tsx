"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import {
    AlertTriangle, Filter, RefreshCw, MapPin, Search,
    Building2, ChevronLeft, ChevronRight, Layers,
    Radio, Wifi, WifiOff, Eye, Zap, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DataFreshness } from "@/components/DataFreshness";
import { usePageData } from "@/hooks/usePageData";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ── Chart Palette ── */
const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
    red: "#ef4444", green: "#22c55e", yellow: "#eab308",
};

const echartBase = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, sans-serif", color: "#d4d4d8" },
};

/* ── Column constants (exact match with actual sheet headers) ── */
const COL = {
    ULTG: "Master ULTG",
    GI: "Master Gardu Induk",
    PENGHANTAR: "PENGHANTAR",
    NO_TOWER: "NO TOWER",
    ONLINE_OFFLINE: "ONLINE/OFFLINE",
    ID: "ID",
    LINK_VENOM: "LINK VENOM",
    KETERANGAN: "KETERANGAN",
    STATUS: "STATUS",
    KONDISI_KRITIS: "KONDISI KRITIS",
    TAHUN_TEMUAN: "TAHUN TEMUAN",
    NO_HP: "NO HP",
    VENOM_TERPASANG: "VENOM TERPASANG",
    DATA_PENGHANTAR: "DATA PENGHANTAR",
} as const;

type Row = Record<string, string>;

export default function MonitoringTowerKritisPage() {
    /* ── Data: SSOT via usePageData ── */
    const { sheets, loading } = usePageData("/transmisi/monitoring-tower-kritis");
    const rawData: Row[] = sheets[0]?.rows ?? [];
    const headers: string[] = sheets[0]?.headers ?? [];

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [activeULTG, setActiveULTG] = useState<string | null>(null);
    const [filterULTG, setFilterULTG] = useState("");
    const [filterGI, setFilterGI] = useState("");
    const [filterPenghantar, setFilterPenghantar] = useState("");
    const [filterVenom, setFilterVenom] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [venomPage, setVenomPage] = useState(0);
    const PAGE_SIZE = 30;

    // Unique lists for Dropdowns
    const ultgList = useMemo(() => [...new Set(rawData.map(r => r[COL.ULTG] || "").filter(Boolean))].sort(), [rawData]);
    const giList = useMemo(() => {
        let src = rawData;
        if (filterULTG || activeULTG) {
            const u = filterULTG || activeULTG;
            src = src.filter(r => r[COL.ULTG] === u);
        }
        return [...new Set(src.map(r => r[COL.GI] || "").filter(Boolean))].sort();
    }, [rawData, filterULTG, activeULTG]);

    const penghantarList = useMemo(() => {
        let src = rawData;
        if (filterULTG || activeULTG) {
            const u = filterULTG || activeULTG;
            src = src.filter(r => r[COL.ULTG] === u);
        }
        if (filterGI) src = src.filter(r => r[COL.GI] === filterGI);
        return [...new Set(src.map(r => r[COL.PENGHANTAR]).filter(Boolean))].sort();
    }, [rawData, filterULTG, activeULTG, filterGI]);

    // Filtered Data
    const filtered = useMemo(() => {
        let result = rawData;

        const currentULTG = filterULTG || activeULTG;
        if (currentULTG) result = result.filter(r => r[COL.ULTG] === currentULTG);
        if (filterGI) result = result.filter(r => r[COL.GI] === filterGI);
        if (filterPenghantar) result = result.filter(r => r[COL.PENGHANTAR] === filterPenghantar);
        if (filterVenom === "Terpasang") result = result.filter(r => (r[COL.ONLINE_OFFLINE] || "").toUpperCase().includes("ONLINE"));
        if (filterVenom === "Tidak terpasang") result = result.filter(r => !(r[COL.ONLINE_OFFLINE] || "").toUpperCase().includes("ONLINE"));

        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(r =>
                Object.values(r).some(val => val?.toLowerCase().includes(lowerQ))
            );
        }
        return result;
    }, [rawData, searchQuery, activeULTG, filterULTG, filterGI, filterPenghantar, filterVenom]);

    // ── KPIs ──
    const totalData = filtered.length;
    const totalULTG = useMemo(() => new Set(filtered.map(r => r[COL.ULTG]).filter(Boolean)).size, [filtered]);
    const totalGI = useMemo(() => new Set(filtered.map(r => r[COL.GI]).filter(Boolean)).size, [filtered]);
    const totalPenghantar = useMemo(() => new Set(filtered.map(r => r[COL.PENGHANTAR]).filter(Boolean)).size, [filtered]);
    const venomTerpasang = filtered.filter(r => (r[COL.ONLINE_OFFLINE] || "").toUpperCase().includes("ONLINE")).length;
    const venomOnline = filtered.filter(r => (r[COL.ONLINE_OFFLINE] || "").toUpperCase().includes("ONLINE")).length;

    // ── Donut Chart: Tower per ULTG (cross-filter) ──
    const ultgDonutColors = [C.indigo, C.teal, C.amber, C.purple, C.pink, C.emerald, C.rose, C.blue, C.cyan, C.orange];
    const ultgDonutOption = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const u = r[COL.ULTG] || "N/A"; counts[u] = (counts[u] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const total = sorted.reduce((s, [, v]) => s + v, 0);
        const data = sorted.map(([name, value], i) => ({
            name, value,
            itemStyle: {
                color: ultgDonutColors[i % ultgDonutColors.length],
                opacity: activeULTG && activeULTG !== name ? 0.25 : 1,
                shadowBlur: activeULTG === name ? 12 : 0,
                shadowColor: activeULTG === name ? ultgDonutColors[i % ultgDonutColors.length] : "transparent",
            },
        }));
        return {
            ...echartBase,
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", borderWidth: 1,
                textStyle: { color: "#d4d4d8", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Tower: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "36%",
                style: { text: `${total}`, fontSize: 30, fontWeight: "bold" as const, fill: "#d4d4d8", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "50%",
                style: { text: activeULTG || "total tower", fontSize: 11, fill: activeULTG ? "#818cf8" : "#a1a1aa", textAlign: "center" as const },
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
                labelLine: {
                    show: true, length: 15, length2: 12,
                    smooth: 0.3,
                    lineStyle: { color: "#a1a1aa", width: 1.5 },
                },
                emphasis: {
                    scaleSize: 6,
                    label: { fontSize: 12 },
                },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [filtered, activeULTG]);

    // ── Donut Chart: Status Venom (cross-filter) ──
    const venomDonutOption = useMemo(() => {
        const counts: Record<string, number> = { "Terpasang": 0, "Tidak terpasang": 0 };
        filtered.forEach(r => {
            const status = (r[COL.ONLINE_OFFLINE] || "").toUpperCase();
            if (status.includes("ONLINE")) counts["Terpasang"]++;
            else counts["Tidak terpasang"]++;
        });
        const colorMap: Record<string, string> = { "Terpasang": C.emerald, "Tidak terpasang": C.rose };
        const data = Object.entries(counts).map(([name, value]) => ({
            name, value,
            itemStyle: {
                color: colorMap[name],
                opacity: filterVenom && filterVenom !== name ? 0.25 : 1,
                shadowBlur: filterVenom === name ? 12 : 0,
                shadowColor: filterVenom === name ? colorMap[name] : "transparent",
            },
        }));
        const total = data.reduce((s, d) => s + d.value, 0);
        return {
            ...echartBase,
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", borderWidth: 1,
                textStyle: { color: "#d4d4d8", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Tower: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "36%",
                style: { text: `${total}`, fontSize: 30, fontWeight: "bold" as const, fill: "#d4d4d8", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "50%",
                style: { text: filterVenom || "total tower", fontSize: 11, fill: filterVenom ? "#34d399" : "#a1a1aa", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "45%"],
                padAngle: 3, itemStyle: { borderRadius: 6 },
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
                labelLine: {
                    show: true, length: 15, length2: 12,
                    smooth: 0.3,
                    lineStyle: { color: "#a1a1aa", width: 1.5 },
                },
                emphasis: {
                    scaleSize: 6,
                    label: { fontSize: 12 },
                },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [filtered, filterVenom]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Venom Specific Data and Pagination
    const venomData = useMemo(() => {
        return filtered.filter(r => (r[COL.ONLINE_OFFLINE] || "").toUpperCase().includes("ONLINE"));
    }, [filtered]);
    const venomTotalPages = Math.ceil(venomData.length / PAGE_SIZE);
    const paginatedVenomData = venomData.slice(venomPage * PAGE_SIZE, (venomPage + 1) * PAGE_SIZE);

    useEffect(() => {
        setPage(0);
        setVenomPage(0);
    }, [searchQuery, activeULTG, filterULTG, filterGI, filterPenghantar]);

    // Table Columns Configuration
    // - Exclude legacy "ULTG" and "GARDU INDUK" (will be deleted from sheet)
    // - Rename "Master ULTG" → "ULTG" and "Master Gardu Induk" → "GARDU INDUK" for display
    // - Reorder: put ULTG and GI columns after NO (position 2-3)
    const HEADER_DISPLAY: Record<string, string> = {
        "Master ULTG": "ULTG",
        "Master Gardu Induk": "GARDU INDUK",
    };
    const EXCLUDE_COLS = ["ULTG", "GARDU INDUK"];
    const PRIORITY_COLS = ["Master ULTG", "Master Gardu Induk"];

    const visibleHeaders = useMemo(() => {
        const excludeUpper = EXCLUDE_COLS.map(c => c.toUpperCase());
        let hasNoCol = false;

        // Filter out excluded and duplicate NO columns
        const filtered = headers.filter(h => {
            const upperH = (h || "").toUpperCase();
            if (excludeUpper.includes(upperH)) return false;
            if (upperH === "NO" || upperH === "NO.") {
                if (hasNoCol) return false;
                hasNoCol = true;
                return true;
            }
            return true;
        });

        // Reorder: NO first, then priority cols (ULTG, GI), then rest
        const priority = PRIORITY_COLS.filter(c => filtered.includes(c));
        const rest = filtered.filter(c => !PRIORITY_COLS.includes(c) && c.toUpperCase() !== "NO" && c.toUpperCase() !== "NO.");
        const noCol = filtered.find(c => c.toUpperCase() === "NO" || c.toUpperCase() === "NO.");
        return [...(noCol ? [noCol] : []), ...priority, ...rest];
    }, [headers]);

    const hasFilters = activeULTG || filterULTG || filterGI || filterPenghantar || filterVenom || searchQuery;
    const clearFilters = () => {
        setActiveULTG(null);
        setFilterULTG("");
        setFilterGI("");
        setFilterPenghantar("");
        setFilterVenom(null);
        setSearchQuery("");
    };

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-80" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-rose-500" />
                        Monitoring Tower Kritis
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Assesment Tower Dan Venom — {rawData.length.toLocaleString()} records
                        {searchQuery && ` (menampilkan ${filtered.length.toLocaleString()})`}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Reset Filter
                        </button>
                    )}
                    <DataFreshness />
                </div>
            </div>

            {/* Filters UI */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />

                        <SelectNative
                            value={filterULTG || activeULTG || ""}
                            onChange={e => { setFilterULTG(e.target.value); setActiveULTG(null); setFilterGI(""); setFilterPenghantar(""); }}
                            className="w-40 text-xs"
                        >
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>

                        <SelectNative
                            value={filterGI}
                            onChange={e => { setFilterGI(e.target.value); setFilterPenghantar(""); }}
                            className="w-52 text-xs"
                        >
                            <option value="">Semua Gardu Induk</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>

                        <SelectNative
                            value={filterPenghantar}
                            onChange={e => setFilterPenghantar(e.target.value)}
                            className="w-52 text-xs"
                        >
                            <option value="">Semua Penghantar</option>
                            {penghantarList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari tower, penghantar, keterangan..."
                                className="pl-9 h-8 text-xs" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Active filters badge */}
            {hasFilters && (
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-xs text-muted-foreground">Filter aktif:</span>
                    {(filterULTG || activeULTG) && <Badge variant="secondary" className="text-xs">ULTG: {filterULTG || activeULTG}</Badge>}
                    {filterGI && <Badge variant="secondary" className="text-xs">GI: {filterGI}</Badge>}
                    {filterPenghantar && <Badge variant="secondary" className="text-xs">Penghantar: {filterPenghantar}</Badge>}
                    {filterVenom && <Badge variant="secondary" className="text-xs">Venom: {filterVenom}</Badge>}
                    {searchQuery && <Badge variant="secondary" className="text-xs">Search: &quot;{searchQuery}&quot;</Badge>}
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
                                        <p className="text-xl md:text-2xl font-extrabold leading-none">{kpi.value}</p>
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

            {/* ───── Charts: Donut (ULTG) + Donut (Venom) — cross-filter ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Jumlah Tower per ULTG
                            <Badge variant="secondary" className="ml-auto text-xs cursor-pointer">
                                {activeULTG ? `Filter: ${activeULTG} — klik lagi untuk reset` : "Klik segment untuk filter"}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts
                            option={ultgDonutOption}
                            style={{ height: 320 }}
                            onEvents={{ click: (params: { name?: string }) => setActiveULTG(prev => prev === params.name ? null : params.name!) }}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-primary" /> Status Venom Terpasang
                            <Badge variant="secondary" className="ml-auto text-xs cursor-pointer">
                                {filterVenom ? `Filter: ${filterVenom} — klik lagi untuk reset` : "Klik segment untuk filter"}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts
                            option={venomDonutOption}
                            style={{ height: 320 }}
                            onEvents={{ click: (params: { name?: string }) => setFilterVenom(prev => prev === params.name ? null : params.name!) }}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Table - Venom Terpasang (ONLINE only) ───── */}
            <Card>
                <CardHeader className="pb-2 border-b">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" /> Detail Venom Terpasang
                        <Badge variant="secondary" className="ml-auto text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                            {venomData.length.toLocaleString()} unit ONLINE — Halaman {venomPage + 1}/{venomTotalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px] whitespace-nowrap">No</TableHead>
                                    <TableHead className="whitespace-nowrap text-xs">ID VENOM</TableHead>
                                    <TableHead className="whitespace-nowrap text-xs">ULTG</TableHead>
                                    <TableHead className="whitespace-nowrap text-xs">GARDU INDUK</TableHead>
                                    <TableHead className="whitespace-nowrap text-xs">PENGHANTAR</TableHead>
                                    <TableHead className="whitespace-nowrap text-xs">NO TOWER</TableHead>
                                    <TableHead className="whitespace-nowrap text-xs">LINK VENOM</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedVenomData.map((r, i) => (
                                    <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{venomPage * PAGE_SIZE + i + 1}</TableCell>
                                        <TableCell className="text-xs font-mono font-medium text-emerald-400">{r[COL.ID] || "-"}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{r[COL.ULTG] || "-"}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{r[COL.GI] || "-"}</TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate" title={r[COL.PENGHANTAR]}>{r[COL.PENGHANTAR] || "-"}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{r[COL.NO_TOWER] || "-"}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">
                                            {r[COL.LINK_VENOM] ? (
                                                <a href={r[COL.LINK_VENOM]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline">
                                                    Buka Link <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {paginatedVenomData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            Tidak ada Venom yang statusnya ONLINE.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {venomTotalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setVenomPage(Math.max(0, venomPage - 1))} disabled={venomPage === 0}
                                className="h-8 text-xs gap-1">
                                <ChevronLeft className="h-3.5 w-3.5" /> Prev
                            </Button>
                            <div className="flex gap-1">
                                {Array.from({ length: Math.min(5, venomTotalPages) }, (_, idx) => {
                                    let p: number;
                                    if (venomTotalPages <= 5) p = idx;
                                    else if (venomPage < 3) p = idx;
                                    else if (venomPage > venomTotalPages - 4) p = venomTotalPages - 5 + idx;
                                    else p = venomPage - 2 + idx;
                                    return (
                                        <Button key={p} variant={venomPage === p ? "default" : "outline"} size="sm"
                                            onClick={() => setVenomPage(p)} className="w-8 h-8 text-xs p-0">
                                            {p + 1}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setVenomPage(Math.min(venomTotalPages - 1, venomPage + 1))} disabled={venomPage >= venomTotalPages - 1}
                                className="h-8 text-xs gap-1">
                                Next <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ───── Data Table (Dynamic Columns) ───── */}
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
                                    <TableHead className="w-[40px] whitespace-nowrap">No</TableHead>
                                    {visibleHeaders.map((h, i) => {
                                        if (h.toUpperCase() === "NO" || h.toUpperCase() === "NO.") return null;
                                        return <TableHead key={i} className="whitespace-nowrap text-xs">{HEADER_DISPLAY[h] || h || `Col ${i + 1}`}</TableHead>;
                                    })}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => (
                                    <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{page * PAGE_SIZE + i + 1}</TableCell>
                                        {visibleHeaders.map((h, j) => {
                                            if (h.toUpperCase() === "NO" || h.toUpperCase() === "NO.") return null;
                                            return (
                                                <TableCell key={j} className="text-xs max-w-[250px] truncate whitespace-nowrap" title={r[h]}>
                                                    {r[h] || "-"}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                                {paginatedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={visibleHeaders.length} className="h-24 text-center">
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
