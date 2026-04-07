"use client";

import { useMemo, useCallback, useState } from "react";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { CalendarDays, CheckCircle2, XCircle, Building2, X, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COLORS, LAYOUT, TEXT, CHART, ANIM } from "./design-tokens";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const H = {
  NO: "NO", NAMA: "NAMA PROGRAM", ULTG: "Master ULTG", GI: "Master Gardu Induk",
  BAY: "Master Bay", POS: "POS ANGGARAN", REAL: "REALIASASI", KET: "KETERANGAN",
} as const;

type Row = Record<string, string>;
type StatusLabel = "Selesai" | "Belum Selesai";
type SortKey = "NO" | "NAMA PROGRAM" | "Master ULTG" | "Master Gardu Induk" | "Master Bay" | "KETERANGAN" | null;
type SortDir = "asc" | "desc";

interface HargiTabProps { rows: Row[] }

export function HargiTab({ rows }: HargiTabProps) {
  const theme = useChartTheme();

  /* ── Filter states ── */
  const [selectedUltg, setSelectedUltg] = useState<string | null>(null);
  const [selectedGi, setSelectedGi] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusLabel | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const clearAll = useCallback(() => {
    setSelectedUltg(null); setSelectedGi(null);
    setSelectedStatus(null); setSelectedProgram(null);
  }, []);
  const hasFilter = selectedUltg || selectedGi || selectedStatus || selectedProgram;

  const isSelesai = useCallback((r: Row) => {
    const k = (r[H.KET] || "").toUpperCase();
    return k.includes("SELESAI") && !k.includes("BELUM");
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  /* ── Filtered + sorted data ── */
  const filtered = useMemo(() => {
    let r = rows;
    if (selectedUltg) r = r.filter(x => x[H.ULTG] === selectedUltg);
    if (selectedGi) r = r.filter(x => x[H.GI] === selectedGi);
    if (selectedStatus) r = r.filter(x => selectedStatus === "Selesai" ? isSelesai(x) : !isSelesai(x));
    if (selectedProgram) r = r.filter(x => x[H.NAMA] === selectedProgram);
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const va = (a[sortKey] || "").toLowerCase();
        const vb = (b[sortKey] || "").toLowerCase();
        const cmp = va.localeCompare(vb, "id", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, selectedUltg, selectedGi, selectedStatus, selectedProgram, isSelesai, sortKey, sortDir]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = filtered.length;
    const selesai = filtered.filter(isSelesai).length;
    const belum = total - selesai;
    const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
    const programs = [...new Set(filtered.map(r => r[H.NAMA]).filter(Boolean))];
    const giList = [...new Set(filtered.map(r => r[H.GI]).filter(Boolean))];
    const ultgCounts: Record<string, number> = {};
    filtered.forEach(r => { const u = r[H.ULTG]; if (u) ultgCounts[u] = (ultgCounts[u] || 0) + 1; });
    return { total, selesai, belum, pct, programs, giList, ultgCounts };
  }, [filtered, isSelesai]);

  /* ── Bar data ── */
  /* Status filter determines WHICH programs appear, but progress is always calculated from full data */
  const barPrograms = useMemo(() => {
    // Base filter: ULTG + GI only (for calculating real progress)
    let base = rows;
    if (selectedUltg) base = base.filter(x => x[H.ULTG] === selectedUltg);
    if (selectedGi) base = base.filter(x => x[H.GI] === selectedGi);
    if (selectedProgram) base = base.filter(x => x[H.NAMA] === selectedProgram);

    // Build full progress map from base (not status-filtered)
    const map = new Map<string, { total: number; selesai: number }>();
    base.forEach(row => {
      const name = row[H.NAMA]; if (!name) return;
      const e = map.get(name) || { total: 0, selesai: 0 };
      e.total++; if (isSelesai(row)) e.selesai++;
      map.set(name, e);
    });

    // Status filter: only determines which programs to SHOW
    let visibleNames: Set<string> | null = null;
    if (selectedStatus) {
      const statusRows = base.filter(x => selectedStatus === "Selesai" ? isSelesai(x) : !isSelesai(x));
      visibleNames = new Set(statusRows.map(x => x[H.NAMA]).filter(Boolean));
    }

    return [...map.entries()]
      .filter(([name]) => !visibleNames || visibleNames.has(name))
      .map(([name, { total, selesai }]) => ({ name, total, selesai, pct: total > 0 ? Math.round((selesai / total) * 100) : 0 }))
      .sort((a, b) => a.pct - b.pct);
  }, [rows, selectedUltg, selectedGi, selectedStatus, selectedProgram, isSelesai]);

  /* ═══ DONUT FACTORY ═══ */
  const D = CHART.donut;
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
      type: "pie" as const,
      radius: [D.innerRadius, D.outerRadius],
      center: D.center, startAngle: D.startAngle,
      padAngle: D.padAngle,
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
      animationDurationUpdate: 400, animationEasingUpdate: "cubicInOut" as const,
    }],
  }), [D]);

  /* ═══ ULTG Donut ═══ */
  const ultgDonutOption = useMemo(() => {
    const entries = Object.entries(stats.ultgCounts);
    const data = entries.map(([name, value], i) => ({
      name, value,
      itemStyle: {
        color: COLORS.palette[i % COLORS.palette.length],
        opacity: selectedUltg && selectedUltg !== name ? D.dimOpacity : 1,
        shadowBlur: selectedUltg === name ? D.glowBlur : 0,
        shadowColor: selectedUltg === name ? COLORS.palette[i % COLORS.palette.length] : "transparent",
      },
    }));
    return mkDonut(data);
  }, [stats, selectedUltg, mkDonut, D]);

  /* ═══ Status Donut ═══ */
  const statusDonutOption = useMemo(() => {
    const items = [
      { name: "Selesai" as StatusLabel, value: stats.selesai, color: COLORS.selesai },
      { name: "Belum Selesai" as StatusLabel, value: stats.belum, color: COLORS.belum },
    ].filter(s => s.value > 0);
    const data = items.map(s => ({
      name: s.name, value: s.value,
      itemStyle: {
        color: s.color,
        opacity: selectedStatus && selectedStatus !== s.name ? D.dimOpacity : 1,
        shadowBlur: selectedStatus === s.name ? D.glowBlur : 0,
        shadowColor: selectedStatus === s.name ? s.color : "transparent",
      },
    }));
    return mkDonut(data);
  }, [stats, selectedStatus, mkDonut, D]);

  const B = CHART.bar;
  const G = B.gradient;

  /* ── Drill-down data: grouped by GI, with bay details ── */
  const drillDownData = useMemo(() => {
    if (!selectedProgram) return null;
    const progRows = filtered;
    const giMap = new Map<string, { ultg: string; bays: Array<{ name: string; selesai: boolean; ket: string }> }>();
    progRows.forEach(row => {
      const gi = row[H.GI] || "—";
      const ultg = row[H.ULTG] || "—";
      const e = giMap.get(gi) || { ultg, bays: [] };
      e.bays.push({ name: row[H.BAY] || "—", selesai: isSelesai(row), ket: row[H.KET] || "" });
      giMap.set(gi, e);
    });
    return [...giMap.entries()]
      .map(([gi, { ultg, bays }]) => ({
        gi, ultg, bays: bays.sort((a, b) => a.name.localeCompare(b.name)),
        selesai: bays.filter(b => b.selesai).length,
        total: bays.length,
      }))
      .sort((a, b) => a.ultg.localeCompare(b.ultg) || a.gi.localeCompare(b.gi));
  }, [selectedProgram, filtered, isSelesai]);

  const barOption = useMemo(() => {
    /* ─── DRILL-DOWN MODE: per GI bars with bay segments ─── */
    if (drillDownData && drillDownData.length > 0) {
      const maxBays = Math.max(...drillDownData.map(d => d.total));
      const labels = drillDownData.map(d => {
        const lbl = d.gi;
        return lbl.length > B.labelTruncate ? lbl.substring(0, B.labelTruncate) + "…" : lbl;
      });

      // Create one series per bay position (stacked)
      const baySeriesList = Array.from({ length: maxBays }, (_, i) => ({
        name: `Bay ${i + 1}`, type: "bar" as const, stack: "bays",
        data: drillDownData.map(d => {
          const bay = d.bays[i];
          if (!bay) return { value: 0, itemStyle: { color: "transparent" }, label: { show: false } };
          return {
            value: 100 / d.total,
            itemStyle: {
              color: bay.selesai ? COLORS.selesai : COLORS.belum,
              borderRadius: i === d.bays.length - 1 ? [0, 3, 3, 0] : i === 0 ? [3, 0, 0, 3] : [0, 0, 0, 0],
              borderColor: "rgba(0,0,0,0.3)",
              borderWidth: 1,
            },
          };
        }),
        barWidth: "55%",
        // Inside label: bay name — auto-shrink for many bays
        label: {
          show: true, position: "inside" as const,
          fontSize: Math.max(7, Math.min(10, Math.floor(120 / maxBays))),
          color: "#fff", fontWeight: "bold" as const,
          overflow: "truncate" as const, ellipsis: "…",
          width: maxBays > 1 ? Math.floor(600 / maxBays) : undefined,
          formatter: (p: { dataIndex: number }) => {
            const d = drillDownData[p.dataIndex];
            const bay = d?.bays[i];
            if (!bay) return "";
            // Shorten long names when many bays
            const name = bay.name;
            if (d.total > 4 && name.length > 8) return name.substring(0, 7) + "…";
            if (d.total > 6 && name.length > 5) return name.substring(0, 4) + "…";
            return name;
          },
        },
        tooltip: { show: false },
      }));

      // Add one more invisible series just for the right-side label (selesai/total)
      baySeriesList.push({
        name: "Summary", type: "bar" as const, stack: "bays",
        data: drillDownData.map(() => ({ value: 0, itemStyle: { color: "transparent" }, label: { show: true } })),
        barWidth: "55%",
        label: {
          show: true, position: "right" as const as any,
          fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: theme.text,
          overflow: "none" as any, ellipsis: "…", width: undefined,
          formatter: (p: { dataIndex: number }) => {
            const d = drillDownData[p.dataIndex];
            return d ? `${d.selesai}/${d.total}` : "";
          },
        },
        tooltip: { show: false },
      });

      return {
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: {
          trigger: "axis" as const,
          backgroundColor: COLORS.tooltipBg, borderColor: COLORS.tooltipBorder, borderRadius: 8,
          textStyle: { color: "#e4e4e7", fontSize: TEXT.chartTooltip },
          formatter: (params: Array<{ dataIndex: number }>) => {
            if (!params.length) return "";
            const d = drillDownData[params[0].dataIndex];
            if (!d) return "";
            const bayList = d.bays.map(b =>
              `<span style="color:${b.selesai ? COLORS.selesai : COLORS.belum}">●</span> ${b.name}: <b>${b.selesai ? "Selesai" : "Belum"}</b>`
            ).join("<br/>");
            return `<b style="color:${COLORS.amber}">${d.ultg}</b> › <b>${d.gi}</b><br/>`
              + `Progress: <b>${d.selesai}/${d.total}</b><br/>`
              + `<hr style="border-color:#333;margin:4px 0"/>`
              + bayList;
          },
        },
        grid: { top: 4, right: 60, bottom: 4, left: B.leftMargin, containLabel: false },
        yAxis: {
          type: "category" as const, data: labels,
          axisLabel: { fontSize: TEXT.chartAxisLabel, color: theme.text, overflow: "truncate" as const, width: B.labelWidth },
          axisLine: { show: false }, axisTick: { show: false }, inverse: true,
        },
        xAxis: { type: "value" as const, max: 100, show: false },
        series: baySeriesList,
        animationDuration: B.animDuration, animationEasing: ANIM.chartEasing,
      };
    }

    /* ─── NORMAL MODE: program progress bars ─── */
    return {
      backgroundColor: "transparent",
      textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: COLORS.tooltipBg, borderColor: COLORS.tooltipBorder, borderRadius: 8,
        textStyle: { color: "#e4e4e7", fontSize: TEXT.chartTooltip },
        axisPointer: { type: "shadow" as const, shadowStyle: { color: "rgba(129,140,248,0.06)" } },
        formatter: (params: Array<{ name: string }>) => {
          if (!params.length) return "";
          const prog = barPrograms.find(p => p.name === params[0].name || (p.name.length > B.labelTruncate && p.name.substring(0, B.labelTruncate) + "…" === params[0].name));
          if (!prog) return params[0].name;
          return `<b style="color:${COLORS.indigo}">${prog.name}</b><br/>`
            + `Total: <b>${prog.total}</b><br/>`
            + `<span style="color:${COLORS.selesai}">● Selesai:</span> <b>${prog.selesai}</b><br/>`
            + `<span style="color:${COLORS.belum}">● Belum:</span> <b>${prog.total - prog.selesai}</b><br/>`
            + `<span style="color:${COLORS.amber}">Progress:</span> <b>${prog.pct}%</b>`;
        },
      },
      grid: { top: 4, right: B.rightMargin, bottom: 4, left: B.leftMargin, containLabel: false },
      yAxis: {
        type: "category" as const,
        data: barPrograms.map(p => p.name.length > B.labelTruncate ? p.name.substring(0, B.labelTruncate) + "…" : p.name),
        axisLabel: { fontSize: TEXT.chartAxisLabel, color: theme.text, overflow: "truncate" as const, width: B.labelWidth },
        axisLine: { show: false }, axisTick: { show: false }, inverse: true, triggerEvent: true,
      },
      xAxis: { type: "value" as const, max: 100, show: false },
      series: [{
        name: "Progress", type: "bar" as const,
        data: barPrograms.map(p => {
          const grad = p.pct >= 100 ? G.full : p.pct >= 50 ? G.high : p.pct > 0 ? G.medium : G.zero;
          return {
            value: p.pct,
            itemStyle: {
              color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: grad.from }, { offset: 1, color: grad.to }],
              },
              borderRadius: B.borderRadius,
              borderColor: "rgba(128,128,128,0.3)",
              borderWidth: 1,
            },
          };
        }),
        barWidth: B.barWidth,
        stack: "progress",
        label: {
          show: true, position: "inside" as const,
          fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: "#fff",
          formatter: (p: { dataIndex: number }) => {
            const prog = barPrograms[p.dataIndex];
            return prog && prog.pct > 0 ? `${prog.pct}%` : "";
          },
        },
        showBackground: true,
        backgroundStyle: { color: `rgba(255,255,255,${B.bgOpacity})`, borderRadius: B.borderRadius, borderColor: "rgba(128,128,128,0.25)", borderWidth: 1 },
      },
      {
        name: "Remainder", type: "bar" as const,
        data: barPrograms.map(p => ({ value: 100 - p.pct, itemStyle: { color: "transparent" } })),
        stack: "progress", barWidth: B.barWidth,
        tooltip: { show: false },
        label: {
          show: true, position: "right" as const,
          fontSize: TEXT.chartLabel, fontWeight: "bold" as const,
          formatter: (p: { dataIndex: number }) => {
            const prog = barPrograms[p.dataIndex];
            if (!prog) return "";
            return `{ok|${prog.selesai}}{sep|/}{total|${prog.total}}`;
          },
          rich: {
            ok: { fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: COLORS.selesai },
            sep: { fontSize: TEXT.chartLabel, color: theme.textMuted },
            total: { fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: theme.text },
          },
        },
      }],
      animationDuration: B.animDuration, animationEasing: ANIM.chartEasing,
    };
  }, [barPrograms, drillDownData, theme, B, G]);

  const handleBarClick = useCallback((params: { name?: string; componentType?: string; value?: string }) => {
    // In drill-down mode, any click goes back to all programs
    if (selectedProgram) { setSelectedProgram(null); return; }
    const label = params.componentType === "yAxis" ? params.value : params.name;
    if (!label) return;
    const found = barPrograms.find(p => p.name === label || (p.name.length > B.labelTruncate && p.name.substring(0, B.labelTruncate) + "…" === label));
    if (found) setSelectedProgram(prev => prev === found.name ? null : found.name);
  }, [barPrograms, B.labelTruncate, selectedProgram]);

  /* ── Sort icon helper ── */
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-2.5 w-2.5 opacity-30 ml-0.5 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-2.5 w-2.5 text-primary ml-0.5 inline" />
      : <ArrowDown className="h-2.5 w-2.5 text-primary ml-0.5 inline" />;
  };

  /* ═══ RENDER ═══ */
  return (
    <div className={`flex flex-col ${LAYOUT.sectionGap}`}>
      {/* Filters */}
      {hasFilter && (
        <div className={`flex items-center gap-1 flex-wrap ${ANIM.filterTransition}`}>
          {selectedUltg && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedUltg(null)}><X className="h-2.5 w-2.5" />{selectedUltg}</Badge>}
          {selectedGi && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedGi(null)}><X className="h-2.5 w-2.5" />{selectedGi}</Badge>}
          {selectedStatus && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedStatus(null)}><X className="h-2.5 w-2.5" />{selectedStatus}</Badge>}
          {selectedProgram && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20 max-w-45 truncate`} onClick={() => setSelectedProgram(null)}><X className="h-2.5 w-2.5" />{selectedProgram}</Badge>}
          <button className={`${TEXT.badge} text-primary hover:underline ml-1 flex items-center gap-0.5`} onClick={clearAll}><RefreshCw className="h-2.5 w-2.5" />Reset</button>
        </div>
      )}

      {/* KPI — 1 card ringkasan lengkap */}
      <div className="rounded-md overflow-hidden border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300" style={{ background: COLORS.cardBg }}>
        <div className="flex items-center gap-0 divide-x divide-border/20">
          {/* Progress utama */}
          <div className="flex-1 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`${TEXT.kpiLabel} text-muted-foreground uppercase tracking-wider`}>Progress Keseluruhan</span>
              <span className="text-sm font-bold" style={{ color: COLORS.selesai }}>{stats.pct}%</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className={`h-full rounded-full ${ANIM.chartTransition}`}
                style={{ width: `${stats.pct}%`, background: `linear-gradient(90deg, ${COLORS.selesai}, ${COLORS.teal})` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className={`${TEXT.kpiLabel} text-muted-foreground`}>{stats.selesai} selesai</span>
              <span className={`${TEXT.kpiLabel} text-muted-foreground`}>{stats.belum} belum</span>
            </div>
          </div>
          {/* Selesai */}
          <div className="px-4 py-3 text-center min-w-22.5 cursor-pointer hover:bg-emerald-500/5" onClick={() => setSelectedStatus(prev => prev === "Selesai" ? null : "Selesai")}>
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.selesai }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`} style={{ color: selectedStatus === "Selesai" ? COLORS.selesai : undefined }}>{stats.selesai}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Selesai</p>
          </div>
          {/* Belum */}
          <div className="px-4 py-3 text-center min-w-22.5 cursor-pointer hover:bg-rose-500/5" onClick={() => setSelectedStatus(prev => prev === "Belum Selesai" ? null : "Belum Selesai")}>
            <XCircle className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.belum }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`} style={{ color: selectedStatus === "Belum Selesai" ? COLORS.belum : undefined }}>{stats.belum}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Belum</p>
          </div>
          {/* Program */}
          <div className="px-4 py-3 text-center min-w-22.5">
            <CalendarDays className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.indigo }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`}>{stats.programs.length}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Program</p>
          </div>
          {/* GI */}
          <div className="px-4 py-3 text-center min-w-22.5">
            <Building2 className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.amber }} />
            <div className={`${TEXT.kpiValue} font-extrabold leading-none`}>{stats.giList.length}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Gardu Induk</p>
          </div>
          {/* ULTG breakdown */}
          <div className="px-4 py-3 min-w-32.5">
            <p className={`${TEXT.kpiLabel} text-muted-foreground uppercase tracking-wider mb-1.5`}>ULTG</p>
            {Object.entries(stats.ultgCounts).map(([name, count], i) => (
              <div key={name} className={`flex items-center justify-between gap-2 cursor-pointer hover:brightness-125 ${ANIM.hoverTransition}`}
                onClick={() => { setSelectedUltg(prev => prev === name ? null : name); setSelectedGi(null); }}>
                <span className={`${TEXT.kpiLabel} ${selectedUltg === name ? "font-bold" : ""}`} style={{ color: COLORS.palette[i] }}>{name}</span>
                <span className={`${TEXT.kpiLabel} font-mono font-bold`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar + Donuts */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${LAYOUT.cardGap}`}>
        <div className="lg:col-span-8 overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300" style={{ background: COLORS.cardBg }}>
          <div className={`${LAYOUT.headerPadding} flex items-center justify-center gap-2`}>
            {selectedProgram && (
              <button onClick={() => setSelectedProgram(null)}
                className={`flex items-center gap-1 text-muted-foreground hover:text-primary ${TEXT.badge} ${ANIM.hoverTransition}`}>
                <RefreshCw className="h-3 w-3" /> Kembali
              </button>
            )}
            <span className={`${TEXT.cardTitle} font-semibold`}>{selectedProgram ?? "Progress per Program"}</span>
          </div>
          <div className={LAYOUT.cardPaddingTight} style={{ flex: 1, minHeight: 400 }}>
            <ReactECharts key={selectedProgram ? "drilldown" : "normal"}
              option={barOption} notMerge={true} style={{ height: "100%", width: "100%" }}
              onEvents={{ click: handleBarClick }} />
          </div>
        </div>

        <div className={`lg:col-span-4 flex flex-col ${LAYOUT.cardGap}`}>
          <div className="flex-1 overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
            <span className={`${TEXT.cardTitle} font-semibold absolute top-1.5 left-2 z-10 opacity-70`}>Distribusi ULTG</span>
            <div className="flex-1" style={{ minHeight: 0 }}>
              <ReactECharts option={ultgDonutOption} style={{ height: "100%", width: "100%" }}
                onEvents={{ click: (p: { name?: string }) => { if (p.name) { setSelectedUltg(prev => prev === p.name ? null : p.name!); setSelectedGi(null); }}}} />
            </div>
          </div>
          <div className="flex-1 overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
            <span className={`${TEXT.cardTitle} font-semibold absolute top-1.5 left-2 z-10 opacity-70`}>Progress Status</span>
            <div className="flex-1" style={{ minHeight: 0 }}>
              <ReactECharts option={statusDonutOption} style={{ height: "100%", width: "100%" }}
                onEvents={{ click: (p: { name?: string }) => { if (p.name) setSelectedStatus(prev => prev === p.name ? null : p.name as StatusLabel); }}} />
            </div>
          </div>
        </div>
      </div>

      {/* Table — sortable, sticky header */}
      <div className="overflow-hidden rounded-md border border-transparent hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300" style={{ background: COLORS.cardBg }}>
        <div className={`${LAYOUT.headerPadding} flex items-center`}>
          <span className={`${TEXT.cardTitle} font-semibold`}>Detail Program Kerja</span>
          <Badge variant="secondary" className={`ml-2 ${TEXT.badge}`}>{filtered.length}</Badge>
        </div>
        <div className="overflow-auto max-h-87.5">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
              <TableRow className={`${LAYOUT.tableRowHeight} border-b border-border/20 hover:bg-transparent`}>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center w-8 cursor-pointer select-none`} onClick={() => handleSort("NO")}>No<SortIcon col="NO" /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 min-w-37.5 cursor-pointer select-none`} onClick={() => handleSort("NAMA PROGRAM")}>Program<SortIcon col="NAMA PROGRAM" /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center cursor-pointer select-none`} onClick={() => handleSort("Master ULTG")}>ULTG<SortIcon col="Master ULTG" /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 cursor-pointer select-none`} onClick={() => handleSort("Master Gardu Induk")}>Gardu Induk<SortIcon col="Master Gardu Induk" /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 cursor-pointer select-none`} onClick={() => handleSort("Master Bay")}>Bay<SortIcon col="Master Bay" /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center`}>Pos</TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center`}>Realisasi</TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center cursor-pointer select-none`} onClick={() => handleSort("KETERANGAN")}>Status<SortIcon col="KETERANGAN" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => {
                const done = isSelesai(r);
                const isHl = selectedProgram === r[H.NAMA];
                return (
                  <TableRow key={i}
                    className={`${LAYOUT.tableRowHeight} border-b border-border/10 cursor-pointer ${ANIM.hoverTransition}
                      ${isHl ? "bg-indigo-500/10 ring-1 ring-indigo-500/30" : done ? "bg-emerald-500/3 hover:bg-muted/10" : "hover:bg-muted/10"}`}
                    onClick={() => setSelectedProgram(prev => prev === r[H.NAMA] ? null : r[H.NAMA])}>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center font-mono text-muted-foreground`}>{r[H.NO]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 font-medium ${isHl ? "text-indigo-400" : ""}`}>{r[H.NAMA]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                      <button className={`hover:text-primary ${ANIM.hoverTransition} ${selectedUltg === r[H.ULTG] ? "text-primary font-bold" : ""}`}
                        onClick={e => { e.stopPropagation(); setSelectedUltg(prev => prev === r[H.ULTG] ? null : r[H.ULTG]); setSelectedGi(null); }}>{r[H.ULTG]}</button>
                    </TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0`}>
                      <button className={`hover:text-primary text-left ${ANIM.hoverTransition} ${selectedGi === r[H.GI] ? "text-primary font-bold" : ""}`}
                        onClick={e => { e.stopPropagation(); setSelectedGi(prev => prev === r[H.GI] ? null : r[H.GI]); }}>{r[H.GI]}</button>
                    </TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-muted-foreground`}>{r[H.BAY]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center text-muted-foreground`}>{r[H.POS]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>{r[H.REAL]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${ANIM.hoverTransition}
                        ${done ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                        {done ? "SELESAI" : "BELUM"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
