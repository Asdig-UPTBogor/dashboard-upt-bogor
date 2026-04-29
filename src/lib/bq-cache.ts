/**
 * BQ Cache Layer — LRU in-memory cache dengan version check via Firestore.
 *
 * Flow:
 *   1. Dashboard API route call getCachedOrFetch(datasetName, queryBuilder)
 *   2. Helper baca `ss_platform.dataset_hash.last_synced_at` sebagai version
 *   3. Kalau cache hit + version match → return cached data (no BQ query)
 *   4. Kalau miss/stale → run queryBuilder → cache → return
 *
 * Benefit: Multi-user buka page sama = 1x BQ query, sisanya dari memory.
 * Auto-invalidate saat SS V5 sync selesai (last_synced_at berubah).
 *
 * Per-instance cache (Cloud Run). Kalau scale horizontal, TTL 30 min batasi staleness.
 */
import { LRUCache } from 'lru-cache';
import { BigQuery } from '@google-cloud/bigquery';
import { PROJECT, SS_PLATFORM } from './ss-v5/sql-generator';

// Max 200 cache entries, 30 min TTL default
const cache = new LRUCache<string, { version: string; data: unknown }>({
  max: 200,
  ttl: 1000 * 60 * 30,
  updateAgeOnGet: true,
});

let _bq: BigQuery | null = null;
function getBq(): BigQuery {
  if (!_bq) _bq = new BigQuery({ projectId: PROJECT });
  return _bq;
}

/**
 * Get dataset version from ss_platform.sheet_sync_state.
 * Returns last_synced_at ISO string, or 'unknown' kalau belum di-sync.
 * (Table renamed from dataset_hash to sheet_sync_state on 2026-04-19.)
 */
async function getDatasetVersion(datasetName: string): Promise<string> {
  try {
    const [rows] = await getBq().query({
      query: `SELECT CAST(last_synced_at AS STRING) AS v
              FROM \`${PROJECT}.${SS_PLATFORM}.sheet_sync_state\`
              WHERE bq_dataset_name = @ds
              LIMIT 1`,
      params: { ds: datasetName },
    });
    return rows[0]?.v ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Cache-aside pattern.
 *
 * @param cacheKey unique key (biasanya datasetName + queryHash)
 * @param datasetName n_* table name untuk version lookup
 * @param queryBuilder function yang return Promise<data>
 */
export async function getCachedOrFetch<T>(
  cacheKey: string,
  datasetName: string,
  queryBuilder: () => Promise<T>,
): Promise<T> {
  const version = await getDatasetVersion(datasetName);
  const cached = cache.get(cacheKey);

  if (cached && cached.version === version) {
    return cached.data as T;
  }

  const data = await queryBuilder();
  cache.set(cacheKey, { version, data });
  return data;
}

/**
 * Manual invalidate.
 */
export function invalidate(cacheKey?: string): void {
  if (cacheKey) cache.delete(cacheKey);
  else cache.clear();
}

/**
 * Stats for monitoring / admin UI.
 */
export function getCacheStats() {
  return {
    size: cache.size,
    max: cache.max,
    ttlMs: cache.ttl,
  };
}

/**
 * Helper: run simple BQ SELECT + cache.
 */
export async function cachedQuery<T = unknown[]>(
  cacheKey: string,
  datasetName: string,
  sql: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return getCachedOrFetch<T>(cacheKey, datasetName, async () => {
    const [rows] = await getBq().query({ query: sql, params });
    return rows as T;
  });
}
