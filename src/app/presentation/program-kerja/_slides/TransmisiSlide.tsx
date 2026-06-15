"use client";

/**
 * Slide Transmisi (page 4) — deep-dive bidang, theme-aware.
 * Visual SYSTEM: bahasa Vercel/Geist (mono, glow, bar pill) — KONSISTEN slide 2 & 3.
 *   FLAT (tanpa card) — background terlihat.
 *   Header: kicker English + logo. Footer: meta string + wordmark.
 *   Body atas: KPI strip (Progress Transmisi · ULTG Bogor · ULTG Sukabumi).
 *     → card ULTG bisa diklik untuk FILTER per ULTG (rincian ngikut scope).
 *   Body bawah: blok per kategori — ABO (header + daftar program ABO),
 *     lalu PS (header + daftar program PS). Item bar LED tipis (hierarki visual).
 *   Program tanpa target → 1 tombol → modal.
 *   Backdrop: foto SPESIFIK bidang Transmisi (/backgrounds/{tone}/transmisi.png).
 *
 * Data: snapshot Supabase pk_transmisi (deck-snapshot.ts) — sama dengan dashboard.
 */

import { useMemo, useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useTheme } from "next-themes";
import { X } from "lucide-react";
import type { ProgramItem } from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";
import { useDeckTransmisi } from "../_data/deck-snapshot";
import { fmtNum, getISOWeek } from "../_components/SlideShared";

const SANS = "var(--font-sans, -apple-system, sans-serif)";
const MONO = "var(--font-mono, monospace)";
const TNUM = '"tnum"';
const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

/* Identitas warna: bidang Transmisi (orange), kategori ABO (biru) / PS (amber), ULTG. */
const TX = "#FB923C";
const ABO = "#3D7FFF";
const PS = "#f3c14b";
const BOGOR = "#3D7FFF";
const SUKABUMI = "#2DD4A7";

type Scope = "bogor" | "sukabumi" | null;
interface Val { t: number; r: number }
interface ProgVal { it: ProgramItem; t: number; r: number }

type Palette = {
    bg: string; strong: string; name: string; text: string; muted: string; meta: string; faint: string;
    track: string; line: string; line2: string; condNeutral: string; photo: number; scrim: string;
    overlay: string; panel: string; panelBorder: string; panelShadow: string;
};
function palette(light: boolean): Palette {
    return light ? {
        bg: "#eef1f6", strong: "#0f172a", name: "#1e2733", text: "#283543", muted: "#3f4d5c", meta: "#52606f", faint: "#6b7785",
        track: "rgba(15,23,42,0.10)", line: "rgba(15,23,42,0.11)", line2: "rgba(15,23,42,0.16)", condNeutral: "#0f172a",
        photo: 0.3, scrim: "linear-gradient(180deg, rgba(238,241,246,0.78) 0%, rgba(238,241,246,0.6) 44%, rgba(238,241,246,0.76) 100%)",
        overlay: "rgba(15,23,42,0.42)", panel: "#f7f9fc", panelBorder: "rgba(15,23,42,0.12)", panelShadow: "0 26px 64px rgba(15,23,42,0.24)",
    } : {
        bg: "#000", strong: "#fafafa", name: "#f4f4f4", text: "#e8e8e8", muted: "#c4c4c4", meta: "#b0b0b0", faint: "#9a9a9a",
        track: "rgba(255,255,255,0.08)", line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.14)", condNeutral: "#fafafa",
        photo: 0.56, scrim: "linear-gradient(180deg, rgba(0,0,0,0.64) 0%, rgba(0,0,0,0.42) 44%, rgba(0,0,0,0.58) 76%, rgba(0,0,0,0.74) 100%)",
        overlay: "rgba(0,0,0,0.66)", panel: "#0d1014", panelBorder: "rgba(255,255,255,0.12)", panelShadow: "0 28px 70px rgba(0,0,0,0.55)",
    };
}

const pctOf = (t: number, r: number) => (t > 0 ? (r / t) * 100 : 0);
const pct1 = (p: number) => p.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const clamp = (p: number) => Math.min(Math.max(p, 0), 100);
function condColor(p: number, light: boolean, neutral: string): string {
    if (p >= 60) return light ? "#0a9d6e" : "#00E599";
    if (p < 40) return light ? "#c2710c" : "#F5A623";
    return neutral;
}

export function TransmisiSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const { items, loading, error } = useDeckTransmisi();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const light = mounted && resolvedTheme === "light";
    const P = palette(light);
    const [showNoTarget, setShowNoTarget] = useState(false);
    const [activeUltg, setActiveUltg] = useState<Scope>(null);
    const toggleUltg = (k: "bogor" | "sukabumi") => setActiveUltg((cur) => (cur === k ? null : k));

    const m = useMemo(() => {
        const sum = (arr: ProgramItem[], f: (it: ProgramItem) => number) => arr.reduce((s, it) => s + f(it), 0);
        const valOf = (it: ProgramItem): Val =>
            activeUltg === "bogor" ? { t: it.targetBogor, r: it.realisasiBogor }
                : activeUltg === "sukabumi" ? { t: it.targetSukabumi, r: it.realisasiSukabumi }
                    : { t: it.totalTarget, r: it.totalRealisasi };
        const aggOf = (arr: ProgramItem[]): Val => arr.reduce((s, it) => { const v = valOf(it); return { t: s.t + v.t, r: s.r + v.r }; }, { t: 0, r: 0 });
        // Sort item per kategori: progress (%) tertinggi dulu.
        const mapScope = (arr: ProgramItem[]): ProgVal[] => arr.filter((it) => valOf(it).t > 0).map((it) => ({ it, ...valOf(it) })).sort((a, b) => pctOf(b.t, b.r) - pctOf(a.t, a.r));
        const cnt = (arr: ProgramItem[], f: (it: ProgramItem) => number) => arr.filter((it) => f(it) > 0).length;

        const abo = items.filter((it) => it.programKerja === "abo");
        const lm = items.filter((it) => it.programKerja === "lm");
        const noTarget = [...abo, ...lm].filter((it) => valOf(it).t === 0);
        return {
            grand: { t: sum(items, (it) => it.totalTarget), r: sum(items, (it) => it.totalRealisasi) } as Val,
            bogor: { t: sum(items, (it) => it.targetBogor), r: sum(items, (it) => it.realisasiBogor) } as Val,
            skbm: { t: sum(items, (it) => it.targetSukabumi), r: sum(items, (it) => it.realisasiSukabumi) } as Val,
            brkGrand: { abo: cnt(abo, (it) => it.totalTarget), ps: cnt(lm, (it) => it.totalTarget) },
            brkBogor: { abo: cnt(abo, (it) => it.targetBogor), ps: cnt(lm, (it) => it.targetBogor) },
            brkSkbm: { abo: cnt(abo, (it) => it.targetSukabumi), ps: cnt(lm, (it) => it.targetSukabumi) },
            aboAgg: aggOf(abo), lmAgg: aggOf(lm),
            programsAbo: mapScope(abo), programsLm: mapScope(lm),
            noTargetAbo: noTarget.filter((it) => it.programKerja === "abo"),
            noTargetLm: noTarget.filter((it) => it.programKerja === "lm"),
            noTargetCount: noTarget.length,
        };
    }, [items, activeUltg]);

    if (loading) return <SlideMsg bg={P.bg} color={P.muted} text="Memuat data Transmisi…" />;
    if (error || items.length === 0) return <SlideMsg bg={P.bg} color={P.muted} text={error || "Belum ada data Transmisi"} />;

    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);
    const tone = light ? "light" : "dark";
    const logoDan = light ? "/wap/logo-danantara.png" : "/wap/poster/assets/logo-danantara-w.png";
    const logoPln = light ? "/wap/logo-pln.png" : "/wap/poster/assets/logo-pln-w.png";
    const metaStr = `${String(slideNo).padStart(2, "0")}/${String(total).padStart(2, "0")} · Transmisi · ${dateStr} · Minggu ${week}`;
    const scopeLabel = activeUltg === "bogor" ? "ULTG Bogor" : activeUltg === "sukabumi" ? "ULTG Sukabumi" : null;

    const metrics = [
        { key: "total", label: "Progress Transmisi", color: TX, color2: "#fdba74", v: m.grand, breakdown: m.brkGrand as { abo: number; ps: number }, onClick: undefined as (() => void) | undefined, active: false },
        { key: "bogor", label: "ULTG Bogor", color: BOGOR, color2: "#5b9aff", v: m.bogor, breakdown: m.brkBogor, onClick: () => toggleUltg("bogor"), active: activeUltg === "bogor" },
        { key: "sukabumi", label: "ULTG Sukabumi", color: SUKABUMI, color2: "#5be3c0", v: m.skbm, breakdown: m.brkSkbm, onClick: () => toggleUltg("sukabumi"), active: activeUltg === "sukabumi" },
    ];

    return (
        <section className="slide" style={{
            background: P.bg, color: P.text, boxSizing: "border-box", padding: "64px 100px 48px",
            fontFamily: SANS, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        }}>
            {/* Backdrop foto SPESIFIK bidang Transmisi (theme-aware) + scrim */}
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: `url(/backgrounds/${tone}/transmisi.png) center / cover no-repeat`, opacity: P.photo }} />
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: P.scrim }} />

            {/* Header — kicker + logo (pola slide 2 & 3) */}
            <motion.div {...fadeUp} transition={{ duration: 0.45, ease: EASE }} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 3 }}>
                    <span style={{ width: 30, height: 2, background: TX, display: "block" }} />
                    <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.26em", textTransform: "uppercase", color: P.muted }}>Field Detail · Transmisi</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDan} alt="Danantara" style={{ height: 28, objectFit: "contain" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPln} alt="PLN" style={{ height: 42, objectFit: "contain" }} />
                </div>
            </motion.div>

            {/* Judul + tombol Tanpa Target (di baris judul biar ga makan space vertical) */}
            <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.5, ease: EASE }} style={{ margin: "26px 0 0", position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
                <h2 style={{ fontSize: 50, fontWeight: 600, letterSpacing: "-0.03em", color: P.strong, margin: 0, lineHeight: 1 }}>Program Kerja Transmisi</h2>
                {m.noTargetCount > 0 && (
                    <button type="button" onClick={() => setShowNoTarget(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: MONO, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: P.muted, background: P.track, border: `1px solid ${P.line2}`, borderRadius: 8, padding: "8px 14px", flexShrink: 0, whiteSpace: "nowrap" }}>
                        Tanpa Target
                        <span style={{ fontWeight: 800, color: P.strong, fontFeatureSettings: TNUM }}>{m.noTargetCount}</span>
                    </button>
                )}
            </motion.div>

            {/* Hairline */}
            <motion.div initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.25, duration: 0.6, ease: EASE }} style={{ height: 1, transformOrigin: "left", background: `linear-gradient(90deg, ${P.line2}, ${P.line} 70%, transparent)`, margin: "22px 0 0", position: "relative", zIndex: 1 }} />

            {/* Body: KPI strip + blok kategori — FLAT */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 24, position: "relative", zIndex: 1, paddingTop: 12 }}>
                {/* ── KPI strip: Progress Transmisi · ULTG Bogor · ULTG Sukabumi (ULTG clickable) ── */}
                <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.4, ease: EASE }} style={{ display: "flex", alignItems: "stretch" }}>
                    {metrics.map((mt, i) => (
                        <Fragment key={mt.key}>
                            <TopMetric label={mt.label} color={mt.color} color2={mt.color2} v={mt.v} breakdown={mt.breakdown} hero onClick={mt.onClick} active={mt.active} padLeft={i === 0 ? 0 : 30} padRight={i === metrics.length - 1 ? 0 : 30} P={P} light={light} delay={0.16 + i * 0.05} />
                            {i < metrics.length - 1 && (
                                <div style={{ width: 1, alignSelf: "stretch", margin: "6px 0", background: `linear-gradient(180deg, transparent 1%, ${P.line2} 8%, ${P.line2} 92%, transparent 99%)` }} />
                            )}
                        </Fragment>
                    ))}
                </motion.div>

                {/* ── Blok kategori (full-width) — ABO lalu PS, masing-masing daftar program-nya ── */}
                <motion.div {...fadeUp} transition={{ delay: 0.3, duration: 0.4, ease: EASE }} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 18, borderTop: `1px solid ${P.line2}`, paddingTop: 20, overflow: "hidden" }}>
                    <CategoryBlock abbr="ABO" name="Anti Blackout" agg={m.aboAgg} programs={m.programsAbo} color={ABO} cols={2} P={P} light={light} delay={0.3} />
                    <CategoryBlock abbr="PS" name="Program Strategis" agg={m.lmAgg} programs={m.programsLm} color={PS} cols={3} maxRows={7} fill P={P} light={light} delay={0.36} />
                </motion.div>
            </div>

            {/* Footer — meta string + wordmark (pola slide 2 & 3) */}
            <motion.div {...fadeUp} transition={{ delay: 0.46, duration: 0.4, ease: EASE }} style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${P.line}`, paddingTop: 16, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.muted, fontFeatureSettings: TNUM }}>{metaStr}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.faint, flexShrink: 0 }}>Program Kerja UPT Bogor · 2026</span>
            </motion.div>

            {/* Modal program tanpa target */}
            <AnimatePresence>
                {showNoTarget && (
                    <NoTargetModal abo={m.noTargetAbo} lm={m.noTargetLm} count={m.noTargetCount} scopeLabel={scopeLabel} P={P} onClose={() => setShowNoTarget(false)} />
                )}
            </AnimatePresence>
        </section>
    );
}

/* ─────────── KPI strip cell (Progress Transmisi · ULTG …) — ULTG clickable filter ─────────── */
/* Donut ring visual % untuk card hero (Progress Transmisi). */
function MiniDonut({ pct, color, color2, size, P }: { pct: number; color: string; color2: string; size: number; P: Palette }) {
    const ringW = 10;
    const r = (size - ringW) / 2 - 3;
    const cxy = size / 2;
    const circ = 2 * Math.PI * r;
    const p = clamp(pct);
    const offset = circ * (1 - p / 100);
    const gid = `donutGrad-${color.replace("#", "")}`;
    // Count-up angka (konsisten dgn donut slide Ringkasan Eksekutif).
    const mv = useMotionValue(0);
    const numText = useTransform(mv, (val) => pct1(val));
    useEffect(() => {
        const controls = animate(mv, p, { duration: 1.1, delay: 0.35, ease: EASE });
        return () => controls.stop();
    }, [mv, p]);
    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", transform: "rotate(-90deg)" }}>
                <defs>
                    <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={color2} />
                        <stop offset="100%" stopColor={color} />
                    </linearGradient>
                </defs>
                <circle cx={cxy} cy={cxy} r={r} fill="none" stroke={P.track} strokeWidth={ringW} />
                <motion.circle cx={cxy} cy={cxy} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={ringW} strokeLinecap="round" strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }} transition={{ delay: 0.35, duration: 1.1, ease: EASE }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: MONO, fontSize: size * 0.225, fontWeight: 600, color: P.strong, letterSpacing: "-0.02em", fontFeatureSettings: TNUM }}>
                    <motion.span>{numText}</motion.span><span style={{ fontSize: "0.4em", color, marginLeft: 1 }}>%</span>
                </span>
            </div>
        </div>
    );
}

function TopMetric({ label, color, color2, v, breakdown, hero, onClick, active, padLeft, padRight, P, light, delay }: {
    label: string; color: string; color2: string; v: Val; breakdown?: { abo: number; ps: number }; hero?: boolean; onClick?: () => void; active?: boolean; padLeft: number; padRight: number; P: Palette; light: boolean; delay: number;
}) {
    const p = pctOf(v.t, v.r);
    const interactive = !!onClick;
    const totalProg = breakdown ? breakdown.abo + breakdown.ps : 0;
    const [hovered, setHovered] = useState(false);
    // Border dihitung deterministik dari state (active > hover > none) — bukan whileHover framer
    // (whileHover + style border saling rebutan → outline nyangkut saat re-render pindah card).
    const borderCol = active ? color : interactive && hovered ? `${color}66` : "transparent";
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay, ease: EASE }}
            onClick={onClick}
            onMouseEnter={interactive ? () => setHovered(true) : undefined}
            onMouseLeave={interactive ? () => setHovered(false) : undefined}
            style={{ flex: 1, minWidth: 0, padding: `13px ${padRight}px 13px ${padLeft}px`, cursor: interactive ? "pointer" : "default", borderRadius: 14, border: `1.5px solid ${borderCol}`, backgroundColor: active ? `color-mix(in oklab, ${color} 9%, transparent)` : "transparent", transition: "border-color 0.14s ease, background-color 0.18s ease", userSelect: "none" }}
        >
            {hero ? (
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <MiniDonut pct={p} color={color} color2={color2} size={118} P={P} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                        {/* Eyebrow / title kartu */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 12px ${color}88`, flexShrink: 0 }} />
                            <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, letterSpacing: "0.09em", color: P.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
                        </div>
                        {/* Primary: jumlah program */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                            <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 600, color: P.strong, lineHeight: 1, letterSpacing: "-0.025em", fontFeatureSettings: TNUM }}>{totalProg}</span>
                            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: P.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Program</span>
                        </div>
                        {/* Secondary: item selesai/total */}
                        <div style={{ fontFamily: MONO, fontFeatureSettings: TNUM, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
                            <span style={{ fontSize: 17, fontWeight: 600, color: P.text }}>{fmtNum(v.r)} / {fmtNum(v.t)}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 400, color: P.faint, marginLeft: 6 }}>item</span>
                        </div>
                        {/* Tertiary: breakdown kategori */}
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: P.faint, fontFeatureSettings: TNUM, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                            <span style={{ color: ABO, fontWeight: 700 }}>ABO</span> {breakdown?.abo ?? 0}
                            <span style={{ margin: "0 7px", color: P.faint }}>·</span>
                            <span style={{ color: PS, fontWeight: 700 }}>PS</span> {breakdown?.ps ?? 0}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 12px ${color}88`, flexShrink: 0 }} />
                        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, letterSpacing: "0.05em", color: P.strong, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 600, color: P.strong, lineHeight: 0.9, letterSpacing: "-0.03em", marginTop: 12, fontFeatureSettings: TNUM }}>
                        {pct1(p)}<span style={{ fontSize: 24, color: P.meta }}>%</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: P.muted, marginTop: 9, whiteSpace: "nowrap", fontFeatureSettings: TNUM }}>
                        {fmtNum(v.r)} / {fmtNum(v.t)} item
                    </div>
                    {breakdown && (
                        <div style={{ fontFamily: MONO, fontSize: 12.5, marginTop: 6, fontFeatureSettings: TNUM, whiteSpace: "nowrap", color: P.muted }}>
                            {totalProg} Program
                            <span style={{ margin: "0 7px", color: P.faint }}>·</span>
                            <span style={{ color: ABO, fontWeight: 700 }}>ABO</span> {breakdown.abo}
                            <span style={{ margin: "0 7px", color: P.faint }}>·</span>
                            <span style={{ color: PS, fontWeight: 700 }}>PS</span> {breakdown.ps}
                        </div>
                    )}
                    <div style={{ height: 8, borderRadius: 99, background: P.track, marginTop: breakdown ? 11 : 14, overflow: "hidden" }}>
                        <motion.div initial={{ width: "0%" }} animate={{ width: `${clamp(p)}%` }} transition={{ delay: delay + 0.2, duration: 0.9, ease: EASE }} style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${color}, ${color2})`, boxShadow: `0 0 14px ${color}77` }} />
                    </div>
                </>
            )}
        </motion.div>
    );
}

/* ─────────── Blok kategori — header (chip + nama + % + bar) + daftar program (3 kolom, bar tipis) ─────────── */
function CategoryBlock({ abbr, name, agg, programs, color, cols, maxRows, fill, P, light, delay }: {
    abbr: string; name: string; agg: Val; programs: ProgVal[]; color: string; cols: number; maxRows?: number; fill?: boolean; P: Palette; light: boolean; delay: number;
}) {
    const p = pctOf(agg.t, agg.r);
    // Mode column-flow: isi kolom ke bawah maksimal `maxRows` item, baru pindah kolom (7 | 7 | sisa).
    const colFlow = !!maxRows && maxRows > 0;
    const flowCols = colFlow ? Math.max(1, Math.ceil(programs.length / maxRows!)) : cols;
    const visRows = colFlow ? Math.min(maxRows!, programs.length) : 0;
    const wide = (colFlow ? flowCols : cols) <= 2; // kolom lebar (ABO 2-kol) → font item ga perlu dishrink agresif
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, ...(fill ? { flex: 1, minHeight: 0 } : {}) }}>
            {/* Header kategori (Anti Blackout / Program Strategis) — LED bar tipis */}
            <div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", color, background: `color-mix(in oklab, ${color} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`, padding: "4px 9px", borderRadius: 6, lineHeight: 1.2, flexShrink: 0 }}>{abbr}</span>
                    <span style={{ fontSize: 20, fontWeight: 600, color: P.strong, whiteSpace: "nowrap" }}>{name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 25, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, whiteSpace: "nowrap", paddingLeft: 4 }}>{pct1(p)}%</span>
                    <span style={{ width: 1, height: 15, background: P.line2, flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: 12.5, color: P.faint, fontFeatureSettings: TNUM, whiteSpace: "nowrap" }}>{programs.length} program · {fmtNum(agg.r)} / {fmtNum(agg.t)} item</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: P.track, marginTop: 11, overflow: "hidden" }}>
                    <motion.div initial={{ width: "0%" }} animate={{ width: `${clamp(p)}%` }} transition={{ delay: delay + 0.1, duration: 0.9, ease: EASE }} style={{ height: "100%", borderRadius: 99, background: color, boxShadow: `0 0 9px ${color}77` }} />
                </div>
            </div>

            {/* Daftar program — stacked kolom; PS: column-flow (isi ke bawah dulu, 7|7|sisa) */}
            <div style={colFlow ? {
                display: "grid", gridAutoFlow: "column", gridTemplateColumns: `repeat(${flowCols}, 1fr)`, gridTemplateRows: `repeat(${visRows}, auto)`, columnGap: 34, rowGap: 0,
                // fill: tinggi row tetap natural (seragam), spasi antar-row didistribusi rata → ga ada ruang kosong di bawah.
                ...(fill ? { flex: 1, minHeight: 0, alignContent: "space-between" } : { alignContent: "start" }),
            } : {
                display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: cols >= 3 ? 34 : 56, rowGap: 0, alignContent: "start",
            }}>
                {programs.map(({ it, t, r }, i) => (
                    <ProgramRow key={`${it.no || i}-${it.namaProgram}`} name={it.namaProgram} t={t} r={r} wide={wide} P={P} light={light} delay={delay + 0.1 + Math.min(i, 10) * 0.014} />
                ))}
            </div>
        </div>
    );
}

/* ─────────── Baris program — nama + (selesai/total item) + % (stacked list) ─────────── */
function ProgramRow({ name, t, r, wide, P, light, delay }: { name: string; t: number; r: number; wide?: boolean; P: Palette; light: boolean; delay: number }) {
    const p = pctOf(t, r);
    // Font auto-mengecil untuk nama panjang biar muat 1 baris — disesuaikan lebar kolom.
    // Kolom lebar (ABO 2-kol) toleran nama panjang; kolom sempit (PS 3-kol) lebih agresif.
    const fs = wide
        ? (name.length > 92 ? 13 : name.length > 74 ? 14 : 15.5)
        : (name.length > 76 ? 10 : name.length > 60 ? 11.5 : name.length > 46 ? 12.5 : name.length > 36 ? 13.5 : 14.5);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.22, ease: "easeOut" }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${P.line}` }}>
            <span style={{ fontSize: fs, color: P.name, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{name}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexShrink: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: P.meta, fontFeatureSettings: TNUM, minWidth: 58, textAlign: "right" }}>{fmtNum(r)}/{fmtNum(t)}</span>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, minWidth: 48, textAlign: "right" }}>{pct1(p)}%</span>
            </div>
        </motion.div>
    );
}

/* ─────────── Modal: program tanpa target ─────────── */
function NoTargetModal({ abo, lm, count, scopeLabel, P, onClose }: {
    abo: ProgramItem[]; lm: ProgramItem[]; count: number; scopeLabel: string | null; P: Palette; onClose: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", background: P.overlay, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: 60 }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.26, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 940, maxWidth: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", background: P.panel, border: `1px solid ${P.panelBorder}`, borderRadius: 18, boxShadow: P.panelShadow, overflow: "hidden" }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 32px", borderBottom: `1px solid ${P.line}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                        <span style={{ width: 30, height: 2, background: TX }} />
                        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: P.muted }}>Program Tanpa Target{scopeLabel ? ` · ${scopeLabel}` : ""}</span>
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: P.strong, fontFeatureSettings: TNUM }}>{count}</span>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Tutup" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, cursor: "pointer", color: P.muted, background: P.track, border: `1px solid ${P.line2}` }}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ padding: "24px 32px 28px", overflow: "auto", display: "grid", gridTemplateColumns: abo.length && lm.length ? "1fr 1fr" : "1fr", gap: 36 }}>
                    {abo.length > 0 && <ModalGroup label="Anti Blackout" abbr="ABO" color={ABO} items={abo} P={P} />}
                    {lm.length > 0 && <ModalGroup label="Program Strategis" abbr="PS" color={PS} items={lm} P={P} />}
                </div>
                <div style={{ padding: "14px 32px", borderTop: `1px solid ${P.line}`, fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: P.faint }}>
                    Program belum memiliki target periode ini — tidak dihitung dalam progress.
                </div>
            </motion.div>
        </motion.div>
    );
}

function ModalGroup({ label, abbr, color, items, P }: { label: string; abbr: string; color: string; items: ProgramItem[]; P: Palette }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color, background: `color-mix(in oklab, ${color} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`, padding: "3px 9px", borderRadius: 5, lineHeight: 1.25 }}>{abbr}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: P.strong }}>{label}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: P.faint, fontFeatureSettings: TNUM }}>{items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {items.map((it, i) => (
                    <div key={`${it.no || i}-${it.namaProgram}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, color: P.text, lineHeight: 1.45 }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 8 }} />
                        <span>{it.namaProgram}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SlideMsg({ bg, color, text }: { bg: string; color: string; text: string }) {
    return (
        <section className="slide" style={{ background: bg, alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontFamily: SANS, color, fontSize: 22 }}>{text}</p>
        </section>
    );
}
