/**
 * Hardcoded data Program Kerja Gardu Induk UPT Bogor 2026.
 *
 * Source spreadsheets (Bridge System):
 * - IL 2: 1eShlO4Yh-dfAo1vYKY8Wn_gcP169uJZpmNhkqHPTq-s — tab "Progress IL 2"
 * - PS:   1oMw7todUTtlj4_t1TfMc3s0aBqwNi7ANf1SzWn4SimA — tab "Progress PS"
 * - ABO:  1_6emeJmTFsS0Gt4MWDVAqENAFhzHLH3qipy-i3bTaOY — tab "Progress ABO"
 *
 * Fetched: 2026-05-07. Hardcoded sementara — nanti migrasi ke Supabase Postgres
 * tinggal ganti hook `useGiData()` baca dari DB, komponen UI tetap.
 */

export type GiKategori = "il2" | "ps" | "abo";

export interface GiItem {
    no: string;
    namaProgram: string;
    kategori: GiKategori;
    targetBogor: number;
    realBogor: number;
    persenBogor: number;
    targetSukabumi: number;
    realSukabumi: number;
    persenSukabumi: number;
    totalTarget: number;
    totalReal: number;
    totalPersen: number;
}

function p(s: string): number {
    if (!s || s === "—") return 0;
    const n = parseFloat(s.replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}
function n(s: string): number {
    if (!s) return 0;
    const v = parseInt(s.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(v) ? v : 0;
}

/* ─── IL 2 (11 program, snapshot 2026-05-07) ─── */
export const IL2_ITEMS: GiItem[] = [
    ["1", "LCM", "345", "12", "3.5%", "153", "150", "98.0%", "498", "162", "32.5%"],
    ["2", "Pengujian Partial Discharge (PD) Incoming", "36", "11", "30.6%", "11", "1", "9.1%", "47", "12", "25.5%"],
    ["3", "Pengujian Partial Discharge (PD) Kabel Power", "36", "0", "0.0%", "11", "0", "0.0%", "47", "0", "0.0%"],
    ["4", "PD & Arus Bocor Kabel Sealing End", "13", "0", "0.0%", "24", "0", "0.0%", "37", "0", "0.0%"],
    ["5", "Pengujian DGA Minyak Trafo (Main Tank)", "53", "16", "30.2%", "12", "12", "100.0%", "65", "28", "43.1%"],
    ["6", "Pengujian DGA Minyak OLTC", "40", "0", "0.0%", "8", "0", "0.0%", "48", "0", "0.0%"],
    ["7", "Pengujian Karakteristik Minyak Trafo (Main Tank)", "53", "21", "39.6%", "12", "12", "100.0%", "65", "33", "50.8%"],
    ["8", "Pengujian Karakteristik Minyak OLTC", "53", "13", "24.5%", "12", "2", "16.7%", "65", "15", "23.1%"],
    ["9", "Pengujian Karakteristik Minyak Trafo (Tubular)", "15", "0", "0.0%", "6", "0", "0.0%", "21", "0", "0.0%"],
    ["10", "Pengujian Kualitas Gas SF6 di GIS", "2", "2", "100.0%", "3", "3", "100.0%", "5", "5", "100.0%"],
    ["11", "Pengukuran Thermovisi Tiang Raise Pole", "5", "3", "60.0%", "10", "6", "60.0%", "15", "9", "60.0%"],
].map(([no, nama, tB, rB, pB, tS, rS, pS, tT, rT, pT]) => ({
    no, namaProgram: nama, kategori: "il2" as GiKategori,
    targetBogor: n(tB), realBogor: n(rB), persenBogor: p(pB),
    targetSukabumi: n(tS), realSukabumi: n(rS), persenSukabumi: p(pS),
    totalTarget: n(tT), totalReal: n(rT), totalPersen: p(pT),
}));

/* ─── PS (24 program, 4 out-of-scope di-skip) ─── */
export const PS_ITEMS: GiItem[] = [
    ["1", "Pengujian Inhibitor Konten", "2", "0", "0.0%", "0", "0", "0.0%", "2", "0", "0.0%"],
    ["2", "BA Pengecekan Bersama Celah Hewan Setelah Pekerjaan Distribusi", "3", "3", "100.0%", "1", "1", "100.0%", "4", "4", "100.0%"],
    ["3", "Pengawasan Pekerjaan Critical / Progres Konstruksi Critical", "6", "3", "50.0%", "2", "1", "50.0%", "8", "4", "50.0%"],
    ["4", "Penggantian PT Merk Trafindo", "3", "0", "0.0%", "0", "0", "0.0%", "3", "0", "0.0%"],
    ["5", "Reklamasi Minyak Trafo", "0", "0", "0.0%", "1", "0", "0.0%", "1", "0", "0.0%"],
    ["6", "Penggantian Isolator Dudukan LA", "3", "0", "0.0%", "6", "0", "0.0%", "9", "0", "0.0%"],
    ["7", "Pemasangan & Peremajaan Jaring (Anti Binatang) di Gardu Induk", "36", "0", "0.0%", "11", "0", "0.0%", "47", "0", "0.0%"],
    ["8", "Pemasangan Proteksi Anti Binatang (WAP Lokal/Corbuser)", "8", "2", "25.0%", "1", "1", "100.0%", "9", "3", "33.3%"],
    ["9", "Perkuatan NGR MS Resistance / Peremajaan Penambahan Media Isolasi NGR (berikut Reposisi CT REF SBEF)", "1", "0", "0.0%", "0", "0", "0.0%", "1", "0", "0.0%"],
    ["10", "Penanganan Anomali Rembesan Minyak Trafo", "2", "0", "0.0%", "0", "0", "0.0%", "2", "0", "0.0%"],
    ["11", "Penggantian Gas SF6 PMT", "0", "0", "0.0%", "1", "1", "100.0%", "1", "1", "100.0%"],
    ["12", "Pengecatan MTU Korosif", "0", "0", "0.0%", "5", "0", "0.0%", "5", "0", "0.0%"],
    ["13", "Penggantian Kabel Power", "4", "2", "50.0%", "2", "1", "50.0%", "6", "3", "50.0%"],
    ["14", "Penggantian Terminasi Kabel Power", "4", "2", "50.0%", "1", "0", "0.0%", "5", "2", "40.0%"],
    ["15", "Perbaikan Kebocoran Kompartemen GIS", "0", "0", "0.0%", "4", "3", "75.0%", "4", "3", "75.0%"],
    ["16", "Penggantian MTU P0", "29", "6", "20.7%", "7", "4", "57.1%", "36", "10", "27.8%"],
    ["17", "Perbaikan Anomali DS Macet", "3", "0", "0.0%", "2", "0", "0.0%", "5", "0", "0.0%"],
    ["18", "Penggantian Counter LA Bay Line Critical", "2", "0", "0.0%", "2", "0", "0.0%", "4", "0", "0.0%"],
    ["19", "Penggantian/Perbaikan Motor PMS", "0", "0", "0.0%", "0", "0", "0.0%", "0", "0", "0.0%"],
    ["20", "Standarisasi SOP GI dan Update IK GI (Buku Kuning)", "17", "0", "0.0%", "8", "0", "0.0%", "25", "0", "0.0%"],
].map(([no, nama, tB, rB, pB, tS, rS, pS, tT, rT, pT]) => ({
    no, namaProgram: nama, kategori: "ps" as GiKategori,
    targetBogor: n(tB), realBogor: n(rB), persenBogor: p(pB),
    targetSukabumi: n(tS), realSukabumi: n(rS), persenSukabumi: p(pS),
    totalTarget: n(tT), totalReal: n(rT), totalPersen: p(pT),
}));

/* ─── ABO (5 program) ─── */
export const ABO_ITEMS: GiItem[] = [
    ["1", "AHI Kondisi Good Pada Aset Kritikal", "5", "4", "80.0%", "0", "0", "0.0%", "5", "4", "80.0%"],
    ["2", "Mitigasi Gangguan Akibat Binatang", "3", "0", "0.0%", "0", "0", "0.0%", "3", "0", "0.0%"],
    ["3", "Perbaikan Sistem Pentanahan/Grounding", "0", "0", "0.0%", "1", "1", "100.0%", "1", "1", "100.0%"],
    /* Update 2026-05-07 — 3 LA HV phase di GITET 500KV CIBINONG IBT#1 500/150kV (HV) sudah beres */
    ["4", "Reposisi LA", "9", "3", "33.3%", "0", "0", "0.0%", "9", "3", "33.3%"],
    ["5", "Upskilling Operator Simulasi BUKU MERAH", "1", "0", "0.0%", "0", "0", "0.0%", "1", "0", "0.0%"],
].map(([no, nama, tB, rB, pB, tS, rS, pS, tT, rT, pT]) => ({
    no, namaProgram: nama, kategori: "abo" as GiKategori,
    targetBogor: n(tB), realBogor: n(rB), persenBogor: p(pB),
    targetSukabumi: n(tS), realSukabumi: n(rS), persenSukabumi: p(pS),
    totalTarget: n(tT), totalReal: n(rT), totalPersen: p(pT),
}));

export const GI_ALL_ITEMS: GiItem[] = [...IL2_ITEMS, ...PS_ITEMS, ...ABO_ITEMS];

export const GI_KATEGORI_LABEL: Record<GiKategori, string> = {
    il2: "IL 2",
    ps: "Program Strategis",
    abo: "Anti Blackout",
};

export const GI_KATEGORI_SHORT: Record<GiKategori, string> = {
    il2: "IL 2",
    ps: "PS",
    abo: "ABO",
};

/* COLOR PATTERN LOCKED — konsisten antar bidang:
 * - ABO selalu biru
 * - PS selalu amber/kuning
 * - IL 2 hijau (kategori unik untuk Gardu Induk) */
export const GI_KATEGORI_ACCENT: Record<GiKategori, string> = {
    abo: "#5b8def",   // BIRU
    ps: "#f3c14b",    // KUNING
    il2: "#3ecf8e",   // HIJAU
};
