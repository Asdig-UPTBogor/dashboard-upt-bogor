/**
 * useReferenceCache — shared in-memory cache untuk REFERENCE column lookups.
 *
 *  ┌─ Pattern ─────────────────────────────────────────────────────────┐
 *  │  ColumnMeta.reference = { dataset, table, displayCol, valueCol }   │
 *  │  Cell value = UUID/ID                                              │
 *  │  Display = lookup(value) → label                                   │
 *  └────────────────────────────────────────────────────────────────────┘
 *
 * Cache key: `${dataset}.${table}.${displayCol}.${valueCol}`
 * TTL: 60s (akan refetch kalau master ke-update tapi kita ga pakai realtime sub).
 *
 * Subscriber pattern: cell renderer subscribe ke cache → re-render saat data ready.
 * Module-level singleton (cross-cell cache hit kalau pake reference yg sama).
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export interface RefMap {
    [value: string]: string; // value (ID) → display label
}

interface CacheEntry {
    map: RefMap;
    ts: number;
    loading: boolean;
    error: string | null;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const subscribers = new Set<() => void>();

function notifySubscribers() {
    for (const cb of subscribers) cb();
}

function cacheKey(dataset: string, table: string, displayCol: string, valueCol: string) {
    return `${dataset}.${table}.${displayCol}.${valueCol}`;
}

/** Module-level full-rows cache: key = dataset.table → all rows (independent of consumer).
 *  Filter dilakukan SAAT BUILD MAP untuk consumer tertentu (avoids duplicate fetches). */
const rowsCache = new Map<string, { rows: Array<Record<string, unknown>>; ts: number; loading: boolean; error: string | null }>();

async function loadRowsRaw(dataset: string, table: string) {
    const key = `${dataset}.${table}`;
    const existing = rowsCache.get(key);
    if (existing && Date.now() - existing.ts < CACHE_TTL_MS && !existing.loading) return existing;

    rowsCache.set(key, { rows: existing?.rows ?? [], ts: Date.now(), loading: true, error: null });
    try {
        const res = await apiFetch<{ ok: boolean; rows?: Array<Record<string, unknown>>; message?: string }>(
            `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/rows?limit=2000`,
        );
        if (!res.ok || !res.rows) throw new Error(res.message ?? "Failed to load reference rows");
        rowsCache.set(key, { rows: res.rows, ts: Date.now(), loading: false, error: null });
    } catch (e) {
        rowsCache.set(key, {
            rows: existing?.rows ?? [], ts: Date.now(), loading: false,
            error: e instanceof Error ? e.message : String(e),
        });
    }
    return rowsCache.get(key)!;
}

async function loadRef(
    dataset: string, table: string, displayCol: string, valueCol: string,
    consumerTable?: string,
) {
    const key = cacheKey(dataset, table, displayCol, valueCol) + (consumerTable ? `:${consumerTable}` : "");
    const existing = cache.get(key);
    if (existing && Date.now() - existing.ts < CACHE_TTL_MS && !existing.loading) return;

    cache.set(key, { map: existing?.map ?? {}, ts: Date.now(), loading: true, error: null });
    notifySubscribers();

    try {
        const raw = await loadRowsRaw(dataset, table);
        if (raw.error) throw new Error(raw.error);
        const map: RefMap = {};
        for (const row of raw.rows) {
            // Convention auto-filter: kalau row punya `source_table` field DAN consumerTable disediakan,
            // skip row yang source_table != consumerTable. ZERO HARDCODE filter clause per table.
            if (consumerTable && row.source_table !== undefined && row.source_table !== consumerTable) continue;
            // E07: skip row yang is_active === false (master non-aktif tidak muncul di dropdown).
            // Convention: kalau master table punya kolom is_active dan nilainya false, skip.
            if (row.is_active === false) continue;
            const v = String(row[valueCol] ?? "");
            if (!v) continue;
            map[v] = String(row[displayCol] ?? row[valueCol] ?? v);
        }
        cache.set(key, { map, ts: Date.now(), loading: false, error: null });
    } catch (e) {
        cache.set(key, {
            map: existing?.map ?? {},
            ts: Date.now(),
            loading: false,
            error: e instanceof Error ? e.message : String(e),
        });
    }
    notifySubscribers();
}

/**
 * Hook untuk subscribe ke cache + auto-fetch kalau belum cached.
 * Re-render component saat cache update.
 */
export function useReferenceLookup(
    ref: { dataset: string; table: string; displayCol: string; valueCol: string } | undefined,
    /** Auto-filter rows: kalau row punya field `source_table`, skip yg ga match consumerTable.
     *  Convention pattern — zero hardcode filter clause per consumer table. */
    consumerTable?: string,
): {
    lookup: (value: unknown) => string | undefined;
    /** Full options array (sorted by label) — untuk dropdown/combobox editor. */
    options: ReadonlyArray<{ value: string; label: string }>;
    loading: boolean;
    error: string | null;
} {
    const [, force] = useState(0);

    useEffect(() => {
        if (!ref) return;
        loadRef(ref.dataset, ref.table, ref.displayCol, ref.valueCol, consumerTable);
        const cb = () => force((n) => n + 1);
        subscribers.add(cb);
        return () => { subscribers.delete(cb); };
    }, [ref, consumerTable]);

    if (!ref) {
        return { lookup: () => undefined, options: [], loading: false, error: null };
    }

    const baseKey = cacheKey(ref.dataset, ref.table, ref.displayCol, ref.valueCol);
    const entry = cache.get(consumerTable ? `${baseKey}:${consumerTable}` : baseKey);
    const options = entry
        ? Object.entries(entry.map)
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label))
        : [];
    return {
        lookup: (value: unknown) => {
            if (value == null || value === "") return undefined;
            return entry?.map[String(value)];
        },
        options,
        loading: entry?.loading ?? true,
        error: entry?.error ?? null,
    };
}

/** Force-refresh single ref cache entry (e.g. setelah create/edit master row). */
export function invalidateReferenceCache(dataset: string, table: string, displayCol: string, valueCol: string) {
    cache.delete(cacheKey(dataset, table, displayCol, valueCol));
    notifySubscribers();
}
