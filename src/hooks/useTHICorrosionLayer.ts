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
  CRITICAL: "#e5484d",
  POOR: "#f08a3e",
  FAIR: "#f3c14b",
  GOOD: "#8dd884",
  VERY_GOOD: "#3ecf8e",
};

type THIMode = "final" | "manual";

function statusFromScore(s: number): string {
  if (s <= 15) return 'VERY_GOOD';
  if (s <= 30) return 'GOOD';
  if (s <= 50) return 'FAIR';
  if (s <= 70) return 'POOR';
  return 'CRITICAL';
}

interface UseTHICorrosionOptions {
  map: React.RefObject<maplibregl.Map | null>;
  mapLoaded: boolean;
  mapInstanceId: number;
  visible: boolean;
  towers: THITower[];
  mode?: THIMode;
}

export function useTHICorrosionLayer({ map, mapLoaded, mapInstanceId, visible, towers, mode = "final" }: UseTHICorrosionOptions) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const toGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: towers.map((t) => {
      const activeStatus = mode === "manual" ? statusFromScore(t.hiManual) : t.status;
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
        properties: {
          name: t.name,
          penghantar: t.penghantar,
          ultg: t.ultg,
          usia: t.usia,
          hiManual: t.hiManual,
          hiManualStatus: statusFromScore(t.hiManual).replace('_', ' '),
          hiEngine: t.hiEngine,
          hiEngineStatus: statusFromScore(t.hiEngine).replace('_', ' '),
          hiFinal: t.hiFinal,
          status: t.status,
          statusLabel: t.status.replace('_', ' '),
          statusManual: t.statusManual,
          activeStatus,
          iso: t.iso,
          coating: t.coating,
          rCorr: t.rCorr,
          confidence: t.confidence,
          elevation: t.elevation,
          color: STATUS_COLORS[activeStatus] || "#a3a3a3",
          mode,
        },
      };
    }),
  }), [towers, mode]);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    if (!visible || towers.length === 0) {
      // Hidden — remove layers if exist
      if (m.getLayer(LAYER_CIRCLE)) m.removeLayer(LAYER_CIRCLE);
      if (m.getLayer(LAYER_GLOW)) m.removeLayer(LAYER_GLOW);
      if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      cleanupRef.current?.();
      return;
    }

    const geojson = toGeoJSON();

    const addLayersAndHandlers = () => {
      m.addLayer({
        id: LAYER_GLOW, type: "circle", source: SOURCE_ID,
        paint: { "circle-radius": 10, "circle-color": ["get", "color"], "circle-opacity": 0.25, "circle-blur": 1 },
      });

      m.addLayer({
        id: LAYER_CIRCLE, type: "circle", source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 10, 5, 14, 8],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.6,
        },
      });

      const onMouseEnter = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (!e.features?.[0]) return;
        m.getCanvas().style.cursor = "pointer";
        const p = e.features[0].properties!;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

        const statusColor = STATUS_COLORS[p.status] || "#888";
        const coatingWidth = Math.max(0, Math.min(100, p.coating));
        const coatingColor = coatingWidth > 60 ? "#3ecf8e" : coatingWidth > 30 ? "#f3c14b" : "#e5484d";
        const delta = p.hiFinal - p.hiManual;
        const deltaColor = delta > 0 ? '#e5484d' : '#3ecf8e';
        const manualColor = STATUS_COLORS[statusFromScore(p.hiManual)] || '#8dd884';

        const html = `
          <div style="font-family:Inter,system-ui,sans-serif;font-size:12px;min-width:260px;line-height:1.4;background:#151515;color:#e0e0e0;padding:14px 16px;border-radius:10px;border:1px solid #262c35;box-shadow:0 8px 24px rgba(0,0,0,0.35)">
            <div style="font-weight:700;font-size:13px;color:#f5f5f5;letter-spacing:-0.01em">${p.name}</div>
            <div style="color:#737373;font-size:11px;margin-bottom:10px">${p.penghantar} · ${p.ultg}</div>
            <div style="display:flex;gap:8px;margin-bottom:10px">
              <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:8px 10px;text-align:center;border:1px solid #262c35">
                <div style="font-size:9px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">HI Manual</div>
                <div style="font-size:13px;font-weight:700;color:${manualColor}">${p.hiManualStatus}</div>
                <div style="font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${manualColor};margin-top:1px">${p.hiManual}</div>
              </div>
              <div style="flex:1;background:#1a1a1a;border-radius:8px;padding:8px 10px;text-align:center;border:1.5px solid ${statusColor}">
                <div style="font-size:9px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px">HI Final</div>
                <div style="font-size:13px;font-weight:700;color:${statusColor}">${p.statusLabel}</div>
                <div style="font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${statusColor};margin-top:1px">${p.hiFinal}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
              <span style="background:${statusColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">${p.status.replace('_',' ')}</span>
              <span style="background:#1a1a1a;color:#a0a0a0;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;border:1px solid #262c35">ISO ${p.iso}</span>
              <span style="color:${deltaColor};font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace;margin-left:auto">Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}</span>
            </div>
            <div style="background:#1a1a1a;border-radius:8px;padding:8px 10px;border:1px solid #262c35">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="color:#737373;font-size:10px">Coating</span>
                <div style="display:flex;align-items:center;gap:4px">
                  <div style="background:#262c35;border-radius:3px;width:48px;height:5px"><div style="background:${coatingColor};width:${coatingWidth}%;height:100%;border-radius:3px"></div></div>
                  <span style="font-weight:700;font-family:'JetBrains Mono',monospace;font-size:10px;color:#e0e0e0">${p.coating}%</span>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10px">
                <div style="display:flex;justify-content:space-between"><span style="color:#737373">r_corr</span><span style="font-family:'JetBrains Mono',monospace;color:#e0e0e0">${p.rCorr} µm/th</span></div>
                <div style="display:flex;justify-content:space-between"><span style="color:#737373">Usia</span><span style="font-family:'JetBrains Mono',monospace;color:#e0e0e0">${p.usia || '?'} th</span></div>
                <div style="display:flex;justify-content:space-between"><span style="color:#737373">Elevasi</span><span style="font-family:'JetBrains Mono',monospace;color:#e0e0e0">${p.elevation} m</span></div>
                <div style="display:flex;justify-content:space-between"><span style="color:#737373">Confidence</span><span style="font-family:'JetBrains Mono',monospace;color:#e0e0e0">${p.confidence}%</span></div>
              </div>
            </div>
          </div>
        `;

        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, maxWidth: "300px", offset: 12, className: "thi-popup" })
          .setLngLat(coords).setHTML(html).addTo(m);
      };

      const onMouseLeave = () => {
        m.getCanvas().style.cursor = "";
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      };

      cleanupRef.current?.();
      m.on("mouseenter", LAYER_CIRCLE, onMouseEnter);
      m.on("mouseleave", LAYER_CIRCLE, onMouseLeave);
      cleanupRef.current = () => {
        m.off("mouseenter", LAYER_CIRCLE, onMouseEnter);
        m.off("mouseleave", LAYER_CIRCLE, onMouseLeave);
      };
    };

    // Pattern from useTowerMarkers: check existing source, conditionally rebuild
    const existingSource = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
      if (!m.getLayer(LAYER_CIRCLE)) {
        addLayersAndHandlers();
      }
    } else {
      m.addSource(SOURCE_ID, { type: "geojson", data: geojson });
      addLayersAndHandlers();
    }
  }, [map, mapLoaded, mapInstanceId, visible, towers, toGeoJSON]);
}

export type { THITower };
