/**
 * useColumnFilter — TanStack columnFilters helpers.
 *
 * Wrap useReactTable column.setFilterValue + column.getFilterValue dengan
 * type-aware operators (text, range, checkbox).
 */

import { useCallback, useMemo } from "react";
import type { Column, Table } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";

export type FilterValue =
    | { kind: "text"; q: string }
    | { kind: "range"; min?: number; max?: number }
    | { kind: "set"; values: string[] };

export function useColumnFilterApi(table: Table<RowData>) {
    const setFilter = useCallback((colId: string, value: FilterValue | undefined) => {
        const col = table.getColumn(colId);
        if (!col) return;
        col.setFilterValue(value);
    }, [table]);

    const getFilter = useCallback((colId: string): FilterValue | undefined => {
        const col = table.getColumn(colId);
        return col?.getFilterValue() as FilterValue | undefined;
    }, [table]);

    const clearFilter = useCallback((colId: string) => {
        setFilter(colId, undefined);
    }, [setFilter]);

    return { setFilter, getFilter, clearFilter };
}

/**
 * Custom filterFn — type-dispatch berdasar FilterValue.kind.
 * Register di columnDef.filterFn = "spaceColumnFilter".
 */
export function spaceColumnFilter(row: { getValue: (id: string) => unknown }, columnId: string, filter: FilterValue): boolean {
    const value = row.getValue(columnId);
    if (filter.kind === "text") {
        if (!filter.q) return true;
        return String(value ?? "").toLowerCase().includes(filter.q.toLowerCase());
    }
    if (filter.kind === "range") {
        const n = typeof value === "number" ? value : Number(value);
        if (Number.isNaN(n)) return false;
        if (filter.min !== undefined && n < filter.min) return false;
        if (filter.max !== undefined && n > filter.max) return false;
        return true;
    }
    if (filter.kind === "set") {
        // Empty selection = nothing matches (sheet filter "uncheck all")
        if (filter.values.length === 0) return false;
        // Convention: NULL key = "__NULL__" (match SheetFilterPanel)
        const key = value == null ? "__NULL__" : String(value);
        return filter.values.includes(key);
    }
    return true;
}

/** Faceted unique values untuk a column (dipake checkbox filter). */
export function useFacetedValues(column: Column<RowData, unknown> | undefined): string[] {
    return useMemo(() => {
        if (!column) return [];
        const set = new Set<string>();
        const facets = column.getFacetedUniqueValues?.();
        if (facets) {
            facets.forEach((_count, value) => set.add(String(value)));
        }
        return Array.from(set).sort();
    }, [column]);
}
