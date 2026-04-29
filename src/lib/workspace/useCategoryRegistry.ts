"use client";

/**
 * useCategoryRegistry — realtime categories via Firebase Client SDK onSnapshot.
 *
 *  Source of truth:
 *    1. Firestore `data_workspace_categories` (onSnapshot, push-realtime)
 *    2. Seed defaults dari workspace-tokens (fallback selalu tersedia)
 *
 *  FE berlangganan langsung ke Firestore → admin write via API → Firestore rules
 *  allow read public → semua tab rerender otomatis tanpa refresh.
 *  Rules di firestore.rules: `match /data_workspace_categories/{doc} allow read: if true`.
 */

import { useEffect, useMemo, useState } from "react";
import { clientDb, collection, onSnapshot, type DocumentData } from "@/lib/firebase-client";
import { CATEGORY_PALETTE, CATEGORY_ORDER, type CategoryKey } from "@/app/data-workspace/_components/workspace-tokens";

export interface CategoryRecord {
    key: string;
    label: string;
    order: number;
    hint: string;
    archived?: boolean;
    source: "fs" | "seed";
}

function buildSeed(): CategoryRecord[] {
    return CATEGORY_ORDER.map((k, i) => ({
        key: k,
        label: CATEGORY_PALETTE[k].label,
        order: i,
        hint: CATEGORY_PALETTE[k].hint,
        source: "seed" as const,
    }));
}

export function useCategoryRegistry(): {
    categories: CategoryRecord[];
    loading: boolean;
    error: string | null;
} {
    const seed = useMemo(buildSeed, []);
    const [fsRecords, setFsRecords] = useState<Record<string, CategoryRecord>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(clientDb, "data_workspace_categories"),
            (snap) => {
                const next: Record<string, CategoryRecord> = {};
                snap.forEach((d) => {
                    const data = d.data() as DocumentData;
                    next[d.id] = {
                        key: d.id,
                        label: String(data.label ?? d.id),
                        order: typeof data.order === "number" ? data.order : 9999,
                        hint: String(data.hint ?? ""),
                        archived: data.archived === true,
                        source: "fs",
                    };
                });
                setFsRecords(next);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.warn("[workspace:categories] onSnapshot error", err);
                setError(err.message);
                setLoading(false);
            },
        );
        return () => unsub();
    }, []);

    const categories = useMemo(() => {
        const merged = new Map<string, CategoryRecord>();
        for (const s of seed) merged.set(s.key, s);
        for (const fs of Object.values(fsRecords)) merged.set(fs.key, fs);
        return Array.from(merged.values())
            .filter((c) => !c.archived)
            .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }, [seed, fsRecords]);

    return { categories, loading, error };
}

export function lookupCategory(
    categories: CategoryRecord[],
    key: string | CategoryKey | undefined | null,
): CategoryRecord {
    if (key) {
        const hit = categories.find((c) => c.key === key);
        if (hit) return hit;
    }
    return categories.find((c) => c.key === "uncategory") ?? categories[categories.length - 1];
}
