/**
 * Module-level cache untuk Data Input — stale-while-revalidate pattern.
 *
 * Tujuan: ketika user pindah table tab, data yang sudah pernah dimuat tampil
 * instant dari cache, sementara fetch fresh di background. Tidak ada spinner
 * "Memuat..." berulang per navigate.
 *
 * Keys:
 *   "ds-list"                       → list semua dataset
 *   "ds:<dsId>"                     → detail + tables
 *   "tbl:<ds>/<t>"                  → meta + columns table
 *   "rows:<ds>/<t>"                 → rows array
 */

interface CacheEntry<T> {
    data: T;
    ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 60_000;

export function getCached<T>(key: string, maxAgeMs = DEFAULT_TTL_MS): T | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > maxAgeMs) return null;
    return hit.data as T;
}

/** Cached jika ada (meski stale) — untuk stale-while-revalidate first render. */
export function getAny<T>(key: string): T | null {
    const hit = cache.get(key);
    return hit ? (hit.data as T) : null;
}

export function setCached<T>(key: string, data: T): void {
    cache.set(key, { data, ts: Date.now() });
}

export function invalidate(keyOrPrefix: string): void {
    if (cache.has(keyOrPrefix)) {
        cache.delete(keyOrPrefix);
        return;
    }
    // Prefix invalidate
    for (const k of cache.keys()) {
        if (k.startsWith(keyOrPrefix)) cache.delete(k);
    }
}

/** SWR helper: return cached immediately, fetch fresh in background.
 *  onUpdate fires ketika fresh data datang dan beda dari cached. */
export async function swrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    opts: {
        staleWhileRevalidate?: boolean;
        maxAgeMs?: number;
        onUpdate?: (data: T) => void;
    } = {},
): Promise<{ data: T; fromCache: boolean }> {
    const { staleWhileRevalidate = true, maxAgeMs = DEFAULT_TTL_MS, onUpdate } = opts;

    const cached = getAny<T>(key);
    const fresh = getCached<T>(key, maxAgeMs);

    // Fresh cache hit — return langsung, no refetch
    if (fresh !== null) return { data: fresh, fromCache: true };

    // Stale cache + SWR mode: return cached, refetch bg
    if (cached !== null && staleWhileRevalidate) {
        // Dedupe inflight
        if (!inflight.has(key)) {
            const p = fetcher()
                .then((data) => {
                    setCached(key, data);
                    inflight.delete(key);
                    if (onUpdate && JSON.stringify(data) !== JSON.stringify(cached)) {
                        onUpdate(data);
                    }
                    return data;
                })
                .catch((err) => {
                    inflight.delete(key);
                    throw err;
                });
            inflight.set(key, p);
        }
        return { data: cached, fromCache: true };
    }

    // No cache — await fresh
    if (!inflight.has(key)) {
        const p = fetcher()
            .then((data) => {
                setCached(key, data);
                inflight.delete(key);
                return data;
            })
            .catch((err) => {
                inflight.delete(key);
                throw err;
            });
        inflight.set(key, p);
    }
    const data = await (inflight.get(key) as Promise<T>);
    return { data, fromCache: false };
}

/** Prefetch (fire + forget) — dipakai sidebar onHover. */
export function prefetch<T>(key: string, fetcher: () => Promise<T>): void {
    if (getCached<T>(key) !== null) return;
    if (inflight.has(key)) return;
    const p = fetcher()
        .then((data) => {
            setCached(key, data);
            inflight.delete(key);
            return data;
        })
        .catch(() => { inflight.delete(key); });
    inflight.set(key, p);
}
