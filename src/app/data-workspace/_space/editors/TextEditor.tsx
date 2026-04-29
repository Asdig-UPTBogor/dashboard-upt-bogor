"use client";

import { useEffect, useRef, useState } from "react";
import type { CellEditorProps } from "./types";

export function TextEditor({ value, onCommit, onCancel, autoFocus = true }: CellEditorProps) {
    const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus) {
            ref.current?.focus();
            ref.current?.select();
        }
    }, [autoFocus]);

    const commit = () => onCommit(draft === "" ? null : draft);

    return (
        <input
            ref={ref}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") { commit(); }
                else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            className="w-full h-full px-2 text-xs bg-background border border-primary outline-none focus:ring-1 focus:ring-primary/40"
        />
    );
}
