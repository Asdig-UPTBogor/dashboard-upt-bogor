"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { getISOWeek } from "../_components/SlideShared";
import { BidangBackdrop } from "@/components/shared/BidangBackdrop";

/**
 * Cover slide — identitas deck "UPT Bogor · Program Kerja 2026".
 * eyebrow kiri · meta center · logo kanan (atas), headline (tengah),
 * cakupan bidang + base rail (bawah). Entrance pakai framer-motion.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export function CoverSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const light = mounted && resolvedTheme === "light";
    const logoDan = light ? "/wap/logo-danantara.png" : "/wap/poster/assets/logo-danantara-w.png";
    const logoPln = light ? "/wap/logo-pln.png" : "/wap/poster/assets/logo-pln-w.png";

    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);

    const cards = [
        { index: "01", label: "Transmisi", accent: "#5b8def", desc: "ABO · PS" },
        { index: "02", label: "Gardu Induk", accent: "#3ecf8e", desc: "ABO · PS · IL2" },
        { index: "03", label: "Proteksi", accent: "#f3c14b", desc: "ABO · 4DX · Keandalan" },
    ];

    return (
        <section className="slide" style={{ padding: "56px 96px 48px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            {/* ── Backdrop gabungan 3 bidang (theme-aware) ── */}
            <BidangBackdrop bidang="combined" opacity={0.6} />

            {/* ── Konten ── */}
            <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {/* ── Top: eyebrow kiri · meta center · logo kanan ── */}
            <motion.div {...fadeUp} transition={{ duration: 0.5, ease: EASE }}
                style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{
                    fontFamily: "var(--font-mono, monospace)", fontSize: 13, textTransform: "uppercase",
                    letterSpacing: "0.32em", color: "var(--accent-amber)", fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 16, paddingTop: 8,
                }}>
                    <span style={{ width: 48, height: 1.5, background: "var(--accent-amber)" }} />
                    UPT Bogor &middot; Program Monitoring
                </div>

                {/* Meta — center top */}
                <div style={{
                    position: "absolute", left: "50%", transform: "translateX(-50%)", paddingTop: 6,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    fontFamily: "var(--font-mono, monospace)", fontSize: 12, textTransform: "uppercase",
                    letterSpacing: "0.16em", color: "var(--fg-2)", fontWeight: 600, fontFeatureSettings: '"tnum"',
                }}>
                    <span>
                        <span style={{ color: "var(--fg-0)", fontWeight: 700 }}>{String(slideNo).padStart(2, "0")}</span>
                        <span style={{ margin: "0 6px", color: "var(--fg-3)" }}>/</span>{String(total).padStart(2, "0")}
                        <span style={{ margin: "0 9px", color: "var(--fg-3)" }}>·</span>
                        <span style={{ color: "var(--accent-amber)" }}>Program Kerja</span>
                    </span>
                    <span>UPT Bogor · {dateStr} · Minggu {week}</span>
                </div>

                {/* Logo — kanan */}
                <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDan} alt="Danantara" style={{ height: 32, objectFit: "contain" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPln} alt="PLN" style={{ height: 46, objectFit: "contain" }} />
                </div>
            </motion.div>

            {/* ── Tengah: headline + subjudul ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <motion.h1 {...fadeUp} transition={{ delay: 0.12, duration: 0.6, ease: EASE }}
                    style={{ fontSize: 108, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 0.98, margin: 0, color: "var(--fg-0)" }}>
                    Program Kerja<br />
                    UPT Bogor <span style={{ color: "var(--accent-amber)" }}>2026</span>
                </motion.h1>
                <motion.p {...fadeUp} transition={{ delay: 0.28, duration: 0.6, ease: EASE }}
                    style={{ marginTop: 28, fontSize: 23, color: "var(--fg-1)", fontWeight: 400, maxWidth: 1100, lineHeight: 1.55 }}>
                    Ringkasan progress program kerja
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> ULTG Bogor</strong> dan
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> ULTG Sukabumi</strong> —
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> Transmisi</strong>,
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> Gardu Induk</strong>, dan
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> Proteksi</strong>.
                </motion.p>
            </div>

            {/* ── Bawah: caption + 3 kartu bidang + base rail ── */}
            <div>
                <motion.div {...fadeUp} transition={{ delay: 0.4, duration: 0.5, ease: EASE }}
                    style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ width: 16, height: 1.5, background: "var(--fg-3)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600 }}>Coverage</span>
                </motion.div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    {cards.map((c, i) => (
                        <BidangCard key={c.label} {...c} delay={0.46 + i * 0.08} />
                    ))}
                </div>

                <motion.div {...fadeUp} transition={{ delay: 0.72, duration: 0.5, ease: EASE }}
                    style={{
                        marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--line)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontFamily: "var(--font-mono, monospace)", fontSize: 11, textTransform: "uppercase",
                        letterSpacing: "0.16em", color: "var(--fg-2)", fontWeight: 600,
                    }}>
                    <span>UPT Bogor &middot; ULTG Bogor &middot; ULTG Sukabumi</span>
                    <span>Periode <span style={{ color: "var(--accent-amber)" }}>2026</span></span>
                </motion.div>
            </div>
            </div>
        </section>
    );
}

function BidangCard({ index, label, accent, desc, delay }: {
    index: string; label: string; accent: string; desc: string; delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: EASE }}
            style={{
                background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10,
                padding: "24px 28px", display: "flex", flexDirection: "column", gap: 10,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ width: 24, height: 2, background: accent }} />
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, fontWeight: 600, color: "var(--fg-3)", letterSpacing: "0.12em", fontFeatureSettings: '"tnum"' }}>{index}</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "var(--fg-0)", letterSpacing: "-0.015em", lineHeight: 1.1 }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>{desc}</div>
        </motion.div>
    );
}
