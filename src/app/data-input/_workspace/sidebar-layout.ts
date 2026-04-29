"use client";

/**
 * Sidebar Workspace — layout constants (satu source untuk semua panel).
 *
 * Dipakai WorkspaceDrawer (Panel Kolom, Panel Impor) + ExportMenuPopup.
 * Ubah di sini sekali → semua panel ikut. JANGAN hardcode di komponen.
 */

export const SIDEBAR_LAYOUT = {
    /** Jarak horizontal dari edge kanan rail ke edge kiri panel (px). */
    RAIL_GAP_PX: 8,
    /** Offset dari edge atas rail ke edge atas panel (px). */
    TOP_OFFSET_PX: 4,
    /** Offset dari edge bawah panel ke edge bawah rail (px). */
    BOTTOM_OFFSET_PX: 4,
    /** z-index untuk panel overlay (di atas grid + rail + drawer aplikasi). */
    Z_INDEX: 45,

    /** Default width per tool (px). Override via defaultWidth prop kalau perlu. */
    DEFAULT_WIDTH: {
        kolom: 380,
        import: 560,
        export: 224,
    } as Record<string, number>,

    /** Tailwind class untuk shell panel — border + corner + shadow + bg. */
    SHELL_CLASS: "bg-card border border-border rounded-lg shadow-2xl shadow-black/40",
    /** Tailwind class untuk header panel — padding + border bawah + corner atas. */
    HEADER_CLASS: "shrink-0 flex items-center gap-2 border-b border-border/60 px-3 py-2 rounded-t-lg",
    /** Tailwind animation classes untuk slide-in dari kiri. */
    ANIMATION_CLASS: "animate-in fade-in slide-in-from-left-2 duration-150",
} as const;

export interface AnchorPos {
    left: number;
    top: number;
    /** Undefined = auto-height (panel pendek spt Export popup). */
    bottom?: number;
}

/**
 * Hitung posisi panel relatif ke ELEMENT yang di-trigger (button).
 *
 * Dynamic — baca getBoundingClientRect() dari button DOM element ref.
 * Kalau rail/button positioning berubah di masa depan (rail jadi horizontal,
 * tambah toolbar lain, dll), panel otomatis ikut tanpa perlu ubah code panel.
 *
 * @param anchorEl HTMLElement dari button yang meng-trigger panel (bisa null saat mount awal)
 * @param fullHeight true = panel stretch dari button.top ke bottom viewport
 *                   false = auto-height (popup pendek)
 * @param fallbackAnchor Optional query selector untuk anchor kalau anchorEl null
 *                       (default: 'nav[aria-label="Workspace sidebar"]' — sidebar rail)
 */
export function computePanelAnchor(
    anchorEl: HTMLElement | null,
    fullHeight: boolean,
    fallbackAnchor = 'nav[aria-label="Workspace sidebar"]',
): AnchorPos {
    if (typeof window === "undefined") {
        return { left: 56, top: 64, bottom: fullHeight ? 8 : undefined };
    }

    // Primary: anchor langsung ke button yang di-trigger
    let el: HTMLElement | null = anchorEl;
    // Fallback: cari rail kalau button ref belum ready (first mount)
    if (!el && fallbackAnchor) {
        el = document.querySelector(fallbackAnchor) as HTMLElement | null;
    }
    if (!el) {
        return { left: 56, top: 64, bottom: fullHeight ? 8 : undefined };
    }

    const r = el.getBoundingClientRect();
    const left = r.right + SIDEBAR_LAYOUT.RAIL_GAP_PX;
    const top = r.top + SIDEBAR_LAYOUT.TOP_OFFSET_PX;

    if (!fullHeight) {
        // Auto-height popup — hanya butuh top + left
        return { left, top };
    }

    // Full-height panel — stretch dari top button ke bottom viewport
    // (dengan offset biar ga nempel edge)
    const bottom = SIDEBAR_LAYOUT.BOTTOM_OFFSET_PX;
    return { left, top, bottom };
}
