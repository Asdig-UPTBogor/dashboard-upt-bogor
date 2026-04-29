"use client";

/**
 * cell-renderers — dispatcher untuk react-data-grid renderCell + renderEditCell.
 *
 * Extracted dari MasterGrid.tsx. Pisahkan logic rendering per-tipe-kolom
 * dari grid component. Tambah tipe baru = append condition di sini.
 */

import { renderTextEditor } from "react-data-grid";
import type { RenderCellProps, RenderEditCellProps } from "react-data-grid";
import type { ColumnMeta, RowData } from "./types";
import { BoolEditor, NumberEditor, ChoiceEditor, ReferenceEditor } from "./cell-editors";
import { formatDate } from "./grid-utils";

type RefLookup = Record<string, Map<string, string>>;
type RefOptions = Record<string, Array<{ value: string; label: string }>>;

/** Render cell value per-tipe kolom (display mode). */
export function renderCellView(
    col: ColumnMeta,
    { row }: RenderCellProps<RowData>,
    refLookup: RefLookup,
) {
    const v = row[col.name];
    if (v == null || v === "") return <span className="opacity-30 italic">—</span>;

    if (col.type === "CHOICE") {
        const opt = col.options?.find((o) => o.value === v);
        if (opt) {
            return (
                <span
                    className="ds-label rounded px-2 py-0.5 border inline-block"
                    style={opt.color
                        ? { color: opt.color, borderColor: opt.color + "60", backgroundColor: opt.color + "20" }
                        : undefined}
                >
                    {opt.label}
                </span>
            );
        }
        return <span>{String(v)}</span>;
    }

    if (col.type === "REFERENCE" && col.reference) {
        const key = `${col.reference.dataset}.${col.reference.table}`;
        const label = refLookup[key]?.get(String(v));
        return label
            ? <span className="truncate">{label}</span>
            : <span className="ds-data font-mono opacity-60">{String(v)}</span>;
    }

    if (col.type === "BOOL") {
        return v
            ? <span className="text-emerald-400">✓</span>
            : <span className="text-muted-foreground">—</span>;
    }

    if (col.type === "INT64" || col.type === "FLOAT64" || col.type === "NUMERIC") {
        return <span className="tabular-nums">{String(v)}</span>;
    }

    if (col.type === "DATE" || col.type === "TIMESTAMP") {
        return <span className="font-mono opacity-80 text-xs">{formatDate(v, col.type === "DATE")}</span>;
    }

    return <span className="truncate">{String(v)}</span>;
}

/** Dispatch ke editor yg sesuai tipe kolom saat cell di-edit. */
export function renderEditor(
    col: ColumnMeta,
    props: RenderEditCellProps<RowData>,
    refOptions: RefOptions,
) {
    if (col.type === "CHOICE") return <ChoiceEditor {...props} col={col} />;
    if (col.type === "REFERENCE") return <ReferenceEditor {...props} col={col} refOptions={refOptions} />;
    if (col.type === "BOOL") return <BoolEditor {...props} />;
    if (col.type === "INT64" || col.type === "FLOAT64" || col.type === "NUMERIC") {
        return <NumberEditor {...props} col={col} />;
    }
    return renderTextEditor(props);
}
