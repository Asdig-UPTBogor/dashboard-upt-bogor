"use client";

import { useMemo, useCallback, useState } from "react";
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
    RENCANA_TL: "RENCANA TINDAKLANJUT",
    RENCANA: "RENCANA",
    REALISASI: "REALISASI",
    BULAN_CLOSE: "BULAN CLOSE",
    JUSTIFIKASI: "JUSTIFIKASI",
    CLOSING: "CLOSING MANUAL",
    RENCANA_TL_UPT: "RENCANA TINDAKLANJUT DARI UPT-ULTG",
    KLUSTER: "KLUSTER ANGGARAN",
    ANGGARAN: "KEBUTUHAN ANGGARAN",
} as const;

type Row = Record<string, string>;
type SortKey = string | null;
type SortDir = "asc" | "desc";

const TABLE_COLS: { key: string; label: string; center?: boolean; minW?: string; filterable: boolean }[] = [
    { key: H.PROGRAM, label: "Program", filterable: true },
    { key: H.GI, label: "Gardu Induk", filterable: true },
    { key: H.BAY, label: "Bay", filterable: false },
    { key: H.JUSTIFIKASI, label: "Justifikasi", minW: "200px", filterable: false },
    { key: H.CLOSING, label: "Status", center: true, filterable: true },
    { key: H.RENCANA, label: "Rencana", center: true, filterable: false },
    { key: H.REALISASI, label: "Realisasi", center: true, filterable: false },
    { key: H.BULAN_CLOSE, label: "Bulan Close", center: true, filterable: true },
];

export function CEGarduIndukContent({ sheetData, giToUltgMap = {} }: { sheetData: any; giToUltgMap?: Record<string, string> }) {
    const rawRows: Row[] = sheetData?.rows || [];
    const allHeaders: string[] = sheetData?.headers || [];
    const theme = useChartTheme();

    /* ── Filter States ── */
    const [selectedGI, setSelectedGI] = useState<string | null>(null);
    const [selectedUltg, setSelectedUltg] = useState<string | null>(null);
    const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
    const [selectedClosing, setSelectedClosing] = useState<string | null>(null);
    const [selectedRowKey, setSelectedRowKey] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [isComboOpen, setIsComboOpen] = useState(false);
    const [doneFilter, setDoneFilter] = useState<boolean | null>(null);

    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const clearAllFilters = useCallback(() => {
        setSelectedGI(null); setSelectedUltg(null); setSelectedProgram(null);
        setSelectedClosing(null); setSelectedRowKey(null);
        setSearchQuery(""); setColumnFilters({}); setDoneFilter(null);
    }, []);
    const hasFilter = selectedGI || selectedUltg || selectedProgram || selectedClosing || searchQuery || doneFilter !== null || Object.values(columnFilters).some(v => v);

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
        if (selectedClosing) r = r.filter(x => (x[H.CLOSING] || "").toUpperCase() === selectedClosing);

        if (sortKey) {
            r = [...r].sort((a, b) => {
                const va = (a[sortKey] || "").toLowerCase();
                const vb = (b[sortKey] || "").toLowerCase();
                const cmp = va.localeCompare(vb, "id", { numeric: true });
                return sortDir === "asc" ? cmp : -cmp;
            });
        }
        return r;
    }, [rawRows, doneFilter, selectedGI, selectedUltg, selectedProgram, selectedClosing, sortKey, sortDir, giToUltgMap]);

    /* ── Table Rows (search + column filters) ── */
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

    /* ── Aggregation (from filteredRows — cross-filtering standard) ── */
    const stats = useMemo(() => {
        let selesaiCount = 0;
        let belumCount = 0;
        const ultgCounts: Record<string, number> = {};
        const programCounts: Record<string, number> = {};

        filteredRows.forEach(r => {
            if (isDone(r)) selesaiCount++; else belumCount++;
            const gi = r[H.GI] || "Unknown";
            const ultg = giToUltgMap[gi.trim()] || giToUltgMap[gi.trim().replace(/\s+/g, "").toUpperCase()] || "Lainnya";
            const prog = r[H.PROGRAM] || "Tanpa Program";

            ultgCounts[ultg] = (ultgCounts[ultg] || 0) + 1;
            programCounts[prog] = (programCounts[prog] || 0) + 1;
        });

        const topProgram = Object.entries(programCounts)
            .map(([name, val]) => ({ name, value: val }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

        const pct = filteredRows.length > 0 ? Math.round((selesaiCount / filteredRows.length) * 100) : 0;

        return { total: filteredRows.length, selesai: selesaiCount, belum: belumCount, pct, ultgCounts, topProgram };
    }, [filteredRows, giToUltgMap]);

    /* ── Stable Donut Keys (from rawRows — constant regardless of filter) ── */
    const stableKeys = useMemo(() => {
        const ultgCounts: Record<string, number> = {};
        const programCounts: Record<string, number> = {};

        rawRows.forEach(r => {
            const gi = r[H.GI] || "Unknown";
            const ultg = giToUltgMap[gi.trim()] || giToUltgMap[gi.trim().replace(/\s+/g, "").toUpperCase()] || "Lainnya";
            const prog = r[H.PROGRAM] || "Tanpa Program";
            ultgCounts[ultg] = (ultgCounts[ultg] || 0) + 1;
            programCounts[prog] = (programCounts[prog] || 0) + 1;
        });

        const ultg = Object.entries(ultgCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);
        const program = Object.entries(programCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([k]) => k);

        return { ultg, program };
    }, [rawRows, giToUltgMap]);

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
            name: prog,
            type: "bar" as const,
            stack: "total",
            data: sortedMonths.map(m => monthProgCount[m]?.[prog] || 0),
            itemStyle: { color: COLORS.palette[i % COLORS.palette.length], borderRadius: [2, 2, 0, 0] },
            barMaxWidth: 40,
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
        }));

        return {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "axis" as const, backgroundColor: COLORS.tooltipBg,
                borderColor: COLORS.tooltipBorder, borderWidth: 1,
                textStyle: { color: "#e4e4e7", fontSize: 11 },
            },
            legend: {
                type: "scroll" as const, top: 0,
                textStyle: { color: "#a1a1aa", fontSize: 10 },
                itemWidth: 12, itemHeight: 8, itemGap: 8,
            },
            grid: { left: 45, right: 50, top: 45, bottom: 30, containLabel: false },
            xAxis: {
                type: "category" as const,
                data: xLabels,
                axisLabel: { color: "#a1a1aa", fontSize: 10, fontWeight: "bold" as const },
                axisLine: { lineStyle: { color: "#333" } },
            },
            yAxis: [
                { type: "value" as const, axisLabel: { color: "#a1a1aa", fontSize: 10 }, splitLine: { lineStyle: { color: "#27272a" } } },
                { type: "value" as const, position: "right" as const, axisLabel: { color: "#22c55e", fontSize: 10 }, splitLine: { show: false } },
            ],
            series: [
                ...barSeries,
                {
                    name: "Sisa Anomali", type: "line" as const, yAxisIndex: 1,
                    data: sisaData,
                    lineStyle: { width: 3, color: "#22c55e" },
                    itemStyle: { color: "#22c55e", borderWidth: 2 },
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
        if (sortKey !== col) return <ArrowUpDown className="h-2.5 w-2.5 opacity-30 ml-0.5 inline" />;
        return sortDir === "asc"
            ? <ArrowUp className="h-2.5 w-2.5 text-primary ml-0.5 inline" />
            : <ArrowDown className="h-2.5 w-2.5 text-primary ml-0.5 inline" />;
    };

    /* ── Design Constants ── */
    const { mkDonut, D } = useMkDonut();

    /* ── Donut: Per ULTG (mapped from Master Gardu Induk) ── */
    const donutULTG = useMemo(() => {
        const data = stableKeys.ultg.map((name, i) => ({
            name, value: stats.ultgCounts[name] || 0,
            itemStyle: {
                color: COLORS.palette[i % COLORS.palette.length],
                opacity: selectedUltg && selectedUltg !== name ? D.dimOpacity : 1,
                shadowBlur: selectedUltg === name ? D.glowBlur : 0,
                shadowColor: selectedUltg === name ? COLORS.palette[i % COLORS.palette.length] : "transparent",
            }
        }));
        return mkDonut(data);
    }, [stableKeys.ultg, stats.ultgCounts, selectedUltg, mkDonut, D]);

    /* ── Donut: Per Program ── */
    const donutProgram = useMemo(() => {
        const data = stableKeys.program.map((name, i) => ({
            name, value: stats.topProgram.find(u => u.name === name)?.value || 0,
            itemStyle: {
                color: COLORS.palette[(i + 4) % COLORS.palette.length],
                opacity: selectedProgram && selectedProgram !== name ? D.dimOpacity : 1,
                shadowBlur: selectedProgram === name ? D.glowBlur : 0,
                shadowColor: selectedProgram === name ? COLORS.palette[(i + 4) % COLORS.palette.length] : "transparent",
            }
        }));
        return mkDonut(data);
    }, [stableKeys.program, stats.topProgram, selectedProgram, mkDonut, D]);

    const onClickUltg = useMemo(() => ({
        click: (p: { name?: string }) => { if (p.name) setSelectedUltg(prev => prev === p.name ? null : p.name!); }
    }), []);
    const onClickProgram = useMemo(() => ({
        click: (p: { name?: string }) => { if (p.name) setSelectedProgram(prev => prev === p.name ? null : p.name!); }
    }), []);

    const getClosingBadge = (val: string) => {
        const upper = (val || "").toUpperCase();
        if (upper.includes("CLOSE")) return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
        if (upper.includes("OPEN")) return "bg-rose-500/15 text-rose-400 border border-rose-500/30";
        return "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30";
    };

    return (
        <div className={`flex flex-col ${LAYOUT.sectionGap}`}>
            {/* Filters */}
            {hasFilter && (
                <div className={`flex items-center gap-1 flex-wrap ${ANIM.filterTransition}`}>
                    {selectedGI && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedGI(null)}><X className="h-2.5 w-2.5" />{selectedGI}</Badge>}
                    {selectedProgram && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20 max-w-[180px] truncate`} onClick={() => setSelectedProgram(null)}><X className="h-2.5 w-2.5" />{selectedProgram}</Badge>}
                    {selectedClosing && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedClosing(null)}><X className="h-2.5 w-2.5" />{selectedClosing}</Badge>}
                    {doneFilter !== null && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setDoneFilter(null)}><X className="h-2.5 w-2.5" />{doneFilter ? "Close" : "Open"}</Badge>}
                    <button className={`${TEXT.badge} text-primary hover:underline ml-1 flex items-center gap-0.5`} onClick={clearAllFilters}><RefreshCw className="h-2.5 w-2.5" />Reset</button>
                </div>
            )}

            {/* KPI */}
            <div className="rounded-md overflow-hidden border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300" style={{ background: COLORS.cardBg }}>
                <div className="flex items-center gap-0 divide-x divide-border/20">
                    <div className="flex-1 px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className={`${TEXT.kpiLabel} text-muted-foreground uppercase tracking-wider`}>Progress CE Gardu Induk</span>
                            <span className="text-sm font-bold" style={{ color: COLORS.selesai }}>{stats.pct}%</span>
                        </div>
                        <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ background: "rgba(239,68,68,0.25)" }}>
                            <div className={`h-full rounded-l-full ${ANIM.chartTransition}`}
                                style={{ width: `${stats.pct}%`, background: `linear-gradient(90deg, #22c55e, #10b981)` }} />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className={`${TEXT.kpiLabel}`} style={{ color: COLORS.selesai }}>{stats.selesai} Close</span>
                            <span className={`${TEXT.kpiLabel}`} style={{ color: COLORS.belum }}>{stats.belum} Open</span>
                        </div>
                    </div>
                    <div className={`px-4 py-3 text-center min-w-[90px] cursor-pointer transition-colors rounded-sm ${doneFilter === true ? "ring-1 ring-emerald-500/30 bg-emerald-500/10" : "hover:bg-emerald-500/5"}`}
                        onClick={() => setDoneFilter(prev => prev === true ? null : true)}>
                        <div className={`${TEXT.kpiValue} font-extrabold leading-none`} style={{ color: COLORS.selesai }}>{stats.selesai}</div>
                        <div className={`${TEXT.kpiLabel} mt-1 text-muted-foreground uppercase`}>Close</div>
                    </div>
                    <div className={`px-4 py-3 text-center min-w-[90px] cursor-pointer transition-colors rounded-sm ${doneFilter === false ? "ring-1 ring-rose-500/30 bg-rose-500/10" : "hover:bg-rose-500/5"}`}
                        onClick={() => setDoneFilter(prev => prev === false ? null : false)}>
                        <div className={`${TEXT.kpiValue} font-extrabold leading-none`} style={{ color: COLORS.belum }}>{stats.belum}</div>
                        <div className={`${TEXT.kpiLabel} mt-1 text-muted-foreground uppercase`}>Open</div>
                    </div>
                    <div className="px-4 py-3 text-center hidden sm:block md:min-w-[90px]">
                        <div className={`${TEXT.kpiValue} font-extrabold leading-none text-muted-foreground`}>{stats.total}</div>
                        <div className={`${TEXT.kpiLabel} mt-1 text-muted-foreground uppercase`}>Total CE</div>
                    </div>
                </div>
            </div>

            {/* Jadwal Cards — COLLAPSIBLE */}
            <div className="rounded-md border border-transparent hover:border-primary/10 transition-all" style={{ background: COLORS.cardBg }}>
                <button
                    className={`${LAYOUT.headerPadding} w-full flex items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-border/5`}
                    onClick={() => setIsScheduleOpen(prev => !prev)}
                >
                    <CalendarDays className="size-4 text-primary/50" />
                    <span className={`${TEXT.cardTitle} font-medium text-foreground tracking-tight`}>Jadwal CE Gardu Induk</span>
                    <div className="flex items-center gap-1.5 ml-2">
                        {todaySchedules.length > 0 && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] tabular-nums font-mono">{todaySchedules.length} Today</Badge>}
                        {overdueSchedules.length > 0 && <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] tabular-nums font-mono">{overdueSchedules.length} Overdue</Badge>}
                    </div>
                    <span className={`text-[10px] ml-auto ${isScheduleOpen ? 'text-muted-foreground' : 'text-primary/60 animate-pulse'}`}>{isScheduleOpen ? 'Collapse' : '▸ Click to expand'}</span>
                    {isScheduleOpen ? <ChevronUp className="size-3.5 text-muted-foreground ml-1" /> : <ChevronDown className="size-3.5 text-primary/50 ml-1" />}
                </button>
                <AnimatePresence>
                    {isScheduleOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                            <div className={`grid grid-cols-1 md:grid-cols-2 ${LAYOUT.cardGap} p-2`}>
                            {/* Today Card */}
                            <div className="rounded-md flex flex-col border border-transparent relative group overflow-hidden" style={{ background: "rgba(255,255,255,0.01)" }}>
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 opacity-60" />
                                <div className={`${LAYOUT.headerPadding} pl-4 flex items-center justify-center gap-2 border-b border-border/5`}>
                                    <CalendarDays className="size-4 text-emerald-500/70" />
                                    <span className="text-xs font-medium text-foreground/80">Today</span>
                                    {todaySchedules.length > 0 && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] tabular-nums font-mono">{todaySchedules.length}</Badge>}
                                </div>
                                <div className="flex-1 p-0">
                                    {todaySchedules.length > 0 ? (
                                        <ul className="divide-y divide-border/5">
                                            {todaySchedules.map((r, i) => (
                                                <li key={i} className="px-4 py-2 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                                                    <div className="flex flex-col max-w-[70%]">
                                                        <span className="text-xs font-semibold text-foreground/90">{r[H.GI]}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate">{r[H.BAY]}</span>
                                                        <span className="text-[10px] text-primary/60 font-medium">{r[H.PROGRAM]}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 whitespace-nowrap">Target: {r[H.RENCANA]}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                            <CalendarDays className="size-5 text-emerald-500/15" />
                                            <span className="text-[10px] text-muted-foreground/40">Tidak ada jadwal hari ini</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Overdue Card */}
                            <div className="rounded-md flex flex-col border border-transparent relative group overflow-hidden" style={{ background: "rgba(255,255,255,0.01)" }}>
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 opacity-60" />
                                <div className={`${LAYOUT.headerPadding} pl-4 flex items-center justify-center gap-2 border-b border-border/5`}>
                                    <AlertCircle className="size-4 text-rose-500/70" />
                                    <span className="text-xs font-medium text-foreground/80">Overdue</span>
                                    {overdueSchedules.length > 0 && <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] tabular-nums font-mono">{overdueSchedules.length}</Badge>}
                                </div>
                                <div className="flex-1 p-0">
                                    {overdueSchedules.length > 0 ? (
                                        <ul className="divide-y divide-border/5">
                                            {overdueSchedules.map((r, i) => (
                                                <li key={i} className="px-4 py-2 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                                                    <div className="flex flex-col max-w-[65%]">
                                                        <span className="text-xs font-semibold text-foreground/90 truncate">{r[H.GI]} <span className="text-border/40 px-1">›</span> {r[H.BAY]}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate">{r[H.PROGRAM]}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-rose-400/80 bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10 whitespace-nowrap">Target: {r[H.RENCANA]}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                            <AlertCircle className="size-5 text-rose-500/15" />
                                            <span className="text-[10px] text-muted-foreground/40">Tidak ada yang terlewat</span>
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
                    className={`${LAYOUT.headerPadding} w-full flex items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-border/5`}
                    onClick={() => setIsComboOpen(prev => !prev)}
                >
                    <TrendingUp className="size-4 text-primary/50" />
                    <span className={`${TEXT.cardTitle} font-medium text-foreground tracking-tight`}>Rencana Penyelesaian Anomali Gardu Induk 2026</span>
                    <span className={`text-[10px] ml-auto ${isComboOpen ? 'text-muted-foreground' : 'text-primary/60 animate-pulse'}`}>{isComboOpen ? 'Collapse' : '▸ Click to expand'}</span>
                    {isComboOpen ? <ChevronUp className="size-3.5 text-muted-foreground ml-1" /> : <ChevronDown className="size-3.5 text-primary/50 ml-1" />}
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

            {/* 2 Donut Charts */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 ${LAYOUT.cardGap}`}>
                <div className="overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
                    <div className={`${LAYOUT.headerPadding} flex justify-center items-center gap-2 z-10 opacity-70 border-b border-border/10`}>
                        <span className={`${TEXT.cardTitle} font-semibold`}>Per ULTG</span>
                        {selectedUltg && (
                             <button onClick={() => setSelectedUltg(null)} className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1">
                                 <RefreshCw className="h-3 w-3" /> Reset
                             </button>
                        )}
                    </div>
                    <div className="p-1" style={{ flex: 1, minHeight: "clamp(220px, 28vh, 400px)" }}>
                        <ReactECharts option={donutULTG} style={{ height: "100%", width: "100%" }} notMerge={false} lazyUpdate={true} onEvents={onClickUltg} />
                    </div>
                </div>

                <div className="overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
                    <div className={`${LAYOUT.headerPadding} flex justify-center items-center gap-2 z-10 opacity-70 border-b border-border/10`}>
                        <span className={`${TEXT.cardTitle} font-semibold`}>Per Program</span>
                        {selectedProgram && (
                             <button onClick={() => setSelectedProgram(null)} className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1">
                                 <RefreshCw className="h-3 w-3" /> Reset
                             </button>
                        )}
                    </div>
                    <div className="p-1" style={{ flex: 1, minHeight: "clamp(220px, 28vh, 400px)" }}>
                        <ReactECharts option={donutProgram} style={{ height: "100%", width: "100%" }} notMerge={false} lazyUpdate={true} onEvents={onClickProgram} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-md border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300" style={{ background: COLORS.cardBg }}>
                <div className={`${LAYOUT.headerPadding} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <span className={`${TEXT.cardTitle} font-semibold`}>Detail Aset & Pekerjaan</span>
                        <Badge variant="secondary" className={`${TEXT.badge}`}>{tableRows.length}</Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                        <input
                            type="text"
                            placeholder="Cari data..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs bg-white/[0.03] border border-border/10 rounded-md focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 w-[220px] placeholder:text-muted-foreground/40 transition-all"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                                <X className="size-3 text-muted-foreground/50 hover:text-foreground" />
                            </button>
                        )}
                    </div>
                </div>
                {/* Column Filters */}
                <div className="px-2 pb-2 flex flex-wrap gap-1.5">
                    {TABLE_COLS.filter(c => c.filterable).map(col => {
                        const uniqueVals = [...new Set(filteredRows.map(r => r[col.key]).filter(Boolean))].sort();
                        return (
                            <select
                                key={col.key}
                                value={columnFilters[col.key] || ""}
                                onChange={e => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                className="text-[10px] bg-white/[0.03] border border-border/10 rounded px-2 py-1 text-muted-foreground focus:outline-none focus:border-primary/30 cursor-pointer appearance-none min-w-[100px]"
                            >
                                <option value="">{col.label} (Semua)</option>
                                {uniqueVals.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        );
                    })}
                    {Object.values(columnFilters).some(v => v) && (
                        <button onClick={() => setColumnFilters({})} className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded border border-border/10 hover:border-primary/20 transition-colors">
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
                            {tableRows.length > 0 ? tableRows.map((r, i) => {
                                const isHl = selectedRowKey === i;
                                const done = isDone(r);
                                return (
                                    <TableRow
                                        key={i}
                                        className={`${LAYOUT.tableRowHeight} border-b border-border/10 cursor-pointer ${ANIM.hoverTransition}
                                            ${isHl ? "bg-indigo-500/10 ring-1 ring-indigo-500/30" : done ? "bg-emerald-500/[0.03] hover:bg-muted/10" : "hover:bg-muted/10"}
                                        `}
                                        onClick={() => setSelectedRowKey(prev => prev === i ? null : i)}
                                    >
                                        <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center font-mono text-muted-foreground`}>{i + 1}</TableCell>
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
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${getClosingBadge(val)}`}>
                                                        {val || "—"}
                                                    </span>
                                                </TableCell>
                                            );
                                            if (hdr === H.RENCANA) return (
                                                <TableCell key={hdr} className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                                                    <span className={`${r[H.REALISASI] ? "line-through opacity-50 text-[10px]" : ""}`}>{val || "—"}</span>
                                                </TableCell>
                                            );
                                            if (hdr === H.REALISASI) return (
                                                <TableCell key={hdr} className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                                                    {val ? <span className="text-emerald-400">{val}</span> : <span className="text-muted-foreground/30">—</span>}
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
            </div>
        </div>
    );
}
