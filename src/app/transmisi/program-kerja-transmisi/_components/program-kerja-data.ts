/**
 * Mapping LM (Program Strategis) vs ABO (Anti Blackout)
 * Source: Report Card Proteksi/data-transmisi.js (manual classification dari user)
 *
 * Sheet BQ tidak punya kolom Program Kerja eksplisit — split berdasarkan NAMA_PROGRAM
 * lookup ke set ABO_NAMES. Sisanya = LM.
 */

/**
 * ABO substring tokens — case-INSENSITIVE substring match dengan NAMA_PROGRAM.
 * Pakai token unik per item supaya match meskipun spelling sheet KI berbeda
 * (mis. "dan" vs "&", capital vs lowercase, dll).
 */
export const ABO_TOKENS: string[] = [
    "row dengan uav lidar",          // Inspeksi/assesmen ROW dengan UAV LIDAR
    "pemeliharaan proteksi petir",   // Pemeliharaan Proteksi Petir (MRG, MDG, ...)
    "pemasangan tla",                // Pemasangan TLA
    "penggantian isolator",          // Penggantian Isolator
    "pembersihan isolator",          // Pembersihan Isolator
    "penghalang binatang",           // Pemasangan dan Pemeliharaan penghalang Binatang
];

/** Backward-compat — beberapa file lain mungkin masih reference ABO_NAMES */
export const ABO_NAMES = new Set<string>(ABO_TOKENS);

export const KATEGORI_KEYS = [
    "visual_inspection",
    "offline_measurement",
    "pcm_petir",
    "pcm_benda",
    "pcm_binatang",
    "pcm_tegakan",
    "pcm_alat",
] as const;

export type KategoriKey = typeof KATEGORI_KEYS[number];

/** Label panjang kategori (untuk tooltip / detail) */
export const KATEGORI_LABELS: Record<KategoriKey, string> = {
    visual_inspection: "Inservice Visual Inspection",
    offline_measurement: "Inservice/Offline Measurement",
    pcm_petir: "PCM — Gangguan Petir",
    pcm_benda: "PCM — Gangguan Benda Lain",
    pcm_binatang: "PCM — Gangguan Binatang",
    pcm_tegakan: "PCM — Zero Gangguan Tegakan",
    pcm_alat: "PCM — Gangguan Alat",
};

/** Label pendek (untuk axis label / chip) */
export const KATEGORI_SHORT: Record<KategoriKey, string> = {
    visual_inspection: "Visual Inspection",
    offline_measurement: "Measurement",
    pcm_petir: "Gangguan Petir",
    pcm_benda: "Benda Lain",
    pcm_binatang: "Gangguan Binatang",
    pcm_tegakan: "Zero Tegakan",
    pcm_alat: "Gangguan Alat",
};

/**
 * Resolve kategori_key dari raw `JENIS_PROGRAM` BQ (yang punya format
 * "Inservice Visual Inspection (4)") ke slug.
 */
export function resolveKategoriKey(jenisProgram: string): KategoriKey | null {
    const j = (jenisProgram || "").toLowerCase();
    if (j.includes("visual inspection")) return "visual_inspection";
    if (j.includes("measurement")) return "offline_measurement";
    if (j.includes("petir")) return "pcm_petir";
    if (j.includes("benda")) return "pcm_benda";
    if (j.includes("binatang")) return "pcm_binatang";
    if (j.includes("tegakan")) return "pcm_tegakan";
    if (j.includes("alat")) return "pcm_alat";
    return null;
}

/** Resolve LM/ABO via case-insensitive substring match terhadap ABO_TOKENS */
export function resolveProgramKerja(namaProgram: string): "lm" | "abo" {
    const n = (namaProgram || "").toLowerCase();
    for (const tok of ABO_TOKENS) {
        if (n.includes(tok)) return "abo";
    }
    return "lm";
}

/** Parse string number ("15994", "0%", "-%", "") ke number. Default 0 */
export function parseNum(val: string | number | undefined | null): number {
    if (val === null || val === undefined) return 0;
    const s = String(val).replace(/[%,]/g, "").trim();
    if (!s || s === "-") return 0;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

export type Ultg = "TOTAL" | "BOGOR" | "SUKABUMI";
export type ProgramKerjaKey = "lm" | "abo";

/** Item Program Kerja — normalized dari raw BQ row */
export interface ProgramItem {
    no: string;
    namaProgram: string;
    jenisProgram: string;
    kategoriKey: KategoriKey | null;
    programKerja: ProgramKerjaKey;
    risiko: string;
    kategori: string;
    posAnggaran: string;
    keterangan: string;
    pelaksana: string;
    lokasi: string;
    targetBogor: number;
    realisasiBogor: number;
    targetSukabumi: number;
    realisasiSukabumi: number;
    totalTarget: number;
    totalRealisasi: number;
    presentase: number;
    presentaseBogor: number;
    presentaseSukabumi: number;
    programKerjaText: string;
}

/** Normalize raw BQ row record (Record<string,string>) to ProgramItem */
export function normalizeItem(r: Record<string, string>): ProgramItem {
    const namaProgram = r["NAMA PROGRAM"] || r["NAMA_PROGRAM"] || "";
    const jenisProgram = r["JENIS PROGRAM"] || r["JENIS_PROGRAM"] || "";
    return {
        no: r["NO"] || "",
        namaProgram,
        jenisProgram,
        kategoriKey: resolveKategoriKey(jenisProgram),
        programKerja: resolveProgramKerja(namaProgram),
        risiko: r["RISIKO"] || "",
        kategori: r["KATEGORI"] || "",
        posAnggaran: r["POS ANGGARAN"] || r["POS_ANGGARAN"] || "",
        keterangan: r["KETERANGAN"] || "",
        pelaksana: r["PELAKSANA"] || "",
        lokasi: r["LOKASI"] || "",
        programKerjaText: r["PROGRAM KERJA"] || r["PROGRAM_KERJA"] || resolveProgramKerja(namaProgram).toUpperCase(),
        targetBogor: parseNum(r["TARGET ULTG BOGOR"] || r["TARGET_ULTG_BOGOR"]),
        realisasiBogor: parseNum(r["REALISASI ULTG BOGOR"] || r["REALISASI_ULTG_BOGOR"]),
        targetSukabumi: parseNum(r["TARGET ULTG SUKABUMI"] || r["TARGET_ULTG_SUKABUMI"]),
        realisasiSukabumi: parseNum(r["REALISASI ULTG SUKABUMI"] || r["REALISASI_ULTG_SUKABUMI"]),
        totalTarget: parseNum(r["TOTAL TARGET"] || r["TOTAL_TARGET"]),
        totalRealisasi: parseNum(r["TOTAL REALISASI"] || r["TOTAL_REALISASI"]),
        presentase: parseNum(r["PRESENTASE"]),
        presentaseBogor: parseNum(r["PRESENTASE ULTG BOGOR"] || r["PRESENTASE_ULTG_BOGOR"]),
        presentaseSukabumi: parseNum(r["PRESENTASE ULTG SUKABUMI"] || r["PRESENTASE_ULTG_SUKABUMI"]),
    };
}

/** Aggregate item per ULTG: ambil target+realisasi sesuai pilihan */
export function getItemMetric(item: ProgramItem, ultg: Ultg): { target: number; realisasi: number; pct: number } {
    let target = 0, realisasi = 0;
    if (ultg === "BOGOR") {
        target = item.targetBogor; realisasi = item.realisasiBogor;
    } else if (ultg === "SUKABUMI") {
        target = item.targetSukabumi; realisasi = item.realisasiSukabumi;
    } else {
        target = item.totalTarget; realisasi = item.totalRealisasi;
    }
    const pct = target > 0 ? (realisasi / target) * 100 : 0;
    return { target, realisasi, pct };
}
