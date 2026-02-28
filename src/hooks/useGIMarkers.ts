"use client";
/**
 * useGIMarkers — Renders Gardu Induk markers on MapLibre map
 *
 * Uses symbol layer with custom Canvas-drawn icons:
 * ▽ Downward triangle with ○ circle hole in center.
 * Color-coded by voltage (Thor FE standard: 500kV=Blue, 150kV=Red, 70kV=Yellow).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";

const SOURCE_ID = "gi-source";
const LAYER_GLOW_ID = "gi-glow";
const LAYER_ICON_ID = "gi-icons";

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

interface GarduInduk {
    id: number;
    name: string;
    ultg: string;
    type: string;
    voltage: number;
    lat: number;
    lng: number;
}

interface UseGIMarkersOptions {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    visible: boolean;
}

export function useGIMarkers({ map, mapLoaded, visible }: UseGIMarkersOptions) {
    const [gis, setGIs] = useState<GarduInduk[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const fetched = useRef(false);
    const iconsAdded = useRef(false);
    const animRef = useRef<number | null>(null);

    // Fetch GI data from API (once)
    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;
        setLoading(true);

        fetch("/api/gardu-induk")
            .then((res) => res.json())
            .then((data) => {
                setGIs(data.garduInduk || []);
                setLoading(false);
                console.log(`[useGIMarkers] Loaded ${data.total} GI from ${data.source}`);
            })
            .catch((err) => {
                setError(String(err));
                setLoading(false);
                console.error("[useGIMarkers] Fetch error:", err);
            });
    }, []);

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

        // Register icons once
        if (!iconsAdded.current) {
            for (const variant of ICON_VARIANTS) {
                const name = `gi-${variant.key}`;
                if (!m.hasImage(name)) {
                    const imgData = createGIIcon(variant.hex, 48);
                    m.addImage(name, imgData, { pixelRatio: 2 });
                }
            }
            iconsAdded.current = true;
            console.log("[useGIMarkers] Registered 4 GI icon variants");
        }

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

            // ── Float animation — sine wave on icon-translate ──
            let phase = 0;
            const floatAnim = () => {
                if (!m.getLayer(LAYER_ICON_ID)) return;
                phase += 0.03;
                const yOff = Math.sin(phase) * 5;
                try {
                    m.setPaintProperty(LAYER_ICON_ID, "icon-translate", [0, yOff]);
                    m.setPaintProperty(LAYER_GLOW_ID, "circle-translate", [0, yOff * 0.4]);
                } catch { return; }
                animRef.current = requestAnimationFrame(floatAnim);
            };
            animRef.current = requestAnimationFrame(floatAnim);

            // Click popup on icon layer
            m.on("click", LAYER_ICON_ID, (e) => {
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
            });

            m.on("mouseenter", LAYER_ICON_ID, () => {
                m.getCanvas().style.cursor = "pointer";
            });
            m.on("mouseleave", LAYER_ICON_ID, () => {
                m.getCanvas().style.cursor = "";
            });
        }
    }, [map, mapLoaded, gis, toGeoJSON]);

    // Toggle visibility
    useEffect(() => {
        if (!map.current || !mapLoaded) return;
        const m = map.current;
        const viz = visible ? "visible" : "none";
        try {
            if (m.getLayer(LAYER_GLOW_ID)) m.setLayoutProperty(LAYER_GLOW_ID, "visibility", viz);
            if (m.getLayer(LAYER_ICON_ID)) m.setLayoutProperty(LAYER_ICON_ID, "visibility", viz);
        } catch { /* layer may not exist yet */ }
    }, [map, mapLoaded, visible]);

    // Cleanup animation on unmount
    useEffect(() => () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
    }, []);

    return { gis, loading, error, giCount: gis.length };
}
