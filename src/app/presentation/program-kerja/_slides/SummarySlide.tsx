"use client";

/**
 * Slide Ringkasan Eksekutif (page 2) — SUMMARY (theme-aware).
 * Visual SYSTEM: bahasa Vercel/Geist (mono, glow, SVG donut, LED bar).
 *
 * Layout:
 *   Atas  : 3 donut SVG (arc rounded-cap + gradient + draw) — Total · ULTG Bogor · ULTG Sukabumi.
 *   Bawah : 3 kolom bidang — header (% + jumlah program) + daftar KATEGORI program
 *           (ABO, Program Strategis, IL2, 4DX, Keandalan, …) + LED bar + caption.
 *   Hierarki: Total/ULTG (donut) → Bidang → Kategori program.
 *
 * Theme-aware: palet `P` (dark pure-black / light bg terang) via useTheme.
 *   Accent identitas tetap; nilai % pakai KONDISI (varian gelap di light).
 *
 * Data: snapshot Supabase (deck-snapshot.ts). 100% data-driven, zero hardcode angka.
 */

import { useMemo, useEffect, useState, Fragment } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useTheme } from "next-themes";
import { useDeckTransmisi, useDeckProteksi, useDeckGarduInduk } from "../_data/deck-snapshot";
import { fmtNum, getISOWeek } from "../_components/SlideShared";

const SANS = "var(--font-sans, -apple-system, sans-serif)";
const MONO = "var(--font-mono, monospace)";
const TNUM = '"tnum"';
const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

type Palette = {
    bg: string; strong: string; name: string; text: string; muted: string; meta: string; faint: string;
    track: string; line: string; line2: string; condNeutral: string; photo: number; scrim: string; glass: string; panelShadow: string; panelBorder: string;
};
function palette(light: boolean): Palette {
    return light ? {
        bg: "#eef1f6", strong: "#0f172a", name: "#1e2733", text: "#283543", muted: "#3f4d5c", meta: "#52606f", faint: "#6b7785",
        track: "rgba(15,23,42,0.10)", line: "rgba(15,23,42,0.11)", line2: "rgba(15,23,42,0.16)", condNeutral: "#0f172a",
        photo: 0.32, scrim: "linear-gradient(180deg, rgba(238,241,246,0.58) 0%, rgba(238,241,246,0.42) 50%, rgba(238,241,246,0.6) 100%)",
        glass: "linear-gradient(160deg, rgba(249,251,253,0.42) 0%, rgba(238,242,247,0.64) 100%)", panelShadow: "0 24px 60px rgba(15,23,42,0.16)", panelBorder: "rgba(15,23,42,0.10)",
    } : {
        bg: "#000", strong: "#fafafa", name: "#f4f4f4", text: "#e8e8e8", muted: "#c4c4c4", meta: "#b0b0b0", faint: "#9a9a9a",
        track: "rgba(255,255,255,0.08)", line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.14)", condNeutral: "#fafafa",
        photo: 0.6, scrim: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.34) 50%, rgba(0,0,0,0.52) 100%)",
        glass: "linear-gradient(160deg, rgba(13,16,22,0.30) 0%, rgba(6,8,12,0.56) 100%)", panelShadow: "0 28px 70px rgba(0,0,0,0.5)", panelBorder: "rgba(255,255,255,0.10)",
    };
}

interface Cell { t: number; r: number }
interface Cat { name: string; abbr: string; total: number; selesai: number; count: number }

/* Meta kategori: chip (singkatan) + nama lengkap. Key = label dari data. */
const CAT_META: Record<string, { abbr: string; name: string }> = {
    "ABO": { abbr: "ABO", name: "Anti Blackout" },
    "PS": { abbr: "PS", name: "Program Strategis" },
    "IL2": { abbr: "IL2", name: "Inspeksi Level 2" },
    "4DX": { abbr: "4DX", name: "4DX" },
    "Keandalan": { abbr: "ANDL", name: "Keandalan" },
};
const catMeta = (label: string) => CAT_META[label] ?? { abbr: label, name: label };
const cell = (t: number, r: number): Cell => ({ t, r });
const add = (...cs: Cell[]): Cell => cs.reduce((a, c) => ({ t: a.t + c.t, r: a.r + c.r }), { t: 0, r: 0 });
const pctOf = (c: { t: number; r: number }) => (c.t > 0 ? (c.r / c.t) * 100 : 0);
const pct1 = (p: number) => p.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function condColor(p: number, light: boolean, neutral: string): string {
    if (p >= 60) return light ? "#0a9d6e" : "#00E599"; // hijau
    if (p < 40) return light ? "#c2710c" : "#F5A623";  // amber
    return neutral;
}

const SCOPE = {
    total: { c: "#FB923C", c2: "#fdba74", glow: "rgba(251,146,60,0.5)", dot: "rgba(251,146,60,0.9)", label: "Total Progress" },
    bogor: { c: "#3D7FFF", c2: "#5b9aff", glow: "rgba(61,127,255,0.5)", dot: "rgba(61,127,255,0.9)", label: "ULTG Bogor" },
    sukabumi: { c: "#2DD4A7", c2: "#5be3c0", glow: "rgba(45,212,167,0.5)", dot: "rgba(45,212,167,0.9)", label: "ULTG Sukabumi" },
} as const;

const BIDANG_C: Record<string, { c: string; glow: string }> = {
    "Transmisi": { c: "#FB923C", glow: "rgba(251,146,60,0.45)" },
    "Gardu Induk": { c: "#3D7FFF", glow: "rgba(61,127,255,0.45)" },
    "Proteksi": { c: "#2DD4A7", glow: "rgba(45,212,167,0.45)" },
};

const BIDANG = ["Transmisi", "Gardu Induk", "Proteksi"] as const;

export function SummarySlide({ slideNo, total }: { slideNo: number; total: number }) {
    const tx = useDeckTransmisi();
    const pr = useDeckProteksi();
    const gi = useDeckGarduInduk();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const light = mounted && resolvedTheme === "light";
    const P = palette(light);

    const loading = tx.loading || pr.loading || gi.loading;

    const model = useMemo(() => {
        const txAgg = tx.items.reduce(
            (a, it) => ({
                upt: add(a.upt, cell(it.totalTarget, it.totalRealisasi)),
                bogor: add(a.bogor, cell(it.targetBogor, it.realisasiBogor)),
                sukabumi: add(a.sukabumi, cell(it.targetSukabumi, it.realisasiSukabumi)),
            }),
            { upt: cell(0, 0), bogor: cell(0, 0), sukabumi: cell(0, 0) },
        );
        const giB = { upt: cell(gi.totals.total, gi.totals.selesai), bogor: cell(gi.ultg.bogor.target, gi.ultg.bogor.real), sukabumi: cell(gi.ultg.sukabumi.target, gi.ultg.sukabumi.real) };
        const prB = { upt: cell(pr.totals.total, pr.totals.selesai), bogor: cell(pr.ultg.bogor.target, pr.ultg.bogor.real), sukabumi: cell(pr.ultg.sukabumi.target, pr.ultg.sukabumi.real) };
        const head = { upt: add(txAgg.upt, giB.upt, prB.upt), bogor: add(txAgg.bogor, giB.bogor, prB.bogor), sukabumi: add(txAgg.sukabumi, giB.sukabumi, prB.sukabumi) };

        const txCat = (key: "abo" | "lm", label: string): Cat => {
            const items = tx.items.filter((it) => it.programKerja === key);
            const m = catMeta(label);
            return { name: m.name, abbr: m.abbr, total: items.reduce((s, it) => s + it.totalTarget, 0), selesai: items.reduce((s, it) => s + it.totalRealisasi, 0), count: items.filter((it) => it.totalTarget > 0).length };
        };
        const aboFirst = (cats: Cat[]) => [...cats.filter((c) => c.abbr === "ABO"), ...cats.filter((c) => c.abbr !== "ABO")];
        const txCats = aboFirst([txCat("abo", "ABO"), txCat("lm", "PS")].filter((c) => c.count > 0));
        const giCats = aboFirst(gi.grpAgg.map((g) => { const m = catMeta(g.name); return { name: m.name, abbr: m.abbr, total: g.total, selesai: g.selesai, count: gi.summary.filter((s) => s.grp === g.key).length }; }).filter((c) => c.count > 0));
        const prCats = aboFirst(pr.grpAgg.map((g) => { const m = catMeta(g.name); return { name: m.name, abbr: m.abbr, total: g.total, selesai: g.selesai, count: pr.summary.filter((s) => s.grp === g.key).length }; }).filter((c) => c.count > 0));

        const bidang = {
            "Transmisi": { total: txAgg.upt, cats: txCats },
            "Gardu Induk": { total: giB.upt, cats: giCats },
            "Proteksi": { total: prB.upt, cats: prCats },
        } as Record<string, { total: Cell; cats: Cat[] }>;
        const totalProg = [...txCats, ...giCats, ...prCats].reduce((s, c) => s + c.count, 0);
        return { head, bidang, totalProg };
    }, [tx.items, gi.totals, gi.ultg, gi.grpAgg, gi.summary, pr.totals, pr.ultg, pr.grpAgg, pr.summary]);

    if (loading) {
        return (
            <section className="slide" style={{ background: P.bg, alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontFamily: SANS, color: P.muted, fontSize: 22 }}>Memuat data…</p>
            </section>
        );
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);
    const tone = light ? "light" : "dark";
    const logoDan = light ? "/wap/logo-danantara.png" : "/wap/poster/assets/logo-danantara-w.png";
    const logoPln = light ? "/wap/logo-pln.png" : "/wap/poster/assets/logo-pln-w.png";
    const metaStr = `${String(slideNo).padStart(2, "0")}/${String(total).padStart(2, "0")} · Summary · ${dateStr} · Minggu ${week}`;
    const { head, bidang, totalProg } = model;

    const donuts = [
        { ...SCOPE.total, cell: head.upt, big: true, sub: `${fmtNum(head.upt.r)} / ${fmtNum(head.upt.t)} item · ${totalProg} program` },
        { ...SCOPE.bogor, cell: head.bogor, big: true, sub: `${fmtNum(head.bogor.r)} / ${fmtNum(head.bogor.t)} item` },
        { ...SCOPE.sukabumi, cell: head.sukabumi, big: true, sub: `${fmtNum(head.sukabumi.r)} / ${fmtNum(head.sukabumi.t)} item` },
    ];

    return (
        <section className="slide" style={{
            background: P.bg, color: P.text, boxSizing: "border-box", padding: "70px 100px 50px",
            fontFamily: SANS, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        }}>
            {/* Backdrop foto gabungan 3 bidang (theme-aware) + scrim */}
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: `url(/backgrounds/${tone}/combined.png) center / cover no-repeat`, opacity: P.photo }} />
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: P.scrim }} />

            {/* Eyebrow + meta */}
            <motion.div {...fadeUp} transition={{ duration: 0.45, ease: EASE }} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 3 }}>
                    <span style={{ width: 30, height: 2, background: "#00E599", display: "block" }} />
                    <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.26em", textTransform: "uppercase", color: P.muted }}>Executive Summary</span>
                </div>
                {/* Logo Danantara + PLN (theme-aware) */}
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDan} alt="Danantara" style={{ height: 28, objectFit: "contain" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPln} alt="PLN" style={{ height: 42, objectFit: "contain" }} />
                </div>
            </motion.div>

            {/* Judul */}
            <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.5, ease: EASE }} style={{ margin: "26px 0 0", position: "relative", zIndex: 1 }}>
                <h2 style={{ fontSize: 50, fontWeight: 600, letterSpacing: "-0.03em", color: P.strong, margin: 0, lineHeight: 1 }}>Ringkasan Progress Program Kerja</h2>
            </motion.div>

            {/* Glass panel — data duduk di permukaan bersih, foto jadi bingkai/atmosfer */}
            <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5, ease: EASE }}
                style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, marginTop: 22, display: "flex", flexDirection: "column", background: P.glass, backdropFilter: "blur(20px) saturate(1.1)", WebkitBackdropFilter: "blur(20px) saturate(1.1)", border: `1px solid ${P.panelBorder}`, borderRadius: 22, padding: "26px 40px 28px", boxShadow: `${P.panelShadow}, inset 0 1px 0 ${P.panelBorder}` }}
            >
                {/* Donut row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 40, margin: "2px 0" }}>
                    {donuts.map((d, i) => (
                        <Donut key={d.label} pct={pctOf(d.cell)} color={d.c} color2={d.c2} glow={d.glow} dot={d.dot} label={d.label} sub={d.sub} big={d.big} delay={0.2 + i * 0.1} P={P} />
                    ))}
                </div>

                {/* Line pemisah donut ↔ rincian bidang */}
                <div style={{ height: 1, background: P.line2, margin: "20px 0 2px" }} />

                {/* Bidang + kategori */}
                <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "stretch" }}>
                    {BIDANG.map((b, i) => (
                        <Fragment key={b}>
                            <BidangColumn name={b} acc={BIDANG_C[b]} info={bidang[b]} padLeft={i === 0 ? 0 : 46} padRight={i === BIDANG.length - 1 ? 0 : 46} delay={0.55 + i * 0.1} P={P} light={light} />
                            {i < BIDANG.length - 1 && (
                                <div style={{ width: 1, alignSelf: "stretch", background: `linear-gradient(180deg, transparent, ${P.line} 14%, ${P.line} 86%, transparent)` }} />
                            )}
                        </Fragment>
                    ))}
                </div>
            </motion.div>

            {/* Footer */}
            <motion.div {...fadeUp} transition={{ delay: 0.95, duration: 0.5, ease: EASE }} style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${P.line}`, paddingTop: 16, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.muted, fontFeatureSettings: TNUM }}>{metaStr}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.faint }}>Program Kerja UPT Bogor · 2026</span>
            </motion.div>
        </section>
    );
}

/* ─────────── Donut SVG (arc rounded-cap + gradient + draw + count-up) ─────────── */
function Donut({ pct, color, color2, glow, dot, label, sub, big, delay, P }: {
    pct: number; color: string; color2: string; glow: string; dot: string; label: string; sub: string; big?: boolean; delay: number; P: Palette;
}) {
    const size = big ? 206 : 172;
    const ringW = big ? 13 : 11;
    const r = (size - ringW) / 2 - 2;
    const cxy = size / 2;
    const circ = 2 * Math.PI * r;
    const p = Math.min(Math.max(pct, 0), 100);
    const offset = circ * (1 - p / 100);
    const gid = `dgrad-${label.replace(/[^a-z]/gi, "")}`;
    const numFs = big ? 52 : 44;

    const mv = useMotionValue(0);
    const numText = useTransform(mv, (v) => pct1(v));
    useEffect(() => {
        const controls = animate(mv, p, { duration: 1.1, delay: delay + 0.2, ease: EASE });
        return () => controls.stop();
    }, [mv, p, delay]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: EASE }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
        >
            <div style={{ position: "relative", width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", transform: "rotate(-90deg)" }}>
                    <defs>
                        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={color2} />
                            <stop offset="100%" stopColor={color} />
                        </linearGradient>
                    </defs>
                    <circle cx={cxy} cy={cxy} r={r} fill="none" stroke={P.track} strokeWidth={ringW} />
                    <motion.circle
                        cx={cxy} cy={cxy} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={ringW} strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ delay: delay + 0.2, duration: 1.1, ease: EASE }}
                    />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: MONO, fontSize: numFs, fontWeight: 600, color: P.strong, letterSpacing: "-0.03em", fontFeatureSettings: TNUM }}>
                        <motion.span>{numText}</motion.span><span style={{ fontSize: "0.4em", color, marginLeft: 1 }}>%</span>
                    </span>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
                    <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: P.strong }}>{label}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, color: P.muted, fontFeatureSettings: TNUM }}>{sub}</span>
            </div>
        </motion.div>
    );
}

/* ─────────── Kolom bidang + daftar kategori program ─────────── */
function BidangColumn({ name, acc, info, padLeft, padRight, delay, P, light }: {
    name: string; acc: { c: string; glow: string }; info: { total: Cell; cats: Cat[] }; padLeft: number; padRight: number; delay: number; P: Palette; light: boolean;
}) {
    const bp = pctOf(info.total);
    const progCount = info.cats.reduce((s, c) => s + c.count, 0);
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: EASE }}
            style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: `26px ${padRight}px 0 ${padLeft}px` }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: acc.c, boxShadow: `0 0 9px ${acc.glow}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 22, fontWeight: 600, color: P.strong, whiteSpace: "nowrap" }}>{name}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: condColor(bp, light, P.condNeutral), fontFeatureSettings: TNUM }}>{pct1(bp)}%</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12.5, color: P.meta, marginTop: 8, fontFeatureSettings: TNUM }}>
                {progCount} program · {fmtNum(info.total.r)} / {fmtNum(info.total.t)} item
            </div>

            <div style={{ height: 1, background: P.line, margin: "20px 0 0" }} />

            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 28, paddingTop: 4 }}>
                {info.cats.map((c, i) => (
                    <CatRow key={c.name} cat={c} acc={acc} delay={delay + 0.25 + i * 0.1} P={P} light={light} />
                ))}
            </div>
        </motion.div>
    );
}

/* ─────────── Baris kategori — nama + % + LED bar (tumbuh) + caption ─────────── */
function CatRow({ cat, acc, delay, P, light }: { cat: Cat; acc: { c: string; glow: string }; delay: number; P: Palette; light: boolean }) {
    const p = pctOf({ t: cat.total, r: cat.selesai });
    const w = Math.min(Math.max(p, 0), 100);
    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", color: acc.c, background: `color-mix(in oklab, ${acc.c} 18%, transparent)`, border: `1px solid color-mix(in oklab, ${acc.c} 34%, transparent)`, padding: "3px 8px", borderRadius: 6, flexShrink: 0, lineHeight: 1.3 }}>{cat.abbr}</span>
                    <span style={{ fontSize: 19, fontWeight: 400, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, flexShrink: 0 }}>{pct1(p)}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: P.track, overflow: "hidden" }}>
                <motion.div initial={{ width: "0%" }} animate={{ width: `${w}%` }} transition={{ delay, duration: 0.9, ease: EASE }} style={{ height: "100%", borderRadius: 99, background: acc.c }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: P.meta, marginTop: 10, fontFeatureSettings: TNUM }}>
                {cat.count} program · {fmtNum(cat.selesai)} / {fmtNum(cat.total)} item
            </div>
        </div>
    );
}
