/**
 * Canvas Page Config — constants.
 *
 * Reuse LEVEL_META/LEVEL_ORDER dari Data Level Config (SSOT).
 * PAGE_BLOCK_* dari V4 pattern (data-connector/_lib/types.ts), bukan nilai sama
 * karena canvas layout beda (sidebar kiri 320 px → geser page block ke tengah).
 */

export { LEVEL_META, LEVEL_ORDER, tableKey } from "../data-level-config/constants";

export const PAGE_BLOCK_ID = "__page_block__";
export const PAGE_BLOCK_X = 600;
export const PAGE_BLOCK_Y = 300;

/** Canonical node id untuk BQ source node */
export const sourceNodeId = (dataset: string, table: string): string =>
    `${dataset}::${table}`;

/**
 * Firestore reject field name starting with `__`. Escape + unescape helpers:
 * `__foo` → `$$foo` saat save, sebaliknya saat load.
 */
export function escapeFirestoreKey(k: string): string {
    return k.startsWith("__") ? "$$" + k.slice(2) : k;
}

export function unescapeFirestoreKey(k: string): string {
    return k.startsWith("$$") ? "__" + k.slice(2) : k;
}
