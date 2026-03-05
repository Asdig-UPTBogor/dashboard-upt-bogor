"use client";
/**
 * useStrikeMarkers — SVG lightning bolt icon + Single/Multi colors from StrikeLegend
 *
 * Icon: Custom SVG bolt (shape seperti gambar user — body tebal, shadow, highlight)
 * Color: Single → #f97316 (orange), Multi → #ef4444 (red) — ikuti StrikeLegend
 * Glow: circle halo, warna sama, pulsing
 *
 * v2 — Fixed: GeoJSON source now updates when events change (was causing strikes to not show)
 */

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FlashEvent } from "@/types/asset-maps-types";

const SOURCE_ID = "strike-points";
const LAYER_GLOW = "strike-glow";
const LAYER_SYM = "strike-symbols";

// StrikeLegend colors
const COLOR_SINGLE = "#f97316"; // orange
const COLOR_MULTI = "#ef4444"; // red

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
}

interface UseStrikeMarkersOptions {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    mapInstanceId: number;
    visible: boolean;
    allStrikes: FlashEvent[];
    /** Show only the N most recent strikes (default: 20) */
    latestN?: number;
    onStrikeClick?: (strike: StrikeDetails) => void;
    onStrikeReset?: () => void;
}

/** Build GeoJSON from filtered events */
function buildGeoJSON(events: FlashEvent[]): GeoJSON.FeatureCollection {
    return {
        type: "FeatureCollection",
        features: events
            .filter(e => e.strikeLat && e.strikeLng)
            .map(e => ({
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: [e.strikeLng, e.strikeLat] },
                properties: { id: e.id, isMulti: e.strokeCount > 1 },
            })),
    };
}

export function useStrikeMarkers({
    map, mapLoaded, mapInstanceId, visible, allStrikes,
    latestN = 20, onStrikeClick, onStrikeReset
}: UseStrikeMarkersOptions) {
    const [events, setEvents] = useState<FlashEvent[]>([]);
    const eventMapRef = useRef<Map<string, FlashEvent>>(new Map());
    const cleanupRef = useRef<(() => void) | null>(null);

    // Take only the N most recent strikes (sorted by eventTime descending)
    const prevFilterFingerprint = useRef("");
    useEffect(() => {
        if (allStrikes.length === 0) {
            if (events.length > 0) setEvents([]);
            return;
        }

        // Sort by eventTime descending → take top N
        const sorted = [...allStrikes].sort((a, b) => b.eventTime.localeCompare(a.eventTime));
        const filtered = sorted.slice(0, latestN);

        // Skip if content hasn't changed
        const fingerprint = `${filtered.length}::${filtered[0]?.id || ""}`;
        if (fingerprint === prevFilterFingerprint.current) return;
        prevFilterFingerprint.current = fingerprint;

        const lut = new Map<string, FlashEvent>();
        for (const e of filtered) lut.set(e.id, e);
        eventMapRef.current = lut;
        setEvents(filtered);
    }, [allStrikes, latestN]);

    // ── Add/update layers ──
    // Separated: source data update vs layer creation
    useEffect(() => {
        if (!map.current || !mapLoaded || !visible || events.length === 0) return;
        const m = map.current;
        let cancelled = false;

        const geojson = buildGeoJSON(events);

        // If source already exists → just update data (FIX: was returning early before)
        const existingSource = m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (existingSource) {
            existingSource.setData(geojson);
            // Ensure layers are visible
            try {
                if (m.getLayer(LAYER_GLOW)) m.setLayoutProperty(LAYER_GLOW, "visibility", "visible");
                if (m.getLayer(LAYER_SYM)) m.setLayoutProperty(LAYER_SYM, "visibility", "visible");
            } catch { /* */ }
            return;
        }

        // Source doesn't exist → create everything
        const tryAddLayers = async () => {
            try {
                await Promise.all([
                    loadImage(m, "bolt-single", buildBoltURI(COLOR_SINGLE, shadowColor(false))),
                    loadImage(m, "bolt-multi", buildBoltURI(COLOR_MULTI, shadowColor(true))),
                ]);
            } catch { /* image load failed */ }

            if (cancelled) return;

            // Clean up orphan state
            try { if (m.getLayer(LAYER_SYM)) m.removeLayer(LAYER_SYM); } catch { /* */ }
            try { if (m.getLayer(LAYER_GLOW)) m.removeLayer(LAYER_GLOW); } catch { /* */ }
            try { if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID); } catch { /* */ }

            if (cancelled) return;

            try {
                m.addSource(SOURCE_ID, { type: "geojson", data: geojson });

                m.addLayer({
                    id: LAYER_GLOW,
                    type: "circle",
                    source: SOURCE_ID,
                    layout: { "visibility": "visible" },
                    paint: {
                        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 7, 8, 12, 11, 18, 14, 26],
                        "circle-color": ["case", ["==", ["get", "isMulti"], true], COLOR_MULTI, COLOR_SINGLE],
                        "circle-opacity": 0.2,
                        "circle-blur": 1.3,
                    },
                });

                m.addLayer({
                    id: LAYER_SYM,
                    type: "symbol",
                    source: SOURCE_ID,
                    layout: {
                        "visibility": "visible",
                        "icon-image": ["case", ["==", ["get", "isMulti"], true], "bolt-multi", "bolt-single"],
                        "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.3, 8, 0.45, 11, 0.6, 14, 0.8],
                        "icon-anchor": "bottom",
                        "icon-allow-overlap": true,
                        "icon-ignore-placement": true,
                        "icon-optional": true,
                    },
                });

                // ── Click dedup flag ──
                let strikeClickedFlag = false;

                // ── Click → lookup full event → StrikeDetailPanel ──
                const handleStrikeClick = (e: maplibregl.MapLayerMouseEvent) => {
                    strikeClickedFlag = true;
                    const feat = e.features?.[0];
                    if (!feat) return;
                    const id = String((feat.properties as Record<string, unknown>).id || "");
                    const ev = eventMapRef.current.get(id);
                    if (!ev || !onStrikeClick) return;

                    m.flyTo({
                        center: [ev.strikeLng, ev.strikeLat],
                        zoom: Math.max(m.getZoom(), 16),
                        pitch: 45, duration: 1500, speed: 1.5, essential: true,
                    });

                    onStrikeClick({
                        id: ev.id, eventTime: ev.eventTime, towerName: ev.towerName,
                        ultg: ev.ultg, gi: ev.gi, strikeLat: ev.strikeLat, strikeLng: ev.strikeLng,
                        tegangan: ev.tegangan, penghantar: ev.penghantar, strokeCount: ev.strokeCount,
                        flashType: ev.flashType, currentKa: ev.currentKa, maxKa: ev.maxKa,
                        avgKa: ev.avgKa, risetime: ev.risetime, maxRateRise: ev.maxRateRise,
                        ellSemiMajor: ev.ellSemiMajor, ellSemiMinor: ev.ellSemiMinor, ellAngle: ev.ellAngle,
                    });
                };

                // ── Click away → reset panel & overlay ──
                const handleMapClick = () => {
                    setTimeout(() => {
                        if (strikeClickedFlag) { strikeClickedFlag = false; return; }
                        onStrikeReset?.();
                    }, 50);
                };

                const handleEnter = () => { m.getCanvas().style.cursor = "pointer"; };
                const handleLeave = () => { m.getCanvas().style.cursor = ""; };

                m.on("click", LAYER_SYM, handleStrikeClick);
                m.on("click", handleMapClick);
                m.on("mouseenter", LAYER_SYM, handleEnter);
                m.on("mouseleave", LAYER_SYM, handleLeave);

                // Detach previous handlers before storing new cleanup
                cleanupRef.current?.();

                // Store cleanup
                cleanupRef.current = () => {
                    m.off("click", LAYER_SYM, handleStrikeClick);
                    m.off("click", handleMapClick);
                    m.off("mouseenter", LAYER_SYM, handleEnter);
                    m.off("mouseleave", LAYER_SYM, handleLeave);
                };
            } catch (err) {
                console.error("[useStrikeMarkers] addLayer error:", err);
            }
        };

        tryAddLayers();

        return () => { cancelled = true; };
    }, [map, mapLoaded, mapInstanceId, events, visible, onStrikeClick, onStrikeReset]);

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

    // ── Cleanup event handlers on unmount ──
    useEffect(() => () => {
        cleanupRef.current?.();
    }, []);

    return { events, loading: false, eventCount: events.length };
}
