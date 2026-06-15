"use client";

/**
 * Slide Proteksi (page 6) — deep-dive bidang, theme-aware.
 * Visual SYSTEM identik slide Transmisi & Gardu Induk (mono, glow, donut, bar pill) — KONSISTEN deck.
 *   FLAT (tanpa card). Strip: Progress Proteksi · ULTG Bogor · ULTG Sukabumi (donut, clickable filter).
 *   Body: 3 blok kategori (ABO · 4DX · Keandalan), tiap blok header + daftar program (column-flow).
 *   Program tanpa target → 1 tombol → modal (Proteksi: semua bertarget, tombol tidak muncul).
 *   Backdrop: foto SPESIFIK bidang Proteksi (/backgrounds/{tone}/proteksi.png).
 *
 * Data: snapshot Supabase pk_proteksi_summary/detail (deck-snapshot.ts).
 *   21 program (ABO 7 · 4DX 3 · Keandalan 11). Per-ULTG dari detail per-bay.
 *   NOTE: komponen visual masih duplikat dgn Transmisi/GI — rencana extract ke kit setelah stabil.
 */

import { useMemo, useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useTheme } from "next-themes";
import { X } from "lucide-react";
import { useDeckProteksi } from "../_data/deck-snapshot";
import { fmtNum, getISOWeek } from "../_components/SlideShared";

const SANS = "var(--font-sans, -apple-system, sans-serif)";
const MONO = "var(--font-mono, monospace)";
const TNUM = '"tnum"';
const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

/* Identitas: bidang Proteksi (teal) untuk kicker. Strip = scope universal. Kategori = semantic. */
const PR = "#2DD4A7";
const TOTAL = "#FB923C";
const BOGOR = "#3D7FFF";
const SUKABUMI = "#2DD4A7";
const CAT_COLOR: Record<string, string> = { abo: "#3D7FFF", "4dx": "#f3c14b", keandalan: "#a78bfa" };
const CAT_NAME: Record<string, string> = { abo: "Anti Blackout", "4dx": "4DX", keandalan: "Keandalan" };
const CAT_ABBR: Record<string, string> = { abo: "ABO", "4dx": "4DX", keandalan: "ANDL" };
const CAT_ORDER = ["abo", "4dx", "keandalan"] as const;

type Scope = "bogor" | "sukabumi" | null;
interface Val { t: number; r: number }
interface ProgVal { name: string; t: number; r: number }
interface Brk { abbr: string; color: string; count: number }

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

export function ProteksiSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const pr = useDeckProteksi();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const light = mounted && resolvedTheme === "light";
    const P = palette(light);
    const [showNoTarget, setShowNoTarget] = useState(false);
    const [activeUltg, setActiveUltg] = useState<Scope>(null);
    const toggleUltg = (k: "bogor" | "sukabumi") => setActiveUltg((cur) => (cur === k ? null : k));

    const m = useMemo(() => {
        const progs = pr.summary.map((s) => {
            const det = pr.detail.filter((d) => d.program === s.program && d.grp === s.grp);
            const bg = det.filter((d) => d.ultg === "BOGOR");
            const sk = det.filter((d) => d.ultg === "SUKABUMI");
            return {
                program: s.program, grp: s.grp,
                upt: { t: s.total, r: s.selesai } as Val,
                bogor: { t: bg.length, r: bg.filter((d) => d.isSelesai).length } as Val,
                sukabumi: { t: sk.length, r: sk.filter((d) => d.isSelesai).length } as Val,
            };
        });
        const valOf = (p2: typeof progs[number]): Val => (activeUltg === "bogor" ? p2.bogor : activeUltg === "sukabumi" ? p2.sukabumi : p2.upt);
        const cntByCat = (scope: "upt" | "bogor" | "sukabumi"): Brk[] =>
            CAT_ORDER.map((key) => ({ abbr: CAT_ABBR[key], color: CAT_COLOR[key], count: progs.filter((p2) => p2.grp === key && p2[scope].t > 0).length }));

        const categories = CAT_ORDER.map((key) => {
            const rows = progs.filter((p2) => p2.grp === key);
            const programs: ProgVal[] = rows.filter((p2) => valOf(p2).t > 0).map((p2) => ({ name: p2.program, ...valOf(p2) })).sort((a, b) => pctOf(b.t, b.r) - pctOf(a.t, a.r));
            const agg = rows.reduce((s, p2) => { const v = valOf(p2); return { t: s.t + v.t, r: s.r + v.r }; }, { t: 0, r: 0 } as Val);
            return { key, abbr: CAT_ABBR[key], name: CAT_NAME[key], color: CAT_COLOR[key], programs, agg };
        });
        const noTarget = CAT_ORDER.map((key) => ({
            key, abbr: CAT_ABBR[key], color: CAT_COLOR[key],
            items: progs.filter((p2) => p2.grp === key && valOf(p2).t === 0).map((p2) => p2.program),
        })).filter((g) => g.items.length > 0);
        const noTargetCount = noTarget.reduce((s, g) => s + g.items.length, 0);

        return {
            grand: { t: pr.totals.total, r: pr.totals.selesai } as Val,
            bogor: { t: pr.ultg.bogor.target, r: pr.ultg.bogor.real } as Val,
            skbm: { t: pr.ultg.sukabumi.target, r: pr.ultg.sukabumi.real } as Val,
            brkGrand: cntByCat("upt"), brkBogor: cntByCat("bogor"), brkSkbm: cntByCat("sukabumi"),
            categories, noTarget, noTargetCount,
        };
    }, [pr.summary, pr.detail, pr.totals, pr.ultg, activeUltg]);

    if (pr.loading) return <SlideMsg bg={P.bg} color={P.muted} text="Memuat data Proteksi…" />;
    if (pr.error || pr.summary.length === 0) return <SlideMsg bg={P.bg} color={P.muted} text={pr.error || "Belum ada data Proteksi"} />;

    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);
    const tone = light ? "light" : "dark";
    const logoDan = light ? "/wap/logo-danantara.png" : "/wap/poster/assets/logo-danantara-w.png";
    const logoPln = light ? "/wap/logo-pln.png" : "/wap/poster/assets/logo-pln-w.png";
    const metaStr = `${String(slideNo).padStart(2, "0")}/${String(total).padStart(2, "0")} · Proteksi · ${dateStr} · Minggu ${week}`;

    const metrics = [
        { key: "total", label: "Progress Proteksi", color: TOTAL, color2: "#fdba74", v: m.grand, breakdown: m.brkGrand, onClick: undefined as (() => void) | undefined, active: false },
        { key: "bogor", label: "ULTG Bogor", color: BOGOR, color2: "#5b9aff", v: m.bogor, breakdown: m.brkBogor, onClick: () => toggleUltg("bogor"), active: activeUltg === "bogor" },
        { key: "sukabumi", label: "ULTG Sukabumi", color: SUKABUMI, color2: "#5be3c0", v: m.skbm, breakdown: m.brkSkbm, onClick: () => toggleUltg("sukabumi"), active: activeUltg === "sukabumi" },
    ];

    return (
        <section className="slide" style={{
            background: P.bg, color: P.text, boxSizing: "border-box", padding: "64px 100px 48px",
            fontFamily: SANS, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: `url(/backgrounds/${tone}/proteksi.png) center / cover no-repeat`, opacity: P.photo }} />
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: P.scrim }} />

            {/* Header */}
            <motion.div {...fadeUp} transition={{ duration: 0.45, ease: EASE }} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 3 }}>
                    <span style={{ width: 30, height: 2, background: PR, display: "block" }} />
                    <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.26em", textTransform: "uppercase", color: P.muted }}>Field Detail · Proteksi</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDan} alt="Danantara" style={{ height: 28, objectFit: "contain" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPln} alt="PLN" style={{ height: 42, objectFit: "contain" }} />
                </div>
            </motion.div>

            {/* Judul + tombol Tanpa Target */}
            <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.5, ease: EASE }} style={{ margin: "26px 0 0", position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
                <h2 style={{ fontSize: 50, fontWeight: 600, letterSpacing: "-0.03em", color: P.strong, margin: 0, lineHeight: 1 }}>Program Kerja Proteksi</h2>
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

            {/* Body */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 24, position: "relative", zIndex: 1, paddingTop: 12 }}>
                {/* KPI strip */}
                <motion.div {...fadeUp} transition={{ delay: 0.2, duration: 0.4, ease: EASE }} style={{ display: "flex", alignItems: "stretch" }}>
                    {metrics.map((mt, i) => (
                        <Fragment key={mt.key}>
                            <TopMetric label={mt.label} color={mt.color} color2={mt.color2} v={mt.v} breakdown={mt.breakdown} onClick={mt.onClick} active={mt.active} padLeft={i === 0 ? 0 : 30} padRight={i === metrics.length - 1 ? 0 : 30} P={P} light={light} delay={0.16 + i * 0.05} />
                            {i < metrics.length - 1 && (
                                <div style={{ width: 1, alignSelf: "stretch", margin: "6px 0", background: `linear-gradient(180deg, transparent 1%, ${P.line2} 8%, ${P.line2} 92%, transparent 99%)` }} />
                            )}
                        </Fragment>
                    ))}
                </motion.div>

                {/* Blok kategori (ABO · 4DX · Keandalan) — distribusi vertikal */}
                <motion.div {...fadeUp} transition={{ delay: 0.3, duration: 0.4, ease: EASE }} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: `1px solid ${P.line2}`, paddingTop: 18, overflow: "hidden" }}>
                    {m.categories.map((c, i) => (
                        <CategoryBlock key={c.key} abbr={c.abbr} name={c.name} agg={c.agg} programs={c.programs} color={c.color} cols={Math.min(3, Math.max(2, Math.ceil(c.programs.length / 5)))} P={P} light={light} delay={0.36 + i * 0.06} />
                    ))}
                </motion.div>
            </div>

            {/* Footer */}
            <motion.div {...fadeUp} transition={{ delay: 0.46, duration: 0.4, ease: EASE }} style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${P.line}`, paddingTop: 16, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.muted, fontFeatureSettings: TNUM }}>{metaStr}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.faint, flexShrink: 0 }}>Program Kerja UPT Bogor · 2026</span>
            </motion.div>

            <AnimatePresence>
                {showNoTarget && (
                    <NoTargetModal groups={m.noTarget} count={m.noTargetCount} scopeLabel={activeUltg === "bogor" ? "ULTG Bogor" : activeUltg === "sukabumi" ? "ULTG Sukabumi" : null} accent={PR} P={P} onClose={() => setShowNoTarget(false)} />
                )}
            </AnimatePresence>
        </section>
    );
}

/* ─────────── Donut ring visual % ─────────── */
function MiniDonut({ pct, color, color2, size, P }: { pct: number; color: string; color2: string; size: number; P: Palette }) {
    const ringW = 10;
    const r = (size - ringW) / 2 - 3;
    const cxy = size / 2;
    const circ = 2 * Math.PI * r;
    const p = clamp(pct);
    const offset = circ * (1 - p / 100);
    const gid = `prDonutGrad-${color.replace("#", "")}`;
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

/* ─────────── KPI strip cell — donut + hierarki teks; ULTG clickable filter ─────────── */
function TopMetric({ label, color, color2, v, breakdown, onClick, active, padLeft, padRight, P, light, delay }: {
    label: string; color: string; color2: string; v: Val; breakdown: Brk[]; onClick?: () => void; active?: boolean; padLeft: number; padRight: number; P: Palette; light: boolean; delay: number;
}) {
    const p = pctOf(v.t, v.r);
    const interactive = !!onClick;
    const totalProg = breakdown.reduce((s, b) => s + b.count, 0);
    const [hovered, setHovered] = useState(false);
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
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <MiniDonut pct={p} color={color} color2={color2} size={114} P={P} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 12px ${color}88`, flexShrink: 0 }} />
                        <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, letterSpacing: "0.09em", color: P.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                        <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 600, color: P.strong, lineHeight: 1, letterSpacing: "-0.025em", fontFeatureSettings: TNUM }}>{totalProg}</span>
                        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: P.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Program</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontFeatureSettings: TNUM, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
                        <span style={{ fontSize: 17, fontWeight: 600, color: P.text }}>{fmtNum(v.r)} / {fmtNum(v.t)}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: P.faint, marginLeft: 6 }}>item</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11.5, color: P.faint, fontFeatureSettings: TNUM, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                        {breakdown.map((b, i) => (
                            <Fragment key={b.abbr}>
                                {i > 0 && <span style={{ margin: "0 6px", color: P.faint }}>·</span>}
                                <span style={{ color: b.color, fontWeight: 700 }}>{b.abbr}</span> {b.count}
                            </Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/* ─────────── Blok kategori — header (chip · nama · % · caption) + daftar program ─────────── */
function CategoryBlock({ abbr, name, agg, programs, color, cols, P, light, delay }: {
    abbr: string; name: string; agg: Val; programs: ProgVal[]; color: string; cols: number; P: Palette; light: boolean; delay: number;
}) {
    const p = pctOf(agg.t, agg.r);
    const rows = Math.max(1, Math.ceil(programs.length / cols));
    const wide = cols <= 2;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", color, background: `color-mix(in oklab, ${color} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`, padding: "4px 9px", borderRadius: 6, lineHeight: 1.2, flexShrink: 0 }}>{abbr}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: P.strong, whiteSpace: "nowrap" }}>{name}</span>
                <span style={{ fontFamily: MONO, fontSize: 25, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, whiteSpace: "nowrap", paddingLeft: 4 }}>{pct1(p)}%</span>
                <span style={{ width: 1, height: 15, background: P.line2, flexShrink: 0 }} />
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: P.faint, fontFeatureSettings: TNUM, whiteSpace: "nowrap" }}>{programs.length} program · {fmtNum(agg.r)} / {fmtNum(agg.t)} item</span>
            </div>
            <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, auto)`, columnGap: cols >= 3 ? 34 : 52, rowGap: 0, alignContent: "start" }}>
                {programs.map((pv, i) => (
                    <ProgramRow key={`${pv.name}-${i}`} name={pv.name} t={pv.t} r={pv.r} wide={wide} P={P} light={light} delay={delay + 0.12 + Math.min(i, 10) * 0.012} />
                ))}
            </div>
        </div>
    );
}

/* ─────────── Baris program — nama + (selesai/total) + % ─────────── */
function ProgramRow({ name, t, r, wide, P, light, delay }: { name: string; t: number; r: number; wide?: boolean; P: Palette; light: boolean; delay: number }) {
    const p = pctOf(t, r);
    const fs = wide
        ? (name.length > 92 ? 13 : name.length > 74 ? 14 : 15.5)
        : (name.length > 76 ? 10 : name.length > 60 ? 11.5 : name.length > 46 ? 12.5 : name.length > 36 ? 13.5 : 14.5);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.22, ease: "easeOut" }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${P.line}` }}>
            <span style={{ fontSize: fs, color: P.name, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{name}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexShrink: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: P.meta, fontFeatureSettings: TNUM, minWidth: 54, textAlign: "right" }}>{fmtNum(r)}/{fmtNum(t)}</span>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, minWidth: 48, textAlign: "right" }}>{pct1(p)}%</span>
            </div>
        </motion.div>
    );
}

/* ─────────── Modal: program tanpa target ─────────── */
function NoTargetModal({ groups, count, scopeLabel, accent, P, onClose }: {
    groups: { key: string; abbr: string; color: string; items: string[] }[]; count: number; scopeLabel: string | null; accent: string; P: Palette; onClose: () => void;
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
                        <span style={{ width: 30, height: 2, background: accent }} />
                        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: P.muted }}>Program Tanpa Target{scopeLabel ? ` · ${scopeLabel}` : ""}</span>
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: P.strong, fontFeatureSettings: TNUM }}>{count}</span>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Tutup" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, cursor: "pointer", color: P.muted, background: P.track, border: `1px solid ${P.line2}` }}>
                        <X size={18} />
                    </button>
                </div>
                <div style={{ padding: "24px 32px 28px", overflow: "auto", display: "grid", gridTemplateColumns: groups.length > 1 ? "1fr 1fr" : "1fr", gap: 36 }}>
                    {groups.map((g) => (
                        <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: g.color, background: `color-mix(in oklab, ${g.color} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${g.color} 32%, transparent)`, padding: "3px 9px", borderRadius: 5, lineHeight: 1.25 }}>{g.abbr}</span>
                                <span style={{ fontFamily: MONO, fontSize: 12, color: P.faint, fontFeatureSettings: TNUM }}>{g.items.length}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                {g.items.map((it, i) => (
                                    <div key={`${it}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, color: P.text, lineHeight: 1.45 }}>
                                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: g.color, flexShrink: 0, marginTop: 8 }} />
                                        <span>{it}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ padding: "14px 32px", borderTop: `1px solid ${P.line}`, fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: P.faint }}>
                    Program belum memiliki target periode ini — tidak dihitung dalam progress.
                </div>
            </motion.div>
        </motion.div>
    );
}

function SlideMsg({ bg, color, text }: { bg: string; color: string; text: string }) {
    return (
        <section className="slide" style={{ background: bg, alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontFamily: SANS, color, fontSize: 22 }}>{text}</p>
        </section>
    );
}
