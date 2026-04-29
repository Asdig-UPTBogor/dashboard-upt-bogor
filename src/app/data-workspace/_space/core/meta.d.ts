/**
 * TanStack Table — module augmentation untuk Space.
 *
 * Pattern resmi TanStack v8 untuk extend `TableMeta` + `ColumnMeta`
 * tanpa rewrite library. Type-safe, IntelliSense penuh.
 *
 * Anatomy:
 *  - TableMeta  → action callbacks + state global yang dishare antar cell
 *  - ColumnMeta → metadata per kolom (editor type, options, validation, dll)
 *
 * Field di sini WAJIB ke-cover di `core/useSpaceTable.ts` saat instantiate.
 * Tambah field baru di sini = compile-time check di seluruh consumer.
 */

import "@tanstack/react-table";
import type { ColumnMeta as ColumnSchema, RowData as TableRow } from "@/app/data-input/_workspace/types";
import type { ZodType } from "zod";

declare module "@tanstack/react-table" {
    interface TableMeta<TData> {
        // ─── Action callbacks ────────────────────────────────────────
        /** Update cell value (staging — belum ke BQ). */
        updateCell: (rowIdx: number, colId: string, value: unknown) => void;
        /** Commit single row ke BQ (immediate save). */
        commitRow: (rowIdx: number) => Promise<{ ok: boolean; error?: string }>;
        /** Refresh whole grid dari source. */
        refresh: () => void | Promise<void>;

        // ─── State queries ──────────────────────────────────────────
        /** Apakah cell/row punya unsaved change? */
        isDirty: (rowIdx: number, colId?: string) => boolean;
        /** Validation error untuk cell tertentu (null kalau valid). */
        getError: (rowIdx: number, colId: string) => string | null;
        /** Original (pre-edit) value — untuk compare + rollback. */
        getOriginalValue: (rowIdx: number, colId: string) => unknown;
        /** Resolved value (overlay-aware) — pakai untuk editor initial value + override. */
        getCellValue?: (rowIdx: number, colId: string) => unknown;

        // ─── Schema reference ───────────────────────────────────────
        /** Schema kolom asli (ColumnMeta dari Firestore overlay + BQ). */
        columnSchemas: ReadonlyMap<string, ColumnSchema>;

        // ─── Consumer context ───────────────────────────────────────
        /** Dataset+table identifier consumer ini — dipakai REFERENCE editor
         *  untuk auto-filter via convention `source_table = consumerTable`.
         *  ZERO HARDCODE filter clause per table. */
        consumerDataset?: string;
        consumerTable?: string;

        // ─── Display options ────────────────────────────────────────
        /** Read-only mode (Platform data). */
        readOnly?: boolean;
        /** Compact density (tighter row height). */
        density?: "comfortable" | "compact";

        // ─── Suppress unused TData warning ──────────────────────────
        readonly _phantom?: TData;
    }

    interface ColumnMeta<TData, TValue> {
        // ─── Editor & display ───────────────────────────────────────
        /** Editor component yang dipakai saat cell aktif. */
        editor:
            | "TEXT"
            | "NUMBER"
            | "FLOAT"
            | "DATE"
            | "TIMESTAMP"
            | "BOOL"
            | "CHOICE"
            | "CHOICE_CASCADE"
            | "REFERENCE"
            | "MULTI_SELECT"
            | "RICH_TEXT"
            | "URL"
            | "FILE";

        /** Display formatter — ambil raw value, return string/JSX untuk render. */
        formatter?: (value: TValue, row: TData) => React.ReactNode;

        // ─── CHOICE / CHOICE_CASCADE ────────────────────────────────
        choices?: ReadonlyArray<{ value: string; label: string; color?: string }>;
        cascade?: {
            parentColumn: string;
            mapping: Record<string, ReadonlyArray<{ value: string; label: string; color?: string }>>;
        };

        // ─── REFERENCE ──────────────────────────────────────────────
        reference?: {
            dataset: string;
            table: string;
            displayCol: string;
            valueCol: string;
            filter?: string;
        };

        // ─── FILE (GCS upload — Phase 5+) ──────────────────────────
        file?: {
            /** Bucket GCS untuk upload. Default: workspace-uploads */
            bucket?: string;
            /** Allowed mimetypes (e.g. ["image/*", "application/pdf"]) */
            accept?: string[];
            /** Max size bytes. Default: 10MB */
            maxSize?: number;
            /** Multi-file per cell? Default false (single). */
            multi?: boolean;
        };

        // ─── Validation (Phase 4) ───────────────────────────────────
        validation?: ZodType;
        required?: boolean;

        // ─── Formula engine (Level 3, Phase 6+) ────────────────────
        formula?: string;

        // ─── Conditional rules (Level 3, Phase 6+) ─────────────────
        conditional?: ReadonlyArray<{
            when: string;
            set?: Partial<{ required: boolean; visible: boolean; options: ColumnMeta<TData, TValue>["choices"] }>;
        }>;

        // ─── Permission (Level 4, Phase 7+) ────────────────────────
        permission?: { read?: string[]; write?: string[] };

        // ─── Underlying schema reference ────────────────────────────
        schema?: ColumnSchema;

        // ─── Suppress unused warnings ──────────────────────────────
        readonly _phantomData?: TData;
        readonly _phantomValue?: TValue;
    }
}

/** Re-export untuk import convenience. */
export type SpaceRow = TableRow;
