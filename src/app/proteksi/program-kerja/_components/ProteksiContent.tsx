"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/designer/Card";
import { Icon } from "@/components/designer/Icon";
import { Hero } from "@/app/transmisi/program-kerja-transmisi/_components/v2/Hero";
import { UltgProgressCard } from "@/app/transmisi/program-kerja-transmisi/_components/v2/UltgProgressCard";
import { ProgramRechartsBar } from "@/app/transmisi/program-kerja-transmisi/_components/v2/ProgramRechartsBar";
import type { ProgramItem } from "@/app/transmisi/program-kerja-transmisi/_components/program-kerja-data";
import { ProteksiDetailTable } from "./ProteksiDetailTable";
import {
  GRP_ACCENT,
  GRP_COLOR_MAP,
  GRP_LABEL,
  GRP_ORDER,
  aggregateByGrp,
  normalizeDetail,
  normalizeSummary,
  totalsOf,
  type GrpKey,
  type ProteksiDetailRow,
  type ProteksiSummaryRow,
} from "./proteksi-data";

const MOTION_EASE = [0.25, 0.46, 0.45, 0.94] as const;
const MOTION_TRANSITION = { duration: 0.3, ease: MOTION_EASE };

type UltgKey = "bogor" | "sukabumi";

/** Meta ULTG — warna konsisten dengan golden page Transmisi + slide deck program kerja. */
const ULTG_META: { key: UltgKey; name: string; ultg: "BOGOR" | "SUKABUMI"; accent: string }[] = [
  { key: "bogor", name: "ULTG Bogor", ultg: "BOGOR", accent: "var(--color-ultg-bogor)" },
  { key: "sukabumi", name: "ULTG Sukabumi", ultg: "SUKABUMI", accent: "var(--color-ultg-sukabumi)" },
];

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
      <span style={{ width: 12, height: 12, background: color, borderRadius: 3, display: "inline-block" }} />
      <span style={{ color: "var(--fg-1)" }}>{label}</span>
    </span>
  );
}

/**
 * Adapter — proyeksikan agregat program (dari summary ATAU proyeksi detail per-ULTG)
 * ke shape ProgramItem yang dipakai ProgramRechartsBar. Chart hanya baca: namaProgram,
 * programKerja (grp slug), totalTarget, totalRealisasi. Sisanya stub aman (default 0/"").
 */
function makeProgramItem(args: {
  program: string;
  grp: GrpKey;
  grpLabel: string;
  total: number;
  selesai: number;
  persen: number;
}): ProgramItem {
  return {
    no: "",
    namaProgram: args.program,
    jenisProgram: "",
    kategoriKey: null,
    programKerja: args.grp as unknown as ProgramItem["programKerja"],
    risiko: "",
    kategori: "",
    posAnggaran: "",
    keterangan: "",
    pelaksana: "",
    lokasi: "",
    programKerjaText: args.grpLabel,
    targetBogor: 0,
    realisasiBogor: 0,
    targetSukabumi: 0,
    realisasiSukabumi: 0,
    totalTarget: args.total,
    totalRealisasi: args.selesai,
    presentase: args.persen,
    presentaseBogor: 0,
    presentaseSukabumi: 0,
  };
}

interface ProteksiContentProps {
  summaryRaw: Record<string, unknown>[];
  detailRaw: Record<string, unknown>[];
  updatedAt?: string | null;
  /** Sembunyikan page header saat di-embed di hub /program-kerja Tabs. */
  embedded?: boolean;
}

export function ProteksiContent({ summaryRaw, detailRaw, updatedAt, embedded }: ProteksiContentProps) {
  /* ── Normalisasi snapshot (robust ke data belum disanitize) ── */
  const summary: ProteksiSummaryRow[] = useMemo(
    () => summaryRaw.map(normalizeSummary).filter((r) => r.program && r.program !== "(tanpa nama)"),
    [summaryRaw],
  );
  const detail: ProteksiDetailRow[] = useMemo(
    () => detailRaw.map(normalizeDetail).filter((r) => r.program),
    [detailRaw],
  );

  /* ── Filter state — grup aktif (klik Hero panel) + ULTG aktif (klik card ULTG) + program aktif (klik bar) ── */
  const [activeGrp, setActiveGrp] = useState<GrpKey | null>(null);
  const toggleGrp = (key: string) => setActiveGrp((cur) => (cur === (key as GrpKey) ? null : (key as GrpKey)));

  const [activeUltg, setActiveUltg] = useState<UltgKey | null>(null);
  const toggleUltg = (key: string) => setActiveUltg((cur) => (cur === (key as UltgKey) ? null : (key as UltgKey)));

  const [activeProgram, setActiveProgram] = useState<string | null>(null);
  const toggleProgram = (name: string) => setActiveProgram((cur) => (cur === name ? null : name));

  /* ── Aggregate (base = summary, persis perilaku tanpa filter) ── */
  const totals = useMemo(() => totalsOf(summary), [summary]);
  const grpAgg = useMemo(() => aggregateByGrp(summary), [summary]);

  /* ── Progress per ULTG dari detail rows — target = jumlah item, realisasi = item selesai ── */
  const ultgRows = useMemo(
    () =>
      ULTG_META.map((u) => {
        const rows = detail.filter((d) => d.ultg === u.ultg);
        return {
          key: u.key,
          name: u.name,
          target: rows.length,
          realisasi: rows.filter((d) => d.isSelesai).length,
          accent: u.accent,
        };
      }),
    [detail],
  );

  /* Item detail belum ter-assign ULTG — masuk total keseluruhan, tidak ikut saat filter ULTG aktif */
  const unassignedUltgCount = useMemo(() => detail.filter((d) => d.ultg === "").length, [detail]);

  /* Detail rows ter-proyeksi ULTG aktif — null saat tanpa filter (semua angka tetap dari summary) */
  const detailUltg = useMemo(() => {
    const meta = ULTG_META.find((u) => u.key === activeUltg);
    if (!meta) return null;
    return detail.filter((d) => d.ultg === meta.ultg);
  }, [detail, activeUltg]);

  /* Proyeksi agregat per grup dari detail ULTG aktif (Hero panels ikut filter ULTG) */
  const grpAggUltg = useMemo(() => {
    if (!detailUltg) return null;
    return GRP_ORDER.map((key) => {
      const rows = detailUltg.filter((d) => d.grp === key);
      return {
        key,
        total: rows.length,
        selesai: rows.filter((d) => d.isSelesai).length,
        programCount: new Set(rows.map((d) => d.program)).size,
      };
    });
  }, [detailUltg]);

  /* ── Hero total — proyeksi detail ULTG saat filter aktif, summary saat tanpa filter ── */
  const heroTotal = useMemo(() => {
    if (!detailUltg) {
      return { totalItem: totals.total, realisasi: totals.selesai, programCount: summary.length };
    }
    return {
      totalItem: detailUltg.length,
      realisasi: detailUltg.filter((d) => d.isSelesai).length,
      programCount: new Set(detailUltg.map((d) => d.program)).size,
    };
  }, [detailUltg, totals, summary.length]);

  /* ── Hero panels (per grup, klik = filter — angka ter-proyeksi saat ULTG aktif) ── */
  const heroPanels = useMemo(
    () =>
      grpAgg.map((g) => {
        const proj = grpAggUltg?.find((p) => p.key === g.key);
        return {
          key: g.key,
          caption: `Program ${g.name}`,
          nickname: g.name,
          totalItem: proj ? proj.total : g.total,
          realisasi: proj ? proj.selesai : g.selesai,
          programCount: proj ? proj.programCount : summary.filter((s) => s.grp === g.key).length,
          accent: g.accent,
          accent2: g.accent2,
        };
      }),
    [grpAgg, grpAggUltg, summary],
  );

  /* ── Data chart — per program, kombinasi filter grup + ULTG ──
   * Tanpa ULTG: dari summary (base persis seperti semula).
   * ULTG aktif: proyeksi group-by program dari detail rows ULTG itu
   * (totalTarget = count item, totalRealisasi = count selesai, hanya program dengan item). */
  const chartItems = useMemo(() => {
    if (detailUltg) {
      const rows = activeGrp ? detailUltg.filter((d) => d.grp === activeGrp) : detailUltg;
      const byProgram = new Map<string, { grp: GrpKey; grpLabel: string; total: number; selesai: number }>();
      rows.forEach((d) => {
        const e = byProgram.get(d.program) ?? { grp: d.grp, grpLabel: d.grpLabel, total: 0, selesai: 0 };
        e.total += 1;
        if (d.isSelesai) e.selesai += 1;
        byProgram.set(d.program, e);
      });
      return [...byProgram.entries()].map(([program, v]) =>
        makeProgramItem({
          program,
          grp: v.grp,
          grpLabel: v.grpLabel,
          total: v.total,
          selesai: v.selesai,
          persen: v.total > 0 ? Math.round((v.selesai / v.total) * 100) : 0,
        }),
      );
    }
    const rows = activeGrp ? summary.filter((s) => s.grp === activeGrp) : summary;
    return rows
      .filter((r) => r.total > 0)
      .map((r) =>
        makeProgramItem({
          program: r.program,
          grp: r.grp,
          grpLabel: r.grpLabel,
          total: r.total,
          selesai: r.selesai,
          persen: r.persen,
        }),
      );
  }, [summary, detailUltg, activeGrp]);

  if (summary.length === 0 && detail.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Card title="Belum ada data" subtitle="Sumber: snapshot pk_proteksi_summary / pk_proteksi_detail">
          <p style={{ margin: 0, fontSize: 12, color: "var(--fg-2)" }}>
            Belum ada baris program proteksi yang ter-load dari snapshot. Cek koneksi snapshot Supabase.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Page header — hide saat embedded di hub Tabs */}
      {!embedded && (
        <div className="flex justify-between items-end gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
              <span>Monitoring</span>
              <Icon name="chevronRight" size={11} />
              <span>Proteksi</span>
              <Icon name="chevronRight" size={11} />
              <span style={{ color: "var(--fg-0)" }}>Program Kerja Proteksi</span>
            </div>
            <h1 className="ds-heading">Program Kerja Proteksi 2026</h1>
            <p className="ds-body mt-0.5">Monitoring Program Kerja · Proteksi · UPT Bogor</p>
          </div>
        </div>
      )}

      {/* Grid 12-col */}
      <div className="grid grid-cols-12 gap-3">
        {/* Hero — total + breakdown per grup (klik = filter) */}
        <Hero
          activePanel={activeGrp}
          onPanelClick={toggleGrp}
          total={{
            key: "total",
            caption: "Program Kerja Proteksi",
            totalItem: heroTotal.totalItem,
            realisasi: heroTotal.realisasi,
            programCount: heroTotal.programCount,
            accent: "#3ecf8e",
            accent2: "#8dd884",
            showSyncBadge: true,
          }}
          panels={heroPanels}
        />

        {/* Progress per ULTG — full row, Bogor + Sukabumi horizontal (klik = filter ULTG) */}
        <motion.div layout transition={MOTION_TRANSITION} className="col-span-12 flex min-w-0">
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
              {unassignedUltgCount > 0 && (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 10.5,
                    color: "var(--fg-3)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {unassignedUltgCount.toLocaleString("id-ID")} item belum ter-assign ULTG — masuk
                  total keseluruhan, tidak ikut saat filter ULTG aktif.
                </p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Per-program bar — 21 program, urut by grup, klik = filter detail */}
        <motion.div layout transition={MOTION_TRANSITION} className="col-span-12 flex min-w-0">
          <Card noPad style={{ flex: 1, minWidth: 0 }}>
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
                  <span style={{ color: "var(--fg-0)", marginLeft: 6 }}>Program Kerja Proteksi</span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {GRP_ORDER.map((g) => (
                  <LegendChip
                    key={g}
                    label={GRP_LABEL[g]}
                    color={GRP_ACCENT[g].accent}
                    dim={!!activeGrp && activeGrp !== g}
                  />
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 4px 16px 0" }}>
              <ProgramRechartsBar
                items={chartItems}
                accent="var(--cond-very-good)"
                colorMap={GRP_COLOR_MAP}
                groupSort
                groupOrder={GRP_ORDER}
                activeProgram={activeProgram}
                onProgramClick={toggleProgram}
              />
            </div>
          </Card>
        </motion.div>

        {/* Detail table — 500 item, search + sort + filter + pagination (rows pre-filtered ULTG aktif) */}
        <ProteksiDetailTable
          rows={detailUltg ?? detail}
          activeGrp={activeGrp}
          activeProgram={activeProgram}
          onClearProgram={() => setActiveProgram(null)}
        />
      </div>
    </div>
  );
}
