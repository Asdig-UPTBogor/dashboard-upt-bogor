"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { usePageDataRegistry } from "@/hooks/usePageData";
import { findPageByPath } from "@/lib/sidebar-config";

/**
 * DataFreshness — Zero-config sync indicator for the top bar.
 *
 * Shows: Page Name | relative time ago | Refresh button
 * Auto-detects current page via usePathname().
 * Only renders when usePageData is active on the page.
 */
interface DataFreshnessProps {
    pagePath?: string;
}

/** Format seconds into human-readable relative time */
function formatAgo(seconds: number): string {
    if (seconds < 60) return "just now";
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m lalu`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m lalu` : `${h}h lalu`;
}

export function DataFreshness({ pagePath }: DataFreshnessProps = {}) {
    const pathname = usePathname();
    const resolvedPath = pagePath || pathname;
    const entry = usePageDataRegistry(resolvedPath);
    const page = findPageByPath(resolvedPath);

    // Live-ticking relative time
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 10_000); // tick every 10s
        return () => clearInterval(timer);
    }, []);

    if (!entry) return null;

    const { fetchedAt, getIsRevalidating, refetch } = entry;
    const revalidating = getIsRevalidating();
    const pageName = page?.label || resolvedPath.split("/").pop() || "Page";

    const agoSec = fetchedAt ? Math.max(0, Math.round((now - new Date(fetchedAt).getTime()) / 1000)) : null;
    const isStale = agoSec != null && agoSec >= 3600; // > 1 hour

    return (
        <div className={`inline-flex items-center rounded-lg border text-xs overflow-hidden ${isStale ? "border-red-500/50 bg-red-500/5" : "bg-card"}`}>
            {/* Page name */}
            <span className="px-3 py-1.5 font-medium border-r bg-muted/50 text-foreground">
                {pageName}
            </span>

            {/* Relative time */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 border-r select-none ${isStale ? "text-red-500" : "text-muted-foreground"}`}>
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${!fetchedAt ? "bg-muted-foreground/30" : isStale ? "bg-red-500" : "bg-emerald-500"}`} />
                <span>{agoSec == null ? "Belum sync" : isStale ? `${formatAgo(agoSec)} · need update` : formatAgo(agoSec)}</span>
            </div>

            {/* Refresh button */}
            <button
                onClick={() => refetch()}
                disabled={revalidating}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50 text-muted-foreground hover:text-foreground"
                title="Refresh data dari Google Sheets"
            >
                <RefreshCw className={`h-3 w-3 ${revalidating ? "animate-spin" : ""}`} />
                <span>{revalidating ? "Syncing..." : "Refresh"}</span>
            </button>
        </div>
    );
}
