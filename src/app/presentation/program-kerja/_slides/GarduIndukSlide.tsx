"use client";

/**
 * Slide Gardu Induk (page 5) — deep-dive bidang, theme-aware.
 * Visual SYSTEM identik slide Transmisi (mono, glow, donut, bar pill) — KONSISTEN deck.
 *   FLAT (tanpa card). Strip: Progress GI · ULTG Bogor · ULTG Sukabumi (donut, clickable filter).
 *   Body: 3 blok kategori (ABO · PS · IL2), tiap blok header + daftar program (column-flow).
 *   Program tanpa target → 1 tombol → modal.
 *   Backdrop: foto SPESIFIK bidang Gardu Induk (/backgrounds/{tone}/gardu-induk.png).
 *
 * Data: snapshot Supabase pk_gardu_induk_summary/detail (deck-snapshot.ts).
 *   36 program (ABO 5 · PS 20 · IL2 11). Per-ULTG dari detail per-bay.
 *   NOTE: komponen visual masih duplikat dgn TransmisiSlide — rencana extract ke kit setelah stabil.
 */

import { useMemo, useState, useEffect, Fragment } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useTheme } from "next-themes";
import { useDeckGarduInduk } from "../_data/deck-snapshot";
import { fmtNum, getISOWeek } from "../_components/SlideShared";

const SANS = "var(--font-sans, -apple-system, sans-serif)";
const MONO = "var(--font-mono, monospace)";
const TNUM = '"tnum"';
const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

/* Identitas: bidang GI (biru) untuk kicker. Strip = scope universal (total/bogor/sukabumi). Kategori = semantic. */
const GI = "#3D7FFF";
const TOTAL = "#FB923C";
const BOGOR = "#3D7FFF";
const SUKABUMI = "#2DD4A7";
const CAT_COLOR: Record<string, string> = { abo: "#3D7FFF", ps: "#f3c14b", il2: "#a78bfa" };
const CAT_NAME: Record<string, string> = { abo: "Anti Blackout", ps: "Program Strategis", il2: "Inspeksi Level 2" };
const CAT_ABBR: Record<string, string> = { abo: "ABO", ps: "PS", il2: "IL2" };
const CAT_ORDER = ["abo", "ps", "il2"] as const;

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

export function GarduIndukSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const gi = useDeckGarduInduk();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const light = mounted && resolvedTheme === "light";
    const P = palette(light);
    const [activeUltg, setActiveUltg] = useState<Scope>(null);
    const toggleUltg = (k: "bogor" | "sukabumi") => setActiveUltg((cur) => (cur === k ? null : k));

    const m = useMemo(() => {
        // Per-program + per-ULTG (dari detail per-bay).
        const progs = gi.summary.map((s) => {
            const det = gi.detail.filter((d) => d.program === s.program && d.grp === s.grp);
            const bg = det.filter((d) => d.ultg === "BOGOR");
            const sk = det.filter((d) => d.ultg === "SUKABUMI");
            return {
                program: s.program, grp: s.grp,
                upt: { t: s.total, r: s.selesai } as Val,
                bogor: { t: bg.length, r: bg.filter((d) => d.isSelesai).length } as Val,
                sukabumi: { t: sk.length, r: sk.filter((d) => d.isSelesai).length } as Val,
            };
        });
        const valOf = (pr: typeof progs[number]): Val => (activeUltg === "bogor" ? pr.bogor : activeUltg === "sukabumi" ? pr.sukabumi : pr.upt);
        const cntByCat = (scope: "upt" | "bogor" | "sukabumi"): Brk[] =>
            CAT_ORDER.map((key) => ({ abbr: CAT_ABBR[key], color: CAT_COLOR[key], count: progs.filter((pr) => pr.grp === key && pr[scope].t > 0).length }));

        const categories = CAT_ORDER.map((key) => {
            const rows = progs.filter((pr) => pr.grp === key);
            const programs: ProgVal[] = rows.filter((pr) => valOf(pr).t > 0).map((pr) => ({ name: pr.program, ...valOf(pr) })).sort((a, b) => pctOf(b.t, b.r) - pctOf(a.t, a.r));
            const agg = rows.reduce((s, pr) => { const v = valOf(pr); return { t: s.t + v.t, r: s.r + v.r }; }, { t: 0, r: 0 } as Val);
            return { key, abbr: CAT_ABBR[key], name: CAT_NAME[key], color: CAT_COLOR[key], programs, agg };
        });
        return {
            grand: { t: gi.totals.total, r: gi.totals.selesai } as Val,
            bogor: { t: gi.ultg.bogor.target, r: gi.ultg.bogor.real } as Val,
            skbm: { t: gi.ultg.sukabumi.target, r: gi.ultg.sukabumi.real } as Val,
            brkGrand: cntByCat("upt"), brkBogor: cntByCat("bogor"), brkSkbm: cntByCat("sukabumi"),
            categories,
        };
    }, [gi.summary, gi.detail, gi.totals, gi.ultg, activeUltg]);

    if (gi.loading) return <SlideMsg bg={P.bg} color={P.muted} text="Memuat data Gardu Induk…" />;
    if (gi.error || gi.summary.length === 0) return <SlideMsg bg={P.bg} color={P.muted} text={gi.error || "Belum ada data Gardu Induk"} />;

    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);
    const tone = light ? "light" : "dark";
    const logoDan = light ? "/wap/logo-danantara.png" : "/wap/poster/assets/logo-danantara-w.png";
    const logoPln = light ? "/wap/logo-pln.png" : "/wap/poster/assets/logo-pln-w.png";
    const metaStr = `${String(slideNo).padStart(2, "0")}/${String(total).padStart(2, "0")} · Gardu Induk · ${dateStr} · Minggu ${week}`;

    const metrics = [
        { key: "total", label: "Progress Gardu Induk", color: TOTAL, color2: "#fdba74", v: m.grand, breakdown: m.brkGrand, onClick: undefined as (() => void) | undefined, active: false },
        { key: "bogor", label: "ULTG Bogor", color: BOGOR, color2: "#5b9aff", v: m.bogor, breakdown: m.brkBogor, onClick: () => toggleUltg("bogor"), active: activeUltg === "bogor" },
        { key: "sukabumi", label: "ULTG Sukabumi", color: SUKABUMI, color2: "#5be3c0", v: m.skbm, breakdown: m.brkSkbm, onClick: () => toggleUltg("sukabumi"), active: activeUltg === "sukabumi" },
    ];

    return (
        <section className="slide" style={{
            background: P.bg, color: P.text, boxSizing: "border-box", padding: "64px 100px 48px",
            fontFamily: SANS, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: `url(/backgrounds/${tone}/gardu-induk.png) center / cover no-repeat`, opacity: P.photo }} />
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: P.scrim }} />

            {/* Header */}
            <motion.div {...fadeUp} transition={{ duration: 0.45, ease: EASE }} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 3 }}>
                    <span style={{ width: 30, height: 2, background: GI, display: "block" }} />
                    <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.26em", textTransform: "uppercase", color: P.muted }}>Field Detail · Gardu Induk</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDan} alt="Danantara" style={{ height: 28, objectFit: "contain" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPln} alt="PLN" style={{ height: 42, objectFit: "contain" }} />
                </div>
            </motion.div>

            {/* Judul */}
            <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.5, ease: EASE }} style={{ margin: "26px 0 0", position: "relative", zIndex: 1 }}>
                <h2 style={{ fontSize: 50, fontWeight: 600, letterSpacing: "-0.03em", color: P.strong, margin: 0, lineHeight: 1 }}>Program Kerja Gardu Induk</h2>
            </motion.div>

            {/* Hairline */}
            <motion.div initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.25, duration: 0.6, ease: EASE }} style={{ height: 1, transformOrigin: "left", background: `linear-gradient(90deg, ${P.line2}, ${P.line} 70%, transparent)`, margin: "22px 0 0", position: "relative", zIndex: 1 }} />

            {/* Body */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 18, position: "relative", zIndex: 1, paddingTop: 10 }}>
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

                {/* Blok kategori (ABO · PS · IL2) — distribusi vertikal */}
                <motion.div {...fadeUp} transition={{ delay: 0.3, duration: 0.4, ease: EASE }} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: `1px solid ${P.line2}`, paddingTop: 12, overflow: "hidden" }}>
                    {m.categories.map((c, i) => (
                        // cols di-cap 3 (kolom lebar ~550px) biar nama panjang ga kepotong; min 2 biar ga sparse.
                        <CategoryBlock key={c.key} abbr={c.abbr} name={c.name} agg={c.agg} programs={c.programs} color={c.color} cols={Math.min(3, Math.max(2, Math.ceil(c.programs.length / 5)))} P={P} light={light} delay={0.36 + i * 0.06} />
                    ))}
                </motion.div>
            </div>

            {/* Footer */}
            <motion.div {...fadeUp} transition={{ delay: 0.46, duration: 0.4, ease: EASE }} style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${P.line}`, paddingTop: 16, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.muted, fontFeatureSettings: TNUM }}>{metaStr}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.faint, flexShrink: 0 }}>Program Kerja UPT Bogor · 2026</span>
            </motion.div>
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
    const gid = `giDonutGrad-${color.replace("#", "")}`;
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", color, background: `color-mix(in oklab, ${color} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`, padding: "4px 9px", borderRadius: 6, lineHeight: 1.2, flexShrink: 0 }}>{abbr}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: P.strong, whiteSpace: "nowrap" }}>{name}</span>
                <span style={{ fontFamily: MONO, fontSize: 25, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, whiteSpace: "nowrap", paddingLeft: 4 }}>{pct1(p)}%</span>
                <span style={{ width: 1, height: 15, background: P.line2, flexShrink: 0 }} />
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: P.faint, fontFeatureSettings: TNUM, whiteSpace: "nowrap" }}>{programs.length} program · {fmtNum(agg.r)} / {fmtNum(agg.t)} item</span>
            </div>
            <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, auto)`, columnGap: cols >= 3 ? 34 : 52, rowGap: 0, alignContent: "start" }}>
                {programs.map((pr, i) => (
                    <ProgramRow key={`${pr.name}-${i}`} name={pr.name} t={pr.t} r={pr.r} wide={wide} P={P} light={light} delay={delay + 0.12 + Math.min(i, 10) * 0.012} />
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
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "4px 0", borderBottom: `1px solid ${P.line}` }}>
            <span style={{ fontSize: fs, color: P.name, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{name}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexShrink: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: P.meta, fontFeatureSettings: TNUM, minWidth: 54, textAlign: "right" }}>{fmtNum(r)}/{fmtNum(t)}</span>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, minWidth: 48, textAlign: "right" }}>{pct1(p)}%</span>
            </div>
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
