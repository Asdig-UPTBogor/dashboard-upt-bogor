"use client";

import { useState, useMemo } from "react";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HargiTab } from "./HargiTab";
import { TrafoTab } from "./TrafoTab";

/* ══ Motion presets ══ */
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };
const transition = (d: number) => ({ duration: 0.3, delay: d * 0.5, ease: [0.16, 1, 0.3, 1] as const });

/* ══ Sheet names ══ */
const SHEET = {
  HARGI: "PROGRAM KERJA HARGI",
  TRAFO: "PROGRAM STRATEGIS TRAFO",
} as const;

type Row = Record<string, string>;
type Tab = "hargi" | "trafo";

/* ══════════════════════════════════════════════════════════════════════ */
export function ProgramKerjaGarduIndukContent() {
  const sheetNames = useMemo(() => [SHEET.HARGI, SHEET.TRAFO], []);
  const { sheets, loading } = usePageData("/gardu-induk/program-kerja", { sheets: sheetNames });

  const [tab, setTab] = useState<Tab>("hargi");

  /* ── Raw data — each tab gets its own independent dataset ── */
  const hargiRows = useMemo(() =>
    (sheets.find(s => s.sheetName === SHEET.HARGI)?.rows || []) as unknown as Row[], [sheets]);
  const trafoRows = useMemo(() =>
    (sheets.find(s => s.sheetName === SHEET.TRAFO)?.rows || []) as unknown as Row[], [sheets]);

  const hargiCount = hargiRows.length;
  const trafoCount = trafoRows.length;

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <motion.div {...fadeUp} transition={transition(0)} className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base md:text-lg font-bold tracking-tight flex items-center gap-1.5 whitespace-nowrap">
          <CalendarDays className="h-5 w-5 text-primary" />
          Program Kerja Gardu Induk
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {tab === "hargi"
              ? `${hargiCount} item · ${new Set(hargiRows.map(r => r["NAMA PROGRAM"]).filter(Boolean)).size} program`
              : `${trafoCount} unit trafo`}
          </span>
          <DataFreshness />
        </div>
      </motion.div>

      {/* Full-width tab bar — Vercel-style underline tabs */}
      <motion.div {...fadeUp} transition={transition(0.1)} className="border-b border-border">
        <nav className="flex gap-0 -mb-px" aria-label="Tabs">
          {([
            { key: "hargi" as Tab, label: "Program Kerja Gardu Induk" },
            { key: "trafo" as Tab, label: "Program Strategis Trafo" },
          ] as const).map(t => {
            const isActive = tab === t.key;
            return (
              <button key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  "border-b-2 -mb-px outline-none",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                ].join(" ")}>
                {t.label}
              </button>
            );
          })}
        </nav>
      </motion.div>

      {/* Tab Content — each tab is FULLY INDEPENDENT, managing its own filters */}
      {tab === "hargi" && <HargiTab rows={hargiRows} />}
      {tab === "trafo" && <TrafoTab rows={trafoRows} />}
    </div>
  );
}
