"use client";

import { useMemo } from "react";
import { useSnapshot } from "@/hooks/useSnapshot";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgramKerjaTransmisiContent } from "./_components/ProgramKerjaTransmisiContent";

interface ProgramKerjaTransmisiPageProps {
    /** True kalau di-embed di hub `/program-kerja` Tabs — sembunyikan page header, biar gak duplikat */
    embedded?: boolean;
}

/** Baris snapshot pk_transmisi (schema dashboard_snapshot). */
interface PkTransmisiRow {
    no: string;
    jenis_program: string;
    nama_program: string;
    risiko: string;
    kategori: string;
    pos_anggaran: string;
    keterangan: string;
    target_bogor: number;
    realisasi_bogor: number;
    target_sukabumi: number;
    realisasi_sukabumi: number;
    total_target: number;
    total_realisasi: number;
    pelaksana: string;
    lokasi: string;
    program_kerja: string;
}

const pct = (real: number, target: number) =>
    target > 0 ? `${Math.round((real / target) * 100)}%` : "-%";

/**
 * Sumber data: snapshot Supabase `dashboard_snapshot.pk_transmisi` (sheet 14.LM JARINGAN 2026).
 * Pindah dari BigQuery (GCP suspended). Di-adapt ke bentuk SheetData (header = nama kolom sheet asli)
 * supaya ProgramKerjaTransmisiContent + normalizer existing tetap dipakai tanpa diubah.
 */
export default function ProgramKerjaTransmisiPage({ embedded }: ProgramKerjaTransmisiPageProps = {}) {
    const { rows, loading, error } = useSnapshot<PkTransmisiRow>("pk_transmisi");

    const sheets = useMemo(() => {
        const headers = [
            "NO", "JENIS PROGRAM", "NAMA PROGRAM", "RISIKO", "KATEGORI", "POS ANGGARAN", "KETERANGAN",
            "TARGET ULTG BOGOR", "REALISASI ULTG BOGOR", "TARGET ULTG SUKABUMI", "REALISASI ULTG SUKABUMI",
            "PRESENTASE ULTG BOGOR", "PRESENTASE ULTG SUKABUMI", "TOTAL TARGET", "TOTAL REALISASI",
            "TOTAL PRESENTASE", "PELAKSANA", "LOKASI", "PROGRAM KERJA",
        ];
        const mapped = (rows || []).map((r) => ({
            "NO": String(r.no ?? ""),
            "JENIS PROGRAM": r.jenis_program ?? "",
            "NAMA PROGRAM": r.nama_program ?? "",
            "RISIKO": r.risiko ?? "",
            "KATEGORI": r.kategori ?? "",
            "POS ANGGARAN": r.pos_anggaran ?? "",
            "KETERANGAN": r.keterangan ?? "",
            "TARGET ULTG BOGOR": String(r.target_bogor ?? 0),
            "REALISASI ULTG BOGOR": String(r.realisasi_bogor ?? 0),
            "TARGET ULTG SUKABUMI": String(r.target_sukabumi ?? 0),
            "REALISASI ULTG SUKABUMI": String(r.realisasi_sukabumi ?? 0),
            "PRESENTASE ULTG BOGOR": pct(r.realisasi_bogor, r.target_bogor),
            "PRESENTASE ULTG SUKABUMI": pct(r.realisasi_sukabumi, r.target_sukabumi),
            "TOTAL TARGET": String(r.total_target ?? 0),
            "TOTAL REALISASI": String(r.total_realisasi ?? 0),
            "TOTAL PRESENTASE": pct(r.total_realisasi, r.total_target),
            "PELAKSANA": r.pelaksana ?? "",
            "LOKASI": r.lokasi ?? "",
            "PROGRAM KERJA": r.program_kerja ?? "",
        }));
        return [{ headers, rows: mapped }];
    }, [rows]);

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

    if (error && (!rows || rows.length === 0)) {
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
