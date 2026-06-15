"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useSnapshot } from "@/hooks/useSnapshot";
import { MOTION } from "@/lib/chart-tokens";
import {
    type BidangConfig,
    type CeDetailRow,
    type CeSummaryRow,
    num,
    pctColor,
    programMatch,
    str,
} from "../ce-types";
import { Card } from "@/components/designer/Card";
import { CeHero } from "./CeHero";
import { CeDataTable } from "./CeDataTable";
import { CeProgramBars } from "./CeProgramBars";
import { CeUltgBars, ultgColor, type CeUltgBarRow } from "./CeUltgBars";
import { SegBar } from "./SegBar";

interface Props {
    config: BidangConfig;
    /** ce_summary rows untuk SEMUA bidang — di-filter per bidang di sini. */
    summaryAll: CeSummaryRow[];
}

const MOTION_TRANSITION = { duration: MOTION.dur.normal, ease: MOTION.ease.out };

/** Normalisasi status → CLOSE | OPEN (robust, data belum disanitize). */
function isClose(r: CeDetailRow): boolean {
    if (r.is_close) return true;
    const s = str(r.status).toUpperCase();
    return s === "CLOSE" || s === "CLOSED" || s === "SELESAI";
}

/**
 * Konten 1 bidang CE — hero + donut + program bars + detail table.
 * Fetch ce_detail untuk bidang aktif via useSnapshot.
 */
export function CeBidangContent({ config, summaryAll }: Props) {
    const { rows: detail, loading } = useSnapshot<CeDetailRow>("ce_detail", { bidang: config.bidang });
    // ROW CE Transmisi dipisah (skala besar) — angka dari meta (GRAFIK resmi).
    const isTransmisi = config.bidang === "transmisi";
    const { rows: metaRows } = useSnapshot<{ k: string; v: string }>("meta");
    const rowTarget = isTransmisi ? num(metaRows.find((m) => m.k === "tx_row_target")?.v ?? 0) : 0;
    const rowRealisasi = isTransmisi ? num(metaRows.find((m) => m.k === "tx_row_realisasi")?.v ?? 0) : 0;

    const [statusFilter, setStatusFilter] = useState<"ALL" | "CLOSE" | "OPEN">("ALL");
    const [activeProgram, setActiveProgram] = useState<string | null>(null);
    const [ultgFilter, setUltgFilter] = useState<string | null>(null);

    const summary = useMemo(
        () => summaryAll.filter((r) => r.bidang === config.bidang),
        [summaryAll, config.bidang],
    );

    /**
     * Bar progress per ULTG (panel samping donut) — basis SAMA dengan donut
     * (target-only), dihitung dari ce_detail PENUH (bukan ter-filter) supaya
     * kedua ULTG tetap tampil saat filter aktif (active = highlight, sisanya dim).
     * Item tanpa ULTG gak masuk bar — footnote di panel.
     */
    const ultgBarRows = useMemo<CeUltgBarRow[]>(() => {
        const map = new Map<string, { total: number; close: number; ntTotal: number; ntClose: number }>();
        for (const r of detail) {
            if (activeProgram && !programMatch(str(r.program), activeProgram)) continue;
            const u = str(r.ultg).toUpperCase();
            if (!u) continue;
            const e = map.get(u) ?? { total: 0, close: 0, ntTotal: 0, ntClose: 0 };
            if (r.is_target) {
                e.total += 1;
                if (isClose(r)) e.close += 1;
            } else {
                // Non-target ("sunnah") — info ditampilkan kecil, gak masuk angka resmi
                e.ntTotal += 1;
                if (isClose(r)) e.ntClose += 1;
            }
            map.set(u, e);
        }
        return [...map.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, e]) => ({
                key: name,
                name: `ULTG ${name}`,
                total: e.total,
                close: e.close,
                ntTotal: e.ntTotal,
                ntClose: e.ntClose,
                accent: ultgColor(name, config.accent),
            }));
    }, [detail, activeProgram, config.accent]);

    /** Item target tanpa ULTG — gak masuk bar ULTG (footnote panel). */
    const noUltgTargetCount = useMemo(
        () => detail.reduce((s, r) => s + (r.is_target && str(r.ultg) === "" ? 1 : 0), 0),
        [detail],
    );

    const hasUltgBars = ultgBarRows.length > 0;

    /** Detail rows setelah filter ULTG — sumber tabel + recompute KPI/donut/bar. */
    const detailFiltered = useMemo(
        () => (ultgFilter ? detail.filter((r) => str(r.ultg).toUpperCase() === ultgFilter) : detail),
        [detail, ultgFilter],
    );

    /**
     * UX interaksi penuh (pattern PK Transmisi): filter APAPUN aktif (ULTG/program) →
     * SEMUA angka di-recompute dari detail rows ter-filter (termasuk transmisi).
     * Default tanpa filter: angka resmi ce_summary (transmisi = GRAFIK manual).
     */
    const useDetailNumbers = ultgFilter !== null;

    /**
     * Split Target vs Non-Target CE (dari detail ter-filter ULTG). Angka utama (Hero/donut) =
     * TARGET (sesuai GRAFIK resmi: target = "YA", non-target dipisah). Non-target ditampilkan
     * kecil sbg info. GI/Transmisi: semua is_target=true → non-target = 0 (anotasi otomatis hilang).
     */
    const split = useMemo(() => {
        let tClose = 0, tOpen = 0, ntClose = 0, ntOpen = 0;
        for (const r of detailFiltered) {
            const closed = isClose(r);
            if (r.is_target) closed ? tClose++ : tOpen++;
            else closed ? ntClose++ : ntOpen++;
        }
        return { tClose, tOpen, ntClose, ntOpen, targetTotal: tClose + tOpen };
    }, [detailFiltered]);

    /** Total dari ce_summary (target program) — fallback ke agg detail kalau kosong. */
    const summaryTotals = useMemo(() => {
        const target = summary.reduce((s, r) => s + num(r.target), 0);
        const realisasi = summary.reduce((s, r) => s + num(r.realisasi), 0);
        return { target, realisasi };
    }, [summary]);

    /**
     * Program bars: default angka resmi ce_summary. Saat filter ULTG aktif (non-transmisi),
     * recompute per-program dari detail target rows ber-ULTG itu — zero fabricate.
     */
    const programItems = useMemo<CeSummaryRow[]>(() => {
        if (!useDetailNumbers) return summary;
        const map = new Map<string, { target: number; realisasi: number }>();
        for (const r of detailFiltered) {
            if (!r.is_target) continue;
            const p = str(r.program);
            if (!p) continue;
            const e = map.get(p) ?? { target: 0, realisasi: 0 };
            e.target += 1;
            if (isClose(r)) e.realisasi += 1;
            map.set(p, e);
        }
        return [...map.entries()].map(([program, e]) => ({
            bidang: config.bidang,
            program,
            target: e.target,
            realisasi: e.realisasi,
            sisa: e.target - e.realisasi,
            persen: e.target > 0 ? (e.realisasi / e.target) * 100 : 0,
        }));
    }, [useDetailNumbers, summary, detailFiltered, config.bidang]);

    // Hero/donut/bar pakai angka RESMI dari ce_summary (untuk transmisi = GRAFIK manual tim).
    // Fallback ke split detail kalau summary kosong. Non-target tetap dari detail (khusus proteksi).
    // Filter ULTG aktif (non-transmisi) → pakai angka detail ter-filter.
    // Hero bereaksi ke filter ULTG (pattern PK Transmisi) — klik program tidak mengubah hero.
    // Default tanpa filter: angka resmi ce_summary (transmisi = GRAFIK).
    const heroTotal = useDetailNumbers ? split.targetTotal : summaryTotals.target || split.targetTotal;
    const heroClose = useDetailNumbers
        ? split.tClose
        : summaryTotals.target
          ? summaryTotals.realisasi
          : split.tClose;
    const heroOpen = Math.max(heroTotal - heroClose, 0);

    /** Non-target per program — info "sunnah" di row Sub CE (scope ikut basis programItems). */
    const ntByProgram = useMemo<Record<string, { total: number; close: number }>>(() => {
        const base = useDetailNumbers ? detailFiltered : detail;
        const map: Record<string, { total: number; close: number }> = {};
        for (const r of base) {
            if (r.is_target) continue;
            const pr = str(r.program);
            if (!pr) continue;
            const e = (map[pr] ??= { total: 0, close: 0 });
            e.total += 1;
            if (isClose(r)) e.close += 1;
        }
        return map;
    }, [useDetailNumbers, detailFiltered, detail]);

    const toggleProgram = (p: string) =>
        setActiveProgram((cur) => (cur === p ? null : p));
    const toggleUltg = (u: string) =>
        setUltgFilter((cur) => (cur === u ? null : u));

    // Filter program nyangkut di program yang gak ada di set ULTG aktif → auto-clear.
    useEffect(() => {
        if (
            activeProgram &&
            !programItems.some(
                (p) => programMatch(p.program, activeProgram) || programMatch(activeProgram, p.program),
            )
        ) {
            setActiveProgram(null);
        }
    }, [activeProgram, programItems]);

    if (loading && detail.length === 0) {
        return (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="ds-body">Memuat detail {config.label}...</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-12 gap-3">

            {/* 1. KPI Hero */}
            <CeHero
                data={{
                    total: heroTotal,
                    close: heroClose,
                    open: heroOpen,
                    programCount: programItems.length,
                    caption: `Common Enemy ${config.label}${ultgFilter ? ` · ULTG ${ultgFilter}` : ""}`,
                    nickname: config.nickname,
                    nicknameColor: config.accent,
                    accent: config.accent,
                    accent2: config.accent2,
                    nonTargetClose: split.ntClose,
                    nonTargetOpen: split.ntOpen,
                }}
                side={
                    hasUltgBars ? (
                        <CeUltgBars
                            bare
                            direction="column"
                            rows={ultgBarRows}
                            active={ultgFilter}
                            onToggle={toggleUltg}
                            noUltgCount={noUltgTargetCount}
                        />
                    ) : undefined
                }
            />


            {/* ROW — card sendiri, visual ala Hero KPI (angka gede + label bawah + bar) */}
            {isTransmisi && rowTarget > 0 && (
                <motion.div layout transition={MOTION_TRANSITION} className="col-span-12 flex min-w-0">
                    <Card style={{ flex: 1 }} noPad>
                        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                            {/* Caption — pattern hero */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 16, height: 1.5, background: "var(--fg-3)" }} />
                                <span style={{ fontSize: 11, color: "var(--fg-0)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
                                    ROW · Right of Way
                                </span>
                            </div>
                            {/* Stats gede ala hero */}
                            <div style={{ display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "space-evenly" }}>
                                <RowStatBig value={rowTarget.toLocaleString("id-ID")} label="Target" />
                                <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
                                <RowStatBig value={rowRealisasi.toLocaleString("id-ID")} label="Realisasi" color="var(--cond-very-good)" />
                                <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
                                <RowStatBig value={(rowTarget - rowRealisasi).toLocaleString("id-ID")} label="Sisa" color="var(--cond-poor)" />
                                <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
                                <RowStatBig value={`${((rowRealisasi / rowTarget) * 100).toFixed(1)}%`} label="Progress" color={pctColor((rowRealisasi / rowTarget) * 100)} />
                            </div>
                            {/* Bar — SSOT SegBar, pattern sama dengan ULTG & Sub CE */}
                            <SegBar close={rowRealisasi} target={rowTarget} height={13} />
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* 3. Card program — bar gaya PK (label · bar · angka), ROW ikut di list,
                klik program = filter semua (hero + ULTG + tabel). */}
            <motion.div layout transition={MOTION_TRANSITION} className="col-span-12 flex min-w-0">
                <CeProgramBars
                    title={`Sub CE ${config.label}`}
                    ntByProgram={ntByProgram}
                    items={programItems}
                    accent={config.accent}
                    activeProgram={activeProgram}
                    onProgramClick={toggleProgram}
                    style={{ flex: 1, minWidth: 0 }}
                />
            </motion.div>


            {/* 3. Detail table — ter-filter ULTG + program + status */}
            <CeDataTable
                rows={detailFiltered}
                accent={config.accent}
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
                programFilter={activeProgram}
                onClearProgram={() => setActiveProgram(null)}
            />
        </div>
    );
}

/* Stat gede ala Hero KPI — dipakai card ROW. */
function RowStatBig({ value, label, color }: { value: string; label: string; color?: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
                className="num"
                style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.03em",
                    color: color ?? "var(--fg-0)",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                }}
            >
                {value}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--fg-1)", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>
        </div>
    );
}
