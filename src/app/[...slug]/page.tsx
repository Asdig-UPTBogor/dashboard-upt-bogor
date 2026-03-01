"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import layouts from "@/lib/page-layouts.json";
import type { PageLayoutConfig } from "@/lib/page-layout-types";
import { PageRenderer } from "@/components/page-builder/page-renderer";
import ComingSoonPage from "./_coming-soon";

/**
 * Universal catch-all page:
 * - If a page layout config exists for this route → render via PageRenderer
 * - If not → show Coming Soon page
 */
export default function CatchAllPage() {
    const pathname = usePathname();

    const layoutConfig = useMemo(() => {
        const found = (layouts as { layouts: PageLayoutConfig[] }).layouts.find(
            (l) => l.pagePath === pathname
        );
        return found || null;
    }, [pathname]);

    if (layoutConfig) {
        return <PageRenderer config={layoutConfig} />;
    }

    return <ComingSoonPage />;
}
