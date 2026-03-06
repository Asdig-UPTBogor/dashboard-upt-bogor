"use client";
/**
 * useGIMarkers — Renders Gardu Induk markers on MapLibre map
 *
 * Uses symbol layer with custom Canvas-drawn icons:
 * ▽ Downward triangle with ○ circle hole in center.
 * Color-coded by voltage (Thor FE standard: 500kV=Blue, 150kV=Red, 70kV=Yellow).
 *
 * Labels use MapLibre's built-in text-variable-anchor for
 * automatic collision-free placement (top/left/right/bottom).
 */

import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import type { GarduInduk } from "@/types/asset-maps-types";

const SOURCE_ID = "gi-source";
const LAYER_GLOW_ID = "gi-glow";
const LAYER_ICON_ID = "gi-icons";
const LAYER_LABEL_ID = "gi-labels";


/* ── Voltage color mapping (Thor FE standard) ── */
function voltageColor(voltage: number): string {
    if (voltage >= 500) return "#3b82f6";   // Blue — SUTET 500kV
    if (voltage >= 150) return "#ef4444";   // Red — SUTT 150kV
    if (voltage >= 70) return "#eab308";    // Yellow — 70kV
    return "#a3a3a3";                        // Gray — unknown
}

/* ── Create GI icon: downward triangle + circle hole + white outline ── */
function createGIIcon(fillColor: string, size: number = 48): ImageData {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const pad = 4;
    const w = size - pad * 2;
    const h = size - pad * 2;

    // Triangle points (pointing down)
    const topLeft = { x: pad, y: pad };
    const topRight = { x: pad + w, y: pad };
    const bottom = { x: size / 2, y: pad + h };

    // White outline (drawn first, slightly larger)
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Draw triangle fill
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Circle hole in center (cutout effect)
    const cx = size / 2;
    const cy = pad + h * 0.38; // Slightly above center of triangle
    const r = w * 0.15;

    // Draw circle hole (dark background to simulate hole)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();

    return ctx.getImageData(0, 0, size, size);
}

/* ── Color variants for icons ── */
const ICON_VARIANTS = [
    { key: "blue", hex: "#3b82f6" },
    { key: "red", hex: "#ef4444" },
    { key: "yellow", hex: "#eab308" },
    { key: "gray", hex: "#a3a3a3" },
];

function colorToKey(hex: string): string {
    const match = ICON_VARIANTS.find(v => v.hex === hex);
    return match ? match.key : "gray";
}


interface UseGIMarkersOptions {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    mapInstanceId: number;
    visible: boolean;
    gis: GarduInduk[];
}

export function useGIMarkers({ map, mapLoaded, mapInstanceId, visible, gis }: UseGIMarkersOptions) {
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const iconsAdded = useRef(false);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Convert to GeoJSON
    const toGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
        type: "FeatureCollection",
        features: gis.map((gi) => {
            const color = voltageColor(gi.voltage);
            return {
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: [gi.lng, gi.lat] },
                properties: {
                    id: gi.id,
                    name: gi.name,
                    ultg: gi.ultg,
                    type: gi.type,
                    voltage: gi.voltage,
                    color,
                    iconKey: `gi-${colorToKey(color)}`,
                },
            };
        }),
    }), [gis]);

    // Register icons + add layers
    useEffect(() => {
        if (!map.current || !mapLoaded || gis.length === 0) return;

        const m = map.current;

        // Reset icon flag — new map instance needs fresh icon registration
        iconsAdded.current = false;

        // Register icons
        for (const variant of ICON_VARIANTS) {
            const name = `gi-${variant.key}`;
            if (!m.hasImage(name)) {
                const imgData = createGIIcon(variant.hex, 48);
                m.addImage(name, imgData, { pixelRatio: 2 });
            }
        }
        iconsAdded.current = true;


        const geojson = toGeoJSON();
        const existingSource = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

        if (existingSource) {
            existingSource.setData(geojson);
        } else {
            m.addSource(SOURCE_ID, { type: "geojson", data: geojson });

            // Glow behind icon
            m.addLayer({
                id: LAYER_GLOW_ID,
                type: "circle",
                source: SOURCE_ID,
                paint: {
                    "circle-radius": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 6,
                        10, 10,
                        15, 16,
                    ],
                    "circle-color": ["get", "color"],
                    "circle-opacity": 0.15,
                    "circle-blur": 1,
                },
            });

            // Symbol layer with triangle icons
            m.addLayer({
                id: LAYER_ICON_ID,
                type: "symbol",
                source: SOURCE_ID,
                layout: {
                    "icon-image": ["get", "iconKey"],
                    "icon-size": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 0.4,
                        10, 0.7,
                        15, 1.0,
                    ],
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true,
                    "icon-anchor": "bottom",
                },
                paint: {
                    "icon-translate": [0, 0],
                },
            });

            // GI name labels — uses text-variable-anchor for auto collision-free placement
            m.addLayer({
                id: LAYER_LABEL_ID,
                type: "symbol",
                source: SOURCE_ID,
                layout: {
                    "text-field": ["get", "name"],
                    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                    "text-size": [
                        "interpolate", ["linear"], ["zoom"],
                        7, 0,
                        8, 9,
                        10, 11,
                        14, 13,
                    ],
                    "text-anchor": "bottom",
                    "text-offset": [0, -2.2],
                    "text-allow-overlap": false,
                    "text-optional": true,
                    "text-max-width": 12,
                },
                paint: {
                    "text-color": "#ffffff",
                    "text-halo-color": "rgba(0,0,0,0.85)",
                    "text-halo-width": 1.5,
                },
            });

            // Click popup on icon layer
            const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
                const feature = e.features?.[0];
                if (!feature || feature.geometry.type !== "Point") return;

                const coords = feature.geometry.coordinates.slice() as [number, number];
                const props = feature.properties;

                popupRef.current?.remove();
                popupRef.current = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    offset: 20,
                    className: "gi-popup",
                })
                    .setLngLat(coords)
                    .setHTML(`
                        <div style="font-family:system-ui;font-size:11px;line-height:1.4;max-width:220px;">
                            <div style="font-weight:700;font-size:13px;color:${props.color};margin-bottom:4px;">
                                ⚡ ${props.name || "Gardu Induk"}
                            </div>
                            <div style="color:#94a3b8;">
                                <b>ULTG:</b> ${props.ultg || "-"}<br/>
                                <b>Type:</b> ${props.type || "-"}<br/>
                                <b>Voltage:</b> ${props.voltage ? props.voltage + " kV" : "-"}
                            </div>
                        </div>
                    `)
                    .addTo(m);
            };
            const handleEnter = () => { m.getCanvas().style.cursor = "pointer"; };
            const handleLeave = () => { m.getCanvas().style.cursor = ""; };

            m.on("click", LAYER_ICON_ID, handleClick);
            m.on("mouseenter", LAYER_ICON_ID, handleEnter);
            m.on("mouseleave", LAYER_ICON_ID, handleLeave);

            // Store cleanup for event handlers
            cleanupRef.current = () => {
                m.off("click", LAYER_ICON_ID, handleClick);
                m.off("mouseenter", LAYER_ICON_ID, handleEnter);
                m.off("mouseleave", LAYER_ICON_ID, handleLeave);
            };
        }
    }, [map, mapLoaded, mapInstanceId, gis, toGeoJSON]);

    // Toggle visibility
    useEffect(() => {
        if (!map.current || !mapLoaded) return;
        const m = map.current;
        const viz = visible ? "visible" : "none";
        try {
            if (m.getLayer(LAYER_GLOW_ID)) m.setLayoutProperty(LAYER_GLOW_ID, "visibility", viz);
            if (m.getLayer(LAYER_ICON_ID)) m.setLayoutProperty(LAYER_ICON_ID, "visibility", viz);
            if (m.getLayer(LAYER_LABEL_ID)) m.setLayoutProperty(LAYER_LABEL_ID, "visibility", viz);
        } catch { /* layer may not exist yet */ }
    }, [map, mapLoaded, visible]);

    // Cleanup event handlers on unmount
    useEffect(() => () => {
        cleanupRef.current?.();
    }, []);

    return { gis, loading: false, error: null, giCount: gis.length };
}
