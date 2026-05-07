"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import {
    Zap, Filter, RefreshCw, MapPin, Shield, Search, BarChart3,
    CheckCircle2, Building2, TrendingUp, ChevronLeft, ChevronRight,
    Calculator, Crosshair
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
    red: "#ef4444", green: "#22c55e", yellow: "#eab308", lime: "#a3e635",
    sky: "#38bdf8", violet: "#8b5cf6",
};

/* echartBase removed — colors now come from useChartTheme() */

const PROTEKSI_COLS = [
    { key: "TLA", label: "TLA", color: C.blue, icon: "⚡" },
    { key: "MRG LAMA", label: "MRG Lama", color: C.amber, icon: "🔶" },
    { key: "MRG BARU", label: "MRG Baru", color: C.emerald, icon: "🟢" },
    { key: "MDG", label: "MDG", color: C.purple, icon: "🟣" },
    { key: "MDG + KOPEL MRG", label: "MDG+Kopel", color: C.cyan, icon: "🔗" },
    { key: "DIRECT GROUNDING", label: "Direct GND", color: C.orange, icon: "⏚" },
    { key: "KOPEL ANTAR LEG", label: "Kopel Leg", color: C.pink, icon: "🔄" },
    { key: "PSPT", label: "PSPT", color: C.teal, icon: "🛡️" },
    { key: "COUNTERPOISE", label: "Counterpoise", color: C.violet, icon: "📐" },
    { key: "MESH", label: "Mesh", color: C.lime, icon: "🕸️" },
];

interface TowerPetir {
    ultg: string;
    gi: string;
    penghantar: string;
    namaTower: string;
    type: string;
    isolator: string;
    sirkit: string;
    proteksi: Record<string, string>;
    proteksiList: string[];
    totalProteksi: number;
}

export default function PetirPage() {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/transmisi/petir");
    const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);

    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterPenghantar, setFilterPenghantar] = useState<string | null>(null);
    const [filterProteksi, setFilterProteksi] = useState<string | null>(null);
    const [searchTower, setSearchTower] = useState("");
    const [showOnlyInstalled, setShowOnlyInstalled] = useState(false);
    const [page, setPage] = useState(0);
    const [activeTab, setActiveTab] = useState<"proteksi" | "fl" | "detail">("fl");
    
    // Mock state for Fault Locator UI
    const [flPenghantar, setFlPenghantar] = useState<string>("TRS 500kV CILEGON-CIBINONG");
    const [flDistA, setFlDistA] = useState<string>("10");
    const [flDistB, setFlDistB] = useState<string>("5");

    const PAGE_SIZE = 25;

    const towers: TowerPetir[] = useMemo(() =>
        rawData.map(r => {
            const proteksi: Record<string, string> = {};
            const proteksiList: string[] = [];
            PROTEKSI_COLS.forEach(col => {
                const val = (r[col.key] || "").trim();
                if (val && val !== "-" && val !== "0") {
                    proteksi[col.key] = val;
                    proteksiList.push(col.key);
                }
            });
            return {
                ultg: r["ULTG"] || r["Master ULTG"] || "",
                gi: r["GARDU INDUK"] || r["Master Gardu Induk"] || "",
                penghantar: r["PENGHANTAR"] || "",
                namaTower: r["NAMA TOWER"] || "",
                type: r["TYPE"] || "",
                isolator: r["ISOLATOR"] || "",
                sirkit: r["SIRKIT"] || "",
                proteksi,
                proteksiList,
                totalProteksi: proteksiList.length,
            };
        }).filter(t => 
            String(t.namaTower).trim().length > 0 || 
            String(t.penghantar).trim().length > 0 || 
            String(t.gi).trim().length > 0
        ),
        [rawData]);

    const ultgList = useMemo(() => [...new Set(towers.map(t => t.ultg))].filter(Boolean).sort(), [towers]);
    const pengList = useMemo(() => {
        let list = towers;
        if (filterULTG) list = list.filter(t => t.ultg === filterULTG);
        return [...new Set(list.map(t => t.penghantar))].filter(Boolean).sort();
    }, [towers, filterULTG]);

    const filtered = useMemo(() => {
        let data = towers;
        if (filterULTG) data = data.filter(t => t.ultg === filterULTG);
        if (filterPenghantar) data = data.filter(t => t.penghantar === filterPenghantar);
        if (filterProteksi) data = data.filter(t => t.proteksiList.includes(filterProteksi));
        if (showOnlyInstalled) data = data.filter(t => t.totalProteksi > 0);
        if (searchTower) data = data.filter(t =>
            t.namaTower.toLowerCase().includes(searchTower.toLowerCase()));
        return data;
    }, [towers, filterULTG, filterPenghantar, filterProteksi, showOnlyInstalled, searchTower]);

    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterPenghantar(null);
        setFilterProteksi(null); setSearchTower("");
        setShowOnlyInstalled(false); setPage(0);
    }, []);

    const hasFilters = filterULTG || filterPenghantar || filterProteksi || searchTower || showOnlyInstalled;

    // KPIs
    const totalTower = filtered.length;
    const towersWithProteksi = filtered.filter(t => t.totalProteksi > 0).length;
    const towersWithoutProteksi = filtered.filter(t => t.totalProteksi === 0).length;
    const coveragePercent = totalTower > 0 ? Math.round((towersWithProteksi / totalTower) * 100) : 0;

    const proteksiCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        PROTEKSI_COLS.forEach(c => { counts[c.key] = 0; });
        filtered.forEach(t => {
            t.proteksiList.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
        });
        return counts;
    }, [filtered]);

    const totalInstalled = Object.values(proteksiCounts).reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...Object.values(proteksiCounts), 1);

    // ────── Charts ──────

    // 1. Gauge chart for coverage
    const gaugeOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        series: [{
            type: "gauge" as const,
            startAngle: 200,
            endAngle: -20,
            min: 0,
            max: 100,
            radius: "90%",
            progress: {
                show: true,
                width: 18,
                itemStyle: {
                    color: {
                        type: "linear" as const,
                        x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: [
                            { offset: 0, color: coveragePercent >= 70 ? "#059669" : "#d97706" },
                            { offset: 1, color: coveragePercent >= 70 ? C.emerald : C.amber },
                        ],
                    },
                },
            },
            axisLine: { lineStyle: { width: 18, color: [[1, "rgba(255,255,255,0.05)"]] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            anchor: { show: false },
            title: { show: false },
            detail: {
                valueAnimation: true,
                fontSize: 32,
                fontWeight: "bold" as const,
                color: theme.text,
                offsetCenter: [0, "0%"],
                formatter: "{value}%",
            },
            data: [{ value: coveragePercent }],
        }],
    }), [coveragePercent, theme]);

    // 2. Radar chart for proteksi composition
    const radarOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "item" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText },
        },
        radar: {
            indicator: PROTEKSI_COLS.map(c => ({
                name: c.label,
                max: maxCount,
            })),
            shape: "polygon" as const,
            splitNumber: 4,
            axisName: { color: theme.textMuted, fontSize: 9 },
            splitArea: { areaStyle: { color: ["rgba(129,140,248,0.05)", "rgba(129,140,248,0.02)"] } },
            splitLine: { lineStyle: { color: "rgba(129,140,248,0.15)" } },
            axisLine: { lineStyle: { color: "rgba(129,140,248,0.15)" } },
        },
        series: [{
            type: "radar" as const,
            data: [{
                value: PROTEKSI_COLS.map(c => proteksiCounts[c.key] || 0),
                name: "Proteksi",
                symbol: "circle",
                symbolSize: 4,
                areaStyle: {
                    color: {
                        type: "radial" as const, x: 0.5, y: 0.5, r: 0.5,
                        colorStops: [
                            { offset: 0, color: "rgba(129,140,248,0.4)" },
                            { offset: 1, color: "rgba(129,140,248,0.05)" },
                        ],
                    },
                },
                lineStyle: { color: C.indigo, width: 2 },
                itemStyle: { color: C.indigo },
            }],
            animationDuration: 1200,
        }],
    }), [proteksiCounts, maxCount, theme]);

    // 3. Per-penghantar coverage horizontal bar
    const protPerPenghantar = useMemo(() => {
        const pengMap: Record<string, { total: number; protected: number }> = {};
        filtered.forEach(t => {
            if (!pengMap[t.penghantar]) pengMap[t.penghantar] = { total: 0, protected: 0 };
            pengMap[t.penghantar].total++;
            if (t.totalProteksi > 0) pengMap[t.penghantar].protected++;
        });
        return Object.entries(pengMap)
            .map(([peng, v]) => ({ peng, ...v, pct: v.total > 0 ? Math.round((v.protected / v.total) * 100) : 0 }))
            .sort((a, b) => a.pct - b.pct);
    }, [filtered]);

    const pengBarOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontSize: 11 },
            formatter: (params: Array<{ name: string; value: number }>) => {
                if (!params.length) return "";
                const p = params[0];
                const info = protPerPenghantar.find(x => x.peng === p.name);
                return `<b style="color:${theme.emphasisText}">${p.name}</b><br/>`
                    + `Terpasang: <b>${info?.protected || 0}</b> / ${info?.total || 0} tower<br/>`
                    + `Coverage: <b>${p.value}%</b>`;
            },
        },
        grid: { top: 8, right: 60, bottom: 8, left: 240 },
        yAxis: {
            type: "category" as const,
            data: protPerPenghantar.map(p => p.peng),
            axisLabel: {
                fontSize: 9, color: theme.text, width: 230,
                overflow: "truncate" as const, ellipsis: "…",
            },
            axisLine: { show: false },
            axisTick: { show: false },
            inverse: true,
        },
        xAxis: {
            type: "value" as const,
            max: 100,
            axisLabel: { fontSize: 10, color: theme.textMuted, formatter: "{value}%" },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            axisLine: { show: false },
        },
        series: [{
            type: "bar" as const,
            data: protPerPenghantar.map(p => ({
                value: p.pct,
                itemStyle: {
                    color: {
                        type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: p.pct >= 80
                            ? [{ offset: 0, color: "#059669" }, { offset: 1, color: C.emerald }]
                            : p.pct >= 50
                                ? [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: C.cyan }]
                                : p.pct > 0
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
                formatter: (p: { value: number }) => `${p.value}%`,
            },
            showBackground: true,
            backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
        }],
        animationDuration: 1200,
    }), [protPerPenghantar, theme]);

    // 4. Protection per GI bar
    const protPerGI = useMemo(() => {
        const giMap: Record<string, { total: number; protected: number }> = {};
        filtered.forEach(t => {
            if (!giMap[t.gi]) giMap[t.gi] = { total: 0, protected: 0 };
            giMap[t.gi].total++;
            if (t.totalProteksi > 0) giMap[t.gi].protected++;
        });
        return Object.entries(giMap)
            .map(([gi, v]) => ({ gi, ...v, pct: v.total > 0 ? Math.round((v.protected / v.total) * 100) : 0 }))
            .sort((a, b) => a.pct - b.pct);
    }, [filtered]);

    const giBarOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontSize: 11 },
            formatter: (params: Array<{ name: string; value: number }>) => {
                if (!params.length) return "";
                const p = params[0];
                const info = protPerGI.find(x => x.gi === p.name);
                return `<b style="color:${theme.emphasisText}">${p.name}</b><br/>`
                    + `Terpasang: <b>${info?.protected || 0}</b> / ${info?.total || 0} tower<br/>`
                    + `Coverage: <b>${p.value}%</b>`;
            },
        },
        grid: { top: 8, right: 60, bottom: 8, left: 200 },
        yAxis: {
            type: "category" as const,
            data: protPerGI.map(g => g.gi),
            axisLabel: {
                fontSize: 9, color: theme.text, width: 190,
                overflow: "truncate" as const, ellipsis: "…",
            },
            axisLine: { show: false },
            axisTick: { show: false },
            inverse: true,
        },
        xAxis: {
            type: "value" as const,
            max: 100,
            axisLabel: { fontSize: 10, color: theme.textMuted, formatter: "{value}%" },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            axisLine: { show: false },
        },
        series: [{
            type: "bar" as const,
            data: protPerGI.map(g => ({
                value: g.pct,
                itemStyle: {
                    color: {
                        type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: g.pct >= 80
                            ? [{ offset: 0, color: "#059669" }, { offset: 1, color: C.emerald }]
                            : g.pct >= 50
                                ? [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: C.cyan }]
                                : g.pct > 0
                                    ? [{ offset: 0, color: "#d97706" }, { offset: 1, color: C.amber }]
                                    : [{ offset: 0, color: "#e11d48" }, { offset: 1, color: C.rose }],
                    },
                    borderRadius: [0, 6, 6, 0],
                },
            })),
            barWidth: 16,
            label: {
                show: true, position: "right" as const,
                fontSize: 10, fontWeight: "bold" as const,
                color: theme.text,
                formatter: (p: { value: number }) => `${p.value}%`,
            },
            showBackground: true,
            backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
        }],
        animationDuration: 1200,
    }), [protPerGI, theme]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => { setPage(0); }, [filterULTG, filterPenghantar, filterProteksi, showOnlyInstalled, searchTower]);

    if (loading) return (
        <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-80" />
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-96">
            <Card className="max-w-md">
                <CardContent className="p-6 text-center">
                    <p className="text-destructive font-semibold mb-2">Error Loading Data</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="ds-heading flex items-center gap-2">
                        <Zap className="h-6 w-6 text-primary" />
                        Data Petir Transmisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Data proteksi petir tambahan — {towers.length} tower
                        {hasFilters && ` (menampilkan ${filtered.length})`}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                    <DataFreshness />
                </div>
            </div>

            {/* ── Tab Bar — Vercel-style underline tabs ── */}
            <div className="border-b border-border">
                <nav className="flex gap-0 -mb-px" aria-label="Module tabs">
                    {[
                        { key: "proteksi", label: "Proteksi Petir", icon: Shield },
                        { key: "fl", label: "Fault Locator (FL)", icon: Crosshair },
                        { key: "detail", label: "Detail Petir", icon: Zap }
                    ].map(({ key, label, icon: Icon }) => {
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key as any)}
                                className={[
                                    "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                                    "border-b-2 -mb-px outline-none",
                                    isActive
                                        ? "border-foreground text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                                ].join(" ")}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {activeTab === "proteksi" && (
                <div className="space-y-3 m-0">

            {/* ───── Hero Stats Row ───── */}
            <div className="grid grid-cols-12 gap-3">
                {/* Coverage Gauge */}
                <Card className="col-span-12 md:col-span-3 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-5"
                        style={{ background: `radial-gradient(circle at 50% 30%, ${C.emerald}, transparent 70%)` }} />
                    <CardHeader className="pb-0">
                        <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="h-3 w-3" /> Coverage Proteksi
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-2">
                        <ReactECharts option={gaugeOption} style={{ height: 180 }} />
                        <div className="flex justify-between text-xs text-muted-foreground -mt-2">
                            <span>{towersWithProteksi} terpasang</span>
                            <span>{towersWithoutProteksi} belum</span>
                        </div>
                    </CardContent>
                </Card>

                {/* KPI Summary Cards */}
                <div className="col-span-12 md:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Total Tower", value: totalTower, sub: "Seluruh tower", icon: MapPin, color: C.indigo, glow: "rgba(129,140,248,0.15)" },
                        { label: "Terpasang", value: towersWithProteksi, sub: `${coveragePercent}% coverage`, icon: CheckCircle2, color: C.emerald, glow: "rgba(52,211,153,0.15)" },
                        { label: "Belum Proteksi", value: towersWithoutProteksi, sub: `${100 - coveragePercent}% belum`, icon: Zap, color: C.rose, glow: "rgba(251,113,133,0.15)" },
                        { label: "Total Instalasi", value: totalInstalled, sub: "Perangkat terpasang", icon: BarChart3, color: C.cyan, glow: "rgba(34,211,238,0.15)" },
                    ].map(kpi => {
                        const Icon = kpi.icon;
                        return (
                            <Card key={kpi.label} className="relative overflow-hidden hover:shadow-sm transition-all duration-200">
                                <div className="absolute inset-0 opacity-30"
                                    style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.glow}, transparent 60%)` }} />
                                <CardContent className="p-4 relative z-10">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-2xl font-bold">{kpi.value}</p>
                                            <p className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: kpi.color }}>
                                                {kpi.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                                            style={{ backgroundColor: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                            <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* ───── Proteksi Type Grid Cards ───── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {PROTEKSI_COLS.map(col => {
                    const count = proteksiCounts[col.key];
                    const pct = totalTower > 0 ? ((count / totalTower) * 100).toFixed(1) : "0";
                    const isActive = filterProteksi === col.key;
                    return (
                        <button key={col.key}
                            onClick={() => setFilterProteksi(isActive ? null : col.key)}
                            className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-300 
                                hover:shadow-lg group
                                ${isActive ? "ring-2 ring-primary shadow-xl scale-[1.02]" : ""}`}
                            style={{
                                borderColor: isActive ? col.color : `${col.color}25`,
                                backgroundColor: isActive ? `${col.color}12` : "transparent",
                            }}>
                            {/* Glow bg */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{ background: `radial-gradient(circle at 80% 30%, ${col.color}15, transparent 70%)` }} />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-lg">{col.icon}</span>
                                    <span className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                                        style={{ backgroundColor: `${col.color}20`, color: col.color }}>
                                        {pct}%
                                    </span>
                                </div>
                                <p className="text-xl font-bold" style={{ color: col.color }}>{count}</p>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">{col.label}</p>
                                {/* Mini progress bar */}
                                <div className="mt-2 h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: `${col.color}15` }}>
                                    <div className="h-full rounded-full transition-all duration-1000"
                                        style={{
                                            width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%`,
                                            background: `linear-gradient(90deg, ${col.color}88, ${col.color})`,
                                        }} />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ───── Filters ───── */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />

                        <SelectNative value={filterULTG || ""} onChange={e => { setFilterULTG(e.target.value || null); setFilterPenghantar(null); }}>
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>

                        <SelectNative value={filterPenghantar || ""} onChange={e => setFilterPenghantar(e.target.value || null)} className="max-w-[220px]">
                            <option value="">Semua Penghantar</option>
                            {pengList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input type="text" value={searchTower} onChange={e => setSearchTower(e.target.value)}
                                placeholder="Cari tower..."
                                className="h-8 pl-8 pr-2 text-xs w-44" />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                            <div className="relative">
                                <input type="checkbox" checked={showOnlyInstalled}
                                    onChange={e => setShowOnlyInstalled(e.target.checked)}
                                    className="peer sr-only" />
                                <div className="h-4 w-4 rounded border border-input shadow-xs transition-all cursor-pointer peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50" />
                                <CheckCircle2 className="h-3 w-3 text-primary-foreground absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                            Hanya terpasang
                        </label>

                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                                <RefreshCw className="h-3 w-3" /> Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ───── Charts Row 1: Radar + Coverage per GI ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Komposisi Proteksi
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={radarOption} style={{ height: 320 }} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-8">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Coverage per Gardu Induk
                            <Badge variant="secondary" className="ml-auto text-xs">{protPerGI.length} GI</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={giBarOption} style={{ height: Math.max(280, protPerGI.length * 30) }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Charts Row 2: Coverage per Penghantar ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" /> Coverage per Penghantar
                        <Badge variant="secondary" className="ml-auto text-xs">{protPerPenghantar.length} penghantar</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ReactECharts option={pengBarOption} style={{ height: Math.max(300, protPerPenghantar.length * 26) }} />
                </CardContent>
            </Card>

            {/* ───── Data Table ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Data Tower Proteksi Petir
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {filtered.length} tower — Hal {page + 1}/{totalPages || 1}
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
                                    <TableHead>GI</TableHead>
                                    <TableHead>Penghantar</TableHead>
                                    <TableHead>Nama Tower</TableHead>
                                    <TableHead className="text-center">Type</TableHead>
                                    <TableHead className="text-center">Proteksi Terpasang</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((t, i) => (
                                    <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-muted-foreground text-xs">{page * PAGE_SIZE + i + 1}</TableCell>
                                        <TableCell className="text-xs">
                                            <Badge variant="outline" className="text-xs px-1 py-0">{t.ultg}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{t.gi}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{t.penghantar}</TableCell>
                                        <TableCell className="font-medium text-xs whitespace-nowrap">{t.namaTower}</TableCell>
                                        <TableCell className="text-center text-xs">
                                            <Badge variant="outline" className="text-xs px-1 py-0">{t.type || "-"}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 justify-center">
                                                {t.totalProteksi === 0 ? (
                                                    <span className="text-xs text-muted-foreground italic">—</span>
                                                ) : (
                                                    t.proteksiList.map(p => {
                                                        const col = PROTEKSI_COLS.find(c => c.key === p);
                                                        return (
                                                            <Badge key={p} className="text-[7px] px-1 py-0"
                                                                style={{
                                                                    backgroundColor: `${col?.color || C.indigo}20`,
                                                                    color: col?.color || C.indigo,
                                                                    border: `1px solid ${col?.color || C.indigo}30`,
                                                                }}>
                                                                {col?.label || p}
                                                            </Badge>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
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
            )}

            {activeTab === "fl" && (
                <div className="space-y-4 m-0">
                    <Card className="border-t-4 border-t-primary shadow-md overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                                <div className="space-y-2 w-full md:max-w-md">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Zap className="h-3.5 w-3.5 text-primary" />
                                        Pemilihan Ruas Penghantar
                                    </label>
                                    <SelectNative value={flPenghantar} onChange={(e) => setFlPenghantar(e.target.value)} className="font-semibold text-sm">
                                        <option value="TRS 500kV CILEGON-CIBINONG">TRS 500kV CILEGON-CIBINONG</option>
                                        <option value="TRS 500kV SAGULING-CIBINONG">TRS 500kV SAGULING-CIBINONG</option>
                                    </SelectNative>
                                </div>
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col md:items-end min-w-[200px] w-full md:w-auto">
                                    <span className="text-xs text-muted-foreground font-medium mb-1">Panjang Penghantar</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-bold text-primary tracking-tight">64,130</span>
                                        <span className="text-sm font-medium text-muted-foreground">kms</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* GI A */}
                        <Card className="relative overflow-hidden border-border/60 shadow-sm transition-all hover:shadow-md">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                                <Building2 className="w-32 h-32" />
                            </div>
                            <CardHeader className="bg-muted/30 border-b pb-4">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                                        <span className="text-blue-600 font-bold text-xs">A</span>
                                    </div>
                                    <span className="tracking-wide">FL DARI GI AWAL</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                                        <span>Masukkan Jarak Gangguan (km)</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <Input 
                                            type="number" 
                                            value={flDistA} 
                                            onChange={(e) => setFlDistA(e.target.value)}
                                            className="text-lg font-mono font-semibold h-11 border-2 focus-visible:ring-blue-500" 
                                        />
                                        <Button className="h-11 px-6 bg-blue-600 hover:bg-blue-700 shadow-sm">
                                            <Calculator className="w-4 h-4 mr-2" /> Hitung
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-card p-5 space-y-5 shadow-inner">
                                    <div>
                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5 mb-1">
                                            <MapPin className="w-3 h-3" /> Estimasi Nomor Tower
                                        </span>
                                        <p className="text-[15px] font-semibold text-foreground">TOWER SUTET 500kV CLGR7-CIBN7 #177</p>
                                    </div>
                                    <div className="h-px bg-border/50 w-full" />
                                    <div>
                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5 mb-1">
                                            <Shield className="w-3 h-3" /> Wilayah Kerja Gardu Induk
                                        </span>
                                        <p className="text-[15px] font-bold text-blue-600 dark:text-blue-400">GITET CILEGON</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* GI B */}
                        <Card className="relative overflow-hidden border-border/60 shadow-sm transition-all hover:shadow-md">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                                <Building2 className="w-32 h-32" />
                            </div>
                            <CardHeader className="bg-muted/30 border-b pb-4">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                        <span className="text-emerald-600 font-bold text-xs">B</span>
                                    </div>
                                    <span className="tracking-wide">FL DARI GI AKHIR</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                                        <span>Masukkan Jarak Gangguan (km)</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <Input 
                                            type="number" 
                                            value={flDistB} 
                                            onChange={(e) => setFlDistB(e.target.value)}
                                            className="text-lg font-mono font-semibold h-11 border-2 focus-visible:ring-emerald-500" 
                                        />
                                        <Button className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 shadow-sm">
                                            <Calculator className="w-4 h-4 mr-2" /> Hitung
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-card p-5 space-y-5 shadow-inner">
                                    <div>
                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5 mb-1">
                                            <MapPin className="w-3 h-3" /> Estimasi Nomor Tower
                                        </span>
                                        <p className="text-[15px] font-semibold text-foreground">TOWER SUTET 500kV CLGR7-CIBN7 #293</p>
                                    </div>
                                    <div className="h-px bg-border/50 w-full" />
                                    <div>
                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5 mb-1">
                                            <Shield className="w-3 h-3" /> Wilayah Kerja Gardu Induk
                                        </span>
                                        <p className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400">GITET CIBINONG</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === "detail" && (
                <div className="space-y-3 m-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                Detail Petir
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground text-center py-8">
                                Halaman Detail Petir sedang dalam persiapan.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
