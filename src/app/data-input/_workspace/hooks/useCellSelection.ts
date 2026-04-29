"use client";

/**
 * useCellSelection — row selection state + click toggle.
 *
 *  ▸ Single click = select (replace prev)
 *  ▸ Same row 2nd click = deselect (toggle off)
 *  ▸ Ctrl/Cmd+click = multi-select toggle per row
 *  ▸ Staging row (__staging__) click = clear selection
 */

import { useCallback, useState } from "react";
import type { RowData } from "../types";

export function useCellSelection(primaryKey: string) {
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    const handleCellClick = useCallback(
        (args: { row: RowData; column: { key: string } }, event: React.MouseEvent) => {
            const pk = String(args.row[primaryKey]);
            if (pk === "__staging__") {
                setSelectedRows(new Set());
                return;
            }
            setSelectedRows((prev) => {
                if (event.ctrlKey || event.metaKey) {
                    const next = new Set(prev);
                    if (next.has(pk)) next.delete(pk); else next.add(pk);
                    return next;
                }
                if (prev.size === 1 && prev.has(pk)) return new Set();
                return new Set([pk]);
            });
        },
        [primaryKey],
    );

    return { selectedRows, setSelectedRows, handleCellClick };
}
