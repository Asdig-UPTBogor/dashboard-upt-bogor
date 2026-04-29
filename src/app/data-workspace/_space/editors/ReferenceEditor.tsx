"use client";

/**
 * ReferenceEditor — thin wrapper di atas `DropdownCell`.
 *
 * Versi lama (custom portal manual) sudah dihapus. Sekarang delegate
 * sepenuhnya ke shadcn `Popover` + `Command` lewat `DropdownCell`.
 * Source options di-fetch via `useReferenceLookup` (cache module-level).
 *
 * Wrapper ini dipakai EditorRouter (RowFormModal, inline form). Di Space
 * cell langsung lewat `DropdownCellAdapter` — bypass EditorRouter.
 *
 * `autoFocus` prop = gate popover auto-open. Default `true` (cell edit).
 * Set `false` di modal/form context.
 */

import type { CellEditorProps } from "./types";
import { DropdownCell, type DropdownOption } from "../ui/DropdownCell";
import { useReferenceLookup } from "../features/useReferenceCache";

export function ReferenceEditor({
    value, onCommit, onCancel, columnMeta, consumerTable, autoFocus = true,
}: CellEditorProps) {
    const ref = columnMeta?.reference;
    const { options, loading, error } = useReferenceLookup(ref, consumerTable);
    const cur = value == null ? null : String(value);
    const sourceLabel = ref ? `${ref.dataset}.${ref.table}` : undefined;
    return (
        <DropdownCell
            value={cur}
            options={options as ReadonlyArray<DropdownOption>}
            onCommit={onCommit}
            placeholder="Pilih referensi..."
            autoOpen={autoFocus}
            onClose={onCancel}
            loading={loading}
            error={error}
            sourceLabel={sourceLabel}
        />
    );
}
