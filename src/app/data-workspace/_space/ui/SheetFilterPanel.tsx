"use client";

/**
 * SheetFilterPanel — Google Sheets-style filter (port dari MasterGrid legacy).
 *
 * Layout:
 *   [🔍 Search value ____________]
 *   Pilih Semua · Hapus Semua · Balik     N dari M
 *   ─────────────────────────────────
 *   ☑ Value 1 (count)
 *   ☑ Value 2 (count)
 *   ...
 *   ─────────────────────────────────
 *   [Batal] [Terapkan]
 *
 * Dipakai inline di ColumnHeaderMenu (tab Filter). TanStack-native:
 * apply via column.setFilterValue(allowedSet).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CheckSquare, Square, SquareDashed, Check, X } from "lucide-react";
import type { Column, Row } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";
import { useReferenceLookup } from "../features/useReferenceCache";

export type FilterAllowed = string[];

interface Props {
    column: Column<RowData, unknown>;
    rows: ReadonlyArray<Row<RowData>>;
    consumerTable?: string;
    /** null = clear (semua), array = allowed values list */
    onApply: (allowed: FilterAllowed | null) => void;
    onClose: () => void;
}

interface ValueEntry { raw: string; label: string; count: number; color?: string }

export function SheetFilterPanel({ column, rows, consumerTable, onApply, onClose }: Props) {
    const meta = column.columnDef.meta;
    const refLookup = useReferenceLookup(meta?.reference, consumerTable);
    const choices = meta?.choices;
    // PERF: refLookup object identity baru tiap render → keep di ref agar
    // useMemo deps ga jadikan entries unstable (cause infinite loop di useEffect).
    const refLookupFn = refLookup.lookup;
    const refLookupFnRef = useRef(refLookupFn);
    refLookupFnRef.current = refLookupFn;

    // Stable primitives sebagai deps
    const rowsLen = rows.length;
    const choicesKey = choices ? choices.map((c) => c.value).join(",") : "";

    const entries = useMemo<ValueEntry[]>(() => {
        const counter = new Map<string, number>();
        for (const r of rows) {
            const v = r.getValue(column.id);
            const key = v == null ? "__NULL__" : String(v);
            counter.set(key, (counter.get(key) ?? 0) + 1);
        }
        const result: ValueEntry[] = [];
        for (const [raw, count] of counter.entries()) {
            let label = raw === "__NULL__" ? "(kosong)" : raw;
            let color: string | undefined;
            if (raw !== "__NULL__") {
                if (choices) {
                    const opt = choices.find((o) => o.value === raw);
                    if (opt) { label = opt.label; color = opt.color; }
                } else if (meta?.editor === "REFERENCE") {
                    const refLabel = refLookupFnRef.current(raw);
                    if (refLabel) label = refLabel;
                }
            }
            result.push({ raw, label, count, color });
        }
        return result.sort((a, b) => {
            if (a.raw === "__NULL__") return 1;
            if (b.raw === "__NULL__") return -1;
            return a.label.localeCompare(b.label, "id");
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, rowsLen, column.id, choicesKey, meta?.editor]);

    // Read current filter (FilterValue.set format from spaceColumnFilter)
    const filterRaw = column.getFilterValue() as { kind: "set"; values: string[] } | undefined;
    const currentSet = filterRaw?.kind === "set" ? new Set(filterRaw.values) : null;
    const [selected, setSelected] = useState<Set<string>>(() => {
        if (currentSet) return new Set(currentSet);
        return new Set(entries.map((e) => e.raw));
    });

    // Re-sync default when entries changes — pakai length sbg trigger stable.
    const entriesLenRef = useRef(entries.length);
    useEffect(() => {
        if (currentSet) return;
        if (entriesLenRef.current === entries.length) return;
        entriesLenRef.current = entries.length;
        setSelected(new Set(entries.map((e) => e.raw)));
    }, [entries, currentSet]);

    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search.trim()) return entries;
        const q = search.toLowerCase();
        return entries.filter((e) => e.label.toLowerCase().includes(q) || e.raw.toLowerCase().includes(q));
    }, [entries, search]);

    const toggle = (raw: string) => setSelected((p) => {
        const next = new Set(p);
        if (next.has(raw)) next.delete(raw); else next.add(raw);
        return next;
    });
    const pickAll = () => setSelected(new Set(entries.map((e) => e.raw)));
    const clearAll = () => setSelected(new Set());
    const apply = () => {
        if (selected.size === entries.length) onApply(null);
        else onApply([...selected]);
        onClose();
    };

    const allChecked = selected.size === entries.length;
    const noneChecked = selected.size === 0;
    const partial = !allChecked && !noneChecked;

    return (
        <div className="flex flex-col" style={{ maxHeight: 440 }}>
            <div className="shrink-0 border-b border-border/40 px-3 py-2">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                        autoFocus
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nilai..."
                        className="w-full rounded border border-border/50 bg-background pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                </div>
            </div>

            <div className="shrink-0 border-b border-border/40 px-3 py-1.5 flex items-center gap-1 text-[11px]">
                <button type="button" onClick={allChecked ? clearAll : pickAll}
                    className="ds-transition inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted/40">
                    {allChecked ? <CheckSquare className="h-3 w-3 text-primary" />
                     : partial ? <SquareDashed className="h-3 w-3 text-primary" />
                     : <Square className="h-3 w-3" />}
                    {allChecked ? "Kosongkan" : "Pilih semua"}
                </button>
                <span className="ml-auto opacity-50">{selected.size} / {entries.length}</span>
            </div>

            <ul className="flex-1 overflow-y-auto px-1 py-1" style={{ maxHeight: 280 }}>
                {filtered.length === 0 && (
                    <li className="px-2 py-3 text-center text-[11px] opacity-50">Tidak ada nilai cocok</li>
                )}
                {filtered.map((e) => {
                    const on = selected.has(e.raw);
                    const isNull = e.raw === "__NULL__";
                    return (
                        <li key={e.raw}>
                            <button type="button" onClick={() => toggle(e.raw)}
                                className={`ds-transition w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left ${on ? "bg-primary/10" : "hover:bg-muted/30"}`}>
                                {on
                                    ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                                    : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                {e.color && !isNull ? (
                                    <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] truncate flex-1 min-w-0"
                                        style={{
                                            color: e.color,
                                            borderColor: `color-mix(in oklch, ${e.color} 40%, transparent)`,
                                            backgroundColor: `color-mix(in oklch, ${e.color} 12%, transparent)`,
                                        }}
                                    >
                                        <span className="truncate">{e.label}</span>
                                    </span>
                                ) : (
                                    <span className={`truncate flex-1 ${isNull ? "italic opacity-60" : ""}`}>{e.label}</span>
                                )}
                                <span className="text-[10px] opacity-50 font-mono shrink-0">{e.count}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="shrink-0 border-t border-border/40 px-3 py-2 flex items-center gap-2">
                <button type="button" onClick={onClose}
                    className="ds-transition text-[11px] rounded border border-border/50 px-2 py-1 hover:bg-muted/40">
                    <X className="h-3 w-3 inline mr-1" /> Batal
                </button>
                <div className="flex-1" />
                <button type="button" onClick={apply}
                    className="ds-transition text-[11px] inline-flex items-center gap-1 rounded bg-primary px-3 py-1 font-medium text-primary-foreground hover:opacity-90">
                    <Check className="h-3 w-3" /> Terapkan
                </button>
            </div>
        </div>
    );
}

/** TanStack filterFn — pasangan untuk filter value yang di-set lewat column.setFilterValue. */
export function sheetFilterFn(row: Row<RowData>, columnId: string, filterValue: unknown): boolean {
    if (!(filterValue instanceof Set)) return true;
    const v = row.getValue(columnId);
    const key = v == null ? "__NULL__" : String(v);
    return filterValue.has(key);
}
