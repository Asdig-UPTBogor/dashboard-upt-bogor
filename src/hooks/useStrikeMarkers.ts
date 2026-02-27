"use client";
/**
 * useStrikeMarkers — SVG lightning bolt icon + Single/Multi colors from StrikeLegend
 *
 * Icon: Custom SVG bolt (shape seperti gambar user — body tebal, shadow, highlight)
 * Color: Single → #f97316 (orange), Multi → #ef4444 (red) — ikuti StrikeLegend
 * Glow: circle halo, warna sama, pulsing
 * Animation: float naik-turun
 */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FlashEvent } from "@/app/api/strikes/route";

const SOURCE_ID = "strike-points";
const LAYER_GLOW = "strike-glow";
const LAYER_SYM = "strike-symbols";

// StrikeLegend colors
const COLOR_SINGLE = "#f97316"; // orange
const COLOR_MULTI = "#ef4444"; // red

function strikeColor(isMulti: boolean): string {
    return isMulti ? COLOR_MULTI : COLOR_SINGLE;
}

function shadowColor(isMulti: boolean): string {
    return isMulti ? "#7f1d1d" : "#7c2d12";
}

// Build SVG bolt data URI by color
function buildBoltURI(color: string, shadow: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="32" viewBox="0 0 18 32">
  <path d="M11 1L2 18h6.5L6 31 16 14h-6.5z"
        fill="${shadow}" opacity="0.35" transform="translate(1.5,2.5)"/>
  <path d="M11 1L2 18h6.5L6 31 16 14h-6.5z"
        fill="${shadow}" stroke="${shadow}" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M11 1L2 18h6.5L6 31 16 14h-6.5z"
        fill="${color}" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"
        stroke-linejoin="round"/>
  <path d="M10 3L4 17h5.5" fill="none"
        stroke="rgba(255,255,255,0.4)" stroke-width="1"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function loadImage(m: maplibregl.Map, id: string, uri: string): Promise<void> {
    return new Promise(resolve => {
        if (m.hasImage(id)) { resolve(); return; }
        const img = new Image(18, 32);
        img.onload = () => { if (!m.hasImage(id)) m.addImage(id, img); resolve(); };
        img.onerror = () => resolve();
        img.src = uri;
    });
}

export interface StrikeDetails {
    id: string;
    eventTime: string;
    towerName: string;
    ultg: string;
    gi: string;
    strikeLat: number;
    strikeLng: number;
    tegangan: number;
    penghantar: string;
    strokeCount: number;
    flashType: string;
    currentKa: number;
    maxKa: number;
    avgKa: number;
    risetime: number;
    maxRateRise: number;
    ellSemiMajor: number;
    ellSemiMinor: number;
    ellAngle: number;
    // distToTowerReal & distToLineReal removed — calculated on FE via useDistanceCalculator
}

interface UseStrikeMarkersOptions {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    visible: boolean;
    days?: number;
    onStrikeClick?: (strike: StrikeDetails) => void;
    onStrikeReset?: () => void;
}

export function useStrikeMarkers({ map, mapLoaded, visible, days = 30, onStrikeClick, onStrikeReset }: UseStrikeMarkersOptions) {
    const [events, setEvents] = useState<FlashEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const animRef = useRef<number | null>(null);
    const fetched = useRef(false);
    const layersAdded = useRef(false);
    const visibleRef = useRef(visible);
    const eventMapRef = useRef<Map<string, FlashEvent>>(new Map());


    useEffect(() => { visibleRef.current = visible; }, [visible]);

    // ── Fetch once ──
    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;
        setLoading(true);
        fetch(`/api/strikes?days=${days}`)
            .then(r => r.json())
            .then(d => {
                const list: FlashEvent[] = d.events || [];
                // Build lookup map
                const lut = new Map<string, FlashEvent>();
                for (const e of list) lut.set(e.id, e);
                eventMapRef.current = lut;
                setEvents(list);
                setLoading(false);
                console.log(`[useStrikeMarkers] ✅ ${d.total} flash events (${days}d)`);
            })
            .catch(err => { setLoading(false); console.error("[useStrikeMarkers]", err); });
    }, [days]);

    // ── Add layers (only when toggle ON) ──
    useEffect(() => {
        if (!map.current || !mapLoaded || events.length === 0 || !visible) return;
        const m = map.current;

        // If layers already exist and source exists → nothing to do
        if (m.getLayer(LAYER_SYM) && m.getSource(SOURCE_ID)) return;

        const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: events
                .filter(e => e.strikeLat && e.strikeLng)
                .map(e => {
                    const isMulti = e.strokeCount > 1;
                    const color = strikeColor(isMulti);
                    const imgId = isMulti ? "bolt-multi" : "bolt-single";
                    return {
                        type: "Feature" as const,
                        geometry: { type: "Point" as const, coordinates: [e.strikeLng, e.strikeLat] },
                        properties: {
                            id: e.id,
                            isMulti,
                        },
                    };
                }),
        };

        const tryAddLayers = async () => {
            console.log("[useStrikeMarkers] tryAddLayers called");

            // Load 2 bolt images: single (orange) + multi (red)
            console.log("[useStrikeMarkers] Loading bolt images...");
            try {
                await Promise.all([
                    loadImage(m, "bolt-single", buildBoltURI(COLOR_SINGLE, shadowColor(false))),
                    loadImage(m, "bolt-multi", buildBoltURI(COLOR_MULTI, shadowColor(true))),
                ]);
            } catch (imgErr) {
                console.error("[useStrikeMarkers] Image load failed:", imgErr);
            }
            console.log("[useStrikeMarkers] Images loaded. bolt-single:", m.hasImage("bolt-single"), "bolt-multi:", m.hasImage("bolt-multi"));

            // Clean up orphan state: remove any existing layers/sources
            try { if (m.getLayer(LAYER_SYM)) m.removeLayer(LAYER_SYM); } catch { /* */ }
            try { if (m.getLayer(LAYER_GLOW)) m.removeLayer(LAYER_GLOW); } catch { /* */ }
            try { if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID); } catch { /* */ }
            console.log("[useStrikeMarkers] Cleanup done. Adding source with", geojson.features.length, "features");

            const initViz = "visible"; // Only enter this effect when visible=true
            console.log("[useStrikeMarkers] initViz: visible");

            try {
                m.addSource(SOURCE_ID, { type: "geojson", data: geojson });
                console.log("[useStrikeMarkers] Source added OK");

                // ── Glow halo ──
                m.addLayer({
                    id: LAYER_GLOW,
                    type: "circle",
                    source: SOURCE_ID,
                    layout: { "visibility": initViz },
                    paint: {
                        "circle-radius": [
                            "interpolate", ["linear"], ["zoom"],
                            5, 7, 8, 12, 11, 18, 14, 26,
                        ],
                        // FIX: 'color' property dihapus dari GeoJSON — pakai case expression
                        "circle-color": [
                            "case",
                            ["==", ["get", "isMulti"], true], COLOR_MULTI,
                            COLOR_SINGLE,
                        ],
                        "circle-opacity": 0.2,
                        "circle-blur": 1.3,
                        "circle-translate": [0, 0],
                    },
                });

                // ── SVG bolt icon ──
                m.addLayer({
                    id: LAYER_SYM,
                    type: "symbol",
                    source: SOURCE_ID,
                    layout: {
                        "visibility": initViz,
                        "icon-image": [
                            "case",
                            ["==", ["get", "isMulti"], true], "bolt-multi",
                            "bolt-single",
                        ],
                        "icon-size": [
                            "interpolate", ["linear"], ["zoom"],
                            5, 0.3,
                            8, 0.45,
                            11, 0.6,
                            14, 0.8,
                        ],
                        "icon-anchor": "bottom",
                        "icon-allow-overlap": true,
                        "icon-ignore-placement": true,
                        "icon-optional": true,   // ← prevent crash jika icon belum ready
                    },
                    paint: {
                        // FIX: gunakan icon-translate (PAINT) untuk animasi
                        // icon-offset adalah LAYOUT → setLayoutProperty menyebabkan
                        // symbol bucket re-serialize 60fps → crash saat mousemove
                        "icon-translate": [0, 0],
                    },
                });

                // ── Click dedup flag ──
                let strikeClickedFlag = false;

                // ── Click → lookup full event dari ref → StrikeDetailPanel ──
                m.on("click", LAYER_SYM, e => {
                    strikeClickedFlag = true;
                    const feat = e.features?.[0];
                    if (!feat) return;
                    const id = String((feat.properties as Record<string, unknown>).id || "");
                    const ev = eventMapRef.current.get(id);
                    if (!ev || !onStrikeClick) return;

                    // ── FlyTo strike location (Thor V3-style) ──
                    m.flyTo({
                        center: [ev.strikeLng, ev.strikeLat],
                        zoom: Math.max(m.getZoom(), 16),
                        pitch: 45,
                        duration: 1500,
                        speed: 1.5,
                        essential: true,
                    });


                    onStrikeClick({
                        id: ev.id,
                        eventTime: ev.eventTime,
                        towerName: ev.towerName,
                        ultg: ev.ultg,
                        gi: ev.gi,
                        strikeLat: ev.strikeLat,
                        strikeLng: ev.strikeLng,
                        tegangan: ev.tegangan,
                        penghantar: ev.penghantar,
                        strokeCount: ev.strokeCount,
                        flashType: ev.flashType,
                        currentKa: ev.currentKa,
                        maxKa: ev.maxKa,
                        avgKa: ev.avgKa,
                        risetime: ev.risetime,
                        maxRateRise: ev.maxRateRise,
                        ellSemiMajor: ev.ellSemiMajor,
                        ellSemiMinor: ev.ellSemiMinor,
                        ellAngle: ev.ellAngle,
                    });
                });

                // ── Click away (anywhere else) → reset panel & ellipse ──
                m.on("click", () => {
                    setTimeout(() => {
                        if (strikeClickedFlag) {
                            strikeClickedFlag = false;
                            return;
                        }
                        onStrikeReset?.();
                    }, 50);
                });

                m.on("mouseenter", LAYER_SYM, () => { m.getCanvas().style.cursor = "pointer"; });
                m.on("mouseleave", LAYER_SYM, () => { m.getCanvas().style.cursor = ""; });

                layersAdded.current = true;
                console.log(`[useStrikeMarkers] ✅ ${geojson.features.length} bolt markers, float start`);

                // ── Float animation — PAINT only (tidak trigger re-serialize) ──
                let phase = 0;
                const floatAnim = () => {
                    if (!m.getLayer(LAYER_SYM)) return;
                    phase += 0.035;
                    const yOff = Math.sin(phase) * 6;
                    try {
                        // FIX: setPaintProperty icon-translate, BUKAN setLayoutProperty icon-offset
                        // Layout change → re-serialize symbol bucket → crash di mousemove
                        m.setPaintProperty(LAYER_SYM, "icon-translate", [0, yOff]);
                        m.setPaintProperty(LAYER_GLOW, "circle-translate", [0, yOff * 0.4]);
                        m.setPaintProperty(LAYER_GLOW, "circle-opacity", 0.15 + Math.sin(phase) * 0.12);
                    } catch { return; }
                    animRef.current = requestAnimationFrame(floatAnim);
                };
                animRef.current = requestAnimationFrame(floatAnim);

            } catch (err) {
                console.error("[useStrikeMarkers] addLayer error:", err);
            }
        };

        tryAddLayers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, mapLoaded, events, visible]);

    // ── Visibility toggle ──
    useEffect(() => {
        if (!map.current || !mapLoaded) return;
        const m = map.current;
        const viz = visible ? "visible" : "none";
        try {
            if (m.getLayer(LAYER_GLOW)) m.setLayoutProperty(LAYER_GLOW, "visibility", viz);
            if (m.getLayer(LAYER_SYM)) m.setLayoutProperty(LAYER_SYM, "visibility", viz);
        } catch { /* not yet */ }
    }, [map, mapLoaded, visible]);

    // ── Cleanup ──
    useEffect(() => () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
    }, []);

    return { events, loading, eventCount: events.length };
}
