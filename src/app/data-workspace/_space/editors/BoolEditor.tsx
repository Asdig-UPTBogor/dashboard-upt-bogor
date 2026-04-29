"use client";

import { Check, Minus, X } from "lucide-react";
import type { CellEditorProps } from "./types";

/**
 * BoolEditor — toggle 3-state: true / false / null.
 * Click cycles: null → true → false → null.
 * Tidak butuh autoFocus (single click cycle, no input).
 */
export function BoolEditor({ value, onCommit, onCancel }: CellEditorProps) {
    const cur = value === true || value === "true" || value === 1 ? true
        : value === false || value === "false" || value === 0 ? false
        : null;

    const cycle = () => {
        const next = cur === null ? true : cur === true ? false : null;
        onCommit(next);
    };

    return (
        <div className="w-full h-full flex items-center justify-center gap-1 px-1 bg-background border border-primary">
            <button
                type="button"
                autoFocus
                onClick={cycle}
                onKeyDown={(e) => {
                    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
                    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); cycle(); }
                }}
                className="ds-interactive ds-press inline-flex items-center justify-center h-5 w-5 rounded"
                title={cur === null ? "Empty (click to set true)" : cur ? "True (click to set false)" : "False (click to clear)"}
            >
                {cur === true ? <Check className="h-3.5 w-3.5 text-primary" />
                    : cur === false ? <X className="h-3.5 w-3.5 text-muted-foreground" />
                    : <Minus className="h-3.5 w-3.5 opacity-30" />}
            </button>
        </div>
    );
}
