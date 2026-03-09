/**
 * Sheet-Level In-Memory Cache
 *
 * Caches raw sheet data keyed by `spreadsheetId::sheetName`.
 * Shared across all page requests — if Asset GI is fetched for /asset-maps,
 * /overview can reuse it from cache without hitting Google Sheets API.
 *
 * Background prefetch worker populates this cache every 60 seconds.
 * API route checks cache first; only fetches from Google on miss or refresh.
 */

import type { SheetData } from "@/lib/sheets-api";

interface CacheEntry {
    data: SheetData;
    timestamp: number;      // When data was fetched
    columns: string[];      // Column names in this cache entry
    fetchMs: number;        // How long the fetch took (ms)
}

class SheetCache {
    private entries = new Map<string, CacheEntry>();

    private key(spreadsheetId: string, sheetName: string): string {
        return `${spreadsheetId}::${sheetName}`;
    }

    /** Store sheet data in cache */
    set(spreadsheetId: string, sheetName: string, data: SheetData, columns: string[], fetchMs = 0): void {
        this.entries.set(this.key(spreadsheetId, sheetName), {
            data,
            timestamp: Date.now(),
            columns,
            fetchMs,
        });
    }

    /**
     * Get cached sheet data.
     * Returns null if not cached.
     * Checks that all requested columns exist in cache — if not, returns null (must re-fetch).
     */
    get(spreadsheetId: string, sheetName: string, requiredColumns?: string[]): SheetData | null {
        const entry = this.entries.get(this.key(spreadsheetId, sheetName));
        if (!entry) return null;

        // If specific columns are required, verify they're in the cache
        if (requiredColumns && requiredColumns.length > 0) {
            const cachedCols = new Set(entry.columns.map(c => c.toLowerCase()));
            const missing = requiredColumns.filter(c => !cachedCols.has(c.toLowerCase()));
            if (missing.length > 0) return null; // Column not in cache → miss
        }

        return entry.data;
    }

    /** Get cache age in seconds (null if not cached) */
    getAge(spreadsheetId: string, sheetName: string): number | null {
        const entry = this.entries.get(this.key(spreadsheetId, sheetName));
        if (!entry) return null;
        return Math.round((Date.now() - entry.timestamp) / 1000);
    }

    /** Invalidate a specific sheet entry */
    invalidate(spreadsheetId: string, sheetName: string): void {
        this.entries.delete(this.key(spreadsheetId, sheetName));
    }

    /** Invalidate all entries */
    invalidateAll(): void {
        this.entries.clear();
    }

    /** Get cache status for monitoring */
    getStatus(): SheetCacheStatus {
        const entries = [...this.entries.entries()];
        const ages = entries.map(([, e]) => Math.round((Date.now() - e.timestamp) / 1000));
        return {
            totalSheets: this.entries.size,
            lastRefresh: entries.length > 0
                ? new Date(Math.max(...entries.map(([, e]) => e.timestamp))).toISOString()
                : null,
            oldestAge: ages.length > 0 ? Math.max(...ages) : null,
            newestAge: ages.length > 0 ? Math.min(...ages) : null,
            sheets: entries.map(([key, e]) => ({
                key,
                rows: e.data.rowCount,
                columns: e.columns.length,
                age: Math.round((Date.now() - e.timestamp) / 1000),
                fetchMs: e.fetchMs,
            })),
        };
    }
}

export interface SheetCacheStatus {
    totalSheets: number;
    lastRefresh: string | null;
    oldestAge: number | null;
    newestAge: number | null;
    sheets: { key: string; rows: number; columns: number; age: number; fetchMs: number }[];
}

/**
 * Singleton instance — shared across all API routes via globalThis.
 *
 * Next.js module isolation can create separate instances per route handler.
 * globalThis ensures ONE SheetCache exists across the entire Node.js process,
 * so /api/page-data and /api/rate-limit share the same cache.
 */
const globalForCache = globalThis as typeof globalThis & { __sheetCache?: SheetCache };
export const sheetCache = globalForCache.__sheetCache ??= new SheetCache();
