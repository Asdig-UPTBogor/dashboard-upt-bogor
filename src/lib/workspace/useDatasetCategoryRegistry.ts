"use client";

/**
 * useDatasetCategoryRegistry — realtime FS overlay untuk dataset category.
 *
 *  onSnapshot `data_platform_dataset` collection. Admin edit doc → broadcast
 *  ke semua tab terbuka → DatasetTree rerender otomatis.
 *
 *  Rules (firestore.rules): `match /data_platform_dataset/{doc} allow read: if true`.
 *  Write lewat API `/api/workspace/datasets/[id]` saja (Admin SDK bypass rules).
 */

import { useEffect, useState } from "react";
import { clientDb, collection, onSnapshot, type DocumentData } from "@/lib/firebase-client";

export interface DatasetOverlay {
    alias?: string;
    description?: string;
    icon?: string;
    category?: string;
    categoryOrder?: number;
    datasetOrder?: number;
    updatedBy?: string;
    updatedAt?: unknown;
}

export type DatasetOverlayMap = Record<string, DatasetOverlay>;

export function useDatasetCategoryRegistry(): {
    overlay: DatasetOverlayMap;
    loading: boolean;
    error: string | null;
} {
    const [overlay, setOverlay] = useState<DatasetOverlayMap>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(clientDb, "data_platform_dataset"),
            (snap) => {
                const next: DatasetOverlayMap = {};
                snap.forEach((d) => {
                    next[d.id] = d.data() as DocumentData as DatasetOverlay;
                });
                setOverlay(next);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.warn("[workspace:registry] onSnapshot error", err);
                setError(err.message);
                setLoading(false);
            },
        );
        return () => unsub();
    }, []);

    return { overlay, loading, error };
}
