"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AlertCircle, FileText, CheckCircle2, TrendingUp, Info } from "lucide-react";
import ReactECharts from "echarts-for-react";

export const echartBase = {
    backgroundColor: "transparent",
    textStyle: {
        fontFamily: "Inter, sans-serif",
        color: "#d4d4d8",
    },
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#fbbf24", "#f43f5e", "#8b5cf6", "#06b6d4"];

export function CETabContent({ sheetData }: { sheetData: any }) {
    // 1. Core Data
    const { name, headers = [], rows = [] } = sheetData;
    const totalRows = rows.length;

    // 2. Data Discovery: Find a Status Column (Kondisi/Status)
    const statusColumn = headers.find((h: string) => h.toLowerCase().includes("kondisi") || h.toLowerCase().includes("status"));

    // 3. Data Discovery: Find a Category Column (Uraian/Jenis/Kategori)
    const categoryColumn = headers.find((h: string) => 
        h.toLowerCase().includes("uraian") || 
        h.toLowerCase().includes("jenis") || 
        h.toLowerCase().includes("kategori")
    ) || (headers.length > 0 ? headers[0] : null);

    // 4. Data Discovery: Find Location Column (ULTG/Gardu Induk)
    const locationColumn = headers.find((h: string) => h.toLowerCase().includes("ultg"));


    // 5. Calculate Metrics
    const statusCounts = useMemo(() => {
        if (!statusColumn) return [];
        const counts: Record<string, number> = {};
        rows.forEach((r: any) => {
            const val = r[statusColumn] || "Unknown";
            counts[val] = (counts[val] || 0) + 1;
        });
        
        return Object.entries(counts)
            .map(([k, v]) => ({ name: k, value: v }))
            .sort((a, b) => b.value - a.value); // Descending
    }, [rows, statusColumn]);

    const findCriticalCount = () => {
        if (!statusColumn) return 0;
        return statusCounts.filter(s => s.name.toLowerCase().includes("critical") || s.name.includes("5-")).reduce((acc, curr) => acc + curr.value, 0);
    };
    
    const criticalCount = findCriticalCount();

    const categoryCounts = useMemo(() => {
        if (!categoryColumn) return [];
        const counts: Record<string, number> = {};
        rows.forEach((r: any) => {
            const val = r[categoryColumn] || "TBD";
            counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([k, v]) => ({ name: k, value: v }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Take top 5
    }, [rows, categoryColumn]);

    // 6. Echarts: Premium Donut Option
    const donutOption = useMemo(() => {
        if (statusCounts.length === 0) return null;
        return {
            ...echartBase,
            tooltip: { trigger: 'item' },
            legend: { show: false }, // Use labelLine instead of Legend to prevent overlap (Rule adherence)
            graphic: [{
                type: "text", left: "center", top: "36%",
                style: { text: `${totalRows}`, fontSize: 30, fontWeight: "bold", fill: "#d4d4d8" }
            }, {
                type: "text", left: "center", top: "50%",
                style: { text: "Total Isu", fontSize: 12, fill: "#a1a1aa" }
            }],
            series: [{
                type: "pie",
                radius: ["40%", "68%"],
                center: ["50%", "45%"],
                padAngle: 2,
                itemStyle: { borderRadius: 6 },
                data: statusCounts.map((d, i) => ({
                    ...d,
                    itemStyle: { 
                        color: CHART_COLORS[i % CHART_COLORS.length]
                    }
                })),
                label: {
                    show: true,
                    formatter: "{name|{b}}\n{val|{c}} ({pct|{d}%})",
                    rich: {
                        name: { fontSize: 12, fontWeight: "bold", color: "#d4d4d8" },
                        val: { fontSize: 12, color: "#fbbf24", fontWeight: "bold" },
                        pct: { fontSize: 11, color: "#d4d4d8" }
                    }
                },
                labelLine: { show: true, length: 15, length2: 12, smooth: 0.3, lineStyle: { color: "#a1a1aa", width: 1.5 } }
            }]
        };
    }, [statusCounts, totalRows]);

    // 7. Echarts: Horizontal Bar Option
    const barOption = useMemo(() => {
        if (categoryCounts.length === 0) return null;
        return {
            ...echartBase,
            tooltip: { 
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            grid: { top: 10, right: 30, bottom: 20, left: 120, containLabel: true },
            xAxis: { 
                type: 'value',
                splitLine: { lineStyle: { color: '#3f3f46', type: 'dashed' } }
            },
            yAxis: { 
                type: 'category',
                data: categoryCounts.map(c => c.name).reverse(),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: '#d4d4d8', width: 110, overflow: 'truncate' }
            },
            series: [{
                type: 'bar',
                data: categoryCounts.map(c => c.value).reverse(),
                itemStyle: {
                    color: '#3b82f6',
                    borderRadius: [0, 4, 4, 0]
                },
                label: {
                    show: true,
                    position: 'right',
                    color: '#d4d4d8'
                }
            }]
        };
    }, [categoryCounts]);


    // Badge helper func
    const getStatusBadge = (value: string) => {
        const lower = value.toLowerCase();
        if (lower.includes("critical") || lower.includes("5-")) {
            return <Badge variant="destructive">{value}</Badge>;
        }
        if (lower.includes("poor") || lower.includes("4-")) {
            return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-transparent">{value}</Badge>;
        }
        if (lower.includes("fair") || lower.includes("3-")) {
            return <Badge className="bg-amber-400 hover:bg-amber-500 text-zinc-900 border-transparent">{value}</Badge>;
        }
        // default 
        return <Badge variant="secondary">{value || "-"}</Badge>;
    };

    return (
        <div className="flex flex-col gap-6">
            
            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Isu Terdata</CardTitle>
                        <FileText className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalRows}</div>
                        <p className="text-xs text-muted-foreground mt-1">Baris inspeksi dari sheet terhubung</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status Peringatan (Critical)</CardTitle>
                        <AlertCircle className="size-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Membutuhkan perbaikan segera
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Komponen Unik {locationColumn ? " (Area)" : ""}</CardTitle>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {locationColumn ? new Set(rows.map((r: any) => r[locationColumn])).size : headers.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {locationColumn ? `Sebaran berdasar ${locationColumn}` : "Total kolom terpantau"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Visual Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="size-4" /> Distribusi Kondisi
                        </CardTitle>
                        <CardDescription>
                            {statusColumn ? `Berdasarkan kolom "${statusColumn}"` : "Kolom data kondisi tidak ditemukan"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[25vh] flex items-center justify-center -mt-4">
                        {donutOption ? (
                            <ReactECharts option={donutOption} style={{ height: "100%", width: "100%" }} />
                        ) : (
                            <div className="text-sm text-muted-foreground text-center flex flex-col items-center gap-2">
                                <Info className="size-8 opacity-20" />
                                <span>Membutuhkan kolom bernama "Kondisi" atau "Status" di Data Connector</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                <Card className="flex flex-col lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="size-4" /> Top Isu Transmisi
                        </CardTitle>
                        <CardDescription>
                            {categoryColumn ? `Top 5 temuan berdasarkan "${categoryColumn}"` : "Informasi kategori tidak ditemukan"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[25vh] flex flex-col justify-center">
                        {barOption ? (
                            <ReactECharts option={barOption} style={{ height: "100%", width: "100%" }} />
                        ) : (
                            <div className="text-sm text-muted-foreground text-center">
                                Menunggu data dengan kolom kategori.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        Basis Tabel Data: {name}
                    </CardTitle>
                    <CardDescription>
                        Visualisasi rekapan lengkap beserta rencana tindak lanjut.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="border-t border-border overflow-hidden">
                        <div className="overflow-x-auto max-h-[55vh]">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="px-4 py-3 font-medium border-b border-border w-12 text-center">No</th>
                                        {headers.map((header: string) => (
                                            <th key={header} className="px-5 py-3 font-medium border-b border-border whitespace-nowrap">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs">
                                    {rows.length > 0 ? (
                                        rows.map((row: any, i: number) => (
                                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 text-center text-muted-foreground">{i + 1}</td>
                                                {headers.map((header: string) => {
                                                    const isStatus = header === statusColumn;
                                                    return (
                                                        <td key={header} className="px-5 py-3 max-w-[280px] truncate" title={String(row[header] || "")}>
                                                            {isStatus ? getStatusBadge(String(row[header] || "")) : String(row[header] || "-")}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={1 + headers.length} className="px-4 py-12 text-center text-muted-foreground">
                                                Tidak ada data barangan yang ditarik.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
