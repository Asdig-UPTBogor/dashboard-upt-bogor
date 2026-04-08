/**
 * HealthyIndexContent — Main client wrapper for the Healthy Index MTU page.
 *
 * Responsibilities:
 *  1. Fetch data via usePageData
 *  2. Wrap everything in CrossFilterProvider
 *  3. Render loading / error / content states
 *  4. Compose all section components in layout order
 */
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import { SpreadsheetLink } from "@/components/shared/SpreadsheetLink";
import { CrossFilterProvider } from "./CrossFilterProvider";
import { useHealthyIndexData } from "./useHealthyIndexData";
import { KpiRow } from "./KpiRow";
import { MtuCards } from "./MtuCards";
import { GiBarSection } from "./GiBarSection";
import { GiBayDrillContainer } from "./GiBayDrillContainer";
import { DonutTrioSection } from "./DonutTrioSection";
import { HiDataTable } from "./HiDataTable";
import { SortableSections, type SectionDef } from "./SortableSections";
import { StatusHiBar } from "./StatusHiBar";

const PAGE_PATH = "/gardu-induk/healthy-index";

/* ── Loading skeleton ── */
function LoadingSkeleton() {
    return (
        <div className="space-y-2 p-2">
            <Skeleton className="h-8 w-72" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {[...Array(7)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                ))}
            </div>
            <Skeleton className="h-80" />
            <Skeleton className="h-64" />
        </div>
    );
}

/* ── Error card ── */
function ErrorCard({ message }: { message: string }) {
    return (
        <div className="flex h-64 items-center justify-center p-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-4 text-center">
                <p className="text-sm font-medium text-destructive">Gagal memuat data</p>
                <p className="mt-1 text-xs text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}

/* ── Inner content (must be inside CrossFilterProvider) ── */
function InnerContent({ sheets }: { sheets: ReturnType<typeof usePageData>["sheets"] }) {
    const { allRows, filtered, stats, allStats, spreadsheetIds } = useHealthyIndexData(sheets);

    return (
        <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-sm font-bold tracking-tight">Healthy Index MTU</h1>
                    <p className="text-xs text-muted-foreground">
                        Evaluasi kondisi MTU Gardu Induk — UPT Bogor
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    <DataFreshness pagePath={PAGE_PATH} />
                    <SpreadsheetLink spreadsheetIds={spreadsheetIds} />
                </div>
            </div>

            {/* Status HI — pinned full-width bar, always at top */}
            <StatusHiBar stats={stats} />

            {/* Sortable sections — drag handle appears on hover (left side) */}
            <SortableSections
                sections={[
                    { id: "kpi", label: "KPI", node: <KpiRow stats={stats} /> },
                    {
                        id: "mtu", label: "MTU Cards",
                        // MtuCards needs allStats (to always show all MTU cards) +
                        // stats (filtered) to show filtered counts & react to cross-filter.
                        node: <MtuCards allStats={allStats} stats={stats} />,
                    },
                    { id: "donut", label: "Distribusi", node: <DonutTrioSection stats={stats} filteredRows={filtered} /> },
                    {
                        id: "gi-drill", label: "Kondisi per GI",
                        node: <GiBayDrillContainer allStats={allStats} allRows={allRows} stats={stats} filteredRows={filtered} />
                    },
                    { id: "gi-bar", label: "HI per GI", node: <GiBarSection stats={stats} /> },
                    { id: "table", label: "Data Table", node: <HiDataTable filteredRows={filtered} allStats={allStats} /> },
                ] satisfies SectionDef[]}
            />
        </div>
    );
}

/* ── Main export ── */
export default function HealthyIndexContent() {
    const { sheets, loading, error } = usePageData(PAGE_PATH);

    if (loading) return <LoadingSkeleton />;
    if (error) return <ErrorCard message={String(error)} />;

    return (
        <CrossFilterProvider>
            <InnerContent sheets={sheets} />
        </CrossFilterProvider>
    );
}
