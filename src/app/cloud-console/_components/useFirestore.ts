import { useFirestoreContext } from './FirestoreProvider';
import type { ServiceInfo } from '../layout';

export function useFirestoreConfig<T = any>(docId: string): T | null {
    const { configs } = useFirestoreContext();
    return configs[docId] || null;
}

export function useFirestoreRegistry() {
    const config = useFirestoreConfig('cloud_console');
    if (!config || !config.services) return {};
    return config.services;
}

/**
 * Get current service info from registry by routePath.
 * Used by service pages to read name/subtitle/icon from registry
 * so page headers stay consistent with sidebar.
 */
export function useServiceInfo(routePath: string): ServiceInfo | null {
    const registry = useFirestoreRegistry();
    for (const [id, def] of Object.entries(registry)) {
        const svc = def as ServiceInfo;
        if (svc.routePath === routePath) return { ...svc, id };
    }
    return null;
}

export function useFirestoreDataSources() {
    const { dataSources } = useFirestoreContext();
    return Object.values(dataSources);
}
