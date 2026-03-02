/**
 * usePageData — Registry-driven data fetching hook with SWR
 *
 * SWR (Stale-While-Revalidate):
 * 1. On mount, instantly load stale data from sessionStorage (0ms)
 * 2. Background revalidate from server → silent update if data changed
 * 3. On fresh fetch success → persist to sessionStorage for next visit
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
    /** Loading state (false immediately if stale data served) */
    loading: boolean;
    /** True when revalidating in background after serving stale data */
    isRevalidating: boolean;
    /** Error message if fetch failed */
    error: string | null;
    /** Fetch timestamp */
    fetchedAt: string | null;
    /** Age of stale data in seconds (null if fresh) */
    staleAge: number | null;
    /** Manual refresh (bypasses cache) */
    refetch: () => void;
    /** Get a specific sheet by name (case-insensitive) */
    getSheet: (name: string) => SheetData | undefined;
    /** Get all sheets with a specific role */
    getSheetsByRole: (role: string) => SheetData[];
}

/* ── SessionStorage SWR Cache ── */

interface SWRCacheEntry {
    sheets: SheetData[];
    fetchedAt: string;
    timestamp: number;
}

function swrCacheKey(pagePath: string, columnsKey: string, sheet?: string): string {
    let key = `swr::${pagePath}`;
    if (sheet) key += `::sheet=${sheet}`;
    if (columnsKey) key += `::cols=${columnsKey}`;
    return key;
}

function loadSWRCache(key: string): SWRCacheEntry | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as SWRCacheEntry;
    } catch {
        return null;
    }
}

function saveSWRCache(key: string, sheets: SheetData[], fetchedAt: string): void {
    try {
        const entry: SWRCacheEntry = { sheets, fetchedAt, timestamp: Date.now() };
        sessionStorage.setItem(key, JSON.stringify(entry));
    } catch {
        // sessionStorage full or unavailable — silently ignore
    }
}

/* ── Hook ── */

export function usePageData(
    pagePath: string,
    options: UsePageDataOptions = {}
): UsePageDataReturn {
    const { columns, sheet, maxDays, pollInterval, enabled = true } = options;

    // Stable reference for columns param
    const columnsKey = columns?.join(",") || "";

    // ── Synchronous SWR: read sessionStorage DURING first render (no flash) ──
    const [initialSWR] = useState(() => {
        if (!enabled) return null;
        return loadSWRCache(swrCacheKey(pagePath, columnsKey, sheet));
    });
    const hasInitialCache = !!(initialSWR && initialSWR.sheets.length > 0);

    const [sheets, setSheets] = useState<SheetData[]>(initialSWR?.sheets ?? []);
    const [loading, setLoading] = useState(!hasInitialCache);  // false if cache exists → no loading bar
    const [isRevalidating, setIsRevalidating] = useState(hasInitialCache); // true if serving stale → revalidating
    const [error, setError] = useState<string | null>(null);
    const [fetchedAt, setFetchedAt] = useState<string | null>(initialSWR?.fetchedAt ?? null);
    const [staleAge, setStaleAge] = useState<number | null>(
        hasInitialCache ? Math.round((Date.now() - initialSWR!.timestamp) / 1000) : null
    );

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasMounted = useRef(false);

    if (hasInitialCache && !hasMounted.current) {
        console.log(
            `[usePageData] ⚡ SWR: instant load for ${pagePath} ` +
            `(${Math.round((Date.now() - initialSWR!.timestamp) / 1000)}s old, ` +
            `${initialSWR!.sheets.reduce((n, s) => n + s.rowCount, 0)} rows)`
        );
    }

    const fetchData = useCallback(async (isBackground = false, forceRefresh = false) => {
        if (!enabled) return;

        if (isBackground) {
            setIsRevalidating(true);
        } else {
            setLoading(true);
        }
        setError(null);

        // Force refresh: clear SWR sessionStorage cache
        if (forceRefresh) {
            try { sessionStorage.removeItem(swrCacheKey(pagePath, columnsKey, sheet)); } catch { /* */ }
        }

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
            setStaleAge(null); // fresh data

            // Persist to sessionStorage for SWR on next visit
            const cacheKey = swrCacheKey(pagePath, columnsKey, sheet);
            saveSWRCache(cacheKey, data.sheets, data.fetchedAt);

            console.log(
                `[usePageData] ${forceRefresh ? "🔄 Refreshed" : isBackground ? "🔄 Revalidated" : "✅ Fetched"} ${pagePath} → ` +
                `${data.sheetCount} sheets, ${data.sheets.reduce((n, s) => n + s.rowCount, 0)} rows (${elapsed}ms)`
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
            if (!isBackground) setSheets([]);
        } finally {
            setLoading(false);
            setIsRevalidating(false);
        }
    }, [pagePath, columnsKey, enabled]);

    // Track previous enabled state for lazy-load transition detection
    const prevEnabled = useRef(enabled);

    // On mount: if SWR cache was used, just background revalidate. Otherwise full fetch.
    useEffect(() => {
        if (hasMounted.current) {
            // Already mounted — check if enabled just transitioned false → true (lazy load trigger)
            if (enabled && !prevEnabled.current) {
                prevEnabled.current = true;
                const cachedEntry = loadSWRCache(swrCacheKey(pagePath, columnsKey, sheet));
                if (cachedEntry && cachedEntry.sheets.length > 0) {
                    setSheets(cachedEntry.sheets);
                    setFetchedAt(cachedEntry.fetchedAt);
                    setStaleAge(Math.round((Date.now() - cachedEntry.timestamp) / 1000));
                    fetchData(true); // background revalidate
                } else {
                    fetchData(false); // full fetch
                }
            }
            prevEnabled.current = enabled;
            return;
        }
        hasMounted.current = true;
        prevEnabled.current = enabled;
        if (!enabled) return;

        if (hasInitialCache) {
            // Data already rendered synchronously — just revalidate in background
            fetchData(true);
        } else {
            // No cache — full loading fetch
            fetchData(false);
        }
    }, [pagePath, columnsKey, sheet, enabled, fetchData, hasInitialCache]);

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
        isRevalidating,
        error,
        fetchedAt,
        staleAge,
        refetch: () => fetchData(false, true),
        getSheet,
        getSheetsByRole,
    };
}
