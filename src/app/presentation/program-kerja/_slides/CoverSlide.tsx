"use client";

import { SlideHeadCompact } from "../_components/SlideShared";

/**
 * Cover slide — judul deck + summary 3 bidang.
 * Info rail di top kanan inline dengan title (konsisten dengan slide bidang).
 */

export function CoverSlide({ slideNo, total }: { slideNo: number; total: number }) {
    return (
        <section className="slide" style={{ padding: "48px 96px" }}>
            {/* Header row — eyebrow kiri, info rail kanan inline */}
            <div className="flex justify-between items-start gap-3" style={{ marginBottom: 32 }}>
                <div style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.32em",
                    color: "var(--accent-amber)",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    paddingTop: 6,
                }}>
                    <span style={{ width: 48, height: 1.5, background: "var(--accent-amber)" }} />
                    UPT Bogor &middot; Monitoring Program Kerja
                </div>
                <SlideHeadCompact pageNo={slideNo} total={total} section="Program Kerja" />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
                {/* Headline */}
                <div>
                    <h1 style={{
                        fontSize: 96,
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                        lineHeight: 1.0,
                        margin: 0,
                        color: "var(--fg-0)",
                    }}>
                        Program Kerja<br />
                        UPT Bogor <span style={{ color: "var(--accent-amber)" }}>2026</span>
                    </h1>
                    <p style={{
                        marginTop: 24,
                        fontSize: 22,
                        color: "var(--fg-1)",
                        fontWeight: 400,
                        maxWidth: 1100,
                        lineHeight: 1.5,
                    }}>
                        Rangkuman progress program kerja 3 bidang utama:
                        <strong style={{ color: "var(--fg-0)" }}> Transmisi</strong>,
                        <strong style={{ color: "var(--fg-0)" }}> Proteksi</strong>, dan
                        <strong style={{ color: "var(--fg-0)" }}> Gardu Induk</strong> —
                        lintas ULTG Bogor &amp; Sukabumi.
                    </p>
                </div>

                {/* 3 Bidang summary cards */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 16,
                    marginTop: 32,
                }}>
                    <BidangCard label="Transmisi" accent="#5b8def" desc="ABO + LM Jaringan" />
                    <BidangCard label="Proteksi" accent="#3ecf8e" desc="3 Program Kerja Proteksi" />
                    <BidangCard label="Gardu Induk" accent="#f3c14b" desc="IL 2 + PS + ABO" />
                </div>
            </div>
        </section>
    );
}

function BidangCard({ label, accent, desc }: { label: string; accent: string; desc: string }) {
    return (
        <div style={{
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
        }}>
            <span style={{ width: 20, height: 2, background: accent }} />
            <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--fg-0)",
                letterSpacing: "-0.01em",
            }}>{label}</div>
            <div style={{
                fontSize: 13,
                color: "var(--fg-1)",
                fontWeight: 500,
            }}>{desc}</div>
        </div>
    );
}
