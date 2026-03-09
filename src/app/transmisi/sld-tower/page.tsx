"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
    Filter, RefreshCw, Search, ChevronLeft, ChevronRight, Layers,
    Building2, Radio, MapPin, FileImage, Eye, ChevronDown, ChevronRight as ChevronR,
    Presentation, Image as ImageIcon, FileText, Maximize2, X, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DataFreshness } from "@/components/DataFreshness";
import { usePageData } from "@/hooks/usePageData";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ── Chart Palette ── */
const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};
const echartBase = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, sans-serif" },
};

/* ── Column constants ── */
const COL = {
    NO: "NO", ULTG: "Master ULTG", GI: "Master Gardu Induk",
    PENGHANTAR: "PENGHANTAR", NO_TOWER: "NO TOWER",
    SLD: "SINGLE LINE DIAGARAM TOWER", CATATAN: "CATATAN",
} as const;

const HEADER_DISPLAY: Record<string, string> = {
    "Master ULTG": "ULTG", "Master Gardu Induk": "GARDU INDUK",
    "SINGLE LINE DIAGARAM TOWER": "SLD TOWER", "CATATAN": "STATUS",
};

interface SLDFile { id: string; name: string; mimeType: string; thumbnailUrl: string; viewUrl: string; }
type Row = Record<string, string>;

/* ── File type icon helper ── */
function getFileIcon(mime: string) {
    if (mime.includes("presentation") || mime.includes("powerpoint")) return Presentation;
    if (mime.includes("pdf")) return FileText;
    if (mime.includes("spreadsheet") || mime.includes("excel")) return FileText;
    return ImageIcon;
}

function getFileTypeLabel(mime: string) {
    if (mime.includes("presentation") || mime.includes("powerpoint")) return "PPT";
    if (mime.includes("pdf")) return "PDF";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "XLS";
    if (mime.includes("png")) return "PNG";
    return "JPG";
}

export default function SLDTowerPage() {
    const theme = useChartTheme();
    const { sheets, loading } = usePageData("/transmisi/sld-tower");
    const rawData: Row[] = sheets[0]?.rows ?? [];

    /* ── SLD Files from Drive ── */
    const [sldFiles, setSldFiles] = useState<SLDFile[]>([]);
    const [sldLoading, setSldLoading] = useState(true);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [sldSearch, setSldSearch] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [fullscreen, setFullscreen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const viewerRef = useRef<HTMLDivElement>(null);

    /** Scroll ke viewer panel & select file tertentu */
    const scrollToViewer = useCallback((fileId: string) => {
        setSelectedFileId(fileId);
        viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    /** Match table row SLD name to Drive file */
    const findMatchingFile = useCallback((sldName: string) => {
        if (!sldName) return null;
        const q = sldName.toLowerCase().replace(/\s+/g, "");
        return sldFiles.find(f => f.name.toLowerCase().replace(/\s+/g, "").includes(q)
            || q.includes(f.name.toLowerCase().replace(/\s+/g, "")));
    }, [sldFiles]);

    useEffect(() => {
        fetch("/api/sld-images")
            .then(r => r.json())
            .then(data => {
                const files = data.files || [];
                setSldFiles(files);
                setSldLoading(false);
                if (files.length > 0 && !selectedFileId) setSelectedFileId(files[0].id);
            })
            .catch(() => setSldLoading(false));
    }, []);

    const filteredSLD = useMemo(() => {
        if (!sldSearch) return sldFiles;
        const q = sldSearch.toLowerCase();
        return sldFiles.filter(f => f.name.toLowerCase().includes(q));
    }, [sldFiles, sldSearch]);

    const sldGroups = useMemo(() => {
        const groups: Record<string, SLDFile[]> = {};
        filteredSLD.forEach(f => {
            const type = f.name.startsWith("SUTET") ? "SUTET 500KV"
                : f.name.startsWith("SUTT 150KV") ? "SUTT 150KV"
                    : f.name.startsWith("SUTT 70KV") ? "SUTT 70KV"
                        : "Dokumen";
            (groups[type] ??= []).push(f);
        });
        return Object.entries(groups).sort(([a], [b]) => {
            const order = ["Dokumen", "SUTET 500KV", "SUTT 150KV", "SUTT 70KV"];
            return order.indexOf(a) - order.indexOf(b);
        });
    }, [filteredSLD]);

    const selectedFile = useMemo(() => sldFiles.find(f => f.id === selectedFileId) || null, [sldFiles, selectedFileId]);
    const selectedIdx = useMemo(() => filteredSLD.findIndex(f => f.id === selectedFileId), [filteredSLD, selectedFileId]);

    const toggleGroup = (name: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const navigatePrev = () => { if (selectedIdx > 0) setSelectedFileId(filteredSLD[selectedIdx - 1].id); };
    const navigateNext = () => { if (selectedIdx < filteredSLD.length - 1) setSelectedFileId(filteredSLD[selectedIdx + 1].id); };

    // Keyboard nav
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFullscreen(false);
            if (!fullscreen) return;
            if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); navigatePrev(); }
            if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); navigateNext(); }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [selectedIdx, filteredSLD, fullscreen]);

    /* ── Data Filters ── */
    const [searchQuery, setSearchQuery] = useState("");
    const [activeULTG, setActiveULTG] = useState<string | null>(null);
    const [filterULTG, setFilterULTG] = useState("");
    const [filterGI, setFilterGI] = useState("");
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    const ultgList = useMemo(() => [...new Set(rawData.map(r => r[COL.ULTG] || "").filter(Boolean))].sort(), [rawData]);
    const giList = useMemo(() => {
        let src = rawData;
        const u = filterULTG || activeULTG;
        if (u) src = src.filter(r => r[COL.ULTG] === u);
        return [...new Set(src.map(r => r[COL.GI] || "").filter(Boolean))].sort();
    }, [rawData, filterULTG, activeULTG]);

    const filtered = useMemo(() => {
        let result = rawData;
        const currentULTG = filterULTG || activeULTG;
        if (currentULTG) result = result.filter(r => r[COL.ULTG] === currentULTG);
        if (filterGI) result = result.filter(r => r[COL.GI] === filterGI);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => Object.values(r).some(v => v?.toLowerCase().includes(q)));
        }
        return result;
    }, [rawData, filterULTG, activeULTG, filterGI, searchQuery]);

    const totalTower = filtered.length;
    const totalULTG = useMemo(() => new Set(filtered.map(r => r[COL.ULTG]).filter(Boolean)).size, [filtered]);
    const totalGI = useMemo(() => new Set(filtered.map(r => r[COL.GI]).filter(Boolean)).size, [filtered]);
    const totalPenghantar = useMemo(() => new Set(filtered.map(r => r[COL.PENGHANTAR]).filter(Boolean)).size, [filtered]);

    /* ── Donut: Tower per ULTG (Overview-matched style) ── */
    const ultgDonutColors = [C.indigo, C.teal, C.amber, C.purple, C.pink, C.emerald, C.rose, C.blue, C.cyan, C.orange];
    const ultgDonutOption = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const u = r[COL.ULTG] || "N/A"; counts[u] = (counts[u] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const total = sorted.reduce((s, [, v]) => s + v, 0);
        const data = sorted.map(([name, value], i) => ({ name, value, itemStyle: { color: ultgDonutColors[i % ultgDonutColors.length], opacity: activeULTG && activeULTG !== name ? 0.25 : 1, shadowBlur: activeULTG === name ? 12 : 0, shadowColor: activeULTG === name ? ultgDonutColors[i % ultgDonutColors.length] : "transparent" } }));
        return {
            ...echartBase,
            textStyle: { fontFamily: 'Inter, sans-serif', color: theme.textMuted },
            tooltip: { trigger: "item" as const, backgroundColor: theme.tooltipBg, borderColor: `${C.indigo}30`, textStyle: { color: theme.tooltipText, fontSize: 11 }, formatter: '{b}: {c} ({d}%)' },
            graphic: [
                { type: "text" as const, left: "center", top: "center", style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: theme.emphasisText, fontFamily: "Inter, sans-serif", textAlign: "center" as const } },
                { type: "text" as const, left: "center", top: "58%", style: { text: activeULTG || "Total", fontSize: 9, fill: activeULTG ? C.indigo : theme.textMuted, fontFamily: "Inter, sans-serif", textAlign: "center" as const } },
            ],
            series: [{
                type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"], padAngle: 3, itemStyle: { borderRadius: 6 },
                label: { show: true, color: theme.textMuted, fontSize: 10, formatter: '{b}', verticalAlign: "middle" as const },
                emphasis: { label: { fontSize: 13, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 6 },
                data,
                animationType: "scale" as const, animationEasing: "elasticOut" as const,
            }, {
                type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"], padAngle: 3, silent: true,
                label: { show: true, position: "inside" as const, color: "#fff", fontSize: 13, fontWeight: "bold" as const, fontFamily: "Inter, sans-serif", formatter: '{c}' },
                labelLine: { show: false }, itemStyle: { color: "transparent", borderWidth: 0 }, data,
            }],
            animationType: "scale", animationDuration: 800,
        };
    }, [filtered, activeULTG, theme]);

    /* ── Donut: Tower per GI (top 15, Overview-matched) ── */
    const giDonutColors = [C.amber, C.indigo, C.teal, C.pink, C.purple, C.emerald, C.rose, C.blue, C.cyan, C.orange];
    const giDonutOption = useMemo(() => {
        const counts: Record<string, number> = {};
        filtered.forEach(r => { const g = r[COL.GI] || "N/A"; counts[g] = (counts[g] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
        const total = sorted.reduce((s, [, v]) => s + v, 0);
        const data = sorted.map(([name, value], i) => ({ name: name.replace("GI ", "").replace("GIS ", "").replace("GITET ", ""), value, itemStyle: { color: giDonutColors[i % giDonutColors.length] } }));
        return {
            ...echartBase,
            textStyle: { fontFamily: 'Inter, sans-serif', color: theme.textMuted },
            tooltip: { trigger: "item" as const, backgroundColor: theme.tooltipBg, borderColor: `${C.amber}30`, textStyle: { color: theme.tooltipText, fontSize: 11 }, formatter: '{b}: {c} ({d}%)' },
            graphic: [
                { type: "text" as const, left: "center", top: "center", style: { text: `${total}`, fontSize: 22, fontWeight: "bold" as const, fill: theme.emphasisText, fontFamily: "Inter, sans-serif", textAlign: "center" as const } },
                { type: "text" as const, left: "center", top: "58%", style: { text: `${sorted.length} GI`, fontSize: 9, fill: theme.textMuted, fontFamily: "Inter, sans-serif", textAlign: "center" as const } },
            ],
            series: [{
                type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"], padAngle: 3, itemStyle: { borderRadius: 6 },
                label: { show: true, color: theme.textMuted, fontSize: 10, formatter: '{b}', verticalAlign: "middle" as const },
                emphasis: { label: { fontSize: 13, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 5 },
                data,
                animationType: "scale" as const, animationEasing: "elasticOut" as const,
            }, {
                type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"], padAngle: 3, silent: true,
                label: { show: true, position: "inside" as const, color: "#fff", fontSize: 13, fontWeight: "bold" as const, fontFamily: "Inter, sans-serif", formatter: '{c}' },
                labelLine: { show: false }, itemStyle: { color: "transparent", borderWidth: 0 }, data,
            }],
            animationType: "scale", animationDuration: 800,
        };
    }, [filtered, theme]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    useEffect(() => { setPage(0); }, [searchQuery, activeULTG, filterULTG, filterGI]);

    const hasFilters = activeULTG || filterULTG || filterGI || searchQuery;
    const clearFilters = () => { setActiveULTG(null); setFilterULTG(""); setFilterGI(""); setSearchQuery(""); };
    const tableHeaders = [COL.NO, COL.ULTG, COL.GI, COL.PENGHANTAR, COL.NO_TOWER, COL.SLD, COL.CATATAN];

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-72" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
                <Skeleton className="h-80" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ═══ FULLSCREEN SLD VIEWER MODAL ═══ */}
            <AnimatePresence>
                {fullscreen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-50 bg-black/95 flex flex-col"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: 10 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col h-full"
                        >
                            {/* Top bar */}
                            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FileImage className="h-5 w-5 text-indigo-400 shrink-0" />
                                    <span className="text-sm font-semibold text-white truncate">
                                        {selectedFile?.name || "SLD Tower Viewer"}
                                    </span>
                                    {selectedFile && (
                                        <Badge variant="secondary" className="text-[10px] shrink-0">
                                            {selectedIdx + 1} / {filteredSLD.length}
                                        </Badge>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 w-8 p-0"
                                    onClick={() => setFullscreen(false)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* Main content: sidebar + preview */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* Collapsible sidebar */}
                                <div className={`${sidebarOpen ? "w-72" : "w-0"} shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-900/60 transition-all duration-300 overflow-hidden`}>
                                    {/* Search */}
                                    <div className="p-2 border-b border-zinc-800 shrink-0">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                                            <Input type="text" value={sldSearch} onChange={e => setSldSearch(e.target.value)}
                                                placeholder="Cari diagram..."
                                                className="pl-7 h-7 text-xs bg-zinc-800 border-zinc-700 text-white" />
                                        </div>
                                    </div>

                                    {/* File list */}
                                    <div className="flex-1 overflow-y-auto">
                                        {sldLoading ? (
                                            <div className="p-2 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}</div>
                                        ) : (
                                            <div className="py-1">
                                                {sldGroups.map(([groupName, files]) => {
                                                    const isGroupCollapsed = collapsedGroups.has(groupName);
                                                    return (
                                                        <div key={groupName}>
                                                            <button onClick={() => toggleGroup(groupName)}
                                                                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors">
                                                                {isGroupCollapsed ? <ChevronR className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                                <span>{groupName}</span>
                                                                <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-zinc-700 text-zinc-500">{files.length}</Badge>
                                                            </button>
                                                            {!isGroupCollapsed && files.map(file => {
                                                                const isSelected = file.id === selectedFileId;
                                                                const FileIcon = getFileIcon(file.mimeType);
                                                                const typeLabel = getFileTypeLabel(file.mimeType);
                                                                return (
                                                                    <button key={file.id} onClick={() => setSelectedFileId(file.id)}
                                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-150 ${isSelected
                                                                            ? "bg-indigo-500/15 border-l-2 border-l-indigo-400 text-indigo-300"
                                                                            : "hover:bg-zinc-800/50 border-l-2 border-l-transparent text-zinc-300"
                                                                            }`}>
                                                                        <FileIcon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-indigo-400" : "text-zinc-500"}`} />
                                                                        <span className={`text-[11px] flex-1 truncate ${isSelected ? "font-semibold" : ""}`}>{file.name}</span>
                                                                        <Badge variant="outline" className={`text-[7px] h-3.5 px-1 shrink-0 ${typeLabel === "PPT" ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                                                                            : typeLabel === "PDF" ? "bg-red-500/10 text-red-400 border-red-500/30"
                                                                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                                                            }`}>{typeLabel}</Badge>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })}
                                                {filteredSLD.length === 0 && (
                                                    <p className="text-center text-[11px] text-zinc-500 py-8">Tidak ada file ditemukan.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom nav */}
                                    <div className="border-t border-zinc-800 p-1.5 flex items-center justify-between gap-1 shrink-0">
                                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-zinc-400 hover:text-white" disabled={selectedIdx <= 0} onClick={navigatePrev}>
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </Button>
                                        <span className="text-[10px] text-zinc-500">{selectedIdx + 1} / {filteredSLD.length}</span>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-zinc-400 hover:text-white" disabled={selectedIdx >= filteredSLD.length - 1} onClick={navigateNext}>
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Preview panel */}
                                <div className="flex-1 relative bg-black">
                                    {/* Sidebar toggle button (always visible) */}
                                    <Button variant="ghost" size="sm"
                                        className="absolute top-2 left-2 z-10 h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-sm bg-black/30 rounded-md"
                                        onClick={() => setSidebarOpen(p => !p)} title={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"}>
                                        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>

                                    {selectedFile ? (
                                        <iframe
                                            key={selectedFile.id}
                                            src={selectedFile.viewUrl}
                                            className="w-full h-full border-0"
                                            allow="autoplay"
                                            allowFullScreen
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-zinc-500">
                                            <div className="text-center">
                                                <FileImage className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                                <p className="text-sm">Pilih diagram dari daftar</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom bar with quick-jump */}
                            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-t border-zinc-800 shrink-0">
                                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1.5"
                                    disabled={selectedIdx <= 0} onClick={navigatePrev}>
                                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                                </Button>
                                <div className="flex items-center gap-3">
                                    <SelectNative value={selectedFileId ?? ""} onChange={e => setSelectedFileId(e.target.value)}
                                        className="w-72 text-xs bg-zinc-800 border-zinc-700 text-white">
                                        {filteredSLD.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </SelectNative>
                                    <span className="text-[10px] text-zinc-500 hidden md:block">← → navigasi • Esc tutup</span>
                                </div>
                                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1.5"
                                    disabled={selectedIdx >= filteredSLD.length - 1} onClick={navigateNext}>
                                    Berikutnya <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileImage className="h-6 w-6 text-indigo-400" /> SLD Tower
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Single Line Diagram Tower — {rawData.length.toLocaleString()} records • {sldFiles.length} diagram
                        {hasFilters && ` (menampilkan ${filtered.length.toLocaleString()})`}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Reset Filter
                        </button>
                    )}
                    <DataFreshness />
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: "Jumlah Data", value: totalTower, icon: Layers, color: C.indigo },
                    { label: "Jumlah ULTG", value: totalULTG, icon: Building2, color: C.teal },
                    { label: "Jumlah Gardu Induk", value: totalGI, icon: MapPin, color: C.amber },
                    { label: "Jumlah Penghantar", value: totalPenghantar, icon: Radio, color: C.purple },
                    { label: "Diagram SLD", value: sldFiles.length, icon: FileImage, color: C.emerald },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                            <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 80% 20%, ${kpi.color}15, transparent 60%)` }} />
                            <CardContent className="p-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xl md:text-2xl font-extrabold leading-none">{kpi.value.toLocaleString()}</p>
                                        <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider" style={{ color: kpi.color }}>{kpi.label}</p>
                                    </div>
                                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                                        <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* ══════════════════════════════════════════════════
                 COMPACT SLD VIEWER CARD (click to open modal)
                 ══════════════════════════════════════════════════ */}
            <div ref={viewerRef} />
            <Card className="overflow-hidden cursor-pointer group hover:border-primary/30 transition-all duration-200 hover:shadow-md hover:shadow-primary/5"
                onClick={() => setFullscreen(true)}>
                <CardContent className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors shrink-0">
                            <Eye className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold">SLD Tower Viewer</h3>
                            <p className="text-[10px] text-muted-foreground">{sldFiles.length} diagram • {sldGroups.length} grup</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                            <Maximize2 className="h-3 w-3" /> Buka Viewer
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* ── Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" /> Distribusi Tower per ULTG
                            <Badge variant="secondary" className="ml-auto text-[9px] cursor-pointer">
                                {activeULTG ? `Filter: ${activeULTG}` : "Klik segment untuk filter"}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={ultgDonutOption} style={{ height: 320 }}
                            onEvents={{ click: (params: { name?: string }) => setActiveULTG(prev => prev === params.name ? null : params.name!) }} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" /> Distribusi Tower per Gardu Induk
                            <Badge variant="secondary" className="ml-auto text-[9px]">Top 15</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ReactECharts option={giDonutOption} style={{ height: 320 }} />
                    </CardContent>
                </Card>
            </div>

            {/* ── Data Filters ── */}
            <Card>
                <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <SelectNative value={filterULTG || activeULTG || ""} onChange={e => { setFilterULTG(e.target.value); setActiveULTG(null); setFilterGI(""); }} className="w-40 text-xs">
                            <option value="">Semua ULTG</option>
                            {ultgList.map(u => <option key={u} value={u}>{u}</option>)}
                        </SelectNative>
                        <SelectNative value={filterGI} onChange={e => setFilterGI(e.target.value)} className="w-52 text-xs">
                            <option value="">Semua Gardu Induk</option>
                            {giList.map(g => <option key={g} value={g}>{g}</option>)}
                        </SelectNative>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cari tower, penghantar..." className="pl-9 h-8 text-xs" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {hasFilters && (
                <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-xs text-muted-foreground">Filter aktif:</span>
                    {(filterULTG || activeULTG) && <Badge variant="secondary" className="text-xs">ULTG: {filterULTG || activeULTG}</Badge>}
                    {filterGI && <Badge variant="secondary" className="text-xs">GI: {filterGI}</Badge>}
                    {searchQuery && <Badge variant="secondary" className="text-xs">Search: &quot;{searchQuery}&quot;</Badge>}
                </div>
            )}

            {/* ── Data Table ── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <FileImage className="h-4 w-4 text-primary" /> Detail SLD Tower
                        <Badge variant="secondary" className="ml-auto text-[9px]">
                            {filtered.length.toLocaleString()} data — Halaman {page + 1}/{totalPages || 1}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>{tableHeaders.map((h, i) => <TableHead key={i} className="whitespace-nowrap text-xs">{HEADER_DISPLAY[h] || h}</TableHead>)}</TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((r, i) => {
                                    const matchedFile = findMatchingFile(r[COL.SLD]);
                                    return (
                                        <TableRow key={i} className="hover:bg-muted/50 transition-colors">
                                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{r[COL.NO] || (page * PAGE_SIZE + i + 1)}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-[10px]">{r[COL.ULTG] || "-"}</Badge></TableCell>
                                            <TableCell className="text-xs font-medium">{r[COL.GI] || "-"}</TableCell>
                                            <TableCell className="text-xs max-w-[250px] truncate" title={r[COL.PENGHANTAR]}>{r[COL.PENGHANTAR] || "-"}</TableCell>
                                            <TableCell className="text-xs font-mono">{r[COL.NO_TOWER] || "-"}</TableCell>
                                            <TableCell className="text-xs">
                                                <div className="flex items-center gap-1.5 max-w-[200px]">
                                                    <span className="truncate" title={r[COL.SLD]}>{r[COL.SLD] || "-"}</span>
                                                    {matchedFile && (
                                                        <Button variant="ghost" size="sm"
                                                            className="h-5 w-5 p-0 shrink-0 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                                                            title="Lihat SLD Diagram"
                                                            onClick={() => scrollToViewer(matchedFile.id)}>
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[9px] bg-amber-500/15 text-amber-500 border-amber-500/30">
                                                    {r[COL.CATATAN] || "On Progress Update"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {paginatedData.length === 0 && (
                                    <TableRow><TableCell colSpan={tableHeaders.length} className="h-24 text-center">Tidak ada data ditemukan.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="h-8 text-xs gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Prev</Button>
                            <div className="flex gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                                    let p: number;
                                    if (totalPages <= 5) p = idx;
                                    else if (page < 3) p = idx;
                                    else if (page > totalPages - 4) p = totalPages - 5 + idx;
                                    else p = page - 2 + idx;
                                    return <Button key={p} variant={page === p ? "default" : "outline"} size="sm" onClick={() => setPage(p)} className="w-8 h-8 text-xs p-0">{p + 1}</Button>;
                                })}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="h-8 text-xs gap-1">Next <ChevronRight className="h-3.5 w-3.5" /></Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
