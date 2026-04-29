/**
 * Firestore overlay config — 3 collections terpisah (per fungsi per separation).
 *
 *   data_input_dataset/{ds}
 *     { alias?, description?, icon?, updatedBy, updatedAt }
 *
 *   data_input_table/{ds}__{t}
 *     { alias?, description?, icon?, primaryKey?, displayKey?,
 *       defaultSort?: { column, direction },
 *       updatedBy, updatedAt }
 *
 *   data_input_columns/{ds}__{t}
 *     { columns: { [colName]: Partial<ColumnMeta> },
 *       updatedBy, updatedAt }
 *
 * Semua opsional — kalau doc belum ada, FE pakai default dari BQ schema.
 * BQ = SSOT untuk data, Firestore = overlay UI/UX saja.
 */

import { getFirestore } from "./clients";
import type { ColumnMeta } from "@/app/data-input/_workspace/types";

const COL_DATASET = "data_platform_dataset";
const COL_TABLE = "data_platform_table";
const COL_COLUMNS = "data_platform_columns";

/** Wrap Firestore read dengan timeout. Kalau gRPC handshake slow atau
 *  connectivity drop, fallback ke empty doc supaya API tetap responsive. */
async function withTimeout<T>(
    fn: () => Promise<T>,
    ms: number,
    fallback: T,
    label: string,
): Promise<T> {
    try {
        return await Promise.race([
            fn(),
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms)
            ),
        ]);
    } catch (err) {
        console.warn(label, err instanceof Error ? err.message : err);
        return fallback;
    }
}

/** Server-side memoization untuk overlay reads.
 *  TTL 2 menit — overlay rarely changes (cuma saat admin edit via UI).
 *  Invalidate saat PATCH. */
interface MemoEntry<T> { data: T; ts: number }
const memo = new Map<string, MemoEntry<unknown>>();
const MEMO_TTL_MS = 2 * 60_000;

function memoGet<T>(key: string): T | null {
    const hit = memo.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > MEMO_TTL_MS) return null;
    return hit.data as T;
}
function memoSet<T>(key: string, data: T): void { memo.set(key, { data, ts: Date.now() }); }
function memoInvalidate(key: string): void { memo.delete(key); }

function tableKey(ds: string, t: string): string {
    return `${ds}__${t}`;
}

/* ─── Dataset overlay ────────────────────────────────────── */

export interface DatasetOverlay {
    alias?: string;
    description?: string;
    icon?: string;
    updatedBy?: string;
    updatedAt?: unknown;
}

export async function getDatasetOverlay(ds: string): Promise<DatasetOverlay> {
    const key = `ds:${ds}`;
    const cached = memoGet<DatasetOverlay>(key);
    if (cached !== null) return cached;
    const data = await withTimeout(
        async () => {
            const snap = await getFirestore().collection(COL_DATASET).doc(ds).get();
            return snap.exists ? (snap.data() as DatasetOverlay) : {};
        },
        2000,
        {} as DatasetOverlay,
        `[overlay] getDataset ${ds}`,
    );
    memoSet(key, data);
    return data;
}

export async function patchDatasetOverlay(ds: string, patch: Omit<DatasetOverlay, "updatedBy" | "updatedAt">, actor: string): Promise<void> {
    await getFirestore().collection(COL_DATASET).doc(ds).set(
        { ...patch, updatedBy: actor, updatedAt: new Date() },
        { merge: true }
    );
    memoInvalidate(`ds:${ds}`);
}

/* ─── Table overlay ──────────────────────────────────────── */

export interface TableOverlay {
    alias?: string;
    description?: string;
    icon?: string;
    primaryKey?: string;
    displayKey?: string;
    defaultSort?: { column: string; direction: "asc" | "desc" };
    updatedBy?: string;
    updatedAt?: unknown;
}

export async function getTableOverlay(ds: string, t: string): Promise<TableOverlay> {
    const key = `tbl:${ds}/${t}`;
    const cached = memoGet<TableOverlay>(key);
    if (cached !== null) return cached;
    const data = await withTimeout(
        async () => {
            const snap = await getFirestore().collection(COL_TABLE).doc(tableKey(ds, t)).get();
            return snap.exists ? (snap.data() as TableOverlay) : {};
        },
        2000,
        {} as TableOverlay,
        `[overlay] getTable ${ds}.${t}`,
    );
    memoSet(key, data);
    return data;
}

export async function patchTableOverlay(ds: string, t: string, patch: Omit<TableOverlay, "updatedBy" | "updatedAt">, actor: string): Promise<void> {
    await getFirestore().collection(COL_TABLE).doc(tableKey(ds, t)).set(
        { ...patch, updatedBy: actor, updatedAt: new Date() },
        { merge: true }
    );
    memoInvalidate(`tbl:${ds}/${t}`);
}

/* ─── Columns overlay ────────────────────────────────────── */

export interface ColumnsOverlay {
    columns?: Record<string, Partial<ColumnMeta>>;
    updatedBy?: string;
    updatedAt?: unknown;
}

export async function getColumnsOverlay(ds: string, t: string): Promise<ColumnsOverlay> {
    const key = `cols:${ds}/${t}`;
    const cached = memoGet<ColumnsOverlay>(key);
    if (cached !== null) return cached;
    const data = await withTimeout(
        async () => {
            const snap = await getFirestore().collection(COL_COLUMNS).doc(tableKey(ds, t)).get();
            return snap.exists ? (snap.data() as ColumnsOverlay) : {};
        },
        2000,
        {} as ColumnsOverlay,
        `[overlay] getColumns ${ds}.${t}`,
    );
    memoSet(key, data);
    return data;
}

/** Remove overlay entry untuk kolom tertentu — dipakai setelah DROP COLUMN BQ. */
export async function removeColumnOverlay(
    ds: string, t: string, colName: string, actor: string,
): Promise<void> {
    const db = getFirestore();
    const { FieldValue } = await import("@google-cloud/firestore");
    const ref = db.collection(COL_COLUMNS).doc(tableKey(ds, t));
    await ref.set(
        { columns: { [colName]: FieldValue.delete() }, updatedBy: actor, updatedAt: new Date() },
        { merge: true }
    );
    memoInvalidate(`cols:${ds}/${t}`);
}

export async function patchColumnsOverlay(
    ds: string, t: string,
    patch: Record<string, Partial<ColumnMeta>>,
    actor: string,
): Promise<void> {
    const db = getFirestore();
    const ref = db.collection(COL_COLUMNS).doc(tableKey(ds, t));

    // Firestore nested-map merge atomic di field-level — tidak perlu transaction.
    // `merge: true` gabungkan patch ke existing doc tanpa overwrite sibling fields.
    // Pattern ini 5-10x lebih cepat dari runTransaction (single RTT vs read+write).
    const columnsPayload: Record<string, Partial<ColumnMeta>> = {};
    for (const [colName, colPatch] of Object.entries(patch)) {
        columnsPayload[colName] = colPatch;
    }

    const writePromise = ref.set(
        { columns: columnsPayload, updatedBy: actor, updatedAt: new Date() },
        { merge: true }
    );

    // Guard 15s timeout — kalau gRPC hang, throw supaya caller dapat error jelas
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firestore write timeout 15s")), 15_000)
    );

    await Promise.race([writePromise, timeoutPromise]);
    memoInvalidate(`cols:${ds}/${t}`);
}

/* ─── Merge helper ────────────────────────────────────────── */

export function mergeColumns(
    bqColumns: ColumnMeta[],
    overlay: Record<string, Partial<ColumnMeta>> | undefined,
): ColumnMeta[] {
    const merged = overlay
        ? bqColumns.map((col) => {
            const patch = overlay[col.name];
            return patch ? { ...col, ...patch, name: col.name } : col;
        })
        : bqColumns;

    // Sort by order (kalau ada). Kolom tanpa order → pakai urutan BQ schema asli
    const hasOrder = merged.some((c) => typeof c.order === "number");
    if (!hasOrder) return merged;

    return [...merged].sort((a, b) => {
        const ao = a.order ?? 9999;
        const bo = b.order ?? 9999;
        return ao - bo;
    });
}
