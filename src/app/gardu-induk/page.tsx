"use client";

import { useState, useMemo, useCallback } from "react";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { Building2, Zap, Radio, Activity, BarChart3, Filter, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};

interface GI { "Master ULTG": string; "Master Gardu Induk": string; "GI Type": string; "Voltage (kV)": string; Latitude: string; Longitude: string; }
interface Bay { "Master ULTG": string; "Master Gardu Induk": string; "Bay/Diameter": string; "Type Bay": string; }

export default function GarduIndukPage() {
    const theme = useChartTheme();
    // Data — index matches dataSources[] order: [0] Asset GI, [1] Asset Bay
    const { sheets, loading, fetchedAt, isRevalidating, refetch } = usePageData("/gardu-induk");
    const gis = useMemo(() => (sheets[0]?.rows || []) as unknown as GI[], [sheets]);
    const bays = useMemo(() => (sheets[1]?.rows || []) as unknown as Bay[], [sheets]);
    const [activeULTG, setActiveULTG] = useState<string | null>(null);
    const [activeGIType, setActiveGIType] = useState<string | null>(null);

    // Filtered data based on cross-filter state
    const filteredGIs = useMemo(() => {
        let result = gis;
        if (activeULTG) result = result.filter((g) => g["Master ULTG"] === activeULTG);
        if (activeGIType) result = result.filter((g) => g["GI Type"] === activeGIType);
        return result;
    }, [gis, activeULTG, activeGIType]);

    const filteredBays = useMemo(() => {
        const giNames = new Set(filteredGIs.map((g) => g["Master Gardu Induk"]));
        return bays.filter((b) => giNames.has(b["Master Gardu Induk"]));
    }, [bays, filteredGIs]);

    // Unique ULTG names
    const ultgNames = useMemo(() => [...new Set(gis.map((g) => g["Master ULTG"]))], [gis]);

    // KPIs
    const totalGI = filteredGIs.length;
    const totalBay = filteredBays.length;
    const totalGITypes = useMemo(() => [...new Set(filteredGIs.map((g) => g["GI Type"]).filter(Boolean))].length, [filteredGIs]);
    const totalVoltages = useMemo(() => [...new Set(filteredGIs.map((g) => g["Voltage (kV)"]).filter(Boolean))].length, [filteredGIs]);

    // Bay count per GI for bar chart
    const bayPerGI = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredBays.forEach((b) => { counts[b["Master Gardu Induk"]] = (counts[b["Master Gardu Induk"]] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [filteredBays]);

    // Bay types distribution
    const bayTypeDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredBays.forEach((b) => { const t = b["Type Bay"] || "Lainnya"; counts[t] = (counts[t] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [filteredBays]);

    // GI type distribution for donut
    const giTypeDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredGIs.forEach((g) => { const t = g["GI Type"] || "N/A"; counts[t] = (counts[t] || 0) + 1; });
        return Object.entries(counts);
    }, [filteredGIs]);

    // Voltage distribution
    const voltageDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredGIs.forEach((g) => { const v = g["Voltage (kV)"] || "N/A"; counts[v + " kV"] = (counts[v + " kV"] || 0) + 1; });
        return Object.entries(counts);
    }, [filteredGIs]);

    /* echartBase removed — colors now come from useChartTheme() */

    // Bar Chart: Bay per GI
    const barOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontSize: 12 },
        },
        grid: { top: 10, right: 16, bottom: 80, left: 48 },
        xAxis: {
            type: "category" as const,
            data: bayPerGI.map(([name]) => name.replace("GI ", "").replace("GIS ", "").replace("GITET ", "")),
            axisLabel: { fontSize: 9, color: theme.textMuted, rotate: 45, interval: 0 },
            axisLine: { lineStyle: { color: theme.gridLine } },
        },
        yAxis: {
            type: "value" as const,
            axisLabel: { fontSize: 10, color: theme.textMuted },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
        },
        series: [{
            type: "bar" as const,
            data: bayPerGI.map(([, count], i) => ({
                value: count,
                itemStyle: {
                    color: {
                        type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: i % 2 === 0 ? C.indigo : C.teal },
                            { offset: 1, color: i % 2 === 0 ? C.purple : C.emerald },
                        ],
                    },
                    borderRadius: [4, 4, 0, 0],
                },
            })),
            emphasis: { itemStyle: { shadowBlur: 15, shadowColor: "rgba(129,140,248,0.5)" } },
            barMaxWidth: 30,
        }],
        animationDuration: 1200,
        animationEasing: "elasticOut",
    }), [bayPerGI, theme]);

    // Donut: GI Type
    const giTypeColors = [C.amber, C.indigo, C.teal, C.pink, C.purple];
    const giTypeOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: { trigger: "item" as const, backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText }, formatter: "{b}: {c} ({d}%)" },
        series: [{
            type: "pie" as const, radius: ["40%", "75%"], center: ["50%", "50%"],
            padAngle: 3, itemStyle: { borderRadius: 6 },
            label: { show: true, color: theme.textMuted, fontSize: 10, formatter: "{b}\n{c}" },
            emphasis: { label: { fontSize: 14, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 6 },
            data: giTypeDistribution.map(([name, value], i) => ({ name, value, itemStyle: { color: giTypeColors[i % giTypeColors.length] } })),
        }],
        animationType: "scale", animationDuration: 1000,
    }), [giTypeDistribution, theme]);

    // Donut: Bay Type
    const bayTypeColors = [C.teal, C.amber, C.rose, C.blue, C.purple, C.cyan, C.orange, C.pink];
    const bayTypeOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: { trigger: "item" as const, backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText }, formatter: "{b}: {c} ({d}%)" },
        legend: { bottom: 0, textStyle: { color: theme.textMuted, fontSize: 9 }, itemWidth: 8, itemHeight: 8 },
        series: [{
            type: "pie" as const, radius: ["35%", "65%"], center: ["50%", "42%"],
            padAngle: 2, itemStyle: { borderRadius: 4 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 5 },
            data: bayTypeDistribution.map(([name, value], i) => ({ name, value, itemStyle: { color: bayTypeColors[i % bayTypeColors.length] } })),
        }],
        animationType: "scale", animationDuration: 1000,
    }), [bayTypeDistribution, theme]);

    // Voltage distribution bar
    const voltageOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: { trigger: "axis" as const, backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText } },
        grid: { top: 10, right: 16, bottom: 24, left: 48 },
        xAxis: { type: "category" as const, data: voltageDistribution.map(([v]) => v), axisLabel: { fontSize: 10, color: theme.textMuted }, axisLine: { lineStyle: { color: theme.gridLine } } },
        yAxis: { type: "value" as const, axisLabel: { fontSize: 10, color: theme.textMuted }, splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } } },
        series: [{
            type: "bar" as const,
            data: voltageDistribution.map(([, v], i) => ({ value: v, itemStyle: { color: [C.amber, C.teal, C.rose][i % 3], borderRadius: [4, 4, 0, 0] } })),
            barMaxWidth: 50,
            emphasis: { itemStyle: { shadowBlur: 12 } },
        }],
        animationDuration: 800,
    }), [voltageDistribution, theme]);

    // Click handlers for cross-filtering
    const onGITypeClick = useCallback((params: { name?: string }) => {
        if (params.name) {
            const name = params.name;
            setActiveGIType((prev) => prev === name ? null : name);
        }
    }, []);

    const clearFilters = () => { setActiveULTG(null); setActiveGIType(null); };

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
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
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight">Gardu Induk</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Data real-time dari Google Sheets — {gis.length} GI, {bays.length} Bay
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    <DataFreshness />
                    {(activeULTG || activeGIType) && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Reset Filter
                        </button>
                    )}
                    {ultgNames.map((name) => (
                        <button
                            key={name}
                            onClick={() => setActiveULTG((prev) => prev === name ? null : name)}
                            className={`text-xs px-3 py-1.5 rounded-md border transition-all duration-200 ${activeULTG === name
                                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                                : "bg-background hover:bg-muted"
                                }`}
                        >
                            <Filter className="h-3 w-3 inline mr-1" />
                            ULTG {name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Active filters */}
            {(activeULTG || activeGIType) && (
                <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">Filter aktif:</span>
                    {activeULTG && <Badge variant="secondary" className="text-xs">ULTG: {activeULTG}</Badge>}
                    {activeGIType && <Badge variant="secondary" className="text-xs">Tipe: {activeGIType}</Badge>}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Gardu Induk", value: totalGI, icon: Building2, color: C.indigo },
                    { label: "Total Bay", value: totalBay, icon: Zap, color: C.amber },
                    { label: "Tipe GI", value: totalGITypes, icon: Radio, color: C.teal },
                    { label: "Level Tegangan", value: totalVoltages, icon: Activity, color: C.purple },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color} 20` }}>
                                        <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-extrabold">{kpi.value}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-8">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Jumlah Bay per Gardu Induk
                            <Badge variant="secondary" className="ml-auto text-[9px]">{bayPerGI.length} GI</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={barOption} style={{ height: 300 }} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Radio className="h-4 w-4 text-primary" /> Tipe Gardu Induk
                            <Badge variant="secondary" className="ml-auto text-[9px]">Klik untuk filter</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={giTypeOption} style={{ height: 300 }} onEvents={{ click: onGITypeClick }} />
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" /> Distribusi Tipe Bay
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={bayTypeOption} style={{ height: 260 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Distribusi Tegangan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={voltageOption} style={{ height: 260 }} />
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Detail Gardu Induk
                        <Badge variant="secondary" className="ml-auto text-[9px]">{filteredGIs.length} GI ditampilkan</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">No</TableHead>
                                    <TableHead>ULTG</TableHead>
                                    <TableHead>Nama GI</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead>Tegangan</TableHead>
                                    <TableHead>Jumlah Bay</TableHead>
                                    <TableHead className="hidden md:table-cell">Latitude</TableHead>
                                    <TableHead className="hidden md:table-cell">Longitude</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGIs.map((gi, i) => {
                                    const bayCount = bays.filter((b) => b["Master Gardu Induk"] === gi["Master Gardu Induk"]).length;
                                    return (
                                        <TableRow key={i} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{gi["Master ULTG"]}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{gi["Master Gardu Induk"]}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className="text-[10px]"
                                                    style={{
                                                        backgroundColor: gi["GI Type"]?.includes("GITET") ? `${C.amber} 20` :
                                                            gi["GI Type"]?.includes("GIS") ? `${C.teal} 20` : `${C.indigo} 20`,
                                                        color: gi["GI Type"]?.includes("GITET") ? C.amber :
                                                            gi["GI Type"]?.includes("GIS") ? C.teal : C.indigo,
                                                    }}
                                                >
                                                    {gi["GI Type"] || "N/A"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{gi["Voltage (kV)"] || "-"} kV</TableCell>
                                            <TableCell>
                                                <span className="font-bold" style={{ color: bayCount > 20 ? C.amber : C.emerald }}>
                                                    {bayCount}
                                                </span>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">
                                                {gi.Latitude || "-"}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">
                                                {gi.Longitude || "-"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
