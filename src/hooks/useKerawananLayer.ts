"use client";
/**
 * useKerawananLayer — One independent layer per risk type.
 *
 * Each active filter creates its own GeoJSON source + symbol layer.
 * If a tower has multiple active risks, icons naturally stack.
 * Cluster per risk type keeps zoom-out tidy.
 */

import { useEffect, useRef, useState, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import maplibregl from "maplibre-gl";
import {
    ArrowDownToLine, Shovel, TreePine, Building, Wind,
    Balloon, MountainSnow, Waves, Zap, Users, Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tower as FullTower } from "@/types/asset-maps-types";

/* ── Risk config ── */
const RISK_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
    andongan: { icon: ArrowDownToLine, color: "#e97520", label: "Andongan Rendah" },
    galian: { icon: Shovel, color: "#a855f7", label: "Galian" },
    pohon: { icon: TreePine, color: "#22c55e", label: "Pohon" },
    bangunan: { icon: Building, color: "#8b5cf6", label: "Bangunan" },
    layangan: { icon: Wind, color: "#06b6d4", label: "Layangan" },
    balonUdara: { icon: Balloon, color: "#ec4899", label: "Balon Udara" },
    longsor: { icon: MountainSnow, color: "#8d6e4c", label: "Longsor" },
    banjir: { icon: Waves, color: "#14b8a6", label: "Banjir" },
    petir: { icon: Zap, color: "#84cc16", label: "Petir" },
    sosial: { icon: Users, color: "#fb923c", label: "Sosial" },
    pencurian: { icon: Lock, color: "#f43f5e", label: "Pencurian" },
};

const RISK_KEYS = Object.keys(RISK_CONFIG);



/* ── Types ── */
interface TowerRisk {
    name: string;
    lat: number;
    lng: number;
    risks: Record<string, boolean>;
}

interface UseKerawananLayerProps {
    map: React.RefObject<maplibregl.Map | null>;
    mapLoaded: boolean;
    filters: Record<string, boolean>;
    lastActiveKey: string | null;
    allTowers: FullTower[];
}

/* ── Helpers ── */
function srcId(key: string) { return `kwr-src-${key}`; }
function lyrIcons(key: string) { return `kwr-icons-${key}`; }
function lyrCluster(key: string) { return `kwr-cluster-${key}`; }
function lyrCount(key: string) { return `kwr-count-${key}`; }
function imgId(key: string) { return `kwr-${key}`; }

function registerIcon(m: maplibregl.Map, key: string, Icon: LucideIcon, color: string): Promise<void> {
    const id = imgId(key);
    if (m.hasImage(id)) return Promise.resolve();
    return new Promise((resolve) => {
        const svgMarkup = renderToStaticMarkup(
            createElement(Icon, { size: 32, color, strokeWidth: 2.5 })
        );
        const svgDataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup);
        const image = new Image(32, 32);
        image.onload = () => {
            if (!m.hasImage(id)) m.addImage(id, image, { pixelRatio: 1 });
            resolve();
        };
        image.onerror = () => resolve();
        image.src = svgDataUri;
    });
}

/** Build GeoJSON for a single risk key from towers that have that risk */
function buildGeoJSON(towers: TowerRisk[], key: string): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    for (const t of towers) {
        if (!t.risks[key]) continue;
        features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [t.lng, t.lat] },
            properties: { name: t.name, riskKey: key, riskLabel: RISK_CONFIG[key]?.label || key },
        });
    }
    return { type: "FeatureCollection", features };
}

/** Remove all kerawanan layers & sources */
function cleanupAll(m: maplibregl.Map) {
    for (const key of RISK_KEYS) {
        for (const l of [lyrIcons(key), lyrCluster(key), lyrCount(key)]) {
            try { if (m.getLayer(l)) m.removeLayer(l); } catch { /* */ }
        }
        try { if (m.getSource(srcId(key))) m.removeSource(srcId(key)); } catch { /* */ }
    }
    // Also cleanup legacy layer IDs from previous implementation
    const legacy = [
        "kwr-cluster", "kerawanan-icons", "kerawanan-dots", "kerawanan-dots-glow",
        "kwr-cluster-circle", "kwr-cluster-count", "kerawanan-lines", "kerawanan-lines-glow",
    ];
    const legacySources = ["kwr-main-src", "kwr-dots-src", "kwr-lines-src"];
    for (const l of legacy) { try { if (m.getLayer(l)) m.removeLayer(l); } catch { /* */ } }
    for (const s of legacySources) { try { if (m.getSource(s)) m.removeSource(s); } catch { /* */ } }
}

/* ── Main Hook ── */
export function useKerawananLayer({ map, mapLoaded, filters, lastActiveKey, allTowers }: UseKerawananLayerProps) {
    const [towers, setTowers] = useState<TowerRisk[]>([]);
    const [iconsReady, setIconsReady] = useState(false);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const layersCreatedRef = useRef<Set<string>>(new Set());


    // Build tower risk data from shared allTowers prop
    useEffect(() => {
        if (allTowers.length === 0) return;

        const list: TowerRisk[] = allTowers
            .filter(t => t.risks && Object.values(t.risks).some(Boolean))
            .map(t => ({ name: t.name, lat: t.lat, lng: t.lng, risks: t.risks }));
        setTowers(list);
        console.log(`[Kerawanan] ✅ ${list.length} towers with risks (shared data)`);
    }, [allTowers]);

    // Register icon images
    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded) { setIconsReady(false); return; }
        if (m.hasImage("kwr-pohon")) { setIconsReady(true); return; }

        const promises = Object.entries(RISK_CONFIG).map(([key, cfg]) =>
            registerIcon(m, key, cfg.icon, cfg.color)
        );
        Promise.all(promises).then(() => {
            setIconsReady(true);
            console.log("[Kerawanan] ✅ Icons registered");
        });
    }, [map, mapLoaded]);

    // ── Create / update / toggle layers per risk type ──
    useEffect(() => {
        const m = map.current;
        if (!m || !mapLoaded || !iconsReady) return;

        for (const key of RISK_KEYS) {
            const isActive = !!filters[key];
            const cfg = RISK_CONFIG[key];
            const source = m.getSource(srcId(key)) as maplibregl.GeoJSONSource | undefined;

            if (isActive) {
                const geojson = buildGeoJSON(towers, key);

                if (source) {
                    // Source exists → update data
                    source.setData(geojson);
                } else {
                    // First time for this risk → create source + layers
                    m.addSource(srcId(key), {
                        type: "geojson",
                        data: geojson,
                        cluster: true,
                        clusterRadius: 50,
                        clusterMaxZoom: 14,
                    });

                    // Cluster: risk icon + count badge
                    m.addLayer({
                        id: lyrCluster(key),
                        type: "symbol",
                        source: srcId(key),
                        filter: ["has", "point_count"],
                        layout: {
                            "icon-image": imgId(key),
                            "icon-size": [
                                "step", ["get", "point_count"],
                                1.3, 10, 1.6, 25, 2.0,
                            ],
                            "icon-allow-overlap": true,
                            "icon-ignore-placement": true,
                            "icon-anchor": "center",
                            "text-field": ["concat", "×", ["get", "point_count_abbreviated"]],
                            "text-font": ["Noto Sans Bold"],
                            "text-size": 11,
                            "text-anchor": "top",
                            "text-offset": [0, 1.0],
                            "text-allow-overlap": true,
                        },
                        paint: {
                            "text-color": "#ffffff",
                            "text-halo-color": "rgba(0,0,0,0.8)",
                            "text-halo-width": 1.5,
                        },
                    });

                    // Individual icon (unclustered)
                    m.addLayer({
                        id: lyrIcons(key),
                        type: "symbol",
                        source: srcId(key),
                        filter: ["!", ["has", "point_count"]],
                        layout: {
                            "icon-image": imgId(key),
                            "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 0.8, 15, 1.2],
                            "icon-allow-overlap": true,
                            "icon-ignore-placement": true,
                            "icon-anchor": "bottom",
                            "icon-offset": [0, -4],
                        },
                        paint: {
                            "icon-translate": [0, 0],
                        },
                    });

                    // Click cluster → zoom in
                    m.on("click", lyrCluster(key), (e) => {
                        try {
                            const features = m.queryRenderedFeatures(e.point, { layers: [lyrCluster(key)] });
                            if (!features.length) return;
                            const clusterId = features[0].properties?.cluster_id;
                            const src = m.getSource(srcId(key)) as maplibregl.GeoJSONSource;
                            src.getClusterExpansionZoom(clusterId).then((zoom) => {
                                const coords = (features[0].geometry as GeoJSON.Point).coordinates;
                                m.easeTo({ center: coords as [number, number], zoom: zoom + 0.5, duration: 500 });
                            });
                        } catch { /* stale features */ }
                    });

                    // Click icon → popup
                    m.on("click", lyrIcons(key), (e) => {
                        const features = m.queryRenderedFeatures(e.point, { layers: [lyrIcons(key)] });
                        if (!features.length) return;
                        const props = features[0].properties || {};
                        const coords = (features[0].geometry as GeoJSON.Point).coordinates;

                        if (popupRef.current) popupRef.current.remove();
                        popupRef.current = new maplibregl.Popup({ offset: 25, maxWidth: "250px" })
                            .setLngLat(coords as [number, number])
                            .setHTML(`
                                <div style="font-family:sans-serif;font-size:12px;">
                                    <div style="font-weight:bold;margin-bottom:4px;">🗼 ${props.name || "Tower"}</div>
                                    <div style="color:${cfg.color};font-weight:600;">${cfg.label}</div>
                                </div>
                            `)
                            .addTo(m);
                    });

                    // Cursor hover
                    m.on("mouseenter", lyrCluster(key), () => { m.getCanvas().style.cursor = "pointer"; });
                    m.on("mouseleave", lyrCluster(key), () => { m.getCanvas().style.cursor = ""; });
                    m.on("mouseenter", lyrIcons(key), () => { m.getCanvas().style.cursor = "pointer"; });
                    m.on("mouseleave", lyrIcons(key), () => { m.getCanvas().style.cursor = ""; });

                    layersCreatedRef.current.add(key);
                }

                // Ensure layers visible
                const viz = "visible";
                try {
                    if (m.getLayer(lyrIcons(key))) m.setLayoutProperty(lyrIcons(key), "visibility", viz);
                    if (m.getLayer(lyrCluster(key))) m.setLayoutProperty(lyrCluster(key), "visibility", viz);
                    if (m.getLayer(lyrCount(key))) m.setLayoutProperty(lyrCount(key), "visibility", viz);
                } catch { /* */ }

            } else {
                // Filter OFF → hide layers (don't remove, just hide)
                const viz = "none";
                try {
                    if (m.getLayer(lyrIcons(key))) m.setLayoutProperty(lyrIcons(key), "visibility", viz);
                    if (m.getLayer(lyrCluster(key))) m.setLayoutProperty(lyrCluster(key), "visibility", viz);
                    if (m.getLayer(lyrCount(key))) m.setLayoutProperty(lyrCount(key), "visibility", viz);
                } catch { /* */ }
            }
        }

        const activeCount = RISK_KEYS.filter(k => filters[k]).length;
        if (activeCount > 0) {
            const towerCount = towers.filter(t => RISK_KEYS.some(k => filters[k] && t.risks[k])).length;
            console.log(`[Kerawanan] ✅ ${activeCount} filters active, ${towerCount} towers visible`);
        }
    }, [map, mapLoaded, iconsReady, filters, towers]);

    // Float animation removed — was causing severe lag
    // (22 setPaintProperty calls × 60fps = 1,320 updates/sec)

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            const m = map.current;
            if (m) cleanupAll(m);
        };
    }, [map]);

    return null;
}
