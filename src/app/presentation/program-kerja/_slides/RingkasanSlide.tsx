"use client";

/**
 * Slide Progress per ULTG (page 3) — theme-aware.
 * Visual SYSTEM: bahasa Vercel/Geist (mono, glow, bar pill). Tanpa card, full-page.
 *   3 kolom (Total Progress · ULTG Bogor · ULTG Sukabumi) + divider gradien.
 *   Hierarki: ULTG (scope) → Bidang → KATEGORI program (ABO/PS/IL2/4DX/Keandalan).
 *   Tiap bidang dipecah per kategori, dihitung per-ULTG sesuai kolomnya.
 *
 * Theme-aware: palet `P` (dark pure-black / light bg terang) via useTheme.
 *   Identitas kolom (dot+bar) + bidang (marker+chip+bar) accent tetap; nilai % = KONDISI.
 *
 * Data: snapshot Supabase (deck-snapshot.ts). 100% data-driven, zero hardcode angka.
 */

import { useMemo, useState, useEffect, Fragment } from "react";
import { motion } from "framer-motion";
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
    track: string; line: string; line2: string; condNeutral: string; photo: number; scrim: string;
};
function palette(light: boolean): Palette {
    return light ? {
        bg: "#eef1f6", strong: "#0f172a", name: "#1e2733", text: "#283543", muted: "#3f4d5c", meta: "#52606f", faint: "#6b7785",
        track: "rgba(15,23,42,0.10)", line: "rgba(15,23,42,0.11)", line2: "rgba(15,23,42,0.16)", condNeutral: "#0f172a",
        photo: 0.16, scrim: "linear-gradient(180deg, rgba(238,241,246,0.86) 0%, rgba(238,241,246,0.7) 44%, rgba(238,241,246,0.84) 100%)",
    } : {
        bg: "#000", strong: "#fafafa", name: "#f4f4f4", text: "#e8e8e8", muted: "#c4c4c4", meta: "#b0b0b0", faint: "#9a9a9a",
        track: "rgba(255,255,255,0.08)", line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.14)", condNeutral: "#fafafa",
        photo: 0.4, scrim: "linear-gradient(180deg, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.5) 44%, rgba(0,0,0,0.66) 76%, rgba(0,0,0,0.84) 100%)",
    };
}

interface Cell { t: number; r: number }
interface Cat { abbr: string; name: string; cells: Record<string, Cell>; n: number }
const cell = (t: number, r: number): Cell => ({ t, r });
const add = (...cs: Cell[]): Cell => cs.reduce((a, c) => ({ t: a.t + c.t, r: a.r + c.r }), { t: 0, r: 0 });
const pctOf = (c: Cell) => (c.t > 0 ? (c.r / c.t) * 100 : 0);
const pct1 = (p: number) => p.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const clamp = (p: number) => Math.min(Math.max(p, 0), 100);

function condColor(p: number, light: boolean, neutral: string): string {
    if (p >= 60) return light ? "#0a9d6e" : "#00E599";
    if (p < 40) return light ? "#c2710c" : "#F5A623";
    return neutral;
}

/* Meta kategori: chip (singkatan) + nama lengkap. Key = label dari data (GRP_LABEL). */
const CAT_META: Record<string, { abbr: string; name: string }> = {
    "ABO": { abbr: "ABO", name: "Anti Blackout" },
    "PS": { abbr: "PS", name: "Program Strategis" },
    "IL2": { abbr: "IL2", name: "Inspeksi Level 2" },
    "4DX": { abbr: "4DX", name: "4DX" },
    "Keandalan": { abbr: "ANDL", name: "Keandalan" },
};
const catMeta = (label: string) => CAT_META[label] ?? { abbr: label, name: label };
const aboFirst = (cats: Cat[]) => [...cats.filter((c) => c.abbr === "ABO"), ...cats.filter((c) => c.abbr !== "ABO")];

const ULTG = {
    upt: { c: "#FB923C", c2: "#fdba74", glow: "rgba(251,146,60,0.55)", dot: "rgba(251,146,60,0.85)" },
    bogor: { c: "#3D7FFF", c2: "#5b9aff", glow: "rgba(61,127,255,0.55)", dot: "rgba(61,127,255,0.85)" },
    sukabumi: { c: "#2DD4A7", c2: "#5be3c0", glow: "rgba(45,212,167,0.55)", dot: "rgba(45,212,167,0.85)" },
} as const;

const BIDANG_C: Record<string, { c: string; glow: string }> = {
    "Transmisi": { c: "#FB923C", glow: "rgba(251,146,60,0.45)" },
    "Gardu Induk": { c: "#3D7FFF", glow: "rgba(61,127,255,0.45)" },
    "Proteksi": { c: "#2DD4A7", glow: "rgba(45,212,167,0.45)" },
};

const BIDANG = ["Transmisi", "Gardu Induk", "Proteksi"] as const;

const COLS = [
    { scope: "upt", label: "Total Progress", ultg: ULTG.upt, showProg: true },
    { scope: "bogor", label: "ULTG Bogor", ultg: ULTG.bogor, showProg: false },
    { scope: "sukabumi", label: "ULTG Sukabumi", ultg: ULTG.sukabumi, showProg: false },
] as const;

export function RingkasanSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const tx = useDeckTransmisi();
    const pr = useDeckProteksi();
    const gi = useDeckGarduInduk();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const light = mounted && resolvedTheme === "light";
    const P = palette(light);

    const loading = tx.loading || pr.loading || gi.loading;

    const { data, cats, totalProg } = useMemo(() => {
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
        const d = { Transmisi: txAgg, "Gardu Induk": giB, Proteksi: prB } as Record<string, Record<string, Cell>>;

        /* Kategori Transmisi: programKerja abo/lm → per-scope dari kolom per-ULTG item. */
        const txCat = (key: "abo" | "lm", label: string): Cat => {
            const items = tx.items.filter((it) => it.programKerja === key);
            const m = catMeta(label);
            const sum = (f: (it: typeof items[number]) => number) => items.reduce((s, it) => s + f(it), 0);
            return {
                abbr: m.abbr, name: m.name,
                cells: {
                    upt: cell(sum((it) => it.totalTarget), sum((it) => it.totalRealisasi)),
                    bogor: cell(sum((it) => it.targetBogor), sum((it) => it.realisasiBogor)),
                    sukabumi: cell(sum((it) => it.targetSukabumi), sum((it) => it.realisasiSukabumi)),
                },
                n: items.filter((it) => it.totalTarget > 0).length,
            };
        };
        /* Kategori GI/Proteksi: grpAgg = upt total, detail per-ULTG = bogor/sukabumi. */
        const grpCat = (bd: { grpAgg: { key: string; name: string; total: number; selesai: number }[]; summary: { grp: string }[]; detail: { grp: string; ultg: string; isSelesai: boolean }[] }, g: { key: string; name: string; total: number; selesai: number }): Cat => {
            const m = catMeta(g.name);
            const det = bd.detail.filter((x) => x.grp === g.key);
            const bg = det.filter((x) => x.ultg === "BOGOR");
            const sk = det.filter((x) => x.ultg === "SUKABUMI");
            return {
                abbr: m.abbr, name: m.name,
                cells: {
                    upt: cell(g.total, g.selesai),
                    bogor: cell(bg.length, bg.filter((x) => x.isSelesai).length),
                    sukabumi: cell(sk.length, sk.filter((x) => x.isSelesai).length),
                },
                n: bd.summary.filter((s) => s.grp === g.key).length,
            };
        };

        const txCats = aboFirst([txCat("abo", "ABO"), txCat("lm", "PS")].filter((c) => c.n > 0));
        const giCats = aboFirst(gi.grpAgg.map((g) => grpCat(gi, g)).filter((c) => c.n > 0));
        const prCats = aboFirst(pr.grpAgg.map((g) => grpCat(pr, g)).filter((c) => c.n > 0));
        const c = { Transmisi: txCats, "Gardu Induk": giCats, Proteksi: prCats } as Record<string, Cat[]>;

        const prog = tx.items.length + gi.summary.length + pr.summary.length;
        return { data: d, cats: c, totalProg: prog };
    }, [tx.items, gi.totals, gi.ultg, gi.grpAgg, gi.summary, gi.detail, pr.totals, pr.ultg, pr.grpAgg, pr.summary, pr.detail]);

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
    const metaStr = `${String(slideNo).padStart(2, "0")}/${String(total).padStart(2, "0")} · Per ULTG · ${dateStr} · Minggu ${week}`;

    return (
        <section className="slide" style={{
            background: P.bg, color: P.text, boxSizing: "border-box", padding: "64px 100px 48px",
            fontFamily: SANS, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        }}>
            {/* Backdrop foto gabungan 3 bidang (theme-aware) + scrim */}
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: `url(/backgrounds/${tone}/combined.png) center / cover no-repeat`, opacity: P.photo }} />
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: P.scrim }} />

            {/* Eyebrow + meta */}
            <motion.div {...fadeUp} transition={{ duration: 0.45, ease: EASE }} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 3 }}>
                    <span style={{ width: 30, height: 2, background: "#00E599", display: "block" }} />
                    <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.26em", textTransform: "uppercase", color: P.muted }}>Performance Overview</span>
                </div>
                {/* Logo Danantara + PLN (theme-aware) — sama dengan slide Ringkasan Eksekutif */}
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDan} alt="Danantara" style={{ height: 28, objectFit: "contain" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPln} alt="PLN" style={{ height: 42, objectFit: "contain" }} />
                </div>
            </motion.div>

            {/* Judul */}
            <motion.div {...fadeUp} transition={{ delay: 0.1, duration: 0.5, ease: EASE }} style={{ margin: "26px 0 0", position: "relative", zIndex: 1 }}>
                <h2 style={{ fontSize: 50, fontWeight: 600, letterSpacing: "-0.03em", color: P.strong, margin: 0, lineHeight: 1 }}>Progress per ULTG</h2>
            </motion.div>

            {/* Hairline */}
            <motion.div initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.25, duration: 0.6, ease: EASE }} style={{ height: 1, transformOrigin: "left", background: `linear-gradient(90deg, ${P.line2}, ${P.line} 70%, transparent)`, margin: "22px 0 0", position: "relative", zIndex: 1 }} />

            {/* Body: 3 kolom + divider */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "stretch", position: "relative", zIndex: 1 }}>
                {COLS.map((col, i) => (
                    <Fragment key={col.scope}>
                        <Column col={col} data={data} cats={cats} head={add(...BIDANG.map((b) => data[b][col.scope]))} totalProg={col.showProg ? totalProg : undefined} padLeft={i === 0 ? 0 : 50} padRight={i === COLS.length - 1 ? 0 : 50} delay={0.3 + i * 0.1} P={P} light={light} />
                        {i < COLS.length - 1 && (
                            <div style={{ width: 1, alignSelf: "stretch", background: `linear-gradient(180deg, transparent, ${P.line2} 12%, ${P.line2} 88%, transparent)` }} />
                        )}
                    </Fragment>
                ))}
            </div>

            {/* Footer legenda */}
            <motion.div {...fadeUp} transition={{ delay: 0.7, duration: 0.5, ease: EASE }} style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${P.line}`, paddingTop: 16, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.muted, fontFeatureSettings: TNUM }}>{metaStr}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: P.faint, flexShrink: 0 }}>Program Kerja UPT Bogor · 2026</span>
            </motion.div>
        </section>
    );
}

/* ─────────── Kolom (metrik + rincian bidang × kategori, dipusatkan) ─────────── */
function Column({ col, data, cats, head, totalProg, padLeft, padRight, delay, P, light }: {
    col: { scope: string; label: string; ultg: { c: string; c2: string; glow: string; dot: string } };
    data: Record<string, Record<string, Cell>>;
    cats: Record<string, Cat[]>;
    head: Cell; totalProg?: number; padLeft: number; padRight: number; delay: number; P: Palette; light: boolean;
}) {
    const hp = pctOf(head);
    const u = col.ultg;
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: EASE }}
            style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 30, padding: `0 ${padRight}px 0 ${padLeft}px` }}
        >
            {/* Metrik kolom */}
            <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: u.c, boxShadow: `0 0 12px ${u.dot}`, flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, letterSpacing: "0.05em", color: P.strong, textTransform: "uppercase", whiteSpace: "nowrap" }}>{col.label}</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 600, color: P.strong, lineHeight: 0.9, letterSpacing: "-0.03em", marginTop: 18, fontFeatureSettings: TNUM }}>
                    {pct1(hp)}<span style={{ fontSize: 26, color: P.meta }}>%</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 13.5, color: P.muted, marginTop: 11, whiteSpace: "nowrap", fontFeatureSettings: TNUM }}>
                    {fmtNum(head.r)} / {fmtNum(head.t)} item{totalProg !== undefined ? ` · ${totalProg} program` : ""}
                </div>
                <div style={{ height: 7, borderRadius: 99, background: P.track, marginTop: 18, overflow: "hidden" }}>
                    <motion.div initial={{ width: "0%" }} animate={{ width: `${clamp(hp)}%` }} transition={{ delay: delay + 0.2, duration: 0.9, ease: EASE }} style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${u.c},${u.c2})`, boxShadow: `0 0 14px ${u.glow}` }} />
                </div>
            </div>

            {/* Rincian per bidang × kategori */}
            <div>
                <div style={{ height: 1, background: P.line, marginBottom: 24 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    {BIDANG.map((b, i) => (
                        <BidangBlock key={b} name={b} total={data[b][col.scope]} cats={cats[b]} scope={col.scope} acc={BIDANG_C[b]} delay={delay + 0.3 + i * 0.12} P={P} light={light} />
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

/* ─────────── Blok bidang — header (nama + %) + caption + baris kategori ─────────── */
function BidangBlock({ name, total, cats, scope, acc, delay, P, light }: {
    name: string; total: Cell; cats: Cat[]; scope: string; acc: { c: string; glow: string }; delay: number; P: Palette; light: boolean;
}) {
    const bp = pctOf(total);
    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: acc.c, boxShadow: `0 0 8px ${acc.glow}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 20, fontWeight: 500, color: P.name, whiteSpace: "nowrap" }}>{name}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: condColor(bp, light, P.condNeutral), fontFeatureSettings: TNUM, flexShrink: 0 }}>{pct1(bp)}%</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: P.meta, marginTop: 6, fontFeatureSettings: TNUM }}>
                {fmtNum(total.r)} / {fmtNum(total.t)} item
            </div>
            <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 10 }}>
                {cats.map((c, i) => (
                    <CatLine key={c.abbr} cat={c} scope={scope} acc={acc} delay={delay + 0.16 + i * 0.07} P={P} light={light} />
                ))}
            </div>
        </div>
    );
}

/* ─────────── Baris kategori — chip + bar tipis (tumbuh) + % ─────────── */
function CatLine({ cat, scope, acc, delay, P, light }: { cat: Cat; scope: string; acc: { c: string; glow: string }; delay: number; P: Palette; light: boolean }) {
    const cl = cat.cells[scope] ?? cell(0, 0);
    const p = pctOf(cl);
    const w = clamp(p);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span title={cat.name} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: acc.c, background: `color-mix(in oklab, ${acc.c} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${acc.c} 32%, transparent)`, padding: "3px 0", borderRadius: 5, flexShrink: 0, lineHeight: 1.25, textAlign: "center", minWidth: 50 }}>{cat.abbr}</span>
            <div style={{ flex: 1, height: 7, borderRadius: 99, background: P.track, overflow: "hidden" }}>
                <motion.div initial={{ width: "0%" }} animate={{ width: `${w}%` }} transition={{ delay, duration: 0.85, ease: EASE }} style={{ height: "100%", borderRadius: 99, background: acc.c, boxShadow: `0 0 8px ${acc.glow}` }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: condColor(p, light, P.condNeutral), fontFeatureSettings: TNUM, flexShrink: 0, minWidth: 62, textAlign: "right" }}>{pct1(p)}%</span>
        </div>
    );
}
