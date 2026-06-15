"use client";

/**
 * BidangBackdrop — backdrop foto per bidang yang IKUT theme switcher.
 * Aset shared: public/backgrounds/{dark|light}/{bidang}.png (landscape).
 *   - dark theme  → versi dark
 *   - light theme → versi light
 * Scrim pakai var(--deck-bg) → ikut tema otomatis (gelap di dark, terang di light).
 *
 * Dipakai lintas surface (slide deck, dashboard) biar identitas konsisten — 1 sumber.
 * Render sebagai 2 layer absolute (inset 0, zIndex 0); taruh sebagai anak pertama
 * container ber-position:relative, konten di atasnya kasih zIndex >= 1.
 */

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export type Bidang = "gardu-induk" | "transmisi" | "proteksi" | "combined";

export function BidangBackdrop({ bidang, opacity = 1 }: { bidang: Bidang; opacity?: number }) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const tone = mounted && resolvedTheme === "light" ? "light" : "dark";
    const src = `/backgrounds/${tone}/${bidang}.png`;

    return (
        <>
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    background: `url('${src}') center / cover no-repeat`,
                    opacity,
                }}
            />
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    backgroundImage:
                        "linear-gradient(180deg, color-mix(in oklab, var(--deck-bg) 5%, transparent) 0%, color-mix(in oklab, var(--deck-bg) 18%, transparent) 38%, color-mix(in oklab, var(--deck-bg) 38%, transparent) 70%, color-mix(in oklab, var(--deck-bg) 50%, transparent) 100%)",
                }}
            />
        </>
    );
}
