"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Building2, Zap, Radio, Activity, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

// Dynamic import ECharts (SSR-off for canvas)
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* ── Colors ── */
const C = {
  indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
  purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
  rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee",
};

/* ── KPI Data ── */
const kpis = [
  { label: "Gardu Induk", value: "25", change: "+2", up: true, icon: Building2, color: C.indigo },
  { label: "Trafo", value: "55", change: "+3", up: true, icon: Zap, color: C.amber },
  { label: "Tower", value: "1.637", change: "+12", up: true, icon: Radio, color: C.teal },
  { label: "MVA Total", value: "4.553", change: "+120", up: true, icon: Activity, color: C.emerald },
  { label: "Bay Operasi", value: "312", change: "+5", up: true, icon: TrendingUp, color: C.purple },
  { label: "Gangguan", value: "18", change: "-3", up: false, icon: AlertTriangle, color: C.rose },
];

const sparkData = [
  [{ v: 18 }, { v: 20 }, { v: 19 }, { v: 22 }, { v: 21 }, { v: 23 }, { v: 25 }],
  [{ v: 45 }, { v: 48 }, { v: 47 }, { v: 50 }, { v: 52 }, { v: 53 }, { v: 55 }],
  [{ v: 1580 }, { v: 1590 }, { v: 1600 }, { v: 1610 }, { v: 1620 }, { v: 1630 }, { v: 1637 }],
  [{ v: 4200 }, { v: 4280 }, { v: 4350 }, { v: 4400 }, { v: 4450 }, { v: 4500 }, { v: 4553 }],
  [{ v: 290 }, { v: 295 }, { v: 300 }, { v: 303 }, { v: 307 }, { v: 310 }, { v: 312 }],
  [{ v: 28 }, { v: 25 }, { v: 22 }, { v: 20 }, { v: 19 }, { v: 18 }, { v: 18 }],
];

/* ── Incidents ── */
const incidents = [
  { no: 1, tanggal: "2026-02-20", ultg: "Bogor", lokasi: "TRS 150kV Bogor-Depok", penyebab: "Petir", status: "OPEN" },
  { no: 2, tanggal: "2026-02-18", ultg: "Cianjur", lokasi: "TRS 150kV Cianjur-Skb", penyebab: "Pohon", status: "CLOSED" },
  { no: 3, tanggal: "2026-02-15", ultg: "Sukabumi", lokasi: "TRS 70kV Sukabumi", penyebab: "Galian", status: "OPEN" },
  { no: 4, tanggal: "2026-02-12", ultg: "Depok", lokasi: "TRS 150kV Depok-Jkt", penyebab: "Layang-layang", status: "CLOSED" },
  { no: 5, tanggal: "2026-02-10", ultg: "PLR", lokasi: "TRS 150kV PLR", penyebab: "Petir", status: "CLOSED" },
];

/* ── ECharts: Common theme ── */
const echartBase = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: "Inter, sans-serif", color: "#a1a1aa" },
  grid: { top: 40, right: 16, bottom: 28, left: 48, containLabel: false },
};

export default function OverviewPage() {

  /* ── Bar Chart: Distribusi Aset per ULTG ── */
  const barOption = useMemo(() => ({
    ...echartBase,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,15,30,0.9)",
      borderColor: "rgba(129,140,248,0.3)",
      textStyle: { color: "#e4e4e7", fontSize: 12 },
    },
    legend: {
      data: ["Trafo", "Bay", "Tower"],
      bottom: 0,
      textStyle: { color: "#a1a1aa", fontSize: 10 },
      itemWidth: 10, itemHeight: 10,
    },
    xAxis: {
      type: "category",
      data: ["Bogor", "Depok", "Cianjur", "Sukabumi", "PLR"],
      axisLabel: { fontSize: 10, color: "#71717a" },
      axisLine: { lineStyle: { color: "#27272a" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: "#71717a" },
      splitLine: { lineStyle: { color: "#27272a", type: "dashed" } },
    },
    series: [
      {
        name: "Trafo", type: "bar", stack: "assets",
        data: [14, 12, 10, 11, 8],
        itemStyle: { color: C.amber, borderRadius: [0, 0, 0, 0] },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: C.amber } },
      },
      {
        name: "Bay", type: "bar", stack: "assets",
        data: [78, 65, 52, 60, 57],
        itemStyle: { color: C.indigo },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: C.indigo } },
      },
      {
        name: "Tower", type: "bar", stack: "assets",
        data: [320, 290, 380, 340, 307],
        itemStyle: { color: C.teal, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: C.teal } },
      },
    ],
    animationDuration: 1200,
    animationEasing: "elasticOut",
  }), []);

  /* ── Line Chart: Trend Gangguan ── */
  const lineOption = useMemo(() => ({
    ...echartBase,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,15,30,0.9)",
      borderColor: "rgba(129,140,248,0.3)",
      textStyle: { color: "#e4e4e7", fontSize: 12 },
    },
    legend: {
      data: ["Gangguan", "Penyelesaian"],
      bottom: 0,
      textStyle: { color: "#a1a1aa", fontSize: 10 },
      itemWidth: 10, itemHeight: 10,
    },
    xAxis: {
      type: "category",
      data: ["Sep", "Okt", "Nov", "Des", "Jan", "Feb"],
      axisLabel: { fontSize: 10, color: "#71717a" },
      axisLine: { lineStyle: { color: "#27272a" } },
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: "#71717a" },
      splitLine: { lineStyle: { color: "#27272a", type: "dashed" } },
    },
    series: [
      {
        name: "Gangguan", type: "line", smooth: true,
        data: [8, 5, 7, 4, 6, 3],
        lineStyle: { width: 3, color: C.rose },
        itemStyle: { color: C.rose },
        symbol: "circle", symbolSize: 8,
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(251,113,133,0.25)" },
              { offset: 1, color: "rgba(251,113,133,0)" },
            ],
          },
        },
        emphasis: { scale: true, focus: "series" },
      },
      {
        name: "Penyelesaian", type: "line", smooth: true,
        data: [7, 5, 6, 4, 5, 3],
        lineStyle: { width: 3, color: C.emerald },
        itemStyle: { color: C.emerald },
        symbol: "circle", symbolSize: 8,
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(52,211,153,0.25)" },
              { offset: 1, color: "rgba(52,211,153,0)" },
            ],
          },
        },
        emphasis: { scale: true, focus: "series" },
      },
    ],
    animationDuration: 1500,
  }), []);

  /* ── Pie/Donut Chart: Penyebab Gangguan ── */
  const pieOption = useMemo(() => ({
    ...echartBase,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15,15,30,0.9)",
      borderColor: "rgba(129,140,248,0.3)",
      textStyle: { color: "#e4e4e7", fontSize: 12 },
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "horizontal",
      bottom: 0,
      textStyle: { color: "#a1a1aa", fontSize: 10 },
      itemWidth: 10, itemHeight: 10,
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        padAngle: 3,
        itemStyle: { borderRadius: 6 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: "bold", color: "#fff" },
          itemStyle: { shadowBlur: 20, shadowColor: "rgba(0,0,0,0.5)" },
          scaleSize: 8,
        },
        data: [
          { value: 35, name: "Petir", itemStyle: { color: C.amber } },
          { value: 25, name: "Pohon", itemStyle: { color: C.teal } },
          { value: 18, name: "Layang-layang", itemStyle: { color: C.pink } },
          { value: 12, name: "Galian", itemStyle: { color: C.purple } },
          { value: 10, name: "Lainnya", itemStyle: { color: C.indigo } },
        ],
      },
    ],
    animationType: "scale",
    animationDuration: 1200,
    animationEasing: "elasticOut",
  }), []);

  /* ── Gauge Chart: Availability ── */
  const gaugeOption = useMemo(() => ({
    ...echartBase,
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0, max: 100,
        radius: "90%",
        center: ["50%", "55%"],
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.7, C.rose],
              [0.9, C.amber],
              [1, C.emerald],
            ],
          },
        },
        pointer: {
          icon: "path://M2090.36389,615.30999 L2## M2090.36389,... ",
          length: "60%",
          width: 6,
          itemStyle: { color: "auto" },
        },
        axisTick: { distance: -14, length: 4, lineStyle: { color: "#fff", width: 1 } },
        splitLine: { distance: -14, length: 10, lineStyle: { color: "#fff", width: 1.5 } },
        axisLabel: { color: "#71717a", distance: 22, fontSize: 10 },
        detail: {
          valueAnimation: true,
          formatter: "{value}%",
          color: "#e4e4e7",
          fontSize: 22,
          fontWeight: "bold",
          offsetCenter: [0, "70%"],
        },
        data: [{ value: 97.8, name: "Availability" }],
        title: { fontSize: 10, color: "#71717a", offsetCenter: [0, "90%"] },
      },
    ],
    animationDuration: 2000,
    animationEasing: "bounceOut",
  }), []);

  /* ── Click handler ── */
  const onChartClick = useCallback((params: { name?: string; seriesName?: string; value?: number }) => {
    alert(`Anda klik: ${params.name}\nSeries: ${params.seriesName}\nValue: ${params.value}`);
  }, []);

  const chartEvents = { click: onChartClick };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Overview Aset</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <CalendarDays className="h-3 w-3" /> Februari 2026 — Google Sheets API
          </p>
        </div>
        <div className="flex gap-2">
          <select className="text-xs px-3 py-1.5 rounded-md border bg-background text-foreground outline-none">
            <option>Semua ULTG</option><option>ULTG Bogor</option><option>ULTG Depok</option>
            <option>ULTG Cianjur</option><option>ULTG Sukabumi</option><option>ULTG PLR</option>
          </select>
          <select className="text-xs px-3 py-1.5 rounded-md border bg-background text-foreground outline-none">
            <option>2026</option><option>2025</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
                    <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                  </div>
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold ${kpi.up ? "text-emerald-500" : "text-rose-500"}`}>
                    {kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {kpi.change}
                  </span>
                </div>
                <p className="text-2xl font-extrabold tracking-tight">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{kpi.label}</p>
                <div className="h-6 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData[i]}>
                      <defs>
                        <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={kpi.color} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={kpi.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={kpi.color} strokeWidth={1.5} fill={`url(#spark-${i})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row 1: Bar + Line */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Distribusi Aset per ULTG
              <Badge variant="secondary" className="ml-auto text-[9px]">Klik bar untuk detail</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={barOption} style={{ height: 260 }} onEvents={chartEvents} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Trend Gangguan (6 Bulan)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={lineOption} style={{ height: 260 }} onEvents={chartEvents} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" /> Penyebab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={pieOption} style={{ height: 260 }} onEvents={chartEvents} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Gauge + Extra */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Availability Sistem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={gaugeOption} style={{ height: 200 }} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Gangguan Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>ULTG</TableHead>
                  <TableHead className="hidden md:table-cell">Lokasi</TableHead>
                  <TableHead className="hidden sm:table-cell">Penyebab</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((item) => (
                  <TableRow key={item.no} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <TableCell className="text-muted-foreground">{item.no}</TableCell>
                    <TableCell className="font-mono text-xs">{item.tanggal}</TableCell>
                    <TableCell className="font-medium">{item.ultg}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{item.lokasi}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{item.penyebab}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "OPEN" ? "destructive" : "secondary"} className="text-[10px]">
                        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${item.status === "OPEN" ? "bg-red-400 pulse-dot" : "bg-emerald-400"}`} />
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
