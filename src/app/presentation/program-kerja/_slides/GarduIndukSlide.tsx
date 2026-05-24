"use client";

import { IL2_ITEMS, PS_ITEMS, ABO_ITEMS, GI_KATEGORI_ACCENT } from "@/app/presentation/gardu-induk/program-kerja/_data/gi-items";
import { ProgramBarChartGi } from "@/app/presentation/gardu-induk/program-kerja/_components/ProgramBarChartGi";
import { SlideHeadCompact, HeroSlim, UltgCard, PanelCard } from "../_components/SlideShared";

const BIDANG = "Gardu Induk";
const PERIODE = "2026";
/* LOCKED PALETTE — distinct per entitas (jangan reuse warna lain):
   ABO biru | PS kuning | IL 2 hijau | ULTG Bogor cyan | ULTG Sukabumi orange | Total violet */
const C = {
    il2: GI_KATEGORI_ACCENT.il2,    // hijau
    ps: GI_KATEGORI_ACCENT.ps,      // kuning
    abo: GI_KATEGORI_ACCENT.abo,    // biru
    bogor: "#06b6d4",               // cyan (distinct dari ABO biru)
    sukabumi: "#f08a3e",            // orange
    total: "#a855f7",               // violet (distinct dari IL 2 hijau)
};

export function GarduIndukSlide({ slideNo, total }: { slideNo: number; total: number }) {
    const allItems = [...IL2_ITEMS, ...PS_ITEMS, ...ABO_ITEMS];
    const totalT = allItems.reduce((s, it) => s + it.totalTarget, 0);
    const totalR = allItems.reduce((s, it) => s + it.totalReal, 0);
    const il2T = IL2_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const il2R = IL2_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const psT = PS_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const psR = PS_ITEMS.reduce((s, it) => s + it.totalReal, 0);
    const aboT = ABO_ITEMS.reduce((s, it) => s + it.totalTarget, 0);
    const aboR = ABO_ITEMS.reduce((s, it) => s + it.totalReal, 0);
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
                    Program Kerja {BIDANG} <span style={{ color: C.ps }}>{PERIODE}</span>
                </h1>
                <SlideHeadCompact pageNo={slideNo} total={total} section={`Program Kerja ${BIDANG}`} />
            </div>

            {/* Urutan locked: Total → ABO → PS → IL 2 */}
            <HeroSlim panels={[
                { caption: "Program Kerja Gardu Induk", count: allItems.length, target: totalT, real: totalR, accent: C.total, highlight: true },
                { caption: "Anti Blackout", count: ABO_ITEMS.length, target: aboT, real: aboR, accent: C.abo },
                { caption: "Program Strategis", count: PS_ITEMS.length, target: psT, real: psR, accent: C.ps },
                { caption: "IL 2", count: IL2_ITEMS.length, target: il2T, real: il2R, accent: C.il2 },
            ]} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <UltgCard
                    name="ULTG Bogor" target={bogorT} real={bogorR} accent={C.bogor}
                    countItems={[
                        { label: "ABO", count: ABO_ITEMS.filter((it) => it.targetBogor > 0).length, color: C.abo },
                        { label: "PS", count: PS_ITEMS.filter((it) => it.targetBogor > 0).length, color: C.ps },
                        { label: "IL 2", count: IL2_ITEMS.filter((it) => it.targetBogor > 0).length, color: C.il2 },
                    ]}
                />
                <UltgCard
                    name="ULTG Sukabumi" target={skbmT} real={skbmR} accent={C.sukabumi}
                    countItems={[
                        { label: "ABO", count: ABO_ITEMS.filter((it) => it.targetSukabumi > 0).length, color: C.abo },
                        { label: "PS", count: PS_ITEMS.filter((it) => it.targetSukabumi > 0).length, color: C.ps },
                        { label: "IL 2", count: IL2_ITEMS.filter((it) => it.targetSukabumi > 0).length, color: C.il2 },
                    ]}
                />
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: "3fr 5fr 4fr",
                gap: 20,
                flex: 1,
                minHeight: 0,
            }}>
                <PanelCard title="Anti Blackout" count={ABO_ITEMS.length} accent={C.abo}>
                    <ProgramBarChartGi items={ABO_ITEMS} accent={C.abo} cols={1} />
                </PanelCard>
                <PanelCard title="Program Strategis" count={PS_ITEMS.length} accent={C.ps}>
                    <ProgramBarChartGi items={PS_ITEMS} accent={C.ps} cols={2} />
                </PanelCard>
                <PanelCard title="IL 2" count={IL2_ITEMS.length} accent={C.il2}>
                    <ProgramBarChartGi items={IL2_ITEMS} accent={C.il2} cols={1} />
                </PanelCard>
            </div>
        </section>
    );
}
