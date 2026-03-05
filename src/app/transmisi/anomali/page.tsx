"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
    AlertTriangle, Filter, RefreshCw, MapPin, Search, BarChart3,
    CheckCircle2, Building2, XCircle, ShieldAlert, Eye, ChevronLeft, ChevronRight, Layers,
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

const TINGKAT_COLORS: Record<string, { color: string; label: string }> = {
    MAYOR: { color: C.rose, label: "Mayor" },
    MINOR: { color: C.amber, label: "Minor" },
};

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
    OPEN: { color: C.rose, label: "Open" },
    CLOSE: { color: C.emerald, label: "Close" },
};

interface AnomaliRow {
    no: string;
    ultg: string;
    gi: string;
    penghantar: string;
    bay: string;
    alat: string;
    sid: string;
    petugas: string;
    tanggal: string;
    peralatan: string;
    komponen: string;
    kondisi: string;
    tingkat: string;
    image: string;
    ket: string;
    status: string;
}

export default function AnomaliTowerPage() {
    const [rawData, setRawData] = useState<Record<string, string>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string | null>(null);
    const [filterPenghantar, setFilterPenghantar] = useState<string | null>(null);
    const [filterTingkat, setFilterTingkat] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [filterPeralatan, setFilterPeralatan] = useState<string | null>(null);
    const [searchBay, setSearchBay] = useState("");
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

    // Parse data with forward-fill for grouped columns (ULTG, GI, Penghantar)
    const rows: AnomaliRow[] = useMemo(() => {
        const SKIP_KEYWORDS = /^(total|jumlah|grand|sub\s*total)/i;

        const mapped = rawData
            .map(r => ({
                no: r["# (UPDATE TANGGAL 10 FEB 2026)"] || r["#"] || "",
                ultg: r["ULTG"] || "",
                gi: r["Gardu Induk"] || "",
                penghantar: r["Penghantar"] || "",
                bay: r["Bay"] || "",
                alat: r["Alat"] || "",
                sid: r["SID"] || "",
                petugas: r["Petugas"] || "",
                tanggal: r["Tanggal"] || "",
                peralatan: r["Peralatan"] || "",
                komponen: r["Komponen"] || "",
                kondisi: r["Kondisi"] || "",
                tingkat: (r["Tingkat"] || "").toUpperCase().trim(),
                image: r["Image"] || "",
                ket: r["Ket."] || "",
                status: (r["STATUS"] || "").toUpperCase().trim(),
            }))
            .filter(t => {
                // Must have bay (tower) data
                if (!t.bay) return false;
                // Skip summary/aggregate rows
                if (SKIP_KEYWORDS.test(t.ultg) || SKIP_KEYWORDS.test(t.gi)) return false;
                if (SKIP_KEYWORDS.test(t.no)) return false;
                // Skip rows where GI is purely numeric (summary count)
                if (/^\d+$/.test(t.gi.trim())) return false;
                return true;
            });

        // Forward-fill: carry last non-empty ULTG/GI/Penghantar to empty rows
        let lastULTG = "";
        let lastGI = "";
        let lastPeng = "";
        for (const row of mapped) {
            if (row.ultg) lastULTG = row.ultg; else row.ultg = lastULTG;
            if (row.gi) lastGI = row.gi; else row.gi = lastGI;
            if (row.penghantar) lastPeng = row.penghantar; else row.penghantar = lastPeng;
        }
        return mapped;
    }, [rawData]);

    // Unique lists
    const ultgList = useMemo(() => [...new Set(rows.map(r => r.ultg))].filter(Boolean).sort(), [rows]);
    const giList = useMemo(() => {
        let list = rows;
        if (filterULTG) list = list.filter(r => r.ultg === filterULTG);
        return [...new Set(list.map(r => r.gi))].filter(Boolean).sort();
    }, [rows, filterULTG]);
    const pengList = useMemo(() => {
        let list = rows;
        if (filterULTG) list = list.filter(r => r.ultg === filterULTG);
        if (filterGI) list = list.filter(r => r.gi === filterGI);
        return [...new Set(list.map(r => r.penghantar))].filter(Boolean).sort();
    }, [rows, filterULTG, filterGI]);
    const peralatanList = useMemo(() => [...new Set(rows.map(r => r.peralatan))].filter(Boolean).sort(), [rows]);
    const tingkatList = useMemo(() => [...new Set(rows.map(r => r.tingkat))].filter(Boolean).sort(), [rows]);
    const statusList = useMemo(() => [...new Set(rows.map(r => r.status))].filter(Boolean).sort(), [rows]);

    // Filtered
    const filtered = useMemo(() => {
        let data = rows;
        if (filterULTG) data = data.filter(r => r.ultg === filterULTG);
        if (filterGI) data = data.filter(r => r.gi === filterGI);
        if (filterPenghantar) data = data.filter(r => r.penghantar === filterPenghantar);
        if (filterTingkat) data = data.filter(r => r.tingkat === filterTingkat);
        if (filterStatus) data = data.filter(r => r.status === filterStatus);
        if (filterPeralatan) data = data.filter(r => r.peralatan === filterPeralatan);
        if (searchBay) data = data.filter(r =>
            r.bay.toLowerCase().includes(searchBay.toLowerCase()) ||
            r.komponen.toLowerCase().includes(searchBay.toLowerCase()) ||
            r.kondisi.toLowerCase().includes(searchBay.toLowerCase()));
        return data;
    }, [rows, filterULTG, filterGI, filterPenghantar, filterTingkat, filterStatus, filterPeralatan, searchBay]);

    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterGI(null); setFilterPenghantar(null);
        setFilterTingkat(null); setFilterStatus(null); setFilterPeralatan(null);
        setSearchBay(""); setPage(0);
    }, []);

    const hasFilters = filterULTG || filterGI || filterPenghantar || filterTingkat || filterStatus || filterPeralatan || searchBay;

    // ── KPIs ──
    const totalAnomali = filtered.length;
    const mayorCount = filtered.filter(r => r.tingkat === "MAYOR").length;
    const minorCount = filtered.filter(r => r.tingkat === "MINOR").length;
    const openCount = filtered.filter(r => r.status === "OPEN").length;
    const closeCount = filtered.filter(r => r.status === "CLOSE").length;
    const closeRate = totalAnomali > 0 ? ((closeCount / totalAnomali) * 100).toFixed(1) : "0";

    // ── Charts ──

    // 1. Tingkat donut (Mayor vs Minor)
    const tingkatDonut = useMemo(() => {
        const data = [
            { name: "Mayor", value: mayorCount, itemStyle: { color: C.rose } },
            { name: "Minor", value: minorCount, itemStyle: { color: C.amber } },
        ].filter(d => d.value > 0);
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
                    return `${name}  ${(item?.value || 0).toLocaleString()}  (${pct}%)`;
                },
            },
            graphic: [{
                type: "text" as const, left: "center", top: "36%",
                style: { text: `${total.toLocaleString()}`, fontSize: 24, fontWeight: "bold" as const, fill: "#e4e4e7", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "anomali", fontSize: 11, fill: "#71717a", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["44%", "70%"], center: ["50%", "42%"],
                padAngle: 3, itemStyle: { borderRadius: 6 },
                label: { show: false }, emphasis: { scaleSize: 4 }, data,
            }],
            animationType: "scale", animationDuration: 1000,
        };
    }, [mayorCount, minorCount]);

    // 2. Status donut (Open vs Close)
    const statusDonut = useMemo(() => {
        const data = [
            { name: "Open", value: openCount, itemStyle: { color: C.rose } },
            { name: "Close", value: closeCount, itemStyle: { color: C.emerald } },
        ].filter(d => d.value > 0);
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
                    return `${name}  ${(item?.value || 0).toLocaleString()}  (${pct}%)`;
                },
            },
            graphic: [{
                type: "text" as const, left: "center", top: "36%",
                style: { text: `${closeRate}%`, fontSize: 22, fontWeight: "bold" as const, fill: C.emerald, textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "close rate", fontSize: 11, fill: "#71717a", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["44%", "70%"], center: ["50%", "42%"],
                padAngle: 3, itemStyle: { borderRadius: 6 },
                label: { show: false }, emphasis: { scaleSize: 4 }, data,
            }],
            animationType: "scale", animationDuration: 1000,
        };
    }, [openCount, closeCount, closeRate]);

    // 3. Anomali per Penghantar (horizontal bar)
    const anomaliPerPenghantar = useMemo(() => {
        const pengMap: Record<string, { mayor: number; minor: number }> = {};
        filtered.forEach(r => {
            if (!r.penghantar) return;
            if (!pengMap[r.penghantar]) pengMap[r.penghantar] = { mayor: 0, minor: 0 };
            if (r.tingkat === "MAYOR") pengMap[r.penghantar].mayor++;
            else pengMap[r.penghantar].minor++;
        });
        const sorted = Object.entries(pengMap)
            .map(([peng, v]) => ({ peng, ...v, total: v.mayor + v.minor }))
            .sort((a, b) => b.total - a.total);
        const labels = sorted.map(g => g.peng.replace(/^TRS\s*/i, "").trim());
        return {
            ...echartBase,
            tooltip: {
                trigger: "axis" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", textStyle: { color: "#e4e4e7", fontSize: 11 },
            },
            legend: {
                data: ["Mayor", "Minor"], textStyle: { color: "#a1a1aa", fontSize: 9 },
                bottom: 0, itemWidth: 10, itemHeight: 10,
            },
            grid: { top: 10, right: 50, bottom: 40, left: 220 },
            yAxis: {
                type: "category" as const, data: labels,
                axisLabel: { fontSize: 9, color: "#d4d4d8", width: 210, overflow: "truncate" as const },
                axisLine: { show: false }, axisTick: { show: false }, inverse: true,
            },
            xAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: "#71717a" },
                splitLine: { lineStyle: { color: "#27272a", type: "dashed" as const } },
            },
            series: [
                {
                    name: "Mayor", type: "bar" as const, stack: "total", barWidth: 18,
                    emphasis: { focus: "series" as const },
                    itemStyle: { color: C.rose, borderRadius: 0 },
                    data: sorted.map(g => g.mayor),
                    label: { show: false },
                },
                {
                    name: "Minor", type: "bar" as const, stack: "total", barWidth: 18,
                    emphasis: { focus: "series" as const },
                    itemStyle: { color: C.amber, borderRadius: [0, 4, 4, 0] },
                    data: sorted.map(g => g.minor),
                    label: {
                        show: true, position: "right" as const, fontSize: 10, fontWeight: "bold" as const, color: "#e4e4e7",
                        formatter: (params: { dataIndex: number }) => sorted[params.dataIndex].total.toLocaleString(),
                    },
                },
            ],
            animationDuration: 1000,
        };
    }, [filtered]);

    // 4. Top 10 Komponen Asesmen - from column AK (horizontal bar)
    const kondisiChart = useMemo(() => {
        const kMap: Record<string, number> = {};
        // Use column AK (second KOMPONEN header, index 36) from rawData
        rawData.forEach(r => {
            const val = r["KOMPONEN"] || "";
            if (!val || /^(total|jumlah)/i.test(val)) return;
            // Shorten: take just the component name before the dash
            const short = val.split(" - ")[0].trim();
            if (short) kMap[short] = (kMap[short] || 0) + 1;
        });
        const sorted = Object.entries(kMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        return {
            ...echartBase,
            tooltip: {
                trigger: "axis" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", textStyle: { color: "#e4e4e7", fontSize: 11 },
            },
            grid: { top: 8, right: 50, bottom: 8, left: 160 },
            yAxis: {
                type: "category" as const, data: sorted.map(s => s[0]),
                axisLabel: { fontSize: 9, color: "#d4d4d8", width: 150, overflow: "truncate" as const },
                axisLine: { show: false }, axisTick: { show: false }, inverse: true,
            },
            xAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: "#71717a" },
                splitLine: { lineStyle: { color: "#27272a", type: "dashed" as const } },
            },
            series: [{
                type: "bar" as const, barWidth: 14,
                data: sorted.map((s, i) => ({
                    value: s[1],
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: C.indigo }, { offset: 1, color: C.purple }] },
                        borderRadius: [0, 6, 6, 0],
                    },
                })),
                label: { show: true, position: "right" as const, fontSize: 10, fontWeight: "bold" as const, color: "#e4e4e7" },
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
            }],
            animationDuration: 1200,
        };
    }, [filtered]);

    // 5. Top 10 Komponen (horizontal bar)
    const komponenChart = useMemo(() => {
        const kMap: Record<string, number> = {};
        filtered.forEach(r => {
            if (r.komponen) {
                const short = r.komponen.split(" - ")[0].trim();
                kMap[short] = (kMap[short] || 0) + 1;
            }
        });
        const sorted = Object.entries(kMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        return {
            ...echartBase,
            tooltip: {
                trigger: "axis" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", textStyle: { color: "#e4e4e7", fontSize: 11 },
            },
            grid: { top: 8, right: 50, bottom: 8, left: 180 },
            yAxis: {
                type: "category" as const, data: sorted.map(s => s[0]),
                axisLabel: { fontSize: 8, color: "#d4d4d8", width: 170, overflow: "truncate" as const },
                axisLine: { show: false }, axisTick: { show: false }, inverse: true,
            },
            xAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: "#71717a" },
                splitLine: { lineStyle: { color: "#27272a", type: "dashed" as const } },
            },
            series: [{
                type: "bar" as const, barWidth: 14,
                data: sorted.map(s => ({
                    value: s[1],
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: C.teal }, { offset: 1, color: C.cyan }] },
                        borderRadius: [0, 6, 6, 0],
                    },
                })),
                label: { show: true, position: "right" as const, fontSize: 10, fontWeight: "bold" as const, color: "#e4e4e7" },
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
            }],
            animationDuration: 1200,
        };
    }, [filtered]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => { setPage(0); }, [filterULTG, filterGI, filterPenghantar, filterTingkat, filterStatus, filterPeralatan, searchBay]);

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
                        <ShieldAlert className="h-6 w-6 text-primary" />
                        Anomali Tower Transmisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Data Anomali Tower — {rows.length.toLocaleString()} anomali
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
                    { label: "Total Anomali", value: totalAnomali.toLocaleString(), icon: AlertTriangle, color: C.indigo, glow: "rgba(129,140,248,0.15)" },
                    { label: "Mayor", value: mayorCount.toLocaleString(), icon: XCircle, color: C.rose, glow: "rgba(251,113,133,0.15)" },
                    { label: "Minor", value: minorCount.toLocaleString(), icon: AlertTriangle, color: C.amber, glow: "rgba(251,191,36,0.15)" },
                    { label: "Open", value: openCount.toLocaleString(), icon: Eye, color: C.orange, glow: "rgba(251,146,60,0.15)" },
                    { label: "Close", value: closeCount.toLocaleString(), icon: CheckCircle2, color: C.emerald, glow: "rgba(52,211,153,0.15)" },
                    { label: "Close Rate", value: `${closeRate}%`, icon: BarChart3, color: C.cyan, glow: "rgba(34,211,238,0.15)" },
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

                        <SelectNative value={filterULTG || ""} onChange={e => { setFilterULTG(e.target.value || null); setFilterGI(null); setFilterPenghantar(null); }}>
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>

                        <SelectNative value={filterGI || ""} onChange={e => { setFilterGI(e.target.value || null); setFilterPenghantar(null); }}>
                            <option value="">Semua GI</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>

                        <SelectNative value={filterPenghantar || ""} onChange={e => setFilterPenghantar(e.target.value || null)} className="max-w-[220px]">
                            <option value="">Semua Penghantar</option>
                            {pengList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <SelectNative value={filterPeralatan || ""} onChange={e => setFilterPeralatan(e.target.value || null)}>
                            <option value="">Semua Peralatan</option>
                            {peralatanList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <SelectNative value={filterTingkat || ""} onChange={e => setFilterTingkat(e.target.value || null)}>
                            <option value="">Semua Tingkat</option>
                            {tingkatList.map(t => <option key={t} value={t}>{TINGKAT_COLORS[t]?.label || t}</option>)}
                        </SelectNative>

                        <SelectNative value={filterStatus || ""} onChange={e => setFilterStatus(e.target.value || null)}>
                            <option value="">Semua Status</option>
                            {statusList.map(s => <option key={s} value={s}>{STATUS_COLORS[s]?.label || s}</option>)}
                        </SelectNative>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input type="text" value={searchBay} onChange={e => setSearchBay(e.target.value)}
                                placeholder="Cari bay/komponen..."
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

            {/* ───── Charts Row 1: Tingkat Donut + Status Donut ───── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-primary" /> Tingkat Anomali
                            <Badge variant="secondary" className="ml-auto text-[9px]">Mayor vs Minor</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={tingkatDonut} style={{ height: 280 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" /> Status Penyelesaian
                            <Badge variant="secondary" className="ml-auto text-[9px]">Open vs Close</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={statusDonut} style={{ height: 280 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Charts Row 2: Per Penghantar ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Anomali per Penghantar
                        <Badge variant="secondary" className="ml-auto text-[9px]">{(anomaliPerPenghantar.yAxis as { data?: string[] })?.data?.length || 0} penghantar</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ReactECharts option={anomaliPerPenghantar} style={{ height: Math.max(300, ((anomaliPerPenghantar.yAxis as { data?: string[] })?.data?.length || 0) * 32) }} />
                </CardContent>
            </Card>

            {/* ───── Charts Row 3: Top Kondisi + Top Komponen ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary" /> Top 10 Kondisi Anomali
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={kondisiChart} style={{ height: 320 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> Top 10 Komponen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={komponenChart} style={{ height: 320 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Data Table ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Detail Anomali
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
                                    <TableHead>Bay / Tower</TableHead>
                                    <TableHead>Komponen</TableHead>
                                    <TableHead>Kondisi</TableHead>
                                    <TableHead className="text-center">Tingkat</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => {
                                    const tc = TINGKAT_COLORS[r.tingkat];
                                    const sc = STATUS_COLORS[r.status];
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground text-[10px]">{page * PAGE_SIZE + i + 1}</TableCell>
                                            <TableCell className="text-[10px]">
                                                <Badge variant="outline" className="text-[8px] px-1 py-0">{r.ultg}</Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] whitespace-nowrap">{r.gi}</TableCell>
                                            <TableCell className="text-[10px] min-w-[220px] font-medium">{r.bay}</TableCell>
                                            <TableCell className="text-[10px] max-w-[250px] truncate">{r.komponen}</TableCell>
                                            <TableCell className="text-[10px]">
                                                <Badge variant="outline" className="text-[8px] px-1 py-0">{r.kondisi || "-"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-[8px] px-1.5 py-0"
                                                    style={{
                                                        backgroundColor: `${tc?.color || C.indigo}20`,
                                                        color: tc?.color || C.indigo,
                                                        border: `1px solid ${tc?.color || C.indigo}30`,
                                                    }}>
                                                    {tc?.label || r.tingkat}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-[8px] px-1.5 py-0"
                                                    style={{
                                                        backgroundColor: `${sc?.color || C.indigo}20`,
                                                        color: sc?.color || C.indigo,
                                                        border: `1px solid ${sc?.color || C.indigo}30`,
                                                    }}>
                                                    {sc?.label || r.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">{r.tanggal}</TableCell>
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
