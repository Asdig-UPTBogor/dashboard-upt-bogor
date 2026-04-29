"use client";

/**
 * ExportMenuPopup — export dropdown (CSV / Excel / PDF).
 *
 *  Dynamic anchor via button ref — popup posisi mengikuti tombol Export
 *  yang di-klik, bukan rail container. Konsisten pattern dengan WorkspaceDrawer.
 *  Shell/header class shared via SIDEBAR_LAYOUT (biar gak divergen).
 */

import { useEffect, useRef, useState } from "react";
import { FileDown, FileText, FileSpreadsheet } from "lucide-react";
import { SIDEBAR_LAYOUT, computePanelAnchor } from "./sidebar-layout";

export function ExportMenuPopup({
    anchorEl, onClose, onCsv, onXlsx, onPdf,
}: {
    anchorEl: HTMLElement | null;
    onClose: () => void;
    onCsv: () => void;
    onXlsx: () => void;
    onPdf: () => void;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
    useEffect(() => {
        function compute() {
            const a = computePanelAnchor(anchorEl, false);
            setPos({ left: a.left, top: a.top });
        }
        compute();
        window.addEventListener("resize", compute);
        window.addEventListener("scroll", compute, true);
        return () => {
            window.removeEventListener("resize", compute);
            window.removeEventListener("scroll", compute, true);
        };
    }, [anchorEl]);
    useEffect(() => {
        function onDown(e: MouseEvent) {
            const target = e.target as Node;
            if (ref.current?.contains(target)) return;
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
    }, [onClose]);
    if (!pos) return null;
    return (
        <div
            ref={ref}
            style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: SIDEBAR_LAYOUT.DEFAULT_WIDTH.export,
                zIndex: SIDEBAR_LAYOUT.Z_INDEX,
            }}
            className={`${SIDEBAR_LAYOUT.SHELL_CLASS} ${SIDEBAR_LAYOUT.ANIMATION_CLASS}`}
        >
            <header className={SIDEBAR_LAYOUT.HEADER_CLASS}>
                <FileDown className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="ds-label uppercase tracking-wider flex-1">Ekspor</span>
            </header>
            <ul className="py-1">
                <ExportMenuItem icon={FileText} label="CSV" hint=".csv" onClick={onCsv} />
                <ExportMenuItem icon={FileSpreadsheet} label="Excel" hint=".xlsx" onClick={onXlsx} />
                <ExportMenuItem icon={FileDown} label="PDF" hint=".pdf" onClick={onPdf} />
            </ul>
        </div>
    );
}

function ExportMenuItem({
    icon: Icon, label, hint, onClick,
}: {
    icon: typeof FileText;
    label: string;
    hint: string;
    onClick: () => void;
}) {
    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className="ds-transition w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/40"
            >
                <Icon className="h-3.5 w-3.5 opacity-70" />
                <span className="flex-1">{label}</span>
                <span className="ds-small font-mono opacity-50">{hint}</span>
            </button>
        </li>
    );
}
