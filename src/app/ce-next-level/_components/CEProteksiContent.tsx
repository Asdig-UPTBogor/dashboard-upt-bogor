"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, AlertCircle, RefreshCw, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Search, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import { COLORS, LAYOUT, TEXT, ANIM } from "@/app/gardu-induk/program-kerja/_components/design-tokens";
import { useMkDonut } from "./ce-donut-factory";
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

export function CEProteksiContent({ sheetData, giToUltgMap = {} }: { sheetData: any; giToUltgMap?: Record<string, string> }) {
    const rawRows: Row[] = sheetData?.rows || [];
    const allHeaders: string[] = sheetData?.headers || [];
    const theme = useChartTheme();

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

    /* ── Date Helpers ── */
    const parseCustomDate = (dateStr: string) => {
        if (!dateStr) return null;
        const parsed = parse(dateStr, "dd/MM/yyyy", new Date());
        if (isValid(parsed)) return parsed;
        const parsedUS = parse(dateStr, "MM/dd/yyyy", new Date());
        return isValid(parsedUS) ? parsedUS : null;
    };

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

    /* ── Aggregation (from filteredRows — cross-filtering standard) ── */
    const stats = useMemo(() => {
        let selesaiCount = 0;
        let belumCount = 0;
        const ultgCounts: Record<string, number> = {};
        const programCounts: Record<string, number> = {};
        const rincianCounts: Record<string, number> = {};

        filteredRows.forEach(r => {
            if (isDone(r)) selesaiCount++; else belumCount++;
            const gi = r[H.GI] || "Unknown";
            const ultg = giToUltgMap[gi.trim()] || giToUltgMap[gi.trim().replace(/\s+/g, "").toUpperCase()] || "Lainnya";
            const prog = r[H.PROGRAM] || "Tanpa Program";
            const rincian = r[H.RINCIAN] || "Tanpa Rincian";

            ultgCounts[ultg] = (ultgCounts[ultg] || 0) + 1;
            programCounts[prog] = (programCounts[prog] || 0) + 1;
            rincianCounts[rincian] = (rincianCounts[rincian] || 0) + 1;
        });

        const topRincian = Object.entries(rincianCounts)
            .map(([name, val]) => ({ name, value: val }))
            .sort((a, b) => b.value - a.value);

        const pct = filteredRows.length > 0 ? parseFloat(((selesaiCount / filteredRows.length) * 100).toFixed(2)) : 0;

        return { total: filteredRows.length, selesai: selesaiCount, belum: belumCount, pct, ultgCounts, programCounts, topRincian };
    }, [filteredRows, giToUltgMap]);

    /* ── Progress stats — filtered by donut selections only (NOT doneFilter) ── */
    const progressStats = useMemo(() => {
        let r = rawRows;
        if (selectedUltg) r = r.filter(x => { const g = (x[H.GI] || "").trim(); return (giToUltgMap[g] || giToUltgMap[g.replace(/\s+/g, "").toUpperCase()] || "Lainnya") === selectedUltg; });
        if (selectedProgram) r = r.filter(x => x[H.PROGRAM] === selectedProgram);
        if (selectedRincian) r = r.filter(x => x[H.RINCIAN] === selectedRincian);
        if (selectedGI) r = r.filter(x => x[H.GI] === selectedGI);
        let selesai = 0, belum = 0;
        r.forEach(x => { if (isDone(x)) selesai++; else belum++; });
        const total = r.length;
        const pct = total > 0 ? parseFloat(((selesai / total) * 100).toFixed(2)) : 0;
        return { total, selesai, belum, pct };
    }, [rawRows, selectedUltg, selectedProgram, selectedRincian, selectedGI, giToUltgMap]);

    /* ── Donut data — filtered by doneFilter (progress bar) only ── */
    const donutData = useMemo(() => {
        const rows = doneFilter !== null ? rawRows.filter(x => isDone(x) === doneFilter) : rawRows;
        const ultgCounts: Record<string, number> = {};
        const programCounts: Record<string, number> = {};
        const rincianCounts: Record<string, number> = {};

        rows.forEach(r => {
            const gi = r[H.GI] || "Unknown";
            const ultg = giToUltgMap[gi.trim()] || giToUltgMap[gi.trim().replace(/\s+/g, "").toUpperCase()] || "Lainnya";
            const prog = r[H.PROGRAM] || "Tanpa Program";
            const rincian = r[H.RINCIAN] || "Tanpa Rincian";
            ultgCounts[ultg] = (ultgCounts[ultg] || 0) + 1;
            programCounts[prog] = (programCounts[prog] || 0) + 1;
            rincianCounts[rincian] = (rincianCounts[rincian] || 0) + 1;
        });

        const ultg = Object.entries(ultgCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);
        const program = Object.entries(programCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);
        const rincian = Object.entries(rincianCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);

        return { ultg, program, rincian, ultgCounts, programCounts, rincianCounts };
    }, [rawRows, doneFilter, giToUltgMap]);

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
            itemStyle: { color: COLORS.palette[i % COLORS.palette.length], borderRadius: [2, 2, 0, 0] },
            barMaxWidth: 40,
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
        }));

        return {
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" as const, backgroundColor: COLORS.tooltipBg, borderColor: COLORS.tooltipBorder, borderWidth: 1, textStyle: { color: "#d4d4d8", fontSize: 12 } },
            legend: { type: "scroll" as const, top: 0, textStyle: { color: "#d4d4d8", fontSize: 11 }, itemWidth: 12, itemHeight: 8, itemGap: 8 },
            grid: { left: 45, right: 50, top: 45, bottom: 30, containLabel: false },
            xAxis: { type: "category" as const, data: xLabels, axisLabel: { color: "#d4d4d8", fontSize: 11, fontWeight: "bold" as const }, axisLine: { lineStyle: { color: "#3f3f46" } } },
            yAxis: [
                { type: "value" as const, axisLabel: { color: "#d4d4d8", fontSize: 11 }, splitLine: { lineStyle: { color: "#3f3f46" } } },
                { type: "value" as const, position: "right" as const, axisLabel: { color: "#22c55e", fontSize: 11 }, splitLine: { show: false } },
            ],
            series: [
                ...barSeries,
                {
                    name: "Sisa Anomali", type: "line" as const, yAxisIndex: 1, data: sisaData,
                    lineStyle: { width: 3, color: "#22c55e" }, itemStyle: { color: "#22c55e", borderWidth: 2 },
                    symbol: "circle" as const, symbolSize: 8,
                    label: { show: true, position: "top" as const, fontSize: 12, fontWeight: "bold" as const, color: "#22c55e" },
                },
            ],
            animationDuration: 800,
        };
    }, [rawRows]);

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

    const { mkDonut, D } = useMkDonut();

    /* ── Donut: ULTG (mapped from Master Gardu Induk) ── */
    const donutULTG = useMemo(() => {
        const data = donutData.ultg.map((name, i) => ({
            name, value: donutData.ultgCounts[name] || 0,
            itemStyle: {
                color: COLORS.palette[i % COLORS.palette.length],
            }
        }));
        return mkDonut(data, selectedUltg);
    }, [donutData, mkDonut, selectedUltg]);

    /* ── Alias maps for Program & Rincian donuts ── */
    const programAliasMap = useMemo(() => {
        const toAlias: Record<string, string> = {};
        const toOriginal: Record<string, string> = {};
        donutData.program.forEach(name => {
            const alias = aliasLabel(name);
            toAlias[name] = alias;
            toOriginal[alias] = name;
        });
        return { toAlias, toOriginal };
    }, [donutData.program]);

    const rincianAliasMap = useMemo(() => {
        const toAlias: Record<string, string> = {};
        const toOriginal: Record<string, string> = {};
        donutData.rincian.forEach(name => {
            const alias = aliasLabel(name);
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
                color: COLORS.palette[(i + 2) % COLORS.palette.length],
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
                color: COLORS.palette[(i + 4) % COLORS.palette.length],
            }
        }));
        const selectedAlias = selectedRincian ? rincianAliasMap.toAlias[selectedRincian] : null;
        return mkDonut(data, selectedAlias);
    }, [donutData, mkDonut, selectedRincian, rincianAliasMap]);

    const onClickUltg = useMemo(() => ({
        click: (p: { name?: string }) => { if (p.name) setSelectedUltg(prev => prev === p.name ? null : p.name!); }
    }), []);
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
    const getClosingBadge = (val: string) => {
        const upper = (val || "").toUpperCase();
        if (upper.includes("CLOSE")) return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
        if (upper.includes("OPEN")) return "bg-rose-500/15 text-rose-400 border border-rose-500/30";
        return "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30";
    };

    return (
        <div className={`flex flex-col ${LAYOUT.sectionGap} relative`}>
            {/* Active Filters — pinned to top-right, overlapping tab row */}
            {hasFilter && (
                <div className="absolute -top-10 right-0 flex items-center gap-1.5 flex-wrap z-10">
                    {selectedUltg && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-1 hover:bg-destructive/20 border-indigo-500/30 bg-indigo-500/10 text-indigo-300`} onClick={() => setSelectedUltg(null)}><X className="h-2.5 w-2.5" />{selectedUltg}</Badge>}
                    {selectedProgram && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-1 hover:bg-destructive/20 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 max-w-[180px] truncate`} onClick={() => setSelectedProgram(null)}><X className="h-2.5 w-2.5" />{selectedProgram}</Badge>}
                    {selectedRincian && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-1 hover:bg-destructive/20 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 max-w-[180px] truncate`} onClick={() => setSelectedRincian(null)}><X className="h-2.5 w-2.5" />{selectedRincian}</Badge>}
                    {doneFilter !== null && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-1 hover:bg-destructive/20 border-indigo-500/30 bg-indigo-500/10 text-indigo-300`} onClick={() => setDoneFilter(null)}><X className="h-2.5 w-2.5" />{doneFilter ? "Close" : "Open"}</Badge>}
                    {selectedGI && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-1 hover:bg-destructive/20 border-zinc-500/30 bg-zinc-500/10 text-zinc-300`} onClick={() => setSelectedGI(null)}><X className="h-2.5 w-2.5" />{selectedGI}</Badge>}
                    <button className={`${TEXT.badge} text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700 hover:border-zinc-500 transition-colors`} onClick={clearAllFilters}><RefreshCw className="h-2.5 w-2.5" />Reset</button>
                </div>
            )}
            {/* KPI */}
            <div className="rounded-md overflow-hidden border border-transparent hover:shadow-sm transition-all duration-300" style={{ background: COLORS.cardBg }}>
                <div className="flex items-center gap-2 p-2">
                    <div className="flex-1 px-3 py-2">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className={`${TEXT.kpiLabel} text-muted-foreground uppercase tracking-wider`}>Progress CE Proteksi</span>
                            <span className="text-sm font-bold" style={{ color: COLORS.selesai }}>{progressStats.pct}%</span>
                        </div>
                        <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ background: "rgba(239,68,68,0.25)" }}>
                            <div className={`h-full rounded-l-full ${ANIM.chartTransition}`}
                                style={{ width: `${progressStats.pct}%`, background: `linear-gradient(90deg, #22c55e, #10b981)` }} />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className={`${TEXT.kpiLabel}`} style={{ color: COLORS.selesai }}>{progressStats.selesai} Close</span>
                            <span className={`${TEXT.kpiLabel}`} style={{ color: COLORS.belum }}>{progressStats.belum} Open</span>
                        </div>
                    </div>
                    <button className={`px-4 py-3 text-center min-w-[90px] cursor-pointer rounded-md transition-all duration-200 border ${doneFilter === true ? "ring-2 ring-emerald-500/40 bg-emerald-500/15 border-emerald-500/30 scale-[1.02]" : "border-emerald-500/30 bg-emerald-500/5 shadow-[0_2px_8px_rgba(52,211,153,0.15)] hover:shadow-[0_4px_12px_rgba(52,211,153,0.25)] hover:bg-emerald-500/10 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"}`}
                        onClick={() => setDoneFilter(prev => prev === true ? null : true)}>
                        <div className={`${TEXT.kpiValue} font-extrabold leading-none`} style={{ color: COLORS.selesai }}>{progressStats.selesai}</div>
                        <div className={`${TEXT.kpiLabel} mt-1 text-muted-foreground uppercase`}>Close</div>
                    </button>
                    <button className={`px-4 py-3 text-center min-w-[90px] cursor-pointer rounded-md transition-all duration-200 border ${doneFilter === false ? "ring-2 ring-rose-500/40 bg-rose-500/15 border-rose-500/30 scale-[1.02]" : "border-rose-500/30 bg-rose-500/5 shadow-[0_2px_8px_rgba(251,113,133,0.15)] hover:shadow-[0_4px_12px_rgba(251,113,133,0.25)] hover:bg-rose-500/10 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"}`}
                        onClick={() => setDoneFilter(prev => prev === false ? null : false)}>
                        <div className={`${TEXT.kpiValue} font-extrabold leading-none`} style={{ color: COLORS.belum }}>{progressStats.belum}</div>
                        <div className={`${TEXT.kpiLabel} mt-1 text-muted-foreground uppercase`}>Open</div>
                    </button>
                    <div className="px-4 py-3 text-center hidden sm:block md:min-w-[90px] rounded-md border border-zinc-500/30">
                        <div className={`${TEXT.kpiValue} font-extrabold leading-none text-muted-foreground`}>{progressStats.total}</div>
                        <div className={`${TEXT.kpiLabel} mt-1 text-muted-foreground uppercase`}>Total CE</div>
                    </div>
                </div>
            </div>

            {/* Jadwal Cards — COLLAPSIBLE */}
            <div className="rounded-md border border-transparent hover:border-primary/10 transition-all" style={{ background: COLORS.cardBg }}>
                <button
                    className={`${LAYOUT.headerPadding} w-full flex items-center justify-center gap-2 cursor-pointer hover:bg-muted/10 transition-colors border-b border-border/20`}
                    onClick={() => setIsScheduleOpen(prev => !prev)}
                >
                    <CalendarDays className="size-4 text-primary/80" />
                    <span className={`${TEXT.cardTitle} font-medium text-foreground tracking-tight`}>Jadwal CE Proteksi</span>
                    <div className="flex items-center gap-1.5 ml-2">
                        {todaySchedules.length > 0 && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs tabular-nums font-mono">{todaySchedules.length} Today</Badge>}
                        {overdueSchedules.length > 0 && <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs tabular-nums font-mono">{overdueSchedules.length} Overdue</Badge>}
                    </div>
                    <span className={`text-xs ml-auto ${isScheduleOpen ? 'text-muted-foreground' : 'text-primary'}`}>{isScheduleOpen ? 'Collapse' : '▸ Click to expand'}</span>
                    {isScheduleOpen ? <ChevronUp className="size-3.5 text-muted-foreground ml-1" /> : <ChevronDown className="size-3.5 text-primary/80 ml-1" />}
                </button>
                <AnimatePresence>
                    {isScheduleOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                            <div className={`grid grid-cols-1 md:grid-cols-2 ${LAYOUT.cardGap} p-2`}>
                            <div className="rounded-md flex flex-col border border-transparent relative group overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 opacity-60" />
                                <div className={`${LAYOUT.headerPadding} pl-4 flex items-center justify-center gap-2 border-b border-border/20`}>
                                    <CalendarDays className="size-4 text-emerald-500/70" />
                                    <span className="text-xs font-medium text-foreground">Today</span>
                                    {todaySchedules.length > 0 && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs tabular-nums font-mono">{todaySchedules.length}</Badge>}
                                </div>
                                <div className="flex-1 p-0">
                                    {todaySchedules.length > 0 ? (
                                        <ul className="divide-y divide-border/5">
                                            {todaySchedules.map((r, i) => (
                                                <li key={i} className="px-4 py-2 flex justify-between items-center hover:bg-muted/10 transition-colors">
                                                    <div className="flex flex-col max-w-[70%]">
                                                        <span className="text-xs font-semibold text-foreground">{r[H.GI]}</span>
                                                        <span className="text-xs text-muted-foreground truncate">{r[H.ALAT]} — {r[H.BAY]}</span>
                                                        <span className="text-xs text-primary font-medium">{r[H.PROGRAM]}</span>
                                                    </div>
                                                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 whitespace-nowrap">Target: {r[H.RENCANA]}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                            <CalendarDays className="size-5 text-emerald-500/15" />
                                            <span className="text-xs text-muted-foreground">Tidak ada jadwal hari ini</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-md flex flex-col border border-transparent relative group overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 opacity-60" />
                                <div className={`${LAYOUT.headerPadding} pl-4 flex items-center justify-center gap-2 border-b border-border/20`}>
                                    <AlertCircle className="size-4 text-rose-500/70" />
                                    <span className="text-xs font-medium text-foreground">Overdue</span>
                                    {overdueSchedules.length > 0 && <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs tabular-nums font-mono">{overdueSchedules.length}</Badge>}
                                </div>
                                <div className="flex-1 p-0">
                                    {overdueSchedules.length > 0 ? (
                                        <ul className="divide-y divide-border/5">
                                            {overdueSchedules.map((r, i) => (
                                                <li key={i} className="px-4 py-2 flex justify-between items-center hover:bg-muted/10 transition-colors">
                                                    <div className="flex flex-col max-w-[65%]">
                                                        <span className="text-xs font-semibold text-foreground truncate">{r[H.GI]} <span className="text-border px-1">›</span> {r[H.BAY]}</span>
                                                        <span className="text-xs text-muted-foreground truncate">{r[H.ALAT]}</span>
                                                        <span className="text-xs text-rose-400 font-medium">{r[H.PROGRAM]}</span>
                                                    </div>
                                                    <span className="text-xs font-mono text-rose-400 bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10 whitespace-nowrap">Target: {r[H.RENCANA]}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                            <AlertCircle className="size-5 text-rose-500/15" />
                                            <span className="text-xs text-muted-foreground">Tidak ada yang terlewat</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>

            {/* Rencana Penyelesaian Anomali — COLLAPSIBLE */}
            <div className="rounded-md border border-transparent hover:border-primary/10 transition-all" style={{ background: COLORS.cardBg }}>
                <button
                    className={`${LAYOUT.headerPadding} w-full flex items-center justify-center gap-2 cursor-pointer hover:bg-muted/10 transition-colors border-b border-border/20`}
                    onClick={() => setIsComboOpen(prev => !prev)}
                >
                    <TrendingUp className="size-4 text-primary/80" />
                    <span className={`${TEXT.cardTitle} font-medium text-foreground tracking-tight`}>Rencana Penyelesaian Anomali Proteksi 2026</span>
                    <span className={`text-xs ml-auto ${isComboOpen ? 'text-muted-foreground' : 'text-primary'}`}>{isComboOpen ? 'Collapse' : '▸ Click to expand'}</span>
                    {isComboOpen ? <ChevronUp className="size-3.5 text-muted-foreground ml-1" /> : <ChevronDown className="size-3.5 text-primary/80 ml-1" />}
                </button>
                <AnimatePresence>
                    {isComboOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                            <div className="p-2" style={{ minHeight: "clamp(200px, 25vh, 360px)" }}>
                                <ReactECharts option={comboChartOption} style={{ height: 300, width: "100%" }} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Donut Charts — 2 cols so labels have enough space */}
            <div className={`grid grid-cols-1 lg:grid-cols-3 ${LAYOUT.cardGap}`}>
                <div className="rounded-md flex flex-col border border-transparent hover:shadow-sm transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
                    <div className="px-2 py-1 flex justify-center items-center gap-2 z-10 border-b border-border/30">
                        <span className={`${TEXT.cardTitle} font-semibold`}>ULTG</span>
                        {selectedUltg && (
                             <button onClick={() => setSelectedUltg(null)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                 <RefreshCw className="h-3 w-3" /> Reset
                             </button>
                        )}
                    </div>
                    <div style={{ flex: 1, minHeight: "clamp(250px, 32vh, 420px)" }}>
                        <ReactECharts option={donutULTG} style={{ height: "100%", width: "100%" }} notMerge={false} lazyUpdate={true} onEvents={onClickUltg} />
                    </div>
                </div>

                <div className="rounded-md flex flex-col border border-transparent hover:shadow-sm transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
                    <div className="px-2 py-1 flex justify-center items-center gap-2 z-10 border-b border-border/30">
                        <span className={`${TEXT.cardTitle} font-semibold`}>Klasifikasi Common Enemy</span>
                        {selectedProgram && (
                             <button onClick={() => setSelectedProgram(null)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                 <RefreshCw className="h-3 w-3" /> Reset
                             </button>
                        )}
                    </div>
                    <div style={{ flex: 1, minHeight: "clamp(250px, 32vh, 420px)" }}>
                        <ReactECharts option={donutProgram} style={{ height: "100%", width: "100%" }} notMerge={false} lazyUpdate={true} onEvents={onClickProgram} />
                    </div>
                </div>

                <div className="rounded-md flex flex-col border border-transparent hover:shadow-sm transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
                    <div className="px-2 py-1 flex justify-center items-center gap-2 z-10 border-b border-border/30">
                        <span className={`${TEXT.cardTitle} font-semibold`}>Detail Common Enemy</span>
                        {selectedRincian && (
                             <button onClick={() => setSelectedRincian(null)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                 <RefreshCw className="h-3 w-3" /> Reset
                             </button>
                        )}
                    </div>
                    <div style={{ flex: 1, minHeight: "clamp(250px, 32vh, 420px)" }}>
                        <ReactECharts option={donutRincian} style={{ height: "100%", width: "100%" }} notMerge={false} lazyUpdate={true} onEvents={onClickRincian} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-md border border-transparent hover:shadow-sm transition-all duration-300" style={{ background: COLORS.cardBg }}>
                <div className={`${LAYOUT.headerPadding} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <span className={`${TEXT.cardTitle} font-semibold`}>Detail Aset & Pekerjaan</span>
                        <Badge variant="secondary" className={`${TEXT.badge}`}>{tableRows.length}</Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari data..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs bg-muted/10 border border-border/30 rounded-md focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 w-[220px] placeholder:text-muted-foreground transition-all"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                                <X className="size-3 text-muted-foreground hover:text-foreground" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="px-2 pb-2 flex flex-wrap gap-1.5">
                    {TABLE_COLS.filter(c => c.filterable).map(col => {
                        const uniqueVals = [...new Set(filteredRows.map(r => r[col.key]).filter(Boolean))].sort();
                        return (
                            <select
                                key={col.key}
                                value={columnFilters[col.key] || ""}
                                onChange={e => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                className="text-xs bg-muted/10 border border-border/30 rounded px-2 py-1 text-muted-foreground focus:outline-none focus:border-primary/30 cursor-pointer appearance-none min-w-[100px]"
                            >
                                <option value="">{col.label} (Semua)</option>
                                {uniqueVals.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        );
                    })}
                    {Object.values(columnFilters).some(v => v) && (
                        <button onClick={() => setColumnFilters({})} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded border border-border/30 transition-colors">
                            <X className="size-2.5" /> Reset Filter
                        </button>
                    )}
                </div>
                <div className="overflow-auto max-h-[50vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                            <TableRow className={`${LAYOUT.tableRowHeight} border-b border-border/20 hover:bg-transparent`}>
                                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center w-8`}>No</TableHead>
                                {allHeaders.map(hdr => (
                                    <TableHead
                                        key={hdr}
                                        className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 cursor-pointer select-none whitespace-nowrap`}
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
                                        className={`${LAYOUT.tableRowHeight} border-b border-border/30 cursor-pointer ${ANIM.hoverTransition}
                                            ${isHl ? "bg-indigo-500/10 ring-1 ring-indigo-500/30" : done ? "bg-emerald-500/10 hover:bg-muted/10" : "hover:bg-muted/10"}
                                        `}
                                        onClick={() => setSelectedRowKey(prev => prev === (page - 1) * PAGE_SIZE + idx ? null : (page - 1) * PAGE_SIZE + idx)}
                                    >
                                        <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center font-mono text-muted-foreground`}>{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                                        {allHeaders.map(hdr => {
                                            const val = r[hdr] || "";
                                            if (hdr === H.GI) return (
                                                <TableCell key={hdr} className={`${LAYOUT.tableFontSize} px-2 py-0`}>
                                                    <button className={`hover:text-primary ${ANIM.hoverTransition} ${selectedGI === val ? "font-bold text-indigo-400" : ""}`}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedGI(prev => prev === val ? null : val) }}>
                                                        {val || "—"}
                                                    </button>
                                                </TableCell>
                                            );
                                            if (hdr === H.CLOSING) return (
                                                <TableCell key={hdr} className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${getClosingBadge(val)}`}>
                                                        {val || "—"}
                                                    </span>
                                                </TableCell>
                                            );
                                            if (hdr === H.RENCANA) return (
                                                <TableCell key={hdr} className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                                                    <span className={`${r[H.REALISASI] ? "line-through opacity-50 text-xs" : ""}`}>{val || "—"}</span>
                                                </TableCell>
                                            );
                                            if (hdr === H.REALISASI) return (
                                                <TableCell key={hdr} className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                                                    {val ? <span className="text-emerald-400">{val}</span> : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                            );
                                            return (
                                                <TableCell key={hdr} className={`${LAYOUT.tableFontSize} px-2 py-0 text-muted-foreground max-w-[200px] truncate`} title={val}>
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
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border/30">
                        <span className="text-xs text-muted-foreground">
                            Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tableRows.length)} dari {tableRows.length} baris
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-border/30 disabled:opacity-50 hover:bg-muted/10 transition-colors">««</button>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-xs rounded border border-border/30 disabled:opacity-50 hover:bg-muted/10 transition-colors">‹ Prev</button>
                            <span className="px-3 py-1 text-xs font-medium">{page} / {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-border/30 disabled:opacity-50 hover:bg-muted/10 transition-colors">Next ›</button>
                            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs rounded border border-border/30 disabled:opacity-50 hover:bg-muted/10 transition-colors">»»</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
