/**
 * Shared types untuk halaman Common Enemy (CE) — sumber data SNAPSHOT.
 * Lihat /api/snapshot keys: ce_summary, ce_detail, meta.
 */

/** 3 bidang Common Enemy. */
export type Bidang = "transmisi" | "gardu_induk" | "proteksi";

/** Konfigurasi tab per bidang. */
export interface BidangConfig {
    bidang: Bidang;
    label: string;
    nickname: string;
    accent: string;
    accent2: string;
}

/** Baris ce_summary — per program per bidang. */
export interface CeSummaryRow {
    bidang: Bidang;
    program: string;
    target: number;
    realisasi: number;
    sisa: number;
    persen: number;
}

/** Baris ce_detail — per anomali Common Enemy. */
export interface CeDetailRow {
    bidang: Bidang;
    no: number | string;
    program: string;
    ultg: string;
    gardu_induk: string;
    bay: string;
    peralatan: string;
    deskripsi: string;
    kondisi_awal: string;
    kondisi_terkini: string;
    tgl_rencana: string;
    tgl_realisasi: string;
    status: "CLOSE" | "OPEN" | string;
    is_close: boolean;
    is_target: boolean;
    is_anomali: boolean;
    keterangan: string;
}

/** Baris meta — key/value. */
export interface MetaRow {
    k: string;
    v: string;
}

/** Konfigurasi 3 bidang — accent konsisten dengan token domain. */
export const BIDANG_CONFIG: BidangConfig[] = [
    {
        bidang: "transmisi",
        label: "Transmisi",
        nickname: "HARJAR",
        accent: "#5b8def",
        accent2: "#4cc9c0",
    },
    {
        bidang: "gardu_induk",
        label: "Gardu Induk",
        nickname: "HARGI",
        accent: "#3ecf8e",
        accent2: "#8dd884",
    },
    {
        bidang: "proteksi",
        label: "Proteksi",
        nickname: "HARPRO",
        accent: "#f3c14b",
        accent2: "#fcd34d",
    },
];

/** Helper: jumlah angka aman dari string/null. */
export function num(v: unknown): number {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? n : 0;
}

/** Helper: trim string aman. */
export function str(v: unknown): string {
    return String(v ?? "").trim();
}

/** Warna SEMANTIK by value — STANDAR LOCKED (memory infografis-standard):
 *  >=85% hijau · 60–84% amber · <60% merah. Identitas (ULTG/bidang) beda axis. */
export function pctColor(pct: number): string {
    if (pct >= 85) return "var(--cond-very-good)";
    if (pct >= 60) return "var(--cond-fair)";
    return "var(--cond-critical)";
}

/** Match nama program rincian vs program aktif (filter).
 *  Transmisi: nama resmi GRAFIK ("TAPAK TOWER") ≠ Uraian rincian
 *  ("Kondisi Tanah Tapak Tower") → match via normalisasi + alias. */
export function programMatch(detailProgram: string, active: string): boolean {
    const n = (x: string) => x.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const d = n(detailProgram), a = n(active);
    if (!a) return true;
    if (d === a || d.includes(a) || a.includes(d)) return true;
    if (a.includes("TAPAK")) return d.includes("TAPAK");
    if (a.includes("BINATANG")) return d.includes("BINATANG");
    if (a.startsWith("AHI")) return d.includes("AHI") || d.includes("HEALTH INDEX");
    return false;
}

/** Persen efektif dengan non-target ("sunnah" = bonus/multiplier):
 *  Angka utama = REAL (close target / target). Bonus NT masuk ke angka utama
 *  HANYA setelah target tuntas → "118,8% (+18,8%)". Belum tuntas → angka real
 *  apa adanya, NT cukup anotasi kurung → "88,5% (+11,5%)". */
export function pctEff(value: number, target: number, ntValue: number): number {
    if (target <= 0) return 0;
    const eff = value >= target ? value + ntValue : value;
    return (eff / target) * 100;
}
