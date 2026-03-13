"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const FRESH_WINDOW_MS = 5 * 60 * 1000;

interface SyncStatusSnapshot {
    syncSnapshot?: {
        lastSyncAt?: string | null;
    };
    worker?: {
        isRefreshing?: boolean;
        lastRefreshAt?: string | null;
    };
}

interface WorkerControlState {
    worker?: {
        isRefreshing?: boolean;
    };
}

export function SyncStatusChip() {
    const [snapshot, setSnapshot] = useState<SyncStatusSnapshot | null>(null);
    const [now, setNow] = useState(Date.now());
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);

    const loadSnapshot = useCallback(async () => {
        const response = await fetch("/api/rate-limit", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Failed to load sync status");
        }
        const data = await response.json();
        setSnapshot(data as SyncStatusSnapshot);
    }, []);

    const loadWorkerControlState = useCallback(async () => {
        const response = await fetch("/api/worker-control", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Failed to load worker control state");
        }
        return response.json() as Promise<WorkerControlState>;
    }, []);

    useEffect(() => {
        let cancelled = false;
        const safeLoadSnapshot = async () => {
            try {
                const response = await fetch("/api/rate-limit", { cache: "no-store" });
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled) {
                    setSnapshot(data as SyncStatusSnapshot);
                }
            } catch {
                // Keep header quiet on failure; stale indicator covers it.
            }
        };

        void safeLoadSnapshot();
        const intervalId = setInterval(() => {
            void safeLoadSnapshot();
        }, CHECK_INTERVAL_MS);

        const tickId = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        const handleFocus = () => {
            if (document.visibilityState === "visible") {
                void safeLoadSnapshot();
            }
        };

        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleFocus);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
            clearInterval(tickId);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleFocus);
        };
    }, []);

    const lastSyncAt = snapshot?.syncSnapshot?.lastSyncAt || snapshot?.worker?.lastRefreshAt || null;
    const isRefreshing = isManualRefreshing || (snapshot?.worker?.isRefreshing ?? false);
    const ageMs = lastSyncAt ? Math.max(0, now - new Date(lastSyncAt).getTime()) : null;
    const isFresh = ageMs !== null && ageMs <= FRESH_WINDOW_MS;

    const title = isRefreshing
        ? "Sync worker is updating data"
        : lastSyncAt
            ? `Last refresh ${new Date(lastSyncAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "Asia/Jakarta",
            })} WIB`
            : "No sync yet";

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsManualRefreshing(true);
        try {
            const state = await loadWorkerControlState();
            if (state.worker?.isRefreshing) {
                await loadSnapshot();
                return;
            }

            const response = await fetch("/api/worker-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "refresh" }),
            });
            if (response.status === 409) {
                await loadSnapshot();
                return;
            }
            if (!response.ok) {
                throw new Error("Failed to trigger sync");
            }
            await loadSnapshot();
            window.setTimeout(() => {
                void loadSnapshot();
            }, 1200);
        } catch {
            // Keep the control quiet; the red stale state is enough if sync fails.
        } finally {
            window.setTimeout(() => {
                setIsManualRefreshing(false);
            }, 1500);
        }
    };

    return (
        <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5 transition-colors hover:bg-muted/70 disabled:cursor-default"
            title={title}
            aria-label={title}
        >
            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${isRefreshing ? "bg-blue-500/10" : isFresh ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                {isRefreshing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
                ) : (
                    <span className={`h-2.5 w-2.5 rounded-full ${isFresh ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-pulse"}`} />
                )}
            </div>
        </button>
    );
}
