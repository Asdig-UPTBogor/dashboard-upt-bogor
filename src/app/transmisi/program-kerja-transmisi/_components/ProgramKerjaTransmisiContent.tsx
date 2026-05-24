"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/designer/Card";
import { Icon } from "@/components/designer/Icon";
import { Hero } from "./v2/Hero";
import { UltgProgressCard } from "./v2/UltgProgressCard";
import { ProgramRechartsBar } from "./v2/ProgramRechartsBar";
import { DataTable } from "./v2/DataTable";
import { normalizeItem, type ProgramItem } from "./program-kerja-data";

interface SheetData {
  headers?: string[];
  rows?: Record<string, string>[];
}

type PanelKey = "abo" | "lm";
type UltgKey = "bogor" | "sukabumi";

const MOTION_EASE = [0.25, 0.46, 0.45, 0.94] as const;
const MOTION_DURATION = 0.3;
const MOTION_TRANSITION = { duration: MOTION_DURATION, ease: MOTION_EASE };
const CHART_COLOR_MAP = { abo: "var(--color-abo)", lm: "var(--color-ps)" };
const CHART_GROUP_ORDER = ["abo", "lm"];

const CAPTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontWeight: 600,
};

const CAPTION_DASH_STYLE: React.CSSProperties = {
  width: 16,
  height: 1.5,
  flexShrink: 0,
};

function LegendChip({ label, color, dim }: { label: string; color: string; dim: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        opacity: dim ? 0.3 : 1,
        transition: "opacity .25s ease",
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          background: color,
          borderRadius: 3,
          display: "inline-block",
        }}
      />
      <span style={{ color: "var(--fg-1)" }}>{label}</span>
    </span>
  );
}

function NoTargetGroup({
  label,
  accent,
  items,
}: {
  label: string;
  accent: string;
  items: ProgramItem[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "var(--fg-1)",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </span>
        <span
          className="num"
          style={{
            fontSize: 10.5,
            color: "var(--fg-3)",
            fontWeight: 600,
          }}
        >
          {items.length}
        </span>
      </div>
      {/* Stagger layout — max 2 row per kolom, overflow lanjut ke kolom samping */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "repeat(2, auto)",
          gridAutoFlow: "column",
          gridAutoColumns: "max-content",
          columnGap: 20,
          rowGap: 4,
        }}
      >
        {items.map((it, i) => (
          <span
            key={`${it.no || i}-${it.namaProgram}`}
            title={it.namaProgram}
            style={{
              fontSize: 11.5,
              color: "var(--fg-1)",
              padding: "2px 0",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "var(--fg-3)",
                flexShrink: 0,
              }}
            />
            {it.namaProgram}
          </span>
        ))}
      </div>
    </div>
  );
}

function sumTotals(items: ProgramItem[]) {
  return items.reduce(
    (acc, it) => {
      acc.target += it.totalTarget;
      acc.realisasi += it.totalRealisasi;
      return acc;
    },
    { target: 0, realisasi: 0 },
  );
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
function projectByUltg(items: ProgramItem[], ultg: UltgKey | null): ProgramItem[] {
  if (!ultg) return items;
  return items.map((it) => ({
    ...it,
    totalTarget: ultg === "bogor" ? it.targetBogor : it.targetSukabumi,
    totalRealisasi: ultg === "bogor" ? it.realisasiBogor : it.realisasiSukabumi,
  }));
}

export function ProgramKerjaTransmisiContent({
  sheets,
  embedded,
  slideMode,
}: {
  sheets: SheetData[] | undefined;
  embedded?: boolean;
  /** Slide deck mode — hide DataTable + interactive features, optimize untuk view-only */
  slideMode?: boolean;
}) {
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const togglePanel = (p: PanelKey) => setActivePanel((cur) => (cur === p ? null : p));

  const [activeUltg, setActiveUltg] = useState<UltgKey | null>(null);
  const toggleUltg = (key: string) => {
    const k = key as UltgKey;
    setActiveUltg((cur) => (cur === k ? null : k));
  };

  const [activeProgram, setActiveProgram] = useState<string | null>(null);
  const toggleProgram = (name: string) =>
    setActiveProgram((cur) => (cur === name ? null : name));

  const allItems: ProgramItem[] = useMemo(() => {
    const rows = sheets?.[0]?.rows || [];
    return rows.map(normalizeItem).filter((it) => it.namaProgram);
  }, [sheets]);

  // Project items by ULTG filter (jika active) — semua aggregate jadi bogor/sukabumi specific
  const projectedItems = useMemo(() => projectByUltg(allItems, activeUltg), [allItems, activeUltg]);

  // Saat ULTG aktif, filter out program tanpa target di ULTG itu — count + listing only program
  // yang relevant ke ULTG terpilih. (activeUltg sudah ter-encode di projectedItems via projectByUltg.)
  const lmItems = useMemo(
    () => projectedItems.filter((it) => it.programKerja === "lm" && (!activeUltg || it.totalTarget > 0)),
    [projectedItems, activeUltg],
  );
  const aboItems = useMemo(
    () => projectedItems.filter((it) => it.programKerja === "abo" && (!activeUltg || it.totalTarget > 0)),
    [projectedItems, activeUltg],
  );

  /** Versi RAW (un-projected) untuk catatan tanpa target — % overall stable, ga re-compute saat klik ULTG.
   *  Filter ULTG cuma HIDE program yang ga punya target di ULTG itu, % tetap overall. */
  const filterByUltgRaw = (it: ProgramItem) => {
    if (!activeUltg) return true;
    return activeUltg === "bogor" ? it.targetBogor > 0 : it.targetSukabumi > 0;
  };
  const aboItemsRaw = useMemo(
    () => allItems.filter((it) => it.programKerja === "abo" && filterByUltgRaw(it)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, activeUltg],
  );
  const lmItemsRaw = useMemo(
    () => allItems.filter((it) => it.programKerja === "lm" && filterByUltgRaw(it)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, activeUltg],
  );

  const totals = useMemo(() => sumTotals(projectedItems), [projectedItems]);
  const ultgRows = useMemo(() => sumUltg(allItems), [allItems]);
  const aboTotals = useMemo(() => sumTotals(aboItems), [aboItems]);
  const lmTotals = useMemo(() => sumTotals(lmItems), [lmItems]);

  /** Chart data — PAKAI PROJECTED (ULTG-aware) supaya % responsif ke filter ULTG.
   *  Stable refs (useMemo) → ga trigger re-animate Recharts.
   */
  const chartItems = useMemo(() => {
    const fAbo = activePanel === "lm" ? [] : aboItems;
    const fLm = activePanel === "abo" ? [] : lmItems;
    return [...fAbo, ...fLm].filter((it) => it.totalTarget > 0);
  }, [activePanel, aboItems, lmItems]);

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

  return (
    <div className="space-y-3">
      {/* Page header — hide kalau embedded di hub Tabs (hub punya header + toolbar sendiri) */}
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

        {/* Penyebaran per ULTG — full row, 2 ULTG horizontal side-by-side, no header */}
        <motion.div
          layout
          transition={MOTION_TRANSITION}
          className="col-span-12 flex min-w-0"
        >
          <Card style={{ flex: 1 }} noPad>
            <div
              style={{
                padding: 14,
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
                direction="row"
              />
            </div>
          </Card>
        </motion.div>

        {/* Program Kerja — 1 card 1 chart, filtered by activePanel + activeUltg */}
        {(() => {
          /* No-target catatan pakai aboItemsRaw/lmItemsRaw — "tanpa target" = no target di global,
             ga depend ke ULTG projection */
          const fAbo = activePanel === "lm" ? [] : aboItemsRaw;
          const fLm = activePanel === "abo" ? [] : lmItemsRaw;
          const noTarget = [...fAbo, ...fLm].filter((it) => it.totalTarget === 0);
          const noTargetAbo = noTarget.filter((it) => it.programKerja === "abo");
          const noTargetLm = noTarget.filter((it) => it.programKerja === "lm");
          return (
            <motion.div
              layout
              transition={MOTION_TRANSITION}
              className="col-span-12 flex min-w-0"
            >
              <Card noPad style={{ flex: 1, minWidth: 0 }}>
                {/* Header with category legend */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...CAPTION_DASH_STYLE, background: "var(--cond-very-good)" }} />
                    <span style={CAPTION_LABEL_STYLE}>
                      <span style={{ color: "var(--cond-very-good)" }}>Progress</span>
                      <span style={{ color: "var(--fg-0)", marginLeft: 6 }}>Program Kerja Transmisi</span>
                    </span>
                  </div>
                  {/* Legend ABO + PS — dim category yang ke-filter out */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <LegendChip label="Anti Blackout" color="var(--color-abo)" dim={activePanel === "lm"} />
                    <LegendChip label="Strategis" color="var(--color-ps)" dim={activePanel === "abo"} />
                  </div>
                </div>

                {/* 1 chart gabungan — ABO biru di atas, PS amber di bawah (group sort) */}
                <div style={{ padding: "12px 4px 16px 0" }}>
                  <ProgramRechartsBar
                    items={chartItems}
                    accent="var(--color-abo)"
                    colorMap={CHART_COLOR_MAP}
                    groupSort
                    groupOrder={CHART_GROUP_ORDER}
                    activeProgram={activeProgram}
                    onProgramClick={toggleProgram}
                  />
                </div>

                {/* Catatan — program tanpa target (pattern caption ds-* + dot+text chip list) */}
                {noTarget.length > 0 && (
                  <div
                    style={{
                      borderTop: "1px solid var(--line)",
                      padding: "14px 20px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...CAPTION_DASH_STYLE, background: "var(--fg-3)" }} />
                      <span style={{ ...CAPTION_LABEL_STYLE, color: "var(--fg-2)" }}>
                        Tanpa Target
                      </span>
                      <span className="num" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                        {noTarget.length}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        columnGap: 24,
                        rowGap: 16,
                        alignItems: "flex-start",
                      }}
                    >
                      {noTargetAbo.length > 0 && (
                        <NoTargetGroup
                          label="Anti Blackout"
                          accent="var(--color-abo)"
                          items={noTargetAbo}
                        />
                      )}
                      {noTargetLm.length > 0 && (
                        <NoTargetGroup
                          label="Strategis"
                          accent="var(--color-ps)"
                          items={noTargetLm}
                        />
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })()}


        {/* Detail table — hide di slide deck (terlalu panjang untuk slide canvas) */}
        {!slideMode && (() => {
          let tableItems: ProgramItem[] = allItems;
          if (activePanel === "abo") tableItems = aboItems;
          else if (activePanel === "lm") tableItems = lmItems;
          return (
            <DataTable
              items={tableItems}
              activeUltg={activeUltg}
            />
          );
        })()}
      </div>
    </div>
  );
}
