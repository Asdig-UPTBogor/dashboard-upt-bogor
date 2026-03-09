/**
 * usePageData — Registry-driven data fetching hook
 *
 * Server-cache only architecture:
 * 1. On mount, fetch from server (server has in-memory cache with Infinity TTL)
 * 2. On refetch (refresh button), send ?refresh=true → server invalidates cache,
 *    fetches fresh from Google Sheets, updates server cache, returns to FE
 * 3. On fetch failure → auto-retry up to 2 times with exponential backoff
 *
 * Usage:
 *   const { sheets, loading, error, refetch, getSheet } = usePageData("/gardu-induk");
 *
 * With column filter:
 *   const { sheets } = usePageData("/gardu-induk", { columns: ["ULTG", "Gardu Induk"] });
 *
 * With auto-refresh:
 *   const { sheets } = usePageData("/asset-maps", { pollInterval: 60000 }); // 1 min
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCacheUpdated } from "@/hooks/useWorkerSSE";

/* ── Types ── */

export interface SheetData {
    sheetName: string;
    spreadsheetTitle: string;
    spreadsheetId: string;
    headers: string[];
    rows: Record<string, string>[];
    rowCount: number;
    role: string | null;
    hierarchyMapping: Record<string, string> | null;
    hierarchyPresent: string[];
    error: string | null;
}

export interface PageDataResponse {
    page: string;
    fetchedAt: string;
    sheetCount: number;
    columnsFiltered: string[] | null;
    sheets: SheetData[];
    configIssues?: { sheetName: string; issue: string }[];
}

export interface UsePageDataOptions {
    /** Only fetch these columns (hierarchy columns always included) */
    columns?: string[];
    /** Fetch only this sheet (case-insensitive match) */
    sheet?: string;
    /** Server-side date filter: only return rows from last N days (requires date column) */
    maxDays?: number;
    /** Auto-refresh interval in ms (default: disabled) */
    pollInterval?: number;
    /** Skip initial fetch (default: false) */
    enabled?: boolean;
}

export interface UsePageDataReturn {
    /** All sheets linked to this page */
    sheets: SheetData[];
    /** Loading state */
    loading: boolean;
    /** True when fetching in background (polling or refresh) */
    isRevalidating: boolean;
    /** True when revalidating (read from ref, does not cause re-renders) */
    getIsRevalidating: () => boolean;
    /** Error message if fetch failed */
    error: string | null;
    /** Fetch timestamp */
    fetchedAt: string | null;
    /** Manual refresh (bypasses server cache) */
    refetch: () => void;
    /** Get a specific sheet by name (case-insensitive) */
    getSheet: (name: string) => SheetData | undefined;
    /** Get all sheets with a specific role */
    getSheetsByRole: (role: string) => SheetData[];
}

/* ── Global Page Data Registry ── */
// Allows DataFreshness component to auto-detect page and read refetch/fetchedAt
// without any props. Each usePageData instance auto-registers here.

export interface PageDataRegistryEntry {
    refetch: () => void;
    fetchedAt: string | null;
    getIsRevalidating: () => boolean;
}

type RegistryListener = () => void;

class PageDataRegistry {
    private entries = new Map<string, PageDataRegistryEntry>();
    private listeners = new Set<RegistryListener>();

    set(path: string, entry: PageDataRegistryEntry) {
        this.entries.set(path, entry);
        this.notify();
    }

    get(path: string): PageDataRegistryEntry | undefined {
        return this.entries.get(path);
    }

    remove(path: string) {
        this.entries.delete(path);
        this.notify();
    }

    subscribe(fn: RegistryListener): () => void {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    }

    private notify() {
        this.listeners.forEach(fn => fn());
    }
}

export const pageDataRegistry = new PageDataRegistry();

/**
 * usePageDataRegistry — Subscribe to the global registry for a given page path.
 * Used internally by DataFreshness to auto-detect refetch/fetchedAt.
 */
export function usePageDataRegistry(path: string): PageDataRegistryEntry | undefined {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        return pageDataRegistry.subscribe(() => forceUpdate(v => v + 1));
    }, [path]);
    return pageDataRegistry.get(path);
}

/* ── Hook ── */

export function usePageData(
    pagePath: string,
    options: UsePageDataOptions = {}
): UsePageDataReturn {
    const { columns, sheet, maxDays, pollInterval, enabled = true } = options;

    // Stable reference for columns param
    const columnsKey = columns?.join(",") || "";

    const [sheets, setSheets] = useState<SheetData[]>([]);
    const [loading, setLoading] = useState(true);
    const isRevalidatingRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasMounted = useRef(false);
    const retryCountRef = useRef(0);
    const shownIssuesRef = useRef<Set<string>>(new Set());

    // SSE: auto-refresh when worker completes a cache cycle (24/7 support)
    const cacheVersion = useCacheUpdated();

    const fetchData = useCallback(async (isBackground = false, forceRefresh = false) => {
        if (!enabled) return;

        if (isBackground) {
            isRevalidatingRef.current = true;
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const params = new URLSearchParams({ page: pagePath });
            if (sheet) params.set("sheet", sheet);
            if (columnsKey) params.set("columns", columnsKey);
            if (maxDays) params.set("maxDays", String(maxDays));
            if (forceRefresh) params.set("refresh", "true");

            const fetchStart = performance.now();
            const res = await fetch(`/api/page-data?${params.toString()}`);
            const json = await res.json();
            const elapsed = Math.round(performance.now() - fetchStart);

            if (!res.ok) {
                setError(json.error || `HTTP ${res.status}`);
                if (!isBackground) setSheets([]);
                return;
            }

            const data = json as PageDataResponse;

            setSheets(data.sheets);
            setFetchedAt(data.fetchedAt);

            if (process.env.NODE_ENV !== "production") {
                console.log(
                    `[usePageData] ${forceRefresh ? "🔄 Refreshed" : "✅ Fetched"} ${pagePath} → ` +
                    `${data.sheetCount} sheets, ${data.sheets.reduce((n, s) => n + s.rowCount, 0)} rows (${elapsed}ms)`
                );
            }

            // Show toast for config issues (dedup: only once per unique issue)
            if (data.configIssues && data.configIssues.length > 0 && !isBackground) {
                for (const ci of data.configIssues) {
                    const key = `${pagePath}::${ci.sheetName}::${ci.issue}`;
                    if (!shownIssuesRef.current.has(key)) {
                        shownIssuesRef.current.add(key);
                        toast.warning(`${ci.sheetName}`, {
                            description: ci.issue,
                            duration: 8000,
                        });
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Network error";
            setError(msg);
            if (!isBackground) setSheets([]);

            // Auto-retry with exponential backoff (max 2 retries)
            if (retryCountRef.current < 2) {
                retryCountRef.current++;
                const delay = retryCountRef.current * 2000; // 2s, 4s
                if (process.env.NODE_ENV !== "production") {
                    console.log(`[usePageData] ⚠️ Retry ${retryCountRef.current}/2 for ${pagePath} in ${delay}ms`);
                }
                setTimeout(() => fetchData(isBackground, forceRefresh), delay);
                return;
            }
            retryCountRef.current = 0; // reset for next manual call
        } finally {
            isRevalidatingRef.current = false;
            if (!isBackground) setLoading(false);
        }
    }, [pagePath, columnsKey, enabled]);

    // Track previous enabled state for lazy-load transition detection
    const prevEnabled = useRef(enabled);

    // On mount: fetch from server cache
    useEffect(() => {
        if (hasMounted.current) {
            // Already mounted — check if enabled just transitioned false → true (lazy load trigger)
            if (enabled && !prevEnabled.current) {
                prevEnabled.current = true;
                fetchData(false);
            }
            prevEnabled.current = enabled;
            return;
        }
        hasMounted.current = true;
        prevEnabled.current = enabled;
        if (!enabled) return;

        fetchData(false);
    }, [pagePath, columnsKey, sheet, enabled, fetchData]);

    // Optional polling
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (pollInterval && pollInterval > 0 && enabled) {
            intervalRef.current = setInterval(() => fetchData(true), pollInterval);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [pollInterval, fetchData, enabled]);

    // SSE auto-refresh: when worker cycle completes, re-fetch from server cache
    // This enables 24/7 dashboards to stay fresh without manual refresh.
    // cacheVersion starts at 0, so we skip the initial mount (no double-fetch).
    useEffect(() => {
        if (cacheVersion > 0 && enabled && hasMounted.current) {
            fetchData(true); // background = true → no loading screen
        }
    }, [cacheVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    // Stable refetch reference for the registry
    const refetchFn = useCallback(() => fetchData(false, true), [fetchData]);

    // Auto-register in global registry so DataFreshness can auto-detect
    useEffect(() => {
        pageDataRegistry.set(pagePath, { refetch: refetchFn, fetchedAt, getIsRevalidating: () => isRevalidatingRef.current });
        return () => pageDataRegistry.remove(pagePath);
    }, [pagePath, refetchFn, fetchedAt]);

    // Helpers
    const getSheet = useCallback(
        (name: string) => {
            const norm = name.trim().toUpperCase();
            return sheets.find(
                (s) => s.sheetName.trim().toUpperCase() === norm
            );
        },
        [sheets]
    );

    const getSheetsByRole = useCallback(
        (role: string) => {
            return sheets.filter((s) => s.role === role);
        },
        [sheets]
    );

    return {
        sheets,
        loading,
        isRevalidating: isRevalidatingRef.current,
        getIsRevalidating: () => isRevalidatingRef.current,
        error,
        fetchedAt,
        refetch: refetchFn,
        getSheet,
        getSheetsByRole,
    };
}
