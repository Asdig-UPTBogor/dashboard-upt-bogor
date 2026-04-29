"use client";

/**
 * useProviderStatus — fetch + cache live status WaGate dari Dispatch admin proxy.
 *
 * Single-provider post WAHA archive 2026-04-21. Telegram (future) akan ditambah
 * saat implementation ready (lihat docs/TELEGRAM_IMPLEMENTATION_PLAN.md).
 *
 * Refresh: auto tiap `intervalMs` (default 30s) atau manual via `refresh()`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWagateStatus } from '../_lib/api';
import type { WahaStatus } from '../_lib/types';

export interface ProviderStatusMap {
    wagate: WahaStatus | null;
}

interface UseProviderStatusResult {
    statuses: ProviderStatusMap;
    loading: boolean;
    lastRefresh: string | null;
    refresh: () => Promise<void>;
}

export function useProviderStatus(intervalMs: number = 30_000): UseProviderStatusResult {
    const [statuses, setStatuses] = useState<ProviderStatusMap>({ wagate: null });
    const [loading, setLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<string | null>(null);
    const cancelledRef = useRef(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const wg = await getWagateStatus().catch(() => null);
            if (!cancelledRef.current) {
                setStatuses({ wagate: wg });
                setLastRefresh(new Date().toISOString());
            }
        } finally {
            if (!cancelledRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        cancelledRef.current = false;
        refresh();
        if (intervalMs > 0) {
            const id = setInterval(refresh, intervalMs);
            return () => {
                cancelledRef.current = true;
                clearInterval(id);
            };
        }
        return () => { cancelledRef.current = true; };
    }, [refresh, intervalMs]);

    return { statuses, loading, lastRefresh, refresh };
}
