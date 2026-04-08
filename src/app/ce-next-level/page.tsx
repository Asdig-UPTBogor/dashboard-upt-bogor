"use client";

import { useState, useMemo } from "react";
import { usePageData, type SheetData } from "@/hooks/usePageData";
import { AlertTriangle, RefreshCw, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataFreshness } from "@/components/DataFreshness";
import { motion, AnimatePresence } from "framer-motion";
import { CEJaringanContent } from "./_components/CEJaringanContent";
import { CEGarduIndukContent } from "./_components/CEGarduIndukContent";
import { CEProteksiContent } from "./_components/CEProteksiContent";

/* ── Tab Configuration ── */
const TABS = [
    { sheet: "CE HARJAR", label: "CE Jaringan" },
    { sheet: "CE HARGI", label: "CE Gardu Induk" },
    { sheet: "CE HARPRO", label: "CE Proteksi" },
];

const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const transition = (d: number) => ({ duration: 0.3, delay: d * 0.5, ease: [0.16, 1, 0.3, 1] as const });

export default function CENextLevelPage() {
    const [activeTab, setActiveTab] = useState(TABS[0].sheet);

    /* ── Fetch ALL sheets at once (4 sheets, ~5285 rows total) ── */
    const { sheets, loading, error, refetch } = usePageData("/ce-next-level");

    /* ── Find sheet data for each tab ── */
    const getSheet = (sheetName: string): SheetData | undefined =>
        sheets.find(s => s.sheetName === sheetName);

    const activeSheetData = getSheet(activeTab);

    /* ── Build GI → ULTG lookup from Master sheet ── */
    const giToUltgMap = useMemo(() => {
        const masterSheet = sheets.find(s => s.sheetName === "Master Gardu Induk");
        const map: Record<string, string> = {};
        if (masterSheet?.rows) {
            masterSheet.rows.forEach((r: Record<string, string>) => {
                const gi = (r["Master Gardu Induk"] || "").trim();
                const ultg = (r["Master ULTG"] || "").trim();
                if (gi && ultg) {
                    map[gi] = ultg;
                    // Also store normalized key (collapse spaces, uppercase) for fuzzy match
                    map[gi.replace(/\s+/g, "").toUpperCase()] = ultg;
                }
            });
        }
        return map;
    }, [sheets]);

    /* ── Initial loading state ── */
    if (loading && sheets.length === 0) {
        return (
            <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center pb-4">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-32" />
                </div>
                <div className="flex gap-4 border-b border-border pb-px">
                    <Skeleton className="h-10 w-28 rounded-b-none" />
                    <Skeleton className="h-10 w-36 rounded-b-none" />
                    <Skeleton className="h-10 w-28 rounded-b-none" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-[280px] w-full rounded-md" />
                    <Skeleton className="h-[280px] w-full rounded-md" />
                    <Skeleton className="h-[280px] w-full rounded-md" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-md" />
            </div>
        );
    }

    if (error && sheets.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Card className="max-w-md w-full">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                        <h2 className="text-lg font-bold mb-2">Gagal Memuat Data</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            <span className="text-xs text-zinc-400 block mt-1">{error}</span>
                        </p>
                        <button onClick={refetch} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
                            <RefreshCw className="h-3 w-3 inline mr-1" /> Coba Lagi
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <motion.div {...fadeUp} transition={transition(0)} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-indigo-400" />
                        Common Enemy Next Level UPT Bogor
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Monitoring Progress Common Enemy
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    <DataFreshness />
                </div>
            </motion.div>

            {/* Vercel-style underline tabs */}
            <motion.div {...fadeUp} transition={transition(0.1)} className="border-b border-border relative">
                <nav className="flex gap-0 flex-wrap -mb-px" aria-label="Tabs">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.sheet;
                        const tabSheet = getSheet(tab.sheet);
                        const rowCount = tabSheet?.rowCount;
                        return (
                            <button
                                key={tab.sheet}
                                onClick={() => setActiveTab(tab.sheet)}
                                className={[
                                    "relative flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium transition-colors",
                                    "border-b-2 -mb-px outline-none whitespace-nowrap",
                                    isActive
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                                ].join(" ")}
                            >
                                {tab.label}
                                {rowCount != null ? (
                                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        {rowCount}
                                    </span>
                                ) : (
                                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        —
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </motion.div>

            {/* Tab Content — instant switch, all data pre-loaded */}
            <AnimatePresence mode="wait">
                {activeSheetData ? (
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {activeTab === "CE HARJAR"
                            ? <CEJaringanContent sheetData={activeSheetData} />
                            : activeTab === "CE HARGI"
                            ? <CEGarduIndukContent sheetData={activeSheetData} giToUltgMap={giToUltgMap} />
                            : <CEProteksiContent sheetData={activeSheetData} giToUltgMap={giToUltgMap} />
                        }
                    </motion.div>
                ) : (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            <span className="text-sm">Memuat {TABS.find(t => t.sheet === activeTab)?.label}...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
