"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/useSnapshot";
import { ProteksiContent } from "./_components/ProteksiContent";

interface ProgramKerjaProteksiPageProps {
  /** True kalau di-embed di hub /program-kerja Tabs — sembunyikan page header. */
  embedded?: boolean;
}

/**
 * Program Kerja Proteksi — UPT Bogor 2026.
 * Sumber data: SNAPSHOT (Supabase Postgres) via useSnapshot, bukan BigQuery.
 *  - pk_proteksi_summary → ringkasan per program (21 program, 3 grup)
 *  - pk_proteksi_detail  → 500 item detail per bay
 *  - meta                → tanggal updated
 * Visual: harmonisasi dengan golden standard Program Kerja Transmisi.
 */
export default function ProgramKerjaProteksiPage({ embedded }: ProgramKerjaProteksiPageProps = {}) {
  const summary = useSnapshot<Record<string, unknown>>("pk_proteksi_summary");
  const detail = useSnapshot<Record<string, unknown>>("pk_proteksi_detail");
  const meta = useSnapshot<{ k: string; v: string }>("meta");

  const updatedAt = useMemo(() => {
    const row = meta.rows.find((r) => r.k === "updated" || r.k === "updated_at" || r.k === "last_updated");
    return row?.v ?? null;
  }, [meta.rows]);

  const loading = summary.loading || detail.loading;
  const error = summary.error || detail.error;

  if (loading) {
    return (
      <div className="space-y-3">
        {!embedded && <Skeleton className="h-8 w-72" />}
        <Skeleton className="h-36 w-full rounded-md" />
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-[420px] w-full rounded-md" />
        <Skeleton className="h-[480px] w-full rounded-md" />
      </div>
    );
  }

  if (error && summary.rows.length === 0 && detail.rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-6 py-4 text-center">
          <p className="ds-body text-destructive">Gagal memuat data snapshot</p>
          <p className="mt-1 ds-small">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ProteksiContent
      summaryRaw={summary.rows}
      detailRaw={detail.rows}
      updatedAt={updatedAt}
      embedded={embedded}
    />
  );
}
