/**
 * TableWorkspace — shared types
 *
 * Schema-driven spreadsheet-like editor untuk table BQ apapun.
 * Dipakai untuk Master Data, User Data, Platform Data (read-only), Legacy Data.
 */

/* ─── BQ native types ─────────────────────────────────────────── */
export type BQColumnType =
    | "STRING"
    | "INT64"
    | "FLOAT64"
    | "NUMERIC"
    | "BOOL"
    | "DATE"
    | "TIMESTAMP"
    | "GEOGRAPHY"
    | "JSON"
    | "BYTES";

/* ─── App-level column types (metadata di Firestore) ─────────── */
export type AppColumnType =
    | "CHOICE"            // dropdown fixed list
    | "CHOICE_CASCADE"    // dropdown yang tergantung kolom parent
    | "REFERENCE"         // dropdown async dari tabel lain
    | "FILE"              // Drive fileId (single atau array)
    | "RICH_TEXT"
    | "URL";

export type ColumnType = BQColumnType | AppColumnType;

/* ─── Column schema (hybrid BQ + Firestore metadata) ─────────── */
export interface ChoiceOption {
    value: string;
    label: string;
    color?: string; // opsional — render badge
}

export interface ColumnMeta {
    /** BQ kolom nama (raw, tidak berubah — jadi identifier stabil) */
    name: string;
    /** Label user-friendly untuk ditampilkan (header, form, drawer). Admin edit via Column Configurator. */
    alias?: string;
    /** Tipe display — kalau ada di schema_metadata, pakai app-level; else BQ type */
    type: ColumnType;
    /** BQ native mode */
    mode: "REQUIRED" | "NULLABLE" | "REPEATED";
    /** Deskripsi / helper text ditampilkan di form dan tooltip */
    description?: string;
    /** Default value saat create row */
    defaultValue?: unknown;

    /* CHOICE */
    options?: ChoiceOption[];

    /* CHOICE_CASCADE */
    parentColumn?: string;
    optionsMap?: Record<string, ChoiceOption[]>;

    /* REFERENCE */
    reference?: {
        dataset: string;
        table: string;
        displayCol: string;
        valueCol: string;
        /** Optional filter template, misal "gi_id = {row.gi_id}" */
        filter?: string;
    };

    /* UI hint */
    width?: number;
    hidden?: boolean;
    readOnly?: boolean;
    /** Urutan display di grid (0-based). Overlay via Column Configurator. */
    order?: number;
    /** Pin kolom di kiri/kanan saat scroll horizontal. */
    pin?: "left" | "right" | null;
}

/* ─── Workspace config per-table (dari Firestore data_platform_tables) ─── */
export interface WorkspaceTableConfig {
    dataset: string;
    table: string;
    /** Kategori: master | user | platform | legacy */
    category: "master" | "user" | "platform" | "legacy";
    /** Hirarki level (khusus master): 1=UPT, 2=ULTG, 3=GI, 4=Bay, 0=flat */
    level?: number;
    /** Label display di header workspace */
    displayName: string;
    description?: string;
    /** Kolom yg di-override metadata nya (selain raw BQ schema) */
    columns?: Record<string, Partial<ColumnMeta>>;
    /** Default sort */
    defaultSort?: { column: string; direction: "asc" | "desc" };
    /** Kolom yg dijadikan primary key (display + optimistic lock basis) */
    primaryKey?: string;
    /** Tabel ini read-only? (Platform data default true) */
    readOnly?: boolean;
}

/* ─── Row data ──────────────────────────────────────────────── */
export type RowValue = string | number | boolean | null | string[] | Record<string, unknown>;
export type RowData = Record<string, RowValue>;

/* ─── Filter state ──────────────────────────────────────────── */
export type FilterOp = "eq" | "neq" | "contains" | "gt" | "gte" | "lt" | "lte" | "in" | "isnull" | "notnull";
export interface ColumnFilter {
    column: string;
    op: FilterOp;
    value?: unknown;
}

export interface WorkspaceState {
    filters: ColumnFilter[];
    sort: { column: string; direction: "asc" | "desc" } | null;
    search: string;
    page: number;
    pageSize: number;
}

/* ─── API response ──────────────────────────────────────────── */
export interface WorkspaceListResponse {
    ok: boolean;
    config: WorkspaceTableConfig;
    columns: ColumnMeta[];
    rows: RowData[];
    total: number;
    warning?: string;
    error?: string;
}
