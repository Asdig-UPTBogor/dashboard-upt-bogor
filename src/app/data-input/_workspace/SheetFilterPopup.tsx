"use client";

/**
 * SheetFilterPopup — filter per kolom ala Google Sheets.
 *
 * Layout:
 *   [Search value ____________]
 *   [🗘 Pilih Semua] [🗙 Hapus Semua]
 *   ─────────────────────────────────
 *   ☑ Value 1 (count)
 *   ☑ Value 2 (count)
 *   ☐ Value 3 (count)
 *   ...
 *   ─────────────────────────────────
 *   [Batal] [Terapkan]
 *
 * Nilai unik diambil dari semua row kolom tsb. Untuk CHOICE, label yg ditampilkan.
 * Untuk REFERENCE, display label dari lookup map.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, CheckSquare, Square, SquareDashed, Check } from "lucide-react";
import type { ColumnMeta, RowData } from "./types";

export interface SheetFilter {
    column: string;
    /** Set of string values — row dianggap match kalau String(v) ∈ allowed */
    allowed: Set<string>;
    /** Jumlah unique value total (untuk UI "N dari M terpilih") */
    totalUnique?: number;
}

interface Props {
    col: ColumnMeta;
    allRows: RowData[];
    refLookup?: Record<string, Map<string, string>>;
    current: SheetFilter | null;
    anchorRef: React.RefObject<HTMLElement | null>;
    onApply: (filter: SheetFilter | null) => void;
    onClose: () => void;
}

/** Reusable body props (tanpa anchor + positioning — caller handle shell). */
export interface SheetFilterBodyProps {
    col: ColumnMeta;
    allRows: RowData[];
    refLookup?: Record<string, Map<string, string>>;
    current: SheetFilter | null;
    onApply: (filter: SheetFilter | null) => void;
    onClose: () => void;
    /** Height cap untuk value list (px). Default 280. */
    listMaxHeight?: number;
}

interface ValueEntry {
    raw: string;        // Value yg disimpan (biasa ID atau string mentah)
    label: string;      // Display (CHOICE label, REFERENCE name, atau raw)
    count: number;
    color?: string;
}

export function SheetFilterPopup({
    col, allRows, refLookup, current, anchorRef, onApply, onClose,
}: Props) {
    const popRef = useRef<HTMLDivElement | null>(null);

    /* Position anchor */
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    useEffect(() => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) return;
        const popW = 300;
        let left = rect.left;
        if (left + popW > window.innerWidth - 16) {
            left = window.innerWidth - popW - 16;
        }
        setPos({ top: rect.bottom + 4, left });
    }, [anchorRef]);

    /* Collect unique values with counts */
    const entries = useMemo<ValueEntry[]>(() => {
        const counter = new Map<string, number>();
        for (const r of allRows) {
            const v = extractCellValue(r, col.name);
            const key = v == null ? "__NULL__" : String(v);
            counter.set(key, (counter.get(key) ?? 0) + 1);
        }
        const result: ValueEntry[] = [];
        for (const [raw, count] of counter.entries()) {
            let label = raw === "__NULL__" ? "(kosong)" : raw;
            let color: string | undefined;
            if (raw !== "__NULL__") {
                if (col.type === "CHOICE" && col.options) {
                    const opt = col.options.find((o) => o.value === raw);
                    if (opt) { label = opt.label; color = opt.color; }
                } else if (col.type === "REFERENCE" && col.reference && refLookup) {
                    const key = `${col.reference.dataset}.${col.reference.table}`;
                    const refLabel = refLookup[key]?.get(raw);
                    if (refLabel) label = refLabel;
                } else if (col.type === "BOOL") {
                    label = raw === "true" ? "Ya" : raw === "false" ? "Tidak" : label;
                }
            }
            result.push({ raw, label, count, color });
        }
        return result.sort((a, b) => {
            if (a.raw === "__NULL__") return 1;
            if (b.raw === "__NULL__") return -1;
            return a.label.localeCompare(b.label, "id");
        });
    }, [allRows, col, refLookup]);

    /* Local selection state (persisted saat apply) */
    const [selected, setSelected] = useState<Set<string>>(() => {
        if (current) return new Set(current.allowed);
        // Default: semua tercentang
        return new Set(entries.map((e) => e.raw));
    });

    // Kalau entries berubah (rows reload), re-sync default
    useEffect(() => {
        if (!current) setSelected(new Set(entries.map((e) => e.raw)));
    }, [entries, current]);

    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search.trim()) return entries;
        const q = search.toLowerCase();
        return entries.filter((e) => e.label.toLowerCase().includes(q) || e.raw.toLowerCase().includes(q));
    }, [entries, search]);

    /* Click outside / Esc */
    useEffect(() => {
        function onDown(e: MouseEvent) {
            if (popRef.current && !popRef.current.contains(e.target as Node)
                && anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [onClose, anchorRef]);

    function toggle(raw: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(raw)) next.delete(raw); else next.add(raw);
            return next;
        });
    }

    function pickAll() { setSelected(new Set(entries.map((e) => e.raw))); }
    function clearAll() { setSelected(new Set()); }
    function invert() {
        setSelected((prev) => {
            const next = new Set<string>();
            for (const e of entries) if (!prev.has(e.raw)) next.add(e.raw);
            return next;
        });
    }

    function apply() {
        // Kalau semua terpilih → tidak perlu filter
        if (selected.size === entries.length) {
            onApply(null);
        } else if (selected.size === 0) {
            // Semua di-uncheck → filter ke nothing (show 0 row)
            onApply({ column: col.name, allowed: new Set(), totalUnique: entries.length });
        } else {
            onApply({ column: col.name, allowed: new Set(selected), totalUnique: entries.length });
        }
        onClose();
    }

    if (!pos) return null;

    const allChecked = selected.size === entries.length;
    const noneChecked = selected.size === 0;
    const partial = !allChecked && !noneChecked;

    return (
        <div
            ref={popRef}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-50 w-[300px] max-h-[440px] rounded-lg border border-border bg-card shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100"
        >
            {/* Header */}
            <header className="shrink-0 border-b border-border px-3 py-2 flex items-center gap-2">
                <span className="ds-label uppercase tracking-wider truncate flex-1">
                    Filter: <span className="text-primary">{col.alias ?? col.name}</span>
                </span>
                <button onClick={onClose} className="ds-transition rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-muted/40">
                    <X className="h-3 w-3" />
                </button>
            </header>

            {/* Search */}
            <div className="shrink-0 border-b border-border/50 px-3 py-2">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nilai..."
                        className="w-full rounded border border-border bg-background pl-6 pr-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Quick actions */}
            <div className="shrink-0 border-b border-border/50 px-3 py-1.5 flex items-center gap-1 text-xs">
                <button
                    type="button"
                    onClick={allChecked ? clearAll : pickAll}
                    className="ds-transition inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted/40"
                >
                    {allChecked
                        ? <CheckSquare className="h-3 w-3 text-primary" />
                        : partial
                        ? <SquareDashed className="h-3 w-3 text-primary" />
                        : <Square className="h-3 w-3" />}
                    {allChecked ? "Hapus Semua" : "Pilih Semua"}
                </button>
                <button type="button" onClick={invert} className="ds-transition rounded px-1.5 py-0.5 hover:bg-muted/40 opacity-70">
                    Balik
                </button>
                <span className="ml-auto opacity-50">{selected.size} dari {entries.length}</span>
            </div>

            {/* Values list */}
            <ul className="flex-1 overflow-y-auto px-1 py-1">
                {filtered.length === 0 && (
                    <li className="px-2 py-3 text-center ds-small opacity-50">Tidak ada nilai cocok</li>
                )}
                {filtered.map((e) => {
                    const on = selected.has(e.raw);
                    return (
                        <li key={e.raw}>
                            <button
                                type="button"
                                onClick={() => toggle(e.raw)}
                                className={`ds-transition w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left ${
                                    on ? "bg-primary/10" : "hover:bg-muted/30"
                                }`}
                            >
                                {on
                                    ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                                    : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                {e.color && (
                                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: e.color }} />
                                )}
                                <span className={`truncate flex-1 ${e.raw === "__NULL__" ? "italic opacity-60" : ""}`}>
                                    {e.label}
                                </span>
                                <span className="ds-small opacity-50 font-mono shrink-0">{e.count}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            {/* Footer */}
            <footer className="shrink-0 border-t border-border px-3 py-2 flex items-center gap-2">
                <button type="button" onClick={onClose} className="ds-transition ds-small rounded border border-border px-2 py-1 hover:bg-muted/40">
                    Batal
                </button>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={apply}
                    className="ds-transition ds-small inline-flex items-center gap-1 rounded bg-primary px-3 py-1 font-medium text-primary-foreground hover:opacity-90"
                >
                    <Check className="h-3 w-3" /> Terapkan
                </button>
            </footer>
        </div>
    );
}

/* ─── Apply filter helper (dipakai di MasterGrid) ──────────── */

export function applySheetFilter(row: RowData, filter: SheetFilter): boolean {
    // Virtual ancestor columns: column key = "__ancestor_{datasetKey}",
    // value lives in row._ancestors map. Support seamless di filter logic.
    let v: unknown;
    if (filter.column.startsWith("__ancestor_")) {
        const datasetKey = filter.column.slice("__ancestor_".length);
        const anc = (row as RowData & { _ancestors?: Record<string, string> })._ancestors;
        v = anc?.[datasetKey];
    } else {
        v = row[filter.column];
    }
    const key = v == null ? "__NULL__" : String(v);
    return filter.allowed.has(key);
}

/** Extract cell value — support virtual ancestor cols (__ancestor_{key}). */
function extractCellValue(row: RowData, colName: string): unknown {
    if (colName.startsWith("__ancestor_")) {
        const datasetKey = colName.slice("__ancestor_".length);
        const anc = (row as RowData & { _ancestors?: Record<string, string> })._ancestors;
        return anc?.[datasetKey];
    }
    return row[colName];
}

/* ─── SheetFilterBody — reusable body tanpa shell + positioning ──────
 *  Dipakai di cascading menu submenu header kolom (render inline).
 *  Tidak ada anchor / fixed positioning — caller (misal ColumnHeaderPopover
 *  submenu) yang tentukan posisi container. */
export function SheetFilterBody({
    col, allRows, refLookup, current, onApply, onClose, listMaxHeight = 280,
}: SheetFilterBodyProps) {
    const entries = useMemo<ValueEntry[]>(() => {
        const counter = new Map<string, number>();
        for (const r of allRows) {
            const v = extractCellValue(r, col.name);
            const key = v == null ? "__NULL__" : String(v);
            counter.set(key, (counter.get(key) ?? 0) + 1);
        }
        const result: ValueEntry[] = [];
        for (const [raw, count] of counter.entries()) {
            let label = raw === "__NULL__" ? "(empty)" : raw;
            let color: string | undefined;
            if (raw !== "__NULL__") {
                if (col.type === "CHOICE" && col.options) {
                    const opt = col.options.find((o) => o.value === raw);
                    if (opt) { label = opt.label; color = opt.color; }
                } else if (col.type === "REFERENCE" && col.reference && refLookup) {
                    const key = `${col.reference.dataset}.${col.reference.table}`;
                    const refLabel = refLookup[key]?.get(raw);
                    if (refLabel) label = refLabel;
                } else if (col.type === "BOOL") {
                    label = raw === "true" ? "Yes" : raw === "false" ? "No" : label;
                }
            }
            result.push({ raw, label, count, color });
        }
        return result.sort((a, b) => {
            if (a.raw === "__NULL__") return 1;
            if (b.raw === "__NULL__") return -1;
            return a.label.localeCompare(b.label, "id");
        });
    }, [allRows, col, refLookup]);

    const [selected, setSelected] = useState<Set<string>>(() => {
        if (current) return new Set(current.allowed);
        return new Set(entries.map((e) => e.raw));
    });
    useEffect(() => {
        if (!current) setSelected(new Set(entries.map((e) => e.raw)));
    }, [entries, current]);

    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search.trim()) return entries;
        const q = search.toLowerCase();
        return entries.filter((e) => e.label.toLowerCase().includes(q) || e.raw.toLowerCase().includes(q));
    }, [entries, search]);

    function toggle(raw: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(raw)) next.delete(raw); else next.add(raw);
            return next;
        });
    }
    function pickAll() { setSelected(new Set(entries.map((e) => e.raw))); }
    function clearAll() { setSelected(new Set()); }
    function invert() {
        setSelected((prev) => {
            const next = new Set<string>();
            for (const e of entries) if (!prev.has(e.raw)) next.add(e.raw);
            return next;
        });
    }

    function apply() {
        if (selected.size === entries.length) onApply(null);
        else if (selected.size === 0) onApply({ column: col.name, allowed: new Set(), totalUnique: entries.length });
        else onApply({ column: col.name, allowed: new Set(selected), totalUnique: entries.length });
        onClose();
    }

    const allChecked = selected.size === entries.length;
    const noneChecked = selected.size === 0;
    const partial = !allChecked && !noneChecked;

    return (
        <div className="flex flex-col">
            {/* Search */}
            <div className="shrink-0 pb-2 border-b border-border/40">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search values…"
                        className="w-full rounded border border-border bg-background pl-6 pr-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>
            {/* Quick actions */}
            <div className="shrink-0 py-1.5 flex items-center gap-1 text-xs border-b border-border/40">
                <button
                    type="button"
                    onClick={allChecked ? clearAll : pickAll}
                    className="ds-transition inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted/40"
                >
                    {allChecked
                        ? <CheckSquare className="h-3 w-3 text-primary" />
                        : partial
                        ? <SquareDashed className="h-3 w-3 text-primary" />
                        : <Square className="h-3 w-3" />}
                    {allChecked ? "Deselect all" : "Select all"}
                </button>
                <button type="button" onClick={invert} className="ds-transition rounded px-1.5 py-0.5 hover:bg-muted/40 opacity-70">
                    Invert
                </button>
                <span className="ml-auto opacity-50">{selected.size} of {entries.length}</span>
            </div>
            {/* Values list */}
            <ul
                className="overflow-y-auto py-1 -mx-1 px-1"
                style={{ maxHeight: listMaxHeight }}
            >
                {filtered.length === 0 && (
                    <li className="px-2 py-3 text-center ds-small opacity-50">No matching values</li>
                )}
                {filtered.map((e) => {
                    const on = selected.has(e.raw);
                    return (
                        <li key={e.raw}>
                            <button
                                type="button"
                                onClick={() => toggle(e.raw)}
                                className={`ds-transition w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left ${
                                    on ? "bg-primary/10" : "hover:bg-muted/30"
                                }`}
                            >
                                {on
                                    ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                                    : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                {e.color && (
                                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: e.color }} />
                                )}
                                <span className={`truncate flex-1 ${e.raw === "__NULL__" ? "italic opacity-60" : ""}`}>
                                    {e.label}
                                </span>
                                <span className="ds-small opacity-50 font-mono shrink-0">{e.count}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {/* Footer */}
            <footer className="shrink-0 pt-2 border-t border-border/40 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="ds-btn ds-btn-secondary ds-btn-sm"
                >
                    Cancel
                </button>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={apply}
                    className="ds-btn ds-btn-primary ds-btn-sm"
                >
                    <Check className="h-3 w-3" /> Apply
                </button>
            </footer>
        </div>
    );
}
