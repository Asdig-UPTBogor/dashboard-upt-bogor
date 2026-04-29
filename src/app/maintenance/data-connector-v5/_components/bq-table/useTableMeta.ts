"use client";

/**
 * useTableMeta — load schema (initial) + paginated rows preview (deferred).
 */

import { useCallback, useEffect, useState } from "react";

export interface SchemaColumn {
    name: string;
    type: string;
    mode: string;
    description?: string;
}

export interface SchemaResponse {
    ok: boolean;
    dataset?: string;
    table?: string;
    columns?: SchemaColumn[];
    nodeType?: string;
    error?: string;
}

export interface PreviewResponse {
    ok: boolean;
    totalRows?: number;
    page?: number;
    pageSize?: number;
    columns?: Array<{ name: string; type: string }>;
    rows?: Array<Record<string, unknown>>;
    error?: string;
    code?: string;
}

export type TabKind = "schema" | "data";

export const PAGE_SIZE = 100;

export function useTableMeta(dataset: string, table: string, tab: TabKind, page: number) {
    const [schema, setSchema] = useState<SchemaResponse | null>(null);
    const [schemaLoading, setSchemaLoading] = useState(true);

    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    /* ─── Load schema (initial) ─── */
    useEffect(() => {
        let cancelled = false;
        setSchemaLoading(true);
        setError(null);
        fetch(`/api/data-connector-v5/bq-schema?dataset=${encodeURIComponent(dataset)}&table=${encodeURIComponent(table)}`)
            .then((r) => r.json())
            .then((json: SchemaResponse) => {
                if (cancelled) return;
                setSchema(json);
                if (!json.ok) setError(json.error || "Gagal load schema");
            })
            .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
            .finally(() => { if (!cancelled) setSchemaLoading(false); });
        return () => { cancelled = true; };
    }, [dataset, table]);

    /* ─── Load preview (deferred sampai tab "data") ─── */
    const loadPreview = useCallback(
        async (targetPage: number) => {
            setPreviewLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `/api/data-connector-v5/bq-preview?dataset=${encodeURIComponent(dataset)}&table=${encodeURIComponent(table)}&page=${targetPage}&pageSize=${PAGE_SIZE}`
                );
                const json: PreviewResponse = await res.json();
                setPreview(json);
                if (!json.ok) setError(json.error || "Gagal load preview");
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                setPreviewLoading(false);
            }
        },
        [dataset, table]
    );

    useEffect(() => {
        if (tab === "data") loadPreview(page);
    }, [tab, page, loadPreview]);

    return {
        schema,
        schemaLoading,
        preview,
        previewLoading,
        error,
        loadPreview,
    };
}
