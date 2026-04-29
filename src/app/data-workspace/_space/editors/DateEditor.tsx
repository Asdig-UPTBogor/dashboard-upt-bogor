"use client";

import { useEffect, useRef, useState } from "react";
import type { CellEditorProps } from "./types";

export function DateEditor({
    value, onCommit, onCancel, autoFocus = true, timestamp = false,
}: CellEditorProps & { timestamp?: boolean }) {
    /** Convert raw value → ISO string yang cocok untuk input[type=date|datetime-local]. */
    const initial = (() => {
        if (!value) return "";
        const s = String(value);
        if (timestamp) return s.slice(0, 16); // YYYY-MM-DDTHH:mm
        return s.slice(0, 10); // YYYY-MM-DD
    })();
    const [draft, setDraft] = useState<string>(initial);
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus) {
            ref.current?.focus();
            ref.current?.select?.();
        }
    }, [autoFocus]);

    const commit = () => {
        if (draft === "") return onCommit(null);
        // Datetime-local doesn't include seconds → add :00 + Z untuk konsisten dengan BQ TIMESTAMP.
        const out = timestamp ? `${draft}:00Z` : draft;
        onCommit(out);
    };

    return (
        <input
            ref={ref}
            type={timestamp ? "datetime-local" : "date"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            className="w-full h-full px-2 text-xs font-mono tabular-nums bg-background border border-primary outline-none focus:ring-1 focus:ring-primary/40"
        />
    );
}
