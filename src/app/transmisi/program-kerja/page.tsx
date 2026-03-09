"use client";

import { useState, useMemo, useCallback } from "react";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { CalendarDays, Target, CheckCircle2, Clock, TrendingUp, Building2, X } from "lucide-react";
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

/* ══════════════════════════════════════════
   Exact column names — sesuai page-config
   ══════════════════════════════════════════ */
const COL = {
    NO: "NO",
    JENIS_PROGRAM: "JENIS PROGRAM",
    NAMA_PROGRAM: "NAMA PROGRAM",
    RISIKO: "RISIKO",
    KATEGORI: "KATEGORI",
    POS_ANGGARAN: "POS ANGGARAN",
    KETERANGAN: "KETERANGAN",
    PRESENTASE: "PRESENTASE",
    PELAKSANA: "PELAKSANA",
    LOKASI: "LOKASI",
    TARGET_BOGOR: "TARGET ULTG BOGOR",
    REALISASI_BOGOR: "REALISASI ULTG BOGOR",
    TARGET_SUKABUMI: "TARGET ULTG SUKABUMI",
    REALISASI_SUKABUMI: "REALISASI ULTG SUKABUMI",
    PRESENTASE_BOGOR: "PRESENTASE ULTG BOGOR",
    PRESENTASE_SUKABUMI: "PRESENTASE ULTG SUKABUMI",
    TOTAL_TARGET: "TOTAL TARGET",
    TOTAL_REALISASI: "TOTAL REALISASI",
} as const;

function parseNum(val: string | undefined): number {
    if (!val) return 0;
    const cleaned = val.replace(/[%,]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

type StatusLabel = "Selesai" | "On Track" | "Progress" | "Tertunda" | "Belum Mulai";

function getStatus(pct: number): { label: StatusLabel; color: string; bg: string } {
    if (pct >= 100) return { label: "Selesai", color: C.emerald, bg: `${C.emerald}20` };
    if (pct >= 75) return { label: "On Track", color: C.blue, bg: `${C.blue}20` };
    if (pct >= 50) return { label: "Progress", color: C.amber, bg: `${C.amber}20` };
    if (pct > 0) return { label: "Tertunda", color: C.orange, bg: `${C.orange}20` };
    return { label: "Belum Mulai", color: C.rose, bg: `${C.rose}20` };
}

type ULTGFilter = "total" | "bogor" | "sukabumi";

interface ProgramKerja {
    no: string;
    namaProgram: string;
    jenisProgram: string;
    kategori: string;
    pelaksana: string;
    lokasi: string;
    targetBogor: number;
    realisasiBogor: number;
    targetSukabumi: number;
    realisasiSukabumi: number;
    totalTarget: number;
    totalRealisasi: number;
    presentase: number;
    presentaseBogor: number;
    presentaseSukabumi: number;
    raw: Record<string, string>;
}

export default function ProgramKerjaJaringanPage() {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/transmisi/program-kerja");
    const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);

    // ═══ Cross-filter states ═══
    const [ultgFilter, setUltgFilter] = useState<ULTGFilter>("total");
    const [selectedStatus, setSelectedStatus] = useState<StatusLabel | null>(null);
    const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

    // Parse data
    const programs: ProgramKerja[] = useMemo(() => {
        return rawData
            .filter(row => (row[COL.NAMA_PROGRAM] || "").trim().length > 0)
            .map(row => {
                const targetBogor = parseNum(row[COL.TARGET_BOGOR]);
                const realisasiBogor = parseNum(row[COL.REALISASI_BOGOR]);
                const targetSukabumi = parseNum(row[COL.TARGET_SUKABUMI]);
                const realisasiSukabumi = parseNum(row[COL.REALISASI_SUKABUMI]);
                const totalTarget = parseNum(row[COL.TOTAL_TARGET]) || (targetBogor + targetSukabumi);
                const totalRealisasi = parseNum(row[COL.TOTAL_REALISASI]) || (realisasiBogor + realisasiSukabumi);
                return {
                    no: row[COL.NO] || "",
                    namaProgram: row[COL.NAMA_PROGRAM] || "-",
                    jenisProgram: row[COL.JENIS_PROGRAM] || "-",
                    kategori: row[COL.KATEGORI] || "-",
                    pelaksana: row[COL.PELAKSANA] || "-",
                    lokasi: row[COL.LOKASI] || "-",
                    targetBogor, realisasiBogor, targetSukabumi, realisasiSukabumi,
                    totalTarget, totalRealisasi,
                    presentase: Math.min(parseNum(row[COL.PRESENTASE]), 100),
                    presentaseBogor: Math.min(parseNum(row[COL.PRESENTASE_BOGOR]), 100),
                    presentaseSukabumi: Math.min(parseNum(row[COL.PRESENTASE_SUKABUMI]), 100),
                    raw: row,
                };
            });
    }, [rawData]);

    // ULTG-aware getters
    const getTarget = useCallback((p: ProgramKerja) =>
        ultgFilter === "bogor" ? p.targetBogor : ultgFilter === "sukabumi" ? p.targetSukabumi : p.totalTarget,
        [ultgFilter]);
    const getRealisasi = useCallback((p: ProgramKerja) =>
        ultgFilter === "bogor" ? p.realisasiBogor : ultgFilter === "sukabumi" ? p.realisasiSukabumi : p.totalRealisasi,
        [ultgFilter]);
    const getPresentase = useCallback((p: ProgramKerja) =>
        ultgFilter === "bogor" ? p.presentaseBogor : ultgFilter === "sukabumi" ? p.presentaseSukabumi : p.presentase,
        [ultgFilter]);

    // ═══ Cross-filter: apply status filter ═══
    const filteredPrograms = useMemo(() => {
        let result = programs;
        if (selectedStatus) {
            result = result.filter(p => getStatus(getPresentase(p)).label === selectedStatus);
        }
        if (selectedProgram) {
            result = result.filter(p => p.namaProgram === selectedProgram);
        }
        return result;
    }, [programs, selectedStatus, selectedProgram, getPresentase]);

    // KPI — always from ALL programs (not filtered)
    const totalProgram = programs.length;
    const selesai = programs.filter(p => getPresentase(p) >= 100).length;
    const onTrack = programs.filter(p => getPresentase(p) >= 50 && getPresentase(p) < 100).length;
    const belumMulai = programs.filter(p => getPresentase(p) === 0).length;
    const avgProgress = totalProgram > 0
        ? Math.round(programs.reduce((acc, p) => acc + getPresentase(p), 0) / totalProgram) : 0;

    // Programs with target > 0 (for bar chart) — uses filtered data
    const programsWithTarget = useMemo(() =>
        filteredPrograms.filter(p => getTarget(p) > 0).sort((a, b) => getPresentase(a) - getPresentase(b)),
        [filteredPrograms, getTarget, getPresentase]);

    const ultgLabel = ultgFilter === "total" ? "Total (Bogor + Sukabumi)"
        : ultgFilter === "bogor" ? "ULTG Bogor" : "ULTG Sukabumi";

    // Active filter chips
    const hasFilter = ultgFilter !== "total" || selectedStatus || selectedProgram;
    const clearAll = useCallback(() => {
        setUltgFilter("total");
        setSelectedStatus(null);
        setSelectedProgram(null);
    }, []);

    // ═══════════════════════════════════════
    // CHART OPTIONS
    // ═══════════════════════════════════════

    // Bar chart: Progress per program
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
                    if (!prog) return p.name;
                    return `<b style="color:${theme.emphasisText}">${p.name}</b><br/>`
                        + `<span style="color:${C.indigo}">● Target:</span> ${getTarget(prog)}<br/>`
                        + `<span style="color:${C.emerald}">● Realisasi:</span> ${getRealisasi(prog)}<br/>`
                        + `<span style="color:${C.amber}">● Progress:</span> <b>${p.value}%</b>`;
                },
            },
            grid: { top: 8, right: 60, bottom: 8, left: 210 },
            yAxis: {
                type: "category" as const,
                data: items.map(p => p.namaProgram),
                axisLabel: { fontSize: 10, color: theme.text, width: 195, overflow: "truncate" as const, ellipsis: "…" },
                axisLine: { show: false }, axisTick: { show: false }, inverse: true,
            },
            xAxis: {
                type: "value" as const, max: 100,
                axisLabel: { fontSize: 10, color: theme.textMuted, formatter: "{value}%" },
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
                axisLine: { show: false },
            },
            series: [{
                type: "bar" as const,
                data: items.map((p) => {
                    const pct = getPresentase(p);
                    return {
                        value: Math.round(pct),
                        itemStyle: {
                            color: {
                                type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                                colorStops: pct >= 100
                                    ? [{ offset: 0, color: "#059669" }, { offset: 1, color: C.emerald }]
                                    : pct >= 75
                                        ? [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: C.cyan }]
                                        : pct >= 50
                                            ? [{ offset: 0, color: "#d97706" }, { offset: 1, color: C.amber }]
                                            : pct > 0
                                                ? [{ offset: 0, color: "#ea580c" }, { offset: 1, color: C.orange }]
                                                : [{ offset: 0, color: "#e11d48" }, { offset: 1, color: C.rose }],
                            },
                            borderRadius: [0, 6, 6, 0],
                        },
                    };
                }),
                barWidth: 16,
                label: {
                    show: true, position: "right" as const,
                    fontSize: 11, fontWeight: "bold" as const, color: theme.text,
                    formatter: (p: { value: number }) => `${p.value}%`,
                },
                emphasis: { itemStyle: { shadowBlur: 12, shadowColor: "rgba(129,140,248,0.4)" } },
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
            }],
            animationDuration: 1200, animationEasing: "cubicOut",
            animationDurationUpdate: 600, animationEasingUpdate: "cubicInOut",
        };
    }, [programsWithTarget, theme, getTarget, getRealisasi, getPresentase]);

    // Bar chart click → select program
    const handleBarClick = useCallback((params: { name?: string }) => {
        if (!params.name) return;
        setSelectedProgram(prev => prev === params.name ? null : params.name!);
    }, []);

    // ═══ DONUT 1: ULTG Cross-Filter ═══
    const ultgDonutOption = useMemo(() => {
        const tBogor = programs.reduce((a, p) => a + p.targetBogor, 0);
        const tSukabumi = programs.reduce((a, p) => a + p.targetSukabumi, 0);
        const tAll = tBogor + tSukabumi;

        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            title: {
                text: ultgFilter === "total" ? "All" : ultgFilter === "bogor" ? "Bogor" : "Sukabumi",
                subtext: `${ultgFilter === "bogor" ? tBogor : ultgFilter === "sukabumi" ? tSukabumi : tAll} target`,
                left: "center", top: "center",
                textStyle: { fontSize: 12, fontWeight: "bold" as const, color: theme.text },
                subtextStyle: { fontSize: 9, color: theme.textMuted },
            },
            tooltip: {
                trigger: "item" as const, backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 11 },
                formatter: "{b}: {c} ({d}%)",
            },
            series: [{
                type: "pie" as const,
                radius: ["50%", "82%"],
                center: ["50%", "50%"],
                padAngle: 4,
                itemStyle: { borderRadius: 6 },
                label: { show: true, color: theme.textMuted, fontSize: 9, formatter: "{b}\n{c}", position: "outside" as const },
                emphasis: { label: { fontSize: 11, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 4 },
                selectedMode: "single" as const,
                select: { itemStyle: { shadowBlur: 16, shadowColor: "rgba(129,140,248,0.5)" } },
                data: [
                    {
                        name: "ULTG Bogor", value: tBogor,
                        itemStyle: { color: ultgFilter === "sukabumi" ? `${C.indigo}40` : C.indigo },
                        selected: ultgFilter === "bogor"
                    },
                    {
                        name: "ULTG Sukabumi", value: tSukabumi,
                        itemStyle: { color: ultgFilter === "bogor" ? `${C.purple}40` : C.purple },
                        selected: ultgFilter === "sukabumi"
                    },
                ],
            }],
            animationType: "scale", animationDuration: 600,
            animationDurationUpdate: 500, animationEasingUpdate: "cubicInOut",
        };
    }, [programs, theme, ultgFilter]);

    const handleUltgClick = useCallback((params: { name?: string }) => {
        if (!params.name) return;
        if (params.name === "ULTG Bogor") setUltgFilter(prev => prev === "bogor" ? "total" : "bogor");
        else if (params.name === "ULTG Sukabumi") setUltgFilter(prev => prev === "sukabumi" ? "total" : "sukabumi");
    }, []);

    // ═══ DONUT 2: Status Distribution ═══
    const statusDonutOption = useMemo(() => {
        const counts = [
            { name: "Selesai" as StatusLabel, value: programs.filter(p => getPresentase(p) >= 100).length, color: C.emerald },
            { name: "On Track" as StatusLabel, value: programs.filter(p => getPresentase(p) >= 50 && getPresentase(p) < 100).length, color: C.blue },
            { name: "Tertunda" as StatusLabel, value: programs.filter(p => getPresentase(p) > 0 && getPresentase(p) < 50).length, color: C.orange },
            { name: "Belum Mulai" as StatusLabel, value: programs.filter(p => getPresentase(p) === 0).length, color: C.rose },
        ].filter(s => s.value > 0);

        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            title: {
                text: `${avgProgress}%`,
                subtext: "Avg",
                left: "center", top: "center",
                textStyle: { fontSize: 16, fontWeight: "bold" as const, color: theme.text },
                subtextStyle: { fontSize: 9, color: theme.textMuted },
            },
            tooltip: {
                trigger: "item" as const, backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 11 },
                formatter: "{b}: {c} ({d}%)",
            },
            series: [{
                type: "pie" as const,
                radius: ["50%", "82%"],
                center: ["50%", "50%"],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: true, color: theme.textMuted, fontSize: 9, formatter: "{b}\n{c}", position: "outside" as const },
                emphasis: { label: { fontSize: 11, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 4 },
                selectedMode: "single" as const,
                select: { itemStyle: { shadowBlur: 16, shadowColor: "rgba(129,140,248,0.5)" } },
                data: counts.map(s => ({
                    name: s.name, value: s.value,
                    itemStyle: { color: selectedStatus && selectedStatus !== s.name ? `${s.color}40` : s.color },
                    selected: selectedStatus === s.name,
                })),
            }],
            animationType: "scale", animationDuration: 600,
            animationDurationUpdate: 500, animationEasingUpdate: "cubicInOut",
        };
    }, [programs, getPresentase, avgProgress, theme, selectedStatus]);

    const handleStatusClick = useCallback((params: { name?: string }) => {
        if (!params.name) return;
        setSelectedStatus(prev => prev === params.name ? null : params.name as StatusLabel);
        setSelectedProgram(null); // clear program filter when clicking status
    }, []);

    // Gauge chart
    const gaugeOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        series: [{
            type: "gauge" as const,
            startAngle: 200, endAngle: -20, min: 0, max: 100, radius: "90%",
            pointer: { show: true, length: "60%", width: 4, itemStyle: { color: C.indigo } },
            axisLine: { lineStyle: { width: 18, color: [[0.25, C.rose], [0.5, C.orange], [0.75, C.amber], [1, C.emerald]] } },
            axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
            detail: { valueAnimation: true, fontSize: 28, fontWeight: "bold" as const, color: theme.text, formatter: "{value}%", offsetCenter: [0, "70%"] },
            title: { show: true, offsetCenter: [0, "90%"], fontSize: 11, color: theme.textMuted },
            data: [{ value: avgProgress, name: "Rata-rata Progress" }],
        }],
        animationDuration: 1500,
        animationDurationUpdate: 600, animationEasingUpdate: "cubicInOut",
    }), [avgProgress, theme]);

    // Target vs Realisasi
    const targetRealOption = useMemo(() => {
        const sorted = [...filteredPrograms].sort((a, b) => getTarget(b) - getTarget(a)).slice(0, 15);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const, backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText, fontSize: 12 },
            },
            legend: {
                data: ultgFilter === "total" ? ["Target Bogor", "Target Sukabumi", "Realisasi Bogor", "Realisasi Sukabumi"] : ["Target", "Realisasi"],
                textStyle: { color: theme.textMuted, fontSize: 10 }, bottom: 0,
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
            series: ultgFilter === "total"
                ? [
                    { name: "Target Bogor", type: "bar" as const, stack: "target", data: sorted.map(p => ({ value: p.targetBogor, itemStyle: { color: C.indigo } })), barMaxWidth: 20 },
                    { name: "Target Sukabumi", type: "bar" as const, stack: "target", data: sorted.map(p => ({ value: p.targetSukabumi, itemStyle: { color: C.purple, borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 20 },
                    { name: "Realisasi Bogor", type: "bar" as const, stack: "realisasi", data: sorted.map(p => ({ value: p.realisasiBogor, itemStyle: { color: C.emerald } })), barMaxWidth: 20 },
                    { name: "Realisasi Sukabumi", type: "bar" as const, stack: "realisasi", data: sorted.map(p => ({ value: p.realisasiSukabumi, itemStyle: { color: C.teal, borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 20 },
                ]
                : [
                    { name: "Target", type: "bar" as const, data: sorted.map(p => ({ value: getTarget(p), itemStyle: { color: C.indigo, borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 20 },
                    { name: "Realisasi", type: "bar" as const, data: sorted.map(p => ({ value: getRealisasi(p), itemStyle: { color: C.emerald, borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 20 },
                ],
            animationDuration: 1000,
            animationDurationUpdate: 600, animationEasingUpdate: "cubicInOut",
        };
    }, [filteredPrograms, theme, ultgFilter, getTarget, getRealisasi]);

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
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
                        <CalendarDays className="h-6 w-6 text-primary" />
                        Program Kerja Jaringan
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        LM Jaringan 2026 — {filteredPrograms.length}/{programs.length} program · {ultgLabel}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Active filter chips */}
                    {hasFilter && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {ultgFilter !== "total" && (
                                <Badge variant="outline" className="text-[9px] cursor-pointer gap-1 hover:bg-destructive/20"
                                    onClick={() => setUltgFilter("total")}>
                                    <X className="h-2.5 w-2.5" /> {ultgLabel}
                                </Badge>
                            )}
                            {selectedStatus && (
                                <Badge variant="outline" className="text-[9px] cursor-pointer gap-1 hover:bg-destructive/20"
                                    onClick={() => setSelectedStatus(null)}>
                                    <X className="h-2.5 w-2.5" /> {selectedStatus}
                                </Badge>
                            )}
                            {selectedProgram && (
                                <Badge variant="outline" className="text-[9px] cursor-pointer gap-1 hover:bg-destructive/20 max-w-[200px] truncate"
                                    onClick={() => setSelectedProgram(null)}>
                                    <X className="h-2.5 w-2.5" /> {selectedProgram}
                                </Badge>
                            )}
                            <button className="text-[9px] text-primary hover:underline ml-1" onClick={clearAll}>
                                Reset All
                            </button>
                        </div>
                    )}
                    <DataFreshness />
                </div>
            </div>

            {/* KPI Cards — clickable for status cross-filter */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {([
                    { label: "Total Program", value: totalProgram, icon: CalendarDays, color: C.indigo, status: null },
                    { label: "Selesai", value: selesai, icon: CheckCircle2, color: C.emerald, status: "Selesai" as StatusLabel },
                    { label: "On Track", value: onTrack, icon: TrendingUp, color: C.blue, status: "On Track" as StatusLabel },
                    { label: "Belum Mulai", value: belumMulai, icon: Clock, color: C.rose, status: "Belum Mulai" as StatusLabel },
                    { label: "Avg Progress", value: `${avgProgress}%`, icon: Target, color: C.amber, status: null },
                ] as const).map((kpi) => {
                    const Icon = kpi.icon;
                    const isActive = kpi.status && selectedStatus === kpi.status;
                    return (
                        <Card key={kpi.label}
                            className={`transition-all duration-300 hover:-translate-y-1 ${kpi.status ? "cursor-pointer hover:shadow-lg" : ""} ${isActive ? "ring-2 ring-primary" : ""}`}
                            onClick={() => {
                                if (kpi.status) {
                                    setSelectedStatus(prev => prev === kpi.status ? null : kpi.status);
                                    setSelectedProgram(null);
                                }
                            }}
                        >
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

            {/* Bar Chart + Cross-Filter Donuts side by side */}
            {(() => {
                // Donuts fixed at 200px each. Bar chart fills to match.
                const donutHeight = 200;
                // 2 donuts + labels(~20px each) + divider(~10px) + footer(~16px) + padding(~24px)
                const donutCardInner = donutHeight * 2 + 20 * 2 + 10 + 16 + 24;
                // Bar card has header (~44px) + padding (~24px), so bar chart area = donutCardInner - 68
                const barHeight = Math.max(300, donutCardInner - 68);
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                        {/* Bar Chart — adapts to donut wrapper height */}
                        <Card className="lg:col-span-8">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" /> Progress per Program Kerja
                                    <Badge variant="secondary" className="ml-auto text-[9px]">{programsWithTarget.length} program</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ReactECharts
                                    option={barOption}
                                    style={{ height: barHeight }}
                                    onEvents={{ click: handleBarClick }}
                                />
                            </CardContent>
                        </Card>

                        {/* Donuts — fixed size, professional layout */}
                        <Card className="lg:col-span-4">
                            <CardContent className="p-3 h-full flex flex-col">
                                {/* ULTG Donut */}
                                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mb-0 px-1">
                                    <Building2 className="h-3.5 w-3.5 text-primary" /> Filter ULTG
                                    {ultgFilter !== "total" && (
                                        <Badge variant="outline" className="ml-auto text-[8px] cursor-pointer hover:bg-destructive/20 py-0 h-4"
                                            onClick={() => setUltgFilter("total")}><X className="h-2 w-2 mr-0.5" /> Reset</Badge>
                                    )}
                                </p>
                                <ReactECharts
                                    option={ultgDonutOption}
                                    style={{ height: donutHeight }}
                                    onEvents={{ click: handleUltgClick }}
                                />
                                {/* Divider */}
                                <div className="border-t border-border my-1" />
                                {/* Status Donut */}
                                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mb-0 px-1">
                                    <Target className="h-3.5 w-3.5 text-primary" /> Distribusi Status
                                    {selectedStatus && (
                                        <Badge variant="outline" className="ml-auto text-[8px] cursor-pointer hover:bg-destructive/20 py-0 h-4"
                                            onClick={() => setSelectedStatus(null)}><X className="h-2 w-2 mr-0.5" /> {selectedStatus}</Badge>
                                    )}
                                </p>
                                <ReactECharts
                                    option={statusDonutOption}
                                    style={{ height: donutHeight }}
                                    onEvents={{ click: handleStatusClick }}
                                />
                                <p className="text-center text-[8px] text-muted-foreground opacity-60 mt-auto">
                                    Klik chart untuk cross-filter
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                );
            })()}

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" /> Target vs Realisasi
                            {ultgFilter === "total" && (
                                <Badge variant="outline" className="ml-auto text-[9px] text-muted-foreground">Stacked per ULTG</Badge>
                            )}
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

            {/* Data Table — responds to all filters */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" /> Detail Program Kerja
                        <Badge variant="secondary" className="ml-auto text-[9px]">
                            {filteredPrograms.length}/{programs.length} program · {ultgLabel}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">No</TableHead>
                                    <TableHead>Nama Program</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead className="text-center">Target</TableHead>
                                    <TableHead className="text-center">Realisasi</TableHead>
                                    <TableHead className="text-center">Progress</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPrograms.map((p, i) => {
                                    const pct = getPresentase(p);
                                    const status = getStatus(pct);
                                    const isHighlighted = selectedProgram === p.namaProgram;
                                    return (
                                        <TableRow key={i}
                                            className={`transition-colors cursor-pointer ${isHighlighted ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/50"}`}
                                            onClick={() => setSelectedProgram(prev => prev === p.namaProgram ? null : p.namaProgram)}
                                        >
                                            <TableCell className="text-muted-foreground">{p.no || i + 1}</TableCell>
                                            <TableCell className="font-medium max-w-[300px]">
                                                <span className="line-clamp-2">{p.namaProgram}</span>
                                                {p.pelaksana !== "-" && (
                                                    <span className="text-[10px] text-muted-foreground block">{p.pelaksana}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{p.kategori}</TableCell>
                                            <TableCell className="text-center font-mono text-sm">{getTarget(p) || "-"}</TableCell>
                                            <TableCell className="text-center font-mono text-sm">{getRealisasi(p) || "-"}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: status.color }} />
                                                    </div>
                                                    <span className="text-xs font-semibold" style={{ color: status.color }}>
                                                        {Math.round(pct)}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-[10px]" style={{ backgroundColor: status.bg, color: status.color }}>
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
