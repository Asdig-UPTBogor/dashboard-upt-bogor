/**
 * useSnapshot — client hook untuk baca data snapshot (CE + Program Kerja).
 *
 * Sumber: GET /api/snapshot?q=<key> → schema dashboard_snapshot (Supabase Postgres).
 * Snapshot sementara; nanti pindah ke tabel actual. Lihat snapshot-db.ts.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSnapshotReturn<T> {
    rows: T[];
    loading: boolean;
    error: string | null;
    fetchedAt: string | null;
    refetch: () => void;
}

export function useSnapshot<T = Record<string, unknown>>(
    query: string,
    params?: { bidang?: string; program?: string }
): UseSnapshotReturn<T> {
    const [rows, setRows] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);
    const pKey = params ? `${params.bidang || ""}|${params.program || ""}` : "";

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const sp = new URLSearchParams({ q: query });
            if (params?.bidang) sp.set("bidang", params.bidang);
            if (params?.program) sp.set("program", params.program);
            const res = await fetch(`/api/snapshot?${sp.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.ok) {
                setError(json.error || `HTTP ${res.status}`);
                setRows([]);
                return;
            }
            setRows(json.rows as T[]);
            setFetchedAt(json.fetchedAt);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
            setRows([]);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, pKey]);

    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        fetchData();
    }, [fetchData]);

    return { rows, loading, error, fetchedAt, refetch: fetchData };
}
