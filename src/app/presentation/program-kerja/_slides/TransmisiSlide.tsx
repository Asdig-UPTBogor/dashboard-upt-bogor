"use client";

import { useMemo, useState } from "react";
import { usePageData } from "@/hooks/usePageData";
import { Skeleton } from "@/components/ui/skeleton";
import {
    normalizeItem,
    type ProgramItem,
} from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";
import { ProgramRechartsBar } from "@/app/transmisi/program-kerja-transmisi/_components/v2/ProgramRechartsBar";
import { SlideHeadCompact, HeroSlim, UltgCard, PanelCard } from "../_components/SlideShared";

const BIDANG = "Transmisi";
const PERIODE = "2026";

const C = {
    abo: "#5b8def",       // biru
    lm: "#f3c14b",        // amber
    bogor: "#06b6d4",     // cyan
    sukabumi: "#f08a3e",  // orange
    total: "#a855f7",     // violet
};

/**
 * Slide deck Transmisi — mirror dashboard pattern:
 * 1 card, 2 section bar chart (ABO atas + PS bawah), catatan tanpa target di bottom.
 */
export function TransmisiSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const { sheets, loading, error } = usePageData("/transmisi/program-kerja");

    /* Filter state — clickable interactivity (mirror dashboard) */
    const [activeUltg, setActiveUltg] = useState<"bogor" | "sukabumi" | null>(null);
    const [activePanel, setActivePanel] = useState<"abo" | "lm" | null>(null);
    const toggleUltg = (k: "bogor" | "sukabumi") =>
        setActiveUltg((cur) => (cur === k ? null : k));
    const togglePanel = (k: string) =>
        setActivePanel((cur) => (cur === k ? null : (k as "abo" | "lm")));

    const items: ProgramItem[] = useMemo(() => {
        const rows = sheets?.[0]?.rows || [];
        return rows.map(normalizeItem).filter((it) => it.namaProgram);
    }, [sheets]);

    if (loading) return <SlideLoading text="Memuat data Transmisi…" />;
    if (error || items.length === 0) return <SlideLoading text={error || "Belum ada data"} />;

    /* ULTG-aware projection — saat activeUltg set, pakai value bogor/sukabumi-specific */
    const projectedItems = activeUltg
        ? items.map((it) => ({
              ...it,
              totalTarget: activeUltg === "bogor" ? it.targetBogor : it.targetSukabumi,
              totalRealisasi: activeUltg === "bogor" ? it.realisasiBogor : it.realisasiSukabumi,
          }))
        : items;

    const totalT = projectedItems.reduce((s, it) => s + it.totalTarget, 0);
    const totalR = projectedItems.reduce((s, it) => s + it.totalRealisasi, 0);
    const aboItems = projectedItems.filter((it) => it.programKerja === "abo");
    const lmItems = projectedItems.filter((it) => it.programKerja === "lm");
    const aboT = aboItems.reduce((s, it) => s + it.totalTarget, 0);
    const aboR = aboItems.reduce((s, it) => s + it.totalRealisasi, 0);
    const lmT = lmItems.reduce((s, it) => s + it.totalTarget, 0);
    const lmR = lmItems.reduce((s, it) => s + it.totalRealisasi, 0);
    const bogorT = items.reduce((s, it) => s + it.targetBogor, 0);
    const bogorR = items.reduce((s, it) => s + it.realisasiBogor, 0);
    const skbmT = items.reduce((s, it) => s + it.targetSukabumi, 0);
    const skbmR = items.reduce((s, it) => s + it.realisasiSukabumi, 0);

    /* Split bertarget vs tanpa target, ULTG filter aware */
    const aboWithTarget = aboItems.filter((it) => it.totalTarget > 0);
    const lmWithTarget = lmItems.filter((it) => it.totalTarget > 0);
    const noTargetAbo = aboItems.filter((it) => it.totalTarget === 0);
    const noTargetLm = lmItems.filter((it) => it.totalTarget === 0);
    const hasNoTarget = noTargetAbo.length > 0 || noTargetLm.length > 0;

    /* Chart items — filter by activePanel kalau di-klik */
    const chartAbo = activePanel === "lm" ? [] : aboWithTarget;
    const chartLm = activePanel === "abo" ? [] : lmWithTarget;
    const chartItems = [...chartAbo, ...chartLm];

    /* rowHeight cuma dipakai buat hitung barSize proporsional (rowHeight*0.5).
       Chart height itself fill parent via fillHeight=true — recharts distribute rows otomatis.
       Pick rowHeight 32 (medium bar ~16px) — visually balance ABO+PS gabungan. */
    const rowHeightForBar = 32;

    return (
        <section className="slide" style={{ padding: "32px 64px 24px" }}>
            {/* Header row */}
            <div className="flex justify-between items-end gap-3" style={{ marginBottom: 16 }}>
                <h1 style={{
                    fontSize: 44,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    color: "var(--fg-0)",
                }}>
                    Program Kerja {BIDANG} <span style={{ color: C.lm }}>{PERIODE}</span>
                </h1>
                <SlideHeadCompact pageNo={slideNo} total={total} section={`Program Kerja ${BIDANG}`} />
            </div>

            {/* Hero KPI strip — clickable filter ABO/PS */}
            <HeroSlim
                panels={[
                    { caption: "Program Kerja Transmisi", count: items.length, target: totalT, real: totalR, accent: C.total, highlight: true },
                    { caption: "Anti Blackout", count: aboItems.length, target: aboT, real: aboR, accent: C.abo, key: "abo" },
                    { caption: "Program Strategis", count: lmItems.length, target: lmT, real: lmR, accent: C.lm, key: "lm" },
                ]}
                activeKey={activePanel}
                onPanelClick={togglePanel}
            />

            {/* ULTG row — clickable. Saat 1 ULTG aktif → fill full-width, sembunyikan yang lain */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: activeUltg ? "1fr" : "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                }}
            >
                {(activeUltg === null || activeUltg === "bogor") && (
                    <UltgCard
                        name="ULTG Bogor"
                        target={bogorT}
                        real={bogorR}
                        accent={C.bogor}
                        countItems={[
                            { label: "ABO", count: items.filter((it) => it.programKerja === "abo" && it.targetBogor > 0).length, color: C.abo },
                            { label: "PS", count: items.filter((it) => it.programKerja === "lm" && it.targetBogor > 0).length, color: C.lm },
                        ]}
                        isActive={activeUltg === "bogor"}
                        onClick={() => toggleUltg("bogor")}
                    />
                )}
                {(activeUltg === null || activeUltg === "sukabumi") && (
                    <UltgCard
                        name="ULTG Sukabumi"
                        target={skbmT}
                        real={skbmR}
                        accent={C.sukabumi}
                        countItems={[
                            { label: "ABO", count: items.filter((it) => it.programKerja === "abo" && it.targetSukabumi > 0).length, color: C.abo },
                            { label: "PS", count: items.filter((it) => it.programKerja === "lm" && it.targetSukabumi > 0).length, color: C.lm },
                        ]}
                        isActive={activeUltg === "sukabumi"}
                        onClick={() => toggleUltg("sukabumi")}
                    />
                )}
            </div>

            {/* 1 card combined — bar chart utama + catatan tanpa target di SAMPING (save vertical) */}
            <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column" }}>
                <PanelCard title="Progress Program Kerja" count={items.length} accent={C.total}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: hasNoTarget ? "1fr 1px 280px" : "1fr",
                            columnGap: 18,
                            alignItems: "stretch",
                            flex: 1,
                            minHeight: 0,
                            height: "100%",
                        }}
                    >
                        {/* Bar chart — kolom utama, fill parent height (auto-distribute rows by recharts) */}
                        <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                            <ProgramRechartsBar
                                items={chartItems}
                                accent={C.abo}
                                colorMap={{ abo: C.abo, lm: C.lm }}
                                groupSort
                                groupOrder={["abo", "lm"]}
                                rowHeight={rowHeightForBar}
                                fontScale={1.2}
                                disableAnimation
                                fillHeight
                            />
                        </div>

                        {/* Divider vertikal */}
                        {hasNoTarget && (
                            <div style={{ alignSelf: "stretch", background: "var(--line)" }} />
                        )}

                        {/* Catatan tanpa target — side panel kanan, vertical stack */}
                        {hasNoTarget && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ width: 16, height: 1.5, background: "var(--fg-3)", flexShrink: 0 }} />
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: "var(--fg-2)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.12em",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Tanpa Target
                                    </span>
                                    <span className="num" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                                        {noTargetAbo.length + noTargetLm.length}
                                    </span>
                                </div>
                                {noTargetAbo.length > 0 && (
                                    <NoTargetGroup label="Anti Blackout" accent={C.abo} items={noTargetAbo} />
                                )}
                                {noTargetLm.length > 0 && (
                                    <NoTargetGroup label="Strategis" accent={C.lm} items={noTargetLm} />
                                )}
                            </div>
                        )}
                    </div>
                </PanelCard>
            </div>
        </section>
    );
}

function NoTargetGroup({ label, accent, items }: { label: string; accent: string; items: ProgramItem[] }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Header: dot + label uppercase + count */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                <span
                    style={{
                        fontSize: 12,
                        color: accent,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                    }}
                >
                    {label}
                </span>
                <span className="num" style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600 }}>
                    {items.length}
                </span>
            </div>
            {/* Items: bullet + nama program */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {items.map((it, i) => (
                    <div
                        key={`${it.no || i}-${it.namaProgram}`}
                        style={{
                            fontSize: 12,
                            color: "var(--fg-1)",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 6,
                            lineHeight: 1.4,
                        }}
                    >
                        <span
                            style={{
                                width: 3,
                                height: 3,
                                borderRadius: "50%",
                                background: "var(--fg-3)",
                                flexShrink: 0,
                                marginTop: 6,
                            }}
                        />
                        <span style={{ wordBreak: "break-word" }}>{it.namaProgram}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SlideLoading({ text }: { text: string }) {
    return (
        <section className="slide" style={{ alignItems: "center", justifyContent: "center", gap: 16 }}>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-32 w-full max-w-2xl rounded-md" />
            <p className="ds-body">{text}</p>
        </section>
    );
}
