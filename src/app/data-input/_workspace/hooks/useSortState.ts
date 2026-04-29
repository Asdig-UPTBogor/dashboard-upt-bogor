"use client";

/**
 * useSortState — multi-column sort state + toggle + sortRows applier.
 *
 *  ▸ toggleSort(columnKey, shiftKey): null → ASC → DESC → null
 *  ▸ Multi-sort via shift (append), single via replace
 *  ▸ sortRows: handles real cols + virtual ancestor cols (__ancestor_{key})
 */

import { useCallback, useMemo } from "react";
import { useState } from "react";
import type { SortColumn } from "react-data-grid";
import type { RowData } from "../types";

export function useSortState() {
    const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);

    const toggleSort = useCallback((columnKey: string, shiftKey: boolean) => {
        setSortColumns((prev) => {
            const existing = prev.find((s) => s.columnKey === columnKey);
            const others = prev.filter((s) => s.columnKey !== columnKey);
            if (!existing) {
                return shiftKey ? [...prev, { columnKey, direction: "ASC" }] : [{ columnKey, direction: "ASC" }];
            }
            if (existing.direction === "ASC") {
                const next: SortColumn = { columnKey, direction: "DESC" };
                return shiftKey ? [...others, next] : [next];
            }
            return shiftKey ? others : [];
        });
    }, []);

    const sortRows = useCallback((rows: RowData[]): RowData[] => {
        if (sortColumns.length === 0) return rows;
        function getVal(row: RowData, colKey: string): unknown {
            if (colKey.startsWith("__ancestor_")) {
                const datasetKey = colKey.slice("__ancestor_".length);
                const anc = (row as RowData & { _ancestors?: Record<string, string> })._ancestors;
                return anc?.[datasetKey];
            }
            return row[colKey];
        }
        return [...rows].sort((a, b) => {
            for (const sc of sortColumns) {
                const va = getVal(a, sc.columnKey);
                const vb = getVal(b, sc.columnKey);
                if (va == null && vb == null) continue;
                if (va == null) return sc.direction === "ASC" ? 1 : -1;
                if (vb == null) return sc.direction === "ASC" ? -1 : 1;
                if (va < vb) return sc.direction === "ASC" ? -1 : 1;
                if (va > vb) return sc.direction === "ASC" ? 1 : -1;
            }
            return 0;
        });
    }, [sortColumns]);

    return useMemo(
        () => ({ sortColumns, setSortColumns, toggleSort, sortRows }),
        [sortColumns, toggleSort, sortRows],
    );
}
