"use client";

import { useState, useEffect, useMemo } from "react";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { CalendarDays, Target, CheckCircle2, TrendingUp, AlertTriangle, BarChart3, Filter } from "lucide-react";
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

function parseNum(val: string | number): number {
    if (!val) return 0;
    const cleaned = String(val).replace(/[%,]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

export default function ProgramKerjaJaringanPage() {
    const theme = useChartTheme();
    const [rawData, setRawData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [filterULTG, setFilterULTG] = useState<string>("ALL");

    useEffect(() => {
        setLoading(true);
        fetch("/api/lm-jaringan")
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setHeaders(data.headers || []);
                setRawData(data.data || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const programs = useMemo(() => {
        return rawData.filter(row => row["NAMA PROGRAM"] && String(row["NAMA PROGRAM"]).trim() !== "");
    }, [rawData]);

    // Apply filter
    const filteredPrograms = useMemo(() => {
        return programs.filter(p => {
            if (filterULTG === "ALL") return true;
            if (filterULTG === "BOGOR") {
                return parseNum(p["TARGET ULTG BOGOR"]) > 0 || parseNum(p["REALISASI ULTG BOGOR"]) > 0;
            }
            if (filterULTG === "SUKABUMI") {
                return parseNum(p["TARGET ULTG SUKABUMI"]) > 0 || parseNum(p["REALISASI ULTG SUKABUMI"]) > 0;
            }
            return true;
        });
    }, [programs, filterULTG]);

    // Derived Variables & KPIs
    let totalTarget = 0;
    let totalRealisasi = 0;
    const risikoCounts: Record<string, number> = {};

    filteredPrograms.forEach(p => {
        const tAll = parseNum(p["TOTAL TARGET"]);
        const rAll = parseNum(p["TOTAL REALISASI"]);

        const tb = parseNum(p["TARGET ULTG BOGOR"]);
        const rb = parseNum(p["REALISASI ULTG BOGOR"]);

        const ts = parseNum(p["TARGET ULTG SUKABUMI"]);
        const rs = parseNum(p["REALISASI ULTG SUKABUMI"]);

        if (filterULTG === "ALL") {
            totalTarget += tAll;
            totalRealisasi += rAll;
        } else if (filterULTG === "BOGOR") {
            totalTarget += tb;
            totalRealisasi += rb;
        } else if (filterULTG === "SUKABUMI") {
            totalTarget += ts;
            totalRealisasi += rs;
        }

        const risiko = p["RISIKO"] || "Tidak Diketahui";
        risikoCounts[risiko] = (risikoCounts[risiko] || 0) + 1;
    });

    const avgProgress = totalTarget > 0 ? (totalRealisasi / totalTarget) * 100 : 0;

    // Progress per Program Data
    const progressChartData = useMemo(() => {
        return filteredPrograms.map(p => {
            let target = 0;
            let realisasi = 0;
            let persentase = 0;

            if (filterULTG === "ALL") {
                target = parseNum(p["TOTAL TARGET"]);
                realisasi = parseNum(p["TOTAL REALISASI"]);
                persentase = parseNum(p["PRESENTASE"]);
            } else if (filterULTG === "BOGOR") {
                target = parseNum(p["TARGET ULTG BOGOR"]);
                realisasi = parseNum(p["REALISASI ULTG BOGOR"]);
                persentase = parseNum(p["PRESENTASE ULTG BOGOR"]);
            } else if (filterULTG === "SUKABUMI") {
                target = parseNum(p["TARGET ULTG SUKABUMI"]);
                realisasi = parseNum(p["REALISASI ULTG SUKABUMI"]);
                persentase = parseNum(p["PRESENTASE ULTG SUKABUMI"]);
            }

            // Fallback calculated percentage if string percentage fails parsing
            if (persentase === 0 && target > 0) {
                persentase = (realisasi / target) * 100;
            }

            return {
                name: p["NAMA PROGRAM"],
                target,
                realisasi,
                persentase: Math.min(persentase, 100)
            };
        }).filter(x => x.target > 0).sort((a, b) => a.persentase - b.persentase);
    }, [filteredPrograms, filterULTG]);

    // Chart Options: Horizontal Progress Bar per Program
    const progressChartOption = useMemo(() => {
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis",
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                borderRadius: 8,
                textStyle: { color: theme.tooltipText, fontSize: 12 },
                formatter: (params: any) => {
                    if (!params.length) return "";
                    const p = params[0];
                    const prog = progressChartData.find(pr => pr.name === p.name);
                    return `<b style="color:${theme.emphasisText}">${p.name}</b><br/>`
                        + `<span style="color:${C.indigo}">● Target:</span> ${prog?.target || 0}<br/>`
                        + `<span style="color:${C.emerald}">● Realisasi:</span> ${prog?.realisasi || 0}<br/>`
                        + `<span style="color:${C.amber}">● Progress:</span> <b>${p.value.toFixed(1)}%</b>`;
                },
            },
            grid: { top: 8, right: 60, bottom: 8, left: 240 },
            yAxis: {
                type: "category",
                data: progressChartData.map(p => p.name),
                axisLabel: {
                    fontSize: 10, color: theme.text, width: 230,
                    overflow: "truncate", ellipsis: "…",
                },
                axisLine: { show: false },
                axisTick: { show: false },
                inverse: true,
            },
            xAxis: {
                type: "value",
                max: 100,
                axisLabel: { fontSize: 10, color: theme.textMuted, formatter: "{value}%" },
                splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" } },
                axisLine: { show: false },
            },
            series: [{
                type: "bar",
                data: progressChartData.map((p) => ({
                    value: p.persentase,
                    itemStyle: {
                        color: {
                            type: "linear", x: 0, y: 0, x2: 1, y2: 0,
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
                    show: true, position: "right",
                    fontSize: 11, fontWeight: "bold",
                    color: theme.text,
                    formatter: (p: any) => `${p.value.toFixed(1)}%`,
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
    }, [progressChartData, theme]);

    // Pie Chart: Risiko
    const risikoChartOption = useMemo(() => {
        const data = Object.keys(risikoCounts).map((k, i) => {
            const colors = [C.rose, C.amber, C.teal, C.indigo, C.purple];
            return {
                name: k,
                value: risikoCounts[k],
                itemStyle: { color: colors[i % colors.length] }
            };
        });

        return {
            backgroundColor: "transparent",
            tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
            legend: { top: "bottom", textStyle: { color: theme.textMuted, fontSize: 10 } },
            series: [{
                name: "Risiko",
                type: "pie",
                radius: ["40%", "70%"],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 10, borderColor: theme.cardBg, borderWidth: 2 },
                label: { show: false },
                emphasis: {
                    label: { show: true, fontSize: 14, fontWeight: "bold", color: theme.text }
                },
                data,
            }]
        };
    }, [risikoCounts, theme]);

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
            {/* Header & Filter Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-primary" />
                        Program Kerja Jaringan
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Monitoring LM Jaringan 2026 — {filteredPrograms.length} program kerja
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-card border rounded-md px-3 py-1.5 shadow-sm">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">ULTG:</span>
                        <select
                            value={filterULTG}
                            onChange={(e) => setFilterULTG(e.target.value)}
                            className="bg-transparent text-sm font-semibold border-none focus:ring-0 cursor-pointer outline-none"
                        >
                            <option value="ALL">Semua Unit (Gabungan)</option>
                            <option value="BOGOR">ULTG Bogor</option>
                            <option value="SUKABUMI">ULTG Sukabumi</option>
                        </select>
                    </div>

                    <DataFreshness />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Program", value: filteredPrograms.length, icon: CalendarDays, color: C.indigo },
                    { label: filterULTG === "ALL" ? "Total Target" : `Target ${filterULTG}`, value: totalTarget.toLocaleString(), icon: Target, color: C.orange },
                    { label: filterULTG === "ALL" ? "Total Realisasi" : `Realisasi ${filterULTG}`, value: totalRealisasi.toLocaleString(), icon: CheckCircle2, color: C.emerald },
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

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <Card className="md:col-span-8">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> Progress per Program (Target {'>'} 0)
                            <Badge variant="secondary" className="ml-auto text-[9px]">{progressChartData.length} Program</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts
                            option={progressChartOption}
                            style={{ height: Math.max(300, progressChartData.length * 32) }}
                        />
                    </CardContent>
                </Card>

                <Card className="md:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-primary" /> Sebaran Risiko
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={risikoChartOption} style={{ height: 300 }} />
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" /> Rincian Program Kerja
                        <Badge variant="secondary" className="ml-auto text-[9px]">Sesuai LM JARINGAN 2026</Badge>
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

                                    {/* Conditionally show columns based on filter */}
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
                                    {/* Bogor */}
                                    {(filterULTG === "ALL" || filterULTG === "BOGOR") && (
                                        <>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Target</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Real</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">%</TableHead>
                                        </>
                                    )}
                                    {/* Sukabumi */}
                                    {(filterULTG === "ALL" || filterULTG === "SUKABUMI") && (
                                        <>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Target</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">Real</TableHead>
                                            <TableHead className="text-[10px] font-semibold py-1 text-center border-r">%</TableHead>
                                        </>
                                    )}
                                    {/* Total */}
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
                                {filteredPrograms.map((row, i) => {
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/30">
                                            <TableCell className="text-[11px] py-2 text-center border-r">{row["NO"] || (i + 1)}</TableCell>
                                            <TableCell className="text-[11px] py-2 border-r font-medium line-clamp-3" title={row["NAMA PROGRAM"]}>{row["NAMA PROGRAM"]?.length > 70 ? row["NAMA PROGRAM"].substring(0, 70) + "..." : row["NAMA PROGRAM"]}</TableCell>
                                            <TableCell className="text-[11px] py-2 text-center border-r">{row["KATEGORI"]}</TableCell>
                                            <TableCell className="text-[11px] py-2 text-center border-r">
                                                <Badge variant="outline" className="text-[9px]">{row["RISIKO"]}</Badge>
                                            </TableCell>

                                            {/* Bogor */}
                                            {(filterULTG === "ALL" || filterULTG === "BOGOR") && (
                                                <>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono">{row["TARGET ULTG BOGOR"] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono text-emerald-500">{row["REALISASI ULTG BOGOR"] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r">{row["PRESENTASE ULTG BOGOR"] || "0%"}</TableCell>
                                                </>
                                            )}

                                            {/* Sukabumi */}
                                            {(filterULTG === "ALL" || filterULTG === "SUKABUMI") && (
                                                <>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono">{row["TARGET ULTG SUKABUMI"] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono text-emerald-500">{row["REALISASI ULTG SUKABUMI"] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r">{row["PRESENTASE ULTG SUKABUMI"] || "0%"}</TableCell>
                                                </>
                                            )}

                                            {/* Total */}
                                            {filterULTG === "ALL" && (
                                                <>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono bg-muted/10">{row["TOTAL TARGET"] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r font-mono text-emerald-600 bg-muted/10">{row["TOTAL REALISASI"] || "0"}</TableCell>
                                                    <TableCell className="text-[11px] py-2 text-center border-r bg-muted/10">{row["PRESENTASE"] || "0%"}</TableCell>
                                                </>
                                            )}

                                            <TableCell className="text-[11px] py-2 text-center truncate max-w-[120px]" title={row["PELAKSANA"]}>{row["PELAKSANA"] || "-"}</TableCell>
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
