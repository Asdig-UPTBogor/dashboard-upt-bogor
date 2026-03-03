"use client";

import { useState, useMemo, useCallback } from "react";
import {
    Shield, Zap, Building2, Radio, Filter, RefreshCw,
    Search, AlertTriangle, Clock,
    CheckCircle2, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageData } from "@/hooks/usePageData";

/* ── Widget imports ── */
import {
    KpiCard,
    DonutChartWidget,
    BarChartWidget,
    HorizontalBarWidget,
    DataTableWidget,
    COLORS,
    type DataTableColumn,
} from "@/components/page-builder/widgets";

/* ── Row type from relay sheet ── */
interface RelayRow {
    ULTG: string;
    "Gardu Induk": string;
    Tegangan: string;
    "Type Bay": string;
    "Bay/Diameter": string;
    "Fungsi Proteksi": string;
    Protection: string;
    Merk: string;
    Type: string;
    "Jenis Relay": string;
    Status: string;
    Kategori: string;
    "Tahun\nPembuatan": string;
    "Tahun\nOperasi": string;
    [key: string]: string;
}

/* ── Helpers ── */
const isCredible = (r: RelayRow) =>
    !!(r.ULTG?.trim() && r["Gardu Induk"]?.trim() && r["Bay/Diameter"]?.trim());

/* ━━━━━━━━━━━━━━━━━━ PAGE COMPONENT ━━━━━━━━━━━━━━━━━━ */

export default function AssetProteksiPage() {
    // Data — single dataSource: [0] Asset Relay UPT Bogor
    const { sheets, loading, error, fetchedAt, refetch } = usePageData("/proteksi/asset");

    /* ── Filters ── */
    const [filterULTG, setFilterULTG] = useState<string | null>(null);
    const [filterGI, setFilterGI] = useState<string | null>(null);
    const [filterMerk, setFilterMerk] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    /* ── Parse relay data — only credible rows (ULTG + GI + Bay filled) ── */
    const relaySheet = sheets[0]; // Asset Relay UPT Bogor
    const rawRelays = useMemo(() => (relaySheet?.rows || []) as unknown as RelayRow[], [relaySheet]);
    const allRelays = useMemo(() => rawRelays.filter(isCredible), [rawRelays]);
    const skippedCount = rawRelays.length - allRelays.length;
    const crediblePct = rawRelays.length > 0 ? Math.round((allRelays.length / rawRelays.length) * 100) : 100;

    /* ── Apply filters ── */
    const filteredRelays = useMemo(() => {
        let result = allRelays;
        if (filterULTG) result = result.filter((r) => r.ULTG === filterULTG);
        if (filterGI) result = result.filter((r) => r["Gardu Induk"] === filterGI);
        if (filterMerk) result = result.filter((r) => r.Merk === filterMerk);
        if (filterStatus) result = result.filter((r) => r.Status === filterStatus);
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            result = result.filter((r) =>
                Object.values(r).some((v) => v?.toLowerCase().includes(s))
            );
        }
        return result;
    }, [allRelays, filterULTG, filterGI, filterMerk, filterStatus, searchTerm]);

    /* ── Unique values for filters ── */
    const ultgList = useMemo(() => [...new Set(allRelays.map((r) => r.ULTG).filter(Boolean))].sort(), [allRelays]);
    const giList = useMemo(() => {
        const relays = filterULTG ? allRelays.filter((r) => r.ULTG === filterULTG) : allRelays;
        return [...new Set(relays.map((r) => r["Gardu Induk"]).filter(Boolean))].sort();
    }, [allRelays, filterULTG]);
    const merkList = useMemo(() => [...new Set(allRelays.map((r) => r.Merk).filter(Boolean))].sort(), [allRelays]);
    const statusList = useMemo(() => [...new Set(allRelays.map((r) => r.Status).filter(Boolean))].sort(), [allRelays]);

    /* ── KPIs ── */
    const totalRelay = filteredRelays.length;
    const totalGI = new Set(filteredRelays.map((r) => r["Gardu Induk"]).filter(Boolean)).size;
    const totalMerk = new Set(filteredRelays.map((r) => r.Merk).filter(Boolean)).size;
    const totalFungsi = new Set(filteredRelays.map((r) => r["Fungsi Proteksi"]).filter(Boolean)).size;

    /* ── Clear all filters ── */
    const clearFilters = useCallback(() => {
        setFilterULTG(null); setFilterGI(null); setFilterMerk(null); setFilterStatus(null); setSearchTerm("");
    }, []);

    const hasFilters = filterULTG || filterGI || filterMerk || filterStatus || searchTerm;

    /* ── Click handler: chart filter ── */
    const onMerkClick = useCallback((value: string) => {
        setFilterMerk((p) => p === value ? null : value);
    }, []);
    const onStatusClick = useCallback((value: string) => {
        setFilterStatus((p) => p === value ? null : value);
    }, []);

    /* ── Table column definitions ── */
    const tableColumns: DataTableColumn[] = useMemo(() => [
        { key: "ULTG", label: "ULTG", clickable: true },
        { key: "Gardu Induk", label: "Gardu Induk", bold: true, maxWidth: "max-w-[140px]" },
        { key: "Bay/Diameter", label: "Bay/Diameter", maxWidth: "max-w-[120px]" },
        { key: "Fungsi Proteksi", label: "Fungsi Proteksi" },
        { key: "Protection", label: "Protection" },
        { key: "Merk", label: "Merk", bold: true },
        { key: "Type", label: "Type", maxWidth: "max-w-[100px]" },
        { key: "Jenis Relay", label: "Jenis Relay", expandOnly: true },
        { key: "Tegangan", label: "Tegangan", expandOnly: true },
        { key: "Type Bay", label: "Type Bay", expandOnly: true },
        { key: "Serial Number", label: "Serial Number", expandOnly: true, mono: true },
        { key: "Tahun\nOperasi", label: "Thn Operasi", expandOnly: true },
        { key: "Status", label: "Status", statusColors: { "Operasi": COLORS.emerald, "Tidak Operasi": COLORS.rose, "Rusak": COLORS.red, "Reserve": COLORS.amber } },
    ], []);

    const handleTableCellClick = useCallback((column: string, value: string) => {
        if (column === "ULTG") { setFilterULTG(value); }
    }, []);

    /* ── Status color map for donut ── */
    const statusColorMap = useMemo(() => ({
        "Operasi": COLORS.emerald,
        "Tidak Operasi": COLORS.rose,
        "Rusak": COLORS.red,
        "Reserve": COLORS.amber,
    }), []);

    /* ━━━━ LOADING ━━━━ */
    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-80" />
            </div>
        );
    }

    /* ━━━━ ERROR ━━━━ */
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                        <h2 className="text-lg font-bold mb-2">Gagal Memuat Data</h2>
                        <p className="text-sm text-muted-foreground mb-4">{error}</p>
                        <button onClick={refetch} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
                            <RefreshCw className="h-3 w-3 inline mr-1" /> Coba Lagi
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    /* ━━━━ RENDER ━━━━ */
    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-6 w-6 text-indigo-400" />
                        Asset Proteksi
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        {allRelays.length.toLocaleString()} relay kredibel · {sheets.length} sumber data ·
                        <span className="text-emerald-400 ml-1">
                            <Clock className="h-3 w-3 inline" /> {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("id-ID") : "—"}
                        </span>
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Reset Filter
                        </button>
                    )}
                    <button onClick={refetch} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors">
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Data Quality Banner ── */}
            {skippedCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 flex-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-xs">
                            <span className="font-bold text-emerald-400">{allRelays.length.toLocaleString()}</span> relay kredibel
                            <span className="text-muted-foreground"> (ULTG + GI + Bay lengkap)</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-zinc-500 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                            {skippedCount.toLocaleString()} baris tidak lengkap — disembunyikan
                        </span>
                    </div>
                    <div className="ml-auto">
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${crediblePct}%`, backgroundColor: crediblePct >= 80 ? COLORS.emerald : crediblePct >= 50 ? COLORS.amber : COLORS.rose }}
                                />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{crediblePct}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Filters Row ── */}
            <div className="flex flex-wrap gap-2 items-center">
                <select value={filterULTG || ""} onChange={(e) => { setFilterULTG(e.target.value || null); setFilterGI(null); }} className="text-xs px-3 py-1.5 rounded-md border bg-background text-foreground">
                    <option value="">ULTG: Semua</option>
                    {ultgList.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <select value={filterGI || ""} onChange={(e) => { setFilterGI(e.target.value || null); }} className="text-xs px-3 py-1.5 rounded-md border bg-background text-foreground">
                    <option value="">Gardu Induk: Semua</option>
                    {giList.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={filterMerk || ""} onChange={(e) => { setFilterMerk(e.target.value || null); }} className="text-xs px-3 py-1.5 rounded-md border bg-background text-foreground">
                    <option value="">Merk: Semua</option>
                    {merkList.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filterStatus || ""} onChange={(e) => { setFilterStatus(e.target.value || null); }} className="text-xs px-3 py-1.5 rounded-md border bg-background text-foreground">
                    <option value="">Status: Semua</option>
                    {statusList.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); }}
                        placeholder="Cari relay, merk, GI..."
                        className="w-full text-xs pl-7 pr-3 py-1.5 rounded-md border bg-background text-foreground placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            {/* Active filters badges */}
            {hasFilters && (
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-xs text-muted-foreground">Filter aktif:</span>
                    {filterULTG && <Badge variant="secondary" className="text-xs">ULTG: {filterULTG}</Badge>}
                    {filterGI && <Badge variant="secondary" className="text-xs">GI: {filterGI}</Badge>}
                    {filterMerk && <Badge variant="secondary" className="text-xs">Merk: {filterMerk}</Badge>}
                    {filterStatus && <Badge variant="secondary" className="text-xs">Status: {filterStatus}</Badge>}
                    {searchTerm && <Badge variant="secondary" className="text-xs">Cari: &quot;{searchTerm}&quot;</Badge>}
                    <Badge variant="outline" className="text-xs">{filteredRelays.length.toLocaleString()} relay</Badge>
                </div>
            )}

            {/* ── KPI Cards (using widget) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Relay" value={totalRelay.toLocaleString()} icon={Shield} color={COLORS.indigo} />
                <KpiCard label="Gardu Induk" value={totalGI} icon={Building2} color={COLORS.teal} />
                <KpiCard label="Merk Relay" value={totalMerk} icon={Radio} color={COLORS.amber} />
                <KpiCard label="Fungsi Proteksi" value={totalFungsi} icon={Zap} color={COLORS.purple} />
            </div>

            {/* ── Charts Row 1: Relay per GI + Status ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8">
                    <BarChartWidget
                        title="Jumlah Relay per Gardu Induk"
                        icon={Building2}
                        data={filteredRelays as unknown as Record<string, unknown>[]}
                        column="Gardu Induk"
                        maxBars={15}
                        height={300}
                        labelFormatter={(l) => l.replace("GI ", "").replace("GIS ", "").replace("GITET ", "")}
                        badgeText={`${new Set(filteredRelays.map(r => r["Gardu Induk"]).filter(Boolean)).size} GI`}
                    />
                </div>
                <div className="lg:col-span-4">
                    <DonutChartWidget
                        title="Status Relay"
                        icon={Shield}
                        data={filteredRelays as unknown as Record<string, unknown>[]}
                        column="Status"
                        colorMap={statusColorMap}
                        showLegend={false}
                        clickable
                        onSliceClick={onStatusClick}
                        badgeText="Klik untuk filter"
                        height={300}
                    />
                </div>
            </div>

            {/* ── Charts Row 2: Merk + Usia ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DonutChartWidget
                    title="Distribusi Merk Relay"
                    icon={Radio}
                    data={filteredRelays as unknown as Record<string, unknown>[]}
                    column="Merk"
                    maxSlices={10}
                    clickable
                    onSliceClick={onMerkClick}
                    badgeText="Top 10 · Klik filter"
                    height={280}
                />
                <BarChartWidget
                    title="Usia Relay (Tahun Operasi)"
                    icon={Clock}
                    data={filteredRelays as unknown as Record<string, unknown>[]}
                    column="Tahun\nOperasi"
                    maxBars={10}
                    height={280}
                />
            </div>

            {/* ── Charts Row 3: Fungsi Proteksi ── */}
            <HorizontalBarWidget
                title="Distribusi Fungsi Proteksi"
                icon={Zap}
                data={filteredRelays as unknown as Record<string, unknown>[]}
                column="Fungsi Proteksi"
                maxBars={8}
                height={260}
                badgeText="Top 8"
            />

            {/* ── Data Table (using widget) ── */}
            <DataTableWidget
                title="Detail Relay"
                icon={Filter}
                data={filteredRelays as unknown as Record<string, unknown>[]}
                columns={tableColumns}
                pageSize={25}
                onCellClick={handleTableCellClick}
            />
        </div>
    );
}
