"use client";

import { useMemo, useCallback, useState } from "react";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { Zap, Shield, Activity, Building2, X, RefreshCw, ChevronLeft, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { COLORS, LAYOUT, TEXT, CHART, ANIM } from "./design-tokens";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ══ Shorthand ══ */
const D = CHART.donut;
const G = CHART.bar.gradient;

/* ══ Column refs ══ */
const T = {
  ULTG: "Master ULTG", GI: "Master Gardu Induk", BAY: "Master Bay",
  TECH: "TECHIDENTNO", TEG: "TEG", MERK: "MERK TRAFO", TIPE: "TIPE TRAFO",
  COUNTER: "JUMLAH COUNTER OLTC", BREATHER: "KONDISI BREATHER TRAFO",
  OLTC: "OPERASI OLTC\nMANUAL/OTOMATIS", FILTER: "FILTER MINYAK TRAFO",
} as const;

/* ══ 14 Shield Items ══ */
const SHIELD_ITEMS = [
  { key: "CELAH LUBANG INCOMING", label: "Celah Incoming", short: "C.In", cat: "Fisik" },
  { key: "CELAH LUBANG OILPIT/KABEL DUCT", label: "Celah Oilpit", short: "C.Oil", cat: "Fisik" },
  { key: "JARING SWITCHYARD", label: "Jaring Switchyard", short: "J.SY", cat: "Fisik" },
  { key: "JARING TRAFO", label: "Jaring Trafo", short: "J.Trf", cat: "Fisik" },
  { key: "IJUK", label: "Ijuk", short: "Ijk", cat: "Fisik" },
  { key: "CAPING / PENGHALANG BINATANG DI PIPA FIRE PREVENTION", label: "Caping Fire Prev.", short: "Cpg", cat: "Proteksi" },
  { key: "ISOLASI REL BUSBAR 20 KV", label: "Isolasi Busbar 20kV", short: "Iso", cat: "Proteksi" },
  { key: "CORBUZER", label: "Corbuzer", short: "Crb", cat: "Proteksi" },
  { key: "WAP", label: "WAP", short: "WAP", cat: "Proteksi" },
  { key: "AKRILIK", label: "Akrilik", short: "Akr", cat: "Proteksi" },
  { key: "LAMPU KUNING", label: "Lampu Kuning", short: "L.K", cat: "Proteksi" },
  { key: "SUNGKUP RELAI MEKANIK (JANSEN)", label: "Sungkup Jansen", short: "S.Jn", cat: "Relai" },
  { key: "SUNGKUP RELAI MEKANIK (BUCHOLZ)", label: "Sungkup Bucholz", short: "S.Bc", cat: "Relai" },
  { key: "SUNGKUP RELAI MEKANIK (SUDDEN PRESSURE)", label: "Sungkup S.Press", short: "S.SP", cat: "Relai" },
];

type Row = Record<string, string>;
type StatusLabel = "Tuntas" | "Parsial" | "Kosong";

/* ══ Classification ══ */
function classify(val: string): "ok" | "fail" | "na" {
  const v = (val || "").toUpperCase().trim();
  if (!v || v === "-" || v === "X" || v.includes("TIDAK MEMUNGKINKAN")) return "na";
  if (v === "TERPASANG" || v === "TERTUTUP" || v === "BERFUNGSI" || v === "SILICA GEL" || v === "PERNAH") return "ok";
  return "fail";
}

/* ══ Score ══ */
function scoreRow(r: Row) {
  let ok = 0, fail = 0, na = 0;
  SHIELD_ITEMS.forEach(it => {
    const c = classify(r[it.key] || "");
    if (c === "ok") ok++; else if (c === "fail") fail++; else na++;
  });
  const applicable = ok + fail;
  const pct = applicable > 0 ? Math.round((ok / applicable) * 100) : 0;
  const status: StatusLabel = applicable === 0 ? "Kosong" : pct === 100 ? "Tuntas" : pct === 0 ? "Kosong" : "Parsial";
  return { ok, fail, na, applicable, pct, status };
}

interface TrafoTabProps { rows: Row[] }

export function TrafoTab({ rows }: TrafoTabProps) {
  const theme = useChartTheme();

  const [selectedGi, setSelectedGi] = useState<string | null>(null);
  const [selectedUltg, setSelectedUltg] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusLabel | null>(null);
  const [selectedTeg, setSelectedTeg] = useState<string | null>(null);
  const [lockedBay, setLockedBay] = useState<number | null>(null);
  const [selectedShield, setSelectedShield] = useState<string | null>(null);

  /* ── Wrapper hover class ── */
  const WH = "border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300";

  /* ── Score all rows ── */
  interface ScoredRow { row: Row; _s: ReturnType<typeof scoreRow> }
  const scored: ScoredRow[] = useMemo(() => rows.map(r => ({ row: r, _s: scoreRow(r) })), [rows]);


  /* ── ULTG list ── */
  const ultgList = useMemo(() => [...new Set(rows.map(r => r[T.ULTG]).filter(Boolean))].sort(), [rows]);

  /* ── Filter ── */
  const filtered = useMemo(() => scored.filter(r => {
    if (selectedUltg && r.row[T.ULTG] !== selectedUltg) return false;
    if (selectedTeg && r.row[T.TEG] !== selectedTeg) return false;
    if (selectedStatus && r._s.status !== selectedStatus) return false;
    return true;
  }), [scored, selectedUltg, selectedTeg, selectedStatus]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const statusCounts = { Tuntas: 0, Parsial: 0, Kosong: 0 };
    const tegMap = new Map<string, number>();
    const giMap = new Map<string, { rows: ScoredRow[]; okTotal: number; appTotal: number }>();
    let totalOk = 0, totalApp = 0;

    filtered.forEach(r => {
      statusCounts[r._s.status]++;
      totalOk += r._s.ok; totalApp += r._s.applicable;
      const teg = r.row[T.TEG] || "N/A";
      tegMap.set(teg, (tegMap.get(teg) || 0) + 1);
      const gi = r.row[T.GI] || "Unknown";
      if (!giMap.has(gi)) giMap.set(gi, { rows: [], okTotal: 0, appTotal: 0 });
      const entry = giMap.get(gi)!;
      entry.rows.push(r); entry.okTotal += r._s.ok; entry.appTotal += r._s.applicable;
    });

    const overallPct = totalApp > 0 ? Math.round((totalOk / totalApp) * 100) : 0;
    const giStats = [...giMap.entries()]
      .map(([gi, v]) => ({ gi, count: v.rows.length, pct: v.appTotal > 0 ? Math.round((v.okTotal / v.appTotal) * 100) : 0, rows: v.rows, ultg: v.rows[0]?.row[T.ULTG] || "" }))
      .sort((a, b) => a.pct - b.pct);

    const itemStats = SHIELD_ITEMS.map(it => {
      let ok = 0, app = 0;
      filtered.forEach(r => { const c = classify(r.row[it.key] || ""); if (c !== "na") { app++; if (c === "ok") ok++; } });
      return { ...it, ok, total: app, pct: app > 0 ? Math.round((ok / app) * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct); // sorted best→worst for column chart

    const tegCounts = [...tegMap.entries()].map(([name, value]) => ({ name: name + "kV", value })).sort((a, b) => b.value - a.value);
    const breatherRusak = filtered.filter(r => (r.row[T.BREATHER] || "").toUpperCase() === "RUSAK").length;

    return { total: filtered.length, overallPct, statusCounts, tegCounts, giStats, itemStats, breatherRusak };
  }, [filtered]);

  /* ── GI detail ── */
  const giDetail = useMemo(() => {
    if (!selectedGi) return null;
    return stats.giStats.find(g => g.gi === selectedGi) || null;
  }, [selectedGi, stats.giStats]);

  /* ═══ DONUT FACTORY ═══ */
  const mkDonut = useCallback((
    data: { name: string; value: number; itemStyle: Record<string, unknown> }[],
  ) => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item" as const, backgroundColor: COLORS.tooltipBg,
      borderColor: COLORS.tooltipBorder, borderWidth: 1,
      textStyle: { color: "#e4e4e7", fontSize: TEXT.chartTooltip },
      formatter: (p: { name: string; value: number; percent: number }) =>
        `<b>${p.name}</b><br/>Jumlah: <b>${p.value}</b> (${p.percent.toFixed(1)}%)`,
    },
    series: [{
      type: "pie" as const, radius: [D.innerRadius, D.outerRadius], center: D.center,
      startAngle: D.startAngle, padAngle: D.padAngle,
      itemStyle: { borderRadius: D.borderRadius, borderColor: D.borderColor, borderWidth: D.borderWidth },
      selectedMode: "single" as const, selectedOffset: D.selectedOffset,
      emphasis: {
        scale: true, scaleSize: 8,
        itemStyle: { shadowBlur: 20, shadowColor: "rgba(129,140,248,0.4)" },
        label: { fontSize: D.labelFontSize + 2, fontWeight: "bold" as const },
      },
      label: {
        show: true, fontSize: D.labelFontSize, color: "#d4d4d8",
        alignTo: "labelLine" as const,
        formatter: (p: { name: string; value: number; percent: number }) =>
          `{n|${p.name}}\n{v|${p.value}} {p|(${p.percent.toFixed(0)}%)}`,
        rich: {
          n: { fontSize: D.labelFontSize, color: "#e4e4e7", fontWeight: "bold" as const, lineHeight: 14 },
          v: { fontSize: D.labelFontSize + 1, color: COLORS.amber, fontWeight: "bold" as const },
          p: { fontSize: D.labelFontSize - 1, color: "#a1a1aa" },
        },
      },
      labelLine: { show: true, length: D.labelLineLength1, length2: D.labelLineLength2, smooth: D.labelLineSmooth,
        lineStyle: { color: D.labelLineColor, width: D.labelLineWidth } },
      data,
      animationDuration: D.animDuration, animationEasing: ANIM.chartEasing,
      animationType: "scale" as const,
    }],
  }), []);

  /* ── Donuts ── */
  const statusDonut = useMemo(() => {
    const items = [
      { name: "Tuntas" as StatusLabel, value: stats.statusCounts.Tuntas, color: COLORS.emerald },
      { name: "Parsial" as StatusLabel, value: stats.statusCounts.Parsial, color: COLORS.amber },
      { name: "Kosong" as StatusLabel, value: stats.statusCounts.Kosong, color: COLORS.rose },
    ].filter(s => s.value > 0);
    return mkDonut(items.map(s => ({
      name: s.name, value: s.value,
      itemStyle: { color: s.color, opacity: selectedStatus && selectedStatus !== s.name ? D.dimOpacity : 1 },
    })));
  }, [stats, selectedStatus, mkDonut]);

  const tegDonut = useMemo(() =>
    mkDonut(stats.tegCounts.map((s, idx) => ({
      name: s.name, value: s.value,
      itemStyle: { color: COLORS.palette[idx % COLORS.palette.length], opacity: selectedTeg && selectedTeg !== s.name ? D.dimOpacity : 1 },
    }))), [stats.tegCounts, selectedTeg, mkDonut]);

  /* ═══ HORIZONTAL BAR CHART — per shield item ═══ */
  const barOption = useMemo(() => {
    const items = [...stats.itemStats].sort((a, b) => a.pct - b.pct); // worst at top
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const, axisPointer: { type: "shadow" as const },
        backgroundColor: COLORS.tooltipBg, borderColor: COLORS.tooltipBorder, borderRadius: 8,
        textStyle: { color: "#e4e4e7", fontSize: TEXT.chartTooltip },
        formatter: (params: Array<{ name: string; value: number }>) => {
          if (!params.length) return "";
          const p = params[0];
          const item = items.find(it => it.label === p.name);
          return item ? `<b>${item.label}</b><br/><span style="color:${COLORS.selesai}">● OK:</span> ${item.ok}/${item.total}<br/><span style="color:${COLORS.amber}">Compliance:</span> <b>${item.pct}%</b>` : p.name;
        },
      },
      grid: { top: 4, right: 50, bottom: 4, left: 8, containLabel: true },
      yAxis: {
        type: "category" as const,
        data: items.map(p => p.label),
        axisLabel: { fontSize: 9, color: theme.textMuted, width: 120, overflow: "truncate" as const, triggerEvent: true },
        axisLine: { show: false },
        axisTick: { show: false },
        inverse: true,
        triggerEvent: true,
      },
      xAxis: {
        type: "value" as const, max: 100,
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: COLORS.gridLine, type: "dashed" as const } },
        axisLine: { show: false },
      },
      series: [
        // Invisible clickable background — full width so entire row is clickable
        {
          type: "bar" as const,
          data: items.map(() => ({ value: 100, itemStyle: { color: "rgba(255,255,255,0.02)", borderRadius: [0, 4, 4, 0] } })),
          barWidth: "60%", barGap: "-100%",
          cursor: "pointer" as const,
          emphasis: { itemStyle: { color: "rgba(255,255,255,0.06)" } },
          silent: false,
          z: 1,
        },
        // Actual colored bars
        {
        type: "bar" as const,
        data: items.map(p => {
          const grad = p.pct >= 100 ? G.full : p.pct >= 75 ? G.high : p.pct >= 50 ? G.medium : G.zero;
          return {
            value: p.pct,
            itemStyle: {
              color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: grad.from }, { offset: 1, color: grad.to }],
              },
              borderRadius: [0, 4, 4, 0],
            },
          };
        }),
        barWidth: "60%", barGap: "-100%",
        label: { show: true, position: "right" as const, fontSize: 9, fontWeight: "bold" as const, color: theme.text, formatter: (p: { value: number }) => `${p.value}%` },
        emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } },
        cursor: "pointer" as const,
        z: 2,
      }],
      animationDuration: 600, animationEasing: ANIM.chartEasing,
    };
  }, [stats.itemStats, theme]);

  /* ═══ RENDER ═══ */
  return (
    <div className={`flex flex-col ${LAYOUT.sectionGap}`}>
      {/* KPI Strip */}
      <div className={`rounded-md overflow-hidden ${WH}`} style={{ background: COLORS.cardBg }}>
        <div className="flex items-center gap-0 divide-x divide-border/20">
          <div className="flex-1 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`${TEXT.kpiLabel} text-muted-foreground uppercase tracking-wider`}>Shield Compliance</span>
              <span className="text-sm font-bold" style={{ color: stats.overallPct >= 80 ? COLORS.selesai : stats.overallPct >= 50 ? COLORS.amber : COLORS.belum }}>{stats.overallPct}%</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className={`h-full rounded-full ${ANIM.chartTransition}`}
                style={{ width: `${stats.overallPct}%`, background: `linear-gradient(90deg, ${COLORS.selesai}, ${COLORS.teal})` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className={`${TEXT.kpiLabel} text-muted-foreground`}>{stats.statusCounts.Tuntas} tuntas</span>
              <span className={`${TEXT.kpiLabel} text-muted-foreground`}>{stats.statusCounts.Kosong + stats.statusCounts.Parsial} belum</span>
            </div>
          </div>
          <div className="px-4 py-3 text-center min-w-[90px]">
            <Zap className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.cyan }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`}>{stats.total}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Trafo</p>
          </div>
          <div className="px-4 py-3 text-center min-w-[90px] cursor-pointer hover:bg-emerald-500/5" onClick={() => setSelectedStatus(prev => prev === "Tuntas" ? null : "Tuntas")}>
            <Activity className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.selesai }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`} style={{ color: selectedStatus === "Tuntas" ? COLORS.selesai : undefined }}>{stats.statusCounts.Tuntas}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Tuntas</p>
          </div>
          <div className="px-4 py-3 text-center min-w-[90px]">
            <Shield className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.indigo }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`}>{SHIELD_ITEMS.length}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Shield</p>
          </div>
          <div className="px-4 py-3 text-center min-w-[90px]">
            <Building2 className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.amber }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`}>{stats.giStats.length}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Gardu Induk</p>
          </div>
          {stats.breatherRusak > 0 && (
            <div className="px-4 py-3 text-center min-w-[90px]">
              <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-rose-400" />
              <div className={`${TEXT.kpiValue} font-extrabold leading-none text-rose-400`}>{stats.breatherRusak}</div>
              <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Breather Rusak</p>
            </div>
          )}
          <div className="px-4 py-3 min-w-[130px]">
            <p className={`${TEXT.kpiLabel} text-muted-foreground uppercase tracking-wider mb-1.5`}>ULTG</p>
            {ultgList.map((name, i) => (
              <div key={name} className={`flex items-center justify-between gap-2 cursor-pointer hover:brightness-125 ${ANIM.hoverTransition}`}
                onClick={() => { setSelectedUltg(prev => prev === name ? null : name); setSelectedGi(null); }}>
                <span className={`${TEXT.kpiLabel} ${selectedUltg === name ? "font-bold" : ""}`} style={{ color: COLORS.palette[i] }}>{name}</span>
                <span className={`${TEXT.kpiLabel} font-mono font-bold`}>{filtered.filter(r => r.row[T.ULTG] === name).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ═══ MAIN AREA: Column Chart + GI List ═══ */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${LAYOUT.cardGap}`} style={{ height: 500 }}>

        {/* LEFT: Column chart OR Matrix table (with transition) */}
        <div className="lg:col-span-7 xl:col-span-8 relative overflow-visible">
          {/* Column Chart — visible when no GI selected */}
          <div className={`absolute inset-0 rounded-md overflow-hidden flex flex-col ${WH} ${ANIM.chartTransition}
            ${selectedGi || selectedShield ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}
            style={{ background: COLORS.cardBg }}>
            <div className={`${LAYOUT.headerPadding} flex items-center gap-2`}>
              <span className={`${TEXT.cardTitle} font-semibold`}>Shield Compliance per Item</span>
            </div>
            <div className="flex-1 p-1" style={{ minHeight: 0 }}>
              <ReactECharts option={barOption} style={{ height: "100%", width: "100%" }}
                onEvents={{
                  click: (p: { name?: string; componentType?: string; value?: number }) => {
                    const name = p.name;
                    if (name) { const item = SHIELD_ITEMS.find(it => it.label === name); if (item) { setSelectedShield(item.key); setSelectedGi(null); } }
                  },
                }} />
            </div>
          </div>

          {/* Shield Detail — visible when shield item clicked */}
          {(() => {
            const shieldItem = SHIELD_ITEMS.find(it => it.key === selectedShield);
            const shieldStat = shieldItem ? stats.itemStats.find(s => s.label === shieldItem.label) : null;
            const shieldColor = shieldStat ? (shieldStat.pct >= 80 ? COLORS.selesai : shieldStat.pct >= 50 ? COLORS.amber : COLORS.belum) : COLORS.belum;
            // Per-GI bay details for this shield item
            const giShieldData = shieldItem ? stats.giStats.map(gi => {
              const bays = filtered.filter(r => r.row[T.GI] === gi.gi).map(r => ({
                bay: r.row[T.BAY] || "—",
                status: classify(r.row[shieldItem.key] || ""),
              })).filter(b => b.status !== "na");
              const ok = bays.filter(b => b.status === "ok").length;
              return { gi: gi.gi, bays, ok, total: bays.length, pct: bays.length > 0 ? Math.round((ok / bays.length) * 100) : 0 };
            }).filter(g => g.total > 0).sort((a, b) => a.pct - b.pct) : [];

            return (
              <div className={`absolute inset-0 rounded-md flex flex-col ${WH} ${ANIM.chartTransition}
                ${selectedShield ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"}`}
                style={{ background: COLORS.cardBg, overflow: "hidden" }}>
                {shieldItem && shieldStat && (
                  <>
                    {/* Header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${COLORS.gridLine}` }}>
                      <button onClick={() => setSelectedShield(null)}
                        className={`flex items-center gap-1 text-primary hover:underline text-xs font-medium ${ANIM.hoverTransition}`}>
                        <ChevronLeft className="h-4 w-4" /> Kembali
                      </button>
                      <div className="h-4 w-px bg-border/30" />
                      <span className="text-xs font-bold truncate shrink-0">{shieldItem.label}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden mx-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${shieldStat.pct}%`, background: shieldColor }} />
                      </div>
                      <span className="text-xs font-extrabold shrink-0" style={{ color: shieldColor }}>{shieldStat.pct}%</span>
                      <span className="text-xs font-extrabold shrink-0" style={{ color: shieldColor }}>{shieldStat.ok}/{shieldStat.total}</span>
                    </div>

                    {/* Segmented bar rows per GI */}
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5" style={{ minHeight: 0 }}>
                      {giShieldData.map(gi => {
                        const giColor = gi.pct >= 80 ? COLORS.selesai : gi.pct >= 50 ? COLORS.amber : COLORS.belum;
                        return (
                          <div key={gi.gi} className="flex items-center gap-2">
                            {/* GI name */}
                            <div className="shrink-0 w-[130px] min-w-0">
                              <div className="text-[10px] font-bold truncate">{gi.gi}</div>
                            </div>
                            {/* Segmented bar */}
                            <div className="flex-1 flex h-7 rounded overflow-hidden gap-px">
                              {gi.bays.map((bay, j) => (
                                <div key={j}
                                  className="flex-1 flex items-center justify-center transition-all hover:brightness-125 cursor-default overflow-hidden"
                                  style={{
                                    background: bay.status === "ok" ? "rgba(52,211,153,0.2)" : "rgba(244,63,94,0.2)",
                                    borderLeft: j > 0 ? "1px solid rgba(0,0,0,0.3)" : "none",
                                    minWidth: 0,
                                  }}
                                  title={`${bay.bay}: ${bay.status === "ok" ? "Selesai" : "Belum"}`}>
                                  <span className={`font-bold truncate block px-0.5 text-center
                                    ${bay.status === "ok" ? "text-emerald-300" : "text-rose-300"}`}
                                    style={{ fontSize: `clamp(6px, ${Math.min(9, 100 / gi.bays.length)}px, 9px)` }}>
                                    {bay.bay}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Score */}
                            <div className="shrink-0 text-right w-[50px]">
                              <span className="text-[10px] font-extrabold" style={{ color: giColor }}>{gi.pct}%</span>
                              <span className="text-[9px] text-muted-foreground/50 ml-1">{gi.ok}/{gi.total}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Bay Cards — visible when GI selected */}
          <div className={`absolute inset-0 rounded-md flex flex-col ${WH} ${ANIM.chartTransition}
            ${selectedGi ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"}`}
            style={{ background: COLORS.cardBg, overflow: "hidden" }}>
            {giDetail && (
              <>
                {/* Header bar */}
                <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${COLORS.gridLine}` }}>
                  <button onClick={() => setSelectedGi(null)}
                    className={`flex items-center gap-1 text-primary hover:underline text-xs font-medium ${ANIM.hoverTransition}`}>
                    <ChevronLeft className="h-4 w-4" /> Kembali
                  </button>
                  <div className="h-4 w-px bg-border/30" />
                  <span className="text-xs font-bold truncate shrink-0">{giDetail.gi}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden mx-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${giDetail.pct}%`, background: giDetail.pct >= 80 ? COLORS.selesai : giDetail.pct >= 50 ? COLORS.amber : COLORS.belum }} />
                  </div>
                  <span className="text-xs font-extrabold shrink-0" style={{ color: giDetail.pct >= 80 ? COLORS.selesai : giDetail.pct >= 50 ? COLORS.amber : COLORS.belum }}>{giDetail.pct}%</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{giDetail.count} Trafo</Badge>
                </div>

                {/* Scrollable bay card list */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2" style={{ minHeight: 0 }}>
                  {giDetail.rows.map((sr, rIdx) => {
                    const r = sr.row;
                    const s = sr._s;
                    const pctColor = s.pct >= 80 ? COLORS.selesai : s.pct >= 50 ? COLORS.amber : COLORS.belum;
                    const isLocked = lockedBay === rIdx;
                    return (
                      <div key={rIdx}
                        onClick={() => setLockedBay(isLocked ? null : rIdx)}
                        className={`rounded-lg border cursor-pointer transition-all duration-200
                          ${isLocked
                            ? "border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                            : "border-border/20 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5"}`}
                        style={{ background: isLocked ? "rgba(124,58,237,0.03)" : "rgba(255,255,255,0.02)" }}>
                        {/* Bay header row */}
                        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${COLORS.gridLine}` }}>
                          <div className="shrink-0 min-w-0">
                            <div className="text-[12px] font-bold truncate">{r[T.BAY]}</div>
                            <div className="text-[10px] text-muted-foreground/70">{r[T.MERK] || "—"} | {r[T.TIPE] || "—"}</div>
                          </div>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden mx-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: pctColor }} />
                          </div>
                          <span className="text-xs font-extrabold shrink-0" style={{ color: pctColor }}>{s.pct}%</span>
                          <span className="text-xs font-extrabold shrink-0" style={{ color: pctColor }}>{s.ok}/{s.applicable}</span>
                        </div>

                        {/* Content: info + shield chips */}
                        <div className="px-3 py-2">
                          {/* Operational info row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5 text-[11px]">
                            <span className="inline-flex items-center gap-1"><span className="text-muted-foreground/70 font-medium">OLTC:</span> <span className="font-bold text-foreground/90">{r[T.OLTC] || "—"}</span></span>
                            <span className="text-border/30">•</span>
                            <span className="inline-flex items-center gap-1"><span className="text-muted-foreground/70 font-medium">Counter:</span> <span className="font-mono font-bold text-foreground/90">{r[T.COUNTER] || "—"}</span></span>
                            <span className="text-border/30">•</span>
                            <span className="inline-flex items-center gap-1"><span className="text-muted-foreground/70 font-medium">Filter:</span> <span className="font-bold text-foreground/90">{r[T.FILTER] || "—"}</span></span>
                            <span className="text-border/30">•</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="text-muted-foreground/70 font-medium">Breather:</span>
                              <span className={`font-bold ${classify(r[T.BREATHER] || "") === "ok" ? "text-emerald-400" : classify(r[T.BREATHER] || "") === "fail" ? "text-rose-400" : "text-foreground/90"}`}>
                                {r[T.BREATHER] || "—"}
                              </span>
                            </span>
                          </div>

                          {/* Shield matrix — names top, status bottom */}
                          <div className="overflow-x-auto rounded" style={{ border: `1px solid ${COLORS.gridLine}` }}>
                            <table className="w-full" style={{ borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                  {SHIELD_ITEMS.map(it => (
                                    <th key={it.key} className="py-1 px-1.5 text-center whitespace-nowrap"
                                      style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `1px solid ${COLORS.gridLine}` }}>
                                      <div className="text-[9px] text-muted-foreground font-bold">{it.label}</div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {SHIELD_ITEMS.map(it => {
                                    const c = classify(r[it.key] || "");
                                    return (
                                      <td key={it.key} className="py-1.5 px-1 text-center"
                                        style={{ borderRight: `1px solid ${COLORS.gridLine}`,
                                          background: c === "ok" ? "rgba(52,211,153,0.06)" : c === "fail" ? "rgba(244,63,94,0.06)" : "transparent" }}
                                        title={`${it.label}: ${r[it.key] || "N/A"}`}>
                                        <span className={`text-sm font-bold
                                          ${c === "ok" ? "text-emerald-400" : c === "fail" ? "text-rose-400" : "text-muted-foreground/20"}`}>
                                          {c === "ok" ? "✓" : c === "fail" ? "✗" : "—"}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: GI List — grouped by ULTG */}
        <div className={`lg:col-span-5 xl:col-span-4 overflow-hidden rounded-md flex flex-col ${WH}`} style={{ background: COLORS.cardBg }}>
          <div className="px-3 py-2.5 text-center" style={{ borderBottom: `1px solid ${COLORS.gridLine}` }}>
            <span className="text-sm font-bold">Kondisi Bay Trafo</span>
          </div>
          {/* ULTG tabs inside the panel */}
          <div className="flex items-center gap-1 px-2 py-1.5">
            {ultgList.map((name, i) => {
              const isActive = selectedUltg === name;
              return (
                <button key={name}
                  onClick={() => { setSelectedUltg(prev => prev === name ? null : name); setSelectedGi(null); }}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-bold text-center ${ANIM.hoverTransition}
                    ${isActive
                      ? "bg-primary/15 text-primary border border-primary/40"
                      : "bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground border border-transparent"}`}>
                  {name.replace("ULTG ", "")}
                </button>
              );
            })}
          </div>
          {/* Scrollable GI list */}
          <div className="flex-1 overflow-y-auto px-1 pb-1" style={{ minHeight: 0 }}>
            {stats.giStats
              .filter(gi => !selectedUltg || gi.ultg === selectedUltg)
              .map(gi => {
              const pctColor = gi.pct >= 80 ? COLORS.selesai : gi.pct >= 50 ? COLORS.amber : COLORS.belum;
              const isActive = selectedGi === gi.gi;
              return (
                <button key={gi.gi}
                  onClick={() => { setSelectedGi(isActive ? null : gi.gi); setSelectedShield(null); }}
                  className={`w-full text-left rounded-md px-2.5 py-1.5 mb-0.5 ${ANIM.hoverTransition} group
                    ${isActive
                      ? "bg-primary/10 border border-primary/40 shadow-md"
                      : "border border-transparent hover:border-border/30 hover:bg-muted/10"}`}>
                  <div className="flex items-start justify-between mb-0.5">
                    <span className={`text-xs font-bold leading-tight ${isActive ? "text-primary" : "group-hover:text-primary transition-colors"}`}>
                      {gi.gi} <span className="text-muted-foreground/50 font-normal">|</span> <span className="text-muted-foreground/70 font-medium">{gi.count} Trafo</span>
                    </span>
                    <span className="text-xs font-extrabold ml-2 shrink-0" style={{ color: pctColor }}>{gi.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className={`h-full rounded-full ${ANIM.chartTransition}`}
                      style={{ width: `${gi.pct}%`, background: pctColor }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ FULL MATRIX TABLE ═══ */}
      <div className={`rounded-md overflow-hidden ${WH}`} style={{ background: COLORS.cardBg }}>
        <div className={`${LAYOUT.headerPadding} flex items-center gap-2`} style={{ borderBottom: `1px solid ${COLORS.gridLine}` }}>
          <span className={`${TEXT.cardTitle} font-semibold`}>Matrix Shield Compliance</span>
          <span className="text-[10px] text-muted-foreground/50 font-medium">{filtered.length} Bay Trafo • {SHIELD_ITEMS.length} Item</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                <th className="text-left text-[11px] font-extrabold text-foreground/80 px-3 py-3 whitespace-nowrap"
                  style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `2px solid ${COLORS.gridLine}`, width: 120 }}>
                  Gardu Induk
                </th>
                <th className="text-left text-[11px] font-extrabold text-foreground/80 px-2 py-3 whitespace-nowrap"
                  style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `2px solid ${COLORS.gridLine}`, width: 110 }}>
                  Bay Trafo
                </th>
                <th className="text-center text-[10px] font-extrabold text-foreground/70 px-1 py-3 whitespace-nowrap"
                  style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `2px solid ${COLORS.gridLine}`, width: 65 }}>OLTC</th>
                <th className="text-center text-[10px] font-extrabold text-foreground/70 px-1 py-3 whitespace-nowrap"
                  style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `2px solid ${COLORS.gridLine}`, width: 55 }}>Counter</th>
                <th className="text-center text-[10px] font-extrabold text-foreground/70 px-1 py-3 whitespace-nowrap"
                  style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `2px solid ${COLORS.gridLine}`, width: 65 }}>Filter</th>
                <th className="text-center text-[10px] font-extrabold text-foreground/70 px-1 py-3 whitespace-nowrap"
                  style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `2px solid ${COLORS.gridLine}`, width: 65 }}>Breather</th>
                {SHIELD_ITEMS.map(it => {
                  const isActive = selectedShield === it.key;
                  return (
                  <th key={it.key}
                    className={`text-center font-extrabold px-0 py-2 cursor-pointer transition-colors
                      ${isActive ? "text-primary bg-primary/10" : "text-foreground/70 hover:text-primary hover:bg-primary/5"}`}
                    style={{ borderRight: `1px solid ${COLORS.gridLine}`, borderBottom: `2px solid ${isActive ? COLORS.selesai : COLORS.gridLine}`, width: 32, height: 100 }}
                    onClick={() => { setSelectedShield(isActive ? null : it.key); setSelectedGi(null); }}>
                    <div className="flex items-center justify-center h-full">
                      <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", fontSize: 9, letterSpacing: "0.02em" }}>{it.label}</span>
                    </div>
                  </th>
                  );
                })}
                <th className="text-center text-[10px] font-extrabold text-foreground/70 px-1 py-3 whitespace-nowrap"
                  style={{ borderBottom: `2px solid ${COLORS.gridLine}`, width: 40 }}>
                  Score
                </th>
              </tr>
            </thead>
            {stats.giStats
                .filter(gi => !selectedUltg || gi.ultg === selectedUltg)
                .sort((a, b) => {
                  if (selectedGi) {
                    if (a.gi === selectedGi) return -1;
                    if (b.gi === selectedGi) return 1;
                  }
                  return 0;
                })
                .map(gi => {
                const giRows = filtered.filter(r => r.row[T.GI] === gi.gi);
                const giPctColor = gi.pct >= 80 ? COLORS.selesai : gi.pct >= 50 ? COLORS.amber : COLORS.belum;
                const isGiActive = selectedGi === gi.gi;
                return (
                  <tbody key={gi.gi} className="group"
                    ref={isGiActive ? (el) => { if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" }); } : undefined}
                    style={{ borderTop: `2px solid ${isGiActive ? "hsl(var(--primary))" : COLORS.gridLine}` }}>
                    {giRows.map((sr, rIdx) => {
                      const r = sr.row;
                      const s = sr._s;
                      const pctColor = s.pct >= 80 ? COLORS.selesai : s.pct >= 50 ? COLORS.amber : COLORS.belum;
                      const isFirstOfGi = rIdx === 0;
                      return (
                        <tr key={`${gi.gi}-${rIdx}`}
                          className={`transition-colors ${isGiActive ? "bg-primary/10 hover:!bg-primary/20" : "group-hover:bg-primary/8 hover:!bg-primary/15"}`}
                          style={{ borderBottom: `1px solid ${COLORS.gridLine}` }}>
                          {/* GI name — rowSpan merged, vertically centered */}
                          {isFirstOfGi && (
                            <td rowSpan={giRows.length}
                              className={`px-3 py-2 text-[11px] font-bold whitespace-nowrap align-middle text-center cursor-pointer transition-colors
                                ${selectedGi === gi.gi ? "bg-primary/15 text-primary" : "group-hover:bg-primary/8"}`}
                              style={{
                                borderRight: `1px solid ${COLORS.gridLine}`,
                              }}
                              onClick={() => { setSelectedGi(selectedGi === gi.gi ? null : gi.gi); setSelectedShield(null); }}>
                              <div>{gi.gi}</div>
                              <div className="text-[10px] text-muted-foreground/70 mt-0.5">{gi.count} Trafo • <span className="font-extrabold" style={{ color: giPctColor }}>{gi.pct}%</span></div>
                            </td>
                          )}
                          {/* Bay Trafo cell — stacked vertically */}
                          <td className="px-2 py-1"
                            style={{
                              borderRight: `1px solid ${COLORS.gridLine}`,
                            }}>
                            <div className="text-[11px] font-bold leading-tight">{r[T.BAY] || "—"}</div>
                            <div className="text-[9px] text-muted-foreground/80 leading-tight">{r[T.TEG] || "—"}</div>
                            <div className="text-[9px] text-muted-foreground/80 leading-tight">{r[T.MERK] || "—"}</div>
                            <div className="text-[9px] text-muted-foreground/80 leading-tight">{r[T.TIPE] || "—"}</div>
                          </td>
                          {/* Operational info columns */}
                          <td className="text-center py-1.5 px-2 text-[10px] font-semibold whitespace-nowrap"
                            style={{ borderRight: `1px solid ${COLORS.gridLine}` }}>
                            {r[T.OLTC] || "—"}
                          </td>
                          <td className="text-center py-1.5 px-2 text-[10px] font-mono font-semibold whitespace-nowrap"
                            style={{ borderRight: `1px solid ${COLORS.gridLine}` }}>
                            {r[T.COUNTER] || "—"}
                          </td>
                          <td className="text-center py-1.5 px-2 text-[10px] font-semibold whitespace-nowrap"
                            style={{ borderRight: `1px solid ${COLORS.gridLine}` }}>
                            {r[T.FILTER] || "—"}
                          </td>
                          <td className="text-center py-1.5 px-2 text-[10px] font-semibold whitespace-nowrap"
                            style={{ borderRight: `1px solid ${COLORS.gridLine}` }}>
                            <span className={classify(r[T.BREATHER] || "") === "ok" ? "text-emerald-400" : classify(r[T.BREATHER] || "") === "fail" ? "text-rose-400" : ""}>
                              {r[T.BREATHER] || "—"}
                            </span>
                          </td>
                          {SHIELD_ITEMS.map(it => {
                            const c = classify(r[it.key] || "");
                            const isShieldActive = selectedShield === it.key;
                            return (
                              <td key={it.key} className="text-center py-1.5 px-1"
                                style={{
                                  borderRight: `1px solid ${COLORS.gridLine}`,
                                  background: isShieldActive
                                    ? "rgba(99,102,241,0.08)"
                                    : c === "ok" ? "rgba(52,211,153,0.06)" : c === "fail" ? "rgba(244,63,94,0.06)" : "transparent",
                                }}
                                title={`${it.label}: ${r[it.key] || "N/A"}`}>
                                <span className={`text-sm font-bold
                                  ${c === "ok" ? "text-emerald-400" : c === "fail" ? "text-rose-400" : "text-muted-foreground/15"}`}>
                                  {c === "ok" ? "✓" : c === "fail" ? "✗" : "—"}
                                </span>
                              </td>
                            );
                          })}
                          {/* Score per bay */}
                          <td className="text-center py-1.5 px-2">
                            <span className="text-[10px] font-extrabold" style={{ color: pctColor }}>{s.pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
          </table>
        </div>
      </div>
    </div>
  );
}
