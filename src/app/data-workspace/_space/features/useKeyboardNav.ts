/**
 * useKeyboardNav — keyboard navigation antar cells.
 *
 * Bindings (saat focus di body cell, NOT di editor mode):
 *   ArrowLeft / Right    → cell sebelah
 *   ArrowUp / Down       → row sebelah, kolom sama
 *   Tab                  → next cell (wrap row)
 *   Shift+Tab            → prev cell
 *   Enter / F2           → enter edit mode
 *   Esc                  → exit selection
 *
 * Saat editor active, editor handle key sendiri (Enter commit, Esc cancel).
 *
 * Pattern: parent (Space) bind ke container, dispatch via data-attr cell coords.
 */

import { useCallback, useEffect } from "react";
import type { Table } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";

export interface KeyboardNavApi {
    activeCell: { rowIdx: number; colId: string } | null;
    setActiveCell: (cell: { rowIdx: number; colId: string } | null) => void;
}

export function useKeyboardNav(
    table: Table<RowData>,
    api: KeyboardNavApi,
    containerRef: React.RefObject<HTMLElement | null>,
) {
    const move = useCallback((dr: number, dc: number) => {
        if (!api.activeCell) return;
        const rows = table.getRowModel().rows;
        const visibleCols = table.getVisibleLeafColumns();
        const rowIdx = api.activeCell.rowIdx;
        const colIdx = visibleCols.findIndex((c) => c.id === api.activeCell?.colId);
        if (colIdx < 0) return;

        let newRow = Math.max(0, Math.min(rows.length - 1, rowIdx + dr));
        let newCol = colIdx + dc;
        // Wrap horizontally
        if (newCol < 0) {
            if (newRow > 0) { newRow -= 1; newCol = visibleCols.length - 1; }
            else newCol = 0;
        } else if (newCol >= visibleCols.length) {
            if (newRow < rows.length - 1) { newRow += 1; newCol = 0; }
            else newCol = visibleCols.length - 1;
        }
        api.setActiveCell({ rowIdx: rows[newRow].index, colId: visibleCols[newCol].id });
    }, [table, api]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        function onKey(e: KeyboardEvent) {
            // Skip kalau focus di editable element (input/textarea/select/contenteditable)
            const tgt = e.target as HTMLElement;
            if (!tgt) return;
            if (tgt.matches("input, textarea, select, [contenteditable]")) return;
            if (!api.activeCell) return;

            switch (e.key) {
                case "ArrowLeft": e.preventDefault(); move(0, -1); break;
                case "ArrowRight": e.preventDefault(); move(0, 1); break;
                case "ArrowUp": e.preventDefault(); move(-1, 0); break;
                case "ArrowDown": e.preventDefault(); move(1, 0); break;
                case "Tab":
                    e.preventDefault();
                    move(0, e.shiftKey ? -1 : 1);
                    break;
                case "Escape":
                    e.preventDefault();
                    api.setActiveCell(null);
                    break;
                // Enter/F2 trigger edit — dispatched ke cell via custom event
                case "Enter":
                case "F2":
                    e.preventDefault();
                    if (el) {
                        el.dispatchEvent(new CustomEvent("space-edit-active", {
                            detail: api.activeCell,
                        }));
                    }
                    break;
            }
        }

        el.addEventListener("keydown", onKey);
        return () => el.removeEventListener("keydown", onKey);
    }, [api, move, containerRef]);
}
