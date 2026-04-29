"use client";

import { useEffect, useRef, useState } from "react";
import type { CellEditorProps } from "./types";

export function NumberEditor({
    value, onCommit, onCancel, autoFocus = true, integer = false,
}: CellEditorProps & { integer?: boolean }) {
    const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus) {
            ref.current?.focus();
            ref.current?.select();
        }
    }, [autoFocus]);

    const commit = () => {
        if (draft === "") return onCommit(null);
        const n = integer ? parseInt(draft, 10) : parseFloat(draft);
        if (Number.isNaN(n)) return onCancel();
        onCommit(n);
    };

    return (
        <input
            ref={ref}
            type="number"
            inputMode={integer ? "numeric" : "decimal"}
            step={integer ? "1" : "any"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            className="w-full h-full px-2 text-xs text-right tabular-nums font-mono bg-background border border-primary outline-none focus:ring-1 focus:ring-primary/40"
        />
    );
}
