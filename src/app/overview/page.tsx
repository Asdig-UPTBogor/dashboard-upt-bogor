"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useMapGL } from "@/hooks/useMapGL";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Activity, CalendarDays, ChevronLeft, ChevronRight,
  Clock, MapPin, Search,
} from "lucide-react";
import { DataFreshness } from "@/components/DataFreshness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageData } from "@/hooks/usePageData";

/* ── Extracted modules ── */
import { C, norm, parseDate, inRange, daysBetween } from "./_lib/types";
import type { GIPoint, JadwalEvent } from "./_lib/types";
import { KpiCards } from "./_components/kpi-cards";
import { EventList } from "./_components/event-list";

/* ── Map constants ── */
const SRC_NORMAL = "overview-gi-normal";
const SRC_ACTIVE = "overview-gi-active";
const LYR_NORMAL = "overview-gi-normal-circle";
const LYR_ACTIVE_GLOW = "overview-gi-active-glow";
const LYR_ACTIVE_DOT = "overview-gi-active-dot";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/* ━━━━━━━━━━━━━━━━━━ PAGE COMPONENT ━━━━━━━━━━━━━━━━━━ */

export default function OverviewPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const layersAdded = useRef(false);

  /* ── Map ── */
  const { map, mapLoaded } = useMapGL({ containerRef, mapStyle: "dark" });

  // Data — index matches dataSources[] order: [0] Asset GI, [1] Asset Bay, [2] Jadwal Padam
  const { sheets, loading, fetchedAt, refetch } = usePageData("/overview");
  const giData = useMemo(() => sheets[0]?.rows || [], [sheets]);
  const jadwalData = useMemo(() => sheets[2]?.rows || [], [sheets]);

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
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <DataFreshness />
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

      {/* ── KPI Cards (extracted component) ── */}
      <KpiCards loading={loading} {...kpis} />

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

          {/* Event Cards (extracted component) */}
          <EventList
            loading={loading}
            events={filteredEvents}
            searchTerm={searchTerm}
            onFly={handleFly}
          />
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
