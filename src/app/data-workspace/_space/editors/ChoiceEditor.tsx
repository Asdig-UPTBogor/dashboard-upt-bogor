"use client";

/**
 * ChoiceEditor — thin wrapper di atas `DropdownCell`.
 *
 * Versi lama (custom portal + getBoundingClientRect manual) sudah dihapus —
 * sekarang delegate sepenuhnya ke shadcn `Popover` + `Command` lewat
 * `DropdownCell`. Wrapper ini dipakai oleh `EditorRouter` (RowFormModal,
 * inline form) — di Space cell, SpaceBodyCell render `DropdownCellAdapter`
 * langsung tanpa lewat EditorRouter.
 *
 * `autoFocus` prop = trigger popover auto-open. Default `true` (cell mode
 * — user baru saja enter edit). Set `false` di context modal/form supaya
 * popover tidak buka sendiri saat mount.
 */

import type { CellEditorProps } from "./types";
import { DropdownCell, type DropdownOption } from "../ui/DropdownCell";

export function ChoiceEditor({
    value, onCommit, onCancel, columnMeta, autoFocus = true,
}: CellEditorProps) {
    const choices: ReadonlyArray<DropdownOption> = columnMeta?.choices ?? [];
    const cur = value == null ? null : String(value);
    return (
        <DropdownCell
            value={cur}
            options={choices}
            onCommit={onCommit}
            placeholder="Pilih..."
            showColor
            autoOpen={autoFocus}
            onClose={onCancel}
        />
    );
}
