"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import { Card } from "@/components/designer/Card";
import { Badge } from "@/components/designer/Badge";
import { Btn, IconBtn } from "@/components/designer/Button";
import { Icon } from "@/components/designer/Icon";
import { Hero } from "./v2/Hero";
import { UltgProgressCard } from "./v2/UltgProgressCard";
import { ProgramListBars } from "./v2/ProgramListBars";
import { DataTable } from "./v2/DataTable";
import {
  normalizeItem,
  KATEGORI_SHORT,
  KATEGORI_KEYS,
  type ProgramItem,
  type KategoriKey,
} from "./program-kerja-data";

interface SheetData {
  headers?: string[];
  rows?: Record<string, string>[];
}

const ABO_ACCENT = "var(--chart-1)";
const STRATEGIS_ACCENT = "var(--accent-amber)";

function buildPareto(items: ProgramItem[]) {
  const sumByKat: Record<KategoriKey, number> = {
    visual_inspection: 0,
    offline_measurement: 0,
    pcm_petir: 0,
    pcm_benda: 0,
    pcm_binatang: 0,
    pcm_tegakan: 0,
    pcm_alat: 0,
  };
  items.forEach((it) => {
    if (it.kategoriKey) sumByKat[it.kategoriKey] += it.totalTarget;
  });
  const total = Object.values(sumByKat).reduce((a, b) => a + b, 0);
  return KATEGORI_KEYS
    .map((k) => ({
      name: KATEGORI_SHORT[k],
      value: sumByKat[k],
      pct: total === 0 ? 0 : (sumByKat[k] / total) * 100,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

function ProgramListHeader({
  prefix,
  suffix,
  count,
  accent,
}: {
  prefix: string;
  suffix: string;
  count: number;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 16, height: 1.5, background: accent, flexShrink: 0 }} />
        <span
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          <span style={{ color: "var(--fg-0)" }}>{prefix}</span>
          <span style={{ color: accent, marginLeft: 6 }}>{suffix}</span>
        </span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: "var(--fg-2)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span className="ds-led-dot" style={{ color: accent }} />
        <span style={{ letterSpacing: "0.04em" }}>{count} program</span>
      </span>
    </div>
  );
}

function sumTotals(items: ProgramItem[]) {
  let target = 0;
  let realisasi = 0;
  items.forEach((it) => {
    target += it.totalTarget;
    realisasi += it.totalRealisasi;
  });
  return { target, realisasi };
}

function sumUltg(items: ProgramItem[]) {
  let bogorT = 0, bogorR = 0, skbmT = 0, skbmR = 0;
  let bogorAbo = 0, bogorPs = 0, skbmAbo = 0, skbmPs = 0;
  items.forEach((it) => {
    bogorT += it.targetBogor;
    bogorR += it.realisasiBogor;
    skbmT += it.targetSukabumi;
    skbmR += it.realisasiSukabumi;
    if (it.targetBogor > 0) {
      if (it.programKerja === "abo") bogorAbo += 1;
      else if (it.programKerja === "lm") bogorPs += 1;
    }
    if (it.targetSukabumi > 0) {
      if (it.programKerja === "abo") skbmAbo += 1;
      else if (it.programKerja === "lm") skbmPs += 1;
    }
  });
  return [
    {
      key: "bogor",
      name: "ULTG Bogor",
      target: bogorT,
      realisasi: bogorR,
      accent: "#5b8def",
      aboCount: bogorAbo,
      psCount: bogorPs,
    },
    {
      key: "sukabumi",
      name: "ULTG Sukabumi",
      target: skbmT,
      realisasi: skbmR,
      accent: "#f08a3e",
      aboCount: skbmAbo,
      psCount: skbmPs,
    },
  ];
}

/** Project ProgramItem by ULTG filter — replace totalTarget/Realisasi
 * with bogor/sukabumi-specific values when activeUltg active. */
function projectByUltg(items: ProgramItem[], ultg: "bogor" | "sukabumi" | null): ProgramItem[] {
  if (!ultg) return items;
  return items.map((it) => ({
    ...it,
    totalTarget: ultg === "bogor" ? it.targetBogor : it.targetSukabumi,
    totalRealisasi: ultg === "bogor" ? it.realisasiBogor : it.realisasiSukabumi,
  }));
}

export function ProgramKerjaTransmisiContent({ sheets, embedded }: { sheets: SheetData[] | undefined; embedded?: boolean }) {
  const [activePanel, setActivePanel] = useState<"abo" | "lm" | null>(null);
  const togglePanel = (p: "abo" | "lm") => setActivePanel((cur) => (cur === p ? null : p));

  const [activeUltg, setActiveUltg] = useState<"bogor" | "sukabumi" | null>(null);
  const toggleUltg = (key: string) => {
    const k = key as "bogor" | "sukabumi";
    setActiveUltg((cur) => (cur === k ? null : k));
  };

  const allItems: ProgramItem[] = useMemo(() => {
    const rows = sheets?.[0]?.rows || [];
    return rows.map(normalizeItem).filter((it) => it.namaProgram);
  }, [sheets]);

  // Project items by ULTG filter (jika active) — semua aggregate jadi bogor/sukabumi specific
  const projectedItems = useMemo(() => projectByUltg(allItems, activeUltg), [allItems, activeUltg]);

  // Saat ULTG aktif, filter out program tanpa target di ULTG itu — count + listing only program
  // yang relevant ke ULTG terpilih.
  const lmItems = useMemo(() => {
    let items = projectedItems.filter((it) => it.programKerja === "lm");
    if (activeUltg) items = items.filter((it) => it.totalTarget > 0);
    return items;
  }, [projectedItems, activeUltg]);

  const aboItems = useMemo(() => {
    let items = projectedItems.filter((it) => it.programKerja === "abo");
    if (activeUltg) items = items.filter((it) => it.totalTarget > 0);
    return items;
  }, [projectedItems, activeUltg]);

  const totals = useMemo(() => {
    let target = 0;
    let realisasi = 0;
    projectedItems.forEach((it) => {
      target += it.totalTarget;
      realisasi += it.totalRealisasi;
    });
    return { target, realisasi };
  }, [projectedItems]);

  const ultgRows = useMemo(() => sumUltg(allItems), [allItems]);

  const paretoABO = useMemo(() => buildPareto(aboItems), [aboItems]);
  const paretoLM = useMemo(() => buildPareto(lmItems), [lmItems]);

  const aboTotals = useMemo(() => sumTotals(aboItems), [aboItems]);
  const lmTotals = useMemo(() => sumTotals(lmItems), [lmItems]);


  if (allItems.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="Belum ada data" subtitle="Sumber: Master_Transmisi_UPT_Bogor.n_14_LM_JARINGAN_2026">
          <p style={{ margin: 0, fontSize: 12, color: "var(--fg-2)" }}>
            Belum ada baris program yang ter-load dari BigQuery. Cek konfigurasi page-config Firestore atau koneksi BQ.
          </p>
        </Card>
      </div>
    );
  }

  const modelToolbar = (
    <div className="flex justify-start items-center gap-3">
      <span
        style={{
          fontSize: 10.5,
          color: "var(--fg-3)",
          letterSpacing: "0.04em",
        }}
      >
        Model: <span style={{ color: "var(--fg-2)" }}>Dashboard UPT Bogor</span>
      </span>
      <Btn icon="download" variant="ghost" size="sm">Ekspor</Btn>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Page header — hide kalau embedded di hub Tabs */}
      {!embedded && (
        <div className="flex justify-between items-end gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
              <span>Monitoring</span>
              <Icon name="chevronRight" size={11} />
              <span>Transmisi</span>
              <Icon name="chevronRight" size={11} />
              <span style={{ color: "var(--fg-0)" }}>Program Kerja Transmisi</span>
            </div>
            <h1 className="ds-heading">Program Kerja Transmisi 2026</h1>
            <p className="ds-body mt-0.5">
              Monitoring Program Kerja · Transmisi · UPT Bogor
            </p>
          </div>
          {modelToolbar}
        </div>
      )}

      {/* Grid 12-col */}
      <div className="grid grid-cols-12 gap-3">
        {/* Hero — golden ratio 1.618:1:1, style identik antar panel */}
        <Hero
          activePanel={activePanel}
          onPanelClick={(key) => togglePanel(key as "abo" | "lm")}
          total={{
            key: "total",
            caption: "Program Kerja Transmisi",
            totalItem: totals.target,
            realisasi: totals.realisasi,
            programCount: allItems.length,
            accent: "#3ecf8e",
            accent2: "#8dd884",
            showSyncBadge: true,
          }}
          panels={[
            {
              key: "abo",
              caption: "Anti Blackout",
              nickname: "ABO",
              totalItem: aboTotals.target,
              realisasi: aboTotals.realisasi,
              programCount: aboItems.length,
              accent: "#5b8def",
              accent2: "#4cc9c0",
            },
            {
              key: "lm",
              caption: "Program Strategis",
              nickname: "PS",
              totalItem: lmTotals.target,
              realisasi: lmTotals.realisasi,
              programCount: lmItems.length,
              accent: "#f3c14b",
              accent2: "#fcd34d",
            },
          ]}
        />

        {/* Penyebaran per ULTG — 4 col, hijau selesai / oranye belum */}
        <motion.div
          layout
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="col-span-12 md:col-span-6 xl:col-span-4 flex min-w-0"
        >
          <Card style={{ flex: 1 }} noPad>
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ width: 16, height: 1.5, background: "var(--fg-3)" }} />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--fg-0)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                }}
              >
                Progress ULTG
              </span>
            </div>
            <div
              style={{
                padding: 20,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-around",
              }}
            >
              <UltgProgressCard
                rows={ultgRows}
                activeUltg={activeUltg}
                onUltgClick={toggleUltg}
              />
            </div>
          </Card>
        </motion.div>

        {/* Program Kerja — ABO + PS dengan layout transition click */}
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {activePanel !== "lm" && (
              <motion.div
                key="abo-card"
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex min-w-0 col-span-12 md:col-span-6 ${
                  activePanel === "abo" ? "xl:col-span-8" : "xl:col-span-4"
                }`}
              >
                <Card noPad style={{ flex: 1, minWidth: 0 }}>
                  <ProgramListHeader
                    prefix="Program"
                    suffix="Anti Blackout"
                    count={aboItems.length}
                    accent="#5b8def"
                  />
                  <div style={{ padding: "12px 20px 16px", flex: 1 }}>
                    <ProgramListBars
                      items={aboItems}
                      accent="#5b8def"
                      maxVisible={activePanel === "abo" ? 10 : 5}
                    />
                  </div>
                </Card>
              </motion.div>
            )}
            {activePanel !== "abo" && (
              <motion.div
                key="ps-card"
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex min-w-0 col-span-12 md:col-span-6 ${
                  activePanel === "lm" ? "xl:col-span-8" : "xl:col-span-4"
                }`}
              >
                <Card noPad style={{ flex: 1, minWidth: 0 }}>
                  <ProgramListHeader
                    prefix="Program"
                    suffix="Strategis"
                    count={lmItems.length}
                    accent="#f3c14b"
                  />
                  <div style={{ padding: "12px 20px 16px", flex: 1 }}>
                    <ProgramListBars
                      items={lmItems}
                      accent="#f3c14b"
                      maxVisible={activePanel === "lm" ? 10 : 5}
                    />
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>


        {/* Detail table — auto-filter by active panel + activeUltg */}
        <DataTable
          items={
            activePanel === "abo"
              ? aboItems
              : activePanel === "lm"
              ? lmItems
              : allItems
          }
          activeUltg={activeUltg}
        />
      </div>
    </div>
  );
}
