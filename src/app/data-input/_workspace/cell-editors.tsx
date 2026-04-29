"use client";

/**
 * cell-editors — React components untuk inline cell edit di react-data-grid.
 *
 * Extracted dari MasterGrid.tsx supaya:
 *  1. Grid component fokus ke orchestration, bukan editor detail
 *  2. Editor bisa di-test + reuse
 *  3. Tambah editor baru (RICH_TEXT, FILE, JSON) tinggal append di sini
 */

import { useState, useEffect, useMemo } from "react";
import type { RenderEditCellProps } from "react-data-grid";
import { Check } from "lucide-react";
import type { ColumnMeta, RowData } from "./types";

type RefOptions = Record<string, Array<{ value: string; label: string }>>;

/* ─── BoolEditor — Ya / Tidak dropdown ─────────────────────── */
export function BoolEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<RowData>) {
    return (
        <select
            autoFocus
            value={row[column.key] ? "true" : "false"}
            onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value === "true" }, true)}
            onBlur={() => onClose(true)}
            className="w-full h-full border-0 bg-background px-2 text-sm focus:outline-none"
        >
            <option value="true">Yes</option>
            <option value="false">No</option>
        </select>
    );
}

/* ─── NumberEditor — INT64 / FLOAT64 / NUMERIC ─────────────── */
export function NumberEditor({
    row, column, onRowChange, onClose, col,
}: RenderEditCellProps<RowData> & { col: ColumnMeta }) {
    return (
        <input
            autoFocus
            type="number"
            step={col.type === "INT64" ? "1" : "any"}
            defaultValue={String(row[column.key] ?? "")}
            onBlur={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                onRowChange({ ...row, [column.key]: v }, true);
                onClose(true);
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value;
                    onRowChange({ ...row, [column.key]: v === "" ? null : Number(v) }, true);
                    onClose(true);
                }
                if (e.key === "Escape") onClose(false);
            }}
            className="w-full h-full border-0 bg-background px-2 text-sm focus:outline-none text-right tabular-nums"
        />
    );
}

/* ─── ChoiceEditor — CHOICE dropdown (fixed options) ────────── */
export function ChoiceEditor({
    row, column, onRowChange, onClose, col,
}: RenderEditCellProps<RowData> & { col: ColumnMeta }) {
    const options = col.options ?? [];
    return (
        <select
            autoFocus
            value={String(row[column.key] ?? "")}
            onChange={(e) => {
                onRowChange({ ...row, [column.key]: e.target.value || null }, true);
            }}
            onBlur={() => onClose(true)}
            className="w-full h-full border-0 bg-background px-2 text-sm focus:outline-none"
        >
            <option value="">—</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

/* ─── ReferenceEditor — searchable dropdown from Master table ── */
export function ReferenceEditor({
    row, column, onRowChange, onClose, col, refOptions,
}: RenderEditCellProps<RowData> & {
    col: ColumnMeta;
    refOptions: RefOptions;
}) {
    const ref = col.reference;
    const refKey = ref ? `${ref.dataset}.${ref.table}` : "";
    const allOptions = refOptions[refKey] ?? [];
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search.trim()) return allOptions.slice(0, 50);
        const q = search.toLowerCase();
        return allOptions.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50);
    }, [allOptions, search]);
    const currentVal = String(row[column.key] ?? "");

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose(false);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function pick(value: string) {
        onRowChange({ ...row, [column.key]: value || null }, true);
        onClose(true);
    }

    return (
        <div className="relative w-full h-full">
            <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${ref?.table ?? "Master"}…`}
                className="w-full h-full border-0 bg-background px-2 text-sm focus:outline-none"
            />
            {(search || !currentVal) && filtered.length > 0 && (
                <ul className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-60 overflow-y-auto rounded-md border border-border bg-card shadow-2xl">
                    {filtered.map((o) => {
                        const isActive = o.value === currentVal;
                        return (
                            <li key={o.value}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
                                    className={`w-full flex items-center gap-2 px-2 py-1 text-sm text-left ${
                                        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/40"
                                    }`}
                                >
                                    <span className="flex-1 truncate">{o.label}</span>
                                    {isActive && <Check className="h-3 w-3" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
