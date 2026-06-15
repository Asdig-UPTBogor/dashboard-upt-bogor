"use client";

/**
 * Slide 1 bidang CE (Transmisi / Gardu Induk / Proteksi) — komposisi:
 *   1. SlideHeader (pola deck PK) — judul bersih, tanpa angka (info di hero band).
 *   2. Hero band — panel highlight (Total Anomali · Sub CE · Close · Open + bar segmented)
 *      + panel split per ULTG CLICKABLE = filter slide (pattern page CE).
 *   3. [Transmisi] Band ROW · Right of Way — skala besar dipisah dari anomali CE.
 *   4. Panel Sub CE — bar segmented close/open per program, % di dalam segmen.
 *      Default angka RESMI ce_summary; saat filter ULTG aktif → proyeksi rincian.
 *   5. Footnotes kejujuran data (sinkronisasi rincian / non-target / tanpa ULTG).
 *
 * Konsep non-target ("sunnah", LOCKED): NT hanya MENAMBAH — anotasi (+n)/(+%)
 * warna cond-good (close) / cond-poor (open), bonus masuk angka utama hanya
 * setelah target tuntas (label gated di SegBar).
 */

import { useState } from "react";
import { SlideHeader } from "@/app/presentation/program-kerja/_components/SlideShared";
import {
    CE_BIDANG_META,
    fmtNum,
    fmtPct,
    pct,
    pctColor,
    type BidangDeck,
} from "../_lib/ce-deck";
import {
    DashCaption,
    Footnotes,
    NtNote,
    SegBar,
    SlideLoading,
    StatBig,
    UltgPanel,
    VDivider,
} from "../_components/CeSlideShared";

export function CeBidangSlide({
    slideNo,
    total,
    deck,
    row,
    loading,
    error,
}: {
    slideNo: number;
    total: number;
    deck: BidangDeck | null;
    /** ROW Right of Way (khusus transmisi) — dari meta tx_row_*. */
    row?: { target: number; realisasi: number } | null;
    loading: boolean;
    error?: string | null;
}) {
    const [activeUltg, setActiveUltg] = useState<string | null>(null);
    const meta = deck ? CE_BIDANG_META[deck.bidang] : null;

    if (loading) return <SlideLoading text="Memuat data Common Enemy…" />;
    if (error || !deck || !meta || deck.total === 0) {
        return <SlideLoading text={error || "Belum ada data Common Enemy"} />;
    }

    const hasRow = !!row && row.target > 0;

    /* Filter ULTG aktif → semua angka slide proyeksi rincian ULTG itu (pattern page CE). */
    const au = activeUltg ? deck.ultg.find((u) => u.key === activeUltg) ?? null : null;
    const view = au
        ? {
              total: au.total,
              close: au.close,
              open: Math.max(au.total - au.close, 0),
              ntClose: au.ntClose,
              ntOpen: Math.max(au.ntTotal - au.ntClose, 0),
              /* Program tanpa item di ULTG aktif di-HIDE (pattern page CE). */
              programs: au.programs.filter((p) => p.target > 0 || p.ntTotal > 0),
          }
        : {
              total: deck.total,
              close: deck.close,
              open: deck.open,
              ntClose: deck.ntClose,
              ntOpen: deck.ntOpen,
              programs: deck.programs,
          };
    const ntTotal = view.ntClose + view.ntOpen;

    /* Footnotes kejujuran data */
    const notes: string[] = [];
    if (au) {
        notes.push(`Filter ${au.name} aktif — angka berbasis rincian item target (klik lagi untuk hapus filter).`);
    } else if (deck.detailTargetClose !== deck.close) {
        notes.push(
            `Split ULTG berbasis rincian item target — realisasi rincian terinput ${fmtNum(deck.detailTargetClose)} dari ${fmtNum(deck.close)} angka resmi GRAFIK.`,
        );
    }
    if (ntTotal > 0) {
        notes.push(
            `${fmtNum(ntTotal)} anomali non-target (${fmtNum(view.ntClose)} close · ${fmtNum(view.ntOpen)} open) dipantau di luar target Common Enemy.`,
        );
    }
    if (!au && deck.noUltgTarget > 0) {
        notes.push(`${fmtNum(deck.noUltgTarget)} item target tanpa ULTG tidak masuk split ULTG.`);
    }

    return (
        <section className="slide" style={{ padding: "32px 64px 24px" }}>
            <SlideHeader
                eyebrow={`UPT Bogor · Common Enemy ${meta.label}`}
                title={<>Common Enemy {meta.label} <span style={{ color: meta.accent }}>2026</span></>}
                pageNo={slideNo}
                total={total}
                section={`CE ${meta.label}`}
                dataStamp
            />

            {/* ── Hero band: highlight bidang + split ULTG (clickable filter) ── */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `1.55fr ${deck.ultg.map(() => "1fr").join(" ")}`,
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 16,
                }}
            >
                <div
                    style={{
                        padding: "20px 26px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        background: `radial-gradient(ellipse 55% 80% at 0% 0%, color-mix(in oklab, ${meta.accent} 8%, transparent), transparent 60%)`,
                    }}
                >
                    <DashCaption
                        accent={meta.accent}
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
                        Common Enemy {meta.label}
                    </DashCaption>
                    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flex: 1, justifyContent: "space-between" }}>
                        <StatBig
                            value={fmtNum(view.total)}
                            label="Total Anomali"
                            size={46}
                            extra={ntTotal > 0 ? <NtNote text={`+${fmtNum(ntTotal)} NT`} kind="close" /> : undefined}
                        />
                        <VDivider />
                        <StatBig value={fmtNum(view.programs.length)} label="Sub CE" size={46} />
                        <VDivider />
                        <StatBig
                            value={fmtNum(view.close)}
                            label="Close"
                            color="var(--cond-very-good)"
                            size={46}
                            extra={view.ntClose > 0 ? <NtNote text={`(+${fmtNum(view.ntClose)})`} kind="close" /> : undefined}
                        />
                        <VDivider />
                        <StatBig
                            value={fmtNum(view.open)}
                            label="Open"
                            color="var(--cond-poor)"
                            size={46}
                            extra={view.ntOpen > 0 ? <NtNote text={`(+${fmtNum(view.ntOpen)})`} kind="open" /> : undefined}
                        />
                    </div>
                    <SegBar close={view.close} total={view.total} ntClose={view.ntClose} height={16} fontSize={12.5} minPctLabel={9} />
                </div>

                {deck.ultg.map((u) => (
                    <div key={u.key} style={{ borderLeft: "1px solid var(--line)", display: "flex", minWidth: 0 }}>
                        <UltgPanel
                            name={u.name}
                            accent={u.accent}
                            total={u.total}
                            close={u.close}
                            ntTotal={u.ntTotal}
                            ntClose={u.ntClose}
                            isActive={activeUltg === u.key}
                            isDimmed={activeUltg !== null && activeUltg !== u.key}
                            onClick={() => setActiveUltg((k) => (k === u.key ? null : u.key))}
                        />
                    </div>
                ))}
            </div>

            {/* ── ROW band (khusus transmisi) ── */}
            {hasRow && row && <RowBand target={row.target} realisasi={row.realisasi} />}

            {/* ── Panel Sub CE — bar per program (react ke filter ULTG) ── */}
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
                    <DashCaption
                        accent={meta.accent}
                        size={14}
                        after={
                            au ? (
                                <span
                                    style={{
                                        fontSize: 12,
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
                        Sub CE {meta.label}
                    </DashCaption>
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--fg-1)",
                            fontFamily: "var(--font-mono, monospace)",
                            fontFeatureSettings: '"tnum"',
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                        }}
                    >
                        <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 14, marginRight: 5 }}>
                            {fmtNum(view.programs.length)}
                        </span>
                        Program
                    </span>
                </div>

                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        padding: "10px 26px 18px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-evenly",
                    }}
                >
                    {view.programs.map((p) => (
                        <div
                            key={p.program}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "430px minmax(0, 1fr) 190px",
                                gap: 26,
                                alignItems: "center",
                            }}
                        >
                            <span
                                title={p.program}
                                style={{
                                    fontSize: 20,
                                    fontWeight: 600,
                                    color: "var(--fg-0)",
                                    lineHeight: 1.25,
                                    letterSpacing: "-0.005em",
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                }}
                            >
                                {p.program}
                            </span>
                            <SegBar close={p.realisasi} total={p.target} ntClose={p.ntClose} height={36} fontSize={15.5} radius={8} minPctLabel={12} />
                            <span
                                style={{
                                    fontFamily: "var(--font-mono, monospace)",
                                    fontWeight: 600,
                                    color: "var(--fg-1)",
                                    fontFeatureSettings: '"tnum"',
                                    textAlign: "right",
                                    whiteSpace: "nowrap",
                                    fontSize: 19,
                                }}
                            >
                                <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 25 }}>{fmtNum(p.realisasi)}</span>
                                {p.ntClose > 0 && (
                                    <span style={{ fontSize: 14, color: "var(--cond-good)" }}>(+{fmtNum(p.ntClose)})</span>
                                )}
                                <span style={{ color: "var(--fg-2)", margin: "0 6px" }}>/</span>
                                {fmtNum(p.target)}
                                {p.ntTotal > 0 && (
                                    <span style={{ fontSize: 14, color: "var(--cond-good)" }}>(+{fmtNum(p.ntTotal)})</span>
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <Footnotes notes={notes} />
        </section>
    );
}

/* ─────────── ROW band — Right of Way Transmisi (skala besar, dipisah dari CE) ─────────── */

function RowBand({ target, realisasi }: { target: number; realisasi: number }) {
    const p = pct(realisasi, target);
    const sisa = Math.max(target - realisasi, 0);
    return (
        <div
            style={{
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "16px 26px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginBottom: 16,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <DashCaption accent="var(--fg-3)" size={13}>ROW · Right of Way</DashCaption>
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
                    Skala besar &middot; dipantau terpisah dari anomali CE
                </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                {/* Stats kiri — mono besar */}
                <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexShrink: 0 }}>
                    <StatBig value={fmtNum(target)} label="Target" size={34} />
                    <VDivider />
                    <StatBig value={fmtNum(realisasi)} label="Realisasi" color="var(--cond-very-good)" size={34} />
                    <VDivider />
                    <StatBig value={fmtNum(sisa)} label="Sisa" color="var(--cond-poor)" size={34} />
                    <VDivider />
                    <StatBig value={`${fmtPct(p)}%`} label="Progress" color={pctColor(p)} size={34} />
                </div>

                {/* Bar segmented — fill sisanya */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <SegBar close={realisasi} total={target} height={20} fontSize={12} radius={6} minPctLabel={8} />
                </div>
            </div>
        </div>
    );
}
