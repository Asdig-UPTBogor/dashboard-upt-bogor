"use client";

/**
 * useCanvasState — encapsulate state mgmt untuk Canvas Page Config.
 *
 * Source-of-truth: Firestore `dashboard_pages_v5` (via useFirestorePagesV5).
 * Local state = mutable working copy, `saveCanvas()` commit ke Firestore lewat
 * POST /api/data-connector-v5/mapping.
 *
 * Actions:
 *   - addTable(dataset, table, level) — fetch schema + push ke v5Sources
 *   - removeTable(dataset, table)     — splice + purge edge terkait
 *   - setNodePosition(id, pos)        — patch nodePositions
 *   - addManualEdge(from, to, label?) — append manualEdges
 *   - removeAutoEdge(from, to)        — opt-out dari chain auto
 *   - saveCanvas()                    — POST ke mapping endpoint
 */

import { useCallback, useEffect, useState } from "react";
import { useFirestorePagesV5 } from "../shared/useFirestore";
import { escapeFirestoreKey, unescapeFirestoreKey, sourceNodeId } from "./constants";
import type { Level, V5Source, ManualEdge, V5Column } from "./types";

interface UseCanvasStateOptions {
    pagePath: string;
    pageLabel: string;
}

interface PersistedShape {
    v5Sources?: V5Source[];
    nodePositions?: Record<string, { x: number; y: number }>;
    manualEdges?: ManualEdge[];
    removedAutoEdges?: string[];
}

export function useCanvasState({ pagePath, pageLabel }: UseCanvasStateOptions) {
    const { pages: v5PagesMap } = useFirestorePagesV5();

    const [v5Sources, setV5Sources] = useState<V5Source[]>([]);
    const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(
        {}
    );
    const [manualEdges, setManualEdges] = useState<ManualEdge[]>([]);
    const [removedAutoEdges, setRemovedAutoEdges] = useState<string[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* Hydrate saat pagePath berubah atau Firestore snapshot datang */
    useEffect(() => {
        setHydrated(false);
    }, [pagePath]);

    useEffect(() => {
        if (hydrated) return;
        const page = v5PagesMap.get(pagePath) as PersistedShape | undefined;
        if (page) {
            setV5Sources(Array.isArray(page.v5Sources) ? page.v5Sources : []);
            const raw = page.nodePositions || {};
            const unescaped: Record<string, { x: number; y: number }> = {};
            for (const [k, v] of Object.entries(raw)) {
                unescaped[unescapeFirestoreKey(k)] = v;
            }
            setNodePositions(unescaped);
            setManualEdges(Array.isArray(page.manualEdges) ? page.manualEdges : []);
            setRemovedAutoEdges(
                Array.isArray(page.removedAutoEdges) ? page.removedAutoEdges : []
            );
        } else {
            setV5Sources([]);
            setNodePositions({});
            setManualEdges([]);
            setRemovedAutoEdges([]);
        }
        setHydrated(true);
    }, [v5PagesMap, pagePath, hydrated]);

    const addTable = useCallback(
        async (dataset: string, table: string, level: Level) => {
            // Guard: sudah ada?
            if (v5Sources.some((s) => s.dataset === dataset && s.table === table)) return;
            setError(null);
            try {
                const res = await fetch(
                    `/api/data-connector-v5/bq-schema?dataset=${encodeURIComponent(dataset)}&table=${encodeURIComponent(table)}`
                );
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || "schema fetch failed");
                const columns: V5Column[] = Array.isArray(data.columns)
                    ? data.columns.map((c: { name: string; type: string }) => ({
                          name: c.name,
                          type: c.type,
                      }))
                    : [];
                const nodeType = (data.nodeType || "n_table") as V5Source["nodeType"];
                setV5Sources((prev) => [
                    ...prev,
                    { dataset, table, nodeType, level, columns },
                ]);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
            }
        },
        [v5Sources]
    );

    const removeTable = useCallback((dataset: string, table: string) => {
        const nid = sourceNodeId(dataset, table);
        setV5Sources((prev) =>
            prev.filter((s) => !(s.dataset === dataset && s.table === table))
        );
        setManualEdges((prev) => prev.filter((e) => e.from !== nid && e.to !== nid));
        setRemovedAutoEdges((prev) =>
            prev.filter((k) => !k.startsWith(`${nid}->`) && !k.endsWith(`->${nid}`))
        );
        setNodePositions((prev) => {
            const next = { ...prev };
            delete next[nid];
            return next;
        });
    }, []);

    const setNodePosition = useCallback((id: string, pos: { x: number; y: number }) => {
        setNodePositions((prev) => ({ ...prev, [id]: pos }));
    }, []);

    const addManualEdge = useCallback((from: string, to: string, label?: string) => {
        setManualEdges((prev) => [
            ...prev,
            { id: `m::${from}->${to}::${Date.now()}`, from, to, label },
        ]);
    }, []);

    const removeAutoEdge = useCallback((from: string, to: string) => {
        const key = `${from}->${to}`;
        setRemovedAutoEdges((prev) => (prev.includes(key) ? prev : [...prev, key]));
    }, []);

    const saveCanvas = useCallback(async () => {
        setSaving(true);
        setError(null);
        try {
            const escapedPositions: Record<string, { x: number; y: number }> = {};
            for (const [k, v] of Object.entries(nodePositions)) {
                escapedPositions[escapeFirestoreKey(k)] = v;
            }
            const res = await fetch("/api/data-connector-v5/mapping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pagePath,
                    pageLabel,
                    v5Sources,
                    nodePositions: escapedPositions,
                    manualEdges,
                    removedAutoEdges,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "save failed");
            return { ok: true as const };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            return { ok: false as const, error: msg };
        } finally {
            setSaving(false);
        }
    }, [pagePath, pageLabel, v5Sources, nodePositions, manualEdges, removedAutoEdges]);

    return {
        // state
        v5Sources,
        nodePositions,
        manualEdges,
        removedAutoEdges,
        hydrated,
        saving,
        error,
        // actions
        addTable,
        removeTable,
        setNodePosition,
        addManualEdge,
        removeAutoEdge,
        saveCanvas,
    };
}
