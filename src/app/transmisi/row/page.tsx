"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import {
    TreePine, Filter, RefreshCw, MapPin, Search, BarChart3,
    AlertTriangle, XCircle, ShieldAlert, CheckCircle2, Building2, Zap, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

import { getVal, getNum } from "@/lib/getVal";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
    red: "#ef4444", green: "#22c55e", yellow: "#eab308", lime: "#a3e635",
    sky: "#38bdf8", violet: "#8b5cf6",
};

/* echartBase removed — colors now come from useChartTheme() */

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
    "KRITIS": { label: "Kritis", color: C.red, icon: XCircle },
    "BAHAYA_I": { label: "Bahaya I", color: C.orange, icon: ShieldAlert },
    "BAHAYA_II": { label: "Bahaya II", color: C.amber, icon: AlertTriangle },
    "NORMAL": { label: "Normal", color: C.emerald, icon: CheckCircle2 },
};

interface RowData {
    no: string;
    span: string;
    ultg: string;
    gi: string;
    penghantar: string;
    tipe: string;
    posisi: string;
    tinggi: string;
    jml: number;
    status: string;
    prediksi: string;
    pemilik: string;
    kepemilikan: string;
    tindakLanjut: string;
    keterangan: string;
}

/** Parse raw BQ row → typed RowData (case-insensitive column access) */
function parseRowToROW(r: Record<string, string>): RowData {
    return {
        no: getVal(r, "ID"),
        span: getVal(r, "SPAN"),
        ultg: getVal(r, "ULTG"),
        gi: getVal(r, "GARDU INDUK"),
        penghantar: getVal(r, "PENGHANTAR"),
        tipe: getVal(r, "TIPE"),
        posisi: getVal(r, "POSISI"),
        tinggi: getVal(r, "TINGGI (M)"),
        jml: getNum(r, "JML"),
        status: getVal(r, "STATUS"),
        prediksi: getVal(r, "PREDIKSI"),
        pemilik: getVal(r, "PEMILIK"),
        kepemilikan: getVal(r, "KEPEMILIKAN"),
        tindakLanjut: getVal(r, "TINDAK LANJUT"),
        keterangan: getVal(r, "KET."),
    };
}

export default function RowPage() {
    const theme = useChartTheme();
    const { sheets, loading, error } = usePageData("/transmisi/row");
    const rawData = useMemo(() => sheets[0]?.rows || [], [sheets]);

    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterPenghantar, setFilterPenghantar] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [filterTipe, setFilterTipe] = useState<string | null>(null);
    const [searchSpan, setSearchSpan] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 25;

    const rows: RowData[] = useMemo(() =>
        rawData.map(parseRowToROW).filter(r => r.span.length > 0),
        [rawData]);

    // Filter options
    const ultgList = useMemo(() => [...new Set(rows.map(r => r.ultg))].filter(Boolean).sort(), [rows]);
    const pengList = useMemo(() => {
        let d = rows;
        if (filterULTG) d = d.filter(r => r.ultg === filterULTG);
        return [...new Set(d.map(r => r.penghantar))].filter(Boolean).sort();
    }, [rows, filterULTG]);
    const tipeList = useMemo(() => [...new Set(rows.map(r => r.tipe))].filter(Boolean).sort(), [rows]);

    const filtered = useMemo(() => {
        let data = rows;
        if (filterULTG) data = data.filter(r => r.ultg === filterULTG);
        if (filterPenghantar) data = data.filter(r => r.penghantar === filterPenghantar);
        if (filterStatus) data = data.filter(r => r.status === filterStatus);
        if (filterTipe) data = data.filter(r => r.tipe === filterTipe);
        if (searchSpan) data = data.filter(r =>
            r.span.toLowerCase().includes(searchSpan.toLowerCase()));
        return data;
    }, [rows, filterULTG, filterPenghantar, filterStatus, filterTipe, searchSpan]);

    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterPenghantar(null);
        setFilterStatus(null); setFilterTipe(null);
        setSearchSpan(""); setPage(0);
    }, []);

    const hasFilters = filterULTG || filterPenghantar || filterStatus || filterTipe || searchSpan;

    // ────── KPIs ──────
    const totalData = filtered.length;
    const totalPohon = useMemo(() => filtered.reduce((s, r) => s + r.jml, 0), [filtered]);
    const statusCounts = useMemo(() => {
        const c: Record<string, number> = {};
        filtered.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
        return c;
    }, [filtered]);
    const statusPohonCounts = useMemo(() => {
        const c: Record<string, number> = {};
        filtered.forEach(r => { c[r.status] = (c[r.status] || 0) + r.jml; });
        return c;
    }, [filtered]);

    // ────── Charts ──────

    // 1. Status donut
    const statusDonutOption = useMemo(() => {
        const statusOrder = ["KRITIS", "BAHAYA_I", "BAHAYA_II", "NORMAL"];
        const total = statusOrder.reduce((s, k) => s + (statusCounts[k] || 0), 0);
        const data = statusOrder
            .filter(s => (statusCounts[s] || 0) > 0)
            .map(s => ({
                name: STATUS_CONFIG[s]?.label || s,
                value: statusCounts[s] || 0,
                itemStyle: { color: STATUS_CONFIG[s]?.color || C.indigo },
            }));

        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "item" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText },
                formatter: "{b}: {c} data ({d}%)",
            },
            legend: {
                orient: "horizontal" as const,
                bottom: 0,
                itemWidth: 10, itemHeight: 10, itemGap: 14,
                textStyle: { color: theme.text, fontSize: 10 },
                formatter: (name: string) => {
                    const item = data.find(d => d.name === name);
                    const pct = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                    return `${name}  ${item?.value?.toLocaleString() || 0}  (${pct}%)`;
                },
            },
            graphic: [{
                type: "text" as const,
                left: "center",
                top: "38%",
                style: {
                    text: totalData.toLocaleString(),
                    fontSize: 28, fontWeight: "bold" as const,
                    fill: theme.emphasisText,
                    textAlign: "center" as const,
                },
            }, {
                type: "text" as const,
                left: "center",
                top: "50%",
                style: {
                    text: "data",
                    fontSize: 11,
                    fill: theme.textMuted,
                    textAlign: "center" as const,
                },
            }],
            series: [{
                type: "pie" as const,
                radius: ["44%", "70%"],
                center: ["50%", "45%"],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: false },
                emphasis: { scaleSize: 4 },
                data,
            }],
            animationType: "scale",
            animationDuration: 1000,
        };
    }, [statusCounts, totalData, theme]);

    // 2. Pohon count donut (by status - jumlah pohon)
    const pohonDonutOption = useMemo(() => {
        const statusOrder = ["KRITIS", "BAHAYA_I", "BAHAYA_II", "NORMAL"];
        const data = statusOrder
            .filter(s => (statusPohonCounts[s] || 0) > 0)
            .map(s => ({
                name: STATUS_CONFIG[s]?.label || s,
                value: statusPohonCounts[s] || 0,
                itemStyle: { color: STATUS_CONFIG[s]?.color || C.indigo },
            }));

        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "item" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText },
                formatter: "{b}: {c} pohon ({d}%)",
            },
            legend: {
                orient: "horizontal" as const,
                bottom: 0,
                itemWidth: 10, itemHeight: 10, itemGap: 14,
                textStyle: { color: theme.text, fontSize: 10 },
                formatter: (name: string) => {
                    const item = data.find(d => d.name === name);
                    const pct = totalPohon > 0 ? ((item?.value || 0) / totalPohon * 100).toFixed(0) : 0;
                    return `${name}  ${item?.value?.toLocaleString() || 0}  (${pct}%)`;
                },
            },
            graphic: [{
                type: "text" as const,
                left: "center",
                top: "38%",
                style: {
                    text: totalPohon.toLocaleString(),
                    fontSize: 24, fontWeight: "bold" as const,
                    fill: theme.emphasisText,
                    textAlign: "center" as const,
                },
            }, {
                type: "text" as const,
                left: "center",
                top: "50%",
                style: {
                    text: "pohon",
                    fontSize: 11,
                    fill: theme.textMuted,
                    textAlign: "center" as const,
                },
            }],
            series: [{
                type: "pie" as const,
                radius: ["44%", "70%"],
                center: ["50%", "45%"],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: false },
                emphasis: { scaleSize: 4 },
                data,
            }],
            animationType: "scale",
            animationDuration: 1000,
        };
    }, [statusPohonCounts, totalPohon, theme]);

    // 3. Status per Penghantar stacked bar
    const statusPerPeng = useMemo(() => {
        const pengMap: Record<string, Record<string, number>> = {};
        filtered.forEach(r => {
            if (!pengMap[r.penghantar]) pengMap[r.penghantar] = {};
            pengMap[r.penghantar][r.status] = (pengMap[r.penghantar][r.status] || 0) + 1;
        });
        const pengs = Object.keys(pengMap).sort();
        const statusOrder = ["KRITIS", "BAHAYA_I", "BAHAYA_II", "NORMAL"];
        return { pengs, statusOrder, pengMap };
    }, [filtered]);

    const stackedPengOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontSize: 11 },
        },
        legend: {
            data: statusPerPeng.statusOrder.map(s => STATUS_CONFIG[s]?.label || s),
            textStyle: { color: theme.textMuted, fontSize: 10 },
            bottom: 0,
            itemWidth: 10, itemHeight: 10,
        },
        grid: { top: 10, right: 16, bottom: 40, left: 240 },
        yAxis: {
            type: "category" as const,
            data: statusPerPeng.pengs,
            axisLabel: {
                fontSize: 9, color: theme.text, width: 230,
                overflow: "truncate" as const, ellipsis: "…",
            },
            axisLine: { show: false },
            axisTick: { show: false },
        },
        xAxis: {
            type: "value" as const,
            axisLabel: { fontSize: 10, color: theme.textMuted },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
        },
        series: statusPerPeng.statusOrder.map(s => ({
            name: STATUS_CONFIG[s]?.label || s,
            type: "bar" as const,
            stack: "total",
            barWidth: 18,
            emphasis: { focus: "series" as const },
            itemStyle: { color: STATUS_CONFIG[s]?.color || C.indigo, borderRadius: 0 },
            data: statusPerPeng.pengs.map(p => statusPerPeng.pengMap[p]?.[s] || 0),
        })),
        animationDuration: 1000,
    }), [statusPerPeng, theme]);

    // 4. Tree type distribution
    const tipeData = useMemo(() => {
        const tipeMap: Record<string, number> = {};
        filtered.forEach(r => {
            if (r.tipe) tipeMap[r.tipe] = (tipeMap[r.tipe] || 0) + 1;
        });
        return Object.entries(tipeMap)
            .map(([tipe, count]) => ({ tipe, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);
    }, [filtered]);

    const tipeBarOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontSize: 11 },
        },
        grid: { top: 8, right: 50, bottom: 8, left: 140 },
        yAxis: {
            type: "category" as const,
            data: [...tipeData].reverse().map(t => t.tipe),
            axisLabel: { fontSize: 10, color: theme.text },
            axisLine: { show: false },
            axisTick: { show: false },
        },
        xAxis: {
            type: "value" as const,
            axisLabel: { fontSize: 10, color: theme.textMuted },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            axisLine: { show: false },
        },
        series: [{
            type: "bar" as const,
            data: [...tipeData].reverse().map((t, i) => ({
                value: t.count,
                itemStyle: {
                    color: {
                        type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: [
                            { offset: 0, color: `hsl(${140 + i * 12}, 60%, 30%)` },
                            { offset: 1, color: `hsl(${140 + i * 12}, 70%, 50%)` },
                        ],
                    },
                    borderRadius: [0, 6, 6, 0],
                },
            })),
            barWidth: 16,
            label: {
                show: true, position: "right" as const,
                fontSize: 10, fontWeight: "bold" as const, color: theme.text,
            },
            showBackground: true,
            backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
        }],
        animationDuration: 1200,
    }), [tipeData, theme]);

    // 5. Posisi distribution
    const posisiData = useMemo(() => {
        const m: Record<string, number> = {};
        filtered.forEach(r => {
            if (r.posisi) m[r.posisi] = (m[r.posisi] || 0) + r.jml;
        });
        return Object.entries(m).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value);
    }, [filtered]);

    const posisiOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "item" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText },
            formatter: "{b}: {c} ({d}%)",
        },
        legend: {
            orient: "horizontal" as const,
            bottom: 0,
            itemWidth: 10, itemHeight: 10, itemGap: 14,
            textStyle: { color: theme.text, fontSize: 10 },
            formatter: (name: string) => {
                const item = posisiData.find(d => d.name === name);
                const total = posisiData.reduce((s, d) => s + d.value, 0);
                const pct = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                return `${name}  ${item?.value?.toLocaleString() || 0}  (${pct}%)`;
            },
        },
        series: [{
            type: "pie" as const,
            radius: ["44%", "70%"],
            center: ["50%", "45%"],
            padAngle: 3,
            itemStyle: { borderRadius: 6 },
            label: { show: false },
            emphasis: { scaleSize: 4 },
            data: posisiData.map((d, i) => ({
                ...d,
                itemStyle: { color: [C.cyan, C.amber, C.purple, C.pink][i % 4] },
            })),
        }],
        animationType: "scale",
        animationDuration: 1000,
    }), [posisiData, theme]);

    // 5b. Top 3 Jenis Pohon pie
    const top3Tipe = useMemo(() => {
        const tipeMap: Record<string, number> = {};
        filtered.forEach(r => {
            if (r.tipe) tipeMap[r.tipe] = (tipeMap[r.tipe] || 0) + r.jml;
        });
        const sorted = Object.entries(tipeMap)
            .map(([tipe, count]) => ({ tipe, count }))
            .sort((a, b) => b.count - a.count);
        const top = sorted.slice(0, 3);
        const rest = sorted.slice(3).reduce((s, t) => s + t.count, 0);
        if (rest > 0) top.push({ tipe: "Lainnya", count: rest });
        return top;
    }, [filtered]);

    const top3Colors = [C.emerald, C.amber, C.cyan, C.purple];

    const top3TipeOption = useMemo(() => {
        const total = top3Tipe.reduce((s, t) => s + t.count, 0);
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "item" as const,
                backgroundColor: theme.tooltipBg,
                borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText },
                formatter: "{b}: {c} pohon ({d}%)",
            },
            legend: {
                orient: "horizontal" as const,
                bottom: 0,
                itemWidth: 10, itemHeight: 10, itemGap: 12,
                textStyle: { color: theme.text, fontSize: 10 },
                formatter: (name: string) => {
                    const item = top3Tipe.find(t => t.tipe === name);
                    const pct = total > 0 ? ((item?.count || 0) / total * 100).toFixed(0) : 0;
                    return `${name}  ${(item?.count || 0).toLocaleString()}  (${pct}%)`;
                },
            },
            series: [{
                type: "pie" as const,
                radius: ["44%", "70%"],
                center: ["50%", "42%"],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: false },
                emphasis: { scaleSize: 4 },
                data: top3Tipe.map((t, i) => ({
                    name: t.tipe,
                    value: t.count,
                    itemStyle: { color: top3Colors[i % top3Colors.length] },
                })),
            }],
            animationType: "scale",
            animationDuration: 1000,
        };
    }, [top3Tipe, theme]);

    // 5b. Bahaya by Posisi per Penghantar (B1/B2/Kritis di bawah vs di samping)
    const bahayaPosisiData = useMemo(() => {
        const dangerStatuses = ["KRITIS", "BAHAYA_I", "BAHAYA_II"];
        const pengMap: Record<string, Record<string, number>> = {};
        filtered.forEach(r => {
            if (!dangerStatuses.includes(r.status)) return;
            if (!pengMap[r.penghantar]) pengMap[r.penghantar] = {};
            const posKey = r.posisi || "LAINNYA";
            pengMap[r.penghantar][posKey] = (pengMap[r.penghantar][posKey] || 0) + r.jml;
        });
        const pengs = Object.entries(pengMap)
            .map(([peng, posMap]) => ({ peng, total: Object.values(posMap).reduce((a, b) => a + b, 0), posMap }))
            .sort((a, b) => b.total - a.total);
        const allPos = [...new Set(pengs.flatMap(p => Object.keys(p.posMap)))].sort();
        return { pengs, allPos };
    }, [filtered]);

    const posColors: Record<string, string> = { "DI DALAM": C.red, "DI SAMPING": C.amber, "DI ATAS": C.orange, "LAINNYA": C.purple };

    const bahayaPosisiOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
            trigger: "axis" as const,
            backgroundColor: theme.tooltipBg,
            borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontSize: 11 },
        },
        legend: {
            data: bahayaPosisiData.allPos,
            textStyle: { color: theme.textMuted, fontSize: 10 },
            bottom: 0,
            itemWidth: 10, itemHeight: 10,
        },
        grid: { top: 10, right: 60, bottom: 40, left: 240 },
        yAxis: {
            type: "category" as const,
            data: bahayaPosisiData.pengs.map(p => p.peng),
            axisLabel: {
                fontSize: 9, color: theme.text, width: 230,
                overflow: "truncate" as const, ellipsis: "…",
            },
            axisLine: { show: false },
            axisTick: { show: false },
        },
        xAxis: {
            type: "value" as const,
            axisLabel: { fontSize: 10, color: theme.textMuted },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
        },
        series: bahayaPosisiData.allPos.map(pos => ({
            name: pos,
            type: "bar" as const,
            stack: "total",
            barWidth: 18,
            emphasis: { focus: "series" as const },
            itemStyle: { color: posColors[pos] || C.purple },
            label: { show: false },
            data: bahayaPosisiData.pengs.map(p => p.posMap[pos] || 0),
        })),
        animationDuration: 1000,
    }), [bahayaPosisiData, theme]);

    // 6. Pohon per Penghantar (jumlah pohon)
    const pohonPerPeng = useMemo(() => {
        const m: Record<string, number> = {};
        filtered.forEach(r => {
            m[r.penghantar] = (m[r.penghantar] || 0) + r.jml;
        });
        return Object.entries(m)
            .map(([peng, count]) => ({ peng, count }))
            .sort((a, b) => a.count - b.count);
    }, [filtered]);

    const pohonPengOption = useMemo(() => ({
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
                return `<b style="color:${theme.emphasisText}">${p.name}</b><br/>Jumlah Pohon: <b>${p.value.toLocaleString()}</b>`;
            },
        },
        grid: { top: 8, right: 70, bottom: 8, left: 240 },
        yAxis: {
            type: "category" as const,
            data: pohonPerPeng.map(p => p.peng),
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
            axisLabel: { fontSize: 10, color: theme.textMuted },
            splitLine: { lineStyle: { color: theme.gridLine, type: "dashed" as const } },
            axisLine: { show: false },
        },
        series: [{
            type: "bar" as const,
            data: pohonPerPeng.map((p, i) => ({
                value: p.count,
                itemStyle: {
                    color: {
                        type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: [
                            { offset: 0, color: `hsl(${160 - i * 5}, 50%, 30%)` },
                            { offset: 1, color: `hsl(${160 - i * 5}, 65%, 50%)` },
                        ],
                    },
                    borderRadius: [0, 6, 6, 0],
                },
            })),
            barWidth: 16,
            label: {
                show: true, position: "right" as const,
                fontSize: 10, fontWeight: "bold" as const, color: theme.text,
                formatter: (p: { value: number }) => p.value.toLocaleString(),
            },
            showBackground: true,
            backgroundStyle: { color: "rgba(255,255,255,0.03)", borderRadius: [0, 6, 6, 0] },
        }],
        animationDuration: 1200,
    }), [pohonPerPeng, theme]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => { setPage(0); }, [filterULTG, filterPenghantar, filterStatus, filterTipe, searchSpan]);

    if (loading) return (
        <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <div className="grid grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
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
                        <TreePine className="h-6 w-6 text-primary" />
                        Kondisi ROW Transmisi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Data kondisi Right of Way — {rows.length.toLocaleString()} data
                        {hasFilters && ` (menampilkan ${filtered.length.toLocaleString()})`}
                    </p>
                </div>
                <DataFreshness />
            </div>

            {/* ───── KPI Cards: Pohon Counts ───── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {[
                    { label: "Total Pohon", value: totalPohon.toLocaleString(), sub: `${totalData.toLocaleString()} data`, icon: TreePine, color: C.indigo, glow: "rgba(129,140,248,0.15)" },
                    { label: "Kritis", value: (statusPohonCounts["KRITIS"] || 0).toLocaleString(), sub: `${(statusCounts["KRITIS"] || 0).toLocaleString()} data`, icon: XCircle, color: C.red, glow: "rgba(239,68,68,0.15)" },
                    { label: "Bahaya I", value: (statusPohonCounts["BAHAYA_I"] || 0).toLocaleString(), sub: `${(statusCounts["BAHAYA_I"] || 0).toLocaleString()} data`, icon: ShieldAlert, color: C.orange, glow: "rgba(251,146,60,0.15)" },
                    { label: "Bahaya II", value: (statusPohonCounts["BAHAYA_II"] || 0).toLocaleString(), sub: `${(statusCounts["BAHAYA_II"] || 0).toLocaleString()} data`, icon: AlertTriangle, color: C.amber, glow: "rgba(251,191,36,0.15)" },
                    { label: "Normal", value: (statusPohonCounts["NORMAL"] || 0).toLocaleString(), sub: `${(statusCounts["NORMAL"] || 0).toLocaleString()} data`, icon: CheckCircle2, color: C.emerald, glow: "rgba(52,211,153,0.15)" },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-sm transition-all duration-200">
                            <div className="absolute inset-0 opacity-30"
                                style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.glow}, transparent 60%)` }} />
                            <CardContent className="p-3 relative z-10">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xl font-bold">{kpi.value}</p>
                                        <p className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: kpi.color }}>
                                            {kpi.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
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

                        <SelectNative value={filterULTG || ""} onChange={e => { setFilterULTG(e.target.value || null); setFilterPenghantar(null); }}>
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>

                        <SelectNative value={filterPenghantar || ""} onChange={e => setFilterPenghantar(e.target.value || null)} className="max-w-[220px]">
                            <option value="">Semua Penghantar</option>
                            {pengList.map(p => <option key={p} value={p}>{p}</option>)}
                        </SelectNative>

                        <SelectNative value={filterStatus || ""} onChange={e => setFilterStatus(e.target.value || null)}>
                            <option value="">Semua Status</option>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </SelectNative>

                        <SelectNative value={filterTipe || ""} onChange={e => setFilterTipe(e.target.value || null)}>
                            <option value="">Semua Tipe</option>
                            {tipeList.map(t => <option key={t} value={t}>{t}</option>)}
                        </SelectNative>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input type="text" value={searchSpan} onChange={e => setSearchSpan(e.target.value)}
                                placeholder="Cari span..."
                                className="h-8 pl-8 pr-2 text-xs w-44" />
                        </div>

                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                                <RefreshCw className="h-3 w-3" /> Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ───── Charts Row 1: Pohon Donut + Posisi Pie + Top 3 Jenis Pohon ───── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TreePine className="h-4 w-4 text-primary" /> Jumlah Pohon per Status
                            <Badge variant="secondary" className="ml-auto text-xs">by pohon</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={pohonDonutOption} style={{ height: 320 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" /> Posisi Pohon
                            <Badge variant="secondary" className="ml-auto text-xs">by pohon</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={posisiOption} style={{ height: 320 }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TreePine className="h-4 w-4 text-primary" /> Top 3 Jenis Pohon
                            <Badge variant="secondary" className="ml-auto text-xs">by jumlah</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={top3TipeOption} style={{ height: 320 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Charts Row 2: Status per Penghantar + Bahaya by Posisi ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" /> Status ROW per Penghantar
                            <Badge variant="secondary" className="ml-auto text-xs">{statusPerPeng.pengs.length} penghantar</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={stackedPengOption} style={{ height: Math.max(300, statusPerPeng.pengs.length * 32) }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-destructive" /> Pohon B1/B2/Kritis per Posisi
                            <Badge variant="secondary" className="ml-auto text-xs">{bahayaPosisiData.pengs.length} penghantar</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={bahayaPosisiOption} style={{ height: Math.max(300, bahayaPosisiData.pengs.length * 32) }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Charts Row 3: Tipe Pohon + Pohon per Penghantar ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TreePine className="h-4 w-4 text-primary" /> Jenis Pohon Terbanyak
                            <Badge variant="secondary" className="ml-auto text-xs">Top 15</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={tipeBarOption} style={{ height: Math.max(300, tipeData.length * 28) }} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Jumlah Pohon per Penghantar
                            <Badge variant="secondary" className="ml-auto text-xs">{pohonPerPeng.length} penghantar</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={pohonPengOption} style={{ height: Math.max(300, pohonPerPeng.length * 28) }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── Data Table ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Data Kondisi ROW
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {filtered.length.toLocaleString()} data — Hal {page + 1}/{totalPages || 1}
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
                                    <TableHead>Span</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead className="text-center">Posisi</TableHead>
                                    <TableHead className="text-right">Jml</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead>Prediksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => {
                                    const sc = STATUS_CONFIG[r.status];
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground text-xs">{page * PAGE_SIZE + i + 1}</TableCell>
                                            <TableCell className="text-xs">
                                                <Badge variant="outline" className="text-xs px-1 py-0">{r.ultg}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{r.gi}</TableCell>
                                            <TableCell className="font-medium text-xs whitespace-nowrap">{r.span}</TableCell>
                                            <TableCell className="text-xs">{r.tipe}</TableCell>
                                            <TableCell className="text-center text-xs">
                                                <Badge variant="outline" className="text-xs px-1 py-0">{r.posisi || "-"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-semibold">{r.jml.toLocaleString()}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="text-xs px-1.5 py-0"
                                                    style={{
                                                        backgroundColor: `${sc?.color || C.indigo}20`,
                                                        color: sc?.color || C.indigo,
                                                        border: `1px solid ${sc?.color || C.indigo}30`,
                                                    }}>
                                                    {sc?.label || r.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{r.prediksi}</TableCell>
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
