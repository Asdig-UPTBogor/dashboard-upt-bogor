"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
    TrendingUp, Filter, RefreshCw, Search, BarChart3,
    Building2, ChevronLeft, ChevronRight, Layers, Zap,
    AlertTriangle, Calendar, MapPin, Activity, ChevronDown, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const P = {
    indigo: "#818cf8", violet: "#a78bfa", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399", rose: "#fb7185",
    blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c", red: "#ef4444",
    green: "#22c55e", yellow: "#eab308", sky: "#38bdf8", lime: "#a3e635",
    fuchsia: "#e879f9", slate: "#94a3b8",
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const GRADIENT_PAIRS = [
    [P.indigo, P.violet], [P.teal, P.cyan], [P.amber, P.orange],
    [P.rose, P.pink], [P.emerald, P.green], [P.blue, P.sky],
    [P.purple, P.fuchsia], [P.lime, P.emerald], [P.yellow, P.amber],
];

const echartBase = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, sans-serif", color: "#a1a1aa" },
};

// ── ULTG Derivation Logic ──
// GI names containing these keywords → ULTG Sukabumi
const SUKABUMI_KEYWORDS = [
    "SUKABUMI", "CIBADAK", "SEMEN JAWA", "LEMBURSITU",
    "PELABUHAN RATU", "PLTU PELABUHAN", "GUNUNG SALAK",
];

function deriveULTG(garduName: string): string {
    const g = (garduName || "").toUpperCase();
    const isSukabumi = SUKABUMI_KEYWORDS.some(kw => g.includes(kw));
    return isSukabumi ? "ULTG Sukabumi" : "ULTG Bogor";
}

function extractYear(dateStr: string): string {
    if (!dateStr) return "";
    const m1 = dateStr.match(/(\d{2})$/);
    if (m1) { const yy = parseInt(m1[1], 10); return (yy > 50 ? 1900 + yy : 2000 + yy).toString(); }
    const m2 = dateStr.match(/(\d{4})/);
    if (m2) return m2[1];
    return "";
}

function extractMonth(dateStr: string): number {
    if (!dateStr) return -1;
    const months: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const m = dateStr.match(/-([A-Za-z]{3})-/);
    if (m) return months[m[1]] ?? -1;
    const m2 = dateStr.match(/\/(\d{1,2})\//);
    if (m2) return parseInt(m2[1], 10) - 1;
    return -1;
}

// ── Multi-Select Filter Component ──
function MultiSelectFilter({
    options, selected, onChange, placeholder, className
}: {
    options: string[]; selected: string[]; onChange: (v: string[]) => void;
    placeholder: string; className?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", fn);
        return () => document.removeEventListener("mousedown", fn);
    }, []);
    const toggle = (val: string) =>
        onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
    return (
        <div ref={ref} className={`relative ${className || ""}`}>
            <button onClick={() => setOpen(o => !o)}
                className="h-8 px-2.5 text-xs border rounded-md bg-background hover:bg-muted flex items-center gap-1 min-w-[110px] max-w-[200px] truncate">
                <span className="truncate flex-1 text-left">
                    {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} dipilih`}
                </span>
                {selected.length > 0 && (
                    <X className="h-3 w-3 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={e => { e.stopPropagation(); onChange([]); }} />
                )}
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute top-9 left-0 z-50 bg-popover border rounded-md shadow-lg p-1 min-w-[200px] max-h-60 overflow-y-auto">
                    {options.length === 0
                        ? <p className="text-xs text-muted-foreground px-2 py-1.5">Tidak ada opsi</p>
                        : options.map(opt => (
                            <label key={opt} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted rounded cursor-pointer">
                                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="h-3 w-3 accent-primary" />
                                <span className="truncate" title={opt}>{opt}</span>
                            </label>
                        ))
                    }
                </div>
            )}
        </div>
    );
}

export default function TrendGangguanPage() {

    const [rawData, setRawData] = useState<Record<string, string>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filterTahun, setFilterTahun] = useState<string | null>(null);
    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string[]>([]);
    const [filterBay, setFilterBay] = useState<string[]>([]);
    const [filterKategori, setFilterKategori] = useState<string[]>([]);
    const [filterSebab, setFilterSebab] = useState<string[]>([]);
    const [filterJenis, setFilterJenis] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;
    type ClickDetail = { title: string; rows: any[] } | null;
    const [clickedDetail, setClickedDetail] = useState<ClickDetail>(null);

    useEffect(() => {
        fetch("/api/trend-gangguan")
            .then(r => r.json())
            .then(json => {
                if (json.error) setError(json.error);
                else setRawData(json.data || []);
                setLoading(false);
            })
            .catch(e => { setError(String(e)); setLoading(false); });
    }, []);

    const enrichedData = useMemo(() =>
        rawData.map(r => ({
            ...r,
            _year: extractYear(r["Tgl Keluar"] || ""),
            _month: extractMonth(r["Tgl Keluar"] || ""),
            _ultg: deriveULTG(r["Gardu"] || ""),
        })),
        [rawData]
    );

    // ═══════════════════════════════════════════
    // UNIFIED BASE DATA: Only PHT/TRF, no BINARY, deduplicated by date+time
    // ═══════════════════════════════════════════
    const jamKeluarKey = "Jam\nKeluar";

    const baseData = useMemo(() => {
        // Step 1: Only keep PHT and TRF, exclude BINARY
        const phtTrf = enrichedData.filter(r => {
            const bay = (r["Nama Bay"] || "").toUpperCase();
            return (bay.startsWith("PHT") || bay.startsWith("TRF")) && !bay.includes("BINARY");
        });
        // Step 2: Deduplicate by Tgl Keluar + Jam Keluar (same date+time = 1 event)
        const seen = new Set<string>();
        return phtTrf.filter(r => {
            const key = `${r["Tgl Keluar"] || ""}|${r[jamKeluarKey] || ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [enrichedData]);

    // Tag each row as PHT or TRF for the Jenis filter
    const taggedBase = useMemo(() =>
        baseData.map(r => {
            const bay = (r["Nama Bay"] || "").toUpperCase();
            return { ...r, _jenis: bay.startsWith("PHT") ? "PHT" : "TRF" };
        }),
        [baseData]
    );

    const tahunList = useMemo(() => [...new Set(taggedBase.map(r => r._year).filter(Boolean))].sort(), [taggedBase]);

    // GI list — cascades from ULTG filter
    const giList = useMemo(() => {
        let src = taggedBase;
        if (filterULTG) src = src.filter(r => r._ultg === filterULTG);
        return [...new Set(src.map(r => r["Gardu"]).filter(Boolean))].sort();
    }, [taggedBase, filterULTG]);

    const bayList = useMemo(() => {
        let src = taggedBase;
        if (filterTahun) src = src.filter(r => r._year === filterTahun);
        if (filterJenis) src = src.filter(r => r._jenis === filterJenis);
        if (filterULTG) src = src.filter(r => r._ultg === filterULTG);
        if (filterGI.length > 0) src = src.filter(r => filterGI.includes(r["Gardu"] || ""));
        return [...new Set(src.map(r => r["Nama Bay"]).filter(Boolean))].sort();
    }, [taggedBase, filterTahun, filterJenis, filterULTG, filterGI]);
    const kategoriList = useMemo(() => {
        let src = taggedBase;
        if (filterTahun) src = src.filter(r => r._year === filterTahun);
        if (filterJenis) src = src.filter(r => r._jenis === filterJenis);
        if (filterULTG) src = src.filter(r => r._ultg === filterULTG);
        if (filterGI.length > 0) src = src.filter(r => filterGI.includes(r["Gardu"] || ""));
        return [...new Set(src.map(r => r["Kategori"]).filter(Boolean))].sort();
    }, [taggedBase, filterTahun, filterJenis, filterULTG, filterGI]);
    const sebabList = useMemo(() => {
        let src = taggedBase;
        if (filterTahun) src = src.filter(r => r._year === filterTahun);
        if (filterJenis) src = src.filter(r => r._jenis === filterJenis);
        if (filterULTG) src = src.filter(r => r._ultg === filterULTG);
        if (filterGI.length > 0) src = src.filter(r => filterGI.includes(r["Gardu"] || ""));
        if (filterKategori.length > 0) src = src.filter(r => filterKategori.includes(r["Kategori"] || ""));
        return [...new Set(src.map(r => r["Sebab"]).filter(Boolean))].sort();
    }, [taggedBase, filterTahun, filterJenis, filterULTG, filterGI, filterKategori]);

    // ═══════════════════════════════════════════
    // FILTERED DATA: All user filters applied on the clean base
    // ═══════════════════════════════════════════
    const filtered = useMemo(() => {
        let data = taggedBase;
        if (filterTahun) data = data.filter(r => r._year === filterTahun);
        if (filterJenis) data = data.filter(r => r._jenis === filterJenis);
        if (filterULTG) data = data.filter(r => r._ultg === filterULTG);
        if (filterGI.length > 0) data = data.filter(r => filterGI.includes(r["Gardu"] || ""));
        if (filterBay.length > 0) data = data.filter(r => filterBay.includes(r["Nama Bay"] || ""));
        if (filterKategori.length > 0) data = data.filter(r => filterKategori.includes(r["Kategori"] || ""));
        if (filterSebab.length > 0) data = data.filter(r => filterSebab.includes(r["Sebab"] || ""));
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r => Object.values(r).some(v => typeof v === "string" && v.toLowerCase().includes(q)));
        }
        return data;
    }, [taggedBase, filterTahun, filterJenis, filterULTG, filterGI, filterBay, filterKategori, filterSebab, searchQuery]);

    const clearFilters = useCallback(() => {
        setFilterTahun(null); setFilterJenis(null);
        setFilterULTG(null); setFilterGI([]); setFilterBay([]);
        setFilterKategori([]); setFilterSebab([]);
        setSearchQuery(""); setPage(0);
    }, []);

    const hasFilters = filterTahun || filterJenis || filterULTG ||
        filterGI.length > 0 || filterBay.length > 0 ||
        filterKategori.length > 0 || filterSebab.length > 0 || searchQuery;

    // ── Chart click handlers ──

    const handleTrendClick = useCallback((params: any) => {
        if (params.componentType !== "series") return;
        const year = params.name;
        const rows = (filtered as any[]).filter(r => r._year === year);
        setClickedDetail({ title: `Detail Gangguan Tahun ${year} (${rows.length} event)`, rows });
    }, [filtered]);

    const handleHeatmapClick = useCallback((params: any) => {
        if (!params.data) return;
        const [mi, yi] = params.data as [number, number, number];
        const filteredYears = [...new Set((filtered as any[]).map(r => r._year).filter(Boolean))].sort().slice(-8);
        const year = filteredYears[yi];
        const monthName = monthNames[mi];
        if (!year) return;
        const rows = (filtered as any[]).filter(r => r._year === year && r._month === mi);
        setClickedDetail({ title: `Detail Gangguan ${monthName} ${year} (${rows.length} event)`, rows });
    }, [filtered]);

    // ── KPIs (all from filtered = only PHT/TRF, deduplicated) ──
    const totalGangguan = filtered.length;
    const totalGardu = useMemo(() => new Set(filtered.map(r => r["Gardu"]).filter(Boolean)).size, [filtered]);
    const totalBay = useMemo(() => new Set(filtered.map(r => r["Nama Bay"]).filter(Boolean)).size, [filtered]);
    const totalKategori = useMemo(() => new Set(filtered.map(r => r["Kategori"]).filter(Boolean)).size, [filtered]);
    const tripCount = useMemo(() => filtered.filter(r => (r["Kondisi"] || "").toUpperCase().includes("TRIP")).length, [filtered]);
    const recloseCount = useMemo(() => filtered.filter(r => (r["Kondisi"] || "").toUpperCase().includes("RECLOSE")).length, [filtered]);

    // ═══════════════════════════════════════════
    // CHART 1: Combo Bar+Line — Trend per Tahun (from unified filtered data)
    // ═══════════════════════════════════════════
    const trendComboChart = useMemo(() => {
        // Use filtered whenever ANY filter is active — guarantees all charts stay in sync
        const anyFilterActive = !!(filterTahun || filterJenis || filterULTG ||
            filterGI.length > 0 || filterBay.length > 0 || filterKategori.length > 0 || filterSebab.length > 0 || searchQuery);
        const src = anyFilterActive ? filtered : taggedBase;

        const phtRows = src.filter(r => r._jenis === "PHT");
        const trfRows = src.filter(r => r._jenis === "TRF");

        const allYears = new Set<string>();
        phtRows.forEach(r => { if (r._year) allYears.add(r._year); });
        trfRows.forEach(r => { if (r._year) allYears.add(r._year); });
        const years = [...allYears].sort();

        const phtC: Record<string, number> = {}, trfC: Record<string, number> = {};
        phtRows.forEach(r => { if (r._year) phtC[r._year] = (phtC[r._year] || 0) + 1; });
        trfRows.forEach(r => { if (r._year) trfC[r._year] = (trfC[r._year] || 0) + 1; });

        const totals = years.map(y => (phtC[y] || 0) + (trfC[y] || 0));
        
        // Moving Average (3 Year) as Trendline
        const ma = totals.map((_, i) => {
            const start = Math.max(0, i - 1), end = Math.min(totals.length - 1, i + 1);
            let sum = 0, cnt = 0;
            for (let j = start; j <= end; j++) { sum += totals[j]; cnt++; }
            return Math.round(sum / cnt);
        });

        const showPHT = !filterJenis || filterJenis === "PHT";

        const showTRF = !filterJenis || filterJenis === "TRF";

        return {
            ...echartBase,
            tooltip: {
                trigger: "axis" as const, backgroundColor: "rgba(10,10,25,0.95)", borderColor: "rgba(129,140,248,0.2)",
                textStyle: { color: "#e4e4e7", fontSize: 11 },
                axisPointer: { type: "shadow" as const, shadowStyle: { color: "rgba(129,140,248,0.06)" } },
            },
            legend: {
                data: [showPHT ? "Penghantar" : "", showTRF ? "Trafo" : "", "Garis Tren"].filter(Boolean), bottom: 0,
                textStyle: { color: "#d4d4d8", fontSize: 10 }, itemWidth: 14, itemHeight: 8, itemGap: 20,
            },
            grid: { top: 30, right: 20, bottom: 45, left: 50 },
            xAxis: {
                type: "category" as const, data: years,
                axisLabel: { fontSize: 10, color: "#a1a1aa" },
                axisLine: { lineStyle: { color: "#27272a" } }, axisTick: { show: false },
            },
            yAxis: {
                type: "value" as const, name: "Jumlah Event",
                nameTextStyle: { color: "#71717a", fontSize: 10, padding: [0, 0, 0, -10] },
                axisLabel: { fontSize: 10, color: "#71717a" },
                splitLine: { lineStyle: { color: "#1e1e2e", type: "dashed" as const } },
            },
            series: [
                ...(showPHT ? [{
                    name: "Penghantar", type: "bar" as const, stack: "ggn", barMaxWidth: 38,
                    data: years.map(y => phtC[y] || 0),
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [{ offset: 0, color: "#818cf8" }, { offset: 1, color: "#6366f1" }] },
                        borderRadius: [0, 0, 0, 0],
                    },
                    label: {
                        show: true, position: "inside" as const, fontSize: 9, fontWeight: 500, color: "#fff",
                        formatter: (p: { value: number }) => p.value > 2 ? p.value.toString() : "",
                    },
                    emphasis: { focus: "series" as const, itemStyle: { shadowBlur: 12, shadowColor: "rgba(99,102,241,0.4)" } },
                }] : []),
                ...(showTRF ? [{
                    name: "Trafo", type: "bar" as const, stack: "ggn", barMaxWidth: 38,
                    data: years.map(y => trfC[y] || 0),
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [{ offset: 0, color: "#fbbf24" }, { offset: 1, color: "#f59e0b" }] },
                        borderRadius: [4, 4, 0, 0],
                    },
                    label: {
                        show: true, position: "inside" as const, fontSize: 9, fontWeight: 500, color: "#1a1a2e",
                        formatter: (p: { value: number }) => p.value > 2 ? p.value.toString() : "",
                    },
                    emphasis: { focus: "series" as const },
                }] : []),
                // Transparent series for total labels on top
                {
                    name: "Total", type: "bar" as const, stack: "ggn", barMaxWidth: 38,
                    data: years.map(_ => 0),
                    label: {
                        show: true, position: "top" as const, fontSize: 10, fontWeight: 600, color: "#d4d4d8",
                        formatter: (p: { dataIndex: number }) => {
                            const t = totals[p.dataIndex] || 0;
                            return t > 0 ? t.toString() : "";
                        },
                    },
                    tooltip: { show: false },
                },
                {
                    name: "Garis Tren", type: "line" as const,
                    data: ma, smooth: true, symbol: "circle", symbolSize: 6,
                    lineStyle: { width: 2.5, color: P.rose, type: "solid" as const },
                    itemStyle: { color: P.rose, borderWidth: 2, borderColor: "#1a1a2e" },
                    areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: "rgba(251,113,133,0.15)" }, { offset: 1, color: "rgba(251,113,133,0)" }] } },
                },
            ],
            animationDuration: 1200, animationEasing: "cubicOut",
        };
    }, [taggedBase, filtered, filterTahun, filterJenis, filterULTG, filterGI, filterBay, filterKategori, filterSebab, searchQuery]);


    // ═══════════════════════════════════════════
    // CHART 2: Line Chart — Trending Gangguan per Bulan
    // ═══════════════════════════════════════════
    const monthlyTrendChart = useMemo(() => {
        const filteredYears = [...new Set(filtered.map(r => r._year).filter(Boolean))].sort();
        const recentYears = filteredYears.slice(-5); // last 5 years
        
        const colors = [P.blue, P.yellow, P.slate, P.red, P.green];
        
        const series = recentYears.map((year, i) => {
            let cumulative = 0;
            const data = monthNames.map((_, mIndex) => {
                const count = filtered.filter(r => r._year === year && r._month === mIndex).length;
                cumulative += count;
                return cumulative;
            });
            
            const isCurrentYear = year === new Date().getFullYear().toString();
            const currentMonth = new Date().getMonth();
            const finalData = data.map((val, m) => (isCurrentYear && m > currentMonth) ? null : val);

            return {
                name: year,
                type: "line" as const,
                data: finalData,
                symbol: "circle",
                symbolSize: 6,
                lineStyle: { width: 3 },
                itemStyle: { color: colors[i % colors.length] },
                label: { 
                    show: true, 
                    position: "top" as const, 
                    fontSize: 10,
                    fontWeight: "bold",
                    color: colors[i % colors.length],
                    formatter: (p: any) => p.value > 0 ? p.value : "" 
                },
            };
        });

        return {
            ...echartBase,
            tooltip: {
                trigger: "axis" as const, backgroundColor: "rgba(10,10,25,0.95)",
                borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7", fontSize: 11 },
            },
            legend: {
                data: recentYears,
                bottom: 0,
                textStyle: { color: "#d4d4d8", fontSize: 10 }, itemWidth: 14, itemHeight: 8,
            },
            grid: { top: 30, right: 20, bottom: 40, left: 40 },
            xAxis: {
                type: "category" as const, data: monthNames,
                axisLabel: { fontSize: 10, color: "#a1a1aa" },
                axisLine: { lineStyle: { color: "#27272a" } }, axisTick: { show: false },
            },
            yAxis: {
                type: "value" as const,
                axisLabel: { fontSize: 10, color: "#71717a" },
                splitLine: { lineStyle: { color: "#1e1e2e", type: "dashed" as const } },
            },
            series,
            animationDuration: 1000, animationEasing: "cubicOut",
        };
    }, [filtered]);

    // ═══════════════════════════════════════════
    // CHART 3: Heatmap — Gangguan per Bulan × Tahun
    // ═══════════════════════════════════════════
    const heatmapChart = useMemo(() => {
        // Derive year list from filtered (so heatmap reflects active filters)
        const filteredYears = [...new Set(filtered.map(r => r._year).filter(Boolean))].sort();
        const recentYears = filteredYears.slice(-8);
        const heatData: [number, number, number][] = [];
        let maxVal = 0;

        recentYears.forEach((y, yi) => {
            monthNames.forEach((_, mi) => {
                const cnt = filtered.filter(r => r._year === y && r._month === mi).length;
                heatData.push([mi, yi, cnt]);
                if (cnt > maxVal) maxVal = cnt;
            });
        });

        return {
            ...echartBase,
            tooltip: {
                position: "top" as const, backgroundColor: "rgba(10,10,25,0.95)",
                borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7", fontSize: 11 },
                formatter: (p: { data: [number, number, number] }) => {
                    const [m, y, v] = p.data;
                    return `<b>${monthNames[m]} ${recentYears[y]}</b><br/>Gangguan: <b>${v}</b>`;
                },
            },
            grid: { top: 8, right: 16, bottom: 55, left: 55 },
            xAxis: {
                type: "category" as const, data: monthNames,
                axisLabel: { fontSize: 9, color: "#a1a1aa" },
                axisLine: { show: false }, axisTick: { show: false },
                splitArea: { show: true, areaStyle: { color: ["transparent", "rgba(255,255,255,0.01)"] } },
            },
            yAxis: {
                type: "category" as const, data: recentYears,
                axisLabel: { fontSize: 10, color: "#a1a1aa" },
                axisLine: { show: false }, axisTick: { show: false },
                splitArea: { show: true, areaStyle: { color: ["transparent", "rgba(255,255,255,0.01)"] } },
            },
            visualMap: {
                min: 0, max: maxVal || 1, calculable: true, orient: "horizontal" as const,
                left: "center", bottom: 5, itemWidth: 12, itemHeight: 100,
                textStyle: { color: "#71717a", fontSize: 9 },
                inRange: { color: ["#1a1a2e", "#312e81", "#4338ca", "#6366f1", "#818cf8", "#a5b4fc"] },
            },
            series: [{
                type: "heatmap" as const, data: heatData,
                label: { show: true, fontSize: 9, color: "#e4e4e7",
                    formatter: (p: { data: [number, number, number] }) => p.data[2] > 0 ? p.data[2].toString() : "" },
                emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(99,102,241,0.5)" } },
                itemStyle: { borderWidth: 2, borderColor: "#0a0a19", borderRadius: 3 },
            }],
            animationDuration: 800,
        };
    }, [filtered]);

    // ═══════════════════════════════════════════
    // CHART 4: Donut — Kondisi (Trip vs Reclose)
    // ═══════════════════════════════════════════
    const kondisiDonut = useMemo(() => {
        const counts: Record<string, number> = {};
        (filtered as any[]).forEach(r => { const k = r["Kondisi"] || "Lainnya"; counts[k] = (counts[k] || 0) + 1; });
        const colorMap: Record<string, string> = { "Trip": P.rose, "Reclose Sukses": P.emerald, "Lainnya": P.slate };
        const data = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
            name, value, itemStyle: { color: colorMap[name] || P.slate },
        }));
        const total = data.reduce((s, d) => s + d.value, 0);
        return {
            ...echartBase,
            tooltip: {
                trigger: "item" as const, backgroundColor: "rgba(10,10,25,0.95)",
                borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7" },
                formatter: "{b}: {c} ({d}%)",
            },
            graphic: [
                { type: "text" as const, left: "center", top: "32%",
                    style: { text: `${total}`, fontSize: 26, fontWeight: "bold" as const, fill: "#e4e4e7", textAlign: "center" as const } },
                { type: "text" as const, left: "center", top: "46%",
                    style: { text: "total", fontSize: 10, fill: "#71717a", textAlign: "center" as const } },
            ],
            legend: {
                orient: "horizontal" as const, bottom: 0, itemWidth: 10, itemHeight: 10, itemGap: 14,
                textStyle: { color: "#d4d4d8", fontSize: 9 },
                formatter: (name: string) => { const d = data.find(x => x.name === name); return `${name}  ${d?.value || 0}`; },
            },
            series: [{
                type: "pie" as const, radius: ["40%", "68%"], center: ["50%", "42%"],
                padAngle: 4, itemStyle: { borderRadius: 8, borderWidth: 2, borderColor: "#0a0a19" },
                label: { show: false }, emphasis: { scaleSize: 6 }, data,
            }],
            animationType: "scale", animationDuration: 900,
        };
    }, [filtered]);

    // ═══════════════════════════════════════════
    // CHART 5: Horizontal Bar — Top Sebab with gradient
    // ═══════════════════════════════════════════
    const sebabChart = useMemo(() => {
        const counts: Record<string, number> = {};
        (filtered as any[]).forEach(r => { const s = r["Sebab"] || "N/A"; counts[s] = (counts[s] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const maxVal = Math.max(...sorted.map(s => s[1]), 1);
        return {
            ...echartBase,
            tooltip: {
                trigger: "axis" as const, backgroundColor: "rgba(10,10,25,0.95)",
                borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7", fontSize: 10 },
                confine: true,
            },
            grid: { top: 8, right: 52, bottom: 8, left: 10, containLabel: true },
            yAxis: {
                type: "category" as const, data: sorted.map(s => s[0]),
                axisLabel: { fontSize: 8, color: "#d4d4d8", width: 200, overflow: "truncate" as const },
                axisLine: { show: false }, axisTick: { show: false }, inverse: true,
            },
            xAxis: {
                type: "value" as const, max: maxVal * 1.15,
                axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false },
            },
            series: [{
                type: "bar" as const, barWidth: 18,
                data: sorted.map((s, i) => ({
                    value: s[1],
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                            colorStops: [{ offset: 0, color: GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][0] },
                                         { offset: 1, color: GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][1] }] },
                        borderRadius: [0, 8, 8, 0],
                        shadowBlur: 4, shadowColor: `${GRADIENT_PAIRS[i % GRADIENT_PAIRS.length][0]}33`,
                    },
                })),
                label: { show: true, position: "right" as const, fontSize: 11, fontWeight: 600, color: "#e4e4e7",
                    formatter: "{c}" },
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.02)", borderRadius: [0, 8, 8, 0] },
            }],
            animationDuration: 1000, animationEasing: "cubicOut",
        };
    }, [filtered]);

    // ═══════════════════════════════════════════
    // CHART 6: Top Gardu Bar
    // ═══════════════════════════════════════════
    const garduChart = useMemo(() => {
        const counts: Record<string, number> = {};
        (filtered as any[]).forEach(r => { const g = r["Gardu"] || "N/A"; counts[g] = (counts[g] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const maxVal = Math.max(...sorted.map(s => s[1]), 1);
        return {
            ...echartBase,
            tooltip: {
                trigger: "axis" as const, backgroundColor: "rgba(10,10,25,0.95)",
                borderColor: "rgba(129,140,248,0.2)", textStyle: { color: "#e4e4e7", fontSize: 10 },
            },
            grid: { top: 8, right: 52, bottom: 8, left: 10, containLabel: true },
            yAxis: {
                type: "category" as const, data: sorted.map(s => s[0]),
                axisLabel: { fontSize: 8, color: "#d4d4d8", width: 200, overflow: "truncate" as const },
                axisLine: { show: false }, axisTick: { show: false }, inverse: true,
            },
            xAxis: {
                type: "value" as const, max: maxVal * 1.15,
                axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false },
            },
            series: [{
                type: "bar" as const, barWidth: 16,
                data: sorted.map((s, i) => ({
                    value: s[1],
                    itemStyle: {
                        color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                            colorStops: [{ offset: 0, color: P.teal }, { offset: 1, color: P.cyan }] },
                        borderRadius: [0, 6, 6, 0],
                        shadowBlur: 3, shadowColor: "rgba(45,212,191,0.2)",
                    },
                })),
                label: { show: true, position: "right" as const, fontSize: 10, fontWeight: 600, color: "#e4e4e7" },
                showBackground: true,
                backgroundStyle: { color: "rgba(255,255,255,0.02)", borderRadius: [0, 6, 6, 0] },
            }],
            animationDuration: 1000,
        };
    }, [filtered]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    useEffect(() => { setPage(0); }, [filterTahun, filterBay, filterKategori, filterSebab, searchQuery]);

    if (loading) return (
        <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-72" />
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-80" />
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-96">
            <Card className="max-w-md"><CardContent className="p-6 text-center">
                <p className="text-destructive font-semibold mb-2">Error Loading Data</p>
                <p className="text-sm text-muted-foreground">{error}</p>
            </CardContent></Card>
        </div>
    );

    return (
        <>
            <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        Trend Gangguan
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Riwayat Gangguan PHT & TRF — {taggedBase.length.toLocaleString()} events (deduplicated)
                        {hasFilters && ` · filter: ${filtered.length.toLocaleString()}`}
                    </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                    <RefreshCw className="h-3 w-3 mr-1" /> Auto-refresh 5 menit
                </Badge>
            </div>

            {/* ───── KPI Cards ───── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                    { label: "Total Gangguan", value: totalGangguan, icon: Zap, color: P.indigo, glow: "rgba(129,140,248,0.15)" },
                    { label: "Jumlah Gardu", value: totalGardu, icon: Building2, color: P.teal, glow: "rgba(45,212,191,0.15)" },
                    { label: "Jumlah Bay", value: totalBay, icon: MapPin, color: P.amber, glow: "rgba(251,191,36,0.15)" },
                    { label: "Kategori", value: totalKategori, icon: AlertTriangle, color: P.rose, glow: "rgba(251,113,133,0.15)" },
                    { label: "Trip", value: tripCount, icon: Zap, color: P.red, glow: "rgba(239,68,68,0.15)" },
                    { label: "Reclose Sukses", value: recloseCount, icon: Activity, color: P.emerald, glow: "rgba(52,211,153,0.15)" },
                ].map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                                style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.glow}, transparent 60%)` }} />
                            <CardContent className="p-3 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xl md:text-2xl font-extrabold leading-none">{kpi.value.toLocaleString()}</p>
                                        <p className="text-[9px] mt-1 uppercase tracking-wider font-medium" style={{ color: kpi.color }}>
                                            {kpi.label}
                                        </p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${kpi.color}12`, border: `1px solid ${kpi.color}25` }}>
                                        <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* ───── Filters ───── */}
            <Card className="border-dashed">
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />

                        {/* Tahun */}
                        <SelectNative value={filterTahun || ""} onChange={e => { setFilterTahun(e.target.value || null); setFilterBay([]); }}>
                            <option value="">Semua Tahun</option>
                            {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
                        </SelectNative>

                        {/* Jenis */}
                        <SelectNative value={filterJenis || ""} onChange={e => { setFilterJenis(e.target.value || null); setFilterBay([]); }}>
                            <option value="">Semua Jenis</option>
                            <option value="PHT">⚡ Penghantar (PHT)</option>
                            <option value="TRF">🔄 Trafo (TRF)</option>
                        </SelectNative>

                        {/* ULTG — derived from GI name */}
                        <SelectNative value={filterULTG || ""} onChange={e => { setFilterULTG(e.target.value || null); setFilterGI([]); setFilterBay([]); }}>
                            <option value="">Semua ULTG</option>
                            <option value="ULTG Bogor">🏭 ULTG Bogor</option>
                            <option value="ULTG Sukabumi">🏭 ULTG Sukabumi</option>
                        </SelectNative>

                        {/* GI — multi-select, cascades from ULTG */}
                        <MultiSelectFilter
                            options={giList}
                            selected={filterGI}
                            onChange={v => { setFilterGI(v); setFilterBay([]); }}
                            placeholder="Semua GI"
                            className="max-w-[220px]"
                        />

                        {/* Bay — multi-select, cascades from GI */}
                        <MultiSelectFilter
                            options={bayList}
                            selected={filterBay}
                            onChange={setFilterBay}
                            placeholder="Semua Bay"
                            className="max-w-[220px]"
                        />

                        {/* Kategori — multi-select */}
                        <MultiSelectFilter
                            options={kategoriList}
                            selected={filterKategori}
                            onChange={v => { setFilterKategori(v); setFilterSebab([]); }}
                            placeholder="Semua Kategori"
                        />

                        {/* Sebab — multi-select */}
                        <MultiSelectFilter
                            options={sebabList}
                            selected={filterSebab}
                            onChange={setFilterSebab}
                            placeholder="Semua Sebab"
                            className="max-w-[200px]"
                        />

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari..." className="h-8 pl-8 pr-2 text-xs w-40" />
                        </div>

                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
                                <RefreshCw className="h-3 w-3" /> Reset
                            </Button>
                        )}
                    </div>

                    {/* Active filter badges */}
                    {(filterULTG || filterGI.length > 0 || filterBay.length > 0 || filterKategori.length > 0 || filterSebab.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dashed">
                            {filterULTG && (
                                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                                    onClick={() => { setFilterULTG(null); setFilterGI([]); }}>
                                    🏭 {filterULTG} ×
                                </Badge>
                            )}
                            {filterGI.map(g => (
                                <Badge key={g} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                                    onClick={() => setFilterGI(filterGI.filter(x => x !== g))}>
                                    🏢 {g} ×
                                </Badge>
                            ))}
                            {filterBay.map(b => (
                                <Badge key={b} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                                    onClick={() => setFilterBay(filterBay.filter(x => x !== b))}>
                                    ⚡ {b} ×
                                </Badge>
                            ))}
                            {filterKategori.map(k => (
                                <Badge key={k} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                                    onClick={() => setFilterKategori(filterKategori.filter(x => x !== k))}>
                                    ⚠️ {k} ×
                                </Badge>
                            ))}
                            {filterSebab.map(s => (
                                <Badge key={s} variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/20"
                                    onClick={() => setFilterSebab(filterSebab.filter(x => x !== s))}>
                                    🔍 {s} ×
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ───── ROW 1: Combo Chart (full width) ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Trend Gangguan Penghantar &amp; Trafo per Tahun
                        <Badge variant="secondary" className="ml-auto text-[9px]">{tahunList.length} tahun • deduplicated</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-[10px] text-muted-foreground mb-1">💡 Klik bar untuk melihat detail gangguan tahun tersebut</p>
                    <ReactECharts option={trendComboChart} style={{ height: 340 }}
                        onEvents={{ click: handleTrendClick }} />
                </CardContent>
            </Card>

            {/* ───── ROW 2: Radar + Heatmap ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Trending Gangguan Setiap Bulan
                            <Badge variant="secondary" className="ml-auto text-[9px]">Line</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent><ReactECharts option={monthlyTrendChart} style={{ height: 320 }} /></CardContent>
                </Card>

                <Card className="lg:col-span-7">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" /> Heatmap Gangguan per Bulan
                            <Badge variant="secondary" className="ml-auto text-[9px]">8 Tahun Terakhir</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[10px] text-muted-foreground mb-1">💡 Klik sel untuk melihat detail gangguan bulan tersebut</p>
                        <ReactECharts option={heatmapChart} style={{ height: 300 }}
                            onEvents={{ click: handleHeatmapClick }} />
                    </CardContent>
                </Card>
            </div>

            {/* ───── ROW 3: Sebab + Donut Kondisi + Top Gardu ───── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" /> Top 8 Sebab Gangguan
                        </CardTitle>
                    </CardHeader>
                    <CardContent><ReactECharts option={sebabChart} style={{ height: 300 }} /></CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Kondisi
                        </CardTitle>
                    </CardHeader>
                    <CardContent><ReactECharts option={kondisiDonut} style={{ height: 300 }} /></CardContent>
                </Card>

                <Card className="lg:col-span-4">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Top 10 Gardu
                        </CardTitle>
                    </CardHeader>
                    <CardContent><ReactECharts option={garduChart} style={{ height: 300 }} /></CardContent>
                </Card>
            </div>

            {/* ───── Data Table ───── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" /> Detail Riwayat Gangguan
                        <Badge variant="secondary" className="ml-auto text-[9px]">
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
                                    <TableHead>Tahun</TableHead>
                                    <TableHead>Tgl Keluar</TableHead>
                                    <TableHead>Gardu</TableHead>
                                    <TableHead>Nama Bay</TableHead>
                                    <TableHead>Tegangan</TableHead>
                                    <TableHead className="text-center">Kategori</TableHead>
                                    <TableHead>Sebab</TableHead>
                                    <TableHead>Kondisi</TableHead>
                                    <TableHead className="text-center">Jenis GGN</TableHead>
                                    <TableHead className="max-w-[250px]">Keterangan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(paginatedData as any[]).map((r, i) => (
                                    <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-muted-foreground text-[10px]">{r["No."] || (page * PAGE_SIZE + i + 1)}</TableCell>
                                        <TableCell className="text-[10px] font-mono font-semibold">{r._year || "-"}</TableCell>
                                        <TableCell className="text-[10px] whitespace-nowrap">{r["Tgl Keluar"] || "-"}</TableCell>
                                        <TableCell className="text-[10px] whitespace-nowrap">{r["Gardu"] || "-"}</TableCell>
                                        <TableCell className="text-[10px] max-w-[200px] truncate font-medium" title={r["Nama Bay"]}>{r["Nama Bay"] || "-"}</TableCell>
                                        <TableCell className="text-[10px]">{r["Tegangan"] || "-"}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="text-[8px] px-1.5 py-0">{r["Kategori"] || "-"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] max-w-[200px] truncate" title={r["Sebab"]}>{r["Sebab"] || "-"}</TableCell>
                                        <TableCell className="text-[10px]">
                                            {(r["Kondisi"] || "").toUpperCase().includes("TRIP") ? (
                                                <Badge className="text-[8px] px-1 py-0 bg-rose-500/15 text-rose-400 border border-rose-500/30">Trip</Badge>
                                            ) : (r["Kondisi"] || "").toUpperCase().includes("RECLOSE") ? (
                                                <Badge className="text-[8px] px-1 py-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Reclose</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[8px] px-1 py-0">{r["Kondisi"] || "-"}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className="text-[8px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                {r["Jenis GGN"] || "-"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] max-w-[250px]">
                                            <div className="line-clamp-2" title={r["Keterangan"]}>{r["Keterangan"] || "-"}</div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {paginatedData.length === 0 && (
                                    <TableRow><TableCell colSpan={11} className="h-24 text-center">Tidak ada data ditemukan.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="h-8 text-xs gap-1">
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
                                            onClick={() => setPage(p)} className="w-8 h-8 text-xs p-0">{p + 1}</Button>
                                    );
                                })}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="h-8 text-xs gap-1">
                                Next <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* ───── Click-through Detail Modal ───── */}
        <Dialog open={!!clickedDetail} onOpenChange={open => { if (!open) setClickedDetail(null); }}>
            <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        {clickedDetail?.title}
                    </DialogTitle>
                </DialogHeader>
                <div className="overflow-auto flex-1 mt-2">
                    <Table className="text-xs">
                        <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                            <TableRow>
                                <TableHead className="w-8">No</TableHead>
                                <TableHead>Tgl Keluar</TableHead>
                                <TableHead>Gardu</TableHead>
                                <TableHead>Nama Bay</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Sebab</TableHead>
                                <TableHead>Kondisi</TableHead>
                                <TableHead>Keterangan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(clickedDetail?.rows || []).map((r, i) => (
                                <TableRow key={i} className="hover:bg-muted/50">
                                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r["Tgl Keluar"] || "-"}</TableCell>
                                    <TableCell className="whitespace-nowrap">{r["Gardu"] || "-"}</TableCell>
                                    <TableCell className="max-w-[180px] truncate font-medium text-primary" title={r["Nama Bay"]}>{r["Nama Bay"] || "-"}</TableCell>
                                    <TableCell><Badge variant="outline" className="text-[9px] px-1">{r["Kategori"] || "-"}</Badge></TableCell>
                                    <TableCell className="max-w-[160px] truncate" title={r["Sebab"]}>{r["Sebab"] || "-"}</TableCell>
                                    <TableCell>
                                        {(r["Kondisi"] || "").toUpperCase().includes("TRIP")
                                            ? <Badge className="text-[9px] px-1 bg-rose-500/15 text-rose-400 border border-rose-500/30">Trip</Badge>
                                            : <Badge className="text-[9px] px-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Reclose</Badge>}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-muted-foreground" title={r["Keterangan"]}>{r["Keterangan"] || "-"}</TableCell>
                                </TableRow>
                            ))}
                            {(clickedDetail?.rows?.length ?? 0) === 0 && (
                                <TableRow><TableCell colSpan={8} className="text-center h-16 text-muted-foreground">Tidak ada data</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
