"use client";

import { useEffect, useState, useMemo } from "react";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { CalendarDays, Target, CheckCircle2, Clock, TrendingUp, Filter, RefreshCw } from "lucide-react";
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

/* echartBase removed — colors now come from useChartTheme() */

// Helper: find column by partial match (case-insensitive)
function findCol(headers: string[], ...keywords: string[]): string {
    for (const kw of keywords) {
        const found = headers.find(h => h.toUpperCase().includes(kw.toUpperCase()));
        if (found) return found;
    }
    return "";
}

// Helper: parse number from string (handles %, comma, etc)
function parseNum(val: string): number {
    if (!val) return 0;
    const cleaned = val.replace(/[%,]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// Helper: determine status from percentage
function getStatus(pct: number): { label: string; color: string; bg: string } {
    if (pct >= 100) return { label: "Selesai", color: C.emerald, bg: `${C.emerald}20` };
    if (pct >= 75) return { label: "On Track", color: C.blue, bg: `${C.blue}20` };
    if (pct >= 50) return { label: "Progress", color: C.amber, bg: `${C.amber}20` };
    if (pct > 0) return { label: "Tertunda", color: C.orange, bg: `${C.orange}20` };
    return { label: "Belum Mulai", color: C.rose, bg: `${C.rose}20` };
}

interface ProgramKerja {
    namaProgram: string;
    target: number;
    realisasi: number;
    persentase: number;
    raw: Record<string, string>;
}

export default function ProgramKerjaJaringanPage() {
    const theme = useChartTheme();
    const [rawData, setRawData] = useState<Record<string, string>[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/program-kerja-jaringan")
            .then((r) => r.json())
            .then((json) => {
                if (json.error) {
                    setError(json.error);
                } else {
                    setRawData(json.data || []);
                    setHeaders(json.headers || []);
                }
                setLoading(false);
            })
            .catch((e) => { setError(String(e)); setLoading(false); });
    }, []);

    // Auto-detect columns
    const colMap = useMemo(() => ({
        nama: findCol(headers, "NAMA PROGRAM", "PROGRAM", "URAIAN", "KEGIATAN", "NAMA"),
        target: findCol(headers, "TARGET"),
        realisasi: findCol(headers, "REALISASI", "REAL"),
        persentase: findCol(headers, "PERSENTASE", "PERSEN", "%", "PROGRESS"),
    }), [headers]);

    // Parse data
    const programs: ProgramKerja[] = useMemo(() => {
        return rawData
            .filter(row => {
                const nama = row[colMap.nama] || "";
                return nama.length > 0;
            })
            .map(row => {
                const target = parseNum(row[colMap.target]);
                const realisasi = parseNum(row[colMap.realisasi]);
                let persentase = parseNum(row[colMap.persentase]);
                // If no percentage column, calculate from target/realisasi
                if (!colMap.persentase && target > 0) {
                    persentase = (realisasi / target) * 100;
                }
                return {
                    namaProgram: row[colMap.nama] || "-",
                    target,
                    realisasi,
                    persentase: Math.min(persentase, 100),
                    raw: row,
                };
            });
    }, [rawData, colMap]);

    // KPI calculations
    const totalProgram = programs.length;
    const selesai = programs.filter(p => p.persentase >= 100).length;
    const onTrack = programs.filter(p => p.persentase >= 50 && p.persentase < 100).length;
    const belumMulai = programs.filter(p => p.persentase === 0).length;
    const avgProgress = totalProgram > 0
        ? Math.round(programs.reduce((acc, p) => acc + p.persentase, 0) / totalProgram)
        : 0;

    // Only programs with target > 0
    const programsWithTarget = useMemo(() =>
        programs.filter(p => p.target > 0).sort((a, b) => a.persentase - b.persentase),
        [programs]);

    // Horizontal bar chart: Progress per program (only with target)
    const barOption = useMemo(() => {
        const items = programsWithTarget;
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                borderRadius: 8,
                textStyle: { color: theme.tooltipText, fontSize: 12 },
                formatter: (params: Array<{ name: string; value: number }>) => {
                    if (!params.length) return "";
                    const p = params[0];
                    const prog = items.find(pr => pr.namaProgram === p.name);
                    return `<b style="color:${theme.emphasisText}">${p.name}</b><br/>`
                        + `<span style="color:${C.indigo}">● Target:</span> ${prog?.target || 0}<br/>`
                        + `<span style="color:${C.emerald}">● Realisasi:</span> ${prog?.realisasi || 0}<br/>`
                        + `<span style="color:${C.amber}">● Progress:</span> <b>${p.value}%</b>`;
                },
            },
            grid: { top: 8, right: 60, bottom: 8, left: 210 },
            yAxis: {
                type: "category" as const,
                data: items.map(p => p.namaProgram),
                axisLabel: {
                    fontSize: 10, color: theme.text, width: 195,
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
                data: items.map((p) => ({
                    value: Math.round(p.persentase),
                    itemStyle: {
                        color: {
                            type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                            colorStops: p.persentase >= 100
                                ? [{ offset: 0, color: "#059669" }, { offset: 1, color: C.emerald }]
                                : p.persentase >= 75
                                    ? [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: C.cyan }]
                                    : p.persentase >= 50
                                        ? [{ offset: 0, color: "#d97706" }, { offset: 1, color: C.amber }]
                                        : p.persentase > 0
                                            ? [{ offset: 0, color: "#ea580c" }, { offset: 1, color: C.orange }]
                                            : [{ offset: 0, color: "#e11d48" }, { offset: 1, color: C.rose }],
                        },
                        borderRadius: [0, 6, 6, 0],
                    },
                })),
                barWidth: 16,
                label: {
                    show: true, position: "right" as const,
                    fontSize: 11, fontWeight: "bold" as const,
                    color: theme.text,
                    formatter: (p: { value: number }) => `${p.value}%`,
                },
                emphasis: {
                    itemStyle: { shadowBlur: 12, shadowColor: "rgba(129,140,248,0.4)" },
                },
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
            }],
            animationDuration: 1200,
            animationEasing: "cubicOut",
        };
    }, [programsWithTarget, theme]);

    // Donut chart: Status distribution
    const donutOption = useMemo(() => {
        const statusCounts = [
            { name: "Selesai (100%)", value: selesai, color: C.emerald },
            { name: "On Track (≥50%)", value: onTrack, color: C.blue },
            { name: "Tertunda (<50%)", value: programs.filter(p => p.persentase > 0 && p.persentase < 50).length, color: C.orange },
            { name: "Belum Mulai (0%)", value: belumMulai, color: C.rose },
        ].filter(s => s.value > 0);

        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "item" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText },
                formatter: "{b}: {c} ({d}%)",
            },
            series: [{
                type: "pie" as const,
                radius: ["40%", "75%"],
                center: ["50%", "50%"],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: true, color: theme.textMuted, fontSize: 10, formatter: "{b}\n{c}" },
                emphasis: { label: { fontSize: 13, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 6 },
                data: statusCounts.map(s => ({
                    name: s.name, value: s.value,
                    itemStyle: { color: s.color },
                })),
            }],
            animationType: "scale",
            animationDuration: 1000,
        };
    }, [selesai, onTrack, belumMulai, programs, theme]);

    // Gauge chart: Average progress
    const gaugeOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        series: [{
            type: "gauge" as const,
            startAngle: 200,
            endAngle: -20,
            min: 0,
            max: 100,
            radius: "90%",
            pointer: { show: true, length: "60%", width: 4, itemStyle: { color: C.indigo } },
            axisLine: {
                lineStyle: {
                    width: 18,
                    color: [
                        [0.25, C.rose],
                        [0.5, C.orange],
                        [0.75, C.amber],
                        [1, C.emerald],
                    ],
                },
            },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            detail: {
                valueAnimation: true,
                fontSize: 28,
                fontWeight: "bold" as const,
                color: theme.text,
                formatter: "{value}%",
                offsetCenter: [0, "70%"],
            },
            title: {
                show: true,
                offsetCenter: [0, "90%"],
                fontSize: 11,
                color: theme.textMuted,
            },
            data: [{ value: avgProgress, name: "Rata-rata Progress" }],
        }],
        animationDuration: 1500,
    }), [avgProgress, theme]);

    // Target vs Realisasi stacked bar
    const targetRealOption = useMemo(() => {
        const sorted = [...programs].sort((a, b) => b.target - a.target).slice(0, 15);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 12 },
            },
            legend: {
                data: ["Target", "Realisasi"],
                textStyle: { color: theme.textMuted, fontSize: 10 },
                bottom: 0,
            },
            grid: { top: 10, right: 20, bottom: 40, left: 50 },
            xAxis: {
                type: "category" as const,
                data: sorted.map(p => p.namaProgram.length > 20 ? p.namaProgram.slice(0, 20) + "…" : p.namaProgram),
                axisLabel: { fontSize: 8, color: theme.textMuted, rotate: 45, interval: 0 },
                axisLine: { lineStyle: { color: theme.gridLine } },
            },
            yAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: theme.textMuted },
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            },
            series: [
                {
                    name: "Target",
                    type: "bar" as const,
                    data: sorted.map(p => ({
                        value: p.target,
                        itemStyle: { color: C.indigo, borderRadius: [4, 4, 0, 0] },
                    })),
                    barMaxWidth: 20,
                },
                {
                    name: "Realisasi",
                    type: "bar" as const,
                    data: sorted.map(p => ({
                        value: p.realisasi,
                        itemStyle: { color: C.emerald, borderRadius: [4, 4, 0, 0] },
                    })),
                    barMaxWidth: 20,
                },
            ],
            animationDuration: 1000,
        };
    }, [programs, theme]);

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-4 gap-4">
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
                        <p className="text-xs text-muted-foreground mt-2">
                            Pastikan Google credential sudah di-setup dengan benar.
                        </p>
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
                        <CalendarDays className="h-6 w-6 text-primary" />
                        Program Kerja Jaringan
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Monitoring LM Jaringan 2026 — {programs.length} program kerja
                    </p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px]">
                        <RefreshCw className="h-3 w-3 mr-1" /> Auto-refresh 5 menit
                    </Badge>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: "Total Program", value: totalProgram, icon: CalendarDays, color: C.indigo },
                    { label: "Selesai", value: selesai, icon: CheckCircle2, color: C.emerald },
                    { label: "On Track", value: onTrack, icon: TrendingUp, color: C.blue },
                    { label: "Belum Mulai", value: belumMulai, icon: Clock, color: C.rose },
                    { label: "Avg Progress", value: `${avgProgress}%`, icon: Target, color: C.amber },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
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
                            <TrendingUp className="h-4 w-4 text-primary" /> Progress per Program Kerja
                            <Badge variant="secondary" className="ml-auto text-[9px]">{programsWithTarget.length} program (ada target)</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={barOption} style={{ height: Math.max(300, programsWithTarget.length * 32) }} />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" /> Distribusi Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={donutOption} style={{ height: 320 }} />
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" /> Target vs Realisasi
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={targetRealOption} style={{ height: 280 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" /> Rata-rata Progress Keseluruhan
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={gaugeOption} style={{ height: 280 }} />
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" /> Detail Program Kerja
                        <Badge variant="secondary" className="ml-auto text-[9px]">{programs.length} program ditampilkan</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">No</TableHead>
                                    <TableHead>Nama Program</TableHead>
                                    <TableHead className="text-center">Target</TableHead>
                                    <TableHead className="text-center">Realisasi</TableHead>
                                    <TableHead className="text-center">Progress</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {programs.map((p, i) => {
                                    const status = getStatus(p.persentase);
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                            <TableCell className="font-medium max-w-[300px]">
                                                <span className="line-clamp-2">{p.namaProgram}</span>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-sm">{p.target || "-"}</TableCell>
                                            <TableCell className="text-center font-mono text-sm">{p.realisasi || "-"}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${Math.min(p.persentase, 100)}%`,
                                                                backgroundColor: status.color,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-semibold" style={{ color: status.color }}>
                                                        {Math.round(p.persentase)}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    className="text-[10px]"
                                                    style={{ backgroundColor: status.bg, color: status.color }}
                                                >
                                                    {status.label}
                                                </Badge>
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
