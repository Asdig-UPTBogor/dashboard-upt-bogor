"use client";

/**
 * SpaceBodyCell — interactive cell wrapper.
 *
 * Tiga jalur render:
 *  1. Dropdown editor (CHOICE / CHOICE_CASCADE / REFERENCE) tidak read-only:
 *     render `DropdownCell` (shadcn Popover + Command) — value selalu tampil
 *     bareng chevron, click trigger buka picker.
 *  2. Inline editor (TEXT / NUMBER / DATE / dst) saat `isEditing=true`:
 *     render `EditorRouter` (input swap menggantikan cell content).
 *  3. Default: render `CellRenderer` (read-only view).
 *
 * Edit state DIPASS via prop `isEditing` (lifted ke Space.tsx) supaya
 * React.memo di parent (BodyCellWrap) bisa skip re-render cell yang TIDAK
 * terlibat saat editingCell berubah.
 */

import { useCallback } from "react";
import type { Cell } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import type { RowData, RowValue } from "@/app/data-input/_workspace/types";
import { EditorRouter } from "../editors/EditorRouter";
import type { EditorKind } from "../editors/types";
import { DropdownCellAdapter } from "./DropdownCellAdapter";

const DROPDOWN_EDITORS: ReadonlySet<EditorKind> = new Set([
    "CHOICE", "CHOICE_CASCADE", "REFERENCE",
]);

interface Props {
    cell: Cell<RowData, unknown>;
    isEditing: boolean;
    onRequestEdit?: (rowIdx: number, colId: string) => void;
    onExitEdit?: () => void;
}

export function SpaceBodyCell({ cell, isEditing, onRequestEdit, onExitEdit }: Props) {
    const meta = cell.column.columnDef.meta;
    const tableMeta = cell.getContext().table.options.meta;
    const editor = meta?.editor as EditorKind | undefined;
    const isNumber = editor === "NUMBER" || editor === "FLOAT";
    const isBool = editor === "BOOL";
    const isDropdown = editor ? DROPDOWN_EDITORS.has(editor) : false;
    const readOnly = tableMeta?.readOnly === true || cell.column.columnDef.meta?.schema?.readOnly === true;

    const rowIdx = cell.row.index;
    const colId = cell.column.id;
    const dirty = tableMeta?.isDirty(rowIdx, colId) ?? false;

    const enterEdit = useCallback(() => {
        if (readOnly) return;
        onRequestEdit?.(rowIdx, colId);
    }, [readOnly, onRequestEdit, rowIdx, colId]);

    const exitEdit = useCallback(() => {
        onExitEdit?.();
    }, [onExitEdit]);

    const onCommit = useCallback((next: RowValue) => {
        tableMeta?.updateCell(rowIdx, colId, next);
        onExitEdit?.();
    }, [tableMeta, rowIdx, colId, onExitEdit]);

    const dirtyClass = dirty ? "bg-amber-500/10 border-l-2 border-amber-500" : "";

    // ── Path 1: Dropdown editor (always-on popover trigger, never swap) ──
    if (isDropdown && editor) {
        const resolvedValue = tableMeta?.getCellValue?.(rowIdx, colId) ?? cell.getValue();
        return (
            <div className={`group/cell relative h-full w-full overflow-hidden ${
                isDropdown && !dirty && !readOnly ? "bg-primary/[0.025]" : ""
            } ${dirtyClass}`}>
                <DropdownCellAdapter
                    editor={editor}
                    meta={meta}
                    rowOriginal={cell.row.original}
                    colId={colId}
                    consumerDataset={tableMeta?.consumerDataset}
                    consumerTable={tableMeta?.consumerTable}
                    value={resolvedValue}
                    onCommit={onCommit}
                    autoOpen={isEditing}
                    onClose={exitEdit}
                    disabled={readOnly}
                    onSchemaChanged={() => { void tableMeta?.refresh?.(); }}
                />
            </div>
        );
    }

    // ── Path 2: Inline editor swap ──
    if (isEditing && editor) {
        const resolved = tableMeta?.getCellValue?.(rowIdx, colId) ?? cell.getValue();
        return (
            <div className="h-full flex items-stretch ring-2 ring-primary ring-offset-0 bg-primary/5 z-[6]">
                <EditorRouter
                    editor={editor}
                    value={resolved as RowValue | undefined}
                    onCommit={onCommit}
                    onCancel={exitEdit}
                    columnMeta={meta}
                    required={meta?.required}
                    autoFocus
                    consumerTable={tableMeta?.consumerTable}
                />
            </div>
        );
    }

    // ── Path 3: Read-only view ──
    return (
        <div
            onDoubleClick={enterEdit}
            className={`h-full w-full flex items-center px-2.5 text-xs overflow-hidden select-none ${
                readOnly ? "cursor-default" : "cursor-cell"
            } ${
                isNumber ? "justify-end" : isBool ? "justify-center" : "justify-start"
            } ${dirtyClass}`}
            title={readOnly ? "Read-only" : "Dobel-klik / Enter / F2 untuk edit"}
        >
            {flexRender(cell.column.columnDef.cell ?? (() => null), cell.getContext())}
        </div>
    );
}
