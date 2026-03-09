"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Map as MapIcon, Filter, Layers, Navigation, ChevronDown, ListFilter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataFreshness } from "@/components/DataFreshness";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePageData } from "@/hooks/usePageData";

// Dynamically import map to avoid SSR issues with MapLibre
const Map = dynamic(() => import("@/components/maps/TowerMap"), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-md" />
});

const KERAWANAN_KATEGORI = [
    "ANDONGAN RENDAH", "GALIAN", "POHON", "BANGUNAN", "LAYANGAN",
    "BALON UDARA", "LONGSOR", "BANJIR", "PETIR", "SOSIAL/WARGA/PTPN/TNGHS/DLL",
    "PENCURIAN", "KOROSIF"
];

function isRawan(val: string) {
    if (!val) return false;
    const v = String(val).toUpperCase().trim();
    return v === "YA" || v === "Y" || v === "TRUE" || v === "ADA" || v === "V";
}

type Row = Record<string, any>;

type TowerRow = Row & { lat: number; long: number; kerawanan: string[] };

export default function KerawananTransmisiPage() {
    /* ── Data: SSOT via usePageData ── */
    const { sheets, loading } = usePageData("/transmisi/kerawanan");
    const rawData: Row[] = sheets[0]?.rows ?? [];

    const [filterULTG, setFilterULTG] = useState("ALL");
    const [filterKerawanan, setFilterKerawanan] = useState("ALL");


    // Filter valid towers with coordinates
    const validTowers = useMemo((): TowerRow[] => {
        return rawData
            .filter(r => r["LAT"] && r["LONG"])
            .map((r): TowerRow => {
                // Parse coordinates safely
                let lat = parseFloat(String(r["LAT"]).replace(",", "."));
                let long = parseFloat(String(r["LONG"]).replace(",", "."));

                // Extract active kerawanan
                const activeKerawanan = KERAWANAN_KATEGORI.filter(k => isRawan(r[k]));

                return {
                    ...r,
                    lat,
                    long,
                    kerawanan: activeKerawanan
                };
            })
            .filter(t => !isNaN(t.lat) && !isNaN(t.long));
    }, [rawData]);

    // Apply User Filters
    const filteredTowers = useMemo(() => {
        return validTowers.filter(t => {
            // Filter ULTG
            if (filterULTG !== "ALL") {
                const towerUltg = String(t["MASTER ULTG"] || "").toUpperCase();
                // Match either exact ULTG name or substring if it contains BOGOR/SUKABUMI
                if (!towerUltg.includes(filterULTG.toUpperCase())) return false;
            }

            // Filter Kerawanan
            if (filterKerawanan !== "ALL") {
                if (!t.kerawanan.includes(filterKerawanan)) return false;
            }

            return true;
        });
    }, [validTowers, filterULTG, filterKerawanan]);

    // KPI Calculations
    const vulnerableTowers = useMemo(() => filteredTowers.filter(t => t.kerawanan.length > 0), [filteredTowers]);
    const vulnerableCount = vulnerableTowers.length;

    // Count specific kerawanan types
    const kerawananStats = useMemo(() => {
        const counts: Record<string, number> = {};
        KERAWANAN_KATEGORI.forEach(k => counts[k] = 0);

        vulnerableTowers.forEach(t => {
            t.kerawanan.forEach((k: string) => {
                if (counts[k] !== undefined) counts[k]++;
            });
        });

        // Filter out zeroes
        return Object.entries(counts)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
    }, [vulnerableTowers]);

    if (!loading && rawData.length === 0) {
        return (
            <div className="flex items-center justify-center p-8">
                <Card className="max-w-md w-full"><CardContent className="p-6 text-center text-red-500">Tidak ada data tersedia</CardContent></Card>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <MapIcon className="h-6 w-6 text-primary" />
                        Peta Kerawanan Transmisi
                    </h1>
                </div>
                <DataFreshness />
            </div>

            {/* Map Container - Now placed FIRST */}
            <Card className="flex-grow min-h-[400px] overflow-hidden border-border/50 shadow-sm relative shrink-0">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-primary animate-bounce"></div>
                        <div className="w-4 h-4 rounded-full bg-primary animate-bounce delay-75"></div>
                        <div className="w-4 h-4 rounded-full bg-primary animate-bounce delay-150"></div>
                        <span className="ml-2 text-sm font-medium animate-pulse">Memuat Peta Geospatial...</span>
                    </div>
                )}
                <div className="w-full h-full">
                    {!loading && <Map data={filteredTowers} />}
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 shrink-0">
                {/* Filters - Now placed below the Map */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Card className="bg-card/60 backdrop-blur-sm w-full sm:w-auto">
                        <CardContent className="p-3 flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Navigation className="w-4 h-4 text-primary" /> ULTG:
                            </div>
                            <select
                                className="bg-background border rounded-md px-3 py-1.5 text-sm outline-none"
                                value={filterULTG}
                                onChange={e => setFilterULTG(e.target.value)}
                            >
                                <option value="ALL">Semua Unit</option>
                                <option value="BOGOR">ULTG Bogor</option>
                                <option value="SUKABUMI">ULTG Sukabumi</option>
                            </select>

                            <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>

                            <div className="flex items-center gap-2 text-sm font-medium">
                                <AlertTriangle className="w-4 h-4 text-orange-500" /> Tampilkan Kerawanan:
                            </div>
                            <select
                                className="bg-background border rounded-md px-3 py-1.5 text-sm outline-none max-w-[200px] truncate"
                                value={filterKerawanan}
                                onChange={e => setFilterKerawanan(e.target.value)}
                            >
                                <option value="ALL">Semua Kerawanan (Gabungan)</option>
                                <optgroup label="Tipe Kerawanan">
                                    {KERAWANAN_KATEGORI.map(k => (
                                        <option key={k} value={k}>{k}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </CardContent>
                    </Card>
                </div>

                {/* Kerawanan Stats Strip - Now placed above Table */}
                <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 custom-scrollbar">
                    <div className="flex-shrink-0 bg-slate-900 dark:bg-slate-800 text-white rounded-md p-2 px-3 border border-slate-700 shadow-sm hidden lg:block">
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Tower</p>
                        <p className="text-xl font-black">{(loading ? "-" : filteredTowers.length).toLocaleString()}</p>
                    </div>
                    <div className="flex-shrink-0 bg-red-600 dark:bg-red-900 text-white rounded-md p-2 px-3 shadow-sm hidden lg:block">
                        <p className="text-[9px] text-red-200 uppercase font-bold tracking-wider flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Rawan Terdeteksi</p>
                        <p className="text-xl font-black">{(loading ? "-" : vulnerableCount).toLocaleString()}</p>
                    </div>

                    <div className="w-px bg-border flex-shrink-0 mx-1 hidden lg:block"></div>

                    {kerawananStats.map(([k, count]) => {
                        const isSelected = filterKerawanan === k;
                        return (
                            <button
                                key={k}
                                onClick={() => setFilterKerawanan(isSelected ? "ALL" : k)}
                                className={`flex-shrink-0 border rounded-md p-2 min-w-[120px] max-w-[160px] flex items-center justify-between shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                                    ${isSelected
                                        ? "bg-red-500/10 border-red-500/50 dark:bg-red-500/20"
                                        : "bg-card hover:bg-muted"}`}
                            >
                                <span className={`text-[10px] font-semibold truncate mr-2 ${isSelected ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} title={k}>
                                    {k.replace("SOSIAL/WARGA/PTPN/TNGHS/DLL", "SOSIAL")}
                                </span>
                                <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${isSelected ? "bg-red-500 text-white" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                    {kerawananStats.length === 0 && !loading && (
                        <div className="flex-shrink-0 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-500 border border-green-200 dark:border-green-800 rounded-md p-2 flex items-center h-10">
                            <span className="text-xs font-bold font-mono">✅ 0 KERAWANAN</span>
                        </div>
                    )}
                </div>

                {/* Tower Table - Now placed THIRD and spans full width */}
                <Card className="border-border/50 shadow-sm flex flex-col h-[400px] overflow-hidden">
                    <CardHeader className="py-3 px-4 shrink-0 bg-muted/40 border-b">
                        <CardTitle className="text-base flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <ListFilter className="w-4 h-4 text-primary" />
                                Daftar Tower Rawan
                            </div>
                            <Badge variant="destructive" className="font-mono">{vulnerableCount}</Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Tower yang terdeteksi memiliki potensi kerawanan
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-auto flex-grow custom-scrollbar">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[180px]">Tower/ULTG</TableHead>
                                    <TableHead>Gardu Induk</TableHead>
                                    <TableHead>Penghantar</TableHead>
                                    <TableHead>Kerawanan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground animate-pulse">
                                            Memuat Data Tower...
                                        </TableCell>
                                    </TableRow>
                                ) : vulnerableTowers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground border-b-0">
                                            <div className="flex flex-col items-center justify-center text-green-600 dark:text-green-500">
                                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-2">
                                                    ✅
                                                </div>
                                                <p className="font-semibold text-sm">Tidak ada tower rawan</p>
                                                <p className="text-xs opacity-75">Sistem transmisi aman di area ini.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    vulnerableTowers.map((tower, idx) => (
                                        <TableRow key={idx} className="hover:bg-muted/50 cursor-default group">
                                            <TableCell className="font-medium align-top">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">{tower["NAMA TOWER"] || "-"}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono">{tower["MASTER ULTG"] || "-"}</p>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{tower["MASTER GARDU INDUK"] || "-"}</p>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <p className="text-xs font-semibold leading-tight line-clamp-2" title={tower["PENGHANTAR"]}>{tower["PENGHANTAR"] || "-"}</p>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-wrap gap-1">
                                                    {tower.kerawanan.map((k: string, kIdx: number) => (
                                                        <Badge key={kIdx} variant="outline" className="text-[9px] bg-red-50 text-red-700 hover:bg-red-100 border-red-200 dark:bg-red-950/40 dark:text-red-400 font-semibold px-1 py-0 h-auto break-all">
                                                            {k.replace("SOSIAL/WARGA/PTPN/TNGHS/DLL", "SOSIAL")}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
