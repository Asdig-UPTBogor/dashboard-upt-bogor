"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
    Filter, RefreshCw, Search, Building2, MapPin,
    ChevronLeft, ChevronRight, Layers, Radio, Activity
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

type AssetRecord = Record<string, string>;

/* ── Brand colors for data series (not theme-dependent) ── */
const C = {
    indigo: "#6366f1", emerald: "#10b981", rose: "#f43f5e",
    amber: "#fbbf24", blue: "#3b82f6", purple: "#a855f7",
    teal: "#14b8a6",
};

export default function AssetTransmisiPage() {
    /* ── Data via SSOT ── */
    const { sheets, loading, error } = usePageData("/transmisi/asset");
    const theme = useChartTheme();

    const sheet = useMemo(() => sheets.find(s => s.sheetName === "0.RESUME JARINGAN"), [sheets]);
    const rawData = useMemo(() => (sheet?.rows || []) as AssetRecord[], [sheet]);
    const headers = useMemo(() => sheet?.headers || [], [sheet]);

    /* ── Filters ── */
    const [searchQuery, setSearchQuery] = useState("");
    const [activeULTG, setActiveULTG] = useState<string | null>(null);
    const [activeOperasiStatus, setActiveOperasiStatus] = useState<string | null>(null);
    const [filterULTG, setFilterULTG] = useState("");
    const [filterGI, setFilterGI] = useState("");
    const [filterPenghantar, setFilterPenghantar] = useState("");

    /* ── Pagination ── */
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    /* ── Unique filter option lists ── */
    const ultgList = useMemo(() => [...new Set(rawData.map(r => r["Master ULTG"]).filter(Boolean))].sort(), [rawData]);
    const giList = useMemo(() => {
        let src = rawData;
        const currentULTG = filterULTG || activeULTG;
        if (currentULTG) src = src.filter(r => r["Master ULTG"] === currentULTG);
        return [...new Set(src.map(r => r["Master Gardu Induk"]).filter(Boolean))].sort();
    }, [rawData, filterULTG, activeULTG]);
    const penghantarList = useMemo(() => {
        let src = rawData;
        const currentULTG = filterULTG || activeULTG;
        if (currentULTG) src = src.filter(r => r["Master ULTG"] === currentULTG);
        if (filterGI) src = src.filter(r => r["Master Gardu Induk"] === filterGI);
        return [...new Set(src.map(r => r["PENGHANTAR"]).filter(Boolean))].sort();
    }, [rawData, filterULTG, activeULTG, filterGI]);

    /* ── Filtered data pipeline ── */
    const filtered = useMemo(() => {
        let result = rawData;
        const currentULTG = filterULTG || activeULTG;
        if (currentULTG) result = result.filter(r => r["Master ULTG"] === currentULTG);
        if (filterGI) result = result.filter(r => r["Master Gardu Induk"] === filterGI);
        if (filterPenghantar) result = result.filter(r => r["PENGHANTAR"] === filterPenghantar);
        if (activeOperasiStatus) {
            result = result.filter(r => {
                const status = (r["OPERASI/TIDAK OPERASI"] || "").trim().toUpperCase();
                return status === activeOperasiStatus.toUpperCase();
            });
        }
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(r =>
                Object.values(r).some(val => val.toLowerCase().includes(lowerQ))
            );
        }
        return result;
    }, [rawData, searchQuery, activeULTG, filterULTG, filterGI, filterPenghantar, activeOperasiStatus]);

    /* ── KPIs ── */
    const totalData = filtered.length;
    const totalULTG = new Set(filtered.map(r => r["Master ULTG"]).filter(Boolean)).size;
    const totalGI = new Set(filtered.map(r => r["Master Gardu Induk"]).filter(Boolean)).size;
    const totalPenghantar = new Set(filtered.map(r => r["PENGHANTAR"]).filter(Boolean)).size;
    let countOperasi = 0;
    let countTidakOperasi = 0;
    filtered.forEach(r => {
        const op = (r["OPERASI/TIDAK OPERASI"] || "").toUpperCase().trim();
        const jml = parseInt(r["JUMLAH TOWER"] || "0", 10) || 0;
        if (op === "OPERASI") countOperasi += jml;
        else if (op === "TIDAK OPERASI") countTidakOperasi += jml;
    });

    /* ── Bar Chart (Penghantar per ULTG) — theme-aware ── */
    const ultgCounts = useMemo(() => {
        const seenPenghantar = new Set<string>();
        const counts: Record<string, number> = {};
        filtered.forEach(r => {
            const u = r["Master ULTG"];
            const p = r["PENGHANTAR"];
            if (u && p) {
                if (!seenPenghantar.has(p)) {
                    seenPenghantar.add(p);
                    counts[u] = (counts[u] || 0) + 1;
                }
            }
        });
        return counts;
    }, [filtered]);

    const barChartOption = useMemo(() => {
        const sorted = Object.entries(ultgCounts).sort((a, b) => b[1] - a[1]);
        const keys = sorted.map(x => x[0]);
        const vals = sorted.map(x => ({
            value: x[1],
            name: x[0],
            itemStyle: { opacity: (activeULTG && activeULTG !== x[0]) ? 0.3 : 1 }
        }));
        return {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                backgroundColor: theme.tooltipBg,
                textStyle: { color: theme.tooltipText },
                borderWidth: 0,
            },
            grid: { top: 30, right: 30, bottom: 30, left: 40 },
            xAxis: {
                type: "category",
                data: keys,
                axisLabel: { color: theme.textMuted, fontSize: 10, interval: 0, rotate: keys.length > 5 ? 30 : 0 }
            },
            yAxis: {
                type: "value",
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" } },
                axisLabel: { color: theme.textMuted }
            },
            series: [{
                data: vals,
                type: "bar",
                barWidth: "40%",
                itemStyle: { color: C.indigo, borderRadius: [4, 4, 0, 0] },
                label: { show: true, position: "top", color: theme.text, fontSize: 10 }
            }]
        };
    }, [ultgCounts, activeULTG, theme]);

    /* ── Pie Chart (Operasi status) — theme-aware ── */
    const operasiChartOption = useMemo(() => ({
        backgroundColor: "transparent",
        tooltip: {
            trigger: "item",
            formatter: "{b}: {c} Tower ({d}%)",
            backgroundColor: theme.tooltipBg,
            textStyle: { color: theme.tooltipText },
            borderWidth: 0,
        },
        legend: { top: "bottom", textStyle: { color: theme.textMuted, fontSize: 10 } },
        series: [{
            name: "Status Operasi",
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 10, borderColor: theme.surface, borderWidth: 2 },
            label: { show: true, formatter: "{b}\n{c} Tower ({d}%)", color: theme.text, fontSize: 10 },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold", color: theme.emphasisText } },
            labelLine: { show: true, length: 10, length2: 10, lineStyle: { color: theme.gridLine } },
            data: [
                {
                    value: countOperasi,
                    name: "OPERASI",
                    itemStyle: { color: C.emerald, opacity: (activeOperasiStatus === "TIDAK OPERASI") ? 0.3 : 1 }
                },
                {
                    value: countTidakOperasi,
                    name: "TIDAK OPERASI",
                    itemStyle: { color: C.rose, opacity: (activeOperasiStatus === "OPERASI") ? 0.3 : 1 }
                }
            ]
        }]
    }), [countOperasi, countTidakOperasi, activeOperasiStatus, theme]);

    /* ── Pagination ── */
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    useEffect(() => { setPage(0); }, [searchQuery, activeULTG, activeOperasiStatus, filterULTG, filterGI, filterPenghantar]);

    /* ── Visible headers (filter dupes & hide KETERANGAN) ── */
    const visibleHeaders = useMemo(() => {
        let hasNoCol = false;
        return headers.filter(h => {
            const upperH = (h || "").toUpperCase();
            if (upperH === "NO" || upperH === "NO.") {
                if (hasNoCol) return false;
                hasNoCol = true;
                return true;
            }
            if (upperH === "KETERANGAN") return false;
            return true;
        });
    }, [headers]);

    const hasFilters = activeULTG || activeOperasiStatus || filterULTG || filterGI || filterPenghantar || searchQuery;
    const clearFilters = () => {
        setActiveULTG(null);
        setActiveOperasiStatus(null);
        setFilterULTG("");
        setFilterGI("");
        setFilterPenghantar("");
        setSearchQuery("");
    };

    /* ── Loading skeleton ── */
    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl bg-muted/50" />
                <div className="grid grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-muted/50" />)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-[300px] rounded-xl bg-muted/50" />
                    <Skeleton className="h-[300px] rounded-xl bg-muted/50" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-xl bg-muted/50" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 flex flex-col items-center justify-center h-64 text-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <Activity className="h-6 w-6 text-destructive" />
                </div>
                <p className="font-semibold text-destructive">{error}</p>
                <Button variant="outline" className="mt-4 text-xs" onClick={() => window.location.reload()}>Coba Lagi</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ───── Title + DataFreshness ───── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-indigo-400 flex items-center gap-2">
                        <Layers className="h-6 w-6 text-blue-500" />
                        Asset Transmisi (Resume Jaringan)
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Resume Jaringan — {rawData.length.toLocaleString()} records
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

            {/* ───── Filters Dropdown ───── */}
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

                        <SelectNative value={filterGI} onChange={e => { setFilterGI(e.target.value); setFilterPenghantar(""); }} className="w-52 text-xs">
                            <option value="">Semua Gardu Induk</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>

                        <SelectNative value={filterPenghantar} onChange={e => setFilterPenghantar(e.target.value)} className="w-52 text-xs">
                            <option value="">Semua Penghantar</option>
                            {penghantarList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari tower, penghantar, dll..." className="pl-9 h-8 text-xs" />
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
                    {activeOperasiStatus && <Badge variant="secondary" className="text-xs font-mono">{activeOperasiStatus}</Badge>}
                    {searchQuery && <Badge variant="secondary" className="text-xs">Search: &quot;{searchQuery}&quot;</Badge>}
                </div>
            )}

            {/* ───── KPI Cards ───── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: "Jumlah Data", value: totalData, icon: Layers, color: C.indigo },
                    { label: "Jumlah ULTG", value: totalULTG, icon: Building2, color: C.teal },
                    { label: "Jumlah GI", value: totalGI, icon: MapPin, color: C.amber },
                    { label: "Penghantar", value: totalPenghantar, icon: Radio, color: C.purple },
                    { label: "Operasi", value: countOperasi, icon: Activity, color: C.emerald },
                ].map(kpi => (
                    <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
                        <div className="absolute inset-0 opacity-20"
                            style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.color}, transparent 60%)` }} />
                        <CardContent className="p-4 relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold leading-none">{kpi.value.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider" style={{ color: kpi.color }}>
                                    {kpi.label}
                                </p>
                            </div>
                            <div className="h-10 w-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${kpi.color}20` }}>
                                <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ───── Charts ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-8">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Total Penghantar per ULTG
                            <Badge variant="secondary" className="ml-auto text-xs cursor-pointer">Klik bar untuk filter</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts
                            option={barChartOption}
                            style={{ height: 300 }}
                            onEvents={{ click: (params: { name?: string }) => setActiveULTG(prev => prev === params.name ? null : params.name!) }}
                        />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Status Operasi
                            <Badge variant="secondary" className="ml-auto text-xs cursor-pointer">Klik slice untuk filter</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts
                            option={operasiChartOption}
                            style={{ height: 300 }}
                            onEvents={{ click: (params: { name?: string }) => setActiveOperasiStatus(prev => prev === params.name ? null : params.name!) }}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Data Table ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" /> Data Resume Jaringan
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {filtered.length.toLocaleString()} data — Halaman {page + 1}/{totalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="overflow-x-auto rounded-md border mt-3">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead rowSpan={2} className="whitespace-nowrap text-xs font-semibold py-2 text-center border-r">NO</TableHead>
                                    <TableHead rowSpan={2} className="whitespace-nowrap text-xs font-semibold py-2 text-center border-r">ULTG</TableHead>
                                    <TableHead rowSpan={2} className="whitespace-nowrap text-xs font-semibold py-2 text-center border-r">GARDU INDUK</TableHead>
                                    <TableHead rowSpan={2} className="whitespace-nowrap text-xs font-semibold py-2 text-center border-r">PENGHANTAR</TableHead>
                                    <TableHead rowSpan={2} className="whitespace-nowrap text-xs font-semibold py-2 text-center border-r">NO TOWER</TableHead>
                                    <TableHead rowSpan={2} className="whitespace-nowrap text-xs font-semibold py-2 text-center border-r">STATUS OPERASI</TableHead>
                                    <TableHead rowSpan={2} className="whitespace-nowrap text-xs font-semibold py-2 text-center border-r">JML TOWER</TableHead>
                                    <TableHead colSpan={3} className="whitespace-nowrap text-xs font-bold py-2 text-center border-b border-r bg-muted/70">KONDUKTOR</TableHead>
                                    <TableHead colSpan={3} className="whitespace-nowrap text-xs font-bold py-2 text-center border-b border-r bg-muted/70">EARTHWIRE</TableHead>
                                    <TableHead colSpan={3} className="whitespace-nowrap text-xs font-bold py-2 text-center border-b bg-muted/70">ISOLATOR</TableHead>
                                </TableRow>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    {["Usia", "Operasi", "Jenis", "Usia", "Operasi", "Jenis", "Usia", "Operasi", "Jenis"].map((h, i) => (
                                        <TableHead key={i} className="whitespace-nowrap text-xs font-semibold py-1 text-center border-r last:border-r-0">{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => {
                                    const c = (key: string, isLast = false) => {
                                        const val = r[key] || "-";
                                        return (
                                            <TableCell key={key} className={`text-xs py-2 whitespace-nowrap text-center ${!isLast ? 'border-r' : ''}`} title={val.length > 30 ? val : undefined}>
                                                {val.length > 40 ? val.substring(0, 40) + "..." : val}
                                            </TableCell>
                                        );
                                    };
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="text-xs py-2 whitespace-nowrap text-center border-r">{page * PAGE_SIZE + i + 1}</TableCell>
                                            {c("Master ULTG")}
                                            {c("Master Gardu Induk")}
                                            {c("PENGHANTAR")}
                                            {c("NO TOWER")}
                                            {c("OPERASI/TIDAK OPERASI")}
                                            {c("JUMLAH TOWER")}
                                            {c("USIA KONDUKTOR")}
                                            {c("OPERASI KONDUKTOR")}
                                            {c("JENIS KONDUKTOR")}
                                            {c("USIA EARTWIRE")}
                                            {c("OPERASI EARTWIRE")}
                                            {c("JENIS EARTHWIRE")}
                                            {c("USIA ISOLATOR")}
                                            {c("OPERASI ISOLATOR")}
                                            {c("JENIS ISOLATOR", true)}
                                        </TableRow>
                                    );
                                })}
                                {paginatedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={15} className="h-32 text-center text-muted-foreground">
                                            Tidak ada data untuk filter yang dipilih.
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
                                <ChevronLeft className="h-3.5 w-3.5" /> Previous
                            </Button>
                            <div className="flex gap-1 overflow-x-auto max-w-[200px] md:max-w-md no-scrollbar">
                                {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
                                    let p: number;
                                    if (totalPages <= 7) p = idx;
                                    else if (page < 4) p = idx;
                                    else if (page > totalPages - 4) p = totalPages - 7 + idx;
                                    else p = page - 3 + idx;
                                    return (
                                        <Button key={p} variant={page === p ? "default" : "outline"} size="sm"
                                            onClick={() => setPage(p)} className="w-8 h-8 text-xs p-0 flex-shrink-0">
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
