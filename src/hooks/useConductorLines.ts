"use client";
/**
 * useConductorLines — Renders transmission line paths between towers
 *
 * Groups towers by PENGHANTAR, sorts by tower name, and draws LineString
 * geometries connecting sequential towers on the same line.
 * Color-coded by voltage (Thor FE standard: 500kV=Blue, 150kV=Red, 70kV=Yellow).
 */

import { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Tower as FullTower } from "@/types/asset-maps-types";
import { buildConductorLines } from "@/lib/buildConductorLines";

const SOURCE_ID = "conductor-source";
const LAYER_ID = "conductor-lines";
const LAYER_GLOW_ID = "conductor-glow";


/* ── Voltage color mapping (Thor FE standard) ── */
function voltageColor(penghantar: string): string {
    const match = penghantar.match(/(\d+)\s*kV/i);
    const v = match ? parseInt(match[1]) : 0;
    if (v >= 500) return "#3b82f6";   // Blue — SUTET 500kV
    if (v >= 150) return "#ef4444";   // Red — SUTT 150kV
    if (v >= 70) return "#eab308";    // Yellow — 70kV
    return "#a3a3a3";                  // Gray — unknown
}

interface UseConductorLinesOptions {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    mapInstanceId: number;
    visible: boolean;
    towers: FullTower[];
}

export function useConductorLines({ map, mapLoaded, mapInstanceId, visible, towers: allTowers }: UseConductorLinesOptions) {
    const [lines, setLines] = useState<GeoJSON.FeatureCollection | null>(null);

    // Build lines from shared tower data using shared utility
    useEffect(() => {
        if (allTowers.length === 0) return;

        const geojson = buildConductorLines(
            allTowers.filter(t => t.penghantar).map(t => ({
                name: t.name, penghantar: t.penghantar, lat: t.lat, lng: t.lng,
            }))
        );

        // Add voltage color to each feature's properties
        for (const feature of geojson.features) {
            const penghantar = (feature.properties as Record<string, unknown>)?.penghantar as string || "";
            (feature.properties as Record<string, unknown>).color = voltageColor(penghantar);
        }

        setLines(geojson);
    }, [allTowers]);

    useEffect(() => {
        if (!map.current || !mapLoaded || !lines) return;

        const m = map.current;
        const viz = visible ? "visible" : "none";
        const existingSource = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

        if (existingSource) {
            existingSource.setData(lines);
            // FIX: Re-add layers if lost after map style change (matching tower/GI pattern)
            if (!m.getLayer(LAYER_GLOW_ID)) {
                const beforeLayer = m.getLayer("tower-glow") ? "tower-glow" : undefined;
                m.addLayer({
                    id: LAYER_GLOW_ID,
                    type: "line",
                    source: SOURCE_ID,
                    layout: { visibility: viz },
                    paint: {
                        "line-color": ["get", "color"],
                        "line-width": [
                            "interpolate", ["linear"], ["zoom"],
                            5, 3, 10, 5, 15, 8,
                        ],
                        "line-opacity": 0.15,
                        "line-blur": 3,
                    },
                }, beforeLayer);
            }
            if (!m.getLayer(LAYER_ID)) {
                const beforeLayer = m.getLayer("tower-glow") ? "tower-glow" : undefined;
                m.addLayer({
                    id: LAYER_ID,
                    type: "line",
                    source: SOURCE_ID,
                    layout: { visibility: viz },
                    paint: {
                        "line-color": ["get", "color"],
                        "line-width": [
                            "interpolate", ["linear"], ["zoom"],
                            5, 0.5, 10, 1.5, 15, 3,
                        ],
                        "line-opacity": 0.7,
                    },
                }, beforeLayer);
            }
        } else {
            m.addSource(SOURCE_ID, { type: "geojson", data: lines });

            // Place conductor lines below tower/GI layers
            const beforeLayer = m.getLayer("tower-glow") ? "tower-glow" : undefined;

            // Glow underneath
            m.addLayer({
                id: LAYER_GLOW_ID,
                type: "line",
                source: SOURCE_ID,
                layout: { visibility: viz },
                paint: {
                    "line-color": ["get", "color"],
                    "line-width": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 3,
                        10, 5,
                        15, 8,
                    ],
                    "line-opacity": 0.15,
                    "line-blur": 3,
                },
            }, beforeLayer);

            // Main conductor line
            m.addLayer({
                id: LAYER_ID,
                type: "line",
                source: SOURCE_ID,
                layout: { visibility: viz },
                paint: {
                    "line-color": ["get", "color"],
                    "line-width": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 0.5,
                        10, 1.5,
                        15, 3,
                    ],
                    "line-opacity": 0.7,
                },
            }, beforeLayer);
        }
    }, [map, mapLoaded, mapInstanceId, lines, visible]);

    // Toggle visibility
    useEffect(() => {
        if (!map.current || !mapLoaded) return;
        const m = map.current;
        const viz = visible ? "visible" : "none";
        try {
            if (m.getLayer(LAYER_ID)) m.setLayoutProperty(LAYER_ID, "visibility", viz);
            if (m.getLayer(LAYER_GLOW_ID)) m.setLayoutProperty(LAYER_GLOW_ID, "visibility", viz);
        } catch { /* layer may not exist yet */ }
    }, [map, mapLoaded, visible]);

    return { lines, loading: false, error: null, lineCount: lines?.features.length || 0 };
}
