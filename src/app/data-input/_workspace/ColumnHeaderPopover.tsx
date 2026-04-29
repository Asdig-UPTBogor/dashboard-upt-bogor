"use client";

/**
 * ColumnHeaderPopover — cascading menu (Airtable/Excel pattern).
 *
 *  ▸ Click chevron → main menu (list of tool entries).
 *  ▸ Hover entry → submenu panel expand di kanan dengan kontrol aktual.
 *  ▸ Tambah fitur baru = append entry baru dengan renderSubmenu callback.
 *  ▸ Zero hardcode per-column.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronRight, Check } from "lucide-react";
import { SIDEBAR_LAYOUT } from "./sidebar-layout";

export interface ColumnMenuEntry {
    key: string;
    icon: typeof ArrowUp;
    label: string;
    /** Status aktif — indicator check/highlight di main menu. */
    active?: boolean;
    /** Subtitle singkat, muncul di main menu (misal "8/12 nilai"). */
    hint?: string;
    /** Hidden kalau false. */
    visible?: boolean;
    /** Render submenu content saat entry di-hover. */
    renderSubmenu: (ctx: { close: () => void }) => React.ReactNode;
}

export function ColumnHeaderPopover({
    anchorEl, title, entries, onClose,
}: {
    anchorEl: HTMLElement;
    title: string;
    entries: ColumnMenuEntry[];
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const r = anchorEl.getBoundingClientRect();
        const popW = 220;
        let left = r.left;
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        setPos({ top: r.bottom + 4, left });
    }, [anchorEl]);

    useEffect(() => {
        function onDown(e: MouseEvent) {
            if (ref.current?.contains(e.target as Node)) return;
            if (anchorEl.contains(e.target as Node)) return;
            onClose();
        }
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
            if (enterTimer.current) clearTimeout(enterTimer.current);
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
        };
    }, [onClose, anchorEl]);

    function scheduleEnter(key: string) {
        if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
        if (enterTimer.current) clearTimeout(enterTimer.current);
        enterTimer.current = setTimeout(() => setActiveKey(key), 80);
    }
    function scheduleLeave() {
        if (enterTimer.current) { clearTimeout(enterTimer.current); enterTimer.current = null; }
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(() => setActiveKey(null), 200);
    }
    function cancelLeave() {
        if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    }

    if (!pos) return null;
    const visibleEntries = entries.filter((e) => e.visible !== false);
    const activeEntry = visibleEntries.find((e) => e.key === activeKey);

    return (
        <div
            ref={ref}
            style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: SIDEBAR_LAYOUT.Z_INDEX,
            }}
            className="flex gap-1 items-start"
            onMouseLeave={scheduleLeave}
            onMouseEnter={cancelLeave}
        >
            {/* Main menu — list of tool entries */}
            <div
                style={{ width: 240 }}
                className={`${SIDEBAR_LAYOUT.SHELL_CLASS} ${SIDEBAR_LAYOUT.ANIMATION_CLASS}`}
            >
                <header className={SIDEBAR_LAYOUT.HEADER_CLASS}>
                    <span className="ds-label uppercase tracking-wider flex-1 truncate" title={title}>
                        {title}
                    </span>
                </header>
                <ul className="p-1.5 space-y-0.5">
                    {visibleEntries.map((entry) => (
                        <li key={entry.key}>
                            <button
                                type="button"
                                onMouseEnter={() => scheduleEnter(entry.key)}
                                onFocus={() => setActiveKey(entry.key)}
                                aria-haspopup="menu"
                                aria-expanded={activeKey === entry.key}
                                className={`ds-transition w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left
                                    ${activeKey === entry.key
                                        ? "bg-muted/60 text-foreground"
                                        : "text-foreground hover:bg-muted/40"}`}
                            >
                                <entry.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                <span className="flex-1">{entry.label}</span>
                                {entry.hint
                                    ? <span className="ds-small font-mono text-primary">{entry.hint}</span>
                                    : entry.active && <Check className="h-3 w-3 text-primary" />}
                                <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />
                            </button>
                        </li>
                    ))}
                    {visibleEntries.length === 0 && (
                        <li className="ds-small opacity-50 text-center py-3">
                            Tidak ada aksi tersedia
                        </li>
                    )}
                </ul>
            </div>

            {/* Submenu panel — 240px default, 320px untuk filter yg butuh checkbox list */}
            {activeEntry && (
                <div
                    onMouseEnter={cancelLeave}
                    style={{
                        minWidth: activeEntry.key === "filter" ? 320 : 240,
                        maxWidth: 400,
                    }}
                    className={`${SIDEBAR_LAYOUT.SHELL_CLASS} animate-in fade-in slide-in-from-left-1 duration-100`}
                >
                    <header className={SIDEBAR_LAYOUT.HEADER_CLASS}>
                        <activeEntry.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="ds-label uppercase tracking-wider flex-1">{activeEntry.label}</span>
                    </header>
                    <div className="p-2">
                        {activeEntry.renderSubmenu({ close: onClose })}
                    </div>
                </div>
            )}
        </div>
    );
}

export function PopoverItem({
    icon: Icon, label, active, tone = "default", onClick,
}: {
    icon: typeof ArrowUp;
    label: string;
    active?: boolean;
    tone?: "default" | "muted" | "destructive";
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
    const toneCls =
        tone === "muted"
            ? "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            : tone === "destructive"
            ? "text-destructive hover:bg-destructive/10"
            : active
            ? "text-primary bg-primary/10"
            : "text-foreground hover:bg-muted/40";
    return (
        <button
            type="button"
            onClick={onClick}
            className={`ds-transition w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left ${toneCls}`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{label}</span>
            {active && <Check className="h-3 w-3" />}
        </button>
    );
}
