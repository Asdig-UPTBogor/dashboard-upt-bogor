"use client";
/**
 * useHeatmapLayer — MapLibre native heatmap for lightning strikes
 *
 * Lazy-loads 90 days of strike data ONLY when toggled ON.
 * Returns date range info for display in UI.
 * Warm glow color ramp (orange → yellow → white core).
 */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FlashEvent } from "@/types/asset-maps-types";

const HEATMAP_SOURCE = "lightning-heatmap-source";
const HEATMAP_LAYER = "lightning-heatmap-layer";

const HEATMAP_DAYS = 30;

interface UseHeatmapLayerProps {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    visible: boolean;
    allStrikes: FlashEvent[];
}

interface HeatmapInfo {
    loading: boolean;
    eventCount: number;
    dateFrom: string | null;
    dateTo: string | null;
}

export function useHeatmapLayer({ map, mapLoaded, visible, allStrikes }: UseHeatmapLayerProps): HeatmapInfo {
    const [events, setEvents] = useState<FlashEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState<string | null>(null);
    const [dateTo, setDateTo] = useState<string | null>(null);

    // Filter strikes by HEATMAP_DAYS when toggled visible
    useEffect(() => {
        if (!visible || allStrikes.length === 0) return;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - HEATMAP_DAYS);
        const cutoffStr = cutoff.toISOString().slice(0, 19).replace("T", " ");
        const filtered = allStrikes.filter(e => e.eventTime >= cutoffStr);

        setEvents(filtered);

        if (filtered.length > 0) {
            const times = filtered.map(e => e.eventTime).filter(Boolean).sort();
            setDateFrom(times[0] || null);
            setDateTo(times[times.length - 1] || null);
        }

        console.log(`[Heatmap] ✅ ${filtered.length} events (${HEATMAP_DAYS}d) from shared data`);
    }, [visible, allStrikes]);

    // Create / destroy heatmap layer
    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded || !visible || events.length === 0) return;

        // Build GeoJSON from strike events
        const features: GeoJSON.Feature[] = events
            .filter(e => e.strikeLat && e.strikeLng)
            .map(e => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: [e.strikeLng, e.strikeLat] },
                properties: {
                    current_ka: Math.abs(e.currentKa || 0),
                    stroke_count: e.strokeCount || 1,
                },
            }));

        const geojson: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };

        // Add source if not exists
        if (!m.getSource(HEATMAP_SOURCE)) {
            m.addSource(HEATMAP_SOURCE, { type: "geojson", data: geojson });
        } else {
            (m.getSource(HEATMAP_SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
        }

        // Add heatmap layer if not exists
        if (!m.getLayer(HEATMAP_LAYER)) {
            m.addLayer({
                id: HEATMAP_LAYER,
                type: "heatmap",
                source: HEATMAP_SOURCE,
                paint: {
                    // Weight by kA
                    "heatmap-weight": [
                        "interpolate", ["linear"],
                        ["coalesce", ["get", "current_ka"], 0],
                        0, 0.1,
                        50, 0.5,
                        200, 1,
                    ],
                    // Intensity — vivid glow
                    "heatmap-intensity": [
                        "interpolate", ["linear"], ["zoom"],
                        0, 1,
                        9, 2.5,
                        15, 4,
                    ],
                    // INFERNO color ramp — purple → red → orange → yellow → white
                    "heatmap-color": [
                        "interpolate", ["linear"], ["heatmap-density"],
                        0.0, "rgba(0, 0, 0, 0)",
                        0.05, "rgba(20, 11, 53, 0.4)",       // Deep dark purple
                        0.15, "rgba(85, 15, 109, 0.55)",     // Purple
                        0.25, "rgba(136, 34, 106, 0.65)",    // Magenta-purple
                        0.35, "rgba(186, 54, 85, 0.7)",      // Red-magenta
                        0.45, "rgba(227, 89, 51, 0.75)",     // Red-orange
                        0.55, "rgba(249, 140, 10, 0.8)",     // Orange
                        0.65, "rgba(252, 185, 12, 0.82)",    // Gold
                        0.75, "rgba(244, 228, 65, 0.85)",    // Yellow
                        0.85, "rgba(252, 253, 166, 0.9)",    // Light yellow
                        1.0, "rgba(252, 255, 230, 0.95)",   // Near-white hot core
                    ],
                    // Radius — soft glow spread
                    "heatmap-radius": [
                        "interpolate", ["linear"], ["zoom"],
                        0, 5,
                        6, 20,
                        9, 35,
                        12, 50,
                    ],
                    "heatmap-opacity": 0.7,
                },
            });
        }

        console.log(`[Heatmap] ✅ Layer with ${features.length} points`);

        return () => {
            try { if (m.getLayer(HEATMAP_LAYER)) m.removeLayer(HEATMAP_LAYER); } catch { /* */ }
            try { if (m.getSource(HEATMAP_SOURCE)) m.removeSource(HEATMAP_SOURCE); } catch { /* */ }
        };
    }, [map, mapLoaded, visible, events]);

    return { loading, eventCount: events.length, dateFrom, dateTo };
}
