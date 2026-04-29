"use client";

/**
 * StatusChip + StatusPopup — toolbar indicators untuk Filters/Sort aktif.
 *
 * Pattern Airtable/Supabase/Linear: chip di toolbar muncul saat ada status
 * aktif, click → popup detail dengan clear actions. Auto-hide saat count=0.
 */

import { useEffect, useRef, useState } from "react";
import type { SortColumn } from "react-data-grid";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import type { ColumnMeta } from "./types";
import type { SheetFilter } from "./SheetFilterPopup";
import { SIDEBAR_LAYOUT } from "./sidebar-layout";

export function StatusChip({
    icon: Icon, label, count, tone = "primary", onClick,
}: {
    icon: typeof ArrowUp;
    label: string;
    count: number;
    tone?: "primary" | "warning";
    onClick: (el: HTMLElement) => void;
}) {
    if (count === 0) return null;
    const toneCls = tone === "warning"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15"
        : "text-primary bg-primary/10 border-primary/30 hover:bg-primary/15";
    return (
        <button
            type="button"
            onClick={(e) => onClick(e.currentTarget)}
            className={`ds-transition inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium shrink-0 ${toneCls}`}
            title={`${count} ${label.toLowerCase()} active — click to manage`}
        >
            <Icon className="h-3 w-3" strokeWidth={2.5} />
            <span>{label}</span>
            <span className="ds-data font-mono">{count}</span>
        </button>
    );
}

export function StatusPopup({
    anchorEl, kind, filters, columns, sortColumns,
    onClearFilter, onClearAllFilters, onClearSort, onClearAllSort, onClose,
}: {
    anchorEl: HTMLElement;
    kind: "filters" | "sort";
    filters: Record<string, SheetFilter>;
    columns: ColumnMeta[];
    sortColumns: readonly SortColumn[];
    onClearFilter: (key: string) => void;
    onClearAllFilters: () => void;
    onClearSort: (key: string) => void;
    onClearAllSort: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    useEffect(() => {
        const r = anchorEl.getBoundingClientRect();
        const popW = 280;
        let left = r.left;
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        setPos({ top: r.bottom + 6, left });
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
        };
    }, [onClose, anchorEl]);
    if (!pos) return null;

    const title = kind === "filters" ? "Active Filters" : "Active Sort";

    return (
        <div
            ref={ref}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 280, zIndex: SIDEBAR_LAYOUT.Z_INDEX }}
            className={`${SIDEBAR_LAYOUT.SHELL_CLASS} ${SIDEBAR_LAYOUT.ANIMATION_CLASS}`}
        >
            <header className={SIDEBAR_LAYOUT.HEADER_CLASS}>
                <span className="ds-label uppercase tracking-wider flex-1">{title}</span>
            </header>
            <div className="p-2 space-y-1 max-h-[320px] overflow-y-auto">
                {kind === "filters" && Object.values(filters).map((f) => {
                    const col = columns.find((c) => c.name === f.column);
                    const label = col?.alias ?? f.column;
                    return (
                        <div key={f.column} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30">
                            <span className="text-sm flex-1 truncate" title={label}>{label}</span>
                            <span className="ds-small font-mono opacity-60">{f.allowed.size}/{f.totalUnique ?? "?"}</span>
                            <button
                                type="button"
                                onClick={() => onClearFilter(f.column)}
                                className="ds-transition rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                title="Clear this filter"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    );
                })}
                {kind === "sort" && sortColumns.map((s) => {
                    const colKey = s.columnKey;
                    const isAncestor = colKey.startsWith("__ancestor_");
                    const col = !isAncestor ? columns.find((c) => c.name === colKey) : null;
                    const label = col?.alias ?? col?.name
                        ?? colKey.replace("__ancestor_", "").split(".").pop()
                        ?? colKey;
                    return (
                        <div key={colKey} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30">
                            {s.direction === "ASC"
                                ? <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
                                : <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />}
                            <span className="text-sm flex-1 truncate">{label}</span>
                            <span className="ds-small font-mono opacity-60">{s.direction === "ASC" ? "A→Z" : "Z→A"}</span>
                            <button
                                type="button"
                                onClick={() => onClearSort(colKey)}
                                className="ds-transition rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                title="Clear this sort"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    );
                })}
            </div>
            <footer className="border-t border-border/60 p-2 flex items-center gap-2">
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={() => {
                        if (kind === "filters") onClearAllFilters();
                        else onClearAllSort();
                        onClose();
                    }}
                    className="ds-btn ds-btn-secondary ds-btn-sm"
                >
                    Clear all
                </button>
            </footer>
        </div>
    );
}
