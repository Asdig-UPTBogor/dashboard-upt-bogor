"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/designer/Icon";
import { Btn } from "@/components/designer/Button";
import { useSnapshot } from "@/hooks/useSnapshot";
import { FM_ENTER, FM_SECTION, MOTION } from "@/lib/chart-tokens";
import { BIDANG_CONFIG, type Bidang, type CeSummaryRow, type MetaRow } from "./_components/ce-types";
import { CeBidangContent } from "./_components/v2/CeBidangContent";

const fadeUp = { initial: FM_ENTER().initial, animate: FM_ENTER().animate };

/** "12 JUNI 2026" → "12 Juni 2026" */
function titleCase(s: string): string {
    return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
const transition = (d: number) => FM_SECTION(d);

export default function CENextLevelPage() {
    const [activeTab, setActiveTab] = useState<Bidang>(BIDANG_CONFIG[0].bidang);

    // ce_summary (semua bidang) + meta updated — fetch sekali, ringan.
    const { rows: summaryAll, loading, error } = useSnapshot<CeSummaryRow>("ce_summary");
    const { rows: meta } = useSnapshot<MetaRow>("meta");
    const updated = meta.find((m) => m.k === "updated")?.v;

    const activeConfig = BIDANG_CONFIG.find((c) => c.bidang === activeTab) ?? BIDANG_CONFIG[0];

    if (loading && summaryAll.length === 0) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-8 w-72" />
                <div className="flex gap-2 border-b border-border pb-px">
                    <Skeleton className="h-9 w-28 rounded-b-none" />
                    <Skeleton className="h-9 w-32 rounded-b-none" />
                    <Skeleton className="h-9 w-28 rounded-b-none" />
                </div>
                <Skeleton className="h-[180px] w-full rounded-md" />
                <div className="grid grid-cols-12 gap-3">
                    <Skeleton className="h-[260px] col-span-12 md:col-span-5 rounded-md" />
                    <Skeleton className="h-[260px] col-span-12 md:col-span-7 rounded-md" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-md" />
            </div>
        );
    }

    if (error && summaryAll.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center p-4">
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-4 text-center">
                    <p className="ds-body text-destructive">Gagal memuat data snapshot</p>
                    <p className="mt-1 ds-small">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <motion.div
                {...fadeUp}
                transition={transition(0)}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3"
            >
                <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                        <span>Monitoring</span>
                        <Icon name="chevronRight" size={11} />
                        <span style={{ color: "var(--fg-0)" }}>Common Enemy Next Level</span>
                    </div>
                    <h1 className="ds-heading">Common Enemy Next Level</h1>
                    <p className="ds-body mt-0.5">Monitoring Progress Penyelesaian Anomali Common Enemy · UPT Bogor</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {updated && (
                        <span
                            className="ds-small"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                color: "var(--fg-2)",
                            }}
                        >
                            <span className="ds-led-dot" style={{ color: "var(--cond-very-good)" }} />
                            <span style={{ letterSpacing: "0.04em" }}>
                                Update : <span style={{ color: "var(--fg-0)" }}>{titleCase(updated)}</span>
                            </span>
                        </span>
                    )}
                    <a href="/presentation/ce" style={{ textDecoration: "none" }}>
                        <Btn icon="presentation" variant="primary" size="sm">
                            Slide Deck
                        </Btn>
                    </a>
                </div>
            </motion.div>

            {/* Tabs 3 bidang */}
            <motion.div {...fadeUp} transition={transition(0.1)} className="border-b border-border relative">
                <nav className="flex gap-0 -mb-px" aria-label="Bidang">
                    {BIDANG_CONFIG.map((c) => {
                        const isActive = activeTab === c.bidang;
                        return (
                            <button
                                key={c.bidang}
                                onClick={() => setActiveTab(c.bidang)}
                                className={[
                                    "relative flex items-center gap-2 px-6 py-2.5 ds-label ds-transition cursor-pointer",
                                    "border-b-2 -mb-px outline-none whitespace-nowrap",
                                    isActive
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                                ].join(" ")}
                            >
                                {c.label}
                                <span
                                    className="num"
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        color: isActive ? c.accent : "var(--fg-3)",
                                        background: isActive
                                            ? `color-mix(in oklab, ${c.accent} 14%, transparent)`
                                            : "transparent",
                                        border: isActive
                                            ? `1px solid color-mix(in oklab, ${c.accent} 28%, transparent)`
                                            : "1px solid transparent",
                                    }}
                                >
                                    {c.nickname}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </motion.div>

            {/* Konten per bidang — switch instan, remount per bidang biar fetch detail bidang-nya */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={FM_ENTER().initial}
                    animate={FM_ENTER().animate}
                    exit={{ opacity: 0 }}
                    transition={{ duration: MOTION.dur.slow, ease: MOTION.ease.out }}
                >
                    <CeBidangContent config={activeConfig} summaryAll={summaryAll} />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
