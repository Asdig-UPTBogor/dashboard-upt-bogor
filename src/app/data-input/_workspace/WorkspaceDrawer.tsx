"use client";

/**
 * WorkspaceDrawer — FLOATING overlay panel, anchored ke Tool Rail button.
 *
 * UX konsisten dengan Export popup: slide-in dari kiri, fixed positioning,
 * click-outside / Esc close, grid tidak ke-push. Drag handle di kanan
 * drawer untuk resize lebar.
 *
 * Anchor: default ke nav[aria-label="Workspace sidebar"] (rail di kiri).
 * Positioning: left = rail.right, top = rail.top, bottom = rail.bottom.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SIDEBAR_LAYOUT, computePanelAnchor, type AnchorPos } from "./sidebar-layout";

interface Props {
    open: boolean;
    title: string;
    subtitle?: string;
    /** Button DOM element yang meng-trigger drawer — panel positioned dinamis
     *  relatif ke element ini. Pattern anchor ala Radix Popover / Floating UI.
     *  Kalau null, fallback ke rail sidebar. */
    anchorEl?: HTMLElement | null;
    defaultWidth?: number;
    minWidth?: number;
    maxWidth?: number;
    onClose: () => void;
    children: React.ReactNode;
}

export function WorkspaceDrawer({
    open, title, subtitle, anchorEl, defaultWidth = 360, minWidth = 280, maxWidth = 780, onClose, children,
}: Props) {
    const [w, setW] = useState(defaultWidth);
    const [anchor, setAnchor] = useState<AnchorPos | null>(null);
    const asideRef = useRef<HTMLElement | null>(null);
    const drag = useRef<{ startX: number; startW: number } | null>(null);

    // Dynamic anchor — panel follow posisi button yang di-trigger.
    // Kalau button pindah (scroll/resize), panel ikut reposition.
    useEffect(() => {
        if (!open) return;
        function compute() { setAnchor(computePanelAnchor(anchorEl ?? null, true)); }
        compute();
        window.addEventListener("resize", compute);
        window.addEventListener("scroll", compute, true);
        return () => {
            window.removeEventListener("resize", compute);
            window.removeEventListener("scroll", compute, true);
        };
    }, [open, anchorEl]);

    const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        drag.current = { startX: e.clientX, startW: w };
        (e.currentTarget).setPointerCapture(e.pointerId);
    }, [w]);

    const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.startX; // drag kanan = lebih lebar
        const next = Math.max(minWidth, Math.min(maxWidth, drag.current.startW + dx));
        setW(next);
    }, [minWidth, maxWidth]);

    const onDragEnd = useCallback(() => { drag.current = null; }, []);

    // Click-outside close (anchor rail button tidak dihitung outside)
    useEffect(() => {
        if (!open) return;
        function onDown(e: MouseEvent) {
            const target = e.target as Node;
            if (asideRef.current?.contains(target)) return;
            // Rail button click punya handler toggle sendiri, jangan double-close
            const rail = document.querySelector('nav[aria-label="Workspace sidebar"]');
            if (rail?.contains(target)) return;
            onClose();
        }
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!open || !anchor) return null;

    return (
        <aside
            ref={asideRef}
            style={{
                position: "fixed",
                left: anchor.left,
                top: anchor.top,
                bottom: anchor.bottom,
                width: `min(${w}px, calc(100vw - ${anchor.left + 16}px))`,
                zIndex: SIDEBAR_LAYOUT.Z_INDEX,
            }}
            className={`flex flex-col ${SIDEBAR_LAYOUT.SHELL_CLASS} ${SIDEBAR_LAYOUT.ANIMATION_CLASS}`}
        >
            {/* Drag handle — kanan drawer, desktop only */}
            <div
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                className="hidden md:block absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-primary/30 active:bg-primary/50 ds-transition"
                title="Drag untuk resize panel"
            />
            <header className={SIDEBAR_LAYOUT.HEADER_CLASS}>
                <div className="flex-1 min-w-0">
                    <p className="ds-label uppercase tracking-wider">{title}</p>
                    {subtitle && <p className="ds-small opacity-60 truncate">{subtitle}</p>}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    title="Tutup (Esc)"
                    className="ds-btn ds-btn-ghost ds-btn-icon"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </header>
            <div className="flex-1 overflow-hidden rounded-b-lg">{children}</div>
        </aside>
    );
}
