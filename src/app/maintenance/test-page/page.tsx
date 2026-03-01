"use client";

import { useEffect, useState } from "react";
import type { PageLayoutConfig } from "@/lib/page-layout-types";
import { PageRenderer } from "@/components/page-builder/page-renderer";
import { LayoutGrid, Loader2 } from "lucide-react";

/**
 * Test page for Page Builder output.
 * Fetches saved layout config from /api/page-layouts at runtime.
 * Build the layout in Page Builder → come here to see the result.
 */
export default function TestPage() {
    const [layoutConfig, setLayoutConfig] = useState<PageLayoutConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLayout = async () => {
            try {
                const res = await fetch("/api/page-layouts");
                const data = await res.json();
                const found = (data.layouts || []).find(
                    (l: PageLayoutConfig) => l.pagePath === "/maintenance/test-page"
                );
                setLayoutConfig(found || null);
            } catch (err) {
                console.error("Failed to fetch layout:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLayout();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin opacity-30 mb-3" />
                <p className="text-sm">Memuat layout...</p>
            </div>
        );
    }

    if (!layoutConfig) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
                <LayoutGrid className="h-16 w-16 mb-4 opacity-20" />
                <h2 className="text-lg font-bold mb-2">Belum Ada Layout</h2>
                <p className="text-sm text-center max-w-md">
                    Halaman ini belum punya layout. Buka{" "}
                    <a href="/maintenance/page-builder" className="text-indigo-400 underline hover:text-indigo-300">
                        Page Builder
                    </a>
                    , pilih <strong>&quot;Test Page&quot;</strong>, susun widget, lalu klik Simpan.
                </p>
                <p className="text-xs mt-3 text-muted-foreground/60 font-mono">/maintenance/test-page</p>
            </div>
        );
    }

    return <PageRenderer config={layoutConfig} />;
}
