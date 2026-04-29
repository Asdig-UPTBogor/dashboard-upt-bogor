'use client';

/**
 * DC V5 Firestore hooks — pattern mirror Cloud Console `useFirestore.ts`.
 *
 * Listen realtime ke collection:
 *   - `dashboard_pages_v5`         → V5 page configs
 *   - `data_sources_v2`            → spreadsheet registry V2 (Wizard V2 write target)
 *   - `service_runtime_configs/spreadsheet_sync` → master hierarchy config
 *
 * Benefit: zero polling, auto-refresh saat data berubah, singleton subscription.
 */

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { clientDb } from '@/lib/firebase-client';
import type { DataSourceV2 } from '@/lib/ss-v5/data-source-schema';

interface V5PageMapping {
    pagePath: string;
    pageLabel?: string;
    v5Sources?: Array<unknown>;
    v5UpdatedAt?: string;
}

/** V2 data source doc — _id as the stable Firestore document id */
export type DataSourceV2Doc = DataSourceV2 & { id: string };

/**
 * Realtime listen collection `dashboard_pages_v5`.
 * Return: Map<pagePath, V5PageMapping> untuk page yg punya v5Sources non-empty.
 */
export function useFirestorePagesV5(): { pages: Map<string, V5PageMapping>; loading: boolean } {
    const [pages, setPages] = useState<Map<string, V5PageMapping>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!clientDb) {
            setLoading(false);
            return;
        }
        const unsub = onSnapshot(
            collection(clientDb, 'dashboard_pages_v5'),
            (snap) => {
                const next = new Map<string, V5PageMapping>();
                snap.forEach((d) => {
                    const data = d.data() as V5PageMapping;
                    if (!data.pagePath) return;
                    if (!Array.isArray(data.v5Sources) || data.v5Sources.length === 0) return;
                    next.set(data.pagePath, data);
                });
                setPages(next);
                setLoading(false);
            },
            (err) => {
                console.error('[useFirestorePagesV5]', err);
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    return { pages, loading };
}

/**
 * Realtime listen collection `data_sources_v2`.
 * Return: array of DataSourceV2 doc (full V2 shape — identity/syncControl/sheets/audit).
 *
 * Rename dari `useFirestoreDataSourcesV5` lama — shape berubah total. Consumer
 * wajib baca via V2 field (identity.name, syncControl.enabled, dst).
 */
export function useFirestoreDataSourcesV2(): {
    dataSources: DataSourceV2Doc[];
    loading: boolean;
} {
    const [dataSources, setDataSources] = useState<DataSourceV2Doc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!clientDb) {
            setLoading(false);
            return;
        }
        const unsub = onSnapshot(
            collection(clientDb, 'data_sources_v2'),
            (snap) => {
                const arr: DataSourceV2Doc[] = [];
                snap.forEach((d) => {
                    arr.push({ id: d.id, ...(d.data() as DataSourceV2) });
                });
                setDataSources(arr);
                setLoading(false);
            },
            (err) => {
                console.error('[useFirestoreDataSourcesV2]', err);
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    return { dataSources, loading };
}

/**
 * Realtime listen doc `service_runtime_configs/spreadsheet_sync`.
 */
export function useFirestoreSSConfig<T = unknown>(): { config: T | null; loading: boolean } {
    const [config, setConfig] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!clientDb) {
            setLoading(false);
            return;
        }
        const unsub = onSnapshot(
            doc(clientDb, 'service_runtime_configs', 'spreadsheet_sync'),
            (snap) => {
                setConfig((snap.exists() ? (snap.data() as T) : null));
                setLoading(false);
            },
            (err) => {
                console.error('[useFirestoreSSConfig]', err);
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    return { config, loading };
}
