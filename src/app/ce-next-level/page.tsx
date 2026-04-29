"use client";

import { useState, useMemo } from "react";
import { usePageData, type SheetData } from "@/hooks/usePageData";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DataFreshness } from "@/components/DataFreshness";
import { SpreadsheetLink } from "@/components/shared/SpreadsheetLink";
import { motion, AnimatePresence } from "framer-motion";
import { CEJaringanContent } from "./_components/CEJaringanContent";
import { CEGarduIndukContent } from "./_components/CEGarduIndukContent";
import { CEProteksiContent } from "./_components/CEProteksiContent";
import { MOTION, FM_ENTER, FM_SECTION } from "@/lib/chart-tokens";

/* ── Tab Configuration ── */
const TABS = [
    { sheet: "CE HARJAR", label: "Transmisi" },
    { sheet: "CE HARGI", label: "Gardu Induk" },
    { sheet: "CE HARPRO", label: "Proteksi" },
];

const fadeUp = { initial: FM_ENTER().initial, animate: FM_ENTER().animate };
const transition = (d: number) => FM_SECTION(d);

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
            <div className="flex h-64 items-center justify-center p-4">
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-4 text-center">
                    <p className="ds-body text-destructive">Gagal memuat data</p>
                    <p className="mt-1 ds-small">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <motion.div {...fadeUp} transition={transition(0)} className="flex items-center justify-between">
                <div>
                    <h1 className="ds-heading">Common Enemy Next Level</h1>
                    <p className="ds-body mt-0.5">
                        Monitoring Progress Common Enemy — UPT Bogor
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <DataFreshness pagePath="/ce-next-level" />
                </div>
            </motion.div>

            {/* Tabs */}
            <motion.div {...fadeUp} transition={transition(0.1)} className="border-b border-border relative">
                <nav className="flex gap-0 -mb-px" aria-label="Tabs">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.sheet;
                        return (
                            <button
                                key={tab.sheet}
                                onClick={() => setActiveTab(tab.sheet)}
                                className={[
                                    "relative flex items-center gap-2 px-6 py-2.5 ds-label ds-transition cursor-pointer",
                                    "border-b-2 -mb-px outline-none whitespace-nowrap",
                                    isActive
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                                ].join(" ")}
                            >
                                {tab.label}
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
                        initial={FM_ENTER().initial}
                        animate={FM_ENTER().animate}
                        exit={{ opacity: 0 }}
                        transition={{ duration: MOTION.dur.slow, ease: MOTION.ease.out }}
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
                        className="space-y-3"
                    >
                        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            <span className="ds-body">Memuat {TABS.find(t => t.sheet === activeTab)?.label}...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
