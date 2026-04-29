"use client";

/**
 * DropdownCellAdapter — resolve options + hook source per editor type,
 * lalu delegate ke `DropdownCell` (komponen presentasi murni shadcn).
 *
 * 3 jalur:
 *  · CHOICE          → options = meta.choices
 *  · CHOICE_CASCADE  → options = meta.cascade.mapping[parentValue]
 *                      kalau parentValue kosong → disabled + hint
 *  · REFERENCE       → options dari useReferenceLookup (BQ master)
 *
 * Adapter ini satu-satunya tempat mapping editor → source. Nambah editor
 * dropdown baru cukup tambahin branch di sini, ga sentuh DropdownCell.
 */

import type { ColumnMeta as TSColumnMeta } from "@tanstack/react-table";
import type { RowData, RowValue } from "@/app/data-input/_workspace/types";
import type { EditorKind } from "../editors/types";
import { useReferenceLookup } from "../features/useReferenceCache";
import { DropdownCell, type DropdownOption } from "./DropdownCell";
import { apiFetch, formatApiError } from "@/lib/api-client";
import { toast } from "sonner";

interface Props {
    editor: EditorKind;
    meta: TSColumnMeta<RowData, unknown> | undefined;
    rowOriginal: RowData;
    /** Column id — dipakai E10 quick-add untuk PATCH schema overlay. */
    colId: string;
    consumerDataset?: string;
    consumerTable?: string;
    value: unknown;
    onCommit: (next: RowValue) => void;
    autoOpen: boolean;
    onClose: () => void;
    disabled: boolean;
    /** Trigger refresh schema setelah PATCH (E10 quick-add) supaya
     *  options array baru muncul di dropdown. */
    onSchemaChanged?: () => void;
}

const PALETTE = ["#5b8def", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export function DropdownCellAdapter({
    editor, meta, rowOriginal, colId, consumerDataset, consumerTable, value,
    onCommit, autoOpen, onClose, disabled, onSchemaChanged,
}: Props) {
    // useReferenceLookup tetap dipanggil di setiap render supaya hook order
    // konsisten — kalau editor != REFERENCE, ref undefined dan hook return
    // empty options tanpa fetch.
    const refConfig = editor === "REFERENCE" ? meta?.reference : undefined;
    const { options: refOptions, loading: refLoading, error: refError } =
        useReferenceLookup(refConfig, consumerTable);

    const valueStr = value == null ? null : String(value);

    if (editor === "CHOICE") {
        const opts: ReadonlyArray<DropdownOption> = meta?.choices ?? [];
        const canQuickAdd = !!(consumerDataset && consumerTable && colId);
        const onAddOption = canQuickAdd ? async (label: string) => {
            try {
                const next = label.trim();
                if (!next) return;
                if (opts.some((o) => o.value === next || o.label === next)) {
                    onCommit(next);
                    return;
                }
                const newColor = PALETTE[opts.length % PALETTE.length];
                const newOpt = { value: next, label: next, color: newColor };
                const updatedChoices = [...opts, newOpt];
                await apiFetch(
                    `/api/data-input/datasets/${encodeURIComponent(consumerDataset!)}/tables/${encodeURIComponent(consumerTable!)}/schema`,
                    {
                        method: "PATCH",
                        body: { columns: { [colId]: { editor: "CHOICE", choices: updatedChoices } } },
                        timeoutMs: 15_000,
                    },
                );
                onCommit(next);
                onSchemaChanged?.();
                toast.success(`Pilihan "${next}" ditambahkan`);
            } catch (e) {
                toast.error(formatApiError(e));
            }
        } : undefined;
        return (
            <DropdownCell
                value={valueStr}
                options={opts}
                onCommit={onCommit}
                placeholder="Pilih..."
                showColor
                autoOpen={autoOpen}
                onClose={onClose}
                disabled={disabled}
                onAddOption={onAddOption}
            />
        );
    }

    if (editor === "CHOICE_CASCADE") {
        const cascade = meta?.cascade;
        const parentColumn = cascade?.parentColumn ?? "";
        const parentValue = parentColumn ? String(rowOriginal[parentColumn] ?? "") : "";
        const opts: ReadonlyArray<DropdownOption> = cascade?.mapping?.[parentValue] ?? [];
        const noParent = !parentValue;
        return (
            <DropdownCell
                value={valueStr}
                options={opts}
                onCommit={onCommit}
                placeholder={noParent ? `Isi "${parentColumn}" dulu` : "Pilih..."}
                showColor
                autoOpen={autoOpen && !noParent}
                onClose={onClose}
                disabled={disabled || noParent}
                disabledHint={noParent ? `Pilih kolom "${parentColumn}" lebih dulu` : undefined}
            />
        );
    }

    if (editor === "REFERENCE") {
        const sourceLabel = refConfig
            ? `${refConfig.dataset}.${refConfig.table}`
            : undefined;
        return (
            <DropdownCell
                value={valueStr}
                options={refOptions as ReadonlyArray<DropdownOption>}
                onCommit={onCommit}
                placeholder="Pilih referensi..."
                autoOpen={autoOpen}
                onClose={onClose}
                disabled={disabled}
                loading={refLoading}
                error={refError}
                sourceLabel={sourceLabel}
            />
        );
    }

    // Should never reach here — guarded by SpaceBodyCell DROPDOWN_EDITORS set.
    return null;
}
