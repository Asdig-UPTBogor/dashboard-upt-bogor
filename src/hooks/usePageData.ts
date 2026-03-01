/**
 * usePageData — Registry-driven data fetching hook
 *
 * Fetches all spreadsheet data linked to a page via the registry.
 * Replaces manual per-page fetch() calls.
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
    /** Error message if fetch failed */
    error: string | null;
    /** Fetch timestamp */
    fetchedAt: string | null;
    /** Manual refresh */
    refetch: () => void;
    /** Get a specific sheet by name (case-insensitive) */
    getSheet: (name: string) => SheetData | undefined;
    /** Get all sheets with a specific role */
    getSheetsByRole: (role: string) => SheetData[];
}

/* ── Hook ── */

export function usePageData(
    pagePath: string,
    options: UsePageDataOptions = {}
): UsePageDataReturn {
    const { columns, pollInterval, enabled = true } = options;

    const [sheets, setSheets] = useState<SheetData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);

    // Stable reference for columns param
    const columnsKey = columns?.join(",") || "";
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = useCallback(async () => {
        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({ page: pagePath });
            if (columnsKey) params.set("columns", columnsKey);

            const res = await fetch(`/api/page-data?${params.toString()}`);
            const json = await res.json();

            if (!res.ok) {
                setError(json.error || `HTTP ${res.status}`);
                setSheets([]);
                return;
            }

            const data = json as PageDataResponse;
            setSheets(data.sheets);
            setFetchedAt(data.fetchedAt);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
            setSheets([]);
        } finally {
            setLoading(false);
        }
    }, [pagePath, columnsKey, enabled]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Optional polling
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (pollInterval && pollInterval > 0 && enabled) {
            intervalRef.current = setInterval(fetchData, pollInterval);
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
        error,
        fetchedAt,
        refetch: fetchData,
        getSheet,
        getSheetsByRole,
    };
}
