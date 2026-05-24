/**
 * Hardcoded data Program Kerja Proteksi UPT Bogor 2026.
 *
 * Source: 1jCjt-UHh6tR3qzcmX60SbMkd47WWeu2IeZbwUPcUmX0 — tab "Progress" (gid=550336663)
 * Spreadsheet: "Program LM, ABO & Peningkatan Keandalan Proteksi 2026 - UPT Bogor (Auto)"
 *
 * Fetched: 2026-05-07. Hardcoded sementara — nanti migrasi ke Supabase Postgres.
 */

export type ProteksiKategori = "lm" | "abo" | "pk";

export interface ProteksiItem {
    no: string;
    namaProgram: string;
    kategori: ProteksiKategori;
    targetBogor: number;
    realBogor: number;
    ntBogor: number;
    persenBogor: number;
    targetSukabumi: number;
    realSukabumi: number;
    ntSukabumi: number;
    persenSukabumi: number;
    totalTarget: number;
    totalReal: number;
    totalNt: number;
    totalPersen: number;
    isPicUpt?: boolean; // PIC UPT (no per-ULTG split)
}

function p(s: string): number {
    if (!s || s === "—") return 0;
    const n = parseFloat(s.replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}
function n(s: string): number {
    if (!s || s.includes("—") || s.includes("PIC")) return 0;
    const v = parseInt(s.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(v) ? v : 0;
}

/* ─── LM/4DX (3 program) ─── */
export const LM_ITEMS: ProteksiItem[] = [
    { no: "1", namaProgram: "Check Kesiapan DFR, TWS dan Remote Reading Relay", kategori: "lm",
        targetBogor: 0, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 0, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 4, totalReal: 4, totalNt: 0, totalPersen: 100, isPicUpt: true },
    { no: "2", namaProgram: "Evaluasi IL1, IL2, IL3 Sistem Proteksi", kategori: "lm",
        targetBogor: 0, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 0, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 4, totalReal: 4, totalNt: 0, totalPersen: 100, isPicUpt: true },
    { no: "3", namaProgram: "Implementasi Checklist Pemeliharaan dan Pekerjaan Proteksi Bay Trafo & Penghantar", kategori: "lm",
        targetBogor: 72, realBogor: 15, ntBogor: 5, persenBogor: 27.78,
        targetSukabumi: 42, realSukabumi: 4, ntSukabumi: 1, persenSukabumi: 11.90,
        totalTarget: 114, totalReal: 19, totalNt: 6, totalPersen: 21.93 },
];

/* ─── ANTI BLACKOUT (6 program) ─── */
export const ABO_ITEMS: ProteksiItem[] = [
    { no: "1", namaProgram: "Aktivasi Buspro / GOOSEPRO", kategori: "abo",
        targetBogor: 0, realBogor: 0, ntBogor: 1, persenBogor: 100,
        targetSukabumi: 2, realSukabumi: 1, ntSukabumi: 0, persenSukabumi: 50,
        totalTarget: 2, totalReal: 1, totalNt: 1, totalPersen: 100 },
    { no: "2", namaProgram: "Implementasi Standarisasi Setting dan Logic", kategori: "abo",
        targetBogor: 22, realBogor: 2, ntBogor: 4, persenBogor: 27.27,
        targetSukabumi: 12, realSukabumi: 5, ntSukabumi: 0, persenSukabumi: 41.67,
        totalTarget: 34, totalReal: 7, totalNt: 4, totalPersen: 32.35 },
    { no: "3", namaProgram: "Rekomisioning Sistem Proteksi Penghantar dan Trafo", kategori: "abo",
        targetBogor: 51, realBogor: 12, ntBogor: 4, persenBogor: 31.37,
        targetSukabumi: 19, realSukabumi: 4, ntSukabumi: 0, persenSukabumi: 21.05,
        totalTarget: 70, totalReal: 16, totalNt: 4, totalPersen: 28.57 },
    { no: "4a", namaProgram: "Penambahan Sistem DC Redundant pada Jalur Utama Pemulihan", kategori: "abo",
        targetBogor: 1, realBogor: 1, ntBogor: 0, persenBogor: 100,
        targetSukabumi: 0, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 1, totalReal: 1, totalNt: 0, totalPersen: 100 },
    { no: "4b", namaProgram: "Kesiapan Genset pada Jalur Utama Pemulihan", kategori: "abo",
        targetBogor: 1, realBogor: 1, ntBogor: 0, persenBogor: 100,
        targetSukabumi: 0, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 1, totalReal: 1, totalNt: 0, totalPersen: 100 },
    { no: "5", namaProgram: "Program Trainee for Trainer: KS Upskilling Regu HAR", kategori: "abo",
        targetBogor: 2, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 2, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 4, totalReal: 0, totalNt: 0, totalPersen: 0 },
    { no: "6", namaProgram: "Penyempurnaan Desain Tripping 1 dan Tripping 2", kategori: "abo",
        targetBogor: 6, realBogor: 2, ntBogor: 5, persenBogor: 116.67,
        targetSukabumi: 0, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 6, totalReal: 2, totalNt: 5, totalPersen: 116.67 },
];

/* ─── PENINGKATAN KEANDALAN (11 program) ─── */
export const PK_ITEMS: ProteksiItem[] = [
    { no: "1", namaProgram: "Penggantian Relay Obsolete dan Update Data Aset Relay", kategori: "pk",
        targetBogor: 3, realBogor: 3, ntBogor: 0, persenBogor: 100,
        targetSukabumi: 1, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 4, totalReal: 3, totalNt: 0, totalPersen: 75 },
    { no: "2", namaProgram: "Pemasangan dan Integrasi DC Monitoring Online", kategori: "pk",
        targetBogor: 11, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 8, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 19, totalReal: 0, totalNt: 0, totalPersen: 0 },
    { no: "3", namaProgram: "Check Point Implementasi Setting & Logic Pasca Pengganitian Relay", kategori: "pk",
        targetBogor: 0, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 1, realSukabumi: 1, ntSukabumi: 0, persenSukabumi: 100,
        totalTarget: 1, totalReal: 1, totalNt: 0, totalPersen: 100 },
    { no: "4", namaProgram: "Aktivasi Aided DEF", kategori: "pk",
        targetBogor: 4, realBogor: 4, ntBogor: 0, persenBogor: 100,
        targetSukabumi: 4, realSukabumi: 0, ntSukabumi: 2, persenSukabumi: 50,
        totalTarget: 8, totalReal: 4, totalNt: 2, totalPersen: 75 },
    { no: "5", namaProgram: "Migrasi Desain REF High Impedance Menjadi Low Impedance", kategori: "pk",
        targetBogor: 2, realBogor: 2, ntBogor: 0, persenBogor: 100,
        targetSukabumi: 0, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 2, totalReal: 2, totalNt: 0, totalPersen: 100 },
    { no: "6", namaProgram: "Non Cascade Trafo Kondisi Assessment Poor to Critical", kategori: "pk",
        targetBogor: 2, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 2, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 4, totalReal: 0, totalNt: 0, totalPersen: 0 },
    { no: "7", namaProgram: "Pemasangan dan Integrasi E-WARS untuk Monitoring Relay", kategori: "pk",
        targetBogor: 1, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 1, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 2, totalReal: 0, totalNt: 0, totalPersen: 0 },
    { no: "8", namaProgram: "Penanganan DC Ground Fault", kategori: "pk",
        targetBogor: 0, realBogor: 0, ntBogor: 0, persenBogor: 0,
        targetSukabumi: 1, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 1, totalReal: 0, totalNt: 0, totalPersen: 0 },
    { no: "9", namaProgram: "Reposisi CTN LV (REF LV dan SBEF) Sesuai SPLN T3.0", kategori: "pk",
        targetBogor: 3, realBogor: 1, ntBogor: 0, persenBogor: 33.33,
        targetSukabumi: 0, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 3, totalReal: 1, totalNt: 0, totalPersen: 33.33 },
    { no: "10", namaProgram: "Scanning & Modifikasi Rangkaian SF6 Alarm dan Trip", kategori: "pk",
        targetBogor: 10, realBogor: 10, ntBogor: 0, persenBogor: 100,
        targetSukabumi: 28, realSukabumi: 13, ntSukabumi: 0, persenSukabumi: 46.43,
        totalTarget: 38, totalReal: 23, totalNt: 0, totalPersen: 60.53 },
    { no: "11", namaProgram: "Implementasi Remote Reading Relay Proteksi", kategori: "pk",
        targetBogor: 23, realBogor: 19, ntBogor: 0, persenBogor: 82.61,
        targetSukabumi: 10, realSukabumi: 0, ntSukabumi: 0, persenSukabumi: 0,
        totalTarget: 33, totalReal: 19, totalNt: 0, totalPersen: 57.58 },
];

export const PROTEKSI_ALL_ITEMS: ProteksiItem[] = [...LM_ITEMS, ...ABO_ITEMS, ...PK_ITEMS];

/* COLOR PATTERN — sync dengan Report Card Proteksi existing (locked):
 * - ABO biru (sama dengan Transmisi & GI)
 * - LM/4DX kuning (PS-equivalent)
 * - Peningkatan Keandalan EMERALD (sesuai Report Card legacy #34d399) */
export const PROTEKSI_KATEGORI_ACCENT: Record<ProteksiKategori, string> = {
    abo: "#5b8def",  // BIRU
    lm: "#f3c14b",   // KUNING
    pk: "#34d399",   // EMERALD (dari Report Card Proteksi existing)
};

export const PROTEKSI_KATEGORI_LABEL: Record<ProteksiKategori, string> = {
    abo: "Anti Blackout",
    lm: "LM / 4DX",
    pk: "Peningkatan Keandalan",
};

export const PROTEKSI_KATEGORI_SHORT: Record<ProteksiKategori, string> = {
    abo: "ABO",
    lm: "LM",
    pk: "PK",
};

// suppress unused
void p;
void n;
