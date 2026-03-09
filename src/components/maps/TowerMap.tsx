"use client";

import { useState, useMemo, useEffect } from "react";
import Map, { Marker, Popup, NavigationControl, FullscreenControl, ScaleControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
    AlertTriangle, MapPin, Zap, Flame, Home, Tractor,
    Mountain, Droplets, Scissors, Skull, Send, PawPrint
} from "lucide-react";

// Use Carto Dark Matter as the base map style
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Custom SVG Icons natively crafted to match precise user expectations
const KiteIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2L5 10l7 12 7-12L12 2z" />
        <path d="M5 10h14" />
        <path d="M12 2v20" />
    </svg>
);

const ExcavatorIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 15h7v3H3z" />
        <circle cx="5" cy="16.5" r="0.5" />
        <circle cx="8" cy="16.5" r="0.5" />
        <path d="M4 15v-4h4v4" />
        <path d="M8 13l4-3 6 2-2 3" />
        <path d="M18 15h-2v2c1 0 2-1 2-2z" />
    </svg>
);

function getKerawananIcon(kerawananList: string[], sizeClass = "w-3 h-3") {
    if (kerawananList.includes("PETIR")) return <Zap className={`${sizeClass} text-yellow-400`} fill="currentColor" />;
    if (kerawananList.includes("LONGSOR")) return <Mountain className={`${sizeClass} text-orange-600`} fill="currentColor" />;
    if (kerawananList.includes("BANJIR")) return <Droplets className={`${sizeClass} text-blue-500`} fill="currentColor" />;
    if (kerawananList.includes("PENCURIAN")) return <Scissors className={`${sizeClass} text-purple-500`} />;
    if (kerawananList.includes("GALIAN")) return <ExcavatorIcon className={`${sizeClass} text-amber-600`} />;
    if (kerawananList.includes("ANDONGAN RENDAH")) return <Home className={`${sizeClass} text-rose-400`} fill="currentColor" />;
    if (kerawananList.includes("LAYANGAN")) return <KiteIcon className={`${sizeClass} text-sky-400`} fill="currentColor" />;
    if (kerawananList.includes("KOROSIF")) return <Skull className={`${sizeClass} text-green-400`} fill="currentColor" />;
    if (kerawananList.includes("BINATANG")) return <PawPrint className={`${sizeClass} text-orange-800`} fill="currentColor" />;
    if (kerawananList.includes("SOSIAL/WARGA/PTPN/TNGHS/DLL")) return <Flame className={`${sizeClass} text-orange-400`} />;

    if (kerawananList.length > 0) return <AlertTriangle className={`${sizeClass} text-red-500`} fill="currentColor" />;
    return <MapPin className={`${sizeClass} text-blue-400`} fill="currentColor" />;
}

// Function to determine Voltage color
function getVoltageColorClass(towerName: string, penghantar: string) {
    const combinedStr = `${towerName} ${penghantar}`.toUpperCase();
    if (combinedStr.includes("500KV") || combinedStr.includes("500 KV")) {
        return {
            bg: "bg-blue-500",
            border: "border-blue-300",
            shadow: "shadow-[0_0_8px_rgba(59,130,246,0.8)]",
            glow: "shadow-[0_0_5px_rgba(59,130,246,1)]",
            text: "text-blue-500"
        };
    } else if (combinedStr.includes("70KV") || combinedStr.includes("70 KV")) {
        return {
            bg: "bg-yellow-400",
            border: "border-yellow-200",
            shadow: "shadow-[0_0_8px_rgba(250,204,21,0.8)]",
            glow: "shadow-[0_0_5px_rgba(250,204,21,1)]",
            text: "text-yellow-500"
        };
    } else {
        return {
            bg: "bg-red-500",
            border: "border-red-300",
            shadow: "shadow-[0_0_8px_rgba(239,68,68,0.8)]",
            glow: "shadow-[0_0_5px_rgba(239,68,68,1)]",
            text: "text-red-500"
        };
    }
}

export default function TowerMap({ data }: { data: any[] }) {
    const [popupInfo, setPopupInfo] = useState<any | null>(null);
    const [popupType, setPopupType] = useState<"tower" | "cluster">("tower");

    const [viewState, setViewState] = useState({
        longitude: 106.7932,
        latitude: -6.5971,
        zoom: 9,
        pitch: 45,
        bearing: 0
    });

    // Automatically center map when data changes
    useEffect(() => {
        if (data.length > 0) {
            const avgLat = data.reduce((sum, item) => sum + item.lat, 0) / data.length;
            const avgLong = data.reduce((sum, item) => sum + item.long, 0) / data.length;

            setViewState(prev => ({
                ...prev,
                longitude: avgLong,
                latitude: avgLat,
                zoom: data.length > 500 ? 8 : 10
            }));
        }
    }, [data.length]);

    // Grouping logic for Vulnerability Clusters per Penghantar
    const clusterData = useMemo(() => {
        const groups: Record<string, any> = {};

        data.forEach(tower => {
            const penghantar = tower["PENGHANTAR"] || "Tanpa Penghantar";
            if (!groups[penghantar]) {
                groups[penghantar] = {
                    PENGHANTAR: penghantar,
                    ULTG: tower["ULTG"],
                    latSum: 0,
                    longSum: 0,
                    towersCount: 0,
                    vulnerableTowers: [],
                    kerawananCounts: {} as Record<string, number>
                };
            }

            groups[penghantar].latSum += tower.lat;
            groups[penghantar].longSum += tower.long;
            groups[penghantar].towersCount += 1;

            if (tower.kerawanan && tower.kerawanan.length > 0) {
                groups[penghantar].vulnerableTowers.push(tower);
                tower.kerawanan.forEach((k: string) => {
                    groups[penghantar].kerawananCounts[k] = (groups[penghantar].kerawananCounts[k] || 0) + 1;
                });
            }
        });

        // Compute averages and only return clusters that actually have vulnerabilities
        return Object.values(groups)
            .filter(g => g.vulnerableTowers.length > 0)
            .map(g => ({
                ...g,
                lat: g.latSum / g.towersCount,
                long: g.longSum / g.towersCount
            }));
    }, [data]);

    // Render Layer 1: Individual Tower Dots
    const towerMarkers = useMemo(() => {
        const isFarZoom = viewState.zoom < 10;
        return data.map((tower, idx) => {
            const voltageStyle = getVoltageColorClass(tower["NAMA TOWER"] || "", tower["PENGHANTAR"] || "");
            const size = isFarZoom ? 'w-1 h-1' : 'w-1.5 h-1.5';

            return (
                <Marker
                    key={`tower-${idx}`}
                    longitude={tower.long}
                    latitude={tower.lat}
                    anchor="center"
                    onClick={e => {
                        e.originalEvent.stopPropagation();
                        setPopupType("tower");
                        setPopupInfo(tower);
                    }}
                >
                    <div className={`cursor-pointer transform hover:scale-150 transition-transform duration-200 z-0 opacity-80`}>
                        <div className={`${size} ${voltageStyle.bg} rounded-full border ${voltageStyle.border} ${voltageStyle.shadow}`}></div>
                    </div>
                </Marker>
            );
        });
    }, [data, viewState.zoom]);

    // Render Layer 2: Vulnerability Clusters (1 per Penghantar)
    const clusterMarkers = useMemo(() => {
        const isFarZoom = viewState.zoom < 10;
        // Make icons EXTREMELY small to prevent overlap as seen in the screenshot
        const iconSize = isFarZoom ? "w-2 h-2" : "w-3 h-3";
        const paddingClass = "p-0.5";
        const badgeSize = isFarZoom ? "min-w-[10px] h-[10px] text-[6px]" : "min-w-[12px] h-[12px] text-[7px]";
        const badgeOffset = isFarZoom ? "-top-1 -right-1" : "-top-1.5 -right-1.5";

        return clusterData.map((cluster, idx) => {
            const kerawananEntries = Object.entries(cluster.kerawananCounts);

            return (
                <Marker
                    key={`cluster-${idx}`}
                    longitude={cluster.long}
                    latitude={cluster.lat}
                    anchor="bottom"
                    onClick={e => {
                        e.originalEvent.stopPropagation();
                        setPopupType("cluster");
                        setPopupInfo(cluster);
                    }}
                >
                    <div className={`cursor-pointer transform hover:scale-125 transition-transform duration-200 z-20 relative flex flex-col items-center`}>
                        <div className="flex flex-row items-center gap-0.5 pb-0.5">
                            {kerawananEntries.map(([k, count]) => (
                                <div key={k} className="relative group/icon">
                                    <div className={`bg-slate-900 border border-slate-700 shadow-[0_0_3px_rgba(239,68,68,0.5)] rounded-full ${paddingClass}`}>
                                        {getKerawananIcon([k], iconSize)}
                                    </div>
                                    <div className={`absolute ${badgeOffset} bg-red-600 text-white font-bold px-0.5 rounded-full flex items-center justify-center border border-red-400 shadow-sm leading-none ${badgeSize}`}>
                                        {count as number}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="h-2 w-px bg-red-500/70"></div>
                        <div className="w-1 h-1 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,1)]"></div>
                    </div>
                </Marker>
            );
        });
    }, [clusterData, viewState.zoom]);

    return (
        <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapStyle={MAP_STYLE}
            style={{ width: "100%", height: "100%", borderRadius: "0.5rem" }}
            minZoom={5}
            maxZoom={18}
            terrain={{ source: 'mapbox://mapbox.mapbox-terrain-dem-v1', exaggeration: 1.5 }}
        >
            <NavigationControl position="top-right" visualizePitch={true} />
            <FullscreenControl position="top-right" />
            <ScaleControl position="bottom-right" />

            {/* Legend Overlay */}
            <div className="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded-md shadow-lg flex gap-3 text-[10px] font-semibold text-slate-300 z-10">
                <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,1)]"></div> 500kV
                </span>
                <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,1)]"></div> 150kV
                </span>
                <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,1)]"></div> 70kV
                </span>
            </div>

            {/* Render both markers */}
            {towerMarkers}
            {clusterMarkers}

            {popupInfo && (
                <Popup
                    anchor="top"
                    longitude={popupInfo.long}
                    latitude={popupInfo.lat}
                    onClose={() => setPopupInfo(null)}
                    closeOnClick={false}
                    className="maplibre-custom-popup"
                    maxWidth="320px"
                    style={{ zIndex: 50 }}
                >
                    {popupType === "cluster" ? (
                        <div className="p-1 space-y-2 text-slate-800 dark:text-slate-200">
                            <h3 className="font-bold text-sm border-b pb-1 text-slate-900 leading-tight">
                                {popupInfo.PENGHANTAR}
                            </h3>
                            <div className="text-xs space-y-1">
                                <p><span className="font-semibold text-slate-500">ULTG:</span> {popupInfo.ULTG}</p>
                                <p><span className="font-semibold text-slate-500">Total Lintasan:</span> {popupInfo.towersCount} tower</p>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-200">
                                <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> {popupInfo.vulnerableTowers.length} Tower Rawan Terdeteksi:
                                </p>
                                <div className="max-h-[180px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                                    {popupInfo.vulnerableTowers.map((vt: any, idx: number) => (
                                        <div key={idx} className="bg-red-50/50 rounded border border-red-100 p-1.5">
                                            <p className="font-bold text-[10px] text-red-900 mb-1 flex items-center gap-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${getVoltageColorClass(vt["NAMA TOWER"] || "", vt["PENGHANTAR"] || "").bg}`}></span>
                                                {vt["NAMA TOWER"]}
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {vt.kerawanan.map((k: string, i: number) => (
                                                    <span key={i} className="inline-flex items-center gap-1.5 px-1.5 py-0.5 bg-white text-red-700 rounded text-[9px] font-bold border border-red-200 shadow-sm leading-none">
                                                        {getKerawananIcon([k], "w-2.5 h-2.5")}
                                                        {k}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-1 space-y-2 min-w-[200px] text-slate-800 dark:text-slate-200">
                            <h3 className="font-bold text-sm border-b pb-1 text-slate-900 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${getVoltageColorClass(popupInfo["NAMA TOWER"] || "", popupInfo["PENGHANTAR"] || "").bg}`}></span>
                                {popupInfo["NAMA TOWER"] || "Unknown Tower"}
                            </h3>
                            <div className="text-xs space-y-1">
                                <p><span className="font-semibold text-slate-500">ULTG:</span> {popupInfo["ULTG"]}</p>
                                <p><span className="font-semibold text-slate-500">GI:</span> {popupInfo["GARDU INDUK"]}</p>
                                <p><span className="font-semibold text-slate-500">PENGHANTAR:</span> {popupInfo["PENGHANTAR"]}</p>
                            </div>

                            {/* Tower specific popup now acts as an info card since the details are in the cluster */}
                            {popupInfo.kerawanan && popupInfo.kerawanan.length > 0 ? (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                    <p className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Terdeteksi Rawan (Lihat Ikon Penghantar)
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-2 pt-2 border-t text-[10px] text-emerald-600 font-bold">
                                    ✓ AMAN
                                </div>
                            )}
                        </div>
                    )}
                </Popup>
            )}
        </Map>
    );
}
