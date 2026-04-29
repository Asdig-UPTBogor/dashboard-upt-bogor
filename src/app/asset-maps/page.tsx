"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

// Dynamic import to avoid SSR issues with MapLibre (requires window)
const StandardMap = dynamic(
    () => import("@/components/StandardMap").then((m) => ({ default: m.StandardMap })),
    {
        ssr: false, loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-background/80">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading map...</span>
                </div>
            </div>
        )
    }
);

export default function AssetMapsPage() {
    const { resolvedTheme } = useTheme();
    const mapInitial = resolvedTheme === "light" ? "light" : "dark";

    return (
        <div className="h-[calc(100vh-3.5rem)] relative">
            {/* Map — full bleed, syncs with app theme */}
            <StandardMap initialStyle={mapInitial} appTheme={resolvedTheme} className="rounded-none border-0" />
        </div>
    );
}
