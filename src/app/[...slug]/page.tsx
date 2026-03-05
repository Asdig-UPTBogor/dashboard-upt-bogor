"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { PageLayoutConfig } from "@/lib/page-layout-types";
import { PageRenderer } from "@/components/page-builder/page-renderer";
import ComingSoonPage from "./_coming-soon";

/**
 * Universal catch-all page:
 * - If a page layout config exists for this route → render via PageRenderer
 * - If not → show Coming Soon page
 *
 * M7 fix: Layouts are fetched dynamically from /api/page-layouts
 * instead of statically imported, so new layouts appear without restart.
 */
export default function CatchAllPage() {
    const pathname = usePathname();
    const [layoutConfig, setLayoutConfig] = useState<PageLayoutConfig | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoaded(false);

        fetch("/api/page-layouts")
            .then((r) => r.json())
            .then((data: { layouts: PageLayoutConfig[] }) => {
                if (cancelled) return;
                const found = data.layouts.find((l) => l.pagePath === pathname) || null;
                setLayoutConfig(found);
                setLoaded(true);
            })
            .catch(() => {
                if (!cancelled) setLoaded(true);
            });

        return () => { cancelled = true; };
    }, [pathname]);

    if (!loaded) return null; // Loading — brief flash avoided by layout shell

    if (layoutConfig) {
        return <PageRenderer config={layoutConfig} />;
    }

    return <ComingSoonPage />;
}
