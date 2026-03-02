"use client";
/**
 * useStrikeOverlay — Thor V3-style strike visualization overlay
 *
 * Renders on map when a strike is selected:
 * 1. Three concentric ellipses (1σ inner, 2σ middle, 3σ outer)
 * 2. Dashed orange line from strike → nearest tower + distance label
 * 3. Dashed cyan line from strike → nearest point on conductor line + label
 */

import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { FlashEvent } from "@/types/asset-maps-types";
import type { Tower as FullTower } from "@/types/asset-maps-types";
import turfEllipse from "@turf/ellipse";
import { point as turfPoint, featureCollection, lineString } from "@turf/helpers";
import distance from "@turf/distance";
import nearestPointOnLine from "@turf/nearest-point-on-line";

// ── Layer IDs ──
const PREFIX = "strike-overlay-";
const ELLIPSE_INNER_FILL = `${PREFIX}ell-inner-fill`;
const ELLIPSE_INNER_LINE = `${PREFIX}ell-inner-line`;
const ELLIPSE_MID_FILL = `${PREFIX}ell-mid-fill`;
const ELLIPSE_MID_LINE = `${PREFIX}ell-mid-line`;
const ELLIPSE_OUTER_FILL = `${PREFIX}ell-outer-fill`;
const ELLIPSE_OUTER_LINE = `${PREFIX}ell-outer-line`;
const TOWER_LINE_LAYER = `${PREFIX}tower-line`;
const TOWER_LABEL_LAYER = `${PREFIX}tower-label`;
const CONDUCTOR_LINE_LAYER = `${PREFIX}conductor-line`;
const CONDUCTOR_LABEL_LAYER = `${PREFIX}conductor-label`;
const STRIKE_DOT_LAYER = `${PREFIX}strike-dot`;

const SRC_ELLIPSES = `${PREFIX}src-ellipses`;
const SRC_TOWER_LINE = `${PREFIX}src-tower-line`;
const SRC_COND_LINE = `${PREFIX}src-cond-line`;
const SRC_STRIKE_DOT = `${PREFIX}src-strike-dot`;


// Colors matching Thor V3
const COLOR_INNER = "#f59e0b"; // amber/yellow
const COLOR_MID = "#f97316"; // orange
const COLOR_OUTER = "#ef4444"; // red/pink
const COLOR_TOWER_LINE = "#f97316"; // orange dashed
const COLOR_COND_LINE = "#22d3ee"; // cyan dashed

const ALL_LAYERS = [
    STRIKE_DOT_LAYER,
    CONDUCTOR_LABEL_LAYER, CONDUCTOR_LINE_LAYER,
    TOWER_LABEL_LAYER, TOWER_LINE_LAYER,
    ELLIPSE_OUTER_LINE, ELLIPSE_OUTER_FILL,
    ELLIPSE_MID_LINE, ELLIPSE_MID_FILL,
    ELLIPSE_INNER_LINE, ELLIPSE_INNER_FILL,
];
const ALL_SOURCES = [SRC_STRIKE_DOT, SRC_COND_LINE, SRC_TOWER_LINE, SRC_ELLIPSES];

interface Tower { name: string; penghantar: string; garduInduk: string; ultg: string; lat: number; lng: number; }

export function useStrikeOverlay(map: React.RefObject<maplibregl.Map | null>, mapLoaded: boolean, allTowers: FullTower[]) {
    const towersRef = useRef<Tower[]>([]);
    const linesRef = useRef<GeoJSON.Feature[]>([]);
    const towerPopupRef = useRef<maplibregl.Popup | null>(null);
    const strikePopupRef = useRef<maplibregl.Popup | null>(null);

    // Build tower + line data from shared allTowers prop
    useEffect(() => {
        if (!mapLoaded || allTowers.length === 0) return;

        const ts: Tower[] = allTowers.map(t => ({
            name: t.name,
            penghantar: t.penghantar,
            garduInduk: t.garduInduk,
            ultg: t.ultg,
            lat: t.lat,
            lng: t.lng,
        }));
        towersRef.current = ts;

        // Build line features
        const getSeq = (name: string) => {
            const m = name.match(/#(\d+)[A-Za-z]*\s*$/);
            return m ? parseInt(m[1]) : 0;
        };
        const groups: Record<string, Tower[]> = {};
        for (const t of ts) {
            const prefix = t.name.replace(/\s*#[\dA-Za-z]+\s*$/, "").trim();
            if (!prefix) continue;
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(t);
        }
        const features: GeoJSON.Feature[] = [];
        for (const towerList of Object.values(groups)) {
            if (towerList.length < 2) continue;
            const sorted = [...towerList].sort((a, b) => getSeq(a.name) - getSeq(b.name));
            features.push(lineString(sorted.map(t => [t.lng, t.lat])));
        }
        linesRef.current = features;
        console.log(`[StrikeOverlay] ✅ ${ts.length} towers, ${features.length} lines from shared data`);
    }, [mapLoaded, allTowers]);

    // ── Clear all overlay layers + popups ──
    const clearOverlay = useCallback((m: maplibregl.Map) => {
        for (const id of ALL_LAYERS) {
            try { if (m.getLayer(id)) m.removeLayer(id); } catch { /* noop */ }
        }
        for (const id of ALL_SOURCES) {
            try { if (m.getSource(id)) m.removeSource(id); } catch { /* noop */ }
        }
        towerPopupRef.current?.remove();
        towerPopupRef.current = null;
        strikePopupRef.current?.remove();
        strikePopupRef.current = null;
    }, []);

    // ── Render full overlay ──
    const renderOverlay = useCallback((ev: FlashEvent) => {
        const m = map.current;
        if (!m) return;

        clearOverlay(m);

        const strikePt = turfPoint([ev.strikeLng, ev.strikeLat]);
        const semiMajor = ev.ellSemiMajor || 300; // meters
        const semiMinor = ev.ellSemiMinor || 150;
        const angle = ev.ellAngle || 0;

        // ═══════════════════════════════════════
        // 1. THREE CONCENTRIC ELLIPSES
        // ═══════════════════════════════════════
        const scales = [1.0, 1.8, 3.0]; // 1σ, ~2σ, ~3σ
        const ellipseFeatures: GeoJSON.Feature[] = [];

        for (const scale of scales) {
            const ell = turfEllipse(
                strikePt,
                (semiMajor * scale) / 1000,
                (semiMinor * scale) / 1000,
                { angle, steps: 64, units: "kilometers" }
            );
            ell.properties = { ring: scale };
            ellipseFeatures.push(ell);
        }

        m.addSource(SRC_ELLIPSES, {
            type: "geojson",
            data: featureCollection(ellipseFeatures),
        });

        // Inner ring (amber yellow)
        m.addLayer({
            id: ELLIPSE_INNER_FILL, type: "fill", source: SRC_ELLIPSES,
            filter: ["==", ["get", "ring"], 1.0],
            paint: { "fill-color": COLOR_INNER, "fill-opacity": 0.3 },
        });
        m.addLayer({
            id: ELLIPSE_INNER_LINE, type: "line", source: SRC_ELLIPSES,
            filter: ["==", ["get", "ring"], 1.0],
            paint: { "line-color": COLOR_INNER, "line-width": 2, "line-opacity": 0.9 },
        });

        // Middle ring (orange)
        m.addLayer({
            id: ELLIPSE_MID_FILL, type: "fill", source: SRC_ELLIPSES,
            filter: ["==", ["get", "ring"], 1.8],
            paint: { "fill-color": COLOR_MID, "fill-opacity": 0.15 },
        });
        m.addLayer({
            id: ELLIPSE_MID_LINE, type: "line", source: SRC_ELLIPSES,
            filter: ["==", ["get", "ring"], 1.8],
            paint: { "line-color": COLOR_MID, "line-width": 1.5, "line-opacity": 0.7 },
        });

        // Outer ring (red/pink)
        m.addLayer({
            id: ELLIPSE_OUTER_FILL, type: "fill", source: SRC_ELLIPSES,
            filter: ["==", ["get", "ring"], 3.0],
            paint: { "fill-color": COLOR_OUTER, "fill-opacity": 0.08 },
        });
        m.addLayer({
            id: ELLIPSE_OUTER_LINE, type: "line", source: SRC_ELLIPSES,
            filter: ["==", ["get", "ring"], 3.0],
            paint: { "line-color": COLOR_OUTER, "line-width": 1, "line-opacity": 0.5 },
        });

        // ═══════════════════════════════════════
        // 2. STRIKE CENTER DOT (orange glow)
        // ═══════════════════════════════════════
        m.addSource(SRC_STRIKE_DOT, {
            type: "geojson",
            data: strikePt,
        });
        m.addLayer({
            id: STRIKE_DOT_LAYER, type: "circle", source: SRC_STRIKE_DOT,
            paint: {
                "circle-radius": 6,
                "circle-color": COLOR_INNER,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
                "circle-blur": 0.1,
            },
        });

        // ═══════════════════════════════════════
        // 3. DASHED LINE TO NEAREST TOWER (orange)
        // ═══════════════════════════════════════
        if (towersRef.current.length > 0) {
            let minDist = Infinity;
            let nearestTower: Tower | null = null;

            for (const t of towersRef.current) {
                const d = distance(strikePt, turfPoint([t.lng, t.lat]), { units: "meters" });
                if (d < minDist) {
                    minDist = d;
                    nearestTower = t;
                }
            }

            if (nearestTower && minDist < 50000) { // within 50km
                const distLabel = minDist >= 1000
                    ? `~ ${(minDist / 1000).toFixed(1)}km`
                    : `~ ${Math.round(minDist)}m`;

                const towerLine = lineString(
                    [[ev.strikeLng, ev.strikeLat], [nearestTower.lng, nearestTower.lat]],
                    { label: distLabel }
                );

                // Midpoint for label
                const midLng = (ev.strikeLng + nearestTower.lng) / 2;
                const midLat = (ev.strikeLat + nearestTower.lat) / 2;
                const labelPt = turfPoint([midLng, midLat], { label: distLabel });

                m.addSource(SRC_TOWER_LINE, {
                    type: "geojson",
                    data: featureCollection([towerLine, labelPt] as GeoJSON.Feature[]),
                });

                m.addLayer({
                    id: TOWER_LINE_LAYER, type: "line", source: SRC_TOWER_LINE,
                    filter: ["==", "$type", "LineString"],
                    paint: {
                        "line-color": COLOR_TOWER_LINE,
                        "line-width": 2,
                        "line-opacity": 0.85,
                        "line-dasharray": [6, 4],
                    },
                });
                m.addLayer({
                    id: TOWER_LABEL_LAYER, type: "symbol", source: SRC_TOWER_LINE,
                    filter: ["==", "$type", "Point"],
                    layout: {
                        "text-field": ["get", "label"],
                        "text-size": 12,
                        "text-font": ["Open Sans Bold"],
                        "text-offset": [0, -1],
                        "text-allow-overlap": true,
                    },
                    paint: {
                        "text-color": COLOR_TOWER_LINE,
                        "text-halo-color": "rgba(0,0,0,0.8)",
                        "text-halo-width": 2,
                    },
                });
            }
        }

        // ═══════════════════════════════════════
        // 4. DASHED LINE TO NEAREST CONDUCTOR LINE (cyan)
        // ═══════════════════════════════════════
        if (linesRef.current.length > 0) {
            let minDist = Infinity;
            let closestPt: [number, number] | null = null;

            for (const feature of linesRef.current) {
                try {
                    const nearest = nearestPointOnLine(feature as GeoJSON.Feature<GeoJSON.LineString>, strikePt, { units: "meters" });
                    const d = nearest.properties.dist ?? Infinity;
                    if (d < minDist) {
                        minDist = d;
                        const coords = nearest.geometry.coordinates;
                        closestPt = [coords[0], coords[1]];
                    }
                } catch { /* skip invalid geometries */ }
            }

            if (closestPt && minDist < 50000) {
                const distLabel = minDist >= 1000
                    ? `~ ${(minDist / 1000).toFixed(1)}km`
                    : `~ ${Math.round(minDist)}m`;

                const condLine = lineString(
                    [[ev.strikeLng, ev.strikeLat], closestPt],
                    { label: distLabel }
                );

                const midLng = (ev.strikeLng + closestPt[0]) / 2;
                const midLat = (ev.strikeLat + closestPt[1]) / 2;
                const labelPt = turfPoint([midLng, midLat], { label: distLabel });

                m.addSource(SRC_COND_LINE, {
                    type: "geojson",
                    data: featureCollection([condLine, labelPt] as GeoJSON.Feature[]),
                });

                m.addLayer({
                    id: CONDUCTOR_LINE_LAYER, type: "line", source: SRC_COND_LINE,
                    filter: ["==", "$type", "LineString"],
                    paint: {
                        "line-color": COLOR_COND_LINE,
                        "line-width": 2,
                        "line-opacity": 0.85,
                        "line-dasharray": [6, 4],
                    },
                });
                m.addLayer({
                    id: CONDUCTOR_LABEL_LAYER, type: "symbol", source: SRC_COND_LINE,
                    filter: ["==", "$type", "Point"],
                    layout: {
                        "text-field": ["get", "label"],
                        "text-size": 12,
                        "text-font": ["Open Sans Bold"],
                        "text-offset": [0, -1],
                        "text-allow-overlap": true,
                    },
                    paint: {
                        "text-color": COLOR_COND_LINE,
                        "text-halo-color": "rgba(0,0,0,0.8)",
                        "text-halo-width": 2,
                    },
                });
            }
        }

        // ═══════════════════════════════════════
        // 5. POPUP: STRIKE POINT
        // ═══════════════════════════════════════
        strikePopupRef.current?.remove();
        const strikeTime = ev.eventTime
            ? new Date(ev.eventTime).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "-";
        strikePopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: [0, -15],
            className: "strike-popup",
        })
            .setLngLat([ev.strikeLng, ev.strikeLat])
            .setHTML(`
                <div style="font-family:system-ui;font-size:11px;line-height:1.5;max-width:200px;">
                    <div style="font-weight:700;font-size:12px;color:#f59e0b;margin-bottom:3px;">⚡ Strike Point</div>
                    <div style="color:#94a3b8;">
                        <b>Current:</b> ${ev.currentKa ?? "-"} kA<br/>
                        <b>Type:</b> ${ev.strokeCount > 1 ? `Multi ×${ev.strokeCount}` : "Single"}<br/>
                        <b>Ellipse:</b> ${ev.ellSemiMajor ?? "-"}m × ${ev.ellSemiMinor ?? "-"}m<br/>
                        <div style="margin-top:3px;color:#64748b;font-size:10px;">${strikeTime}</div>
                    </div>
                </div>
            `)
            .addTo(m);

        // ═══════════════════════════════════════
        // 6. POPUP: NEAREST TOWER
        // ═══════════════════════════════════════
        if (towersRef.current.length > 0) {
            let minD = Infinity;
            let nearest: Tower | null = null;
            for (const t of towersRef.current) {
                const d = distance(strikePt, turfPoint([t.lng, t.lat]), { units: "meters" });
                if (d < minD) { minD = d; nearest = t; }
            }
            if (nearest && minD < 50000) {
                const distStr = minD >= 1000
                    ? `${(minD / 1000).toFixed(2)} km`
                    : `${Math.round(minD)} m`;
                towerPopupRef.current?.remove();
                towerPopupRef.current = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    offset: [0, -10],
                    className: "tower-popup",
                })
                    .setLngLat([nearest.lng, nearest.lat])
                    .setHTML(`
                        <div style="font-family:system-ui;font-size:11px;line-height:1.5;max-width:220px;">
                            <div style="font-weight:700;font-size:12px;color:#22d3ee;margin-bottom:3px;">🗼 ${nearest.name}</div>
                            <div style="color:#94a3b8;">
                                <b>Penghantar:</b> ${nearest.penghantar}<br/>
                                <b>GI:</b> ${nearest.garduInduk}<br/>
                                <b>ULTG:</b> ${nearest.ultg}<br/>
                                <b>Jarak ke strike:</b> <span style="color:#f97316;font-weight:600;">${distStr}</span>
                            </div>
                        </div>
                    `)
                    .addTo(m);
            }
        }

        console.log(`[StrikeOverlay] ✅ rendered for [${ev.strikeLng}, ${ev.strikeLat}]`);
    }, [map, clearOverlay]);

    return {
        renderOverlay, clearOverlay: () => {
            const m = map.current;
            if (m) clearOverlay(m);
        }
    };
}
