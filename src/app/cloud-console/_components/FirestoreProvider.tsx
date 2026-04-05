'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, getFirestore } from 'firebase/firestore';
import { clientDb } from '@/lib/firebase-client';

interface FirestoreContextType {
    configs: Record<string, any>;
    dataSources: Record<string, any>;
    isLoadingConfigs: boolean;
    isLoadingDataSources: boolean;
    error: Error | null;
}

const FirestoreContext = createContext<FirestoreContextType | null>(null);

export function FirestoreProvider({ children }: { children: React.ReactNode }) {
    const [configs, setConfigs] = useState<Record<string, any>>({});
    const [dataSources, setDataSources] = useState<Record<string, any>>({});
    const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
    const [isLoadingDataSources, setIsLoadingDataSources] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!clientDb) {
            console.error('[FirestoreProvider] clientDb is undefined');
            setIsLoadingConfigs(false);
            setIsLoadingDataSources(false);
            return;
        }

        let unsubConfigs: () => void;
        let unsubDataSources: () => void;

        try {
            unsubConfigs = onSnapshot(collection(clientDb, 'service_runtime_configs'), (snap) => {
                const newConfigs: Record<string, any> = {};
                snap.forEach((doc) => {
                    newConfigs[doc.id] = doc.data();
                });
                setConfigs(newConfigs);
                setIsLoadingConfigs(false);
            }, (err) => {
                console.error('[FirestoreProvider] error on configs:', err);
                setError(err);
                setIsLoadingConfigs(false);
            });

            unsubDataSources = onSnapshot(collection(clientDb, 'data_sources'), (snap) => {
                const newDataSources: Record<string, any> = {};
                snap.forEach((doc) => {
                    newDataSources[doc.id] = { id: doc.id, ...doc.data() };
                });
                setDataSources(newDataSources);
                setIsLoadingDataSources(false);
            }, (err) => {
                console.error('[FirestoreProvider] error on data_sources:', err);
                setError(err);
                setIsLoadingDataSources(false);
            });
        } catch (err) {
            console.error('[FirestoreProvider] Exception during onSnapshot setup:', err);
            setError(err as Error);
            setIsLoadingConfigs(false);
            setIsLoadingDataSources(false);
        }

        return () => {
            if (unsubConfigs) unsubConfigs();
            if (unsubDataSources) unsubDataSources();
        };
    }, []);

    return (
        <FirestoreContext.Provider value={{ configs, dataSources, isLoadingConfigs, isLoadingDataSources, error }}>
            {children}
        </FirestoreContext.Provider>
    );
}

export function useFirestoreContext() {
    const ctx = useContext(FirestoreContext);
    if (!ctx) {
        throw new Error('useFirestoreContext must be used within a FirestoreProvider');
    }
    return ctx;
}
