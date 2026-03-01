/**
 * Simple in-memory cache for API route data.
 * Works in both dev and production — supplements Next.js revalidate.
 *
 * Usage:
 *   const cache = new ApiCache<Tower[]>(Infinity);  // fetch-once, manual refresh only
 *   const data = await cache.getOrFetch(() => fetchTowers());
 *   cache.invalidate();  // force next call to re-fetch
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export class ApiCache<T> {
    private entry: CacheEntry<T> | null = null;
    private pending: Promise<T> | null = null;
    private readonly ttlMs: number;

    constructor(ttlMs: number = Infinity) {
        this.ttlMs = ttlMs;
    }

    async getOrFetch(fetcher: () => Promise<T>): Promise<T> {
        const now = Date.now();

        // Return cached data if still fresh
        if (this.entry && (now - this.entry.timestamp) < this.ttlMs) {
            return this.entry.data;
        }

        // Deduplicate concurrent requests — only one fetch in-flight
        if (this.pending) {
            return this.pending;
        }

        this.pending = fetcher()
            .then(data => {
                this.entry = { data, timestamp: Date.now() };
                this.pending = null;
                return data;
            })
            .catch(err => {
                this.pending = null;
                // If stale data exists, return it on error
                if (this.entry) return this.entry.data;
                throw err;
            });

        return this.pending;
    }

    /** Force next getOrFetch to re-fetch from source */
    invalidate(): void {
        this.entry = null;
    }

    /** Whether cache has data */
    get hasData(): boolean {
        return this.entry !== null;
    }

    /** Age in seconds, or null if cache is empty */
    get ageSeconds(): number | null {
        if (!this.entry) return null;
        return Math.round((Date.now() - this.entry.timestamp) / 1000);
    }
}
