"use client";
/**
 * CameraInfo — Map camera state overlay (Thor FE reference)
 *
 * Shows: X (lng) | Y (lat) | Z (zoom) | P (pitch) | B (bearing) | E (elevation) | S (scale)
 * Collapsible, adaptive dark/light, monospace font.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface CameraInfoProps {
    center?: { lng: number; lat: number };
    zoom?: number;
    pitch?: number;
    bearing?: number;
    elevation?: number;
    show3D?: boolean;
    mapStyle?: string;
    scale?: string;
}

export function CameraInfo({
    center = { lng: 0, lat: 0 },
    zoom = 0,
    pitch = 0,
    bearing = 0,
    elevation = 0,
    show3D = false,
    mapStyle = "dark",
    scale = "",
}: CameraInfoProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isLight = mapStyle === "light" || mapStyle === "osm";
    const cardBg = isLight ? "bg-white/70" : "bg-black/60";
    const cardBorder = isLight ? "border-black/20" : "border-white/20";
    const primary = isLight ? "text-blue-600" : "text-cyan-400";
    const sep = isLight ? "text-black/20" : "text-white/20";
    const elev = isLight ? "text-orange-600" : "text-yellow-400";
    const btnText = isLight ? "text-gray-600" : "text-zinc-400";
    const scaleText = isLight ? "text-gray-600" : "text-gray-400";

    return (
        <div className={`flex items-center backdrop-blur-md border rounded-md ${cardBg} ${cardBorder}`}>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`flex items-center justify-center w-6 h-6 ${btnText} hover:opacity-80 transition-opacity`}
                title={isCollapsed ? "Show Info" : "Hide Info"}
            >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
            </button>

            <div className={`w-px h-5 ${isLight ? "bg-black/10" : "bg-white/10"}`} />

            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[500px] opacity-100"}`}>
                <div className="font-mono flex items-center whitespace-nowrap px-2 py-1 gap-1.5 text-[10px]">
                    <span className={primary}>X:{center.lng.toFixed(3)}</span>
                    <span className={sep}>|</span>
                    <span className={primary}>Y:{center.lat.toFixed(3)}</span>
                    <span className={sep}>|</span>
                    <span className={primary}>Z:{zoom.toFixed(1)}</span>
                    <span className={sep}>|</span>
                    <span className={primary}>P:{pitch.toFixed(0)}°</span>
                    <span className={sep}>|</span>
                    <span className={primary}>B:{bearing.toFixed(0)}°</span>
                    {show3D && (
                        <>
                            <span className={sep}>|</span>
                            <span className={elev}>E:{elevation > 0 ? `${Math.round(elevation)}m` : "0m"}</span>
                        </>
                    )}
                    {scale && (
                        <>
                            <span className={sep}>|</span>
                            <span className={scaleText}>S:{scale}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
