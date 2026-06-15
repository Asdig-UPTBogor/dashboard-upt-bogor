/**
 * Tipe + normalizer untuk Program Kerja Gardu Induk (HARGI) — sumber: snapshot Supabase.
 *
 * Snapshot keys:
 *  - pk_gardu_induk_summary → ringkasan per program (36 program, 3 grup: PS/IL2/ABO)
 *  - pk_gardu_induk_detail  → 1094 item detail per bay
 *
 * Data snapshot BELUM disanitize penuh → semua normalizer di sini harus robust
 * (handle null/undefined, string angka, casing grup, ULTG kosong, dll).
 *
 * Pola identik dengan proteksi-data.ts (Program Kerja Proteksi) supaya konsisten.
 */

export type GrpKey = "ps" | "il2" | "abo";

/** Label resmi per grup (UI Bahasa Indonesia). */
export const GRP_LABEL: Record<GrpKey, string> = {
    ps: "PS",
    il2: "IL2",
    abo: "ABO",
};

/** Nama panjang per grup — buat caption Hero panel. */
export const GRP_FULL: Record<GrpKey, string> = {
    ps: "Program Strategis",
    il2: "Inspeksi Level 2",
    abo: "Anti Blackout",
};

/** Urutan tampil grup — konsisten di seluruh halaman. */
export const GRP_ORDER: GrpKey[] = ["ps", "il2", "abo"];

/** Warna accent per grup (PS amber, IL2 biru, ABO ungu). */
export const GRP_ACCENT: Record<GrpKey, { accent: string; accent2: string }> = {
    ps: { accent: "#f3c14b", accent2: "#fcd34d" },   // kuning — Program Strategis
    il2: { accent: "#a78bfa", accent2: "#c4b5fd" },  // violet — Inspeksi Level 2 (semantic)
    abo: { accent: "#5b8def", accent2: "#4cc9c0" },  // biru — Anti Blackout
};

/** Map warna grup untuk ProgramRechartsBar (key = grp slug). */
export const GRP_COLOR_MAP: Record<string, string> = {
    ps: GRP_ACCENT.ps.accent,
    il2: GRP_ACCENT.il2.accent,
    abo: GRP_ACCENT.abo.accent,
};

/** Normalisasi label grup dari snapshot ('PS' | 'IL2' | 'ABO' | variasi) ke slug. */
export function resolveGrp(raw: string | null | undefined): GrpKey {
    const s = (raw || "").toString().trim().toLowerCase();
    if (s.includes("il2") || s.includes("il 2") || s.includes("inspeksi")) return "il2";
    if (s.includes("abo") || s.includes("blackout") || s.includes("anti black")) return "abo";
    if (s === "ps" || s.includes("strategis") || s.includes("program strategis")) return "ps";
    // fallback aman — masuk ke PS biar tetap ke-render, bukan hilang
    return "ps";
}

/** Parse angka dari string/number snapshot ("12", "0", null, "—", "5%") → number. Default 0. */
export function parseNum(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    const s = String(val).replace(/[%,]/g, "").trim();
    if (!s || s === "-" || s === "—") return 0;
    const n = parseFloat(s);
    return Number.isNaN(n) ? 0 : n;
}

/** Parse boolean robust (true | "true" | "t" | "1" | "selesai" | "ya"). */
export function parseBool(val: unknown): boolean {
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val === 1;
    const s = String(val ?? "").trim().toLowerCase();
    return s === "true" || s === "t" || s === "1" || s === "ya" || s === "selesai" || s === "y";
}

/** Normalisasi ULTG → "BOGOR" | "SUKABUMI" | "" (kosong = belum di-assign). */
export function resolveUltg(raw: string | null | undefined): "BOGOR" | "SUKABUMI" | "" {
    const s = (raw || "").toString().trim().toUpperCase();
    if (s.includes("BOGOR")) return "BOGOR";
    if (s.includes("SUKABUMI")) return "SUKABUMI";
    return "";
}

/* ─────────────── Summary (per program) ─────────────── */

export interface GarduIndukSummaryRow {
    grp: GrpKey;
    grpLabel: string;
    program: string;
    total: number;
    selesai: number;
    belum: number;
    persen: number;
}

/** Raw snapshot row → GarduIndukSummaryRow (robust ke field hilang). */
export function normalizeSummary(r: Record<string, unknown>): GarduIndukSummaryRow {
    const grp = resolveGrp(r["grp"] as string);
    const total = parseNum(r["total"]);
    const selesai = parseNum(r["selesai"]);
    // belum dari snapshot bisa salah/absen → recompute dari total-selesai biar konsisten
    const belumSnap = parseNum(r["belum"]);
    const belum = belumSnap > 0 ? belumSnap : Math.max(total - selesai, 0);
    const persenSnap = parseNum(r["persen"]);
    const persen = persenSnap > 0 ? persenSnap : total > 0 ? Math.round((selesai / total) * 100) : 0;
    return {
        grp,
        grpLabel: GRP_LABEL[grp],
        program: String(r["program"] ?? "").trim() || "(tanpa nama)",
        total,
        selesai,
        belum,
        persen,
    };
}

/* ─────────────── Detail (per item/bay) ─────────────── */

export interface GarduIndukDetailRow {
    grp: GrpKey;
    grpLabel: string;
    program: string;
    garduInduk: string;
    bay: string;
    ultg: "BOGOR" | "SUKABUMI" | "";
    realisasiDate: string;
    keterangan: string;
    isSelesai: boolean;
}

/** Raw snapshot row → GarduIndukDetailRow (robust). */
export function normalizeDetail(r: Record<string, unknown>): GarduIndukDetailRow {
    const grp = resolveGrp(r["grp"] as string);
    return {
        grp,
        grpLabel: GRP_LABEL[grp],
        program: String(r["program"] ?? "").trim(),
        garduInduk: String(r["gardu_induk"] ?? "").trim(),
        bay: String(r["bay"] ?? "").trim(),
        ultg: resolveUltg(r["ultg"] as string),
        realisasiDate: String(r["tgl_realisasi"] ?? "").trim(),
        keterangan: String(r["keterangan"] ?? "").trim(),
        isSelesai: parseBool(r["is_selesai"]),
    };
}

/* ─────────────── Aggregate helpers ─────────────── */

export interface GrpAgg {
    key: GrpKey;
    name: string;
    total: number;
    selesai: number;
    accent: string;
    accent2: string;
}

/** Agregasi per grup dari summary rows. */
export function aggregateByGrp(rows: GarduIndukSummaryRow[]): GrpAgg[] {
    const map = new Map<GrpKey, { total: number; selesai: number }>();
    for (const g of GRP_ORDER) map.set(g, { total: 0, selesai: 0 });
    rows.forEach((r) => {
        const e = map.get(r.grp)!;
        e.total += r.total;
        e.selesai += r.selesai;
    });
    return GRP_ORDER.map((key) => {
        const e = map.get(key)!;
        return {
            key,
            name: GRP_LABEL[key],
            total: e.total,
            selesai: e.selesai,
            accent: GRP_ACCENT[key].accent,
            accent2: GRP_ACCENT[key].accent2,
        };
    });
}

/** Total keseluruhan dari summary rows. */
export function totalsOf(rows: GarduIndukSummaryRow[]): {
    total: number;
    selesai: number;
    belum: number;
    persen: number;
} {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const selesai = rows.reduce((s, r) => s + r.selesai, 0);
    const belum = Math.max(total - selesai, 0);
    const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;
    return { total, selesai, belum, persen };
}
