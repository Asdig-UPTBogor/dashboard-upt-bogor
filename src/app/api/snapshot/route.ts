/**
 * GET /api/snapshot?q=<key>&bidang=<x>&program=<y>
 *
 * Baca data snapshot dari schema dashboard_snapshot (Supabase Postgres).
 * Whitelist query — `q` dipetakan ke SQL tetap (no injection). Param difilter via $1.
 *
 * Keys: meta | ce_summary | ce_detail | pk_transmisi | pk_proteksi_summary | pk_proteksi_detail
 */
import { NextRequest, NextResponse } from "next/server";
import { snapshotQuery } from "@/lib/snapshot-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const S = "dashboard_snapshot";

type Spec = { sql: (filtered: boolean) => string; filterParam?: "bidang" | "program" };

const QUERIES: Record<string, Spec> = {
    meta: { sql: () => `SELECT k, v FROM ${S}.meta` },
    ce_summary: {
        sql: () => `SELECT bidang, program, target, realisasi, sisa, persen
                    FROM ${S}.ce_summary ORDER BY bidang, realisasi DESC, program`,
    },
    ce_detail: {
        filterParam: "bidang",
        sql: (f) => `SELECT bidang, no, program, ultg, gardu_induk, bay, peralatan, deskripsi,
                     kondisi_awal, kondisi_terkini, tgl_rencana, tgl_realisasi, status,
                     is_close, is_target, is_anomali, keterangan
                     FROM ${S}.ce_detail ${f ? "WHERE bidang = $1" : ""} ORDER BY id`,
    },
    pk_transmisi: {
        sql: () => `SELECT no, jenis_program, nama_program, risiko, kategori, pos_anggaran, keterangan,
                    target_bogor, realisasi_bogor, target_sukabumi, realisasi_sukabumi,
                    total_target, total_realisasi, pelaksana, lokasi, program_kerja
                    FROM ${S}.pk_transmisi ORDER BY id`,
    },
    pk_proteksi_summary: {
        sql: () => `SELECT grp, program, total, selesai, belum, persen, mode
                    FROM ${S}.pk_proteksi_summary ORDER BY grp, program`,
    },
    pk_proteksi_detail: {
        filterParam: "program",
        sql: (f) => `SELECT grp, program, gardu_induk, bay, ultg, target_date, realisasi_date,
                     berita_acara, keterangan, is_selesai
                     FROM ${S}.pk_proteksi_detail ${f ? "WHERE program = $1" : ""} ORDER BY id`,
    },
    pk_gardu_induk_summary: {
        sql: () => `SELECT grp, program, total, selesai, belum, persen
                    FROM ${S}.pk_gardu_induk_summary ORDER BY grp, program`,
    },
    pk_gardu_induk_detail: {
        filterParam: "program",
        sql: (f) => `SELECT grp, program, gardu_induk, bay, ultg, tgl_realisasi, status,
                     is_selesai, keterangan
                     FROM ${S}.pk_gardu_induk_detail ${f ? "WHERE program = $1" : ""} ORDER BY id`,
    },
};

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get("q") || "";
    const spec = QUERIES[q];
    if (!spec) {
        return NextResponse.json(
            { ok: false, error: `unknown query '${q}'`, available: Object.keys(QUERIES) },
            { status: 400 }
        );
    }
    try {
        const params: unknown[] = [];
        let filtered = false;
        if (spec.filterParam) {
            const v = req.nextUrl.searchParams.get(spec.filterParam);
            if (v) { params.push(v); filtered = true; }
        }
        const rows = await snapshotQuery(spec.sql(filtered), params);
        return NextResponse.json({ ok: true, q, rows, fetchedAt: new Date().toISOString() });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "query error";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
