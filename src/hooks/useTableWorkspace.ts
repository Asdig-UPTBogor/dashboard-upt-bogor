"use client";

/**
 * useTableWorkspace(ds, t) — hook generic untuk workspace grid.
 *
 * Fetch schema (BQ + Firestore overlay merged) + rows + mutators.
 * Dipakai di /data-input/[ds]/[t].
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnMeta, RowData } from "@/app/data-input/_workspace/types";
import { apiFetch, formatApiError, ApiError } from "@/lib/api-client";
import { swrFetch, invalidate } from "@/lib/workspace-cache";

export interface TableMeta {
    dataset: string;
    table: string;
    description?: string;
    tableAlias?: string;
    numRows: number;
    numBytes: number;
    type: string;
    primaryKey: string;
    displayKey: string;
    defaultSort?: { column: string; direction: "asc" | "desc" };
    icon?: string;
}

export interface TableState {
    meta: TableMeta | null;
    columns: ColumnMeta[];
    rows: RowData[];
    loading: boolean;
    error: string | null;
}

export interface TableActions {
    refresh: (forceFresh?: boolean) => Promise<void>;
    reloadSchema: () => Promise<void>;
    createRow: (values: RowData) => Promise<void>;
    updateRow: (pk: string, changes: Record<string, unknown>, updatedAtAtRead?: string) => Promise<void>;
    archiveRow: (pk: string) => Promise<void>;
}

const ACTOR = "admin";

export function useTableWorkspace(ds: string | undefined, t: string | undefined): TableState & TableActions {
    const [state, setState] = useState<TableState>({
        meta: null, columns: [], rows: [], loading: true, error: null,
    });

    const refresh = useCallback(async (forceFresh = false) => {
        if (!ds || !t) return;
        const dsE = encodeURIComponent(ds);
        const tE = encodeURIComponent(t);
        const metaKey = `tbl:${ds}/${t}`;
        const rowsKey = `rows:${ds}/${t}:chain`;

        if (forceFresh) {
            invalidate(metaKey);
            invalidate(rowsKey);
        }

        setState((s) => ({ ...s, loading: !s.meta, error: null }));

        try {
            const [meta, rows] = await Promise.all([
                swrFetch(metaKey,
                    () => apiFetch<{ ok: boolean; table: TableMeta; columns: ColumnMeta[] }>(
                        `/api/data-input/datasets/${dsE}/tables/${tE}`,
                        { timeoutMs: 30_000 },
                    ),
                    {
                        onUpdate: (m) => setState((s) => ({ ...s, meta: m.table, columns: m.columns })),
                    },
                ),
                swrFetch(rowsKey,
                    // resolveChain=true → server-side JOIN, _ancestors inlined per row
                    () => apiFetch<{ ok: boolean; rows: RowData[]; chain?: string[] }>(
                        `/api/data-input/datasets/${dsE}/tables/${tE}/rows?resolveChain=true`,
                        { timeoutMs: 30_000 },
                    ),
                    {
                        onUpdate: (r) => setState((s) => ({ ...s, rows: r.rows })),
                    },
                ),
            ]);

            setState({
                meta: meta.data.table,
                columns: meta.data.columns,
                rows: rows.data.rows,
                loading: false,
                error: null,
            });
        } catch (err) {
            setState((s) => ({ ...s, loading: false, error: formatApiError(err) }));
        }
    }, [ds, t]);

    const reloadSchema = useCallback(async () => {
        if (!ds || !t) return;
        try {
            const res = await apiFetch<{ ok: boolean; table: TableMeta; columns: ColumnMeta[] }>(
                `/api/data-input/datasets/${encodeURIComponent(ds)}/tables/${encodeURIComponent(t)}`,
                { timeoutMs: 15_000 },
            );
            setState((s) => ({ ...s, columns: res.columns, meta: res.table }));
        } catch (err) {
            console.warn("[useTableWorkspace] reloadSchema:", formatApiError(err));
        }
    }, [ds, t]);

    useEffect(() => { void refresh(); }, [refresh]);

    const rowsUrl = useMemo(() => {
        if (!ds || !t) return "";
        return `/api/data-input/datasets/${encodeURIComponent(ds)}/tables/${encodeURIComponent(t)}/rows`;
    }, [ds, t]);

    const createRow = useCallback(async (values: RowData) => {
        if (!rowsUrl || !ds || !t) return;
        try {
            await apiFetch(rowsUrl, { method: "POST", body: { values, actor: ACTOR }, timeoutMs: 20_000 });
            invalidate(`rows:${ds}/${t}`);
            await refresh(true);
        } catch (err) {
            throw new Error(formatApiError(err));
        }
    }, [rowsUrl, refresh, ds, t]);

    const updateRow = useCallback(async (pk: string, changes: Record<string, unknown>, updatedAtAtRead?: string) => {
        if (!rowsUrl || !ds || !t) return;
        try {
            await apiFetch(rowsUrl, {
                method: "PATCH",
                body: { pk, changes, updatedAtAtRead, actor: ACTOR },
                timeoutMs: 20_000,
            });
            invalidate(`rows:${ds}/${t}`);
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                throw new Error("Row sudah diubah orang lain. Refresh dulu.");
            }
            throw new Error(formatApiError(err));
        }
    }, [rowsUrl, ds, t]);

    const archiveRow = useCallback(async (pk: string) => {
        if (!rowsUrl || !ds || !t) return;
        try {
            await apiFetch(rowsUrl, { method: "DELETE", body: { pk, actor: ACTOR }, timeoutMs: 20_000 });
            invalidate(`rows:${ds}/${t}`);
            await refresh(true);
        } catch (err) {
            throw new Error(formatApiError(err));
        }
    }, [rowsUrl, refresh, ds, t]);

    return useMemo(() => ({ ...state, refresh, reloadSchema, createRow, updateRow, archiveRow }),
        [state, refresh, reloadSchema, createRow, updateRow, archiveRow]);
}

/* ─── Cross-table REFERENCE lookup ──────────────────────── */

export async function fetchCrossRows(ds: string, t: string): Promise<Array<Record<string, unknown>>> {
    try {
        const { data } = await swrFetch(
            `rows:${ds}/${t}`,
            () => apiFetch<{ ok: boolean; rows: Array<Record<string, unknown>> }>(
                `/api/data-input/datasets/${encodeURIComponent(ds)}/tables/${encodeURIComponent(t)}/rows`,
                { timeoutMs: 20_000 },
            ),
        );
        return data.rows;
    } catch (err) {
        console.warn(`[fetchCrossRows] ${ds}.${t}:`, formatApiError(err));
        return [];
    }
}
