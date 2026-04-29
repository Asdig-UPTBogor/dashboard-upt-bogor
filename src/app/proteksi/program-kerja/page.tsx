"use client";

import { useMemo, useCallback, useState } from "react";
import { usePageData } from "@/hooks/usePageData";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import dynamic from "next/dynamic";
import { CheckCircle2, XCircle, CircleDot, CalendarDays, Shield, Building2, X, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, BarChart3, LineChart } from "lucide-react";
import { DataFreshness } from "@/components/DataFreshness";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COLORS, LAYOUT, TEXT, CHART, ANIM } from "@/app/gardu-induk/program-kerja/_components/design-tokens";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ── Column keys (match sheet headers) ── */
const P = {
  NAMA: "Nama Program", ULTG: "ULTG", GI: "Gardu Induk",
  BAY: "Bay/Diameter/Target Lokasi", TGL_R: "Tanggal \nRencana", TGL_S: "Tanggal\nSelesai",
  TARGET: "Target", STATUS: "Status", KET: "Keterangan",
} as const;

type Row = Record<string, string>;
type StatusLabel = "Selesai" | "Belum Selesai";
type SortKey = string | null;
type SortDir = "asc" | "desc";

export default function ProgramKerjaProteksiPage() {
  const { sheets } = usePageData("/proteksi/program-kerja");
  const theme = useChartTheme();
  const rows = useMemo(() => (sheets[0]?.rows || []) as unknown as Row[], [sheets]);

  /* ── Filter states ── */
  const [selectedUltg, setSelectedUltg] = useState<string | null>(null);
  const [selectedGi, setSelectedGi] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusLabel | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [chartMode, setChartMode] = useState<"bar" | "line" | "rencana">("bar");
  const [tlDrill, setTlDrill] = useState<number | null>(null);
  const [rencanaUltg, setRencanaUltg] = useState<string | null>(null);

  const clearAll = useCallback(() => {
    setSelectedUltg(null); setSelectedGi(null);
    setSelectedStatus(null); setSelectedProgram(null);
  }, []);
  const hasFilter = selectedUltg || selectedGi || selectedStatus || selectedProgram;

  const isSelesai = useCallback((r: Row) => {
    const s = (r[P.STATUS] || "").trim().toUpperCase();
    return s.includes("SELESAI") && !s.includes("BELUM");
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  /* ── Filtered + sorted data ── */
  const filtered = useMemo(() => {
    let r = rows;
    if (selectedUltg) r = r.filter(x => x[P.ULTG] === selectedUltg);
    if (selectedGi) r = r.filter(x => x[P.GI] === selectedGi);
    if (selectedStatus) r = r.filter(x => selectedStatus === "Selesai" ? isSelesai(x) : !isSelesai(x));
    if (selectedProgram) r = r.filter(x => x[P.NAMA] === selectedProgram);
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const va = (a[sortKey] || "").toLowerCase();
        const vb = (b[sortKey] || "").toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb, "id", { numeric: true }) : vb.localeCompare(va, "id", { numeric: true });
      });
    }
    return r;
  }, [rows, selectedUltg, selectedGi, selectedStatus, selectedProgram, isSelesai, sortKey, sortDir]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = filtered.length;
    const selesai = filtered.filter(isSelesai).length;
    const nonTarget = filtered.filter(r => {
      const tgt = (r[P.TARGET] || "").toLowerCase().trim();
      return tgt.includes("non") || tgt === "non target";
    }).length;
    const belum = total - selesai - nonTarget;
    const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
    const programs = [...new Set(filtered.map(r => r[P.NAMA]).filter(Boolean))];
    const giList = [...new Set(filtered.map(r => r[P.GI]).filter(Boolean))];
    const ultgCounts: Record<string, number> = {};
    filtered.forEach(r => { const u = r[P.ULTG]; if (u) ultgCounts[u] = (ultgCounts[u] || 0) + 1; });
    return { total, selesai, belum, nonTarget, pct, programs, giList, ultgCounts };
  }, [filtered, isSelesai]);

  /* ── Bar data (with non-target) ── */
  const barPrograms = useMemo(() => {
    let base = rows;
    if (selectedUltg) base = base.filter(x => x[P.ULTG] === selectedUltg);
    if (selectedGi) base = base.filter(x => x[P.GI] === selectedGi);
    if (selectedProgram) base = base.filter(x => x[P.NAMA] === selectedProgram);

    const map = new Map<string, { total: number; selesai: number; nonTarget: number }>();
    base.forEach(row => {
      const name = row[P.NAMA]; if (!name) return;
      const e = map.get(name) || { total: 0, selesai: 0, nonTarget: 0 };
      e.total++;
      if (isSelesai(row)) e.selesai++;
      const tgt = (row[P.TARGET] || "").toLowerCase().trim();
      if (tgt.includes("non") || tgt === "non target") e.nonTarget++;
      map.set(name, e);
    });

    let visibleNames: Set<string> | null = null;
    if (selectedStatus) {
      const statusRows = base.filter(x => selectedStatus === "Selesai" ? isSelesai(x) : !isSelesai(x));
      visibleNames = new Set(statusRows.map(x => x[P.NAMA]).filter(Boolean));
    }

    return [...map.entries()]
      .filter(([name]) => !visibleNames || visibleNames.has(name))
      .map(([name, { total, selesai, nonTarget }]) => ({
        name, total, selesai, nonTarget,
        target: total - nonTarget,
        pct: total > 0 ? Math.round((selesai / total) * 100) : 0,
      }))
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
      textStyle: { color: "#d4d4d8", fontSize: TEXT.chartTooltip },
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
          n: { fontSize: D.labelFontSize, color: "#d4d4d8", fontWeight: "bold" as const, lineHeight: 14 },
          v: { fontSize: D.labelFontSize + 1, color: COLORS.amber, fontWeight: "bold" as const },
          p: { fontSize: D.labelFontSize, color: "#d4d4d8" },
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

  /* ── ULTG donut ── */
  const ultgDonutOption = useMemo(() => mkDonut(
    Object.entries(stats.ultgCounts).map(([name, value], i) => ({
      name, value,
      itemStyle: { color: COLORS.palette[i % COLORS.palette.length] },
      ...(selectedUltg === name ? { selected: true } : {}),
    }))
  ), [stats.ultgCounts, mkDonut, selectedUltg]);

  /* ── Status donut ── */
  const statusDonutOption = useMemo(() => mkDonut([
    { name: "Selesai", value: stats.selesai, itemStyle: { color: COLORS.selesai }, ...(selectedStatus === "Selesai" ? { selected: true } : {}) },
    { name: "Belum Selesai", value: stats.belum, itemStyle: { color: COLORS.belum }, ...(selectedStatus === "Belum Selesai" ? { selected: true } : {}) },
    ...(stats.nonTarget > 0 ? [{ name: "Non Target", value: stats.nonTarget, itemStyle: { color: COLORS.amber } }] : []),
  ]), [stats, mkDonut, selectedStatus]);

  /* ── Drill-down data ── */
  const drillDownData = useMemo(() => {
    if (!selectedProgram) return null;
    const giMap = new Map<string, { bays: Array<{ name: string; done: boolean }> }>();
    filtered.forEach(row => {
      const gi = row[P.GI] || "—";
      const e = giMap.get(gi) || { bays: [] };
      e.bays.push({ name: row[P.BAY] || "—", done: isSelesai(row) });
      giMap.set(gi, e);
    });
    return [...giMap.entries()]
      .map(([gi, { bays }]) => ({
        gi, bays: bays.sort((a, b) => a.name.localeCompare(b.name)),
        selesai: bays.filter(b => b.done).length, total: bays.length,
      }))
      .sort((a, b) => a.gi.localeCompare(b.gi));
  }, [selectedProgram, filtered, isSelesai]);

  /* ── Bar chart option ── */
  const B = CHART.bar;
  const G = B.gradient;
  const barOption = useMemo(() => {
    /* drill-down mode */
    if (drillDownData && drillDownData.length > 0) {
      const maxBays = Math.max(...drillDownData.map(d => d.total));
      const labels = drillDownData.map(d => d.gi.length > B.labelTruncate ? d.gi.substring(0, B.labelTruncate) + "…" : d.gi);
      const baySeriesList = Array.from({ length: maxBays }, (_, i) => ({
        name: `Bay ${i + 1}`, type: "bar" as const, stack: "bays",
        data: drillDownData.map(d => {
          const bay = d.bays[i];
          if (!bay) return { value: 0, itemStyle: { color: "transparent" }, label: { show: false } };
          return {
            value: 100 / d.total,
            itemStyle: {
              color: bay.done ? COLORS.selesai : COLORS.belum,
              borderRadius: i === d.bays.length - 1 ? [0, 3, 3, 0] : i === 0 ? [3, 0, 0, 3] : [0, 0, 0, 0],
              borderColor: "rgba(0,0,0,0.3)", borderWidth: 1,
            },
          };
        }),
        barWidth: B.barWidth,
        label: {
          show: true, position: "inside" as const,
          fontSize: Math.max(7, Math.min(10, Math.floor(120 / maxBays))),
          color: "#fff", fontWeight: "bold" as const, overflow: "truncate" as const, ellipsis: "…",
          width: maxBays > 1 ? Math.floor(600 / maxBays) : undefined,
          formatter: (p: { dataIndex: number }) => {
            const d = drillDownData[p.dataIndex]; const bay = d?.bays[i];
            if (!bay) return "";
            if (d.total > 4 && bay.name.length > 8) return bay.name.substring(0, 7) + "…";
            if (d.total > 6 && bay.name.length > 5) return bay.name.substring(0, 4) + "…";
            return bay.name;
          },
        },
        tooltip: { show: false },
      }));
      baySeriesList.push({
        name: "Summary", type: "bar" as const, stack: "bays",
        data: drillDownData.map(() => ({ value: 0, itemStyle: { color: "transparent" }, label: { show: true } })),
        barWidth: B.barWidth,
        label: {
          show: true, position: "right" as const as never,
          fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: theme.text,
          overflow: "none" as never, ellipsis: "…", width: undefined,
          formatter: (p: { dataIndex: number }) => {
            const d = drillDownData[p.dataIndex];
            return d ? `${d.selesai}/${d.total}` : "";
          },
        },
        tooltip: { show: false },
      });
      return {
        backgroundColor: "transparent",
        textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
        tooltip: {
          trigger: "axis" as const, backgroundColor: COLORS.tooltipBg, borderColor: COLORS.tooltipBorder, borderRadius: 8,
          textStyle: { color: "#d4d4d8", fontSize: TEXT.chartTooltip },
          formatter: (params: Array<{ dataIndex: number }>) => {
            if (!params.length) return "";
            const d = drillDownData[params[0].dataIndex]; if (!d) return "";
            const bayList = d.bays.map(b =>
              `<span style="color:${b.done ? COLORS.selesai : COLORS.belum}">●</span> ${b.name}: <b>${b.done ? "Selesai" : "Belum"}</b>`
            ).join("<br/>");
            return `<b>${d.gi}</b><br/>Progress: <b>${d.selesai}/${d.total}</b><br/><hr style="border-color:#333;margin:4px 0"/>${bayList}`;
          },
        },
        grid: { top: 4, right: B.rightMargin, bottom: 4, left: B.leftMargin, containLabel: false },
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

    /* normal mode */
    return {
      backgroundColor: "transparent",
      textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: theme.textMuted },
      tooltip: {
        trigger: "axis" as const, backgroundColor: COLORS.tooltipBg, borderColor: COLORS.tooltipBorder, borderRadius: 8,
        textStyle: { color: "#d4d4d8", fontSize: TEXT.chartTooltip },
        axisPointer: { type: "shadow" as const, shadowStyle: { color: "rgba(129,140,248,0.06)" } },
        formatter: (params: Array<{ name: string }>) => {
          if (!params.length) return "";
          const prog = barPrograms.find(p => p.name === params[0].name || (p.name.length > B.labelTruncate && p.name.substring(0, B.labelTruncate) + "\u2026" === params[0].name));
          if (!prog) return params[0].name;
          const belum = Math.max(prog.target - prog.selesai, 0);
          let html = `<b style="color:${COLORS.indigo}">${prog.name}</b><br/>`;
          html += `<span style="color:${COLORS.selesai}">\u25cf Selesai:</span> <b>${prog.selesai}</b><br/>`;
          html += `<span style="color:${COLORS.belum}">\u25cf Belum Target:</span> <b>${belum}</b><br/>`;
          if (prog.nonTarget > 0) html += `<span style="color:${COLORS.amber}">\u25cf Non-Target:</span> <b>${prog.nonTarget}</b><br/>`;
          html += `<span style="color:#94a3b8">Progress:</span> <b>${prog.pct}%</b>`;
          return html;
        },
      },
      grid: { top: 4, right: B.rightMargin, bottom: 4, left: B.leftMargin, containLabel: false },
      yAxis: {
        type: "category" as const,
        data: barPrograms.map(p => p.name.length > B.labelTruncate ? p.name.substring(0, B.labelTruncate) + "\u2026" : p.name),
        axisLabel: { fontSize: TEXT.chartAxisLabel, color: theme.text, overflow: "truncate" as const, width: B.labelWidth },
        axisLine: { show: false }, axisTick: { show: false }, inverse: true, triggerEvent: true,
      },
      xAxis: { type: "value" as const, max: 100, show: false },
      series: [
        /* Green: progress */
        {
          name: "Progress", type: "bar" as const, stack: "work",
          data: barPrograms.map(p => {
            const grad = p.pct >= 100 ? G.full : p.pct >= 50 ? G.high : p.pct > 0 ? G.medium : G.zero;
            return {
              value: p.pct,
              itemStyle: {
                color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [{ offset: 0, color: grad.from }, { offset: 1, color: grad.to }],
                },
                borderRadius: p.nonTarget === 0 ? B.borderRadius : [3, 0, 0, 3],
                borderColor: "rgba(128,128,128,0.3)", borderWidth: 1,
              },
            };
          }),
          barWidth: B.barWidth,
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
        /* Orange: non-target (appended after green) */
        {
          name: "Non-Target", type: "bar" as const, stack: "work",
          data: barPrograms.map(p => {
            const ntPct = p.total > 0 ? Math.round((p.nonTarget / p.total) * 100) : 0;
            return {
              value: ntPct,
              itemStyle: {
                color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [{ offset: 0, color: "rgba(251,146,60,0.6)" }, { offset: 1, color: "rgba(251,146,60,0.9)" }],
                },
                borderRadius: [0, 3, 3, 0],
                borderColor: "rgba(251,146,60,0.35)", borderWidth: 1,
              },
            };
          }),
          barWidth: B.barWidth,
          label: {
            show: true, position: "inside" as const,
            fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: "#fff",
            formatter: (p: { dataIndex: number }) => {
              const prog = barPrograms[p.dataIndex];
              if (!prog || prog.nonTarget === 0) return "";
              const ntPct = Math.round((prog.nonTarget / prog.total) * 100);
              return `+${ntPct}%`;
            },
          },
        },
        /* Right label */
        {
          name: "Label", type: "bar" as const, stack: "work",
          data: barPrograms.map(p => {
            const ntPct = p.total > 0 ? Math.round((p.nonTarget / p.total) * 100) : 0;
            return { value: 100 - p.pct - ntPct, itemStyle: { color: "transparent" } };
          }),
          barWidth: B.barWidth,
          tooltip: { show: false },
          label: {
            show: true, position: "right" as const,
            fontSize: TEXT.chartLabel, fontWeight: "bold" as const,
            formatter: (p: { dataIndex: number }) => {
              const prog = barPrograms[p.dataIndex];
              if (!prog) return "";
              let lbl = `{ok|${prog.selesai}}{sep|/}{total|${prog.target}}`;
              if (prog.nonTarget > 0) lbl += `{sep| }{nt|+${prog.nonTarget}}`;
              return lbl;
            },
            rich: {
              ok: { fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: COLORS.selesai },
              sep: { fontSize: TEXT.chartLabel, color: theme.textMuted },
              total: { fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: theme.text },
              nt: { fontSize: TEXT.chartLabel, fontWeight: "bold" as const, color: COLORS.amber },
            },
          },
        },
      ],
      animationDuration: B.animDuration, animationEasing: ANIM.chartEasing,
    };
  }, [barPrograms, drillDownData, theme, B, G]);

  /* ── Line chart option (premium) ── */
  const lineOption = useMemo(() => {
    const sorted = [...barPrograms].sort((a, b) => b.pct - a.pct);
    const labels = sorted.map(p => p.name.length > 12 ? p.name.substring(0, 11) + "\u2026" : p.name);
    return {
      backgroundColor: "transparent",
      textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif" },
      tooltip: {
        trigger: "axis" as const, backgroundColor: COLORS.tooltipBg,
        borderColor: "rgba(99,102,241,0.3)", borderWidth: 1, borderRadius: 10,
        textStyle: { color: "#d4d4d8", fontSize: 11 },
        axisPointer: { type: "line" as const, lineStyle: { color: "rgba(129,140,248,0.2)", type: "dashed" as const } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          if (!params.length) return "";
          const prog = sorted[params[0].dataIndex];
          if (!prog) return "";
          const belum = Math.max(prog.target - prog.selesai, 0);
          const ntPct = prog.total > 0 ? Math.round((prog.nonTarget / prog.total) * 100) : 0;
          let h = `<div style="font-weight:700;color:#c7d2fe;font-size:12px;margin-bottom:6px">${prog.name}</div>`;
          h += `<div style="font-size:11px;line-height:1.8">`;
          h += `<span style="color:${COLORS.selesai}">\u25cf</span> Selesai: <b>${prog.selesai}</b> / ${prog.target}<br/>`;
          h += `<span style="color:${COLORS.belum}">\u25cf</span> Belum: <b>${belum}</b><br/>`;
          if (prog.nonTarget > 0) h += `<span style="color:${COLORS.amber}">\u25cf</span> Non-Target: <b>${prog.nonTarget}</b> (${ntPct}%)<br/>`;
          h += `</div>`;
          h += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #334155;font-size:13px;font-weight:700;color:${prog.pct >= 100 ? COLORS.selesai : prog.pct >= 50 ? "#22d3ee" : COLORS.belum}">Progress: ${prog.pct}%</div>`;
          return h;
        },
      },
      grid: { top: 24, right: 12, bottom: 56, left: 40 },
      xAxis: {
        type: "category" as const, data: labels, boundaryGap: false,
        axisLabel: { fontSize: 7, color: "rgba(148,163,184,0.5)", rotate: 35, interval: 0 },
        axisLine: { lineStyle: { color: "rgba(99,102,241,0.08)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const, max: 100, min: 0,
        axisLabel: { fontSize: 8, color: "rgba(148,163,184,0.3)", formatter: "{value}%" },
        splitLine: { lineStyle: { color: "rgba(99,102,241,0.05)", type: "dashed" as const } },
        axisLine: { show: false },
      },
      series: [{
        name: "Progress", type: "line" as const,
        data: sorted.map(p => p.pct), smooth: 0.4,
        lineStyle: { width: 2.5, color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [{ offset: 0, color: "#34d399" }, { offset: 0.4, color: "#22d3ee" }, { offset: 1, color: "#818cf8" }] },
          shadowBlur: 6, shadowColor: "rgba(52,211,153,0.25)", shadowOffsetY: 2 },
        areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: "rgba(52,211,153,0.15)" }, { offset: 0.5, color: "rgba(34,211,238,0.04)" }, { offset: 1, color: "transparent" }] } },
        symbol: "circle", symbolSize: (v: number) => v > 0 ? 6 : 3,
        itemStyle: { color: (p: { dataIndex: number }) => { const prog = sorted[p.dataIndex]; if (!prog) return "#818cf8"; return prog.pct >= 100 ? COLORS.selesai : prog.pct >= 50 ? "#22d3ee" : prog.pct > 0 ? "#818cf8" : "rgba(148,163,184,0.2)"; }, borderColor: "#1e1b4b", borderWidth: 1.5 },
        emphasis: { scale: true, itemStyle: { shadowBlur: 10, shadowColor: "rgba(52,211,153,0.5)", borderWidth: 3, borderColor: "#c7d2fe" } },
        label: { show: true, position: "top" as const, distance: 6, fontSize: 9, fontWeight: "bold" as const,
          formatter: (p: { value: number }) => p.value > 0 ? `${p.value}%` : "",
          color: (p: { dataIndex: number }) => { const prog = sorted[p.dataIndex]; if (!prog || prog.pct === 0) return "transparent"; return prog.pct >= 100 ? COLORS.selesai : prog.pct >= 50 ? "#22d3ee" : "#c7d2fe"; } },
        markLine: { silent: true, symbol: "none" as const, data: [
          { yAxis: 50, lineStyle: { color: "rgba(34,211,238,0.1)", type: "dashed" as const, width: 1 }, label: { show: true, position: "end" as const, formatter: "50%", fontSize: 7, color: "rgba(34,211,238,0.2)" } },
        ] },
      }],
      animationDuration: 600, animationEasing: "cubicOut" as const,
    };
  }, [barPrograms]);

  /* ── Timeline: estimasi per bulan ── */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const currentMonth = 2; // March = index 2

  const parseDate = useCallback((d: string) => {
    if (!d) return null;
    const s = d.trim().replace(/\n/g, "");
    // Try dd/mm/yyyy or dd-mm-yyyy
    const m1 = s.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
    if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
    return null;
  }, []);

  const programs = useMemo(() => [...new Set(rows.map(r => r[P.NAMA]).filter(Boolean))], [rows]);
  const PROG_COLORS = useMemo(() => {
    const pal = ["#818cf8", "#34d399", "#22d3ee", "#f472b6", "#fb923c", "#a78bfa", "#60a5fa", "#fbbf24",
      "#4ade80", "#f87171", "#2dd4bf", "#c084fc", "#38bdf8", "#fb7185", "#a3e635", "#e879f9"];
    const map: Record<string, string> = {};
    programs.forEach((p, i) => { map[p] = pal[i % pal.length]; });
    return map;
  }, [programs]);

  /* Monthly data grouped by program */
  const monthlyData = useMemo(() => {
    const data: Array<{ month: number; programs: Record<string, { rencana: number; selesai: number }> }> =
      Array.from({ length: 12 }, (_, i) => ({ month: i, programs: {} }));
    const src = rencanaUltg ? rows.filter(r => r[P.ULTG] === rencanaUltg) : rows;
    src.forEach(row => {
      const dt = parseDate(row[P.TGL_R]);
      if (!dt) return;
      const mi = dt.getMonth();
      const prog = row[P.NAMA] || "\u2014";
      if (!data[mi].programs[prog]) data[mi].programs[prog] = { rencana: 0, selesai: 0 };
      data[mi].programs[prog].rencana++;
      if (isSelesai(row)) data[mi].programs[prog].selesai++;
    });
    return data;
  }, [rows, parseDate, isSelesai, rencanaUltg]);

  /* Weekly breakdown for drilled month */
  const weeklyData = useMemo(() => {
    if (tlDrill === null) return null;
    const year = 2026;
    const firstDay = new Date(year, tlDrill, 1);
    const lastDay = new Date(year, tlDrill + 1, 0);
    const weeks: Array<{ label: string; start: Date; end: Date; programs: Record<string, { rencana: number; selesai: number }> }> = [];
    let ws = new Date(firstDay);
    let wn = 1;
    while (ws <= lastDay) {
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      if (we > lastDay) we.setTime(lastDay.getTime());
      weeks.push({ label: `W${wn} (${ws.getDate()}\u2013${we.getDate()})`, start: new Date(ws), end: new Date(we), programs: {} });
      ws.setDate(ws.getDate() + 7);
      wn++;
    }
    const src = rencanaUltg ? rows.filter(r => r[P.ULTG] === rencanaUltg) : rows;
    src.forEach(row => {
      const dt = parseDate(row[P.TGL_R]);
      if (!dt || dt.getMonth() !== tlDrill) return;
      const prog = row[P.NAMA] || "\u2014";
      for (const w of weeks) {
        if (dt >= w.start && dt <= w.end) {
          if (!w.programs[prog]) w.programs[prog] = { rencana: 0, selesai: 0 };
          w.programs[prog].rencana++;
          if (isSelesai(row)) w.programs[prog].selesai++;
          break;
        }
      }
    });
    return weeks;
  }, [tlDrill, rows, parseDate, isSelesai, rencanaUltg]);

  /* Timeline chart option */
  const timelineOption = useMemo(() => {
    if (tlDrill !== null && weeklyData) {
      /* Weekly drill-down */
      const wLabels = weeklyData.map(w => w.label);
      const activeProgs = [...new Set(weeklyData.flatMap(w => Object.keys(w.programs)))];
      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis" as const,
          backgroundColor: "rgba(15,12,41,0.92)",
          borderColor: "rgba(129,140,248,0.2)", borderWidth: 1, borderRadius: 10,
          padding: [10, 14],
          textStyle: { color: "#d4d4d8", fontSize: 10, fontFamily: "ui-sans-serif, system-ui, sans-serif" },
          extraCssText: "backdrop-filter:blur(14px);box-shadow:0 8px 24px rgba(0,0,0,0.4),0 0 0 1px rgba(129,140,248,0.08);max-width:260px;",
          formatter: (params: Array<{ seriesName: string; value: number; color: string; marker: string; name: string }>) => {
            const active = params.filter(p => p.value > 0).sort((a, b) => b.value - a.value);
            const total = active.reduce((s, p) => s + p.value, 0);
            const wIdx = wLabels.indexOf(params[0]?.name || "");
            const wk = weeklyData![wIdx];
            let bogor = 0, sukabumi = 0;
            if (wk) {
              rows.forEach(row => {
                const dt = parseDate(row[P.TGL_R]);
                if (!dt || dt.getMonth() !== tlDrill) return;
                if (dt >= wk.start && dt <= wk.end) {
                  if (row[P.ULTG] === "Bogor") bogor++;
                  else if (row[P.ULTG] === "Sukabumi") sukabumi++;
                }
              });
            }
            let h = `<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">`;
            h += `<span style="font-size:12px;font-weight:700;color:#e0e7ff">${MONTHS[tlDrill]} · ${params[0]?.name || ""}</span>`;
            h += `<span style="font-size:12px;font-weight:700;color:#818cf8;margin-left:12px">${total}</span></div>`;
            h += `<div style="display:flex;gap:4px;margin-bottom:8px">`;
            h += `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(52,211,153,0.12);color:#6ee7b7">Bogor <b>${bogor}</b></span>`;
            h += `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(251,146,60,0.12);color:#fdba74">Sukabumi <b>${sukabumi}</b></span></div>`;
            if (active.length > 0) {
              h += `<div style="border-top:1px solid rgba(148,163,184,0.08);padding-top:6px">`;
              active.forEach(p => {
                h += `<div style="display:flex;align-items:center;gap:5px;padding:2px 0">${p.marker}<span style="flex:1;font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${p.seriesName}</span><span style="font-size:11px;font-weight:600;color:#e2e8f0;min-width:16px;text-align:right">${p.value}</span></div>`;
              });
              h += `</div>`;
            }
            return h;
          },
        },
        legend: { show: true, bottom: 0, left: "center", textStyle: { color: "rgba(148,163,184,0.8)", fontSize: 11 }, itemWidth: 14, itemHeight: 4, itemGap: 12, icon: "roundRect" },
        grid: { top: 16, right: 16, bottom: 48, left: 16, containLabel: true },
        xAxis: {
          type: "category" as const, data: wLabels,
          axisLabel: { fontSize: 10, color: "rgba(148,163,184,0.7)" },
          axisLine: { lineStyle: { color: "rgba(99,102,241,0.12)" } }, axisTick: { show: false },
        },
        yAxis: {
          type: "value" as const, min: 0, minInterval: 1,
          axisLabel: { fontSize: 9, color: "rgba(148,163,184,0.5)" },
          splitLine: { lineStyle: { color: "rgba(99,102,241,0.06)", type: "dashed" as const } },
          axisLine: { show: false },
        },
        series: activeProgs.map((prog) => ({
          name: prog,
          type: "line" as const, smooth: 0.3,
          data: weeklyData.map(w => w.programs[prog]?.rencana || 0),
          lineStyle: { color: PROG_COLORS[prog] || "#666", width: 2.5, shadowBlur: 4, shadowColor: (PROG_COLORS[prog] || "#666") + "55" },
          itemStyle: { color: PROG_COLORS[prog] || "#666", borderColor: "#1e1b4b", borderWidth: 2 },
          areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: (PROG_COLORS[prog] || "#666") + "25" }, { offset: 1, color: (PROG_COLORS[prog] || "#666") + "03" }],
          }},
          symbol: "circle", symbolSize: 6,
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: (PROG_COLORS[prog] || "#666") + "60", borderWidth: 3 }, focus: "series" as const },
          endLabel: { show: false },
        })),
        animationDuration: 400,
      };
    }
    /* Monthly overview */
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "rgba(15,12,41,0.92)",
        borderColor: "rgba(129,140,248,0.2)", borderWidth: 1, borderRadius: 10,
        padding: [10, 14],
        textStyle: { color: "#d4d4d8", fontSize: 10, fontFamily: "ui-sans-serif, system-ui, sans-serif" },
        extraCssText: "backdrop-filter:blur(14px);box-shadow:0 8px 24px rgba(0,0,0,0.4),0 0 0 1px rgba(129,140,248,0.08);max-width:260px;",
        formatter: (params: Array<{ seriesName: string; value: number; color: string; marker: string; name: string }>) => {
          const active = params.filter(p => p.value > 0).sort((a, b) => b.value - a.value);
          const total = active.reduce((s, p) => s + p.value, 0);
          const mi = MONTHS.indexOf(params[0]?.name || "");
          let bogor = 0, sukabumi = 0;
          if (mi >= 0) {
            rows.forEach(row => {
              const dt = parseDate(row[P.TGL_R]);
              if (!dt || dt.getMonth() !== mi) return;
              if (row[P.ULTG] === "Bogor") bogor++;
              else if (row[P.ULTG] === "Sukabumi") sukabumi++;
            });
          }
          let h = `<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">`;
          h += `<span style="font-size:12px;font-weight:700;color:#e0e7ff">${params[0]?.name || ""} 2026</span>`;
          h += `<span style="font-size:12px;font-weight:700;color:#818cf8;margin-left:12px">${total}</span></div>`;
          h += `<div style="display:flex;gap:4px;margin-bottom:8px">`;
          h += `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(52,211,153,0.12);color:#6ee7b7">Bogor <b>${bogor}</b></span>`;
          h += `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(251,146,60,0.12);color:#fdba74">Sukabumi <b>${sukabumi}</b></span></div>`;
          if (active.length > 0) {
            h += `<div style="border-top:1px solid rgba(148,163,184,0.08);padding-top:6px">`;
            active.forEach(p => {
              h += `<div style="display:flex;align-items:center;gap:5px;padding:2px 0">${p.marker}<span style="flex:1;font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${p.seriesName}</span><span style="font-size:11px;font-weight:600;color:#e2e8f0;min-width:16px;text-align:right">${p.value}</span></div>`;
            });
            h += `</div>`;
          }
          return h;
        },
      },
      legend: { show: true, bottom: 0, left: "center", textStyle: { color: "rgba(148,163,184,0.8)", fontSize: 11 }, itemWidth: 14, itemHeight: 4, itemGap: 12, icon: "roundRect" },
      grid: { top: 16, right: 16, bottom: 36, left: 16, containLabel: true },
      xAxis: {
        type: "category" as const, data: MONTHS, boundaryGap: false,
        axisLabel: { fontSize: 9, color: "rgba(148,163,184,0.7)" },
        axisLine: { lineStyle: { color: "rgba(99,102,241,0.12)" } }, axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const, name: "Rencana Item", min: 0,
        nameTextStyle: { color: "rgba(148,163,184,0.4)", fontSize: 8 },
        axisLabel: { fontSize: 8, color: "rgba(148,163,184,0.5)" },
        splitLine: { lineStyle: { color: "rgba(99,102,241,0.06)", type: "dashed" as const } },
        axisLine: { show: false },
      },
      series: [
        ...programs.map((prog, idx) => {
          const shortName = prog.length > 20 ? prog.substring(0, 19) + "…" : prog;
          const hasData = monthlyData.some(m => (m.programs[prog]?.rencana || 0) > 0);
          return {
            name: prog,
            type: "line" as const, smooth: 0.3,
            data: monthlyData.map(m => m.programs[prog]?.rencana || 0),
            lineStyle: { color: PROG_COLORS[prog] || "#666", width: hasData ? 2.5 : 1, shadowBlur: hasData ? 4 : 0, shadowColor: (PROG_COLORS[prog] || "#666") + "44" },
            itemStyle: { color: PROG_COLORS[prog] || "#666", borderColor: "#1e1b4b", borderWidth: 1.5 },
            areaStyle: hasData ? { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: (PROG_COLORS[prog] || "#666") + "15" }, { offset: 1, color: (PROG_COLORS[prog] || "#666") + "02" }],
            }} : undefined,
            symbol: "circle", symbolSize: hasData ? 5 : 3,
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: (PROG_COLORS[prog] || "#666") + "50" }, focus: "series" as const },
            endLabel: { show: false },
            markLine: idx === 0 ? {
              silent: true, symbol: "none" as const,
              data: [{ xAxis: MONTHS[currentMonth] }],
              lineStyle: { color: COLORS.amber, width: 2, type: "dashed" as const },
              label: {
                show: true, position: "start" as const,
                formatter: `Sekarang\n${MONTHS[currentMonth]}`,
                fontSize: 9, fontWeight: "bold" as const, color: COLORS.amber,
                backgroundColor: "rgba(30,27,75,0.85)", padding: [3, 6], borderRadius: 4,
              },
            } : undefined,
          };
        }),
      ],
      animationDuration: 500,
    };
  }, [monthlyData, weeklyData, tlDrill, programs, PROG_COLORS, currentMonth, rows, parseDate, rencanaUltg]);

  const handleTimelineClick = useCallback((params: { dataIndex?: number; componentType?: string }) => {
    if (tlDrill !== null) {
      setTlDrill(null);
      return;
    }
    if (params.componentType === "series" && params.dataIndex !== undefined) {
      setTlDrill(params.dataIndex);
    }
  }, [tlDrill]);

  const handleBarClick = useCallback((params: { name?: string; componentType?: string; value?: string }) => {
    if (selectedProgram) { setSelectedProgram(null); return; }
    const label = params.componentType === "yAxis" ? params.value : params.name;
    if (!label) return;
    const found = barPrograms.find(p => p.name === label || (p.name.length > B.labelTruncate && p.name.substring(0, B.labelTruncate) + "…" === label));
    if (found) setSelectedProgram(prev => prev === found.name ? null : found.name);
  }, [barPrograms, B.labelTruncate, selectedProgram]);

  /* ── Sort icon ── */
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-2.5 w-2.5 opacity-30 ml-0.5 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-primary ml-0.5 inline" /> : <ArrowDown className="h-2.5 w-2.5 text-primary ml-0.5 inline" />;
  };

  /* ═══ RENDER ═══ */
  return (
    <div className={`flex flex-col ${LAYOUT.sectionGap}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base md:text-lg font-bold tracking-tight flex items-center gap-1.5 whitespace-nowrap">
          <Shield className="h-5 w-5 text-primary" />
          Program Kerja Proteksi
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {stats.total} item · {stats.programs.length} program
          </span>
          <DataFreshness />
        </div>
      </div>

      {/* Filters */}
      {hasFilter && (
        <div className={`flex items-center gap-1 flex-wrap ${ANIM.filterTransition}`}>
          {selectedUltg && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedUltg(null)}><X className="h-2.5 w-2.5" />{selectedUltg}</Badge>}
          {selectedGi && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedGi(null)}><X className="h-2.5 w-2.5" />{selectedGi}</Badge>}
          {selectedStatus && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20`} onClick={() => setSelectedStatus(null)}><X className="h-2.5 w-2.5" />{selectedStatus}</Badge>}
          {selectedProgram && <Badge variant="outline" className={`${TEXT.badge} cursor-pointer gap-0.5 hover:bg-destructive/20 max-w-[180px] truncate`} onClick={() => setSelectedProgram(null)}><X className="h-2.5 w-2.5" />{selectedProgram}</Badge>}
          <button className={`${TEXT.badge} text-primary hover:underline ml-1 flex items-center gap-0.5`} onClick={clearAll}><RefreshCw className="h-2.5 w-2.5" />Reset</button>
        </div>
      )}

      {/* KPI strip */}
      <div className="rounded-md overflow-hidden border border-transparent hover:shadow-sm transition-all duration-300" style={{ background: COLORS.cardBg }}>
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
              <span className={`${TEXT.kpiLabel} text-muted-foreground`}>{stats.belum} belum{stats.nonTarget > 0 ? ` · ${stats.nonTarget} NT` : ""}</span>
            </div>
          </div>
          {/* Selesai */}
          <div className="px-4 py-3 text-center min-w-[90px] cursor-pointer hover:bg-emerald-500/5" onClick={() => setSelectedStatus(prev => prev === "Selesai" ? null : "Selesai")}>
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.selesai }} />
            <div className={`${TEXT.kpiValue} font-bold leading-none`} style={{ color: selectedStatus === "Selesai" ? COLORS.selesai : undefined }}>{stats.selesai}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Selesai</p>
          </div>
          {/* Belum */}
          <div className="px-4 py-3 text-center min-w-[90px] cursor-pointer hover:bg-rose-500/5" onClick={() => setSelectedStatus(prev => prev === "Belum Selesai" ? null : "Belum Selesai")}>
            <XCircle className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.belum }} />
            <div className={`${TEXT.kpiValue} font-bold leading-none`} style={{ color: selectedStatus === "Belum Selesai" ? COLORS.belum : undefined }}>{stats.belum}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Belum</p>
          </div>
          {/* Non Target */}
          {stats.nonTarget > 0 && (
          <div className="px-4 py-3 text-center min-w-[90px]">
            <CircleDot className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.amber }} />
            <div className={`${TEXT.kpiValue} font-bold leading-none`} style={{ color: COLORS.amber }}>{stats.nonTarget}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Non Target</p>
          </div>
          )}
          {/* Program */}
          <div className="px-4 py-3 text-center min-w-[90px]">
            <CalendarDays className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.indigo }} />
            <div className={`${TEXT.kpiValue} font-bold leading-none`}>{stats.programs.length}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Program</p>
          </div>
          {/* GI */}
          <div className="px-4 py-3 text-center min-w-[90px]">
            <Building2 className="h-4 w-4 mx-auto mb-1" style={{ color: COLORS.amber }} />
            <div className={`${TEXT.kpiValue} font-bold leading-none`}>{stats.giList.length}</div>
            <p className={`${TEXT.kpiLabel} text-muted-foreground mt-1`}>Gardu Induk</p>
          </div>
          {/* ULTG breakdown */}
          <div className="px-4 py-3 min-w-[130px]">
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

      {/* Chart + Donuts — or full-width Rencana */}
      {chartMode === "rencana" ? (
        <div className="overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-sm transition-all duration-300" style={{ background: COLORS.cardBg }}>
          <div className={`${LAYOUT.headerPadding} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <span className={`${TEXT.cardTitle} font-semibold`}>Rencana Jadwal Program</span>
              <div className="flex items-center gap-0.5 rounded-md border border-border/30 overflow-hidden ml-2">
                <button onClick={() => setRencanaUltg(null)}
                  className={`px-2 py-0.5 text-xs font-medium transition-all ${!rencanaUltg ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                  Semua
                </button>
                <button onClick={() => setRencanaUltg("Bogor")}
                  className={`px-2 py-0.5 text-xs font-medium transition-all ${rencanaUltg === "Bogor" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                  Bogor
                </button>
                <button onClick={() => setRencanaUltg("Sukabumi")}
                  className={`px-2 py-0.5 text-xs font-medium transition-all ${rencanaUltg === "Sukabumi" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                  Sukabumi
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">
                {tlDrill !== null ? `${MONTHS[tlDrill]} 2026 — Mingguan (klik chart untuk kembali)` : "Jan — Des 2026"}
              </span>
              <div className="flex items-center gap-0.5 rounded-md border border-border/30 overflow-hidden">
                <button onClick={() => setChartMode("bar")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all`}>
                  <BarChart3 className="h-3 w-3" /> Bar
                </button>
                <button onClick={() => setChartMode("line")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all`}>
                  <LineChart className="h-3 w-3" /> Line
                </button>
                <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/15 text-primary transition-all">
                  <CalendarDays className="h-3 w-3" /> Rencana
                </button>
              </div>
            </div>
          </div>
          <div style={{ height: 480, padding: "0 8px 8px" }}>
            <ReactECharts key={tlDrill !== null ? `week-${tlDrill}` : "monthly-full"}
              option={timelineOption} notMerge={true} style={{ height: "100%", width: "100%" }}
              onEvents={{ click: handleTimelineClick }} />
          </div>
        </div>
      ) : (
      <div className={`grid grid-cols-1 lg:grid-cols-12 ${LAYOUT.cardGap}`}>
        <div className="lg:col-span-8 overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-sm transition-all duration-300" style={{ background: COLORS.cardBg }}>
          <div className={`${LAYOUT.headerPadding} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              {selectedProgram && (
                <button onClick={() => setSelectedProgram(null)}
                  className={`flex items-center gap-1 text-muted-foreground hover:text-primary ${TEXT.badge} ${ANIM.hoverTransition}`}>
                  <RefreshCw className="h-3 w-3" /> Kembali
                </button>
              )}
              <span className={`${TEXT.cardTitle} font-semibold`}>{selectedProgram ?? ((chartMode as string) === "rencana" ? "Rencana Jadwal Program" : "Progress per Program")}</span>
            </div>
            {!selectedProgram && (
              <div className="flex items-center gap-0.5 rounded-md border border-border/30 overflow-hidden">
                <button
                  onClick={() => setChartMode("bar")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all
                    ${chartMode === "bar" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                  <BarChart3 className="h-3 w-3" /> Bar
                </button>
                <button
                  onClick={() => setChartMode("line")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all
                    ${chartMode === "line" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                  <LineChart className="h-3 w-3" /> Line
                </button>
                <button
                  onClick={() => setChartMode("rencana")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-all
                    ${(chartMode as string) === "rencana" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                  <CalendarDays className="h-3 w-3" /> Rencana
                </button>
              </div>
            )}
          </div>
          <div className={LAYOUT.cardPaddingTight} style={{ flex: 1, minHeight: 400 }}>
            <ReactECharts key={`${chartMode}-${selectedProgram || "normal"}`}
              option={chartMode === "line" && !selectedProgram ? lineOption : barOption}
              notMerge={true} style={{ height: "100%", width: "100%" }}
              onEvents={chartMode === "bar" || selectedProgram ? { click: handleBarClick } : {}} />
          </div>
        </div>

        <div className={`lg:col-span-4 flex flex-col ${LAYOUT.cardGap}`}>
          <div className="flex-1 overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-sm transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
            <span className={`${TEXT.cardTitle} font-semibold absolute top-1.5 left-2 z-10 opacity-70`}>Distribusi ULTG</span>
            <div className="flex-1" style={{ minHeight: 0 }}>
              <ReactECharts option={ultgDonutOption} style={{ height: "100%", width: "100%" }}
                onEvents={{ click: (p: { name?: string }) => { if (p.name) { setSelectedUltg(prev => prev === p.name ? null : p.name!); setSelectedGi(null); }}}} />
            </div>
          </div>
          <div className="flex-1 overflow-hidden rounded-md flex flex-col border border-transparent hover:shadow-sm transition-all duration-300 relative" style={{ background: COLORS.cardBg }}>
            <span className={`${TEXT.cardTitle} font-semibold absolute top-1.5 left-2 z-10 opacity-70`}>Progress Status</span>
            <div className="flex-1" style={{ minHeight: 0 }}>
              <ReactECharts option={statusDonutOption} style={{ height: "100%", width: "100%" }}
                onEvents={{ click: (p: { name?: string }) => { if (p.name) setSelectedStatus(prev => prev === p.name ? null : p.name as StatusLabel); }}} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-transparent hover:shadow-sm transition-all duration-300" style={{ background: COLORS.cardBg }}>
        <div className={`${LAYOUT.headerPadding} flex items-center`}>
          <span className={`${TEXT.cardTitle} font-semibold`}>Detail Program Kerja</span>
          <Badge variant="secondary" className={`ml-2 ${TEXT.badge}`}>{filtered.length}</Badge>
        </div>
        <div className="overflow-auto max-h-[350px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
              <TableRow className={`${LAYOUT.tableRowHeight} border-b border-border/20 hover:bg-transparent`}>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 min-w-[150px] cursor-pointer select-none`} onClick={() => handleSort(P.NAMA)}>Program<SortIcon col={P.NAMA} /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center cursor-pointer select-none`} onClick={() => handleSort(P.ULTG)}>ULTG<SortIcon col={P.ULTG} /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 cursor-pointer select-none`} onClick={() => handleSort(P.GI)}>Gardu Induk<SortIcon col={P.GI} /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 cursor-pointer select-none`} onClick={() => handleSort(P.BAY)}>Bay/Lokasi<SortIcon col={P.BAY} /></TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center`}>Tgl Rencana</TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center`}>Tgl Selesai</TableHead>
                <TableHead className={`${LAYOUT.tableHeaderSize} font-semibold ${LAYOUT.tableRowHeight} px-2 text-center cursor-pointer select-none`} onClick={() => handleSort(P.STATUS)}>Status<SortIcon col={P.STATUS} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => {
                const done = isSelesai(r);
                const isHl = selectedProgram === r[P.NAMA];
                return (
                  <TableRow key={i}
                    className={`${LAYOUT.tableRowHeight} border-b border-border/10 cursor-pointer ${ANIM.hoverTransition}
                      ${isHl ? "bg-indigo-500/10 ring-1 ring-indigo-500/30" : done ? "bg-emerald-500/[0.03] hover:bg-muted/10" : "hover:bg-muted/10"}`}
                    onClick={() => setSelectedProgram(prev => prev === r[P.NAMA] ? null : r[P.NAMA])}>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 font-medium ${isHl ? "text-indigo-400" : ""}`}>{r[P.NAMA]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                      <button className={`hover:text-primary ${ANIM.hoverTransition} ${selectedUltg === r[P.ULTG] ? "text-primary font-bold" : ""}`}
                        onClick={e => { e.stopPropagation(); setSelectedUltg(prev => prev === r[P.ULTG] ? null : r[P.ULTG]); setSelectedGi(null); }}>{r[P.ULTG]}</button>
                    </TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0`}>
                      <button className={`hover:text-primary text-left ${ANIM.hoverTransition} ${selectedGi === r[P.GI] ? "text-primary font-bold" : ""}`}
                        onClick={e => { e.stopPropagation(); setSelectedGi(prev => prev === r[P.GI] ? null : r[P.GI]); }}>{r[P.GI]}</button>
                    </TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-muted-foreground`}>{r[P.BAY]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center text-muted-foreground font-mono`}>{r[P.TGL_R]}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center font-mono ${r[P.TGL_S] ? "text-emerald-400" : "text-muted-foreground/30"}`}>{r[P.TGL_S] || "—"}</TableCell>
                    <TableCell className={`${LAYOUT.tableFontSize} px-2 py-0 text-center`}>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${ANIM.hoverTransition}
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
