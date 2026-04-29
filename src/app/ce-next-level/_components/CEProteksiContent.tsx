"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, AlertCircle, RefreshCw, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Search, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme } from "next-themes";
import {
    ECHART_COLORS,
    ECHART_FONT,
    CHART,
    getTooltipPreset,
    COLORS as GLOBAL_COLORS,
    FM_COLLAPSE,
} from "@/lib/chart-tokens";
import { useMkDonut } from "./ce-donut-factory";
import { StatusKpiBar1 } from "@/components/shared/StatusKpiBar1";
import { SummaryCard1 } from "@/components/shared/SummaryCard1";
import { parse, isValid, isBefore, isToday } from "date-fns";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ── Column Constants ── */
const H = {
    PROGRAM: "PROGRAM",
    GI: "GARDU INDUK",
    BAY: "BAY",
    ALAT: "ALAT",
    RINCIAN: "RINCIAN",
    RENCANA: "RENCANA",
    REALISASI: "REALISASI",
    CLOSING: "CLOSING MANUAL",
    RENCANA_TL: "RENCANA TINDAKLANJUT UPT/ULTG",
} as const;

type Row = Record<string, string>;
type SortKey = string | null;
type SortDir = "asc" | "desc";

/* ── Label aliases for donut charts — shorter but meaningful ── */
const LABEL_ALIAS: Record<string, string> = {
    // PROGRAM
    "ANOMALI DESAIN PROTEKSI": "Desain Proteksi",
    "ANOMALI AHI PROTEKSI": "AHI Proteksi",
    "ANOMALI DESAIN CATU DAYA": "Desain Catu Daya",
    // RINCIAN
    "AKTIVASI AIDED DEF": "Aktivasi Aided DEF",
    "PENYERMPURNAAN DESAIN TRIPING 1 & 2": "Desain Triping 1&2",
    "4-Inspeksi Visual - Fungsi Pendukung : Anomali Display": "Anomali Display",
    "5-Inspeksi Visual - Fungsi Utama : Anomali mayor lainnya": "Anomali Mayor",
    "PENGGANTIAN RELAY NON NUMERIK / ELEKTROSTATIC": "Ganti Relay Non-Numerik",
    "2 - Terdapat 2 Sistem DC Redundant dilengkapi manual change over berasal dari 1 Trafo PS": "DC Redundant 1 Trafo",
};
const aliasLabel = (name: string) => LABEL_ALIAS[name] || name;

const TABLE_COLS: { key: string; label: string; center?: boolean; minW?: string; filterable: boolean }[] = [
    { key: H.PROGRAM, label: "Program", filterable: true },
    { key: H.GI, label: "Gardu Induk", filterable: true },
    { key: H.BAY, label: "Bay", filterable: false },
    { key: H.ALAT, label: "Alat", filterable: true },
    { key: H.RINCIAN, label: "Rincian", minW: "200px", filterable: false },
    { key: H.CLOSING, label: "Status", center: true, filterable: true },
    { key: H.RENCANA, label: "Rencana", center: true, filterable: false },
    { key: H.REALISASI, label: "Realisasi", center: true, filterable: false },
];

const ABBR = new Set(["ULTG", "AHI", "ROW", "GI", "PAB", "UPT"]);
const toTitleCase = (s: string) =>
    s.toLowerCase().replace(/\b\w+/g, w => {
        const up = w.toUpperCase();
        return ABBR.has(up) ? up : w.charAt(0).toUpperCase() + w.slice(1);
    });
const toUltgLabel = (name: string) => {
    const tc = toTitleCase(name);
    return tc.startsWith("ULTG") ? tc : `ULTG ${tc}`;
};

const parseCustomDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parsed = parse(dateStr, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) return parsed;
    const parsedUS = parse(dateStr, "MM/dd/yyyy", new Date());
    return isValid(parsedUS) ? parsedUS : null;
};

/* Chart palette — from global tokens */
const CHART_PALETTE = [
    GLOBAL_COLORS.chart.blue, GLOBAL_COLORS.chart.amber, GLOBAL_COLORS.chart.violet,
    GLOBAL_COLORS.chart.cyan, GLOBAL_COLORS.chart.pink, GLOBAL_COLORS.teal,
    GLOBAL_COLORS.statusHi["CRITICAL"], GLOBAL_COLORS.statusHi["POOR"],
    GLOBAL_COLORS.statusHi["VERY GOOD"], GLOBAL_COLORS.purple,
];
const COLOR_SELESAI = GLOBAL_COLORS.statusHi["VERY GOOD"];
const COLOR_DESTRUCTIVE = GLOBAL_COLORS.statusHi["CRITICAL"];

export function CEProteksiContent({ sheetData, giToUltgMap = {} }: { sheetData: any; giToUltgMap?: Record<string, string> }) {
    const rawRows: Row[] = sheetData?.rows || [];
    const allHeaders: string[] = sheetData?.headers || [];
    const { resolvedTheme } = useTheme();
    const themeKey = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";
    const ec = ECHART_COLORS[themeKey];

    /* ── Filter States ── */
    const [selectedGI, setSelectedGI] = useState<string | null>(null);
    const [selectedUltg, setSelectedUltg] = useState<string | null>(null);
    const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
    const [selectedRincian, setSelectedRincian] = useState<string | null>(null);
    const [selectedRowKey, setSelectedRowKey] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [isComboOpen, setIsComboOpen] = useState(false);
    const [doneFilter, setDoneFilter] = useState<boolean | null>(null);

    const [page, setPage] = useState(1);
    const PAGE_SIZE = 50;

    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const clearAllFilters = useCallback(() => {
        setSelectedGI(null); setSelectedUltg(null); setSelectedProgram(null);
        setSelectedRincian(null); setSelectedRowKey(null);
        setSearchQuery(""); setColumnFilters({}); setDoneFilter(null); setPage(1);
    }, []);
    const hasFilter = selectedGI || selectedUltg || selectedProgram || selectedRincian || searchQuery || doneFilter !== null || Object.values(columnFilters).some(v => v);

    /* Close = CLOSING MANUAL === "CLOSE" */
    const isDone = (r: Row) => (r[H.CLOSING] || "").toUpperCase().includes("CLOSE");

    /* ── Schedule Logic ── */
    const { todaySchedules, overdueSchedules } = useMemo(() => {
        const today: Row[] = [];
        const overdue: Row[] = [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        rawRows.forEach(r => {
            if (isDone(r)) return;
            const parsedRencana = parseCustomDate(r[H.RENCANA]);
            if (!parsedRencana) return;
            if (isToday(parsedRencana)) {
                today.push(r);
            } else if (isBefore(parsedRencana, startOfToday)) {
                overdue.push(r);
            }
        });
        return { todaySchedules: today, overdueSchedules: overdue };
    }, [rawRows]);

    /* ── Filter Engine ── */
    const filteredRows = useMemo(() => {
        let r = rawRows;
        if (doneFilter !== null) r = r.filter(x => isDone(x) === doneFilter);
        if (selectedGI) r = r.filter(x => x[H.GI] === selectedGI);
        if (selectedUltg) r = r.filter(x => { const g = (x[H.GI] || "").trim(); return (giToUltgMap[g] || giToUltgMap[g.replace(/\s+/g, "").toUpperCase()] || "Lainnya") === selectedUltg; });
        if (selectedProgram) r = r.filter(x => x[H.PROGRAM] === selectedProgram);
        if (selectedRincian) r = r.filter(x => x[H.RINCIAN] === selectedRincian);

        if (sortKey) {
            r = [...r].sort((a, b) => {
                const va = (a[sortKey] || "").toLowerCase();
                const vb = (b[sortKey] || "").toLowerCase();
                const cmp = va.localeCompare(vb, "id", { numeric: true });
                return sortDir === "asc" ? cmp : -cmp;
            });
        }
        return r;
    }, [rawRows, doneFilter, selectedGI, selectedUltg, selectedProgram, selectedRincian, sortKey, sortDir, giToUltgMap]);

    /* ── Table Rows ── */
    const tableRows = useMemo(() => {
        let r = filteredRows;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            r = r.filter(row => Object.values(row).some(v => (v || "").toLowerCase().includes(q)));
        }
        Object.entries(columnFilters).forEach(([key, val]) => {
            if (val) r = r.filter(row => row[key] === val);
        });
        return r;
    }, [filteredRows, searchQuery, columnFilters]);

    const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
    const paginatedRows = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return tableRows.slice(start, start + PAGE_SIZE);
    }, [tableRows, page]);

    useEffect(() => { setPage(1); }, [tableRows.length]);

    /* ── ULTG lookup helper ── */
    const getUltg = useCallback((r: Row) => {
        const g = (r[H.GI] || "").trim();
        return giToUltgMap[g] || giToUltgMap[g.replace(/\s+/g, "").toUpperCase()] || "Lainnya";
    }, [giToUltgMap]);

    /* Cross-filter architecture — setiap dimensi tanpa filter dirinya sendiri:
     *  rowsForUltg    = rawRows filtered by [program, rincian, doneFilter]
     *  rowsForProgram = rawRows filtered by [ultg, rincian, doneFilter]
     *  rowsForRincian = rawRows filtered by [ultg, program, doneFilter]
     *  baseRows       = rawRows filtered by [ultg, program, rincian]  → close/open bar
     *  totalCE        = rawRows.length                                → SummaryCard total (fixed)
     */
    const rowsForUltg = useMemo(() => {
        let r = rawRows;
        if (selectedProgram) r = r.filter(x => x[H.PROGRAM] === selectedProgram);
        if (selectedRincian) r = r.filter(x => x[H.RINCIAN] === selectedRincian);
        if (doneFilter !== null) r = r.filter(x => isDone(x) === doneFilter);
        return r;
    }, [rawRows, selectedProgram, selectedRincian, doneFilter]);

    const rowsForProgram = useMemo(() => {
        let r = rawRows;
        if (selectedUltg) r = r.filter(x => getUltg(x) === selectedUltg);
        if (selectedRincian) r = r.filter(x => x[H.RINCIAN] === selectedRincian);
        if (doneFilter !== null) r = r.filter(x => isDone(x) === doneFilter);
        return r;
    }, [rawRows, selectedUltg, selectedRincian, doneFilter, getUltg]);

    const rowsForRincian = useMemo(() => {
        let r = rawRows;
        if (selectedUltg) r = r.filter(x => getUltg(x) === selectedUltg);
        if (selectedProgram) r = r.filter(x => x[H.PROGRAM] === selectedProgram);
        if (doneFilter !== null) r = r.filter(x => isDone(x) === doneFilter);
        return r;
    }, [rawRows, selectedUltg, selectedProgram, doneFilter, getUltg]);

    const baseRows = useMemo(() => {
        let r = rawRows;
        if (selectedUltg) r = r.filter(x => getUltg(x) === selectedUltg);
        if (selectedProgram) r = r.filter(x => x[H.PROGRAM] === selectedProgram);
        if (selectedRincian) r = r.filter(x => x[H.RINCIAN] === selectedRincian);
        if (selectedGI) r = r.filter(x => x[H.GI] === selectedGI);
        return r;
    }, [rawRows, selectedUltg, selectedProgram, selectedRincian, selectedGI, getUltg]);

    /* ── progressStats — close/open dari baseRows (bar StatusKpiBar1) ── */
    const progressStats = useMemo(() => {
        let selesai = 0, belum = 0;
        baseRows.forEach(r => { if (isDone(r)) selesai++; else belum++; });
        const total = selesai + belum;
        const pct = total > 0 ? parseFloat(((selesai / total) * 100).toFixed(2)) : 0;
        return { total, selesai, belum, pct, close: selesai, open: belum };
    }, [baseRows]);

    /* ── programStats KPI cards — dari rawRows (stabil) ── */
    const programStats = useMemo(() => {
        const counts: Record<string, number> = {};
        rawRows.forEach(r => {
            const p = r[H.PROGRAM] || "Tanpa Program";
            counts[p] = (counts[p] || 0) + 1;
        });
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([key, count], i) => ({ key, label: toTitleCase(key), count, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
    }, [rawRows]);

    /* ── totalCE fixed — SummaryCard total tidak berubah saat filter aktif ── */
    const totalCE = rawRows.length;

    /* ── Donut data — cross-filtered ── */
    const donutData = useMemo(() => {
        const ultgCounts: Record<string, number> = {};
        rowsForUltg.forEach(r => {
            const ultg = getUltg(r);
            ultgCounts[ultg] = (ultgCounts[ultg] || 0) + 1;
        });

        const programCounts: Record<string, number> = {};
        rowsForProgram.forEach(r => {
            const prog = r[H.PROGRAM] || "Tanpa Program";
            programCounts[prog] = (programCounts[prog] || 0) + 1;
        });

        const rincianCounts: Record<string, number> = {};
        rowsForRincian.forEach(r => {
            const rincian = r[H.RINCIAN] || "Tanpa Rincian";
            rincianCounts[rincian] = (rincianCounts[rincian] || 0) + 1;
        });

        const ultg = Object.entries(ultgCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);
        const program = Object.entries(programCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);
        const rincian = Object.entries(rincianCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);

        return { ultg, program, rincian, ultgCounts, programCounts, rincianCounts };
    }, [rowsForUltg, rowsForProgram, rowsForRincian, getUltg]);

    /* ── Combo Chart: Rencana Penyelesaian Anomali ── */
    const comboChartOption = useMemo(() => {
        const monthOrder = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
        const monthShort: Record<string, string> = { JANUARI: "JAN", FEBRUARI: "FEB", MARET: "MAR", APRIL: "APR", MEI: "MEI", JUNI: "JUN", JULI: "JUL", AGUSTUS: "AGU", SEPTEMBER: "SEP", OKTOBER: "OKT", NOVEMBER: "NOV", DESEMBER: "DES" };
        const monthIdxToName = monthOrder;
        const monthsFound = new Set<string>();
        const programs = new Set<string>();
        const monthProgCount: Record<string, Record<string, number>> = {};

        rawRows.forEach(r => {
            const prog = (r[H.PROGRAM] || "Lainnya").trim();
            const dateStr = r[H.RENCANA] || "";
            const parsed = parseCustomDate(dateStr);
            programs.add(prog);
            if (!parsed) {
                const key = "RESCHEDULE";
                monthsFound.add(key);
                if (!monthProgCount[key]) monthProgCount[key] = {};
                monthProgCount[key][prog] = (monthProgCount[key][prog] || 0) + 1;
                return;
            }
            const monthName = monthIdxToName[parsed.getMonth()];
            if (!monthName) return;
            monthsFound.add(monthName);
            if (!monthProgCount[monthName]) monthProgCount[monthName] = {};
            monthProgCount[monthName][prog] = (monthProgCount[monthName][prog] || 0) + 1;
        });

        const sortedMonths = [...monthOrder.filter(m => monthsFound.has(m)), ...(monthsFound.has("RESCHEDULE") ? ["RESCHEDULE"] : [])];
        const xLabels = sortedMonths.map(m => m === "RESCHEDULE" ? "Dijadwalkan\nUlang" : (monthShort[m] || m.slice(0, 3)));
        const progList = [...programs];
        let cumulative = 0;
        const total = rawRows.length;
        const sisaData = sortedMonths.map(month => {
            const monthTotal = Object.values(monthProgCount[month] || {}).reduce((s, v) => s + v, 0);
            if (month === "RESCHEDULE") {
                return monthTotal;
            }
            cumulative += monthTotal;
            return Math.max(0, total - cumulative);
        });

        const barSeries = progList.map((prog, i) => ({
            name: prog, type: "bar" as const, stack: "total",
            data: sortedMonths.map(m => monthProgCount[m]?.[prog] || 0),
            itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length], borderRadius: [2, 2, 0, 0] },
            barMaxWidth: 40,
            emphasis: { itemStyle: { shadowBlur: CHART.donut.emphasis.shadowBlur, shadowColor: ec.shadow } },
        }));

        const tp = getTooltipPreset(themeKey);
        return {
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" as const, ...tp },
            legend: { type: "scroll" as const, top: 0, textStyle: { color: ec.text, fontSize: ECHART_FONT.label }, itemWidth: 12, itemHeight: 8, itemGap: 8 },
            grid: { left: 45, right: 50, top: 45, bottom: 30, containLabel: false },
            xAxis: { type: "category" as const, data: xLabels, axisLabel: { color: ec.text, fontSize: ECHART_FONT.label, fontWeight: ECHART_FONT.weight.bold }, axisLine: { lineStyle: { color: ec.gridLine } } },
            yAxis: [
                { type: "value" as const, axisLabel: { color: ec.text, fontSize: ECHART_FONT.label }, splitLine: { lineStyle: { color: ec.gridLine } } },
                { type: "value" as const, position: "right" as const, axisLabel: { color: COLOR_SELESAI, fontSize: ECHART_FONT.label }, splitLine: { show: false } },
            ],
            series: [
                ...barSeries,
                {
                    name: "Sisa Anomali", type: "line" as const, yAxisIndex: 1, data: sisaData,
                    lineStyle: { width: 3, color: COLOR_SELESAI }, itemStyle: { color: COLOR_SELESAI, borderWidth: 2 },
                    symbol: "circle" as const, symbolSize: 8,
                    label: { show: true, position: "top" as const, fontSize: ECHART_FONT.data, fontWeight: ECHART_FONT.weight.bold, color: COLOR_SELESAI },
                },
            ],
            animationDuration: CHART.animation.duration,
        };
    }, [rawRows, themeKey, ec]);

    const handleSort = useCallback((key: SortKey) => {
        if (sortKey === key) {
            setSortDir(p => p === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key); setSortDir("asc");
        }
    }, [sortKey]);

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ArrowUpDown className="h-2.5 w-2.5 opacity-50 ml-0.5 inline" />;
        return sortDir === "asc"
            ? <ArrowUp className="h-2.5 w-2.5 text-primary ml-0.5 inline" />
            : <ArrowDown className="h-2.5 w-2.5 text-primary ml-0.5 inline" />;
    };

    const { mkDonut, D, isMobile } = useMkDonut();
    const donutHeight = isMobile ? D.containerHeightMobile : D.containerHeight;

    /* ── ULTG alias map ── */
    const ultgAliasMap = useMemo(() => {
        const toAlias: Record<string, string> = {};
        const toOriginal: Record<string, string> = {};
        donutData.ultg.forEach(name => {
            const alias = toUltgLabel(name);
            toAlias[name] = alias;
            toOriginal[alias] = name;
        });
        return { toAlias, toOriginal };
    }, [donutData.ultg]);

    /* ── Donut: ULTG ── */
    const donutULTG = useMemo(() => {
        const data = donutData.ultg.map((name, i) => ({
            name: ultgAliasMap.toAlias[name] || name,
            value: donutData.ultgCounts[name] || 0,
            itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
        }));
        const selectedAlias = selectedUltg ? (ultgAliasMap.toAlias[selectedUltg] || selectedUltg) : null;
        return mkDonut(data, selectedAlias);
    }, [donutData, mkDonut, selectedUltg, ultgAliasMap]);

    /* ── Alias maps for Program & Rincian donuts ── */
    const programAliasMap = useMemo(() => {
        const toAlias: Record<string, string> = {};
        const toOriginal: Record<string, string> = {};
        donutData.program.forEach(name => {
            const alias = toTitleCase(aliasLabel(name));
            toAlias[name] = alias;
            toOriginal[alias] = name;
        });
        return { toAlias, toOriginal };
    }, [donutData.program]);

    const rincianAliasMap = useMemo(() => {
        const toAlias: Record<string, string> = {};
        const toOriginal: Record<string, string> = {};
        donutData.rincian.forEach(name => {
            const alias = toTitleCase(aliasLabel(name));
            toAlias[name] = alias;
            toOriginal[alias] = name;
        });
        return { toAlias, toOriginal };
    }, [donutData.rincian]);

    /* ── Donut: Klasifikasi Common Enemy ── */
    const donutProgram = useMemo(() => {
        const data = donutData.program.map((name, i) => ({
            name: programAliasMap.toAlias[name] || name,
            value: donutData.programCounts[name] || 0,
            itemStyle: {
                color: CHART_PALETTE[(i + 2) % CHART_PALETTE.length],
            }
        }));
        const selectedAlias = selectedProgram ? programAliasMap.toAlias[selectedProgram] : null;
        return mkDonut(data, selectedAlias);
    }, [donutData, mkDonut, selectedProgram, programAliasMap]);

    /* ── Donut: Detail Common Enemy ── */
    const donutRincian = useMemo(() => {
        const data = donutData.rincian.map((name, i) => ({
            name: rincianAliasMap.toAlias[name] || name,
            value: donutData.rincianCounts[name] || 0,
            itemStyle: {
                color: CHART_PALETTE[(i + 4) % CHART_PALETTE.length],
            }
        }));
        const selectedAlias = selectedRincian ? rincianAliasMap.toAlias[selectedRincian] : null;
        return mkDonut(data, selectedAlias);
    }, [donutData, mkDonut, selectedRincian, rincianAliasMap]);

    const onClickUltg = useMemo(() => ({
        click: (p: { name?: string }) => {
            if (!p.name) return;
            const original = ultgAliasMap.toOriginal[p.name] || p.name;
            setSelectedUltg(prev => prev === original ? null : original);
        }
    }), [ultgAliasMap]);
    const onClickProgram = useMemo(() => ({
        click: (p: { name?: string }) => {
            if (!p.name) return;
            const original = programAliasMap.toOriginal[p.name] || p.name;
            setSelectedProgram(prev => prev === original ? null : original);
        }
    }), [programAliasMap]);
    const onClickRincian = useMemo(() => ({
        click: (p: { name?: string }) => {
            if (!p.name) return;
            const original = rincianAliasMap.toOriginal[p.name] || p.name;
            setSelectedRincian((prev: string | null) => prev === original ? null : original);
        }
    }), [rincianAliasMap]);

    /* ── Badge Helpers ── */
    const getClosingStyle = (val: string): { color: string; bg: string; border: string } => {
        const upper = (val || "").toUpperCase();
        if (upper.includes("CLOSE")) return { color: COLOR_SELESAI, bg: `${COLOR_SELESAI}15`, border: `${COLOR_SELESAI}30` };
        if (upper.includes("OPEN")) return { color: COLOR_DESTRUCTIVE, bg: `${COLOR_DESTRUCTIVE}15`, border: `${COLOR_DESTRUCTIVE}30` };
        return { color: "var(--muted-foreground)", bg: "var(--muted)", border: "var(--border)" };
    };

    return (
        <div className="flex flex-col gap-3 relative">
            {hasFilter && (
                <div className="absolute -top-10 right-0 flex items-center gap-1.5 flex-wrap z-10">
                    {selectedUltg && <Badge variant="outline" className={`ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary`} onClick={() => setSelectedUltg(null)}><X className="h-2.5 w-2.5" />{selectedUltg}</Badge>}
                    {selectedProgram && <Badge variant="outline" className={`ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary max-w-[180px] truncate`} onClick={() => setSelectedProgram(null)}><X className="h-2.5 w-2.5" />{selectedProgram}</Badge>}
                    {selectedRincian && <Badge variant="outline" className={`ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary max-w-[180px] truncate`} onClick={() => setSelectedRincian(null)}><X className="h-2.5 w-2.5" />{selectedRincian}</Badge>}
                    {doneFilter !== null && <Badge variant="outline" className={`ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary`} onClick={() => setDoneFilter(null)}><X className="h-2.5 w-2.5" />{doneFilter ? "Close" : "Open"}</Badge>}
                    {selectedGI && <Badge variant="outline" className={`ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-border bg-muted text-muted-foreground`} onClick={() => setSelectedGI(null)}><X className="h-2.5 w-2.5" />{selectedGI}</Badge>}
                    <button className={`ds-data text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-0.5 rounded border border-border hover:border-foreground/30 transition-colors`} onClick={clearAllFilters}><RefreshCw className="h-2.5 w-2.5" />Reset</button>
                </div>
            )}
            {/* Program CE Proteksi + Summary — identik pattern CE Transmisi */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
                <StatusKpiBar1
                    title="Program CE Proteksi"
                    items={programStats}
                    activeStatus={selectedProgram}
                    onStatusFilter={setSelectedProgram}
                    close={progressStats.close}
                    open={progressStats.open}
                    activeDone={doneFilter}
                    onDoneFilter={setDoneFilter}
                    shadowColor={ec.shadow}
                />
                <SummaryCard1
                    title="Total CE Proteksi"
                    total={totalCE}
                    items={[
                        { key: false, label: "Open", count: progressStats.open, color: COLOR_DESTRUCTIVE },
                        { key: true, label: "Close", count: progressStats.close, color: COLOR_SELESAI },
                    ]}
                    activeKey={doneFilter}
                    onFilter={(val) => setDoneFilter(val as boolean | null)}
                    shadowColor={ec.shadow}
                />
            </div>

            {/* Jadwal Cards — HIDDEN (akan ada page khusus) */}
            {false && <div className="rounded-md border border-border hover:border-primary/10 ds-transition">
                <button
                    className={`px-3 py-2 w-full flex items-center justify-center gap-2 cursor-pointer hover:bg-ds-hover ds-transition border-b border-border`}
                    onClick={() => setIsScheduleOpen(prev => !prev)}
                >
                    <CalendarDays className="size-4 text-primary/80" />
                    <span className={`ds-title font-medium text-foreground tracking-tight`}>Jadwal CE Proteksi</span>
                    <div className="flex items-center gap-1.5 ml-2">
                        {todaySchedules.length > 0 && <Badge variant="secondary" className="ds-data">{todaySchedules.length} Today</Badge>}
                        {overdueSchedules.length > 0 && <Badge variant="secondary" className="ds-data">{overdueSchedules.length} Overdue</Badge>}
                    </div>
                    <span className={`ds-small ml-auto ${isScheduleOpen ? 'text-muted-foreground' : 'text-primary'}`}>{isScheduleOpen ? 'Collapse' : '▸ Click to expand'}</span>
                    {isScheduleOpen ? <ChevronUp className="size-3.5 text-muted-foreground ml-1" /> : <ChevronDown className="size-3.5 text-primary/80 ml-1" />}
                </button>
                <AnimatePresence>
                    {isScheduleOpen && (
                        <motion.div {...FM_COLLAPSE} className="overflow-hidden">
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-2`}>
                            <div className="rounded-md flex flex-col border border-border relative group overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 opacity-60" />
                                <div className={`px-3 py-2 pl-4 flex items-center justify-center gap-2 border-b border-border`}>
                                    <CalendarDays className="size-4 text-muted-foreground" />
                                    <span className="ds-data text-foreground">Today</span>
                                    {todaySchedules.length > 0 && <Badge variant="secondary" className="ds-data">{todaySchedules.length}</Badge>}
                                </div>
                                <div className="flex-1 p-0">
                                    {todaySchedules.length > 0 ? (
                                        <ul className="divide-y divide-border">
                                            {todaySchedules.map((r, i) => (
                                                <li key={i} className="px-4 py-2 flex justify-between items-center hover:bg-ds-hover ds-transition">
                                                    <div className="flex flex-col max-w-[70%]">
                                                        <span className="ds-data text-foreground">{r[H.GI]}</span>
                                                        <span className="ds-small truncate">{r[H.ALAT]} — {r[H.BAY]}</span>
                                                        <span className="ds-small text-primary font-medium">{r[H.PROGRAM]}</span>
                                                    </div>
                                                    <span className="ds-data px-2 py-1 rounded border border-border whitespace-nowrap">Target: {r[H.RENCANA]}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                            <CalendarDays className="size-5 text-muted-foreground/20" />
                                            <span className="ds-small">Tidak ada jadwal hari ini</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-md flex flex-col border border-border relative group overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 opacity-60" />
                                <div className={`px-3 py-2 pl-4 flex items-center justify-center gap-2 border-b border-border`}>
                                    <AlertCircle className="size-4 text-destructive" />
                                    <span className="ds-data text-foreground">Overdue</span>
                                    {overdueSchedules.length > 0 && <Badge variant="secondary" className="ds-data">{overdueSchedules.length}</Badge>}
                                </div>
                                <div className="flex-1 p-0">
                                    {overdueSchedules.length > 0 ? (
                                        <ul className="divide-y divide-border">
                                            {overdueSchedules.map((r, i) => (
                                                <li key={i} className="px-4 py-2 flex justify-between items-center hover:bg-ds-hover ds-transition">
                                                    <div className="flex flex-col max-w-[65%]">
                                                        <span className="ds-data text-foreground truncate">{r[H.GI]} <span className="text-border px-1">›</span> {r[H.BAY]}</span>
                                                        <span className="ds-small truncate">{r[H.ALAT]}</span>
                                                        <span className="ds-small text-destructive font-medium">{r[H.PROGRAM]}</span>
                                                    </div>
                                                    <span className="ds-data text-destructive px-2 py-1 rounded border border-border whitespace-nowrap">Target: {r[H.RENCANA]}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                            <AlertCircle className="size-5 text-muted-foreground/20" />
                                            <span className="ds-small">Tidak ada yang terlewat</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>}

            {/* Rencana Penyelesaian Anomali — HIDDEN (akan ada page khusus) */}

            {/* Donut Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="border-border py-0 gap-0 flex-col">
                    <CardTitle className="text-center px-3 py-2">
                        <div className="flex justify-center items-center gap-2">
                            ULTG
                            {selectedUltg && (
                                <button onClick={() => setSelectedUltg(null)} className="ds-small hover:text-primary ds-transition flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3" /> Reset
                                </button>
                            )}
                        </div>
                    </CardTitle>
                    <ReactECharts option={donutULTG} opts={{ renderer: "svg" }} style={{ height: donutHeight }} onEvents={onClickUltg} notMerge />
                </Card>

                <Card className="border-border py-0 gap-0 flex-col">
                    <CardTitle className="text-center px-3 py-2">
                        <div className="flex justify-center items-center gap-2">
                            Klasifikasi Common Enemy
                            {selectedProgram && (
                                <button onClick={() => setSelectedProgram(null)} className="ds-small hover:text-primary ds-transition flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3" /> Reset
                                </button>
                            )}
                        </div>
                    </CardTitle>
                    <ReactECharts option={donutProgram} opts={{ renderer: "svg" }} style={{ height: donutHeight }} onEvents={onClickProgram} notMerge />
                </Card>

                <Card className="border-border py-0 gap-0 flex-col">
                    <CardTitle className="text-center px-3 py-2">
                        <div className="flex justify-center items-center gap-2">
                            Detail Common Enemy
                            {selectedRincian && (
                                <button onClick={() => setSelectedRincian(null)} className="ds-small hover:text-primary ds-transition flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3" /> Reset
                                </button>
                            )}
                        </div>
                    </CardTitle>
                    <ReactECharts option={donutRincian} opts={{ renderer: "svg" }} style={{ height: donutHeight }} onEvents={onClickRincian} notMerge />
                </Card>
            </div>

            {/* Table */}
            <Card className="border-border py-0 gap-0">
                <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-2">
                        <CardTitle>Detail Aset &amp; Pekerjaan</CardTitle>
                        <Badge variant="secondary" className="ds-data">{tableRows.length}</Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari data..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 ds-small bg-muted border border-border rounded-md focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 w-[220px] placeholder:text-muted-foreground ds-transition"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                                <X className="size-3 text-muted-foreground hover:text-foreground" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                    {TABLE_COLS.filter(c => c.filterable).map(col => {
                        const uniqueVals = [...new Set(filteredRows.map(r => r[col.key]).filter(Boolean))].sort();
                        return (
                            <select
                                key={col.key}
                                value={columnFilters[col.key] || ""}
                                onChange={e => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                className="ds-small bg-muted border border-border rounded px-2 py-1 !text-muted-foreground focus:outline-none focus:border-primary/30 cursor-pointer appearance-none min-w-[100px]"
                            >
                                <option value="">{col.label} (Semua)</option>
                                {uniqueVals.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        );
                    })}
                    {Object.values(columnFilters).some(v => v) && (
                        <button onClick={() => setColumnFilters({})} className="ds-small hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded border border-border transition-colors">
                            <X className="size-2.5" /> Reset Filter
                        </button>
                    )}
                </div>
                <div className="overflow-auto max-h-[50vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                            <TableRow className={`h-9 border-b border-border hover:bg-transparent`}>
                                <TableHead className={`ds-small font-semibold h-9 px-2 text-center w-8`}>No</TableHead>
                                {allHeaders.map(hdr => (
                                    <TableHead
                                        key={hdr}
                                        className={`ds-small font-semibold h-9 px-2 cursor-pointer select-none whitespace-nowrap`}
                                        onClick={() => handleSort(hdr)}
                                    >
                                        {hdr}<SortIcon col={hdr} />
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableRows.length > 0 ? paginatedRows.map((r, idx) => {
                                const isHl = selectedRowKey === (page - 1) * PAGE_SIZE + idx;
                                const done = isDone(r);
                                return (
                                    <TableRow
                                        key={(page - 1) * PAGE_SIZE + idx}
                                        className={`h-9 border-b border-border cursor-pointer ds-transition
                                            ${isHl ? "bg-foreground/5 border-l-2 border-l-primary" : done ? "bg-ds-hover hover:bg-ds-hover" : "hover:bg-ds-hover"}
                                        `}
                                        onClick={() => setSelectedRowKey(prev => prev === (page - 1) * PAGE_SIZE + idx ? null : (page - 1) * PAGE_SIZE + idx)}
                                    >
                                        <TableCell className={`ds-data text-muted-foreground px-2 py-0 text-center`}>{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                                        {allHeaders.map(hdr => {
                                            const val = r[hdr] || "";
                                            if (hdr === H.GI) return (
                                                <TableCell key={hdr} className={`ds-body px-2 py-0`}>
                                                    <button className={`hover:text-primary ds-transition ${selectedGI === val ? "font-bold text-primary" : ""}`}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedGI(prev => prev === val ? null : val) }}>
                                                        {val || "—"}
                                                    </button>
                                                </TableCell>
                                            );
                                            if (hdr === H.CLOSING) return (
                                                <TableCell key={hdr} className={`ds-small px-2 py-0 text-center`}>
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded ds-data border"
                                                        style={{ color: getClosingStyle(val).color, backgroundColor: getClosingStyle(val).bg, borderColor: getClosingStyle(val).border }}>
                                                        {val || "—"}
                                                    </span>
                                                </TableCell>
                                            );
                                            if (hdr === H.RENCANA) return (
                                                <TableCell key={hdr} className={`ds-small px-2 py-0 text-center`}>
                                                    <span className={`${r[H.REALISASI] ? "line-through opacity-50" : ""}`}>{val || "—"}</span>
                                                </TableCell>
                                            );
                                            if (hdr === H.REALISASI) return (
                                                <TableCell key={hdr} className={`ds-small px-2 py-0 text-center`}>
                                                    {val ? <span className="text-foreground">{val}</span> : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                            );
                                            return (
                                                <TableCell key={hdr} className={`ds-small px-2 py-0 text-muted-foreground max-w-[200px] truncate`} title={val}>
                                                    {val || "—"}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                )
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={allHeaders.length + 1} className="h-32 text-center text-muted-foreground">
                                        Data tidak ditemukan.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                        <span className="ds-small">
                            Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tableRows.length)} dari {tableRows.length} baris
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 ds-small rounded border border-border disabled:opacity-50 hover:bg-ds-hover ds-transition">««</button>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 ds-small rounded border border-border disabled:opacity-50 hover:bg-ds-hover ds-transition">‹ Prev</button>
                            <span className="px-3 py-1 ds-label">{page} / {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 ds-small rounded border border-border disabled:opacity-50 hover:bg-ds-hover ds-transition">Next ›</button>
                            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 ds-small rounded border border-border disabled:opacity-50 hover:bg-ds-hover ds-transition">»»</button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
