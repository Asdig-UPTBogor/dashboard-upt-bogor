"use client";
/**
 * useMapGL — MapLibre initialization hook for Next.js
 * Reference: Thor FE useMapGL.ts
 *
 * Features:
 * - Dark/light/satellite/osm style toggle
 * - Intro animation (fly to Bogor area)
 * - 3D terrain toggle (AWS Terrarium DEM)
 * - Globe projection toggle
 */

import { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";

/* ── Map Styles (online raster) ── */
const STYLES: Record<string, { tiles: string; label: string }> = {
    dark: {
        tiles: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        label: "Dark",
    },
    light: {
        tiles: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        label: "Light",
    },
    satellite: {
        tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        label: "Satellite",
    },
    osm: {
        tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        label: "OpenStreetMap",
    },
};

/* ── Bogor area defaults ── */
const BOGOR_CENTER: [number, number] = [106.75, -6.65];
const BOGOR_ZOOM = 9.5;

interface UseMapGLOptions {
    containerRef: React.RefObject<HTMLDivElement | null>;
    mapStyle?: string;
}

export function useMapGL({ containerRef, mapStyle = "dark" }: UseMapGLOptions) {
    const map = useRef<maplibregl.Map | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const savedView = useRef<{ center: maplibregl.LngLat; zoom: number; pitch: number; bearing: number } | null>(null);
    const isFirstLoad = useRef(true);

    // Init / style change
    useEffect(() => {
        if (!containerRef?.current) return;

        const style = STYLES[mapStyle] || STYLES.dark;

        // Save view before destroy
        if (map.current) {
            savedView.current = {
                center: map.current.getCenter(),
                zoom: map.current.getZoom(),
                pitch: map.current.getPitch(),
                bearing: map.current.getBearing(),
            };
            map.current.remove();
            map.current = null;
            setMapLoaded(false);
        }

        const initialCenter = isFirstLoad.current
            ? [106.82, -6.59]
            : (savedView.current ? [savedView.current.center.lng, savedView.current.center.lat] : BOGOR_CENTER);
        const initialZoom = isFirstLoad.current ? 5 : (savedView.current?.zoom ?? BOGOR_ZOOM);

        map.current = new maplibregl.Map({
            container: containerRef.current,
            style: {
                version: 8 as const,
                sources: {
                    basemap: { type: "raster", tiles: [style.tiles], tileSize: 256 },
                },
                layers: [{ id: "basemap", type: "raster", source: "basemap" }],
            },
            center: initialCenter as [number, number],
            zoom: initialZoom,
            pitch: isFirstLoad.current ? 0 : (savedView.current?.pitch ?? 0),
            bearing: isFirstLoad.current ? -20 : (savedView.current?.bearing ?? 0),
            attributionControl: false,
            maxZoom: 18,
            minZoom: 3,
            maxPitch: 85,
            fadeDuration: 0,
            dragRotate: false,  // Disable default — we use custom handler below
        });

        // ── Custom Right-Click Drag: slower speed + correct direction ──
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        const ROTATE_SPEED = 0.3;  // 30% of default speed
        const PITCH_SPEED = 0.3;

        const onContextMenu = (e: Event) => e.preventDefault();
        const onMouseDown = (e: MouseEvent) => {
            if (e.button === 2) {  // Right click only
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                e.preventDefault();
            }
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging || !map.current) return;
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            // Bearing: move mouse right = rotate clockwise (positive)
            const newBearing = (map.current.getBearing() + deltaX * ROTATE_SPEED);
            // Pitch: move mouse up = pitch up
            const newPitch = Math.max(0, Math.min(85, map.current.getPitch() - deltaY * PITCH_SPEED));
            map.current.jumpTo({ bearing: newBearing, pitch: newPitch });
            lastX = e.clientX;
            lastY = e.clientY;
        };
        const onMouseUp = (e: MouseEvent) => {
            if (e.button === 2) isDragging = false;
        };

        const container = containerRef.current;
        container.addEventListener("contextmenu", onContextMenu);
        container.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        map.current.on("load", () => {
            setMapLoaded(true);

            // Intro animation on first load
            if (isFirstLoad.current) {
                setTimeout(() => {
                    map.current?.flyTo({
                        center: BOGOR_CENTER,
                        zoom: BOGOR_ZOOM,
                        pitch: 45,
                        bearing: -15,
                        duration: 3000,
                        essential: true,
                    });
                    isFirstLoad.current = false;
                }, 300);
            }
        });

        return () => {
            // Clean up custom drag rotate
            container.removeEventListener("contextmenu", onContextMenu);
            container.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);

            if (map.current) {
                savedView.current = {
                    center: map.current.getCenter(),
                    zoom: map.current.getZoom(),
                    pitch: map.current.getPitch(),
                    bearing: map.current.getBearing(),
                };
                map.current.remove();
                map.current = null;
                setMapLoaded(false);
            }
        };
    }, [mapStyle, containerRef]);

    /* ── Helpers ── */
    const flyTo = useCallback((opts: maplibregl.FlyToOptions) => map.current?.flyTo(opts), []);

    const resetView = useCallback(() => {
        map.current?.flyTo({
            center: BOGOR_CENTER,
            zoom: BOGOR_ZOOM,
            pitch: 45,
            bearing: -15,
            duration: 2000,
        });
    }, []);

    /* ── 3D Terrain Toggle ── */
    const enable3D = useCallback(() => {
        if (!map.current) return;
        try {
            // Add DEM source
            if (!map.current.getSource("terrain-dem")) {
                map.current.addSource("terrain-dem", {
                    type: "raster-dem",
                    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    encoding: "terrarium",
                    maxzoom: 15,
                });
            }
            // Add hillshade layer
            if (!map.current.getLayer("hillshade")) {
                map.current.addLayer({
                    id: "hillshade",
                    type: "hillshade",
                    source: "terrain-dem",
                    paint: {
                        "hillshade-exaggeration": 0.5,
                        "hillshade-shadow-color": "#374151",
                        "hillshade-highlight-color": "#fef3c7",
                        "hillshade-illumination-direction": 315,
                    },
                });
            }
            // Enable terrain
            map.current.setTerrain({ source: "terrain-dem", exaggeration: 1.3 });
            // Sky/fog disabled — clean 3D view
            // Animate pitch
            map.current.easeTo({ pitch: 60, duration: 1000 });
        } catch (e) {
            console.error("[useMapGL] 3D terrain error:", e);
        }
    }, []);

    const disable3D = useCallback(() => {
        if (!map.current) return;
        try {
            map.current.setTerrain(null);
            if (map.current.getLayer("hillshade")) map.current.removeLayer("hillshade");
            if (map.current.getSource("terrain-dem")) map.current.removeSource("terrain-dem");
            try { map.current.setSky({}); } catch { /* ignore */ }
            map.current.easeTo({ pitch: 0, duration: 1000 });
        } catch (e) {
            console.error("[useMapGL] disable 3D error:", e);
        }
    }, []);

    /* ── Globe Projection Toggle ── */
    const setProjection = useCallback((mode: "globe" | "mercator") => {
        if (!map.current) return;
        try {
            map.current.setProjection({ type: mode });
            if (mode === "globe") {
                // Zoom out to see the globe
                map.current.flyTo({
                    center: [105.2, -3.9],
                    zoom: 2.9,
                    pitch: 1,
                    bearing: 0,
                    duration: 1500,
                });
            }
        } catch (e) {
            console.warn("[useMapGL] Projection error:", e);
        }
    }, []);

    return { map, mapLoaded, flyTo, resetView, enable3D, disable3D, setProjection, STYLES };
}
