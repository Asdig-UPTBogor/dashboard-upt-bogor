/**
 * Data Level Config — hook: load table list dari /api/bq-table-levels.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { TableEntry } from "./types";

export function useTables() {
    const [tables, setTables] = useState<TableEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/bq-table-levels");
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || "Fetch failed");
            setTables(json.tables || []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    return { tables, loading, error, reload };
}
