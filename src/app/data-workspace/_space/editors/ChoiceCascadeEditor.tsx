"use client";

/**
 * ChoiceCascadeEditor — dropdown yang options-nya tergantung kolom parent.
 *
 * Schema:
 *   columnMeta.cascade = {
 *     parentColumn: "brand",
 *     mapping: {
 *       "NR":   [{ value: "PCS-9611", label: "PCS-9611" }, ...],
 *       "ABB":  [{ value: "REL670", label: "REL670" }, ...]
 *     }
 *   }
 *
 * Behavior:
 *   - Read parent value dari row context (row.original[parentColumn])
 *   - Filter options sesuai mapping[parentValue]
 *   - Kalau parent kosong/tidak ke-mapping → empty options + warning
 *   - Cascade reset di Space level: saat parent berubah, child wajib reset
 *     (handled di future phase via meta.updateCell side-effect)
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { CellEditorProps } from "./types";

export function ChoiceCascadeEditor({
    value, onCommit, onCancel, columnMeta, autoFocus = true,
}: CellEditorProps & { rowParentValue?: string }) {
    const cascade = columnMeta?.cascade;
    // Parent value dipassing via columnMeta.cascade context — saat ini fallback
    // ke empty string. Future enhancement: pass row.original[parentColumn] via prop.
    const parentValue = ""; // TODO Phase 4: Space provides current row parent value
    const options = cascade?.mapping[parentValue] ?? [];

    const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
    const ref = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        if (autoFocus) ref.current?.focus();
    }, [autoFocus]);

    if (!cascade) {
        return <div className="px-2 text-xs text-destructive">No cascade config</div>;
    }

    if (!parentValue || options.length === 0) {
        return (
            <div className="w-full h-full flex items-center gap-1.5 px-2 text-xs bg-amber-500/10 border border-amber-500/40">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-amber-700 dark:text-amber-400 truncate">
                    Pilih {cascade.parentColumn} dulu
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    className="ml-auto text-[10px] opacity-60 hover:opacity-100"
                >
                    close
                </button>
            </div>
        );
    }

    const commit = () => onCommit(draft === "" ? null : draft);

    return (
        <select
            ref={ref}
            value={draft}
            onChange={(e) => {
                setDraft(e.target.value);
                onCommit(e.target.value === "" ? null : e.target.value);
            }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
            className="w-full h-full px-2 text-xs bg-background border border-primary outline-none focus:ring-1 focus:ring-primary/40"
        >
            <option value="">— empty —</option>
            {options.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
            ))}
        </select>
    );
}
