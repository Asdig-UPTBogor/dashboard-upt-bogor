/**
 * CE deck — types + agregasi data snapshot (zero hardcode angka).
 *
 * Sumber: useSnapshot("ce_summary") + useSnapshot("ce_detail", { bidang }) + useSnapshot("meta").
 * Konvensi angka SAMA dengan /ce-next-level (CeBidangContent):
 *   - Angka RESMI program & bidang = ce_summary (transmisi = rekap GRAFIK auto-parse).
 *   - Breakdown ULTG = ce_detail basis TARGET-ONLY (is_target), cara ultgBarRows.
 *   - Non-target = ce_detail is_target=false → anotasi jujur (khusus proteksi).
 * Snapshot belum sanitize → semua akses field WAJIB defensive (num/str/isClose).
 */

import { pctColor, programMatch } from "@/app/ce-next-level/_components/ce-types";
import { ultgColor } from "@/app/ce-next-level/_components/v2/CeUltgBars";

export { pctColor, programMatch, ultgColor };

/* ─────────── Bidang ─────────── */

export type CeBidang = "transmisi" | "gardu_induk" | "proteksi";

/** Label + bidang fungsi + accent identitas — align BIDANG_CONFIG /ce-next-level. */
export const CE_BIDANG_META: Record<CeBidang, { label: string; fungsi: string; accent: string }> = {
    transmisi: { label: "Transmisi", fungsi: "HARJAR", accent: "#5b8def" },
    gardu_induk: { label: "Gardu Induk", fungsi: "HARGI", accent: "#3ecf8e" },
    proteksi: { label: "Proteksi", fungsi: "HARPRO", accent: "#f3c14b" },
};

export const CE_ORDER: CeBidang[] = ["transmisi", "gardu_induk", "proteksi"];

/* Status CE — LOCKED: Close = cond-very-good, Open = cond-poor. */
export const CE_CLOSE = "var(--cond-very-good)";
export const CE_OPEN = "var(--cond-poor)";

/* ─────────── Row shapes (snapshot, defensive) ─────────── */

export interface CeSummaryRow {
    bidang?: string;
    program?: string;
    target?: number | string | null;
    realisasi?: number | string | null;
    sisa?: number | string | null;
    persen?: number | string | null;
}

export interface CeDetailRow {
    bidang?: string;
    program?: string;
    ultg?: string | null;
    status?: string | null;
    is_close?: boolean | null;
    is_target?: boolean | null;
}

export interface MetaRow {
    k?: string;
    v?: string;
}

/* ─────────── Coercion helpers ─────────── */

export function num(v: unknown): number {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
        const n = parseFloat(v.replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

export function str(v: unknown): string {
    if (v == null) return "";
    return String(v).trim();
}

export function fmtNum(n: number): string {
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

/** Persen format id-ID (koma desimal) — "65,5". */
export function fmtPct(p: number, digits = 1): string {
    if (!Number.isFinite(p)) p = 0;
    return p.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(part: number, whole: number): number {
    if (!whole || whole === 0) return 0;
    return (part / whole) * 100;
}

/** Normalisasi bidang ke key kanonik — toleran spasi/case/varian. */
export function normBidang(v: unknown): CeBidang | null {
    const s = str(v).toLowerCase().replace(/\s+/g, "_");
    if (s.startsWith("transmisi") || s === "harjar") return "transmisi";
    if (s.startsWith("gardu") || s === "gi" || s === "hargi") return "gardu_induk";
    if (s.startsWith("proteksi") || s === "harpro") return "proteksi";
    return null;
}

/** Normalisasi status → close (robust, mirror CeBidangContent.isClose). */
export function isClose(r: CeDetailRow): boolean {
    if (r.is_close) return true;
    const s = str(r.status).toUpperCase();
    return s === "CLOSE" || s === "CLOSED" || s === "SELESAI";
}

/* ─────────── Aggregates ─────────── */

export interface ProgramAgg {
    program: string;
    target: number;
    realisasi: number;
    persen: number;
    /** Non-target ("sunnah") yang match program ini — anotasi (+n), gak masuk target. */
    ntTotal: number;
    ntClose: number;
}

export interface UltgAgg {
    /** Key ULTG persis dari ce_detail (uppercase), mis. "BOGOR". */
    key: string;
    /** Label tampil, mis. "ULTG Bogor". */
    name: string;
    /** Token warna identitas ULTG. */
    accent: string;
    /** Total item target (basis ultgBarRows). */
    total: number;
    /** Item target close. */
    close: number;
    /** Non-target ("sunnah") ULTG ini. */
    ntTotal: number;
    ntClose: number;
    /** Proyeksi per Sub CE (basis rincian ULTG ini, align nama resmi via programMatch).
     *  Urutan SAMA dengan deck.programs — bahan filter interaktif slide. */
    programs: ProgramAgg[];
}

export interface BidangDeck {
    bidang: CeBidang;
    /** Total anomali target — angka RESMI ce_summary. */
    total: number;
    /** Close — angka RESMI ce_summary (realisasi). */
    close: number;
    open: number;
    persen: number;
    /** Per Sub CE — angka resmi, sort persen desc lalu target desc (cara CeProgramBars). */
    programs: ProgramAgg[];
    /** Split per ULTG dari rincian (target-only). */
    ultg: UltgAgg[];
    /** Item target tanpa ULTG — gak masuk bar (footnote kejujuran). */
    noUltgTarget: number;
    /** Total/close rincian target — buat footnote sinkronisasi vs angka resmi. */
    detailTargetTotal: number;
    detailTargetClose: number;
    /** Non-target CE (is_target=false) — anotasi kecil. */
    ntClose: number;
    ntOpen: number;
}

/** Bangun agregat 1 bidang dari ce_summary (resmi) + ce_detail (ULTG/non-target). */
export function buildBidangDeck(
    bidang: CeBidang,
    summaryRows: CeSummaryRow[],
    detailRows: CeDetailRow[],
): BidangDeck {
    const programs: ProgramAgg[] = summaryRows
        .filter((r) => normBidang(r.bidang) === bidang)
        .map((r) => {
            const target = num(r.target);
            const realisasi = num(r.realisasi);
            return {
                program: str(r.program) || "(tanpa nama)",
                target,
                realisasi,
                persen: r.persen != null ? num(r.persen) : pct(realisasi, target),
                ntTotal: 0,
                ntClose: 0,
            };
        })
        .sort((a, b) => b.persen - a.persen || b.target - a.target);

    const total = programs.reduce((s, p) => s + p.target, 0);
    const close = programs.reduce((s, p) => s + p.realisasi, 0);

    /* Rincian: per-ULTG (target + non-target + proyeksi per program) — cara CeBidangContent.
       Mapping nama rincian → nama resmi via programMatch (alias TAPAK/BINATANG/AHI). */
    interface ProgCnt { target: number; close: number; ntTotal: number; ntClose: number }
    interface UltgCnt { total: number; close: number; ntTotal: number; ntClose: number; perProg: Map<string, ProgCnt> }
    const map = new Map<string, UltgCnt>();
    const progCnt = (m: Map<string, ProgCnt>, k: string): ProgCnt => {
        const e = m.get(k) ?? { target: 0, close: 0, ntTotal: 0, ntClose: 0 };
        m.set(k, e);
        return e;
    };
    let noUltgTarget = 0;
    let detailTargetTotal = 0;
    let detailTargetClose = 0;
    let ntClose = 0;
    let ntOpen = 0;

    for (const r of detailRows) {
        const closed = isClose(r);
        const u = str(r.ultg).toUpperCase();
        const official = programs.find((p) => programMatch(str(r.program), p.program));
        let ue: UltgCnt | null = null;
        if (u) {
            ue = map.get(u) ?? { total: 0, close: 0, ntTotal: 0, ntClose: 0, perProg: new Map() };
            map.set(u, ue);
        }

        if (!r.is_target) {
            if (closed) ntClose++;
            else ntOpen++;
            if (official) {
                official.ntTotal++;
                if (closed) official.ntClose++;
            }
            if (ue) {
                ue.ntTotal++;
                if (closed) ue.ntClose++;
                if (official) {
                    const pe = progCnt(ue.perProg, official.program);
                    pe.ntTotal++;
                    if (closed) pe.ntClose++;
                }
            }
            continue;
        }

        detailTargetTotal++;
        if (closed) detailTargetClose++;
        if (!ue) {
            noUltgTarget++;
            continue;
        }
        ue.total += 1;
        if (closed) ue.close += 1;
        if (official) {
            const pe = progCnt(ue.perProg, official.program);
            pe.target++;
            if (closed) pe.close++;
        }
    }

    const ultg: UltgAgg[] = [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, e]) => ({
            key: name,
            name: `ULTG ${name.charAt(0)}${name.slice(1).toLowerCase()}`,
            accent: ultgColor(name, CE_BIDANG_META[bidang].accent),
            total: e.total,
            close: e.close,
            ntTotal: e.ntTotal,
            ntClose: e.ntClose,
            /* Urutan align deck.programs — bar gak loncat saat toggle filter. */
            programs: programs.map((p) => {
                const pe = e.perProg.get(p.program);
                return {
                    program: p.program,
                    target: pe?.target ?? 0,
                    realisasi: pe?.close ?? 0,
                    persen: pct(pe?.close ?? 0, pe?.target ?? 0),
                    ntTotal: pe?.ntTotal ?? 0,
                    ntClose: pe?.ntClose ?? 0,
                };
            }),
        }));

    return {
        bidang,
        total,
        close,
        open: Math.max(total - close, 0),
        persen: pct(close, total),
        programs,
        ultg,
        noUltgTarget,
        detailTargetTotal,
        detailTargetClose,
        ntClose,
        ntOpen,
    };
}

/* ─────────── Meta helpers ─────────── */

export function getMetaNum(rows: MetaRow[], key: string): number {
    return num(rows.find((m) => str(m.k) === key)?.v);
}

/** Tanggal update snapshot dari meta rows ({k,v}). */
export function getUpdatedDate(metaRows: MetaRow[]): string {
    if (!metaRows || metaRows.length === 0) return "";
    const hit = metaRows.find((m) => {
        const k = str(m.k).toLowerCase();
        return k.includes("update") || k.includes("tanggal") || k === "updated";
    });
    return str(hit?.v);
}
