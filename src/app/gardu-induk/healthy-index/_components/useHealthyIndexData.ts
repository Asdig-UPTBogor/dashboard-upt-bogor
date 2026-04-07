/**
 * useHealthyIndexData — normalise & pre-compute all data the page needs.
 *
 * Single source of truth: raw SheetData[] → typed rows[] + derived stats.
 * Every component reads from here via useMemo; no duplicate processing.
 */
"use client";

import { useMemo } from "react";
import type { SheetData } from "@/hooks/usePageData";
import { useCrossFilter } from "./CrossFilterProvider";

/* ── Column name mapping (matches API response header names — spaces, not underscores) ── */
const COL = {
    ULTG: "Master ULTG",
    GI: "Master Gardu Induk",
    BAY: "Master Bay",
    PHASA: "Phasa",
    TEGANGAN: "Tegangan",
    MVA: "MVA",
    MEREK: "Merek",
    TIPE: "Tipe",
    SERIAL: "Serial Id",
    THN_BUAT: "Tahun Buat",
    THN_OPS: "Tahun Operasi",
    CRITICALITY: "Criticality Gi",
    PRIORITAS: "Prioritas Penggantian",
    JUSTIFIKASI: "Justifikasi Prioritas",
    STATUS_USIA: "Status Usia",
    RENCANA: "Rencana",
    STATUS_HI: "Status Hi",
    NILAI_HI: "Nilai Hi",
} as const;

/* ── Typed row interface ── */
export interface HiRow {
    mtu: string;
    ultg: string;
    gi: string;
    bay: string;
    phasa: string;
    tegangan: string;
    merek: string;
    tipe: string;
    serialId: string;
    tahunBuat: string;
    tahunOperasi: string;
    criticalityGi: string;
    prioritas: string;
    justifikasi: string;
    statusUsia: string;
    rencana: string;
    statusHi: string;
    nilaiHi: number;
}

/**
 * Derive MTU type from sheet name.
 * "MTU LA" → "LA", "MTU CT" → "CT", "MTU KABEL POWER" → "KABEL POWER",
 * "MTU TRAFO" → "TRAFO", "SEALING END" → "SEALING END"
 */
function mtuFromSheet(sheetName: string): string {
    return sheetName.replace(/^MTU\s+/i, "").trim();
}

/* ── Normalise all sheets into typed rows ── */
function sheetToRows(sheet: SheetData): HiRow[] {
    const mtuType = mtuFromSheet(sheet.sheetName);

    // Skip sheets without Status Hi column (e.g. SEALING END)
    if (!sheet.headers.includes(COL.STATUS_HI)) return [];

    return sheet.rows
        .map((r) => ({
            mtu: mtuType,
            ultg: (r[COL.ULTG] || "").trim(),
            gi: (r[COL.GI] || "").trim(),
            bay: (r[COL.BAY] || "").trim(),
            phasa: (r[COL.PHASA] || "").trim(),
            tegangan: (r[COL.TEGANGAN] || r[COL.MVA] || "").trim(),
            merek: (r[COL.MEREK] || "").trim(),
            tipe: (r[COL.TIPE] || "").trim(),
            serialId: (r[COL.SERIAL] || "").trim(),
            tahunBuat: (r[COL.THN_BUAT] || "").trim(),
            tahunOperasi: (r[COL.THN_OPS] || "").trim(),
            criticalityGi: (r[COL.CRITICALITY] || "").trim(),
            prioritas: (r[COL.PRIORITAS] || "").trim(),
            justifikasi: (r[COL.JUSTIFIKASI] || "").trim(),
            statusUsia: (r[COL.STATUS_USIA] || "").trim(),
            rencana: (r[COL.RENCANA] || "").trim(),
            statusHi: (r[COL.STATUS_HI] || "").toUpperCase().trim(),
            nilaiHi: parseFloat(r[COL.NILAI_HI] || "0") || 0,
        }))
        .filter((row) => row.gi.length > 0);
}

/* ── Stats for KPI strip & chart data ── */
export interface HiStats {
    total: number;
    critical: number;
    poor: number;
    fair: number;
    good: number;
    veryGood: number;
    p0Count: number;
    p1Count: number;
    /** Per-prioritas counts: { P0: 82, P1: 110, P2: ... } */
    perPrioritas: Record<string, number>;
    /** Per-status usia counts: { MUDA: ..., TUA: ..., SANGAT TUA: ... } */
    perStatusUsia: Record<string, number>;
    /** Per-MTU type counts: { CT: { total, VERY GOOD, GOOD, ... } } */
    perMtu: Record<string, Record<string, number>>;
    /** Per-ULTG: enriched breakdown */
    perUltg: Record<string, {
        total: number;
        giCount: number;
        perMtu: Record<string, number>;
        perStatus: Record<string, number>;
        critical: number;
        poor: number;
    }>;
    /** Per-GI status breakdown */
    perGi: Record<string, Record<string, number>>;
    /** Per-GI per-status MTU type breakdown: { gi: { statusHi: { mtu: count } } } */
    perGiMtu: Record<string, Record<string, Record<string, number>>>;
    /** Per-GI per-Bay status breakdown: { gi: { bay: { statusHi: count, total: count } } } */
    perGiBay: Record<string, Record<string, Record<string, number>>>;
    /** Unique lists for dropdowns */
    uniqueMtu: string[];
    uniqueUltg: string[];
    uniqueGi: string[];
    uniqueStatusHi: string[];
    uniquePrioritas: string[];
    uniqueStatusUsia: string[];
    uniqueCriticality: string[];
    uniqueMerek: string[];
    uniqueTegangan: string[];
}

function computeStats(rows: HiRow[]): HiStats {
    const perMtu: Record<string, Record<string, number>> = {};
    const perUltgMap: Record<string, { gis: Set<string>; perMtu: Record<string, number>; perStatus: Record<string, number> }> = {};
    const perGi: Record<string, Record<string, number>> = {};
    const perGiMtu: Record<string, Record<string, Record<string, number>>> = {};
    const perGiBay: Record<string, Record<string, Record<string, number>>> = {};

    let critical = 0, poor = 0, fair = 0, good = 0, veryGood = 0, p0 = 0, p1 = 0;

    const mtuSet = new Set<string>();
    const ultgSet = new Set<string>();
    const giSet = new Set<string>();
    const statusHiSet = new Set<string>();
    const prioSet = new Set<string>();
    const usiaSet = new Set<string>();
    const critSet = new Set<string>();
    const merekSet = new Set<string>();
    const tegSet = new Set<string>();
    const perPrioritas: Record<string, number> = {};
    const perStatusUsia: Record<string, number> = {};

    for (const r of rows) {
        // Status counts
        if (r.statusHi === "CRITICAL") critical++;
        else if (r.statusHi === "POOR") poor++;
        else if (r.statusHi === "FAIR") fair++;
        else if (r.statusHi === "GOOD") good++;
        else if (r.statusHi === "VERY GOOD") veryGood++;

        if (r.prioritas === "P0") p0++;
        if (r.prioritas === "P1") p1++;

        if (r.prioritas) perPrioritas[r.prioritas] = (perPrioritas[r.prioritas] || 0) + 1;
        if (r.statusUsia) perStatusUsia[r.statusUsia] = (perStatusUsia[r.statusUsia] || 0) + 1;

        // Per MTU
        if (!perMtu[r.mtu]) perMtu[r.mtu] = { total: 0 };
        perMtu[r.mtu].total = (perMtu[r.mtu].total || 0) + 1;
        perMtu[r.mtu][r.statusHi] = (perMtu[r.mtu][r.statusHi] || 0) + 1;

        // Per ULTG
        if (!perUltgMap[r.ultg]) perUltgMap[r.ultg] = { gis: new Set(), perMtu: {}, perStatus: {} };
        perUltgMap[r.ultg].gis.add(r.gi);
        perUltgMap[r.ultg].perMtu[r.mtu] = (perUltgMap[r.ultg].perMtu[r.mtu] || 0) + 1;
        perUltgMap[r.ultg].perStatus[r.statusHi] = (perUltgMap[r.ultg].perStatus[r.statusHi] || 0) + 1;

        // Per GI
        if (!perGi[r.gi]) perGi[r.gi] = { total: 0 };
        perGi[r.gi].total = (perGi[r.gi].total || 0) + 1;
        perGi[r.gi][r.statusHi] = (perGi[r.gi][r.statusHi] || 0) + 1;

        // Per GI + status → MTU breakdown
        if (!perGiMtu[r.gi]) perGiMtu[r.gi] = {};
        if (!perGiMtu[r.gi][r.statusHi]) perGiMtu[r.gi][r.statusHi] = {};
        perGiMtu[r.gi][r.statusHi][r.mtu] = (perGiMtu[r.gi][r.statusHi][r.mtu] || 0) + 1;

        // Per GI + Bay status breakdown
        if (r.bay) {
            if (!perGiBay[r.gi]) perGiBay[r.gi] = {};
            if (!perGiBay[r.gi][r.bay]) perGiBay[r.gi][r.bay] = { total: 0 };
            perGiBay[r.gi][r.bay].total = (perGiBay[r.gi][r.bay].total || 0) + 1;
            perGiBay[r.gi][r.bay][r.statusHi] = (perGiBay[r.gi][r.bay][r.statusHi] || 0) + 1;
        }

        // Uniques
        if (r.mtu) mtuSet.add(r.mtu);
        if (r.ultg) ultgSet.add(r.ultg);
        if (r.gi) giSet.add(r.gi);
        if (r.statusHi) statusHiSet.add(r.statusHi);
        if (r.prioritas) prioSet.add(r.prioritas);
        if (r.statusUsia) usiaSet.add(r.statusUsia);
        if (r.criticalityGi) critSet.add(r.criticalityGi);
        if (r.merek) merekSet.add(r.merek);
        if (r.tegangan) tegSet.add(r.tegangan);
    }

    const perUltg: HiStats["perUltg"] = {};
    for (const [k, v] of Object.entries(perUltgMap)) {
        const totalUnits = Object.values(v.perMtu).reduce((s, n) => s + n, 0);
        perUltg[k] = {
            total: totalUnits,
            giCount: v.gis.size,
            perMtu: v.perMtu,
            perStatus: v.perStatus,
            critical: v.perStatus["CRITICAL"] || 0,
            poor: v.perStatus["POOR"] || 0,
        };
    }

    return {
        total: rows.length,
        critical, poor, fair, good, veryGood,
        p0Count: p0, p1Count: p1,
        perPrioritas, perStatusUsia,
        perMtu, perUltg, perGi, perGiMtu, perGiBay,
        uniqueMtu: [...mtuSet].sort(),
        uniqueUltg: [...ultgSet].sort(),
        uniqueGi: [...giSet].sort(),
        uniqueStatusHi: [...statusHiSet].sort(),
        uniquePrioritas: [...prioSet].sort(),
        uniqueStatusUsia: [...usiaSet].sort(),
        uniqueCriticality: [...critSet].sort(),
        uniqueMerek: [...merekSet].sort(),
        uniqueTegangan: [...tegSet].sort(),
    };
}

/* ── Return type ── */
export interface UseHealthyIndexDataReturn {
    /** All typed rows (unfiltered) */
    allRows: HiRow[];
    /** Filtered rows (after cross-filter applied) */
    filtered: HiRow[];
    /** Stats computed from filtered rows */
    stats: HiStats;
    /** Stats from all rows (for dropdowns — values never disappear) */
    allStats: HiStats;
    /** Spreadsheet IDs used by this page (for "Open Spreadsheet" button) */
    spreadsheetIds: string[];
}

export function useHealthyIndexData(sheets: SheetData[]): UseHealthyIndexDataReturn {
    const { filters } = useCrossFilter();

    // 1. Merge all sheets → typed rows
    const allRows = useMemo(() => {
        const rows: HiRow[] = [];
        for (const sheet of sheets) {
            rows.push(...sheetToRows(sheet));
        }
        return rows;
    }, [sheets]);

    // 2. All-data stats (for dropdown options — values should not disappear)
    const allStats = useMemo(() => computeStats(allRows), [allRows]);

    // 3. Cross-filter
    const filtered = useMemo(() => {
        let data = allRows;
        if (filters.mtu) data = data.filter((r) => r.mtu === filters.mtu);
        if (filters.ultg) data = data.filter((r) => r.ultg === filters.ultg);
        if (filters.statusHi) data = data.filter((r) => r.statusHi === filters.statusHi);
        if (filters.gi) data = data.filter((r) => r.gi === filters.gi);
        if (filters.prioritas) data = data.filter((r) => r.prioritas === filters.prioritas);
        if (filters.statusUsia) data = data.filter((r) => r.statusUsia === filters.statusUsia);
        if (filters.criticality) data = data.filter((r) => r.criticalityGi === filters.criticality);
        if (filters.bay) data = data.filter((r) => r.bay === filters.bay);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            data = data.filter((r) =>
                r.gi.toLowerCase().includes(q) ||
                r.bay.toLowerCase().includes(q) ||
                r.merek.toLowerCase().includes(q) ||
                r.tipe.toLowerCase().includes(q) ||
                r.serialId.toLowerCase().includes(q) ||
                r.justifikasi.toLowerCase().includes(q) ||
                r.rencana.toLowerCase().includes(q) ||
                r.mtu.toLowerCase().includes(q) ||
                r.ultg.toLowerCase().includes(q),
            );
        }
        return data;
    }, [allRows, filters]);

    // 4. Filtered stats
    const stats = useMemo(() => computeStats(filtered), [filtered]);

    // 5. Spreadsheet IDs
    const spreadsheetIds = useMemo(
        () => [...new Set(sheets.map((s) => s.spreadsheetId).filter(Boolean))],
        [sheets],
    );

    return { allRows, filtered, stats, allStats, spreadsheetIds };
}
