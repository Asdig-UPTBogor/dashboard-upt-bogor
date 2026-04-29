'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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
            // Selective merge: unchanged docs keep same object reference so consumers
            // that memoize on configs[id] don't re-render when another service's doc updates.
            unsubConfigs = onSnapshot(collection(clientDb, 'service_runtime_configs'), (snap) => {
                const changes = snap.docChanges();
                if (changes.length === 0) {
                    setIsLoadingConfigs(false);
                    return;
                }
                setConfigs((prev) => {
                    const next = { ...prev };
                    let mutated = false;
                    for (const ch of changes) {
                        if (ch.type === 'removed') {
                            if (ch.doc.id in next) {
                                delete next[ch.doc.id];
                                mutated = true;
                            }
                        } else {
                            next[ch.doc.id] = ch.doc.data();
                            mutated = true;
                        }
                    }
                    return mutated ? next : prev;
                });
                setIsLoadingConfigs(false);
            }, (err) => {
                console.error('[FirestoreProvider] error on configs:', err);
                setError(err);
                setIsLoadingConfigs(false);
            });

            unsubDataSources = onSnapshot(collection(clientDb, 'data_sources_v2'), (snap) => {
                const changes = snap.docChanges();
                if (changes.length === 0) {
                    setIsLoadingDataSources(false);
                    return;
                }
                setDataSources((prev) => {
                    const next = { ...prev };
                    let mutated = false;
                    for (const ch of changes) {
                        if (ch.type === 'removed') {
                            if (ch.doc.id in next) {
                                delete next[ch.doc.id];
                                mutated = true;
                            }
                        } else {
                            next[ch.doc.id] = { id: ch.doc.id, ...ch.doc.data() };
                            mutated = true;
                        }
                    }
                    return mutated ? next : prev;
                });
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

    // Memoize context value — prevent every child consumer from re-rendering when provider
    // itself re-renders for unrelated reasons. Only triggers consumer update when one of
    // these references actually changes.
    const value = useMemo(
        () => ({ configs, dataSources, isLoadingConfigs, isLoadingDataSources, error }),
        [configs, dataSources, isLoadingConfigs, isLoadingDataSources, error],
    );

    return (
        <FirestoreContext.Provider value={value}>
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
