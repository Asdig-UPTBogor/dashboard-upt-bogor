"use client";

import { useState, useMemo, useCallback } from "react";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { CalendarDays, Target, CheckCircle2, TrendingUp, AlertTriangle, BarChart3, Filter, Building2, X } from "lucide-react";
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

function parseNum(val: string | number | undefined): number {
    if (!val) return 0;
    const cleaned = String(val).replace(/[%,]/g, "").trim();
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

type ULTGFilter = "ALL" | "BOGOR" | "SUKABUMI";

interface ProgramKerja {
    no: string;
    namaProgram: string;
    jenisProgram: string;
    kategori: string;
    risiko: string;
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

export function ProgramKerjaJaringanContent() {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/transmisi/program-kerja");
    const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);

    // ═══ Filter & cross-filter states ═══
    const [filterULTG, setFilterULTG] = useState<ULTGFilter>("ALL");
    const [selectedStatus, setSelectedStatus] = useState<StatusLabel | null>(null);
    const [selectedRisiko, setSelectedRisiko] = useState<string | null>(null);
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
                const totalTarget = parseNum(row[COL.TOTAL_TARGET]);
                const totalRealisasi = parseNum(row[COL.TOTAL_REALISASI]);
                return {
                    no: row[COL.NO] || "",
                    namaProgram: row[COL.NAMA_PROGRAM] || "-",
                    jenisProgram: row[COL.JENIS_PROGRAM] || "-",
                    kategori: row[COL.KATEGORI] || "-",
                    risiko: row[COL.RISIKO] || "Tidak Diketahui",
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

    // ULTG-aware getters — always compute from ULTG-specific columns
    // (TOTAL TARGET/REALISASI columns in sheet are unreliable, not matching sum of per-ULTG values)
    const getTarget = useCallback((p: ProgramKerja) =>
        filterULTG === "BOGOR" ? p.targetBogor : filterULTG === "SUKABUMI" ? p.targetSukabumi : (p.targetBogor + p.targetSukabumi),
        [filterULTG]);
    const getRealisasi = useCallback((p: ProgramKerja) =>
        filterULTG === "BOGOR" ? p.realisasiBogor : filterULTG === "SUKABUMI" ? p.realisasiSukabumi : (p.realisasiBogor + p.realisasiSukabumi),
        [filterULTG]);
    const getPresentase = useCallback((p: ProgramKerja) => {
        const pct = filterULTG === "BOGOR" ? p.presentaseBogor : filterULTG === "SUKABUMI" ? p.presentaseSukabumi : p.presentase;
        // Fallback calculated percentage if string percentage fails parsing
        if (pct === 0 && getTarget(p) > 0) {
            return Math.min((getRealisasi(p) / getTarget(p)) * 100, 100);
        }
        return pct;
    }, [filterULTG, getTarget, getRealisasi]);

    // ═══ Filters: ULTG + Status + Program cross-filter ═══
    const filteredByULTG = useMemo(() => {
        if (filterULTG === "ALL") return programs;
        if (filterULTG === "BOGOR") return programs.filter(p => p.targetBogor > 0 || p.realisasiBogor > 0);
        return programs.filter(p => p.targetSukabumi > 0 || p.realisasiSukabumi > 0);
    }, [programs, filterULTG]);

    const filteredPrograms = useMemo(() => {
        let result = filteredByULTG;
        if (selectedStatus) {
            result = result.filter(p => getStatus(getPresentase(p)).label === selectedStatus);
        }
        if (selectedRisiko) {
            result = result.filter(p => p.risiko === selectedRisiko);
        }
        if (selectedProgram) {
            result = result.filter(p => p.namaProgram === selectedProgram);
        }
        return result;
    }, [filteredByULTG, selectedStatus, selectedRisiko, selectedProgram, getPresentase]);

    // KPI — from ULTG-filtered programs
    const totalProgram = filteredByULTG.length;
    const kpiTarget = filteredByULTG.reduce((acc, p) => acc + getTarget(p), 0);
    const kpiRealisasi = filteredByULTG.reduce((acc, p) => acc + getRealisasi(p), 0);
    const avgProgress = kpiTarget > 0 ? (kpiRealisasi / kpiTarget) * 100 : 0;

    // Risiko counts
    const risikoCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredByULTG.forEach(p => {
            counts[p.risiko] = (counts[p.risiko] || 0) + 1;
        });
        return counts;
    }, [filteredByULTG]);

    // Programs with target > 0 (for bar chart) — uses filtered data
    const programsWithTarget = useMemo(() =>
        filteredPrograms.filter(p => getTarget(p) > 0).sort((a, b) => getPresentase(a) - getPresentase(b)),
        [filteredPrograms, getTarget, getPresentase]);

    const ultgLabel = filterULTG === "ALL" ? "Semua Unit (Gabungan)"
        : filterULTG === "BOGOR" ? "ULTG Bogor" : "ULTG Sukabumi";

    // Active filter chips
    const hasFilter = filterULTG !== "ALL" || selectedStatus || selectedRisiko || selectedProgram;
    const clearAll = useCallback(() => {
        setFilterULTG("ALL");
        setSelectedStatus(null);
        setSelectedRisiko(null);
        setSelectedProgram(null);
    }, []);

    // ═══════════════════════════════════════
    // CHART OPTIONS
    // ═══════════════════════════════════════

    // Bar chart: Progress per program (OUR version — proper styling)
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
            grid: { top: 8, right: 60, bottom: 8, left: 240 },
            yAxis: {
                type: "category" as const,
                data: items.map(p => p.namaProgram),
                axisLabel: { fontSize: 10, color: theme.text, width: 230, overflow: "truncate" as const, ellipsis: "…" },
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
        const data = [
            { name: "ULTG Bogor", value: tBogor, itemStyle: { color: C.indigo, opacity: filterULTG === "SUKABUMI" ? 0.08 : 1, shadowBlur: filterULTG === "BOGOR" ? 12 : 0, shadowColor: filterULTG === "BOGOR" ? C.indigo : "transparent" } },
            { name: "ULTG Sukabumi", value: tSukabumi, itemStyle: { color: C.purple, opacity: filterULTG === "BOGOR" ? 0.08 : 1, shadowBlur: filterULTG === "SUKABUMI" ? 12 : 0, shadowColor: filterULTG === "SUKABUMI" ? C.purple : "transparent" } },
        ];
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif" },
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", borderWidth: 1,
                textStyle: { color: "#e4e4e7", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Target: <strong>${p.value.toLocaleString()}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${(filterULTG === "BOGOR" ? tBogor : filterULTG === "SUKABUMI" ? tSukabumi : tAll).toLocaleString()}`, fontSize: 22, fontWeight: "bold" as const, fill: "#e4e4e7", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "Target", fontSize: 10, fill: filterULTG !== "ALL" ? "#818cf8" : "#71717a", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "45%"],
                padAngle: 2, itemStyle: { borderRadius: 6 },
                label: {
                    show: true, fontSize: 11, color: "#d4d4d8",
                    formatter: (p: { name: string; value: number; percent: number }) =>
                        `{name|${p.name}}\n{val|${p.value.toLocaleString()}} ({pct|${p.percent.toFixed(0)}%})`,
                    rich: {
                        name: { fontSize: 11, color: "#e4e4e7", fontWeight: "bold" as const, lineHeight: 16 },
                        val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" as const },
                        pct: { fontSize: 10, color: "#a1a1aa" },
                    },
                },
                labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#52525b", width: 1.5 } },
                selectedMode: "single" as const, selectedOffset: 10,
                emphasis: { scaleSize: 6, label: { fontSize: 12 } },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [programs, theme, filterULTG]);

    const handleUltgClick = useCallback((params: { name?: string }) => {
        if (!params.name) return;
        if (params.name === "ULTG Bogor") setFilterULTG(prev => prev === "BOGOR" ? "ALL" : "BOGOR");
        else if (params.name === "ULTG Sukabumi") setFilterULTG(prev => prev === "SUKABUMI" ? "ALL" : "SUKABUMI");
    }, []);

    // ═══ DONUT 2: Status Distribution ═══
    const statusDonutOption = useMemo(() => {
        const counts = [
            { name: "Selesai" as StatusLabel, value: filteredByULTG.filter(p => getPresentase(p) >= 100).length, color: C.emerald },
            { name: "On Track" as StatusLabel, value: filteredByULTG.filter(p => getPresentase(p) >= 50 && getPresentase(p) < 100).length, color: C.blue },
            { name: "Tertunda" as StatusLabel, value: filteredByULTG.filter(p => getPresentase(p) > 0 && getPresentase(p) < 50).length, color: C.orange },
            { name: "Belum Mulai" as StatusLabel, value: filteredByULTG.filter(p => getPresentase(p) === 0).length, color: C.rose },
        ].filter(s => s.value > 0);
        const data = counts.map(s => ({
            name: s.name, value: s.value,
            itemStyle: {
                color: s.color,
                opacity: selectedStatus && selectedStatus !== s.name ? 0.08 : 1,
                shadowBlur: selectedStatus === s.name ? 12 : 0,
                shadowColor: selectedStatus === s.name ? s.color : "transparent",
            },
        }));
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif" },
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: "rgba(129,140,248,0.3)", borderWidth: 1,
                textStyle: { color: "#e4e4e7", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Program: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${avgProgress.toFixed(0)}%`, fontSize: 22, fontWeight: "bold" as const, fill: "#e4e4e7", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "Avg Progress", fontSize: 10, fill: selectedStatus ? "#34d399" : "#71717a", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "45%"],
                padAngle: 2, itemStyle: { borderRadius: 6 },
                label: {
                    show: true, fontSize: 11, color: "#d4d4d8",
                    formatter: (p: { name: string; value: number; percent: number }) =>
                        `{name|${p.name}}\n{val|${p.value}} ({pct|${p.percent.toFixed(0)}%})`,
                    rich: {
                        name: { fontSize: 11, color: "#e4e4e7", fontWeight: "bold" as const, lineHeight: 16 },
                        val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" as const },
                        pct: { fontSize: 10, color: "#a1a1aa" },
                    },
                },
                labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#52525b", width: 1.5 } },
                selectedMode: "single" as const, selectedOffset: 10,
                emphasis: { scaleSize: 6, label: { fontSize: 12 } },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [filteredByULTG, getPresentase, avgProgress, theme, selectedStatus]);

    const handleStatusClick = useCallback((params: { name?: string }) => {
        if (!params.name) return;
        setSelectedStatus(prev => prev === params.name ? null : params.name as StatusLabel);
        setSelectedProgram(null);
    }, []);

    // ═══ DONUT 3: Risiko Distribution ═══
    const risikoDonutOption = useMemo(() => {
        const risikoColors = [C.rose, C.amber, C.teal, C.indigo, C.purple];
        const entries = Object.entries(risikoCounts);
        const data = entries.map(([name, value], i) => ({
            name, value,
            itemStyle: {
                color: risikoColors[i % risikoColors.length],
                opacity: selectedRisiko && selectedRisiko !== name ? 0.08 : 1,
                shadowBlur: selectedRisiko === name ? 12 : 0,
                shadowColor: selectedRisiko === name ? risikoColors[i % risikoColors.length] : "transparent",
            },
        }));
        const total = entries.reduce((s, [, v]) => s + v, 0);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif" },
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(15,15,30,0.95)",
                borderColor: `${C.rose}30`, borderWidth: 1,
                textStyle: { color: "#e4e4e7", fontSize: 12 },
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `<strong>${p.name}</strong><br/>Program: <strong>${p.value}</strong> (${p.percent.toFixed(1)}%)`,
            },
            graphic: [{
                type: "text" as const, left: "center", top: "33%",
                style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: "#e4e4e7", textAlign: "center" as const },
            }, {
                type: "text" as const, left: "center", top: "48%",
                style: { text: "Program", fontSize: 10, fill: selectedRisiko ? "#fb7185" : "#71717a", textAlign: "center" as const },
            }],
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "45%"],
                padAngle: 2, itemStyle: { borderRadius: 6 },
                label: {
                    show: true, fontSize: 11, color: "#d4d4d8",
                    formatter: (p: { name: string; value: number; percent: number }) =>
                        `{name|${p.name}}\n{val|${p.value}} ({pct|${p.percent.toFixed(0)}%})`,
                    rich: {
                        name: { fontSize: 11, color: "#e4e4e7", fontWeight: "bold" as const, lineHeight: 16 },
                        val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" as const },
                        pct: { fontSize: 10, color: "#a1a1aa" },
                    },
                },
                labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#52525b", width: 1.5 } },
                selectedMode: "single" as const, selectedOffset: 10,
                emphasis: { scaleSize: 6, label: { fontSize: 12 } },
                data,
            }],
            animationType: "scale", animationDuration: 800, animationEasing: "cubicOut",
        };
    }, [risikoCounts, theme, selectedRisiko]);

    const handleRisikoClick = useCallback((params: { name?: string }) => {
        if (!params.name) return;
        setSelectedRisiko(prev => prev === params.name ? null : params.name!);
        setSelectedProgram(null);
    }, []);

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════

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
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header & Filter Row (TEMEN's ULTG dropdown + OUR cross-filter chips) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-primary" />
                        Program Kerja Jaringan
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Monitoring LM Jaringan 2026 — {filteredPrograms.length}/{programs.length} program · {ultgLabel}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* ULTG dropdown (TEMEN's) */}
                    <div className="flex items-center gap-2 bg-card border rounded-md px-3 py-1.5 shadow-sm">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">ULTG:</span>
                        <select
                            value={filterULTG}
                            onChange={(e) => setFilterULTG(e.target.value as ULTGFilter)}
                            className="bg-transparent text-sm font-semibold border-none focus:ring-0 cursor-pointer outline-none"
                        >
                            <option value="ALL">Semua Unit (Gabungan)</option>
                            <option value="BOGOR">ULTG Bogor</option>
                            <option value="SUKABUMI">ULTG Sukabumi</option>
                        </select>
                    </div>

                    {/* Active filter chips (OUR cross-filter) */}
                    {hasFilter && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {selectedStatus && (
                                <Badge variant="outline" className="text-[9px] cursor-pointer gap-1 hover:bg-destructive/20"
                                    onClick={() => setSelectedStatus(null)}>
                                    <X className="h-2.5 w-2.5" /> {selectedStatus}
                                </Badge>
                            )}
                            {selectedRisiko && (
                                <Badge variant="outline" className="text-[9px] cursor-pointer gap-1 hover:bg-destructive/20"
                                    onClick={() => setSelectedRisiko(null)}>
                                    <X className="h-2.5 w-2.5" /> Risiko: {selectedRisiko}
                                </Badge>
                            )}
                            {selectedProgram && (
                                <Badge variant="outline" className="text-[9px] cursor-pointer gap-1 hover:bg-destructive/20 max-w-[200px] truncate"
                                    onClick={() => setSelectedProgram(null)}>
                                    <X className="h-2.5 w-2.5" /> {selectedProgram}
                                </Badge>
                            )}
                            {(selectedStatus || selectedRisiko || selectedProgram) && (
                                <button className="text-[9px] text-primary hover:underline ml-1" onClick={clearAll}>
                                    Reset All
                                </button>
                            )}
                        </div>
                    )}

                    <DataFreshness />
                </div>
            </div>

            {/* KPI Cards (TEMEN's layout — Total Target, Total Realisasi, Progress) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Program", value: totalProgram, icon: CalendarDays, color: C.indigo },
                    { label: filterULTG === "ALL" ? "Total Target" : `Target ${filterULTG}`, value: kpiTarget.toLocaleString(), icon: Target, color: C.orange },
                    { label: filterULTG === "ALL" ? "Total Realisasi" : `Realisasi ${filterULTG}`, value: kpiRealisasi.toLocaleString(), icon: CheckCircle2, color: C.emerald },
                    { label: "Progress Area", value: `${avgProgress.toFixed(1)}%`, icon: TrendingUp, color: C.blue },
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
                                        <p className="text-2xl font-extrabold text-foreground">{kpi.value}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Bar Chart + 3 Cross-Filter Donuts */}
            {(() => {
                const donutHeight = 220;
                const donutCardInner = donutHeight * 3 + 32 * 3 + 48;
                const barHeight = Math.max(300, donutCardInner - 68);
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                        {/* Bar Chart (OURS) */}
                        <Card className="lg:col-span-8">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-primary" /> Progress per Program Kerja
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

                        {/* 3 Donuts — stacked in right column */}
                        <Card className="lg:col-span-4">
                            <CardContent className="p-4 h-full flex flex-col gap-2">
                                {/* DONUT 1: ULTG */}
                                <div className="flex items-center gap-1.5 px-1">
                                    <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                                    <span className="text-xs font-semibold text-foreground/80">Filter ULTG</span>
                                    {filterULTG !== "ALL" && (
                                        <Badge variant="outline" className="ml-auto text-[8px] cursor-pointer hover:bg-destructive/20 py-0 h-4"
                                            onClick={() => setFilterULTG("ALL")}><X className="h-2 w-2 mr-0.5" /> Reset</Badge>
                                    )}
                                </div>
                                <ReactECharts
                                    option={ultgDonutOption}
                                    style={{ height: donutHeight }}
                                    onEvents={{ click: handleUltgClick }}
                                />
                                <div className="border-t border-border/50" />

                                {/* DONUT 2: Status */}
                                <div className="flex items-center gap-1.5 px-1">
                                    <Target className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-xs font-semibold text-foreground/80">Distribusi Status</span>
                                    {selectedStatus && (
                                        <Badge variant="outline" className="ml-auto text-[8px] cursor-pointer hover:bg-destructive/20 py-0 h-4"
                                            onClick={() => setSelectedStatus(null)}><X className="h-2 w-2 mr-0.5" /> {selectedStatus}</Badge>
                                    )}
                                </div>
                                <ReactECharts
                                    option={statusDonutOption}
                                    style={{ height: donutHeight }}
                                    onEvents={{ click: handleStatusClick }}
                                />
                                <div className="border-t border-border/50" />

                                {/* DONUT 3: Risiko (cross-filter) */}
                                <div className="flex items-center gap-1.5 px-1">
                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                                    <span className="text-xs font-semibold text-foreground/80">Sebaran Risiko</span>
                                    {selectedRisiko && (
                                        <Badge variant="outline" className="ml-auto text-[8px] cursor-pointer hover:bg-destructive/20 py-0 h-4"
                                            onClick={() => setSelectedRisiko(null)}><X className="h-2 w-2 mr-0.5" /> {selectedRisiko}</Badge>
                                    )}
                                </div>
                                <ReactECharts
                                    option={risikoDonutOption}
                                    style={{ height: donutHeight }}
                                    onEvents={{ click: handleRisikoClick }}
                                />
                                <p className="text-center text-[8px] text-muted-foreground opacity-60 mt-auto">
                                    Klik chart untuk cross-filter
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                );
            })()}

            {/* Detailed Table (TEMEN's — conditional ULTG columns + RISIKO badge) */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" /> Rincian Program Kerja
                        <Badge variant="secondary" className="ml-auto text-[9px]">
                            {filteredPrograms.length}/{programs.length} program · {ultgLabel}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="overflow-x-auto rounded-md border mt-3">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead rowSpan={2} className="text-xs font-semibold py-2 text-center border-r">NO</TableHead>
                                    <TableHead rowSpan={2} className="text-xs font-semibold py-2 text-center border-r min-w-[200px]">NAMA PROGRAM</TableHead>
                                    <TableHead rowSpan={2} className="text-xs font-semibold py-2 text-center border-r">KATEGORI</TableHead>
                                    <TableHead rowSpan={2} className="text-xs font-semibold py-2 text-center border-r">RISIKO</TableHead>

                                    {(filterULTG === "ALL" || filterULTG === "BOGOR") && (
                                        <TableHead colSpan={3} className="text-xs font-bold py-2 text-center border-b border-r bg-muted/70">ULTG BOGOR</TableHead>
                                    )}
                                    {(filterULTG === "ALL" || filterULTG === "SUKABUMI") && (
                                        <TableHead colSpan={3} className="text-xs font-bold py-2 text-center border-b border-r bg-muted/70">ULTG SUKABUMI</TableHead>
                                    )}
                                    {filterULTG === "ALL" && (
                                        <TableHead colSpan={3} className="text-xs font-bold py-2 text-center border-b border-r bg-muted/70">TOTAL</TableHead>
                                    )}
                                    <TableHead rowSpan={2} className="text-xs font-semibold py-2 text-center">PELAKSANA</TableHead>
                                </TableRow>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    {(filterULTG === "ALL" || filterULTG === "BOGOR") && (
                                        <>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Target</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Real</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">%</TableHead>
                                        </>
                                    )}
                                    {(filterULTG === "ALL" || filterULTG === "SUKABUMI") && (
                                        <>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Target</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Real</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">%</TableHead>
                                        </>
                                    )}
                                    {filterULTG === "ALL" && (
                                        <>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Target</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Real</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">%</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPrograms.map((p, i) => {
                                    const isHighlighted = selectedProgram === p.namaProgram;
                                    return (
                                        <TableRow key={i}
                                            className={`transition-colors cursor-pointer ${isHighlighted ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/30"}`}
                                            onClick={() => setSelectedProgram(prev => prev === p.namaProgram ? null : p.namaProgram)}
                                        >
                                            <TableCell className="text-[11px] py-2 text-center border-r">{p.no || (i + 1)}</TableCell>
                                            <TableCell className="text-[11px] py-2 border-r font-medium line-clamp-3" title={p.namaProgram}>
                                                {p.namaProgram.length > 70 ? p.namaProgram.substring(0, 70) + "..." : p.namaProgram}
                                            </TableCell>
                                            <TableCell className="text-[11px] py-2 text-center border-r">{p.kategori}</TableCell>
                                            <TableCell className="text-[11px] py-2 text-center border-r">
                                                <Badge variant="outline" className="text-[9px]">{p.risiko}</Badge>
                                            </TableCell>

                                            {/* Bogor */}
                                            {(filterULTG === "ALL" || filterULTG === "BOGOR") && (
                                                <>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono">{p.raw[COL.TARGET_BOGOR] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono text-emerald-500">{p.raw[COL.REALISASI_BOGOR] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r">{p.raw[COL.PRESENTASE_BOGOR] || "0%"}</TableCell>
                                                </>
                                            )}

                                            {/* Sukabumi */}
                                            {(filterULTG === "ALL" || filterULTG === "SUKABUMI") && (
                                                <>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono">{p.raw[COL.TARGET_SUKABUMI] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono text-emerald-500">{p.raw[COL.REALISASI_SUKABUMI] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r">{p.raw[COL.PRESENTASE_SUKABUMI] || "0%"}</TableCell>
                                                </>
                                            )}

                                            {/* Total */}
                                            {filterULTG === "ALL" && (
                                                <>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono bg-muted/10">{p.raw[COL.TOTAL_TARGET] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono text-emerald-600 bg-muted/10">{p.raw[COL.TOTAL_REALISASI] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r bg-muted/10">{p.raw[COL.PRESENTASE] || "0%"}</TableCell>
                                                </>
                                            )}

                                            <TableCell className="text-[11px] py-2 text-center truncate max-w-[120px]" title={p.pelaksana}>{p.pelaksana}</TableCell>
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

export default function ProgramKerjaJaringanPage() {
    return <ProgramKerjaJaringanContent />;
}
