"use client";
/**
 * useBBoxLayer — Dynamic coverage area from tower coordinates
 *
 * Data: SSOT via /api/page-data?page=/asset-maps&sheet=MASTER ASSET TOWER
 * Computes area in km², and renders as semi-transparent polygon
 * with dashed border and label showing area.
 */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Tower } from "@/types/asset-maps-types";

const BBOX_SOURCE = "bbox-coverage-source";
const BBOX_FILL = "bbox-fill-layer";
const BBOX_LINE = "bbox-line-layer";
const BBOX_LABEL = "bbox-label-layer";


/* ── Haversine-based area (km²) for a lat/lng bounding box ── */
function bboxAreaKm2(west: number, south: number, east: number, north: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371; // Earth radius km
    const latH = R * toRad(north - south);
    const avgLat = toRad((north + south) / 2);
    const lngW = R * toRad(east - west) * Math.cos(avgLat);
    return Math.round(latH * lngW);
}

function bboxToPolygon(bounds: [number, number, number, number]): number[][] {
    const [west, south, east, north] = bounds;
    return [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
    ];
}

interface UseBBoxLayerProps {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    visible: boolean;
    towers: Tower[];
}

export function useBBoxLayer({ map, mapLoaded, visible, towers }: UseBBoxLayerProps) {
    const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);

    // Compute BBOX from shared tower data
    useEffect(() => {
        if (towers.length === 0) return;

        let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
        for (const t of towers) {
            if (t.lng < west) west = t.lng;
            if (t.lng > east) east = t.lng;
            if (t.lat < south) south = t.lat;
            if (t.lat > north) north = t.lat;
        }

        const pad = 0.05;
        setBounds([west - pad, south - pad, east + pad, north + pad]);
        console.log(`[BBox] ✅ Calculated from ${towers.length} towers (shared data)`);
    }, [towers]);

    // Create / destroy coverage layers
    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded || !visible || !bounds) return;

        const areaKm2 = bboxAreaKm2(bounds[0], bounds[1], bounds[2], bounds[3]);
        const label = `UPT Bogor Coverage Area : ${areaKm2.toLocaleString("id-ID")} km²`;

        // Build GeoJSON — polygon + label point at top-center
        const topCenterLng = (bounds[0] + bounds[2]) / 2;
        const topLat = bounds[3]; // north edge

        const features: GeoJSON.Feature[] = [
            {
                type: "Feature",
                properties: { name: label, color: "#22d3ee" },
                geometry: {
                    type: "Polygon",
                    coordinates: [bboxToPolygon(bounds)],
                },
            },
            {
                type: "Feature",
                properties: { name: label, color: "#22d3ee", isLabel: true },
                geometry: {
                    type: "Point",
                    coordinates: [topCenterLng, topLat],
                },
            },
        ];

        // Add source
        if (!m.getSource(BBOX_SOURCE)) {
            m.addSource(BBOX_SOURCE, {
                type: "geojson",
                data: { type: "FeatureCollection", features },
            });
        }

        // Fill layer (semi-transparent)
        if (!m.getLayer(BBOX_FILL)) {
            m.addLayer({
                id: BBOX_FILL,
                type: "fill",
                source: BBOX_SOURCE,
                paint: {
                    "fill-color": ["get", "color"],
                    "fill-opacity": 0.08,
                },
            });
        }

        // Line layer (dashed border)
        if (!m.getLayer(BBOX_LINE)) {
            m.addLayer({
                id: BBOX_LINE,
                type: "line",
                source: BBOX_SOURCE,
                paint: {
                    "line-color": ["get", "color"],
                    "line-width": 2,
                    "line-opacity": 0.6,
                    "line-dasharray": [4, 2],
                },
            });
        }

        // Label
        if (!m.getLayer(BBOX_LABEL)) {
            m.addLayer({
                id: BBOX_LABEL,
                type: "symbol",
                source: BBOX_SOURCE,
                filter: ["==", ["get", "isLabel"], true],
                layout: {
                    "text-field": ["get", "name"],
                    "text-size": 13,
                    "text-font": ["Noto Sans Bold"],
                    "text-anchor": "bottom",
                    "text-offset": [0, -0.3],
                },
                paint: {
                    "text-color": ["get", "color"],
                    "text-opacity": 0.9,
                    "text-halo-color": "rgba(0, 0, 0, 0.85)",
                    "text-halo-width": 1.5,
                },
            });
        }

        console.log(`[BBox] ✅ Coverage: ${label}`);

        return () => {
            [BBOX_LABEL, BBOX_LINE, BBOX_FILL].forEach(id => {
                try { if (m.getLayer(id)) m.removeLayer(id); } catch { /* */ }
            });
            try { if (m.getSource(BBOX_SOURCE)) m.removeSource(BBOX_SOURCE); } catch { /* */ }
        };
    }, [map, mapLoaded, visible, bounds]);

    return null;
}
