"use client";

/**
 * useColumnFilters — per-column Sheets-style filters + global fuzzy search.
 *
 *  ▸ filters: Record<colKey, SheetFilter> (colKey bisa "__ancestor_…" untuk virtual col)
 *  ▸ Global search: fuzzy di semua kolom + REFERENCE label resolve
 */

import { useCallback, useMemo, useState } from "react";
import type { ColumnMeta, RowData } from "../types";
import { applySheetFilter, type SheetFilter } from "../SheetFilterPopup";

type RefLookup = Record<string, Map<string, string>>;

export function useColumnFilters(
    rows: RowData[],
    columns: ColumnMeta[],
    refLookup: RefLookup,
) {
    const [filters, setFilters] = useState<Record<string, SheetFilter>>({});
    const [search, setSearch] = useState("");

    const setFilter = useCallback((f: SheetFilter | null, key?: string) => {
        setFilters((prev) => {
            if (!f) {
                if (!key) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [f.column]: f };
        });
    }, []);

    const clearFilter = useCallback((key: string) => {
        setFilters((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const clearAllFilters = useCallback(() => setFilters({}), []);

    const filteredRows = useMemo(() => {
        let out = rows;
        for (const f of Object.values(filters)) {
            out = out.filter((r) => applySheetFilter(r, f));
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            out = out.filter((r) =>
                columns.some((c) => {
                    const v = r[c.name];
                    if (v == null) return false;
                    if (c.type === "REFERENCE" && c.reference) {
                        const k = `${c.reference.dataset}.${c.reference.table}`;
                        const label = refLookup[k]?.get(String(v));
                        if (label && label.toLowerCase().includes(q)) return true;
                    }
                    return String(v).toLowerCase().includes(q);
                }),
            );
        }
        return out;
    }, [rows, search, columns, refLookup, filters]);

    return { filters, setFilters, setFilter, clearFilter, clearAllFilters, filteredRows, search, setSearch };
}
