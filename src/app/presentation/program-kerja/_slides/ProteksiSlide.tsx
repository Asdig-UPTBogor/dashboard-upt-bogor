"use client";

import { LM_ITEMS, ABO_ITEMS, PK_ITEMS, PROTEKSI_KATEGORI_ACCENT } from "@/app/presentation/proteksi/program-kerja/_data/proteksi-items";
import { ProgramBarChartProteksi } from "@/app/presentation/proteksi/program-kerja/_components/ProgramBarChartProteksi";
import { SlideHeadCompact, HeroSlim, UltgCard, PanelCard } from "../_components/SlideShared";

const BIDANG = "Proteksi";
const PERIODE = "2026";
const C = {
    abo: PROTEKSI_KATEGORI_ACCENT.abo,    // biru
    lm: PROTEKSI_KATEGORI_ACCENT.lm,      // kuning
    pk: PROTEKSI_KATEGORI_ACCENT.pk,      // magenta
    bogor: "#06b6d4",                      // cyan
    sukabumi: "#f08a3e",                   // orange
    total: "#a855f7",                      // violet
};

export function ProteksiSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const allItems = [...ABO_ITEMS, ...LM_ITEMS, ...PK_ITEMS];
    const totalT = allItems.reduce((s, it) => s + it.totalTarget, 0);
    const totalR = allItems.reduce((s, it) => s + it.totalReal, 0);
    const aboT = ABO_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const aboR = ABO_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const lmT = LM_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const lmR = LM_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const pkT = PK_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const pkR = PK_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const bogorT = allItems.reduce((s, it) => s + it.targetBogor, 0);
    const bogorR = allItems.reduce((s, it) => s + it.realBogor, 0);
    const skbmT = allItems.reduce((s, it) => s + it.targetSukabumi, 0);
    const skbmR = allItems.reduce((s, it) => s + it.realSukabumi, 0);

    return (
        <section className="slide" style={{ padding: "32px 64px 24px" }}>
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

            {/* Hero KPI: Total + ABO + LM + PK (urutan ABO → PS/LM → kategori unik) */}
            <HeroSlim panels={[
                { caption: "Program Kerja Proteksi", count: allItems.length, target: totalT, real: totalR, accent: C.total, highlight: true },
                { caption: "Anti Blackout", count: ABO_ITEMS.length, target: aboT, real: aboR, accent: C.abo },
                { caption: "LM / 4DX", count: LM_ITEMS.length, target: lmT, real: lmR, accent: C.lm },
                { caption: "Peningkatan Keandalan", count: PK_ITEMS.length, target: pkT, real: pkR, accent: C.pk },
            ]} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <UltgCard
                    name="ULTG Bogor" target={bogorT} real={bogorR} accent={C.bogor}
                    countItems={[
                        { label: "ABO", count: ABO_ITEMS.filter((it) => it.targetBogor > 0).length, color: C.abo },
                        { label: "LM", count: LM_ITEMS.filter((it) => it.targetBogor > 0).length, color: C.lm },
                        { label: "PK", count: PK_ITEMS.filter((it) => it.targetBogor > 0).length, color: C.pk },
                    ]}
                />
                <UltgCard
                    name="ULTG Sukabumi" target={skbmT} real={skbmR} accent={C.sukabumi}
                    countItems={[
                        { label: "ABO", count: ABO_ITEMS.filter((it) => it.targetSukabumi > 0).length, color: C.abo },
                        { label: "LM", count: LM_ITEMS.filter((it) => it.targetSukabumi > 0).length, color: C.lm },
                        { label: "PK", count: PK_ITEMS.filter((it) => it.targetSukabumi > 0).length, color: C.pk },
                    ]}
                />
            </div>

            {/* 3 panel bar list — urutan ABO → LM → PK */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "4fr 3fr 5fr",
                gap: 20,
                flex: 1,
                minHeight: 0,
            }}>
                <PanelCard title="Anti Blackout" count={ABO_ITEMS.length} accent={C.abo}>
                    <ProgramBarChartProteksi items={ABO_ITEMS} accent={C.abo} cols={1} />
                </PanelCard>
                <PanelCard title="LM / 4DX" count={LM_ITEMS.length} accent={C.lm}>
                    <ProgramBarChartProteksi items={LM_ITEMS} accent={C.lm} cols={1} />
                </PanelCard>
                <PanelCard title="Peningkatan Keandalan" count={PK_ITEMS.length} accent={C.pk}>
                    <ProgramBarChartProteksi items={PK_ITEMS} accent={C.pk} cols={2} />
                </PanelCard>
            </div>
        </section>
    );
}
