"use client";
/**
 * useConductorLines — Renders transmission line paths between towers
 *
 * Groups towers by PENGHANTAR, sorts by tower name, and draws LineString
 * geometries connecting sequential towers on the same line.
 * Color-coded by voltage (Thor FE standard: 500kV=Blue, 150kV=Red, 70kV=Yellow).
 */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Tower as FullTower } from "@/types/asset-maps-types";

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

interface Tower {
    name: string;
    penghantar: string;
    lat: number;
    lng: number;
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

    // Build lines from shared tower data
    useEffect(() => {
        if (allTowers.length === 0) return;

        const towers: Tower[] = allTowers
            .filter(t => t.penghantar)
            .map(t => ({ name: t.name, penghantar: t.penghantar, lat: t.lat, lng: t.lng }));

        // Helper: extract trailing #NNN sequence number from tower name
        const getSeq = (name: string): number => {
            const m = name.match(/#(\d+)[A-Za-z]*\s*$/);
            return m ? parseInt(m[1]) : 0;
        };

        // Step 1: Group towers by name prefix (strip trailing #NNN)
        const rawGroups: Record<string, Tower[]> = {};
        for (const t of towers) {
            const prefix = t.name.replace(/\s*#[\dA-Za-z]+\s*$/, "").trim();
            if (!prefix) continue;
            if (!rawGroups[prefix]) rawGroups[prefix] = [];
            rawGroups[prefix].push(t);
        }

        // Step 2: Build GeoJSON features with topology awareness
        // Multi-circuit groups (e.g. "SGLNG-CIBN7#1,2") are split+merged into each circuit
        const features: GeoJSON.Feature[] = [];
        const renderedPrefixes = new Set<string>();

        for (const [sharedPrefix, sharedTowers] of Object.entries(rawGroups)) {
            // Match multi-circuit prefix: ends with #N,M pattern
            const mcMatch = sharedPrefix.match(/^(.+)#(\d+(?:,\d+)+)$/);
            if (!mcMatch) continue;

            const basePrefix = mcMatch[1];
            const circuits = mcMatch[2].split(",").map(s => s.trim());

            // Sort shared towers by seq number
            const sortedShared = [...sharedTowers].sort((a, b) => getSeq(a.name) - getSeq(b.name));

            // Find the largest sequential gap → split start-shared vs end-shared
            let maxGap = 0, splitIdx = sortedShared.length - 1;
            for (let i = 0; i < sortedShared.length - 1; i++) {
                const gap = getSeq(sortedShared[i + 1].name) - getSeq(sortedShared[i].name);
                if (gap > maxGap) { maxGap = gap; splitIdx = i; }
            }
            const startShared = sortedShared.slice(0, splitIdx + 1);
            const endShared = maxGap > 1 ? sortedShared.slice(splitIdx + 1) : [];

            // Build one complete line per circuit
            for (const c of circuits) {
                const circuitPrefix = `${basePrefix}#${c}`;
                const circuitTowers = rawGroups[circuitPrefix] || [];
                const sortedCircuit = [...circuitTowers].sort((a, b) => getSeq(a.name) - getSeq(b.name));

                const fullPath = [...startShared, ...sortedCircuit, ...endShared];
                if (fullPath.length < 2) continue;

                const penghantar = fullPath[0].penghantar;
                features.push({
                    type: "Feature",
                    geometry: { type: "LineString", coordinates: fullPath.map(t => [t.lng, t.lat]) },
                    properties: { penghantar, color: voltageColor(penghantar), towerCount: fullPath.length },
                });
                renderedPrefixes.add(circuitPrefix);
            }
            renderedPrefixes.add(sharedPrefix);
        }

        // Step 3: Render remaining groups (not part of any multi-circuit)
        for (const [prefix, towerList] of Object.entries(rawGroups)) {
            if (renderedPrefixes.has(prefix)) continue;
            if (towerList.length < 2) continue;

            const sorted = [...towerList].sort((a, b) => getSeq(a.name) - getSeq(b.name));
            const penghantar = sorted[0].penghantar;
            features.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: sorted.map(t => [t.lng, t.lat]) },
                properties: { penghantar, color: voltageColor(penghantar), towerCount: sorted.length },
            });
        }

        const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features,
        };

        setLines(geojson);
    }, [allTowers]);

    useEffect(() => {
        if (!map.current || !mapLoaded || !lines) return;

        const m = map.current;
        const viz = visible ? "visible" : "none";
        const existingSource = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

        if (existingSource) {
            existingSource.setData(lines);
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
