"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, AlertCircle, RefreshCw, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Search, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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

const H = {
    ULTG: "ULTG",
    GI: "Gardu Induk",
    NAMA_TOWER: "Nama Tower",
    KONDISI: "Kondisi Terkini",
    KONDISI_AWAL: "Kondisi Awal",
    TGL_RENCANA: "TGL RENCANA TINJUT",
    TGL_REALISASI: "TGL REALISASI TINJUT",
    URAIAN: "Uraian",
    FUCTLOC: "Fuctloc Tower",
} as const;

/** Extract numeric level from "3-Fair" → 3 */
const kondisiLevel = (val: string): number => {
    const m = (val || "").match(/^(\d)/);
    return m ? parseInt(m[1], 10) : 0;
};

/** CE = ROW dengan pohon (Fuctloc > 0), atau uraian lain dengan kondisi buruk */
const isCE = (r: Row): boolean => {
    if (r[H.URAIAN] === "ROW") {
        return parseInt(r[H.FUCTLOC] || "0", 10) > 0;
    }
    const level = kondisiLevel(r[H.KONDISI_AWAL]);
    if (r[H.URAIAN] === "Proteksi Anti Binatang") return level >= 5;
    if (r[H.URAIAN] === "Kondisi Tanah Tapak Tower") return level >= 4;
    if (r[H.URAIAN] === "Asset Health Index (AHI)") return level >= 4;
    return false;
};

/** CE item count: ROW = jumlah pohon (Fuctloc), others = 1 */
const ceItemCount = (r: Row): number => {
    if (r[H.URAIAN] === "ROW") {
        const n = parseInt(r[H.FUCTLOC] || "0", 10);
        return isNaN(n) ? 0 : n;
    }
    return 1;
};

/** Close = kondisi membaik (Terkini < Awal), Open = sama atau buruk */
const isCEClose = (r: Row): boolean => {
    return kondisiLevel(r[H.KONDISI]) < kondisiLevel(r[H.KONDISI_AWAL]);
};

type Row = Record<string, string>;
type SortKey = string | null;
type SortDir = "asc" | "desc";

const TABLE_COLS: { key: string; label: string; center?: boolean; minW?: string; filterable: boolean }[] = [
    { key: H.ULTG, label: "ULTG", center: true, filterable: true },
    { key: H.GI, label: "Gardu Induk", filterable: true },
    { key: H.NAMA_TOWER, label: "Tower", filterable: false },
    { key: H.URAIAN, label: "Uraian", minW: "200px", filterable: true },
    { key: H.KONDISI, label: "Kondisi", center: true, filterable: true },
    { key: H.TGL_RENCANA, label: "TGL Rencana", center: true, filterable: false },
    { key: H.TGL_REALISASI, label: "TGL Realisasi", center: true, filterable: false },
];

/* Chart palette — distinguishable hues for bar/donut series */
const CHART_PALETTE = [
    GLOBAL_COLORS.chart.blue, GLOBAL_COLORS.chart.amber, GLOBAL_COLORS.chart.violet,
    GLOBAL_COLORS.chart.cyan, GLOBAL_COLORS.chart.pink, GLOBAL_COLORS.teal,
    GLOBAL_COLORS.statusHi["CRITICAL"], GLOBAL_COLORS.statusHi["POOR"],
    GLOBAL_COLORS.statusHi["VERY GOOD"], GLOBAL_COLORS.purple,
];
const COLOR_SELESAI = GLOBAL_COLORS.statusHi["VERY GOOD"];
const COLOR_DESTRUCTIVE = GLOBAL_COLORS.statusHi["CRITICAL"];

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

const normalizeStatus = (val: string) => {
    const lower = (val || "").toLowerCase();
    if (lower.includes("critical") || lower.includes("5-")) return "Critical";
    if (lower.includes("poor") || lower.includes("4-")) return "Poor";
    if (lower.includes("fair") || lower.includes("3-")) return "Fair";
    if (lower.includes("good") && lower.includes("very")) return "Very Good";
    if (lower.includes("good") || lower.includes("2-")) return "Good";
    if (lower.includes("1-")) return "Very Good";
    return val || "Tanpa Status";
};

export function CEJaringanContent({ sheetData }: { sheetData: any }) {
    const allRows: Row[] = sheetData?.rows || [];
    const allHeaders: string[] = sheetData?.headers || [];
    const rawRows = useMemo(() => allRows.filter(isCE), [allRows]);
    const { resolvedTheme } = useTheme();
    const themeKey = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";
    const ec = ECHART_COLORS[themeKey];

    /* ── Filter States ── */
    const [selectedUltg, setSelectedUltg] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [selectedUraian, setSelectedUraian] = useState<string | null>(null);
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
        setSelectedUltg(null); setSelectedStatus(null);
        setSelectedUraian(null); setSelectedRowKey(null);
        setSearchQuery(""); setColumnFilters({}); setDoneFilter(null);
        setPage(1);
    }, []);
    const hasFilter = selectedUltg || selectedStatus || selectedUraian || searchQuery || doneFilter !== null || Object.values(columnFilters).some(v => v);

    /* ── Schedule Logic ── */
    const { todaySchedules, overdueSchedules } = useMemo(() => {
        const today: Row[] = [];
        const overdue: Row[] = [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        rawRows.forEach(r => {
            if (isCEClose(r)) return; // sudah realisasi = skip

            const parsedRencana = parseCustomDate(r[H.TGL_RENCANA]);
            if (!parsedRencana) return;

            if (isToday(parsedRencana)) {
                today.push(r);
            } else if (isBefore(parsedRencana, startOfToday)) {
                overdue.push(r);
            }
        });
        return { todaySchedules: today, overdueSchedules: overdue };
    }, [rawRows]);

    /* Cross-filter architecture — setiap dimensi ambil data tanpa filter dirinya sendiri:
     *  rowsForUltg   = allRows filtered by [status]        → data ULTG donut
     *  rowsForStatus = allRows filtered by [ultg]          → data Status donut + statusKondisiStats
     *  baseRows      = allRows filtered by [ultg, status]  → close/open bar (StatusKpiBar1)
     *  ceBaseRows    = rawRows filtered by [ultg, status]  → data Uraian donut
     *  filteredCeRows= ceBaseRows filtered by [uraian]     → tabel, progressStats open/close
     *  totalCE       = ceItemCount dari rawRows unfiltered → SummaryCard total (fixed)
     */
    const rowsForUltg = useMemo(() => {
        let r = allRows;
        if (selectedStatus) r = r.filter(x => normalizeStatus(x[H.KONDISI]) === selectedStatus);
        return r;
    }, [allRows, selectedStatus]);

    const rowsForStatus = useMemo(() => {
        let r = allRows;
        if (selectedUltg) r = r.filter(x => x[H.ULTG] === selectedUltg);
        return r;
    }, [allRows, selectedUltg]);

    const baseRows = useMemo(() => {
        let r = allRows;
        if (selectedUltg) r = r.filter(x => x[H.ULTG] === selectedUltg);
        if (selectedStatus) r = r.filter(x => normalizeStatus(x[H.KONDISI]) === selectedStatus);
        return r;
    }, [allRows, selectedUltg, selectedStatus]);

    const ceBaseRows = useMemo(() => {
        let r = rawRows;
        if (selectedUltg) r = r.filter(x => x[H.ULTG] === selectedUltg);
        if (selectedStatus) r = r.filter(x => normalizeStatus(x[H.KONDISI]) === selectedStatus);
        return r;
    }, [rawRows, selectedUltg, selectedStatus]);

    const filteredCeRows = useMemo(() => {
        let r = ceBaseRows;
        if (selectedUraian) r = r.filter(x => x[H.URAIAN] === selectedUraian);
        return r;
    }, [ceBaseRows, selectedUraian]);

    /* Total CE fixed — tidak berubah saat filter aktif */
    const totalCE = useMemo(() =>
        rawRows.reduce((sum, x) => sum + ceItemCount(x), 0)
    , [rawRows]);

    /* ── Filter Engine — tabel pakai filteredCeRows + doneFilter ── */
    const filteredRows = useMemo(() => {
        let r = filteredCeRows;
        if (doneFilter !== null) r = r.filter(x => isCEClose(x) === doneFilter);
        if (sortKey) {
            r = [...r].sort((a, b) => {
                const va = (a[sortKey] || "").toLowerCase();
                const vb = (b[sortKey] || "").toLowerCase();
                const cmp = va.localeCompare(vb, "id", { numeric: true });
                return sortDir === "asc" ? cmp : -cmp;
            });
        }
        return r;
    }, [filteredCeRows, doneFilter, sortKey, sortDir]);

    /* ── Table Rows (search + column filters on top of filteredRows) ── */
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

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [tableRows.length]);

    /* ── Aggregation ── */
    const stats = useMemo(() => {
        /* Close/Open + Uraian = CE rows only, ceItemCount */
        let selesaiCount = 0;
        let belumCount = 0;
        const uraianCounts: Record<string, number> = {};

        filteredRows.forEach(r => {
            const items = ceItemCount(r);
            if (isCEClose(r)) selesaiCount += items; else belumCount += items;
            const ur = r[H.URAIAN] || "Tanpa Keterangan";
            uraianCounts[ur] = (uraianCounts[ur] || 0) + items;
        });

        const topUraian = Object.entries(uraianCounts)
            .map(([name, val]) => ({ name, value: val }))
            .sort((a, b) => b.value - a.value);

        const total = selesaiCount + belumCount;
        const pct = total > 0 ? parseFloat(((selesaiCount / total) * 100).toFixed(2)) : 0;

        return { total, selesai: selesaiCount, belum: belumCount, pct, topUraian };
    }, [filteredRows]);

    /* ── Progress CE — dari filteredCeRows, ceItemCount (ROW=pohon) ── */
    const progressStats = useMemo(() => {
        let selesai = 0, belum = 0, totalPohon = 0, rowItem = 0;
        filteredCeRows.forEach(x => {
            const items = ceItemCount(x);
            if (x[H.URAIAN] === "ROW") { totalPohon += items; rowItem++; }
            if (isCEClose(x)) selesai += items; else belum += items;
        });
        const total = selesai + belum;
        const pct = total > 0 ? parseFloat(((selesai / total) * 100).toFixed(2)) : 0;
        return { total, selesai, belum, pct, totalPohon, rowItem };
    }, [filteredCeRows]);

    /* ── Status Kondisi — dari rowsForStatus (filtered by ultg only, NOT status) ── */
    const statusKondisiStats = useMemo(() => {
        const order = ["Very Good", "Good", "Fair", "Poor", "Critical"] as const;
        const counts: Record<string, number> = {};
        rowsForStatus.forEach(r => {
            const s = normalizeStatus(r[H.KONDISI]);
            counts[s] = (counts[s] || 0) + 1;
        });
        return { order, counts, total: rowsForStatus.length };
    }, [rowsForStatus]);

    /* ── Close/Open — dari baseRows (filtered by ultg + status) ── */
    const closeOpenRowStats = useMemo(() => {
        let close = 0, open = 0;
        baseRows.forEach(r => { if (isCEClose(r)) close++; else open++; });
        return { close, open };
    }, [baseRows]);

    /* ── Donut data ──
     * ULTG & Status = baseRows (allRows filtered), 1/row
     * Detail CE (Uraian) = filteredCeRows (CE only filtered), ceItemCount
     */
    const donutData = useMemo(() => {
        /* ULTG — dari rowsForUltg (filtered by status only, NOT ultg) */
        const ultgCounts: Record<string, number> = {};
        rowsForUltg.forEach(r => {
            const u = r[H.ULTG] || "Unknown";
            ultgCounts[u] = (ultgCounts[u] || 0) + 1;
        });

        /* Status — dari rowsForStatus (filtered by ultg only, NOT status) */
        const statusCounts: Record<string, number> = {};
        rowsForStatus.forEach(r => {
            const s = normalizeStatus(r[H.KONDISI]);
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });

        /* Uraian — dari ceBaseRows (filtered by ultg+status, NOT uraian) */
        const ceRows = doneFilter !== null ? ceBaseRows.filter(x => isCEClose(x) === doneFilter) : ceBaseRows;
        const uraianCounts: Record<string, number> = {};
        ceRows.forEach(r => {
            const ur = r[H.URAIAN] || "Tanpa Keterangan";
            uraianCounts[ur] = (uraianCounts[ur] || 0) + ceItemCount(r);
        });

        const ultg = Object.entries(ultgCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);
        const status = Object.entries(statusCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);
        const uraian = Object.entries(uraianCounts).sort(([, a], [, b]) => b - a).map(([k]) => k);

        return { ultg, status, uraian, ultgCounts, statusCounts, uraianCounts };
    }, [rowsForUltg, rowsForStatus, ceBaseRows, doneFilter]);

    /* ── Combo Chart: Rencana Penyelesaian Anomali ── */
    /* ── Bar Chart: Open/Close per Bulan ── */
    const comboChartOption = useMemo(() => {
        const monthOrder = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
        const monthShort: Record<string, string> = { JANUARI: "JAN", FEBRUARI: "FEB", MARET: "MAR", APRIL: "APR", MEI: "MEI", JUNI: "JUN", JULI: "JUL", AGUSTUS: "AGU", SEPTEMBER: "SEP", OKTOBER: "OKT", NOVEMBER: "NOV", DESEMBER: "DES" };
        const monthsFound = new Set<string>();
        const monthOpenClose: Record<string, { open: number; close: number }> = {};

        rawRows.forEach(r => {
            const dateStr = r[H.TGL_RENCANA] || "";
            const parsed = parseCustomDate(dateStr);
            const items = ceItemCount(r);
            const done = isCEClose(r);

            const key = parsed ? monthOrder[parsed.getMonth()] || "RESCHEDULE" : "RESCHEDULE";
            monthsFound.add(key);
            if (!monthOpenClose[key]) monthOpenClose[key] = { open: 0, close: 0 };
            if (done) monthOpenClose[key].close += items; else monthOpenClose[key].open += items;
        });

        const sortedMonths = [...monthOrder.filter(m => monthsFound.has(m)), ...(monthsFound.has("RESCHEDULE") ? ["RESCHEDULE"] : [])];
        const xLabels = sortedMonths.map(m => m === "RESCHEDULE" ? "Dijadwalkan\nUlang" : (monthShort[m] || m.slice(0, 3)));

        const tp = getTooltipPreset(themeKey);
        return {
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" as const, ...tp },
            legend: { top: 0, textStyle: { color: ec.text, fontSize: ECHART_FONT.label }, itemWidth: 12, itemHeight: 8, itemGap: 12 },
            grid: { left: 40, right: 16, top: 35, bottom: 25, containLabel: false },
            xAxis: { type: "category" as const, data: xLabels, axisLabel: { color: ec.text, fontSize: ECHART_FONT.label }, axisLine: { lineStyle: { color: ec.gridLine } } },
            yAxis: { type: "value" as const, axisLabel: { color: ec.text, fontSize: ECHART_FONT.label }, splitLine: { lineStyle: { color: ec.gridLine } } },
            series: [
                {
                    name: "Close", type: "bar" as const, stack: "total",
                    data: sortedMonths.map(m => monthOpenClose[m]?.close || 0),
                    itemStyle: { color: COLOR_SELESAI, borderRadius: [0, 0, 0, 0] },
                    barMaxWidth: CHART.bar.barMaxWidth,
                },
                {
                    name: "Open", type: "bar" as const, stack: "total",
                    data: sortedMonths.map(m => monthOpenClose[m]?.open || 0),
                    itemStyle: { color: COLOR_DESTRUCTIVE, borderRadius: [4, 4, 0, 0] },
                    barMaxWidth: CHART.bar.barMaxWidth,
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

    /* ── ULTG alias map — display "ULTG Bogor Kota", filter by raw name ── */
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

    /* ── Chart Options ── */
    const donutULTG = useMemo(() => {
        const data = donutData.ultg.map((name, i) => ({
            name: ultgAliasMap.toAlias[name] || name,
            value: donutData.ultgCounts[name] || 0,
            itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
        }));
        const selectedAlias = selectedUltg ? (ultgAliasMap.toAlias[selectedUltg] || selectedUltg) : null;
        return mkDonut(data, selectedAlias);
    }, [donutData, mkDonut, selectedUltg, ultgAliasMap]);

    const donutStatus = useMemo(() => {
        const donutStatusColor = (n: string) => {
            if (n === "Critical") return GLOBAL_COLORS.statusHi["CRITICAL"];
            if (n === "Poor") return GLOBAL_COLORS.statusHi["POOR"];
            if (n === "Fair") return GLOBAL_COLORS.statusHi["FAIR"];
            if (n === "Good") return GLOBAL_COLORS.statusHi["GOOD"];
            return GLOBAL_COLORS.statusHi["VERY GOOD"];
        };
        const data = donutData.status.map((name) => ({
            name, value: donutData.statusCounts[name] || 0,
            itemStyle: {
                color: donutStatusColor(name),
            }
        }));
        return mkDonut(data, selectedStatus);
    }, [donutData, mkDonut, selectedStatus]);

    const donutUraian = useMemo(() => {
        const data = donutData.uraian.map((name, i) => ({
            name, value: donutData.uraianCounts[name] || 0,
            itemStyle: {
                color: CHART_PALETTE[(i + 4) % CHART_PALETTE.length],
            }
        }));
        return mkDonut(data, selectedUraian);
    }, [donutData, mkDonut, selectedUraian]);

    /* ── Memoized click handlers (CRITICAL: prevents echarts-for-react re-binds) ── */
    const onClickUltg = useMemo(() => ({
        click: (p: { name?: string }) => {
            if (!p.name) return;
            const original = ultgAliasMap.toOriginal[p.name] || p.name;
            setSelectedUltg(prev => prev === original ? null : original);
        }
    }), [ultgAliasMap]);
    const onClickStatus = useMemo(() => ({
        click: (p: { name?: string }) => { if (p.name) setSelectedStatus(prev => prev === p.name ? null : p.name!); }
    }), []);
    const onClickUraian = useMemo(() => ({
        click: (p: { name?: string }) => { if (p.name) setSelectedUraian(prev => prev === p.name ? null : p.name!); }
    }), []);

    /* ── Render Helper ── */
    const getStatusColor = (val: string): string => {
        const s = normalizeStatus(val);
        if (s === "Critical") return GLOBAL_COLORS.statusHi["CRITICAL"];
        if (s === "Poor") return GLOBAL_COLORS.statusHi["POOR"];
        if (s === "Fair") return GLOBAL_COLORS.statusHi["FAIR"];
        return GLOBAL_COLORS.statusHi["VERY GOOD"];
    };

    return (
        <div className="flex flex-col gap-3 relative">
            {hasFilter && (
                <div className="absolute -top-10 right-0 flex items-center gap-1.5 flex-wrap z-10">
                    {selectedUltg && <Badge variant="outline" className="ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary" onClick={() => setSelectedUltg(null)}><X className="h-2.5 w-2.5" />{selectedUltg}</Badge>}
                    {selectedStatus && <Badge variant="outline" className="ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary" onClick={() => setSelectedStatus(null)}><X className="h-2.5 w-2.5" />{selectedStatus}</Badge>}
                    {selectedUraian && <Badge variant="outline" className="ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary max-w-[180px] truncate" onClick={() => setSelectedUraian(null)}><X className="h-2.5 w-2.5" />{selectedUraian}</Badge>}
                    {doneFilter !== null && <Badge variant="outline" className="ds-data cursor-pointer gap-1 hover:bg-destructive/20 border-primary/30 bg-primary/10 text-primary" onClick={() => setDoneFilter(null)}><X className="h-2.5 w-2.5" />{doneFilter ? "Close" : "Open"}</Badge>}
                    <button className="ds-data text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-0.5 rounded border border-border ds-transition" onClick={clearAllFilters}><RefreshCw className="h-2.5 w-2.5" />Reset</button>
                </div>
            )}

            {/* Status Kondisi + Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
                <StatusKpiBar1
                    title="Status Kondisi Terkini"
                    items={statusKondisiStats.order.map(status => ({
                        key: status,
                        count: statusKondisiStats.counts[status] || 0,
                        color: (() => {
                            if (status === "Critical") return GLOBAL_COLORS.statusHi["CRITICAL"];
                            if (status === "Poor") return GLOBAL_COLORS.statusHi["POOR"];
                            if (status === "Fair") return GLOBAL_COLORS.statusHi["FAIR"];
                            if (status === "Good") return GLOBAL_COLORS.statusHi["GOOD"];
                            return GLOBAL_COLORS.statusHi["VERY GOOD"];
                        })(),
                    }))}
                    activeStatus={selectedStatus}
                    onStatusFilter={setSelectedStatus}
                    close={closeOpenRowStats.close}
                    open={closeOpenRowStats.open}
                    activeDone={doneFilter}
                    onDoneFilter={setDoneFilter}
                    shadowColor={ec.shadow}
                />
                <SummaryCard1
                    title="Total CE Transmisi"
                    total={totalCE}
                    items={[
                        { key: false, label: "Open", count: progressStats.belum, color: COLOR_DESTRUCTIVE },
                        { key: true, label: "Close", count: progressStats.selesai, color: COLOR_SELESAI },
                    ]}
                    activeKey={doneFilter}
                    onFilter={(val) => setDoneFilter(val as boolean | null)}
                    shadowColor={ec.shadow}
                />
            </div>

            {/* 3 Donut Charts */}
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
                            Status Kondisi
                            {selectedStatus && (
                                <button onClick={() => setSelectedStatus(null)} className="ds-small hover:text-primary ds-transition flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3" /> Reset
                                </button>
                            )}
                        </div>
                    </CardTitle>
                    <ReactECharts option={donutStatus} opts={{ renderer: "svg" }} style={{ height: donutHeight }} onEvents={onClickStatus} notMerge />
                </Card>

                <Card className="border-border py-0 gap-0 flex-col">
                    <CardTitle className="text-center px-3 py-2">
                        <div className="flex justify-center items-center gap-2">
                            Detail Common Enemy
                            {selectedUraian && (
                                <button onClick={() => setSelectedUraian(null)} className="ds-small hover:text-primary ds-transition flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3" /> Reset
                                </button>
                            )}
                        </div>
                    </CardTitle>
                    <div className="relative">
                        <ReactECharts option={donutUraian} opts={{ renderer: "svg" }} style={{ height: donutHeight }} onEvents={onClickUraian} notMerge />
                        <p className="ds-small italic absolute bottom-2 left-3 pointer-events-none">
                            ROW: {progressStats.rowItem.toLocaleString("id-ID")} item · {progressStats.totalPohon.toLocaleString("id-ID")} pohon
                        </p>
                    </div>
                </Card>
            </div>


            {/* Table — searchable, filterable, sortable */}
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
                {/* Column Filters Row */}
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                    {TABLE_COLS.filter(c => c.filterable).map(col => {
                        const uniqueVals = [...new Set(filteredRows.map(r => r[col.key]).filter(Boolean))].sort();
                        return (
                            <select
                                key={col.key}
                                value={columnFilters[col.key] || ""}
                                onChange={e => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                className="ds-small bg-muted border border-border rounded px-2 py-1 text-muted-foreground focus:outline-none focus:border-primary/30 cursor-pointer appearance-none min-w-[100px]"
                            >
                                <option value="">{col.label} (Semua)</option>
                                {uniqueVals.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        );
                    })}
                    {Object.values(columnFilters).some(v => v) && (
                        <button onClick={() => setColumnFilters({})} className="ds-small text-muted-foreground hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded border border-border ds-transition">
                            <X className="size-2.5" /> Reset Filter
                        </button>
                    )}
                </div>
                <div className="overflow-auto max-h-[50vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                            <TableRow className="h-8 border-b border-border hover:bg-transparent">
                                <TableHead className="ds-small h-8 px-2 text-center w-8">No</TableHead>
                                {allHeaders.map(hdr => (
                                    <TableHead
                                        key={hdr}
                                        className="ds-small h-8 px-2 cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                                        onClick={() => handleSort(hdr)}
                                    >
                                        {hdr}<SortIcon col={hdr} />
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableRows.length > 0 ? paginatedRows.map((r, idx) => {
                                const gi = (page - 1) * PAGE_SIZE + idx;
                                const isHl = selectedRowKey === gi;
                                const done = isCEClose(r);
                                return (
                                    <TableRow
                                        key={gi}
                                        className={`h-8 border-b border-border cursor-pointer ds-transition
                                            ${isHl ? "bg-foreground/5 border-l-2 border-l-primary" : done ? "bg-ds-hover hover:bg-ds-hover" : "hover:bg-ds-hover"}
                                        `}
                                        onClick={() => { setSelectedRowKey(prev => prev === gi ? null : gi); }}
                                    >
                                        <TableCell className="ds-data text-muted-foreground px-2 py-0 text-center">{gi + 1}</TableCell>
                                        {allHeaders.map(hdr => {
                                            const val = r[hdr] || "";
                                            if (hdr === H.ULTG) return (
                                                <TableCell key={hdr} className="ds-small px-2 py-0 text-center">
                                                    <button className={`ds-small hover:text-primary ds-transition ${selectedUltg === val ? "text-primary" : ""}`}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedUltg(prev => prev === val ? null : val) }}>
                                                        {val || "—"}
                                                    </button>
                                                </TableCell>
                                            );
                                            if (hdr === H.KONDISI) return (
                                                <TableCell key={hdr} className="ds-small px-2 py-0 text-center">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded ds-data border"
                                                        style={{ color: getStatusColor(val), backgroundColor: `${getStatusColor(val)}15`, borderColor: `${getStatusColor(val)}30` }}>
                                                        {normalizeStatus(val)}
                                                    </span>
                                                </TableCell>
                                            );
                                            if (hdr === H.TGL_RENCANA) return (
                                                <TableCell key={hdr} className="ds-data px-2 py-0 text-center whitespace-nowrap">
                                                    <span className={r[H.TGL_REALISASI] ? "line-through opacity-50" : ""}>{val || "—"}</span>
                                                </TableCell>
                                            );
                                            if (hdr === H.TGL_REALISASI) return (
                                                <TableCell key={hdr} className="ds-data px-2 py-0 text-center whitespace-nowrap">
                                                    {val ? <span style={{ color: COLOR_SELESAI }}>{val}</span> : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                            );
                                            return (
                                                <TableCell key={hdr} className="ds-small px-2 py-0 text-muted-foreground max-w-[200px] truncate" title={val}>
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
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                        <span className="ds-small">
                            Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tableRows.length)} dari {tableRows.length} baris
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(1)} disabled={page === 1}
                                className="px-2 py-1 ds-small rounded border border-border disabled:opacity-30 hover:bg-ds-hover ds-transition">
                                ««
                            </button>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-2 py-1 ds-small rounded border border-border disabled:opacity-30 hover:bg-ds-hover ds-transition">
                                ‹ Prev
                            </button>
                            <span className="px-3 py-1 ds-label">
                                {page} / {totalPages}
                            </span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-2 py-1 ds-small rounded border border-border disabled:opacity-30 hover:bg-ds-hover ds-transition">
                                Next ›
                            </button>
                            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                                className="px-2 py-1 ds-small rounded border border-border disabled:opacity-30 hover:bg-ds-hover ds-transition">
                                »»
                            </button>
                        </div>
                    </div>
                )}
            </Card>

        </div>
    );
}
