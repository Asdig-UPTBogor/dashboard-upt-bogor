"use client";
/**
 * useTowerMarkers — Renders transmission tower markers on MapLibre map
 *
 * Uses native GeoJSON source + circle layers for performance (1,700+ markers).
 * Color-coded by voltage: 500kV = red, 150kV = amber, 70kV = cyan.
 * Includes hover popup with tower details.
 *
 * Cloud Run compatible — uses relative API path `/api/towers`.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";

const SOURCE_ID = "tower-source";
const LAYER_ID = "tower-circles";
const LAYER_GLOW_ID = "tower-glow";

/* ── Voltage color mapping (Thor FE reference) ── */
function voltageColor(voltage: number): string {
    if (voltage >= 500) return "#3b82f6";   // Blue — SUTET 500kV
    if (voltage >= 150) return "#ef4444";   // Red — SUTT 150kV
    if (voltage >= 70) return "#eab308";    // Yellow — 70kV
    return "#a3a3a3";                        // Gray — unknown
}

interface Tower {
    id: number;
    name: string;
    penghantar: string;
    ultg: string;
    garduInduk: string;
    funloc: string;
    type: string;
    isolator: string;
    sirkit: string;
    lat: number;
    lng: number;
    tla: string;
    mrgLama: string;
    mrgBaru: string;
    keterangan: string;
}

interface UseTowerMarkersOptions {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    visible: boolean;
}

export function useTowerMarkers({ map, mapLoaded, visible }: UseTowerMarkersOptions) {
    const [towers, setTowers] = useState<Tower[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const fetched = useRef(false);

    // Fetch tower data from API (once)
    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;
        setLoading(true);

        fetch("/api/towers")
            .then((res) => res.json())
            .then((data) => {
                setTowers(data.towers || []);
                setLoading(false);
                console.log(`[useTowerMarkers] Loaded ${data.total} towers from ${data.source}`);
            })
            .catch((err) => {
                setError(String(err));
                setLoading(false);
                console.error("[useTowerMarkers] Fetch error:", err);
            });
    }, []);

    // Convert towers to GeoJSON
    const toGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
        type: "FeatureCollection",
        features: towers.map((t) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
            properties: {
                id: t.id,
                name: t.name,
                penghantar: t.penghantar,
                ultg: t.ultg,
                garduInduk: t.garduInduk,
                type: t.type,
                sirkit: t.sirkit,
                color: voltageColor(parseInt(t.penghantar.match(/\d+/)?.[0] || "0")),
                keterangan: t.keterangan,
            },
        })),
    }), [towers]);

    // Add/update source + layers on map
    useEffect(() => {
        if (!map.current || !mapLoaded || towers.length === 0) return;

        const m = map.current;
        const geojson = toGeoJSON();

        // Add or update source
        const existingSource = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (existingSource) {
            existingSource.setData(geojson);
        } else {
            m.addSource(SOURCE_ID, { type: "geojson", data: geojson });

            // Glow layer (behind)
            m.addLayer({
                id: LAYER_GLOW_ID,
                type: "circle",
                source: SOURCE_ID,
                paint: {
                    "circle-radius": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 3,
                        10, 6,
                        15, 10,
                    ],
                    "circle-color": ["get", "color"],
                    "circle-opacity": 0.25,
                    "circle-blur": 1,
                },
            });

            // Main circle layer
            m.addLayer({
                id: LAYER_ID,
                type: "circle",
                source: SOURCE_ID,
                paint: {
                    "circle-radius": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 1.5,
                        10, 3.5,
                        15, 6,
                    ],
                    "circle-color": ["get", "color"],
                    "circle-opacity": 0.9,
                },
            });

            // Click popup
            m.on("click", LAYER_ID, (e) => {
                const feature = e.features?.[0];
                if (!feature || feature.geometry.type !== "Point") return;

                const coords = feature.geometry.coordinates.slice() as [number, number];
                const props = feature.properties;

                popupRef.current?.remove();
                popupRef.current = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    offset: 10,
                    className: "tower-popup",
                })
                    .setLngLat(coords)
                    .setHTML(`
                        <div style="font-family:system-ui;font-size:11px;line-height:1.4;max-width:220px;">
                            <div style="font-weight:700;font-size:12px;color:${props.color};margin-bottom:4px;">
                                🗼 ${props.name || "Tower"}
                            </div>
                            <div style="color:#94a3b8;">
                                <b>Penghantar:</b> ${props.penghantar || "-"}<br/>
                                <b>GI:</b> ${props.garduInduk || "-"}<br/>
                                <b>ULTG:</b> ${props.ultg || "-"}<br/>
                                <b>Type:</b> ${props.type || "-"} | <b>Sirkit:</b> ${props.sirkit || "-"}<br/>
                                ${props.keterangan ? `<div style="margin-top:3px;color:#fbbf24;font-size:10px;">⚠️ ${props.keterangan}</div>` : ""}
                            </div>
                        </div>
                    `)
                    .addTo(m);
            });

            m.on("mouseenter", LAYER_ID, () => {
                m.getCanvas().style.cursor = "pointer";
            });
            m.on("mouseleave", LAYER_ID, () => {
                m.getCanvas().style.cursor = "";
            });
        }

        // Cleanup on unmount
        return () => {
            // Don't remove — let visibility toggle handle it
        };
    }, [map, mapLoaded, towers, toGeoJSON]);

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

    return { towers, loading, error, towerCount: towers.length };
}
