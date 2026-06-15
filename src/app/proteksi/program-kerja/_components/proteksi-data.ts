/**
 * Tipe + normalizer untuk Program Kerja Proteksi (sumber: snapshot Supabase).
 *
 * Snapshot keys:
 *  - pk_proteksi_summary → ringkasan per program (21 program, 3 grup)
 *  - pk_proteksi_detail  → 500 item detail per bay
 *
 * Data snapshot BELUM disanitize → semua normalizer di sini harus robust
 * (handle null/undefined, string angka, casing grup, dll).
 */

export type GrpKey = "4dx" | "abo" | "keandalan";

/** Label resmi per grup (UI Bahasa Indonesia). */
export const GRP_LABEL: Record<GrpKey, string> = {
    "4dx": "4DX",
    "abo": "ABO",
    "keandalan": "Keandalan",
};

/** Urutan tampil grup — konsisten di seluruh halaman. */
export const GRP_ORDER: GrpKey[] = ["4dx", "abo", "keandalan"];

/** Warna accent per grup (pakai token + hex aman buat chart canvas). */
export const GRP_ACCENT: Record<GrpKey, { accent: string; accent2: string }> = {
    "4dx": { accent: "#5b8def", accent2: "#4cc9c0" },
    "abo": { accent: "#f3c14b", accent2: "#fcd34d" },
    "keandalan": { accent: "#a78bfa", accent2: "#c4b5fd" },
};

/** Map warna grup untuk ProgramRechartsBar (key = grp slug). */
export const GRP_COLOR_MAP: Record<string, string> = {
    "4dx": GRP_ACCENT["4dx"].accent,
    "abo": GRP_ACCENT["abo"].accent,
    "keandalan": GRP_ACCENT["keandalan"].accent,
};

/** Normalisasi label grup dari snapshot ('4DX' | 'ABO' | 'Keandalan' | variasi) ke slug. */
export function resolveGrp(raw: string | null | undefined): GrpKey {
    const s = (raw || "").toString().trim().toLowerCase();
    if (s.includes("4dx") || s === "4 dx") return "4dx";
    if (s.includes("abo") || s.includes("blackout") || s.includes("anti black")) return "abo";
    if (s.includes("keandalan") || s.includes("andal")) return "keandalan";
    // fallback aman — masuk ke 4DX biar tetap ke-render, bukan hilang
    return "4dx";
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

export interface ProteksiSummaryRow {
    grp: GrpKey;
    grpLabel: string;
    program: string;
    total: number;
    selesai: number;
    belum: number;
    persen: number;
    mode: "per-bay" | "mingguan";
}

/** Raw snapshot row → ProteksiSummaryRow (robust ke field hilang). */
export function normalizeSummary(r: Record<string, unknown>): ProteksiSummaryRow {
    const grp = resolveGrp(r["grp"] as string);
    const total = parseNum(r["total"]);
    const selesai = parseNum(r["selesai"]);
    // belum dari snapshot bisa salah/absen → recompute dari total-selesai biar konsisten
    const belumSnap = parseNum(r["belum"]);
    const belum = belumSnap > 0 ? belumSnap : Math.max(total - selesai, 0);
    const persenSnap = parseNum(r["persen"]);
    const persen = persenSnap > 0 ? persenSnap : total > 0 ? Math.round((selesai / total) * 100) : 0;
    const modeRaw = String(r["mode"] ?? "").trim().toLowerCase();
    const mode: "per-bay" | "mingguan" = modeRaw === "mingguan" ? "mingguan" : "per-bay";
    return {
        grp,
        grpLabel: GRP_LABEL[grp],
        program: String(r["program"] ?? "").trim() || "(tanpa nama)",
        total,
        selesai,
        belum,
        persen,
        mode,
    };
}

/* ─────────────── Detail (per item/bay) ─────────────── */

export interface ProteksiDetailRow {
    grp: GrpKey;
    grpLabel: string;
    program: string;
    garduInduk: string;
    bay: string;
    ultg: "BOGOR" | "SUKABUMI" | "";
    targetDate: string;
    realisasiDate: string;
    beritaAcara: string;
    keterangan: string;
    isSelesai: boolean;
}

/** Raw snapshot row → ProteksiDetailRow (robust). */
export function normalizeDetail(r: Record<string, unknown>): ProteksiDetailRow {
    const grp = resolveGrp(r["grp"] as string);
    return {
        grp,
        grpLabel: GRP_LABEL[grp],
        program: String(r["program"] ?? "").trim(),
        garduInduk: String(r["gardu_induk"] ?? "").trim(),
        bay: String(r["bay"] ?? "").trim(),
        ultg: resolveUltg(r["ultg"] as string),
        targetDate: String(r["target_date"] ?? "").trim(),
        realisasiDate: String(r["realisasi_date"] ?? "").trim(),
        beritaAcara: String(r["berita_acara"] ?? "").trim(),
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
export function aggregateByGrp(rows: ProteksiSummaryRow[]): GrpAgg[] {
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
export function totalsOf(rows: ProteksiSummaryRow[]): { total: number; selesai: number; belum: number; persen: number } {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const selesai = rows.reduce((s, r) => s + r.selesai, 0);
    const belum = Math.max(total - selesai, 0);
    const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;
    return { total, selesai, belum, persen };
}
