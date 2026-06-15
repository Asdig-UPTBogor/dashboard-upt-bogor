"use client";

/**
 * Slide Ringkasan Eksekutif CE — agregat UPT (3 bidang) + breakdown per bidang + per ULTG.
 *
 * Komposisi:
 *   1. SlideHeader (pola deck PK) — % closing UPT BESAR di samping judul.
 *   2. Hero strip 4 panel — Total CE UPT (highlight) + 3 bidang (angka RESMI ce_summary).
 *   3. Panel breakdown ULTG — 2 kolom (Bogor/Sukabumi), 3 bar bidang per kolom
 *      (basis rincian target-only, cara ultgBarRows page CE).
 *   4. Footnotes kejujuran data (sinkronisasi rincian transmisi + non-target proteksi).
 */

import { useState } from "react";
import { SlideHeader } from "@/app/presentation/program-kerja/_components/SlideShared";
import {
    CE_BIDANG_META,
    CE_ORDER,
    fmtNum,
    fmtPct,
    pct,
    pctColor,
    type BidangDeck,
    type CeBidang,
} from "../_lib/ce-deck";
import {
    CloseOpenCounts,
    DashCaption,
    FungsiChip,
    Footnotes,
    NtNote,
    SegBar,
    SlideLoading,
    StatBig,
    VDivider,
} from "../_components/CeSlideShared";

const ULTG_KEYS = [
    { key: "BOGOR", name: "ULTG Bogor", accent: "var(--color-ultg-bogor)" },
    { key: "SUKABUMI", name: "ULTG Sukabumi", accent: "var(--color-ultg-sukabumi)" },
];

export function CeRingkasanSlide({
    slideNo,
    total,
    decks,
    loading,
    error,
}: {
    slideNo: number;
    total: number;
    decks: Record<CeBidang, BidangDeck> | null;
    loading: boolean;
    error?: string | null;
}) {
    const [activeUltg, setActiveUltg] = useState<string | null>(null);

    if (loading) return <SlideLoading text="Memuat ringkasan Common Enemy…" />;
    if (error || !decks) return <SlideLoading text={error || "Belum ada data"} />;

    const list = CE_ORDER.map((b) => decks[b]);
    const au = activeUltg ? ULTG_KEYS.find((u) => u.key === activeUltg) ?? null : null;

    /* Filter ULTG aktif → angka hero strip proyeksi rincian ULTG itu. */
    const bidangView = (d: BidangDeck) => {
        if (!au) return { total: d.total, close: d.close, ntTotal: d.ntClose + d.ntOpen, ntClose: d.ntClose };
        const e = d.ultg.find((x) => x.key === au.key);
        return { total: e?.total ?? 0, close: e?.close ?? 0, ntTotal: e?.ntTotal ?? 0, ntClose: e?.ntClose ?? 0 };
    };
    const views = list.map(bidangView);
    const uptTotal = views.reduce((s, v) => s + v.total, 0);
    const uptClose = views.reduce((s, v) => s + v.close, 0);
    const uptOpen = Math.max(uptTotal - uptClose, 0);
    const subCeCount = list.reduce((s, d) => s + d.programs.length, 0);
    const ntTotal = views.reduce((s, v) => s + v.ntTotal, 0);
    const ntClose = views.reduce((s, v) => s + v.ntClose, 0);
    const ntOpen = Math.max(ntTotal - ntClose, 0);

    /* Footnotes kejujuran data — muncul otomatis hanya kalau relevan */
    const notes: string[] = [];
    if (au) {
        notes.push(`Filter ${au.name} aktif — angka berbasis rincian item target (klik lagi untuk hapus filter).`);
    } else {
        const outOfSync = list.filter((d) => d.detailTargetClose !== d.close);
        if (outOfSync.length > 0) {
            const labels = outOfSync
                .map((d) => `${CE_BIDANG_META[d.bidang].label} ${fmtNum(d.detailTargetClose)}/${fmtNum(d.close)} resmi`)
                .join(" · ");
            notes.push(`Breakdown ULTG berbasis rincian item target — realisasi rincian terinput: ${labels}.`);
        }
    }
    if (ntTotal > 0) {
        notes.push(
            `${fmtNum(ntTotal)} anomali non-target (${fmtNum(ntClose)} close · ${fmtNum(ntOpen)} open) dipantau di luar angka utama.`,
        );
    }
    const noUltg = list.reduce((s, d) => s + d.noUltgTarget, 0);
    if (!au && noUltg > 0) notes.push(`${fmtNum(noUltg)} item target tanpa ULTG tidak masuk breakdown ULTG.`);

    return (
        <section className="slide" style={{ padding: "32px 64px 24px" }}>
            <SlideHeader
                eyebrow="UPT Bogor &middot; Ringkasan Eksekutif"
                title={<>Common Enemy UPT Bogor <span style={{ color: "var(--accent-amber)" }}>2026</span></>}
                pageNo={slideNo}
                total={total}
                section="Ringkasan CE"
                dataStamp
            />

            {/* ── Hero strip: Total UPT (highlight) + 3 bidang ── */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 16,
                }}
            >
                {/* Panel highlight — Total CE UPT */}
                <div
                    style={{
                        padding: "20px 26px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        borderRight: "1px solid var(--line)",
                        background:
                            "radial-gradient(ellipse 55% 80% at 0% 0%, color-mix(in oklab, var(--accent-amber) 7%, transparent), transparent 60%)",
                    }}
                >
                    <DashCaption
                        accent="var(--accent-amber)"
                        size={13}
                        after={
                            au ? (
                                <span
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.1em",
                                        color: au.accent,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    · {au.name}
                                </span>
                            ) : undefined
                        }
                    >
                        Total Common Enemy UPT
                    </DashCaption>
                    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flex: 1, justifyContent: "space-between" }}>
                        <StatBig
                            value={fmtNum(uptTotal)}
                            label="Anomali"
                            size={46}
                            extra={ntTotal > 0 ? <NtNote text={`+${fmtNum(ntTotal)} NT`} kind="close" /> : undefined}
                        />
                        <VDivider />
                        <StatBig
                            value={fmtNum(uptClose)}
                            label="Close"
                            color="var(--cond-very-good)"
                            size={46}
                            extra={ntClose > 0 ? <NtNote text={`(+${fmtNum(ntClose)})`} kind="close" /> : undefined}
                        />
                        <VDivider />
                        <StatBig
                            value={fmtNum(uptOpen)}
                            label="Open"
                            color="var(--cond-poor)"
                            size={46}
                            extra={ntOpen > 0 ? <NtNote text={`(+${fmtNum(ntOpen)})`} kind="open" /> : undefined}
                        />
                        <VDivider />
                        <StatBig value={fmtNum(subCeCount)} label="Sub CE" size={46} />
                    </div>
                    <SegBar close={uptClose} total={uptTotal} ntClose={ntClose} height={16} fontSize={12.5} minPctLabel={9} />
                </div>

                {/* 3 bidang panels — default angka RESMI ce_summary, react ke filter ULTG */}
                {list.map((d, i) => {
                    const meta = CE_BIDANG_META[d.bidang];
                    const v = views[i];
                    const persen = pct(v.close, v.total);
                    return (
                        <div
                            key={d.bidang}
                            style={{
                                padding: "20px 24px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                                borderRight: i < list.length - 1 ? "1px solid var(--line)" : "none",
                                minWidth: 0,
                            }}
                        >
                            <DashCaption accent={meta.accent} size={12.5} after={<FungsiChip text={meta.fungsi} color={meta.accent} size={10.5} />}>
                                {meta.label}
                            </DashCaption>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flex: 1 }}>
                                <span
                                    style={{
                                        fontFamily: "var(--font-mono, monospace)",
                                        fontSize: 44,
                                        fontWeight: 700,
                                        color: v.total > 0 ? pctColor(persen) : "var(--fg-3)",
                                        letterSpacing: "-0.035em",
                                        fontFeatureSettings: '"tnum"',
                                        lineHeight: 1,
                                    }}
                                >
                                    {v.total > 0 ? fmtPct(persen) : "—"}
                                    {v.total > 0 && <span style={{ fontSize: "0.5em", fontWeight: 600, marginLeft: 3 }}>%</span>}
                                </span>
                                <CloseOpenCounts close={v.close} total={v.total} sizeClose={16} sizeTotal={13} />
                            </div>
                            <SegBar close={v.close} total={v.total} ntClose={v.ntClose} height={16} fontSize={11.5} radius={5} minPctLabel={16} />
                        </div>
                    );
                })}
            </div>

            {/* ── Breakdown per ULTG — basis rincian target-only ── */}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 26px",
                        borderBottom: "1px solid var(--line)",
                    }}
                >
                    <DashCaption accent="var(--fg-3)" size={14}>Breakdown per ULTG</DashCaption>
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--fg-2)",
                            fontFamily: "var(--font-mono, monospace)",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                        }}
                    >
                        Basis rincian item &middot; target-only
                    </span>
                </div>

                <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1px 1fr" }}>
                    {ULTG_KEYS.map((u, i) => (
                        <UltgColumn
                            key={u.key}
                            ultg={u}
                            decks={decks}
                            divider={i === 0}
                            isActive={activeUltg === u.key}
                            isDimmed={activeUltg !== null && activeUltg !== u.key}
                            onClick={() => setActiveUltg((k) => (k === u.key ? null : u.key))}
                        />
                    ))}
                </div>
            </div>

            <Footnotes notes={notes} />
        </section>
    );
}

/* ─────────── Kolom 1 ULTG: header identitas + 3 bar bidang ─────────── */

function UltgColumn({
    ultg,
    decks,
    divider,
    isActive = false,
    isDimmed = false,
    onClick,
}: {
    ultg: { key: string; name: string; accent: string };
    decks: Record<CeBidang, BidangDeck>;
    divider: boolean;
    isActive?: boolean;
    isDimmed?: boolean;
    onClick?: () => void;
}) {
    const [hover, setHover] = useState(false);
    const rows = CE_ORDER.map((b) => {
        const e = decks[b].ultg.find((x) => x.key === ultg.key);
        return { bidang: b, total: e?.total ?? 0, close: e?.close ?? 0, ntTotal: e?.ntTotal ?? 0, ntClose: e?.ntClose ?? 0 };
    });
    const sumTotal = rows.reduce((s, r) => s + r.total, 0);
    const sumClose = rows.reduce((s, r) => s + r.close, 0);
    const sumNtTotal = rows.reduce((s, r) => s + r.ntTotal, 0);
    const sumNtClose = rows.reduce((s, r) => s + r.ntClose, 0);

    return (
        <>
            <div
                onClick={onClick}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
                onKeyDown={(e) => {
                    if (onClick && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onClick();
                    }
                }}
                title={onClick ? (isActive ? `Hapus filter ${ultg.name}` : `Filter ${ultg.name}`) : undefined}
                style={{
                    padding: "18px 26px 24px",
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    cursor: onClick ? "pointer" : "default",
                    opacity: isDimmed ? 0.45 : 1,
                    background: isActive
                        ? `color-mix(in oklab, ${ultg.accent} 10%, transparent)`
                        : hover && onClick
                          ? `color-mix(in oklab, ${ultg.accent} 6%, transparent)`
                          : "transparent",
                    boxShadow: isActive
                        ? `inset 0 0 0 1px ${ultg.accent}`
                        : hover && onClick
                          ? `inset 0 0 0 1px color-mix(in oklab, ${ultg.accent} 30%, transparent)`
                          : "none",
                    transition: "opacity .25s ease, background .25s ease, box-shadow .25s ease",
                }}
            >
                {/* Header ULTG — identitas square dot + counts */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 12,
                        paddingBottom: 16,
                        borderBottom: "1px solid var(--line)",
                        marginBottom: 8,
                    }}
                >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: ultg.accent, flexShrink: 0 }} />
                        <span style={{ fontSize: 21, fontWeight: 700, color: "var(--fg-0)", letterSpacing: "-0.005em" }}>
                            {ultg.name}
                        </span>
                    </span>
                    <span
                        style={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--fg-1)",
                            fontFeatureSettings: '"tnum"',
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span style={{ color: "var(--fg-2)", marginRight: 8 }}>Close</span>
                        <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 16 }}>{fmtNum(sumClose)}</span>
                        {sumNtClose > 0 && <span style={{ fontSize: 11, color: "var(--cond-good)" }}>(+{fmtNum(sumNtClose)})</span>}
                        <span style={{ color: "var(--fg-2)", margin: "0 5px" }}>/</span>
                        {fmtNum(sumTotal)}
                        {sumNtTotal > 0 && <span style={{ fontSize: 11, color: "var(--cond-good)" }}>(+{fmtNum(sumNtTotal)})</span>}
                        {" "}item
                    </span>
                </div>

                {/* 3 bidang rows */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 16 }}>
                    {rows.map((r) => {
                        const meta = CE_BIDANG_META[r.bidang];
                        return (
                            <div
                                key={r.bidang}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "215px minmax(0, 1fr) 130px",
                                    gap: 18,
                                    alignItems: "center",
                                }}
                            >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                    <span style={{ width: 14, height: 2, background: meta.accent, flexShrink: 0 }} />
                                    <span
                                        style={{
                                            fontSize: 13.5,
                                            fontWeight: 700,
                                            color: "var(--fg-0)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.07em",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {meta.label}
                                    </span>
                                </span>
                                <SegBar close={r.close} total={r.total} ntClose={r.ntClose} height={32} fontSize={14} radius={7} minPctLabel={13} />
                                <span
                                    style={{
                                        fontFamily: "var(--font-mono, monospace)",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "var(--fg-1)",
                                        fontFeatureSettings: '"tnum"',
                                        textAlign: "right",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 16 }}>{fmtNum(r.close)}</span>
                                    {r.ntClose > 0 && <span style={{ fontSize: 11, color: "var(--cond-good)" }}>(+{fmtNum(r.ntClose)})</span>}
                                    <span style={{ color: "var(--fg-2)", margin: "0 4px" }}>/</span>
                                    {fmtNum(r.total)}
                                    {r.ntTotal > 0 && <span style={{ fontSize: 11, color: "var(--cond-good)" }}>(+{fmtNum(r.ntTotal)})</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            {divider && <div style={{ background: "var(--line)" }} />}
        </>
    );
}
