"use client";

/**
 * useDraftMode — local edits staged, batch commit via Save.
 *
 *  State:
 *   ▸ rows        — local mirror of serverRows (mutations local until save)
 *   ▸ dirtyMap    — pk → "NEW" | "DIRTY" | "DELETED"
 *   ▸ originalRows — snapshot untuk diff + revert
 *   ▸ undoStack/redoStack — history (10 steps)
 *
 *  Handlers:
 *   ▸ handleRowsChange       — onRowsChange dari RDG, promote staging → NEW
 *   ▸ handleCellCopy / Paste / handleFill  — RDG events, paste respect readOnly + parse type
 *   ▸ handleCellKeyDown      — Esc (deselect) / Delete (bulk mark) / Ctrl-Z / Ctrl-Y
 *   ▸ markDeleted            — toggle delete/undelete; NEW row = cancel insert
 *   ▸ saveChanges / discardChanges
 *
 *  Derived:
 *   ▸ pendingCount, stagingRow, rowClass
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CellCopyArgs, CellPasteArgs, FillEvent, CellKeyDownArgs, CellKeyboardEvent } from "react-data-grid";
import type { ColumnMeta, RowData } from "../types";

type DraftStatus = "NEW" | "DIRTY" | "DELETED";
type ShowToast = (kind: "ok" | "err", msg: string) => void;

interface DraftConfig {
    primaryKey: string;
    dataset: string;
    table: string;
}

export function useDraftMode(params: {
    config: DraftConfig;
    columns: ColumnMeta[];
    serverRows: RowData[];
    selectedRows: Set<string>;
    setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
    onUpdateRow: (pk: string, changes: Record<string, unknown>, updatedAtAtRead?: string) => Promise<void>;
    onArchiveRow: (pk: string) => Promise<void>;
    onRefresh: () => void;
    showToast: ShowToast;
}) {
    const { config, columns, serverRows, selectedRows, setSelectedRows,
        onUpdateRow, onArchiveRow, onRefresh, showToast } = params;

    const [rows, setRows] = useState<RowData[]>(serverRows);
    const [dirtyMap, setDirtyMap] = useState<Record<string, DraftStatus>>({});
    const [originalRows, setOriginalRows] = useState<Record<string, RowData>>({});
    const [saving, setSaving] = useState(false);
    const [undoStack, setUndoStack] = useState<RowData[][]>([]);
    const [redoStack, setRedoStack] = useState<RowData[][]>([]);

    // Stable refs untuk closure-heavy callbacks
    const toastRef = useRef(showToast);
    toastRef.current = showToast;
    const selectedRowsRef = useRef(selectedRows);
    selectedRowsRef.current = selectedRows;

    // Sync server reload → local mirror + reset dirty
    useEffect(() => { setRows(serverRows); }, [serverRows]);
    useEffect(() => {
        const snap: Record<string, RowData> = {};
        for (const r of serverRows) snap[String(r[config.primaryKey])] = { ...r };
        setOriginalRows(snap);
        setDirtyMap({});
    }, [serverRows, config.primaryKey]);

    const stagingRow: RowData = useMemo(() => {
        const r: RowData = { [config.primaryKey]: "__staging__" };
        const visibleCols = columns.filter((c) => !c.hidden);
        const firstVisibleCol = visibleCols.find((c) => c.name !== config.primaryKey && !c.readOnly);
        for (const c of columns) {
            if (c.name === config.primaryKey) continue;
            if (c.name === firstVisibleCol?.name) r[c.name] = "Tambah row baru — click di sini";
            else r[c.name] = "";
        }
        return r;
    }, [columns, config.primaryKey]);

    const handleRowsChange = useCallback((newRows: RowData[], data: { indexes: number[]; column: { key: string } }) => {
        setUndoStack((prev) => [...prev.slice(-9), rows]);
        setRedoStack([]);

        const colKey = data.column.key;
        const updatedRows: RowData[] = [...rows];
        const newDirty = { ...dirtyMap };

        for (const idx of data.indexes) {
            const changedRow = newRows[idx];
            if (!changedRow) continue;
            const pk = String(changedRow[config.primaryKey] ?? "");

            if (pk === "__staging__") {
                const tempId = `__new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const cleanRow: RowData = { ...changedRow, [config.primaryKey]: tempId };
                for (const [k, v] of Object.entries(cleanRow)) {
                    if (v === "Tambah row baru — click di sini") cleanRow[k] = "";
                }
                updatedRows.push(cleanRow);
                newDirty[tempId] = "NEW";
                continue;
            }

            const existingIdx = updatedRows.findIndex((r) => String(r[config.primaryKey]) === pk);
            if (existingIdx >= 0) {
                updatedRows[existingIdx] = { ...updatedRows[existingIdx], [colKey]: changedRow[colKey] };
                if (newDirty[pk] !== "NEW") newDirty[pk] = "DIRTY";
            }
        }

        setRows(updatedRows);
        setDirtyMap(newDirty);
    }, [rows, config.primaryKey, dirtyMap]);

    const markDeleted = useCallback((pk: string) => {
        setDirtyMap((prev) => {
            const next = { ...prev };
            if (next[pk] === "DELETED") delete next[pk];
            else if (next[pk] === "NEW") {
                setRows((rs) => rs.filter((r) => String(r[config.primaryKey]) !== pk));
                delete next[pk];
                return next;
            } else {
                next[pk] = "DELETED";
            }
            return next;
        });
    }, [config.primaryKey]);

    const discardChanges = useCallback(() => {
        if (!confirm("Buang semua perubahan yang belum disimpan?")) return;
        setRows(serverRows);
        setDirtyMap({});
        toastRef.current("ok", "Perubahan dibuang, reset ke server state");
    }, [serverRows]);

    const saveChanges = useCallback(async () => {
        const newRows: RowData[] = [];
        const dirtyPks: string[] = [];
        const deletedPks: string[] = [];
        for (const [pk, status] of Object.entries(dirtyMap)) {
            if (status === "NEW") {
                const r = rows.find((x) => String(x[config.primaryKey]) === pk);
                if (r) {
                    const values: RowData = {};
                    for (const [k, v] of Object.entries(r)) {
                        if (k === config.primaryKey) continue;
                        if (v === "" || v == null) continue;
                        values[k] = v;
                    }
                    if (Object.keys(values).length > 0) newRows.push(values);
                }
            } else if (status === "DIRTY") dirtyPks.push(pk);
            else if (status === "DELETED") deletedPks.push(pk);
        }

        if (newRows.length === 0 && dirtyPks.length === 0 && deletedPks.length === 0) {
            toastRef.current("ok", "Tidak ada perubahan");
            return;
        }

        setSaving(true);
        let insertedOk = 0, updatedOk = 0, deletedOk = 0;
        const errors: string[] = [];

        try {
            if (newRows.length > 0) {
                const res = await fetch(
                    `/api/data-input/datasets/${encodeURIComponent(config.dataset)}/tables/${encodeURIComponent(config.table)}/rows/batch`,
                    { method: "POST", headers: { "content-type": "application/json" },
                      body: JSON.stringify({ rows: newRows, actor: "admin" }) },
                ).then((r) => r.json());
                insertedOk = res.inserted ?? 0;
                if (res.failed?.length > 0) errors.push(`${res.failed.length} insert failed`);
            }

            for (const pk of dirtyPks) {
                const currentRow = rows.find((r) => String(r[config.primaryKey]) === pk);
                const origRow = originalRows[pk];
                if (!currentRow || !origRow) continue;
                const changes: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(currentRow)) {
                    if (k === config.primaryKey) continue;
                    if (v !== origRow[k]) changes[k] = v;
                }
                if (Object.keys(changes).length === 0) continue;
                try {
                    await onUpdateRow(pk, changes, origRow["updated_at"] ? String(origRow["updated_at"]) : undefined);
                    updatedOk++;
                } catch (e) {
                    errors.push(`Update ${pk}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }

            for (const pk of deletedPks) {
                try {
                    await onArchiveRow(pk);
                    deletedOk++;
                } catch (e) {
                    errors.push(`Delete ${pk}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }

            if (errors.length > 0) toastRef.current("err", `Sebagian gagal: ${errors[0]}`);
            else toastRef.current("ok", `Saved: ${insertedOk} new, ${updatedOk} updated, ${deletedOk} deleted`);
            setDirtyMap({});
            onRefresh();
        } catch (err) {
            toastRef.current("err", err instanceof Error ? err.message : "Gagal menyimpan perubahan");
        } finally {
            setSaving(false);
        }
    }, [dirtyMap, rows, originalRows, config, onUpdateRow, onArchiveRow, onRefresh]);

    const handleCellKeyDown = useCallback((_args: CellKeyDownArgs<RowData>, event: CellKeyboardEvent) => {
        const sel = selectedRowsRef.current;
        if (event.key === "Escape" && sel.size > 0) {
            event.preventGridDefault();
            setSelectedRows(new Set());
            return;
        }
        if (event.key === "Delete" && sel.size > 0) {
            event.preventGridDefault();
            if (confirm(`Mark ${sel.size} ${sel.size === 1 ? "row" : "rows"} for deletion?\n\nChanges staged — commit via Save.`)) {
                sel.forEach((pk) => markDeleted(pk));
                toastRef.current("ok", `${sel.size} rows marked — click Save to commit`);
                setSelectedRows(new Set());
            }
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
            event.preventDefault();
            setUndoStack((stack) => {
                if (stack.length === 0) return stack;
                const last = stack[stack.length - 1];
                setRedoStack((r) => [...r.slice(-9), rows]);
                setRows(last);
                toastRef.current("ok", "Undo");
                return stack.slice(0, -1);
            });
        } else if ((event.ctrlKey || event.metaKey) && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
            event.preventDefault();
            setRedoStack((stack) => {
                if (stack.length === 0) return stack;
                const next = stack[stack.length - 1];
                setUndoStack((u) => [...u.slice(-9), rows]);
                setRows(next);
                toastRef.current("ok", "Redo");
                return stack.slice(0, -1);
            });
        }
    }, [rows, markDeleted, setSelectedRows]);

    const handleCellCopy = useCallback((args: CellCopyArgs<RowData>, event: React.ClipboardEvent) => {
        const val = args.row[args.column.key];
        event.clipboardData.setData("text/plain", val == null ? "" : String(val));
    }, []);

    const handleCellPaste = useCallback((args: CellPasteArgs<RowData>, event: React.ClipboardEvent): RowData => {
        const raw = event.clipboardData.getData("text/plain");
        const col = columns.find((c) => c.name === args.column.key);
        if (!col || col.readOnly) return args.row;
        let parsed: unknown = raw;
        if (col.type === "INT64") parsed = raw === "" ? null : parseInt(raw, 10);
        else if (col.type === "FLOAT64" || col.type === "NUMERIC") parsed = raw === "" ? null : parseFloat(raw);
        else if (col.type === "BOOL") parsed = /^(true|yes|y|1)$/i.test(raw.trim());
        return { ...args.row, [args.column.key]: parsed as RowData[string] };
    }, [columns]);

    const handleFill = useCallback(({ columnKey, sourceRow, targetRow }: FillEvent<RowData>): RowData => {
        const col = columns.find((c) => c.name === columnKey);
        if (!col || col.readOnly) return targetRow;
        return { ...targetRow, [columnKey]: sourceRow[columnKey] };
    }, [columns]);

    const rowClass = useCallback((row: RowData) => {
        const pk = String(row[config.primaryKey]);
        if (pk === "__staging__") return "di-row-staging";
        const status = dirtyMap[pk];
        if (status === "NEW") return "di-row-new";
        if (status === "DIRTY") return "di-row-dirty";
        if (status === "DELETED") return "di-row-deleted";
        if (selectedRows.has(pk)) return "di-row-selected";
        return "";
    }, [dirtyMap, selectedRows, config.primaryKey]);

    const pendingCount = Object.keys(dirtyMap).length;

    return {
        rows, dirtyMap, originalRows, saving, pendingCount, stagingRow,
        handleRowsChange, handleCellCopy, handleCellPaste, handleFill, handleCellKeyDown,
        markDeleted, saveChanges, discardChanges, rowClass,
    };
}
