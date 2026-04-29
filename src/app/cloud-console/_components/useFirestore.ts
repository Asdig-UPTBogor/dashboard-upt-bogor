import { useMemo } from 'react';
import { useFirestoreContext } from './FirestoreProvider';
import type { ServiceInfo } from '../layout';

export function useFirestoreConfig<T = any>(docId: string): T | null {
    const { configs } = useFirestoreContext();
    return configs[docId] || null;
}

const EMPTY_REGISTRY = {};

export function useFirestoreRegistry() {
    const config = useFirestoreConfig<{ services?: Record<string, unknown> }>('cloud_console');
    return config?.services || EMPTY_REGISTRY;
}

/**
 * Get current service info from registry by routePath.
 * Used by service pages to read name/subtitle/icon from registry
 * so page headers stay consistent with sidebar.
 */
export function useServiceInfo(routePath: string): ServiceInfo | null {
    const registry = useFirestoreRegistry();
    // Memoize — prevent new object ref every render (was source of parent page re-render jitter)
    return useMemo(() => {
        for (const [id, def] of Object.entries(registry)) {
            const svc = def as ServiceInfo;
            if (svc.routePath === routePath) return { ...svc, id };
        }
        return null;
    }, [registry, routePath]);
}

export function useFirestoreDataSources() {
    const { dataSources } = useFirestoreContext();
    return useMemo(() => Object.values(dataSources), [dataSources]);
}
