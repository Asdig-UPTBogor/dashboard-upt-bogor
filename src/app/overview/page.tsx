"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useMapGL } from "@/hooks/useMapGL";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Building2, Zap, CalendarDays, ChevronLeft, ChevronRight,
  Clock, Wrench, Activity, AlertCircle, CheckCircle2, Search,
  MapPin, RefreshCw, ArrowRight, Timer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePageData } from "@/hooks/usePageData";

/* ── Colors (consistent with rest of dashboard) ── */
const C = {
  indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
  purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
  rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};

/* ── Map sources / layer IDs ── */
const SRC_NORMAL = "overview-gi-normal";
const SRC_ACTIVE = "overview-gi-active";
const LYR_NORMAL = "overview-gi-normal-circle";
const LYR_ACTIVE_GLOW = "overview-gi-active-glow";
const LYR_ACTIVE_DOT = "overview-gi-active-dot";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/* ── Types ── */
interface GIPoint {
  name: string; lat: number; lng: number;
  ultg: string; voltage: string; giType: string;
}

interface JadwalEvent {
  id: string; ultg: string; garduInduk: string; bay: string;
  jenis: string; deskripsi: string; start: string; end: string;
  status: string; gi: GIPoint | null;
  daysTotal: number; daysCurrent: number; progressPct: number;
}

/* ── Helpers ── */
const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

function parseDate(s: string): Date | null {
  if (!s) return null;
  const p = s.split("/");
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function inRange(target: Date, startS: string, endS: string) {
  const s = parseDate(startS);
  if (!s) return false;
  const e = parseDate(endS) || s;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const s0 = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const e0 = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  return t >= s0 && t <= e0;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function fmtDate(s: string) {
  const d = parseDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/* ━━━━━━━━━━━━━━━━━━ PAGE COMPONENT ━━━━━━━━━━━━━━━━━━ */

export default function OverviewPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const layersAdded = useRef(false);

  /* ── Map ── */
  const { map, mapLoaded } = useMapGL({ containerRef, mapStyle: "dark" });

  /* ── Data ── */
  const { sheets, loading, error, fetchedAt, refetch, getSheet } = usePageData("/overview");
  const giData = useMemo(() => getSheet("Asset GI")?.rows || [], [sheets]);
  const jadwalData = useMemo(() => getSheet("Jadwal Padam")?.rows || [], [sheets]);

  /* ── GI points ── */
  const giPoints = useMemo<GIPoint[]>(() =>
    giData.map((r: Record<string, string>) => {
      const lat = parseFloat(r["Latitude"]);
      const lng = parseFloat(r["Longitude"]);
      if (isNaN(lat) || isNaN(lng)) return null;
      return {
        name: r["Master Gardu Induk"] || "", lat, lng,
        ultg: r["Master ULTG"] || "",
        voltage: r["Voltage (kV)"] || "",
        giType: r["GI Type"] || "",
      };
    }).filter(Boolean) as GIPoint[], [giData]);

  const giLookup = useMemo(() => {
    const m = new Map<string, GIPoint>();
    giPoints.forEach((g) => m.set(norm(g.name), g));
    return m;
  }, [giPoints]);

  /* ── All events with duration calculation ── */
  const allEvents = useMemo<JadwalEvent[]>(() =>
    jadwalData.map((r: Record<string, string>, i: number) => {
      const giName = r["Gardu Induk"] || "";
      const startDate = parseDate(r["Start"] || "");
      const endDate = parseDate(r["End"] || "") || startDate;
      const today = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const daysTotal = startDate && endDate ? daysBetween(startDate, endDate) + 1 : 1;
      const daysCurrent = startDate ? daysBetween(startDate, today) + 1 : 1;
      const progressPct = daysTotal > 0 ? Math.min(100, Math.max(0, (daysCurrent / daysTotal) * 100)) : 100;

      return {
        id: `ev-${i}`, ultg: r["ULTG"] || "", garduInduk: giName,
        bay: r["Bay/Diameter Padam"] || "", jenis: r["Jenis Pekerjaan"] || "",
        deskripsi: r["Deskripsi Pekerjaan"] || "", start: r["Start"] || "",
        end: r["End"] || "", status: r["Status Jalur"] || "",
        gi: giLookup.get(norm(giName)) || null,
        daysTotal, daysCurrent, progressPct,
      };
    }), [jadwalData, giLookup, selectedDate]);

  /* ── Today's events + search ── */
  const todayEvents = useMemo(() => {
    let evts = allEvents.filter((e) => inRange(selectedDate, e.start, e.end));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      evts = evts.filter((e) =>
        e.garduInduk.toLowerCase().includes(s) ||
        e.bay.toLowerCase().includes(s) ||
        e.deskripsi.toLowerCase().includes(s) ||
        e.ultg.toLowerCase().includes(s)
      );
    }
    return evts;
  }, [allEvents, selectedDate, searchTerm]);

  /* ── Per-tab filtered events ── */
  const filteredEvents = useMemo(() =>
    activeTab === "all" ? todayEvents : todayEvents.filter((e) => norm(e.ultg) === norm(activeTab)),
    [todayEvents, activeTab]);

  /* ── Unique ULTGs with counts ── */
  const ultgCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todayEvents.forEach((e) => { counts[e.ultg] = (counts[e.ultg] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [todayEvents]);

  /* ── Active GI keys ── */
  const activeGIKeys = useMemo(() =>
    new Set(todayEvents.filter((e) => e.gi).map((e) => norm(e.gi!.name))),
    [todayEvents]);

  /* ── KPIs ── */
  const kpis = useMemo(() => ({
    giAktif: activeGIKeys.size,
    totalEvents: todayEvents.length,
    statusOk: todayEvents.filter((e) => e.status.toLowerCase().includes("ok")).length,
    statusAbk: todayEvents.filter((e) => !e.status.toLowerCase().includes("ok") && e.status).length,
  }), [activeGIKeys.size, todayEvents]);

  /* ── GeoJSON ── */
  const normalGJ = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: giPoints.filter((g) => !activeGIKeys.has(norm(g.name))).map((g) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [g.lng, g.lat] },
      properties: { name: g.name, ultg: g.ultg, voltage: g.voltage },
    })),
  }), [giPoints, activeGIKeys]);

  const activeGJ = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: giPoints.filter((g) => activeGIKeys.has(norm(g.name))).map((g) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [g.lng, g.lat] },
      properties: { name: g.name, ultg: g.ultg, voltage: g.voltage },
    })),
  }), [giPoints, activeGIKeys]);

  /* ── Date ── */
  const goDate = useCallback((d: number) =>
    setSelectedDate((p) => new Date(p.getFullYear(), p.getMonth(), p.getDate() + d)), []);

  const dateStr = useMemo(() =>
    selectedDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [selectedDate]);

  /* ── Map layers ── */
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded || layersAdded.current) return;
    layersAdded.current = true;

    m.addSource(SRC_NORMAL, { type: "geojson", data: EMPTY_FC });
    m.addLayer({
      id: LYR_NORMAL, type: "circle", source: SRC_NORMAL,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 10, 4, 14, 6],
        "circle-color": C.emerald, "circle-opacity": 0.45,
        "circle-stroke-width": 1, "circle-stroke-color": "#166534", "circle-stroke-opacity": 0.5,
      },
    });

    m.addSource(SRC_ACTIVE, { type: "geojson", data: EMPTY_FC });
    m.addLayer({
      id: LYR_ACTIVE_GLOW, type: "circle", source: SRC_ACTIVE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 8, 10, 14, 14, 20],
        "circle-color": C.amber, "circle-opacity": 0.12, "circle-blur": 0.8,
      },
    });
    m.addLayer({
      id: LYR_ACTIVE_DOT, type: "circle", source: SRC_ACTIVE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 10, 6, 14, 9],
        "circle-color": C.amber, "circle-opacity": 0.9,
        "circle-stroke-width": 2, "circle-stroke-color": "#92400e",
      },
    });

    m.on("click", LYR_ACTIVE_DOT, (e) => {
      const f = e.features?.[0];
      if (!f?.properties || f.geometry.type !== "Point") return;
      const p = f.properties;
      const c = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      new maplibregl.Popup({ offset: 10, maxWidth: "220px" })
        .setLngLat(c).setHTML(`<div style="font:12px system-ui;color:#e4e4e7"><b>${p.name}</b><br/><span style="color:${C.amber}">● Aktif</span> · ULTG ${p.ultg} · ${p.voltage} kV</div>`)
        .addTo(m);
    });
    m.on("mouseenter", LYR_ACTIVE_DOT, () => { m.getCanvas().style.cursor = "pointer"; });
    m.on("mouseleave", LYR_ACTIVE_DOT, () => { m.getCanvas().style.cursor = ""; });
  }, [map, mapLoaded]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded || !layersAdded.current) return;
    (m.getSource(SRC_NORMAL) as maplibregl.GeoJSONSource)?.setData(normalGJ);
    (m.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource)?.setData(activeGJ);
  }, [map, mapLoaded, normalGJ, activeGJ]);

  /* ── Fly to GI ── */
  const handleFly = useCallback((ev: JadwalEvent) => {
    if (ev.gi && map.current) {
      map.current.flyTo({ center: [ev.gi.lng, ev.gi.lat], zoom: 12, duration: 800 });
    }
  }, [map]);

  /* ━━━━━━━━━━ RENDER ━━━━━━━━━━ */
  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6" style={{ color: C.indigo }} />
            Overview Operasi
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Situasi event padam harian UPT Bogor
            <span className="text-emerald-400 ml-2">
              <Clock className="h-3 w-3 inline" />{" "}
              {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("id-ID") : "—"}
            </span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={refetch} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-md border bg-background">
            <button onClick={() => goDate(-1)} className="p-0.5 hover:bg-muted rounded transition-colors">
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <span className="text-xs font-medium px-2 select-none min-w-[170px] text-center flex items-center gap-1.5 justify-center">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {dateStr}
            </span>
            <button onClick={() => goDate(1)} className="p-0.5 hover:bg-muted rounded transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(loading ? [
          { label: "Event Hari Ini", value: "—", icon: Wrench, color: C.amber },
          { label: "GI Terdampak", value: "—", icon: Building2, color: C.indigo },
          { label: "Status OK", value: "—", icon: CheckCircle2, color: C.emerald },
          { label: "Status ABK", value: "—", icon: AlertCircle, color: C.rose },
        ] : [
          { label: "Event Hari Ini", value: kpis.totalEvents, icon: Wrench, color: C.amber },
          { label: "GI Terdampak", value: kpis.giAktif, icon: Building2, color: C.indigo },
          { label: "Status OK", value: kpis.statusOk, icon: CheckCircle2, color: C.emerald },
          { label: "Status ABK", value: kpis.statusAbk, icon: AlertCircle, color: C.rose },
        ]).map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
                    <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Main: Events + Map ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Event Section (lg:8) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Tabs + Search bar */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                  <TabsList>
                    <TabsTrigger value="all">
                      Semua ({todayEvents.length})
                    </TabsTrigger>
                    {ultgCounts.map(([ultg, count]) => (
                      <TabsTrigger key={ultg} value={ultg}>
                        {ultg} ({count})
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari GI, bay, deskripsi..."
                    className="w-full text-xs pl-7 pr-3 py-1.5 rounded-md border bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Cards */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-2/5" />
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-3 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="space-y-3">
              {filteredEvents.map((ev) => {
                const statusOk = ev.status.toLowerCase().includes("ok");
                const statusColor = statusOk ? C.emerald : C.amber;
                const jenisColor = ev.jenis === "External" ? C.purple : ev.jenis === "Internal" ? C.blue : C.orange;
                const progressColor = ev.progressPct > 80 ? C.emerald : ev.progressPct > 40 ? C.amber : C.blue;

                return (
                  <Card
                    key={ev.id}
                    className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                    onClick={() => handleFly(ev)}
                  >
                    <CardContent className="p-5">
                      {/* Row 1: GI Name + Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                            ULTG {ev.ultg}
                          </Badge>
                          <h3 className="text-base font-bold truncate">
                            {ev.garduInduk || "—"}
                          </h3>
                        </div>
                        <Badge
                          className="text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                        >
                          {ev.status || "—"}
                        </Badge>
                      </div>

                      {/* Row 2: Bay / Equipment */}
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: C.amber }} />
                        <span className="text-sm font-medium">{ev.bay || "—"}</span>
                      </div>

                      {/* Row 3: Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        {ev.deskripsi || "Tidak ada deskripsi pekerjaan"}
                      </p>

                      <Separator className="mb-4" />

                      {/* Row 4: Duration Progress */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            Hari ke-{ev.daysCurrent} dari {ev.daysTotal} hari
                          </span>
                          <span className="text-[11px] font-mono font-medium" style={{ color: progressColor }}>
                            {Math.round(ev.progressPct)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${ev.progressPct}%`, backgroundColor: progressColor }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono">{fmtDate(ev.start)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                          <span className="text-[10px] text-muted-foreground font-mono">{fmtDate(ev.end)}</span>
                        </div>
                      </div>

                      {/* Row 5: Metadata tags */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className="text-[10px]"
                          style={{ backgroundColor: `${jenisColor}20`, color: jenisColor }}
                        >
                          {ev.jenis || "—"}
                        </Badge>
                        {ev.gi && (
                          <>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {ev.gi.voltage} kV
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {ev.gi.giType}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5 ml-auto">
                              <MapPin className="h-3 w-3" /> Klik untuk lihat di peta
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {searchTerm ? "Tidak ditemukan" : "Tidak ada event hari ini"}
                </p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  {searchTerm ? "Coba kata kunci lain" : "Semua operasi berjalan normal"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map Card (lg:4) */}
        <div className="lg:col-span-4">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: C.teal }} />
                Peta Gardu Induk
                <Badge variant="secondary" className="ml-auto text-[9px]">
                  {loading ? "..." : `${giPoints.length} GI`}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative h-[340px]">
                <div ref={containerRef} className="absolute inset-0 w-full h-full" />
                {!mapLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] text-muted-foreground">Loading map...</span>
                    </div>
                  </div>
                )}
                {mapLoaded && (
                  <div className="absolute bottom-2 left-2 z-20 backdrop-blur-md bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.amber, boxShadow: `0 0 4px ${C.amber}80` }} />
                      <span className="text-[9px] text-zinc-400">Aktif ({kpis.giAktif})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full ml-[1px]" style={{ backgroundColor: `${C.emerald}80` }} />
                      <span className="text-[9px] text-zinc-400 ml-[1px]">Normal</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
