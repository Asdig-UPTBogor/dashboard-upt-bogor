/**
 * useSpaceTable — TanStack Table v8 instance + consolidated state.
 *
 * Single source of truth untuk:
 *  - Sort, filter (global + per-column), pagination
 *  - Column pinning, visibility, ordering, sizing
 *  - Row selection
 *  - Dirty state (delegated ke meta callbacks dari Phase 2+)
 *
 * Persist user preferences ke localStorage per (dataset, table).
 *
 * NOT handle: data fetch (parent passes rows), editor logic (delegated ke meta).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFacetedMinMaxValues,
    getExpandedRowModel,
    getGroupedRowModel,
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
    type ColumnPinningState,
    type VisibilityState,
    type ColumnOrderState,
    type RowSelectionState,
    type PaginationState,
    type ColumnSizingState,
    type ExpandedState,
    type GroupingState,
    type Table,
} from "@tanstack/react-table";
import type { ColumnMeta as ColumnSchema, RowData } from "@/app/data-input/_workspace/types";
import { spacePrefsKey } from "./space-tokens";
import { pinningFromSchemas, visibilityFromSchemas } from "./useSpaceColumns";

interface PersistedPrefs {
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    columnPinning?: ColumnPinningState;
    columnVisibility?: VisibilityState;
    columnOrder?: ColumnOrderState;
    columnSizing?: ColumnSizingState;
    pagination?: PaginationState;
    globalFilter?: string;
}

function readPrefs(key: string): PersistedPrefs {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as PersistedPrefs) : {};
    } catch { return {}; }
}
function writePrefs(key: string, prefs: PersistedPrefs) {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(key, JSON.stringify(prefs)); } catch { /* quota */ }
}

export interface UseSpaceTableArgs {
    dataset: string;
    table: string;
    columns: ColumnDef<RowData>[];
    rows: RowData[];
    schemas: readonly ColumnSchema[];
    readOnly?: boolean;
    /** TableMeta callbacks (Phase 2+ wires these). */
    meta: {
        updateCell: (rowIdx: number, colId: string, value: unknown) => void;
        commitRow: (rowIdx: number) => Promise<{ ok: boolean; error?: string }>;
        refresh: () => void | Promise<void>;
        isDirty: (rowIdx: number, colId?: string) => boolean;
        getError: (rowIdx: number, colId: string) => string | null;
        getOriginalValue: (rowIdx: number, colId: string) => unknown;
        getCellValue?: (rowIdx: number, colId: string) => unknown;
        consumerDataset?: string;
        consumerTable?: string;
    };
}

export interface UseSpaceTableResult {
    table: Table<RowData>;
    /** Reset semua user prefs (clear localStorage). */
    resetPrefs: () => void;
    globalFilter: string;
    setGlobalFilter: (q: string) => void;
}

export function useSpaceTable(args: UseSpaceTableArgs): UseSpaceTableResult {
    const { dataset, table: tableName, columns, rows, schemas, readOnly, meta } = args;
    const lsKey = useMemo(() => spacePrefsKey(dataset, tableName), [dataset, tableName]);

    // Initial state (LS wins, falls back ke schema-derived defaults).
    const initial = useMemo(() => readPrefs(lsKey), [lsKey]);

    const [sorting, setSorting] = useState<SortingState>(initial.sorting ?? []);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initial.columnFilters ?? []);
    const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
        initial.columnPinning ?? pinningFromSchemas(schemas),
    );
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        initial.columnVisibility ?? visibilityFromSchemas(schemas),
    );
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(initial.columnOrder ?? []);
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(initial.columnSizing ?? {});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    // Pagination state — sebagian besar tabel pakai virtualization (no pagination).
    // Page size besar = render all rows in 1 page (virtualizer handle smooth scroll).
    // Pagination UI di status bar otomatis hide kalau pageCount = 1.
    const [pagination, setPagination] = useState<PaginationState>(
        initial.pagination ?? { pageIndex: 0, pageSize: 100000 },
    );
    const [globalFilter, setGlobalFilter] = useState<string>(initial.globalFilter ?? "");
    const [expanded, setExpanded] = useState<ExpandedState>({});
    const [grouping, setGrouping] = useState<GroupingState>([]);

    // Persist prefs on change (debounced via ref + raf supaya ga thrash storage).
    const writeRef = useRef<number | null>(null);
    useEffect(() => {
        if (writeRef.current) cancelAnimationFrame(writeRef.current);
        writeRef.current = requestAnimationFrame(() => {
            writePrefs(lsKey, {
                sorting,
                columnFilters,
                columnPinning,
                columnVisibility,
                columnOrder,
                columnSizing,
                pagination,
                globalFilter,
            });
        });
        return () => {
            if (writeRef.current) cancelAnimationFrame(writeRef.current);
        };
    }, [lsKey, sorting, columnFilters, columnPinning, columnVisibility, columnOrder, columnSizing, pagination, globalFilter]);

    // Build column-id → ColumnSchema map sekali (referensi cepat di cells).
    const columnSchemas = useMemo(() => {
        const m = new Map<string, ColumnSchema>();
        for (const s of schemas) m.set(s.name, s);
        return m;
    }, [schemas]);

    const table = useReactTable<RowData>({
        data: rows,
        columns,
        state: {
            sorting,
            columnFilters,
            columnPinning,
            columnVisibility,
            columnOrder,
            columnSizing,
            rowSelection,
            pagination,
            globalFilter,
            expanded,
            grouping,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnPinningChange: setColumnPinning,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnOrderChange: setColumnOrder,
        onColumnSizingChange: setColumnSizing,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        onGlobalFilterChange: setGlobalFilter,
        onExpandedChange: setExpanded,
        onGroupingChange: setGrouping,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        getFacetedMinMaxValues: getFacetedMinMaxValues(),
        getExpandedRowModel: getExpandedRowModel(),
        getGroupedRowModel: getGroupedRowModel(),
        enableRowSelection: !readOnly,
        enableColumnResizing: true,
        enableGrouping: true,
        enableExpanding: true,
        // "onChange" = real-time resize, body cells follow header width SAMBIL drag.
        // Spreadsheet-like UX (Google Sheets / Excel pattern). Memo BodyCellWrap +
        // event delegation di row level membuat re-render cost manageable.
        columnResizeMode: "onChange",
        // Default filter: sheet-style "allowed values" Set (Google Sheets pattern).
        defaultColumn: {
            filterFn: (row, columnId, filterValue) => {
                if (!(filterValue instanceof Set)) return true;
                const v = row.getValue(columnId);
                const key = v == null ? "__NULL__" : String(v);
                return filterValue.has(key);
            },
        },
        columnResizeDirection: "ltr",
        meta: {
            ...meta,
            columnSchemas,
            readOnly,
        },
    });

    const resetPrefs = useCallback(() => {
        if (typeof window === "undefined") return;
        try { window.localStorage.removeItem(lsKey); } catch { /* noop */ }
        setSorting([]);
        setColumnFilters([]);
        setColumnPinning(pinningFromSchemas(schemas));
        setColumnVisibility(visibilityFromSchemas(schemas));
        setColumnOrder([]);
        setColumnSizing({});
        setPagination({ pageIndex: 0, pageSize: 100 });
        setGlobalFilter("");
    }, [lsKey, schemas]);

    return { table, resetPrefs, globalFilter, setGlobalFilter };
}
