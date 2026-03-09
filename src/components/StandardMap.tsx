"use client";
/**
 * StandardMap — Reusable map component (v2)
 * Reference: Thor FE StandardMap.tsx
 *
 * Data Architecture (SSOT):
 *   usePageData("/asset-maps") → 1 HTTP request → 3 sheets
 *   Parsed data distributed to all hooks via props (0 redundant fetches)
 *
 * Layout:
 * - LEFT:   Data layer toggles (petir, tower, risiko, cuaca, saluran)
 * - CENTER: MapLibre GL map
 * - RIGHT:  Map controls (style flyout, zoom, compass, 3D, globe, fullscreen)
 * - BOTTOM: Stats badge
 */

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useMapGL } from "@/hooks/useMapGL";
import { useTowerMarkers } from "@/hooks/useTowerMarkers";
import { useGIMarkers } from "@/hooks/useGIMarkers";
import { useConductorLines } from "@/hooks/useConductorLines";
import { useStrikeMarkers, type StrikeDetails } from "@/hooks/useStrikeMarkers";
import { useStrikeOverlay } from "@/hooks/useStrikeOverlay";
import { useHeatmapLayer } from "@/hooks/useHeatmapLayer";
import { useBBoxLayer } from "@/hooks/useBBoxLayer";
import { useKerawananLayer } from "@/hooks/useKerawananLayer";
import { TowerLegend, StrikeLegend } from "@/components/MapLegend";
import { CameraInfo } from "@/components/CameraInfo";
import StrikeDetailPanel from "@/components/StrikeDetailPanel";
import { Button } from "@/components/ui/button";
import { usePageData } from "@/hooks/usePageData";
import { DataFreshness } from "@/components/DataFreshness";
import type { Tower, GarduInduk, FlashEvent } from "@/types/asset-maps-types";
import { parseRowToTower, parseRowToGI, parseRowToFlashEvent, deduplicateFlashEvents } from "@/types/asset-maps-types";
import {
    ChevronRight, ChevronDown, Plus, Minus, Mountain, Globe, Navigation2, Radar, Flame,
    Maximize2, Minimize2, Zap, AlertTriangle, Cloud,
    ArrowDownToLine, Shovel, TreePine, Building, Wind,
    Balloon, MountainSnow, Waves, Users, Lock
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

/* ── Kerawanan Sub-menu Items ── */
const KERAWANAN_ITEMS: { key: string; label: string; icon: LucideIcon }[] = [
    { key: "andongan", label: "Andongan Rendah", icon: ArrowDownToLine },
    { key: "galian", label: "Galian", icon: Shovel },
    { key: "pohon", label: "Pohon", icon: TreePine },
    { key: "bangunan", label: "Bangunan", icon: Building },
    { key: "layangan", label: "Layangan", icon: Wind },
    { key: "balonUdara", label: "Balon Udara", icon: Balloon },
    { key: "longsor", label: "Longsor", icon: MountainSnow },
    { key: "banjir", label: "Banjir", icon: Waves },
    { key: "petir", label: "Petir", icon: Zap },
    { key: "sosial", label: "Sosial", icon: Users },
    { key: "pencurian", label: "Pencurian", icon: Lock },
];

/* ── Style Options ── */
const STYLE_OPTIONS = [
    { key: "dark", name: "Dark" },
    { key: "light", name: "Light" },
    { key: "satellite", name: "Satellite" },
    { key: "osm", name: "OSM" },
];

interface StandardMapProps {
    className?: string;
    initialStyle?: string;
    appTheme?: string;    // "light" | "dark" — from next-themes resolvedTheme
    children?: React.ReactNode;
}

export function StandardMap({ className = "", initialStyle = "dark", appTheme, children }: StandardMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const userOverrodeStyle = useRef(false);  // track if user manually picked a style

    // Map state
    const [mapStyle, setMapStyle] = useState(initialStyle);
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    const [show3D, setShow3D] = useState(false);
    const [isGlobe, setIsGlobe] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    // Camera state — tracked via refs to avoid re-render storms during animation.
    // Synced to React state via throttled rAF for CameraInfo display.
    const cameraRef = useRef({ bearing: 0, center: { lng: 106.75, lat: -6.59 }, pitch: 0, zoom: 9.5, scale: "10 km" });
    const [cameraState, setCameraState] = useState(cameraRef.current);
    const cameraSyncScheduled = useRef(false);

    // Data layer state — Tower, Saluran, GI always ON
    const [strikesVisible, setStrikesVisible] = useState(false);
    const [heatmapVisible, setHeatmapVisible] = useState(false);
    const [coverageVisible, setCoverageVisible] = useState(false);
    const [expandedMenu, setExpandedMenu] = useState<"vaisala" | "kerawanan" | "cuaca" | null>(null);
    const vaisalaActiveCount = [strikesVisible, heatmapVisible, coverageVisible].filter(Boolean).length;
    const [kerawananFilters, setKerawananFilters] = useState<Record<string, boolean>>(
        Object.fromEntries(KERAWANAN_ITEMS.map(i => [i.key, false]))
    );
    const [lastActiveKey, setLastActiveKey] = useState<string | null>(null);
    const kerawananActiveCount = Object.values(kerawananFilters).filter(Boolean).length;
    const [kerawananHeatmap, setKerawananHeatmap] = useState(false);

    // Strike detail panel state
    const [selectedStrike, setSelectedStrike] = useState<StrikeDetails | null>(null);

    const { map, mapLoaded, mapInstanceId, resetView, enable3D, disable3D, setProjection, STYLES } = useMapGL({ containerRef, mapStyle });

    // ── Data Fetch: index matches dataSources[] order in asset-maps.json ──
    // [0] MASTER ASSET TOWER, [1] 1.DATA PETIR, [2] Asset GI
    const {
        loading: dataLoading, sheets,
    } = usePageData("/asset-maps");

    // Lazy: strike data → only fetch when Vaisala active, server filters to 30 days
    const vaisalaActive = strikesVisible || heatmapVisible;
    const {
        loading: petirDataLoading,
        sheets: petirSheets,
    } = usePageData("/asset-maps", { maxDays: 30, enabled: vaisalaActive });

    // Parse sheets by index — no hardcoded sheet names
    const towers = useMemo<Tower[]>(() => {
        const sheet = sheets[0]; // MASTER ASSET TOWER
        if (!sheet) return [];
        return sheet.rows
            .map((row, i) => parseRowToTower(row, i + 1))
            .filter((t): t is Tower => t !== null);
    }, [sheets]);

    const garduInduk = useMemo<GarduInduk[]>(() => {
        // "Koordinat Gardu Induk" sheet — has Latitude/Longitude columns for GI markers
        const sheet = sheets.find(s => s.sheetName === "Koordinat Gardu Induk") || sheets[4];
        if (!sheet) return [];
        return sheet.rows
            .map((row, i) => parseRowToGI(row, i + 1))
            .filter((g): g is GarduInduk => g !== null);
    }, [sheets]);

    const allStrikes = useMemo<FlashEvent[]>(() => {
        const sheet = petirSheets[1]; // 1.DATA PETIR (with maxDays filter)
        if (!sheet) return [];
        const parsed = sheet.rows
            .map(row => parseRowToFlashEvent(row))
            .filter((e): e is FlashEvent => e !== null);
        return deduplicateFlashEvents(parsed);
    }, [petirSheets]);

    // ── Progressive loading: stagger hooks across frames to prevent jank ──
    const [phase, setPhase] = useState(0);
    const towersReady = towers.length > 0;
    useEffect(() => {
        if (!mapLoaded || !towersReady) { setPhase(0); return; }
        // Phase 1: tower markers (immediate)
        setPhase(1);
        // Phase 2: GI + conductor lines (150ms later)
        const t1 = setTimeout(() => setPhase(2), 150);
        // Phase 3: kerawanan + overlays (350ms later)
        const t2 = setTimeout(() => setPhase(3), 350);
        // Phase 4: strikes + heatmap (550ms later)
        const t3 = setTimeout(() => setPhase(4), 550);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [mapLoaded, towersReady]);

    // ── Loading indicator flag (layers render progressively for smoothness) ──
    const dataReady = !dataLoading && towers.length > 0;

    // Phase 1: Tower markers (immediate — most visible)
    const { towerCount, loading: towersLoading } = useTowerMarkers({
        map, mapLoaded, mapInstanceId, visible: true, towers: phase >= 1 ? towers : [],
    });

    // Phase 2: GI markers + conductor lines
    const { giCount, loading: giLoading } = useGIMarkers({
        map, mapLoaded, mapInstanceId, visible: true, gis: phase >= 2 ? garduInduk : [],
    });

    const { lineCount, loading: linesLoading } = useConductorLines({
        map, mapLoaded, mapInstanceId, visible: true, towers: phase >= 2 ? towers : [],
    });

    // Phase 3: Kerawanan + overlays
    useKerawananLayer({ map, mapLoaded, filters: kerawananFilters, lastActiveKey, allTowers: phase >= 3 ? towers : [], heatmapEnabled: kerawananHeatmap });
    useBBoxLayer({ map, mapLoaded, visible: coverageVisible, towers: phase >= 3 ? towers : [] });
    const { renderOverlay, clearOverlay } = useStrikeOverlay(map, mapLoaded, phase >= 3 ? towers : []);

    // Phase 4: Lightning + heatmap
    const heatmapInfo = useHeatmapLayer({ map, mapLoaded, visible: heatmapVisible, allStrikes: phase >= 4 ? allStrikes : [] });

    const { eventCount, loading: strikesLoading } = useStrikeMarkers({
        map, mapLoaded, mapInstanceId,
        visible: strikesVisible,
        allStrikes: phase >= 4 ? allStrikes : [],
        latestN: 20,
        onStrikeClick: (strike) => {
            setSelectedStrike(strike);
            const ev = { ...strike, closestM: 0, distanceMeters: 0 };
            renderOverlay(ev as FlashEvent);
        },
        onStrikeReset: () => {
            setSelectedStrike(null);
            clearOverlay();
        },
    });

    // ── Layer z-ordering: GI above towers/lines, strike on top ──
    useEffect(() => {
        if (!map.current || !mapLoaded) return;
        const m = map.current;
        // Order (bottom → top): towers/lines → GI → strikes
        const reorder = () => {
            try {
                // GI markers above tower markers and conductor lines
                if (m.getLayer("gi-glow")) m.moveLayer("gi-glow");
                if (m.getLayer("gi-icons")) m.moveLayer("gi-icons");
                if (m.getLayer("gi-labels")) m.moveLayer("gi-labels");
                // Strikes on top of everything
                if (m.getLayer("strike-glow")) m.moveLayer("strike-glow");
                if (m.getLayer("strike-symbols")) m.moveLayer("strike-symbols");
            } catch { /* layers may not exist yet */ }
        };
        reorder();
        const t1 = setTimeout(reorder, 500);
        return () => { clearTimeout(t1); };
    }, [map, mapLoaded, strikesVisible, kerawananFilters]);

    // Track camera state for compass + CameraInfo
    // Uses refs to avoid setState storms during flyTo/easeTo animation frames.
    // Syncs to React state via rAF throttle (~1 React render per browser frame max).
    useEffect(() => {
        if (!map.current || !mapLoaded) return;
        const onMove = () => {
            const m = map.current;
            if (!m) return;
            const c = m.getCenter();
            const zoom = m.getZoom();
            const metersPerPx = 156543.03392 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, zoom);
            const meters = metersPerPx * 100;
            cameraRef.current = {
                bearing: m.getBearing(),
                pitch: m.getPitch(),
                zoom,
                center: { lng: c.lng, lat: c.lat },
                scale: meters >= 1000 ? `${Math.round(meters / 1000)} km` : `${Math.round(meters)} m`,
            };
            if (!cameraSyncScheduled.current) {
                cameraSyncScheduled.current = true;
                requestAnimationFrame(() => {
                    cameraSyncScheduled.current = false;
                    setCameraState({ ...cameraRef.current });
                });
            }
        };
        map.current.on("move", onMove);
        return () => { map.current?.off("move", onMove); };
    }, [map, mapLoaded]);

    // Fullscreen listener
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    /* ── Control Handlers ── */
    const handleZoomIn = useCallback(() => map.current?.zoomIn({ duration: 300 }), [map]);
    const handleZoomOut = useCallback(() => map.current?.zoomOut({ duration: 300 }), [map]);
    const handleReset = useCallback(() => resetView(), [resetView]);
    const handleToggle3D = useCallback(() => {
        setShow3D(prev => {
            const next = !prev;
            if (next) {
                // Globe + terrain conflict
                if (isGlobe) {
                    setIsGlobe(false);
                    setProjection("mercator");
                }
                enable3D();
            } else {
                disable3D();
            }
            return next;
        });
    }, [isGlobe, enable3D, disable3D, setProjection]);

    const handleToggleGlobe = useCallback(() => {
        setIsGlobe(prev => {
            const next = !prev;
            if (next) {
                // Globe + terrain conflict
                if (show3D) {
                    setShow3D(false);
                    disable3D();
                }
                setProjection("globe");
            } else {
                setProjection("mercator");
            }
            return next;
        });
    }, [show3D, disable3D, setProjection]);
    const handleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) wrapperRef.current?.requestFullscreen();
        else document.exitFullscreen();
    }, []);
    const handleStyleChange = useCallback((key: string) => {
        userOverrodeStyle.current = true;  // user manually picked a style
        setMapStyle(key);
        setShowStyleMenu(false);
        setShow3D(false);   // Terrain lost on style change
        setIsGlobe(false);  // Globe lost on style change
    }, []);

    // Auto-sync map style when app theme toggles (unless user manually overrode)
    useEffect(() => {
        if (!appTheme) return;
        const target = appTheme === "light" ? "light" : "dark";
        // Only auto-switch between dark/light (not satellite/osm user choices)
        setMapStyle(prev => {
            if (prev === "satellite" || prev === "osm") return prev; // keep user choice
            if (prev === target) return prev;  // already correct
            userOverrodeStyle.current = false; // reset override flag
            return target;
        });
    }, [appTheme]);
    const toggleKerawanan = useCallback((key: string) => {
        setKerawananFilters(prev => {
            const next = { ...prev, [key]: !prev[key] };
            // Track last active key for dot color
            if (next[key]) {
                setLastActiveKey(key);
            } else {
                // If unchecked, set lastActiveKey to the last remaining active key
                const remaining = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
                setLastActiveKey(remaining.length > 0 ? remaining[remaining.length - 1] : null);
            }
            return next;
        });
    }, []);

    /* ── Adaptive theme ── */
    const isLight = mapStyle === "light" || mapStyle === "osm";
    const cardBg = isLight ? "bg-white/70" : "bg-black/60";
    const cardBorder = isLight ? "border-black/20" : "border-white/20";
    const btnText = isLight ? "text-gray-600" : "text-zinc-400";
    const sepBg = isLight ? "bg-black/10" : "bg-white/10";

    return (
        <div ref={wrapperRef} className={`relative w-full h-full rounded-xl overflow-hidden border ${isLight ? "border-black/10" : "border-white/10"} ${className}`}>
            {/* Map Container */}
            <div ref={containerRef} className="absolute inset-0 h-full w-full" />

            {/* Loading — map not yet loaded */}
            {!mapLoaded && (
                <div className={`absolute inset-0 flex items-center justify-center z-10 ${isLight ? "bg-white/80" : "bg-zinc-900/80"}`}>
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className={`text-xs ${isLight ? "text-gray-500" : "text-zinc-400"}`}>Loading map...</span>
                    </div>
                </div>
            )}

            {/* Data loading bar — map visible, data still fetching */}
            {mapLoaded && !dataReady && (
                <div className="absolute top-0 left-0 right-0 z-30 h-1 overflow-hidden rounded-t-xl">
                    <div className="h-full bg-amber-400/80 animate-pulse" style={{
                        animation: "dataLoadBar 1.5s ease-in-out infinite",
                    }} />
                    <style>{`
                        @keyframes dataLoadBar {
                            0% { width: 0%; margin-left: 0; }
                            50% { width: 60%; margin-left: 20%; }
                            100% { width: 0%; margin-left: 100%; }
                        }
                    `}</style>
                </div>
            )}

            {/* ═══════ TOP LEFT: Title + Data Layers ═══════ */}
            {mapLoaded && (
                <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
                    {/* Title badge */}
                    <div className={`backdrop-blur-md rounded-lg px-3 py-1.5 border ${cardBg} ${cardBorder}`}>
                        <h1 className={`text-sm font-bold ${isLight ? "text-gray-800" : "text-white"}`}>Wilayah Kerja UPT Bogor</h1>
                        <p className={`text-[9px] ${btnText}`}>Asset Visualisation</p>
                    </div>

                    {/* ── Overlay Buttons ── */}
                    <div className={`backdrop-blur-md rounded-lg border overflow-hidden ${cardBg} ${cardBorder}`}>
                        {/* Vaisala Strike Expandable */}
                        <button
                            onClick={() => setExpandedMenu(prev => prev === "vaisala" ? null : "vaisala")}
                            className={`flex items-center gap-2 w-full px-2.5 py-1.5 transition-all duration-200
                                ${vaisalaActiveCount > 0
                                    ? `bg-amber-500/30 ${isLight ? "text-amber-700" : "text-amber-300"}`
                                    : `${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                }`}
                        >
                            <Zap className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold flex-1 text-left">
                                Vaisala Strike{vaisalaActiveCount > 0 ? ` (${vaisalaActiveCount})` : ""}
                            </span>
                            {expandedMenu === "vaisala"
                                ? <ChevronDown className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />
                            }
                        </button>

                        {/* Vaisala Sub-menu */}
                        <div className={`transition-all duration-300 overflow-hidden
                            ${expandedMenu === "vaisala" ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"}`}>
                            <div className={`px-1.5 py-1 space-y-0.5 border-t ${cardBorder}`}>
                                {/* Strike Point */}
                                <button
                                    onClick={() => setStrikesVisible(prev => !prev)}
                                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-left transition-colors duration-150
                                        ${strikesVisible
                                            ? `bg-amber-500/20 ${isLight ? "text-amber-700" : "text-amber-300"}`
                                            : `${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                        }`}
                                >
                                    <Zap className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-[10px] flex-1">Strike Point</span>
                                    <span className={`text-[8px] w-3 h-3 rounded border flex items-center justify-center
                                        ${strikesVisible
                                            ? "bg-amber-500 border-amber-500 text-white"
                                            : isLight ? "border-black/30" : "border-white/30"
                                        }`}>
                                        {strikesVisible ? "✓" : ""}
                                    </span>
                                </button>
                                {/* Heatmap Strike */}
                                <button
                                    onClick={() => setHeatmapVisible(prev => !prev)}
                                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-left transition-colors duration-150
                                         ${heatmapVisible
                                            ? `bg-amber-500/20 ${isLight ? "text-amber-700" : "text-amber-300"}`
                                            : `${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                        }`}
                                >
                                    <Flame className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-[10px] flex-1">Heatmap Strike</span>
                                    <span className={`text-[8px] w-3 h-3 rounded border flex items-center justify-center
                                        ${heatmapVisible
                                            ? "bg-amber-500 border-amber-500 text-white"
                                            : isLight ? "border-black/30" : "border-white/30"
                                        }`}>
                                        {heatmapVisible ? "✓" : ""}
                                    </span>
                                </button>
                                {/* Coverage Area */}
                                <button
                                    onClick={() => setCoverageVisible(prev => !prev)}
                                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-left transition-colors duration-150
                                         ${coverageVisible
                                            ? `bg-amber-500/20 ${isLight ? "text-amber-700" : "text-amber-300"}`
                                            : `${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                        }`}
                                >
                                    <Radar className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-[10px] flex-1">Coverage Area</span>
                                    <span className={`text-[8px] w-3 h-3 rounded border flex items-center justify-center
                                        ${coverageVisible
                                            ? "bg-amber-500 border-amber-500 text-white"
                                            : isLight ? "border-black/30" : "border-white/30"
                                        }`}>
                                        {coverageVisible ? "✓" : ""}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className={`h-px ${sepBg}`} />

                        {/* Kerawanan Expandable */}
                        <button
                            onClick={() => setExpandedMenu(prev => prev === "kerawanan" ? null : "kerawanan")}
                            className={`flex items-center gap-2 w-full px-2.5 py-1.5 transition-all duration-200
                                ${kerawananActiveCount > 0
                                    ? `bg-red-500/30 ${isLight ? "text-red-700" : "text-red-300"}`
                                    : `${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                }`}
                        >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold flex-1 text-left">
                                Kerawanan{kerawananActiveCount > 0 ? ` (${kerawananActiveCount})` : ""}
                            </span>
                            {expandedMenu === "kerawanan"
                                ? <ChevronDown className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />
                            }
                        </button>

                        {/* Kerawanan Sub-menu */}
                        <div className={`transition-all duration-300 overflow-hidden
                            ${expandedMenu === "kerawanan" ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
                            <div className={`px-1.5 py-1 space-y-0.5 border-t ${cardBorder}`}>
                                {/* Heatmap Toggle */}
                                <button
                                    onClick={() => setKerawananHeatmap(prev => !prev)}
                                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-left transition-colors duration-150
                                        ${kerawananHeatmap
                                            ? `bg-red-500/20 ${isLight ? "text-red-700" : "text-red-300"}`
                                            : `${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                        }`}
                                >
                                    <Flame className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-[10px] flex-1">Heatmap</span>
                                    <span className={`text-[8px] w-3 h-3 rounded border flex items-center justify-center
                                        ${kerawananHeatmap
                                            ? "bg-red-500 border-red-500 text-white"
                                            : isLight ? "border-black/30" : "border-white/30"
                                        }`}>
                                        {kerawananHeatmap ? "✓" : ""}
                                    </span>
                                </button>
                                <div className={`h-px my-1 ${sepBg}`} />
                                {KERAWANAN_ITEMS.map(item => (
                                    <button
                                        key={item.key}
                                        onClick={() => toggleKerawanan(item.key)}
                                        className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-left transition-colors duration-150
                                            ${kerawananFilters[item.key]
                                                ? `bg-red-500/20 ${isLight ? "text-red-700" : "text-red-300"}`
                                                : `${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                            }`}
                                    >
                                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                                        <span className="text-[10px] flex-1">{item.label}</span>
                                        <span className={`text-[8px] w-3 h-3 rounded border flex items-center justify-center
                                            ${kerawananFilters[item.key]
                                                ? "bg-red-500 border-red-500 text-white"
                                                : isLight ? "border-black/30" : "border-white/30"
                                            }`}>
                                            {kerawananFilters[item.key] ? "✓" : ""}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={`h-px ${sepBg}`} />

                        {/* Cuaca Expandable */}
                        <button
                            onClick={() => setExpandedMenu(prev => prev === "cuaca" ? null : "cuaca")}
                            className={`flex items-center gap-2 w-full px-2.5 py-1.5 transition-all duration-200
                                ${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`}
                        >
                            <Cloud className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold flex-1 text-left">Weather Tower</span>
                            {expandedMenu === "cuaca"
                                ? <ChevronDown className="h-3 w-3" />
                                : <ChevronRight className="h-3 w-3" />
                            }
                        </button>

                        {/* Cuaca Sub-menu (placeholder) */}
                        <div className={`transition-all duration-300 overflow-hidden
                            ${expandedMenu === "cuaca" ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"}`}>
                            <div className={`px-3 py-2 border-t ${cardBorder}`}>
                                <p className={`text-[9px] italic ${isLight ? "text-gray-400" : "text-zinc-500"}`}>Coming soon...</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ TOP RIGHT: DataFreshness + Map Controls ═══════ */}
            {mapLoaded && (
                <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
                    {/* DataFreshness — consistent with all other pages */}
                    <DataFreshness />

                    <div className="flex items-start gap-1">
                        {/* Style Flyout (appears left of main stack) */}
                        <div className={`flex flex-col gap-0.5 transition-all duration-300 ${showStyleMenu ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0 overflow-hidden"}`}>
                            {STYLE_OPTIONS.map(style => (
                                <button
                                    key={style.key}
                                    onClick={() => handleStyleChange(style.key)}
                                    className={`px-2.5 py-1 rounded-md border backdrop-blur-md text-[10px] font-bold whitespace-nowrap transition-colors
                  ${mapStyle === style.key
                                            ? "bg-amber-500 text-black border-amber-500"
                                            : `${cardBg} ${cardBorder} ${btnText} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`
                                        }`}
                                >
                                    {style.name}
                                </button>
                            ))}
                        </div>

                        {/* Main Control Stack */}
                        <div className={`flex flex-col backdrop-blur-md border rounded-lg overflow-hidden ${cardBg} ${cardBorder}`}>
                            {/* Style Menu Toggle */}
                            <ControlBtn onClick={() => setShowStyleMenu(!showStyleMenu)} active={showStyleMenu} btnText={btnText} title="Map Style">
                                <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${showStyleMenu ? "rotate-180" : ""}`} />
                            </ControlBtn>

                            <div className={`h-px ${sepBg}`} />

                            {/* Zoom */}
                            <ControlBtn onClick={handleZoomIn} btnText={btnText} title="Zoom In">
                                <Plus className="h-4 w-4" />
                            </ControlBtn>
                            <ControlBtn onClick={handleZoomOut} btnText={btnText} title="Zoom Out">
                                <Minus className="h-4 w-4" />
                            </ControlBtn>

                            <div className={`h-px ${sepBg}`} />

                            {/* Compass */}
                            <ControlBtn onClick={handleReset} btnText={btnText} title="Reset View">
                                <Navigation2 className="h-4 w-4" style={{ transform: `rotate(${-cameraState.bearing}deg)`, transition: "transform 0.3s ease-out" }} />
                            </ControlBtn>

                            {/* 3D Terrain */}
                            <ControlBtn onClick={handleToggle3D} active={show3D} activeClass="bg-green-500/80 text-white" btnText={btnText} title="3D Terrain">
                                <Mountain className="h-4 w-4" />
                            </ControlBtn>

                            {/* Globe */}
                            <ControlBtn onClick={handleToggleGlobe} active={isGlobe} activeClass="bg-blue-500/80 text-white" btnText={btnText} title="Globe View">
                                <Globe className="h-4 w-4" />
                            </ControlBtn>

                            <div className={`h-px ${sepBg}`} />

                            {/* Fullscreen */}
                            <ControlBtn onClick={handleFullscreen} active={isFullscreen} activeClass="bg-cyan-500/80 text-white" btnText={btnText} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </ControlBtn>

                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ TOP CENTER: Heatmap Info Badge ═══════ */}
            {mapLoaded && heatmapVisible && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                    <div className={`backdrop-blur-md border border-amber-500/30 rounded-lg px-4 py-2 text-center shadow-lg shadow-amber-500/10 ${isLight ? "bg-white/70" : "bg-black/50"}`}>
                        <div className="flex items-center gap-2 justify-center">
                            <Flame className="h-4 w-4 text-amber-400" />
                            <span className={`text-xs font-bold ${isLight ? "text-amber-700" : "text-amber-300"}`}>Heatmap Strike</span>
                        </div>
                        {heatmapInfo.loading ? (
                            <div className="flex items-center gap-1.5 mt-1 justify-center">
                                <div className="h-2.5 w-2.5 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                                <span className={`text-[10px] ${isLight ? "text-gray-500" : "text-zinc-400"}`}>Loading 90 days data...</span>
                            </div>
                        ) : heatmapInfo.dateFrom ? (
                            <p className={`text-[10px] mt-0.5 ${isLight ? "text-gray-600" : "text-zinc-300"}`}>
                                {new Date(heatmapInfo.dateFrom).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                                {" — "}
                                {new Date(heatmapInfo.dateTo!).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                                <span className={`ml-1 ${isLight ? "text-gray-400" : "text-zinc-500"}`}>({heatmapInfo.eventCount.toLocaleString("id-ID")} events)</span>
                            </p>
                        ) : null}
                    </div>
                </div>
            )}


            {/* ═══════ BOTTOM RIGHT: Legend + CameraInfo ═══════ */}
            {mapLoaded && (
                <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1 items-end">
                    <TowerLegend mapStyle={mapStyle} />
                    {strikesVisible && <StrikeLegend mapStyle={mapStyle} />}
                    <CameraInfo
                        center={cameraState.center}
                        zoom={cameraState.zoom}
                        pitch={cameraState.pitch}
                        bearing={cameraState.bearing}
                        show3D={show3D}
                        mapStyle={mapStyle}
                        scale={cameraState.scale}
                    />
                </div>
            )}

            {/* ── StrikeDetailPanel — floating bottom-left ── */}
            {selectedStrike && (
                <StrikeDetailPanel
                    strike={selectedStrike}
                    onClose={() => setSelectedStrike(null)}
                    towers={towers}
                />
            )}

            {/* Children (marker hooks etc) */}
            {children}
        </div>
    );
}

/* ── Control Button (shared style) ── */
function ControlBtn({
    onClick, children, active = false, activeClass = "bg-amber-500/80 text-black",
    btnText = "text-zinc-400", title = ""
}: {
    onClick: () => void; children: React.ReactNode; active?: boolean;
    activeClass?: string; btnText?: string; title?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center w-8 h-8 transition-colors ${active ? activeClass : `${btnText} hover:opacity-80`}`}
            title={title}
        >
            {children}
        </button>
    );
}
