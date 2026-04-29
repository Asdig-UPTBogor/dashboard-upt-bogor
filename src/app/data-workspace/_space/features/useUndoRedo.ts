/**
 * useUndoRedo — Ctrl+Z / Ctrl+Shift+Z stack untuk dirty-state cell edits.
 *
 * Stack entries: { rowIdx, colId, prev, next, ts }
 * Default depth: 50 entries.
 *
 * Pattern: parent panggil `recordEdit()` setiap kali user commit dari editor.
 * undo()/redo() kembalikan entry → parent re-apply (call meta.updateCell).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RowValue } from "@/app/data-input/_workspace/types";

interface Edit {
    rowIdx: number;
    colId: string;
    prev: RowValue | undefined;
    next: RowValue | undefined;
    ts: number;
}

const DEFAULT_DEPTH = 50;

export interface UseUndoRedoApi {
    recordEdit: (rowIdx: number, colId: string, prev: RowValue | undefined, next: RowValue | undefined) => void;
    undo: () => Edit | undefined;
    redo: () => Edit | undefined;
    canUndo: boolean;
    canRedo: boolean;
    clear: () => void;
}

export function useUndoRedo(opts?: { depth?: number; onUndo?: (e: Edit) => void; onRedo?: (e: Edit) => void }): UseUndoRedoApi {
    const depth = opts?.depth ?? DEFAULT_DEPTH;
    const undoStackRef = useRef<Edit[]>([]);
    const redoStackRef = useRef<Edit[]>([]);
    const [, force] = useState(0);
    const refresh = useCallback(() => force((n) => n + 1), []);

    // PERF: opts pakai ref biar undo/redo TIDAK re-create tiap render parent.
    // Object literal opts dari Space.tsx selalu identity-baru tiap render —
    // tanpa ref ini, deps `[opts]` invalidate undo/redo → useEffect keyboard
    // di-detach+reattach setiap render parent.
    const onUndoRef = useRef(opts?.onUndo);
    const onRedoRef = useRef(opts?.onRedo);
    onUndoRef.current = opts?.onUndo;
    onRedoRef.current = opts?.onRedo;

    const recordEdit = useCallback((rowIdx: number, colId: string, prev: RowValue | undefined, next: RowValue | undefined) => {
        undoStackRef.current.push({ rowIdx, colId, prev, next, ts: Date.now() });
        if (undoStackRef.current.length > depth) undoStackRef.current.shift();
        redoStackRef.current = []; // new edit invalidates redo stack
        refresh();
    }, [depth, refresh]);

    const undo = useCallback(() => {
        const e = undoStackRef.current.pop();
        if (!e) return undefined;
        redoStackRef.current.push(e);
        refresh();
        onUndoRef.current?.(e);
        return e;
    }, [refresh]);

    const redo = useCallback(() => {
        const e = redoStackRef.current.pop();
        if (!e) return undefined;
        undoStackRef.current.push(e);
        refresh();
        onRedoRef.current?.(e);
        return e;
    }, [refresh]);

    const clear = useCallback(() => {
        undoStackRef.current = [];
        redoStackRef.current = [];
        refresh();
    }, []);

    // Global Ctrl+Z / Ctrl+Shift+Z handler.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (!(e.ctrlKey || e.metaKey)) return;
            const tgt = e.target as HTMLElement | null;
            // Skip kalau focus di input editor
            if (tgt?.matches("input, textarea, select, [contenteditable]")) return;
            if (e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
                e.preventDefault();
                redo();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo]);

    return {
        recordEdit, undo, redo, clear,
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
    };
}
