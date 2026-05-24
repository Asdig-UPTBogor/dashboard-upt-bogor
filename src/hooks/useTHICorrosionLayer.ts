"use client";
/**
 * useTHICorrosionLayer — THI Corrosion Engine layer on MapLibre
 *
 * Renders 949 SUTT 150kV towers colored by HI Final status.
 * Data: static JSON from engine v1.4.1 (270d run).
 *
 * Colors:
 *   CRITICAL (>70)  = #dc2626 (red)
 *   POOR (50-70)    = #f97316 (orange)
 *   FAIR (30-50)    = #eab308 (yellow)
 *   GOOD (15-30)    = #22c55e (green)
 *   VERY_GOOD (0-15)= #15803d (dark green)
 */

import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";

const SOURCE_ID = "thi-corrosion-source";
const LAYER_CIRCLE = "thi-corrosion-circles";
const LAYER_GLOW = "thi-corrosion-glow";

interface THITower {
  name: string;
  penghantar: string;
  ultg: string;
  lat: number;
  lng: number;
  usia: number | null;
  hiManual: number;
  hiEngine: number;
  hiFinal: number;
  status: string;
  statusManual: string;
  iso: string;
  coating: number;
  rCorr: number;
  confidence: number;
  elevation: number;
}

const STATUS_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  POOR: "#f97316",
  FAIR: "#eab308",
  GOOD: "#22c55e",
  VERY_GOOD: "#15803d",
};

interface UseTHICorrosionOptions {
  map: React.RefObject<maplibregl.Map | null>;
  mapLoaded: boolean;
  mapInstanceId: number;
  visible: boolean;
  towers: THITower[];
}

export function useTHICorrosionLayer({ map, mapLoaded, mapInstanceId, visible, towers }: UseTHICorrosionOptions) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const toGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: towers.map((t) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
      properties: {
        name: t.name,
        penghantar: t.penghantar,
        ultg: t.ultg,
        usia: t.usia,
        hiManual: t.hiManual,
        hiEngine: t.hiEngine,
        hiFinal: t.hiFinal,
        status: t.status,
        statusManual: t.statusManual,
        iso: t.iso,
        coating: t.coating,
        rCorr: t.rCorr,
        confidence: t.confidence,
        elevation: t.elevation,
        color: STATUS_COLORS[t.status] || "#a3a3a3",
      },
    })),
  }), [towers]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    const cleanup = () => {
      if (m.getLayer(LAYER_CIRCLE)) m.removeLayer(LAYER_CIRCLE);
      if (m.getLayer(LAYER_GLOW)) m.removeLayer(LAYER_GLOW);
      if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    };

    cleanup();

    if (!visible || towers.length === 0) return;

    m.addSource(SOURCE_ID, { type: "geojson", data: toGeoJSON() });

    // Glow layer (larger, transparent)
    m.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 10,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.25,
        "circle-blur": 1,
      },
    });

    // Main circle
    m.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          6, 3,
          10, 5,
          14, 8,
        ],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.9,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.6,
      },
    });

    // Hover popup
    const onMouseEnter = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features?.[0]) return;
      m.getCanvas().style.cursor = "pointer";
      const p = e.features[0].properties!;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

      const statusColor = STATUS_COLORS[p.status] || "#888";
      const coatingWidth = Math.max(0, Math.min(100, p.coating));
      const coatingColor = coatingWidth > 60 ? "#22c55e" : coatingWidth > 30 ? "#f59e0b" : "#ef4444";

      const html = `
        <div style="font-family:system-ui;font-size:12px;min-width:220px;line-height:1.5">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${p.name}</div>
          <div style="color:#64748b;font-size:11px;margin-bottom:6px">${p.penghantar} • ${p.ultg}</div>
          <table style="width:100%;font-size:11px;border-collapse:collapse">
            <tr><td style="color:#64748b">HI Manual</td><td style="text-align:right;font-weight:600">${p.hiManual}</td></tr>
            <tr><td style="color:#64748b">HI Engine (ISO)</td><td style="text-align:right;font-weight:600">${p.hiEngine}</td></tr>
            <tr><td style="color:#64748b">HI Final</td><td style="text-align:right;font-weight:700;color:${statusColor}">${p.hiFinal}</td></tr>
            <tr><td style="color:#64748b">Status</td><td style="text-align:right"><span style="background:${statusColor};color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600">${p.status.replace('_',' ')}</span></td></tr>
            <tr><td style="color:#64748b">ISO 9223</td><td style="text-align:right;font-weight:600">${p.iso}</td></tr>
            <tr><td style="color:#64748b">Coating</td><td style="text-align:right">
              <div style="display:inline-flex;align-items:center;gap:4px">
                <div style="background:#e5e7eb;border-radius:3px;width:40px;height:6px;display:inline-block">
                  <div style="background:${coatingColor};width:${coatingWidth}%;height:100%;border-radius:3px"></div>
                </div>
                <span style="font-weight:600">${p.coating}%</span>
              </div>
            </td></tr>
            <tr><td style="color:#64748b">r_corr</td><td style="text-align:right">${p.rCorr} µm/th</td></tr>
            <tr><td style="color:#64748b">Usia</td><td style="text-align:right">${p.usia || '?'} th</td></tr>
            <tr><td style="color:#64748b">Elevasi</td><td style="text-align:right">${p.elevation} m</td></tr>
            <tr><td style="color:#64748b">Confidence</td><td style="text-align:right">${p.confidence}%</td></tr>
          </table>
        </div>
      `;

      if (popupRef.current) popupRef.current.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, maxWidth: "280px", offset: 12 })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(m);
    };

    const onMouseLeave = () => {
      m.getCanvas().style.cursor = "";
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    };

    m.on("mouseenter", LAYER_CIRCLE, onMouseEnter);
    m.on("mouseleave", LAYER_CIRCLE, onMouseLeave);

    return () => {
      m.off("mouseenter", LAYER_CIRCLE, onMouseEnter);
      m.off("mouseleave", LAYER_CIRCLE, onMouseLeave);
      cleanup();
    };
  }, [map, mapLoaded, mapInstanceId, visible, towers, toGeoJSON]);
}

export type { THITower };
