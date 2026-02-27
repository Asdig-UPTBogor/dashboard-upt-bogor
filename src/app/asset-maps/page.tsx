"use client";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with MapLibre (requires window)
const StandardMap = dynamic(
    () => import("@/components/StandardMap").then((m) => ({ default: m.StandardMap })),
    {
        ssr: false, loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-zinc-400">Loading map...</span>
                </div>
            </div>
        )
    }
);

export default function AssetMapsPage() {
    return (
        <div className="h-[calc(100vh-3.5rem)] -m-4 relative">
            {/* Map — full bleed */}
            <StandardMap initialStyle="dark" className="rounded-none border-0" />
        </div>
    );
}
