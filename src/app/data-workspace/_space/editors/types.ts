/**
 * Editor types — shared contract untuk semua cell editors.
 */

import type { RowValue } from "@/app/data-input/_workspace/types";
import type { ColumnMeta } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";

export type EditorKind =
    | "TEXT" | "NUMBER" | "FLOAT" | "DATE" | "TIMESTAMP" | "BOOL"
    | "CHOICE" | "CHOICE_CASCADE" | "REFERENCE" | "MULTI_SELECT"
    | "RICH_TEXT" | "URL" | "FILE";

export interface CellEditorProps {
    editor: EditorKind;
    value: RowValue | undefined;
    /** Dipanggil saat user confirm (Enter / blur). Pass undefined kalau cancel/clear. */
    onCommit: (next: RowValue) => void;
    /** Dipanggil saat user batal (Esc). */
    onCancel: () => void;
    /** Column meta (untuk akses choices, cascade, reference, dll). */
    columnMeta?: ColumnMeta<RowData, unknown>;
    /** Required field — affect validation visual. */
    required?: boolean;
    autoFocus?: boolean;
    /** Consumer table identity — REFERENCE editor pakai untuk auto-filter rows
     *  via convention `source_table = consumerTable`. */
    consumerTable?: string;
}
