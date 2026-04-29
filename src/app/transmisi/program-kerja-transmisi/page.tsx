"use client";

import { usePageData } from "@/hooks/usePageData";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgramKerjaTransmisiContent } from "./_components/ProgramKerjaTransmisiContent";

interface ProgramKerjaTransmisiPageProps {
    /** True kalau di-embed di hub `/program-kerja` Tabs — sembunyikan page header, biar gak duplikat */
    embedded?: boolean;
}

export default function ProgramKerjaTransmisiPage({ embedded }: ProgramKerjaTransmisiPageProps = {}) {
    /** Reuse Firestore page-config /transmisi/program-kerja → BQ Master_Transmisi.n_14_LM_JARINGAN_2026 */
    const { sheets, loading, error } = usePageData("/transmisi/program-kerja");

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-32 w-full rounded-md" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Skeleton className="h-[480px] rounded-md" />
                    <Skeleton className="h-[480px] rounded-md" />
                </div>
            </div>
        );
    }

    if (error && (!sheets || sheets.length === 0)) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-6 py-4 text-center">
                    <p className="ds-body text-destructive">Gagal memuat data</p>
                    <p className="mt-1 ds-small">{error}</p>
                </div>
            </div>
        );
    }

    return <ProgramKerjaTransmisiContent sheets={sheets} embedded={embedded} />;
}
