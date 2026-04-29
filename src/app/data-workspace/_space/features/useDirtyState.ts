/**
 * useDirtyState — track edit state per (rowIdx, colId) tanpa mutate source rows.
 *
 *  ┌─ originals (ref, snapshot raw rows pertama kali load) ──────────────┐
 *  │   [rowIdx → { colId → value }]                                       │
 *  ├─ overlays (state, edit user yg belum committed) ─────────────────────┤
 *  │   [rowIdx → { colId → newValue }]                                    │
 *  └─ getCellValue(rowIdx, colId) = overlay.colId ?? originals.colId ─────┘
 *
 * Persist overlay ke localStorage per (dataset, table) → survive refresh.
 *
 * API:
 *  - getCellValue(rowIdx, colId)         → resolved value (overlay-aware)
 *  - updateCell(rowIdx, colId, value)    → set overlay
 *  - revertCell(rowIdx, colId)           → drop overlay (back to original)
 *  - revertRow(rowIdx)                   → drop semua overlay row
 *  - revertAll()                         → drop semua overlay
 *  - isDirty(rowIdx, colId?)             → query dirty state
 *  - dirtyCount                          → total cells dirty
 *  - dirtyRows                           → set of rowIdx yg punya minimal 1 dirty cell
 *  - getRowPatch(rowIdx)                 → { colId: newValue, ... } untuk dikirim ke save endpoint
 *  - markRowSaved(rowIdx)                → drop overlay setelah save sukses, update originals snapshot
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RowData, RowValue } from "@/app/data-input/_workspace/types";
import { spaceDraftKey } from "../core/space-tokens";

type CellMap = Record<string, RowValue>;
type OverlayMap = Record<number, CellMap>;

export interface UseDirtyStateArgs {
    dataset: string;
    table: string;
    /** Source rows. Saat sumber ganti (refresh, switch table) — originals di-resync. */
    rows: readonly RowData[];
}

export interface UseDirtyStateApi {
    getCellValue: (rowIdx: number, colId: string) => RowValue | undefined;
    updateCell: (rowIdx: number, colId: string, value: RowValue) => void;
    revertCell: (rowIdx: number, colId: string) => void;
    revertRow: (rowIdx: number) => void;
    revertAll: () => void;
    isDirty: (rowIdx: number, colId?: string) => boolean;
    getOriginalValue: (rowIdx: number, colId: string) => RowValue | undefined;
    getRowPatch: (rowIdx: number) => CellMap;
    markRowSaved: (rowIdx: number) => void;
    dirtyCount: number;
    dirtyRows: ReadonlyArray<number>;
}

function readDraft(key: string): OverlayMap {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as OverlayMap) : {};
    } catch { return {}; }
}
function writeDraft(key: string, overlay: OverlayMap) {
    if (typeof window === "undefined") return;
    try {
        const isEmpty = Object.keys(overlay).length === 0;
        if (isEmpty) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(overlay));
    } catch { /* quota */ }
}

export function useDirtyState({ dataset, table, rows }: UseDirtyStateArgs): UseDirtyStateApi {
    const lsKey = useMemo(() => spaceDraftKey(dataset, table), [dataset, table]);

    /** Overlay = pending edits, indexed by rowIdx → colId → newValue. */
    const [overlay, setOverlay] = useState<OverlayMap>(() => readDraft(lsKey));

    /** Originals snapshot (mutable ref — re-set on rows change). */
    const originalsRef = useRef<readonly RowData[]>(rows);
    useEffect(() => { originalsRef.current = rows; }, [rows]);

    // Persist overlay ke LS (debounced via raf).
    const writeRef = useRef<number | null>(null);
    useEffect(() => {
        if (writeRef.current) cancelAnimationFrame(writeRef.current);
        writeRef.current = requestAnimationFrame(() => writeDraft(lsKey, overlay));
        return () => { if (writeRef.current) cancelAnimationFrame(writeRef.current); };
    }, [lsKey, overlay]);

    const getOriginalValue = useCallback(
        (rowIdx: number, colId: string): RowValue | undefined => originalsRef.current[rowIdx]?.[colId],
        [],
    );

    const getCellValue = useCallback(
        (rowIdx: number, colId: string): RowValue | undefined => {
            const o = overlay[rowIdx];
            if (o && colId in o) return o[colId];
            return getOriginalValue(rowIdx, colId);
        },
        [overlay, getOriginalValue],
    );

    const updateCell = useCallback((rowIdx: number, colId: string, value: RowValue) => {
        setOverlay((prev) => {
            const original = originalsRef.current[rowIdx]?.[colId];
            const same = sameValue(original, value);
            const next = { ...prev };
            const rowOverlay = { ...(next[rowIdx] ?? {}) };
            if (same) {
                // Revert ke original = drop overlay entry.
                delete rowOverlay[colId];
            } else {
                rowOverlay[colId] = value;
            }
            if (Object.keys(rowOverlay).length === 0) delete next[rowIdx];
            else next[rowIdx] = rowOverlay;
            return next;
        });
    }, []);

    const revertCell = useCallback((rowIdx: number, colId: string) => {
        setOverlay((prev) => {
            const o = prev[rowIdx];
            if (!o || !(colId in o)) return prev;
            const next = { ...prev };
            const rowOverlay = { ...o };
            delete rowOverlay[colId];
            if (Object.keys(rowOverlay).length === 0) delete next[rowIdx];
            else next[rowIdx] = rowOverlay;
            return next;
        });
    }, []);

    const revertRow = useCallback((rowIdx: number) => {
        setOverlay((prev) => {
            if (!(rowIdx in prev)) return prev;
            const next = { ...prev };
            delete next[rowIdx];
            return next;
        });
    }, []);

    const revertAll = useCallback(() => setOverlay({}), []);

    const isDirty = useCallback((rowIdx: number, colId?: string) => {
        const o = overlay[rowIdx];
        if (!o) return false;
        if (colId === undefined) return true;
        return colId in o;
    }, [overlay]);

    const getRowPatch = useCallback((rowIdx: number): CellMap => overlay[rowIdx] ?? {}, [overlay]);

    const markRowSaved = useCallback((rowIdx: number) => {
        // Drop overlay (data sudah commit ke source). Originals akan auto-update saat parent
        // refetch + push rows baru.
        revertRow(rowIdx);
    }, [revertRow]);

    const dirtyRows = useMemo(() => Object.keys(overlay).map((k) => Number(k)), [overlay]);
    const dirtyCount = useMemo(() => {
        let n = 0;
        for (const rowOverlay of Object.values(overlay)) n += Object.keys(rowOverlay).length;
        return n;
    }, [overlay]);

    // PERF: useMemo agar return object identity stable selama dependency tidak
    // berubah. Tanpa ini, setiap render parent bikin object literal baru →
    // consumer (Space.tsx meta useMemo) menganggap dirty "berubah" → cascade
    // re-render seluruh grid.
    return useMemo(() => ({
        getCellValue, updateCell, revertCell, revertRow, revertAll,
        isDirty, getOriginalValue, getRowPatch, markRowSaved,
        dirtyCount, dirtyRows,
    }), [
        getCellValue, updateCell, revertCell, revertRow, revertAll,
        isDirty, getOriginalValue, getRowPatch, markRowSaved,
        dirtyCount, dirtyRows,
    ]);
}

/** Strict equality untuk RowValue (handle null/undefined/array). */
function sameValue(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((v, i) => sameValue(v, b[i]));
    }
    // Primitives — fallback string compare untuk number↔string typo (e.g. "12" vs 12).
    return String(a) === String(b);
}
