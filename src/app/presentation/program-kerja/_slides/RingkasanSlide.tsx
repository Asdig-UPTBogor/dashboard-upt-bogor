"use client";

import { useMemo } from "react";
import { usePageData } from "@/hooks/usePageData";
import {
    normalizeItem,
    type ProgramItem,
} from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";
import { IL2_ITEMS, PS_ITEMS as GI_PS_ITEMS, ABO_ITEMS as GI_ABO_ITEMS } from "@/app/presentation/gardu-induk/program-kerja/_data/gi-items";
import { LM_ITEMS, ABO_ITEMS as PR_ABO_ITEMS, PK_ITEMS } from "@/app/presentation/proteksi/program-kerja/_data/proteksi-items";
import { SlideHeadCompact, fmtNum, pct } from "../_components/SlideShared";

const C = {
    abo: "#5b8def",      // biru (ABO semua bidang)
    ps: "#f3c14b",       // kuning (PS/LM semua bidang)
    il2: "#3ecf8e",      // mint (IL 2 GI only)
    pk: "#34d399",       // emerald (PK Proteksi only)
    bogor: "#06b6d4",    // cyan
    sukabumi: "#f08a3e", // orange
    total: "#a855f7",    // violet
    transmisi: "#5b8def",
    gi: "#3ecf8e",
    proteksi: "#f3c14b",
};

interface KategoriData {
    label: string;
    color: string;
    target: number;
    real: number;
}

interface BidangData {
    label: string;
    color: string;
    target: number;
    real: number;
    kategoris: KategoriData[];
}

export function RingkasanSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const { sheets, loading } = usePageData("/transmisi/program-kerja");
    const tx: ProgramItem[] = useMemo(() => {
        const rows = sheets?.[0]?.rows || [];
        return rows.map(normalizeItem).filter((it) => it.namaProgram);
    }, [sheets]);

    if (loading) {
        return (
            <section className="slide" style={{ alignItems: "center", justifyContent: "center" }}>
                <p className="ds-body">Memuat data…</p>
            </section>
        );
    }

    /* ─── Aggregator helpers ─── */
    const sumTx = (items: ProgramItem[], kind: "bogor" | "sukabumi" | "total") => {
        if (kind === "bogor") return [items.reduce((s, it) => s + it.targetBogor, 0), items.reduce((s, it) => s + it.realisasiBogor, 0)] as const;
        if (kind === "sukabumi") return [items.reduce((s, it) => s + it.targetSukabumi, 0), items.reduce((s, it) => s + it.realisasiSukabumi, 0)] as const;
        return [items.reduce((s, it) => s + it.totalTarget, 0), items.reduce((s, it) => s + it.totalRealisasi, 0)] as const;
    };

    const txAbo = tx.filter((it) => it.programKerja === "abo");
    const txLm = tx.filter((it) => it.programKerja === "lm");

    function buildUltg(kind: "bogor" | "sukabumi"): BidangData[] {
        // For GI/Proteksi, pakai field-spesifik ULTG (targetBogor / targetSukabumi)
        const giF = (key: "targetBogor" | "realBogor" | "targetSukabumi" | "realSukabumi") => key;
        const tField = kind === "bogor" ? "targetBogor" : "targetSukabumi";
        const rField = kind === "bogor" ? "realBogor" : "realSukabumi";

        const [tx_abo_t, tx_abo_r] = sumTx(txAbo, kind);
        const [tx_lm_t, tx_lm_r] = sumTx(txLm, kind);

        const abosumGi = (items: typeof GI_ABO_ITEMS) => [
            items.reduce((s, it) => s + (it[giF(tField)] || 0), 0),
            items.reduce((s, it) => s + (it[giF(rField)] || 0), 0),
        ] as const;
        const [gi_abo_t, gi_abo_r] = abosumGi(GI_ABO_ITEMS);
        const [gi_ps_t, gi_ps_r] = abosumGi(GI_PS_ITEMS);
        const [gi_il2_t, gi_il2_r] = abosumGi(IL2_ITEMS);

        const abosumPr = (items: typeof PR_ABO_ITEMS) => [
            items.reduce((s, it) => s + (it[giF(tField)] || 0), 0),
            items.reduce((s, it) => s + (it[giF(rField)] || 0), 0),
        ] as const;
        const [pr_abo_t, pr_abo_r] = abosumPr(PR_ABO_ITEMS);
        const [pr_lm_t, pr_lm_r] = abosumPr(LM_ITEMS);
        const [pr_pk_t, pr_pk_r] = abosumPr(PK_ITEMS);

        return [
            {
                label: "Transmisi", color: C.transmisi,
                target: tx_abo_t + tx_lm_t, real: tx_abo_r + tx_lm_r,
                kategoris: [
                    { label: "ABO", color: C.abo, target: tx_abo_t, real: tx_abo_r },
                    { label: "LM",  color: C.ps,  target: tx_lm_t,  real: tx_lm_r  },
                ],
            },
            {
                label: "Gardu Induk", color: C.gi,
                target: gi_abo_t + gi_ps_t + gi_il2_t, real: gi_abo_r + gi_ps_r + gi_il2_r,
                kategoris: [
                    { label: "ABO", color: C.abo, target: gi_abo_t, real: gi_abo_r },
                    { label: "PS",  color: C.ps,  target: gi_ps_t,  real: gi_ps_r  },
                    { label: "IL 2", color: C.il2, target: gi_il2_t, real: gi_il2_r },
                ],
            },
            {
                label: "Proteksi", color: C.proteksi,
                target: pr_abo_t + pr_lm_t + pr_pk_t, real: pr_abo_r + pr_lm_r + pr_pk_r,
                kategoris: [
                    { label: "ABO", color: C.abo, target: pr_abo_t, real: pr_abo_r },
                    { label: "LM",  color: C.ps,  target: pr_lm_t,  real: pr_lm_r  },
                    { label: "PK",  color: C.pk,  target: pr_pk_t,  real: pr_pk_r  },
                ],
            },
        ];
    }

    const bogorBidangs = buildUltg("bogor");
    const skbmBidangs = buildUltg("sukabumi");

    const bogor_total = bogorBidangs.reduce((s, b) => s + b.target, 0);
    const bogor_real = bogorBidangs.reduce((s, b) => s + b.real, 0);
    const skbm_total = skbmBidangs.reduce((s, b) => s + b.target, 0);
    const skbm_real = skbmBidangs.reduce((s, b) => s + b.real, 0);
    const upt_target = bogor_total + skbm_total;
    const upt_real = bogor_real + skbm_real;
    const upt_persen = pct(upt_real, upt_target);

    return (
        <section className="slide" style={{ padding: "32px 64px 24px" }}>
            {/* Header — eyebrow + info rail */}
            <div className="flex justify-between items-start gap-3" style={{ marginBottom: 16 }}>
                <div style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.28em",
                    color: "var(--accent-amber)",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    paddingTop: 4,
                }}>
                    <span style={{ width: 36, height: 1.5, background: "var(--accent-amber)" }} />
                    UPT Bogor &middot; Ringkasan
                </div>
                <SlideHeadCompact pageNo={slideNo} total={total} section="Ringkasan UPT Bogor" />
            </div>

            {/* Headline + big stat */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 32, marginBottom: 16 }}>
                <h1 style={{
                    fontSize: 48,
                    fontWeight: 800,
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                    margin: 0,
                    color: "var(--fg-0)",
                }}>
                    Progress <span style={{ color: C.total }}>UPT Bogor 2026</span>
                </h1>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 56,
                    fontWeight: 700,
                    color: C.total,
                    letterSpacing: "-0.03em",
                    fontFeatureSettings: '"tnum"',
                    lineHeight: 1,
                }}>{upt_persen.toFixed(1)}%</span>
                <span style={{
                    fontSize: 13,
                    color: "var(--fg-1)",
                    fontWeight: 500,
                    fontFamily: "var(--font-mono, monospace)",
                    fontFeatureSettings: '"tnum"',
                }}>
                    <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 16 }}>{fmtNum(upt_real)}</span>
                    <span style={{ color: "var(--fg-2)", margin: "0 6px" }}>/</span>
                    <span style={{ fontSize: 16 }}>{fmtNum(upt_target)}</span>
                </span>
            </div>

            {/* 2 ULTG cards (breakdown bidang × kategori) */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                flex: 1,
                minHeight: 0,
            }}>
                <UltgBreakdownCard
                    name="ULTG Bogor"
                    accent={C.bogor}
                    target={bogor_total}
                    real={bogor_real}
                    bidangs={bogorBidangs}
                />
                <UltgBreakdownCard
                    name="ULTG Sukabumi"
                    accent={C.sukabumi}
                    target={skbm_total}
                    real={skbm_real}
                    bidangs={skbmBidangs}
                />
            </div>
        </section>
    );
}

function UltgBreakdownCard({ name, accent, target, real, bidangs }: {
    name: string; accent: string; target: number; real: number;
    bidangs: BidangData[];
}) {
    const p = pct(real, target);
    return (
        <div style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
        }}>
            {/* Top: ULTG name + persen GEDE */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                padding: "16px 22px",
                borderBottom: "1px solid var(--line)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 18, height: 2, background: accent }} />
                    <span style={{
                        fontSize: 18, fontWeight: 700, color: "var(--fg-0)",
                        letterSpacing: "-0.005em",
                    }}>{name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 36, fontWeight: 700, color: accent,
                        letterSpacing: "-0.03em", fontFeatureSettings: '"tnum"',
                        lineHeight: 1,
                    }}>{p.toFixed(1)}%</span>
                    <span style={{
                        fontSize: 12, color: "var(--fg-1)", fontWeight: 600,
                        fontFamily: "var(--font-mono, monospace)",
                        fontFeatureSettings: '"tnum"',
                    }}>
                        {fmtNum(real)} / {fmtNum(target)}
                    </span>
                </div>
            </div>

            {/* 3 bidang sections */}
            <div style={{
                padding: "12px 22px 16px",
                display: "flex", flexDirection: "column", gap: 14,
                flex: 1, minHeight: 0,
            }}>
                {bidangs.map((b) => (
                    <BidangBreakdown key={b.label} bidang={b} />
                ))}
            </div>
        </div>
    );
}

function BidangBreakdown({ bidang }: { bidang: BidangData }) {
    const p = pct(bidang.real, bidang.target);
    const empty = bidang.target === 0;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Bidang header: name + persen */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 14, height: 1.5, background: bidang.color, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 13, fontWeight: 700, color: "var(--fg-0)",
                        textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>{bidang.label}</span>
                </div>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 16, fontWeight: 700, color: bidang.color,
                    letterSpacing: "-0.015em", fontFeatureSettings: '"tnum"',
                }}>
                    {empty ? "—" : `${p.toFixed(1)}%`}
                </span>
            </div>

            {/* Kategoris row — mini bar per kategori */}
            <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${bidang.kategoris.length}, 1fr)`,
                gap: 8,
                paddingLeft: 24,
            }}>
                {bidang.kategoris.map((k) => (
                    <KategoriMiniBar key={k.label} k={k} />
                ))}
            </div>
        </div>
    );
}

function KategoriMiniBar({ k }: { k: KategoriData }) {
    const p = pct(k.real, k.target);
    const empty = k.target === 0;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--fg-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontFamily: "var(--font-mono, monospace)",
                }}>{k.label}</span>
                <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: empty ? "var(--fg-2)" : k.color,
                    fontFamily: "var(--font-mono, monospace)",
                    fontFeatureSettings: '"tnum"',
                }}>
                    {empty ? "—" : `${p.toFixed(0)}%`}
                </span>
            </div>
            <div style={{
                height: 4,
                background: "var(--bg-2)",
                borderRadius: 2,
                overflow: "hidden",
            }}>
                {!empty && (
                    <div style={{
                        width: `${Math.max(2, Math.min(100, p))}%`,
                        height: "100%",
                        background: k.color,
                        borderRadius: 2,
                    }} />
                )}
            </div>
        </div>
    );
}
