"use client";
/**
 * useTHICorrosionLayer — THI Corrosion markers on MapLibre
 *
 * Pattern: EXACT COPY of useStrikeMarkers lifecycle.
 * - existingSource check before add
 * - layout visibility toggle (not remove/add)
 * - try-catch per addLayer
 * - cleanup via ref
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
  CRITICAL: "#e5484d",
  POOR: "#f08a3e",
  FAIR: "#f3c14b",
  GOOD: "#8dd884",
  VERY_GOOD: "#3ecf8e",
};

function statusFromScore(s: number): string {
  if (s <= 15) return 'VERY_GOOD';
  if (s <= 30) return 'GOOD';
  if (s <= 50) return 'FAIR';
  if (s <= 70) return 'POOR';
  return 'CRITICAL';
}

type THIMode = "final" | "manual";

interface UseTHICorrosionOptions {
  map: React.RefObject<maplibregl.Map | null>;
  mapLoaded: boolean;
  mapInstanceId: number;
  visible: boolean;
  towers: THITower[];
  mode?: THIMode;
}

export function useTHICorrosionLayer({ map, mapLoaded, mapInstanceId, visible, towers, mode = "final" }: UseTHICorrosionOptions) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const toGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: towers.map((t) => {
      const activeStatus = mode === "manual" ? statusFromScore(t.hiManual) : t.status;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
        properties: {
          name: t.name, penghantar: t.penghantar, ultg: t.ultg, usia: t.usia,
          hiManual: t.hiManual, hiManualStatus: statusFromScore(t.hiManual).replace('_', ' '),
          hiEngine: t.hiEngine, hiFinal: t.hiFinal,
          status: t.status, statusLabel: t.status.replace('_', ' '),
          activeStatus, iso: t.iso, coating: t.coating, rCorr: t.rCorr,
          confidence: t.confidence, elevation: t.elevation,
          color: STATUS_COLORS[activeStatus] || "#a3a3a3",
        },
      };
    }),
  }), [towers, mode]);

  // Main effect — EXACT pattern from useStrikeMarkers
  useEffect(() => {
    if (!map.current || !mapLoaded || towers.length === 0) return;
    const m = map.current;
    const geojson = toGeoJSON();

    const addLayersAndHandlers = () => {
      try {
        m.addLayer({
          id: LAYER_GLOW, type: "circle", source: SOURCE_ID,
          layout: { visibility: visible ? "visible" : "none" },
          paint: { "circle-radius": 10, "circle-color": ["get", "color"], "circle-opacity": 0.25, "circle-blur": 1 },
        });
      } catch (err) { console.error("[THI] glow layer:", err); }

      try {
        m.addLayer({
          id: LAYER_CIRCLE, type: "circle", source: SOURCE_ID,
          layout: { visibility: visible ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 10, 5, 14, 8],
            "circle-color": ["get", "color"], "circle-opacity": 0.9,
            "circle-stroke-width": 1, "circle-stroke-color": "#ffffff", "circle-stroke-opacity": 0.6,
          },
        });
      } catch (err) { console.error("[THI] circle layer:", err); }

      const onMouseEnter = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (!e.features?.[0]) return;
        m.getCanvas().style.cursor = "pointer";
        const p = e.features[0].properties!;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        const sc = STATUS_COLORS[p.status] || "#888";
        const mc = STATUS_COLORS[statusFromScore(p.hiManual)] || "#8dd884";
        const cw = Math.max(0, Math.min(100, p.coating));
        const cc = cw > 60 ? "#3ecf8e" : cw > 30 ? "#f3c14b" : "#e5484d";
        const d = p.hiFinal - p.hiManual;
        const dc = d > 0 ? '#e5484d' : '#3ecf8e';

        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, maxWidth: "300px", offset: 12, className: "thi-popup" })
          .setLngLat(coords)
          .setHTML(`<div style="font-family:Inter,system-ui;font-size:12px;min-width:260px;line-height:1.4;background:#151515;color:#e0e0e0;padding:14px 16px;border-radius:10px;border:1px solid #262c35;box-shadow:0 8px 24px rgba(0,0,0,0.35)">
<div style="font-weight:700;font-size:13px;color:#f5f5f5">${p.name}</div>
<div style="color:#737373;font-size:11px;margin-bottom:10px">${p.penghantar} · ${p.ultg}</div>
<div style="display:flex;gap:8px;margin-bottom:10px">
<div style="flex:1;background:#1a1a1a;border-radius:8px;padding:8px 10px;text-align:center;border:1px solid #262c35">
<div style="font-size:9px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">HI Manual</div>
<div style="font-size:13px;font-weight:700;color:${mc}">${p.hiManualStatus}</div>
<div style="font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${mc};margin-top:1px">${p.hiManual}</div>
</div>
<div style="flex:1;background:#1a1a1a;border-radius:8px;padding:8px 10px;text-align:center;border:1.5px solid ${sc}">
<div style="font-size:9px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">HI Final</div>
<div style="font-size:13px;font-weight:700;color:${sc}">${p.statusLabel}</div>
<div style="font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${sc};margin-top:1px">${p.hiFinal}</div>
</div>
</div>
<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
<span style="background:${sc};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">${p.statusLabel}</span>
<span style="background:#1a1a1a;color:#a0a0a0;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;border:1px solid #262c35">ISO ${p.iso}</span>
<span style="color:${dc};font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace;margin-left:auto">Δ ${d >= 0 ? '+' : ''}${d.toFixed(1)}</span>
</div>
<div style="background:#1a1a1a;border-radius:8px;padding:8px 10px;border:1px solid #262c35">
<div style="display:flex;justify-content:space-between;margin-bottom:4px">
<span style="color:#737373;font-size:10px">Coating</span>
<div style="display:flex;align-items:center;gap:4px">
<div style="background:#262c35;border-radius:3px;width:48px;height:5px"><div style="background:${cc};width:${cw}%;height:100%;border-radius:3px"></div></div>
<span style="font-weight:700;font-family:'JetBrains Mono',monospace;font-size:10px">${p.coating}%</span>
</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10px">
<div style="display:flex;justify-content:space-between"><span style="color:#737373">r_corr</span><span style="font-family:'JetBrains Mono',monospace">${p.rCorr} µm/th</span></div>
<div style="display:flex;justify-content:space-between"><span style="color:#737373">Usia</span><span style="font-family:'JetBrains Mono',monospace">${p.usia || '?'} th</span></div>
<div style="display:flex;justify-content:space-between"><span style="color:#737373">Elevasi</span><span style="font-family:'JetBrains Mono',monospace">${p.elevation} m</span></div>
<div style="display:flex;justify-content:space-between"><span style="color:#737373">Confidence</span><span style="font-family:'JetBrains Mono',monospace">${p.confidence}%</span></div>
</div>
</div>
</div>`)
          .addTo(m);
      };

      const onMouseLeave = () => {
        m.getCanvas().style.cursor = "";
        popupRef.current?.remove();
        popupRef.current = null;
      };

      cleanupRef.current?.();
      m.on("mouseenter", LAYER_CIRCLE, onMouseEnter);
      m.on("mouseleave", LAYER_CIRCLE, onMouseLeave);
      cleanupRef.current = () => {
        m.off("mouseenter", LAYER_CIRCLE, onMouseEnter);
        m.off("mouseleave", LAYER_CIRCLE, onMouseLeave);
      };
    };

    // EXACT useStrikeMarkers pattern: check existing source
    const existingSource = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
      // Layers might be gone after style change — check and re-add
      if (!m.getLayer(LAYER_CIRCLE)) {
        // Clean remnants
        try { if (m.getLayer(LAYER_GLOW)) m.removeLayer(LAYER_GLOW); } catch { /* */ }
        try { if (m.getLayer(LAYER_CIRCLE)) m.removeLayer(LAYER_CIRCLE); } catch { /* */ }
        addLayersAndHandlers();
      } else {
        // Layers exist — just ensure visibility
        const viz = visible ? "visible" : "none";
        try { if (m.getLayer(LAYER_CIRCLE)) m.setLayoutProperty(LAYER_CIRCLE, "visibility", viz); } catch { /* */ }
        try { if (m.getLayer(LAYER_GLOW)) m.setLayoutProperty(LAYER_GLOW, "visibility", viz); } catch { /* */ }
      }
    } else {
      // Fresh map — add everything
      try {
        m.addSource(SOURCE_ID, { type: "geojson", data: geojson });
        addLayersAndHandlers();
      } catch (err) {
        console.error("[THI] addSource error:", err);
      }
    }
  }, [map, mapLoaded, mapInstanceId, towers, visible, toGeoJSON]);

  // Visibility toggle — also hide/show default tower layers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;
    const viz = visible ? "visible" : "none";
    const towerViz = visible ? "none" : "visible";
    try {
      if (m.getLayer(LAYER_CIRCLE)) m.setLayoutProperty(LAYER_CIRCLE, "visibility", viz);
      if (m.getLayer(LAYER_GLOW)) m.setLayoutProperty(LAYER_GLOW, "visibility", viz);
      // Hide/show default tower + conductor layers
      if (m.getLayer("tower-circles")) m.setLayoutProperty("tower-circles", "visibility", towerViz);
      if (m.getLayer("tower-glow")) m.setLayoutProperty("tower-glow", "visibility", towerViz);
      if (m.getLayer("conductor-lines")) m.setLayoutProperty("conductor-lines", "visibility", towerViz);
    } catch { /* layers might not exist yet */ }
  }, [map, mapLoaded, visible, mapInstanceId]);

  // Cleanup on unmount
  useEffect(() => () => {
    cleanupRef.current?.();
    popupRef.current?.remove();
  }, []);
}

export type { THITower };
