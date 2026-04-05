import { useFirestoreContext } from './FirestoreProvider';

export function useFirestoreConfig<T = any>(docId: string): T | null {
    const { configs } = useFirestoreContext();
    return configs[docId] || null;
}

export function useFirestoreRegistry() {
    const config = useFirestoreConfig('cloud_console');
    if (!config || !config.services) return {};
    return config.services;
}

export function useFirestoreDataSources() {
    const { dataSources } = useFirestoreContext();
    return Object.values(dataSources);
}
