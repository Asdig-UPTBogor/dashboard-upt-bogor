"use client";

/**
 * deck-snapshot.ts — SSOT data untuk slide deck Program Kerja.
 *
 * SEMUA slide baca dari sini. Sumber = snapshot Supabase `dashboard_snapshot`
 * via useSnapshot — TABEL & NORMALIZER YANG SAMA dengan dashboard monitoring:
 *   - Transmisi   → pk_transmisi             (= /transmisi/program-kerja-transmisi)
 *   - Proteksi    → pk_proteksi_summary/detail   (= /proteksi/program-kerja)
 *   - Gardu Induk → pk_gardu_induk_summary/detail (= /gardu-induk/program-kerja)
 *   - meta        → tanggal update snapshot
 *
 * Angka slide DIJAMIN identik dashboard karena reuse normalizer dashboard:
 * proteksi-data.ts + gardu-induk-data.ts + program-kerja-data.ts (normalizeItem).
 * JANGAN hardcode angka di slide. JANGAN fetch BigQuery (suspended).
 */

import { useMemo } from "react";
import { useSnapshot } from "@/hooks/useSnapshot";
import {
    normalizeItem,
    type ProgramItem,
} from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";
import {
    aggregateByGrp as aggregateProteksi,
    normalizeDetail as normalizeProteksiDetail,
    normalizeSummary as normalizeProteksiSummary,
    totalsOf as totalsOfProteksi,
    GRP_ACCENT as PROTEKSI_GRP_ACCENT,
    GRP_COLOR_MAP as PROTEKSI_GRP_COLOR_MAP,
    GRP_LABEL as PROTEKSI_GRP_LABEL,
    GRP_ORDER as PROTEKSI_GRP_ORDER,
    type GrpAgg as ProteksiGrpAgg,
    type ProteksiDetailRow,
    type ProteksiSummaryRow,
} from "@/app/proteksi/program-kerja/_components/proteksi-data";
import {
    aggregateByGrp as aggregateGi,
    normalizeDetail as normalizeGiDetail,
    normalizeSummary as normalizeGiSummary,
    totalsOf as totalsOfGi,
    GRP_ACCENT as GI_GRP_ACCENT,
    GRP_COLOR_MAP as GI_GRP_COLOR_MAP,
    GRP_FULL as GI_GRP_FULL,
    GRP_LABEL as GI_GRP_LABEL,
    GRP_ORDER as GI_GRP_ORDER,
    type GrpAgg as GiGrpAgg,
    type GarduIndukDetailRow,
    type GarduIndukSummaryRow,
} from "@/app/gardu-induk/program-kerja/_components/gardu-induk-data";

/* Re-export konstanta grup biar slide cukup import dari 1 modul */
export {
    PROTEKSI_GRP_ACCENT, PROTEKSI_GRP_COLOR_MAP, PROTEKSI_GRP_LABEL, PROTEKSI_GRP_ORDER,
    GI_GRP_ACCENT, GI_GRP_COLOR_MAP, GI_GRP_FULL, GI_GRP_LABEL, GI_GRP_ORDER,
};
export type { ProgramItem, ProteksiGrpAgg, GiGrpAgg };

/* ─────────────── Meta (tanggal update snapshot) ─────────────── */

export function useDeckMeta(): { updated: string | null; loading: boolean } {
    const { rows, loading } = useSnapshot<{ k: string; v: string }>("meta");
    const updated = useMemo(() => {
        const row = rows.find((r) => r.k === "updated" || r.k === "updated_at" || r.k === "last_updated");
        return row?.v ?? null;
    }, [rows]);
    return { updated, loading };
}

/* ─────────────── Transmisi (pk_transmisi → ProgramItem[]) ─────────────── */

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

const pctStr = (real: number, target: number) =>
    target > 0 ? `${Math.round((real / target) * 100)}%` : "-%";

/**
 * SYNC: mirror adapter di /transmisi/program-kerja-transmisi/page.tsx —
 * snapshot row → header sheet asli → normalizeItem. Path identik = angka identik.
 * Kalau dashboard ganti adapter, update di sini juga.
 */
function mapPkTransmisiRow(r: PkTransmisiRow): Record<string, string> {
    return {
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
        "PRESENTASE ULTG BOGOR": pctStr(r.realisasi_bogor, r.target_bogor),
        "PRESENTASE ULTG SUKABUMI": pctStr(r.realisasi_sukabumi, r.target_sukabumi),
        "TOTAL TARGET": String(r.total_target ?? 0),
        "TOTAL REALISASI": String(r.total_realisasi ?? 0),
        "TOTAL PRESENTASE": pctStr(r.total_realisasi, r.total_target),
        "PELAKSANA": r.pelaksana ?? "",
        "LOKASI": r.lokasi ?? "",
        "PROGRAM KERJA": r.program_kerja ?? "",
    };
}

export function useDeckTransmisi(): { items: ProgramItem[]; loading: boolean; error: string | null } {
    const { rows, loading, error } = useSnapshot<PkTransmisiRow>("pk_transmisi");
    const items = useMemo(
        () => (rows || []).map((r) => normalizeItem(mapPkTransmisiRow(r))).filter((it) => it.namaProgram),
        [rows],
    );
    return { items, loading, error };
}

/* ─────────────── ULTG split (dari detail rows) ─────────────── */

export interface UltgSplit {
    bogor: { target: number; real: number };
    sukabumi: { target: number; real: number };
    /** Item detail yang belum punya ULTG (data belum di-assign) — transparan, bukan disembunyikan. */
    unassigned: number;
}

function splitByUltg(rows: { ultg: "BOGOR" | "SUKABUMI" | ""; isSelesai: boolean }[]): UltgSplit {
    const split: UltgSplit = {
        bogor: { target: 0, real: 0 },
        sukabumi: { target: 0, real: 0 },
        unassigned: 0,
    };
    for (const r of rows) {
        if (r.ultg === "BOGOR") {
            split.bogor.target += 1;
            if (r.isSelesai) split.bogor.real += 1;
        } else if (r.ultg === "SUKABUMI") {
            split.sukabumi.target += 1;
            if (r.isSelesai) split.sukabumi.real += 1;
        } else {
            split.unassigned += 1;
        }
    }
    return split;
}

/* ─────────────── Proteksi (summary + detail) ─────────────── */

export interface DeckBidangData<TGrpAgg> {
    totals: { total: number; selesai: number; belum: number; persen: number };
    grpAgg: TGrpAgg[];
    /** ProgramItem stub per program summary — siap untuk ProgramRechartsBar. */
    items: ProgramItem[];
    ultg: UltgSplit;
    loading: boolean;
    error: string | null;
}

/** Adapter summary → ProgramItem stub (mirror toProgramItem di ProteksiContent/GarduIndukContent). */
function summaryToProgramItem(program: string, grp: string, grpLabel: string, total: number, selesai: number, persen: number): ProgramItem {
    return {
        no: "",
        namaProgram: program,
        jenisProgram: "",
        kategoriKey: null,
        programKerja: grp as unknown as ProgramItem["programKerja"],
        risiko: "",
        kategori: "",
        posAnggaran: "",
        keterangan: "",
        pelaksana: "",
        lokasi: "",
        programKerjaText: grpLabel,
        targetBogor: 0,
        realisasiBogor: 0,
        targetSukabumi: 0,
        realisasiSukabumi: 0,
        totalTarget: total,
        totalRealisasi: selesai,
        presentase: persen,
        presentaseBogor: 0,
        presentaseSukabumi: 0,
    };
}

export function useDeckProteksi(): DeckBidangData<ProteksiGrpAgg> & { summary: ProteksiSummaryRow[]; detail: ProteksiDetailRow[] } {
    const summarySnap = useSnapshot<Record<string, unknown>>("pk_proteksi_summary");
    const detailSnap = useSnapshot<Record<string, unknown>>("pk_proteksi_detail");

    const summary = useMemo(
        () => summarySnap.rows.map(normalizeProteksiSummary).filter((r) => r.program && r.program !== "(tanpa nama)"),
        [summarySnap.rows],
    );
    const detail = useMemo(
        () => detailSnap.rows.map(normalizeProteksiDetail).filter((r) => r.program),
        [detailSnap.rows],
    );

    const totals = useMemo(() => totalsOfProteksi(summary), [summary]);
    const grpAgg = useMemo(() => aggregateProteksi(summary), [summary]);
    const items = useMemo(
        () => summary.filter((r) => r.total > 0).map((r) => summaryToProgramItem(r.program, r.grp, r.grpLabel, r.total, r.selesai, r.persen)),
        [summary],
    );
    const ultg = useMemo(() => splitByUltg(detail), [detail]);

    return {
        summary, detail, totals, grpAgg, items, ultg,
        loading: summarySnap.loading || detailSnap.loading,
        error: summarySnap.error || detailSnap.error,
    };
}

/* ─────────────── Gardu Induk (summary + detail) ─────────────── */

export function useDeckGarduInduk(): DeckBidangData<GiGrpAgg> & { summary: GarduIndukSummaryRow[]; detail: GarduIndukDetailRow[] } {
    const summarySnap = useSnapshot<Record<string, unknown>>("pk_gardu_induk_summary");
    const detailSnap = useSnapshot<Record<string, unknown>>("pk_gardu_induk_detail");

    const summary = useMemo(
        () => summarySnap.rows.map(normalizeGiSummary).filter((r) => r.program && r.program !== "(tanpa nama)"),
        [summarySnap.rows],
    );
    const detail = useMemo(
        () => detailSnap.rows.map(normalizeGiDetail).filter((r) => r.program),
        [detailSnap.rows],
    );

    const totals = useMemo(() => totalsOfGi(summary), [summary]);
    const grpAgg = useMemo(() => aggregateGi(summary), [summary]);
    const items = useMemo(
        () => summary.filter((r) => r.total > 0).map((r) => summaryToProgramItem(r.program, r.grp, r.grpLabel, r.total, r.selesai, r.persen)),
        [summary],
    );
    const ultg = useMemo(() => splitByUltg(detail), [detail]);

    return {
        summary, detail, totals, grpAgg, items, ultg,
        loading: summarySnap.loading || detailSnap.loading,
        error: summarySnap.error || detailSnap.error,
    };
}
