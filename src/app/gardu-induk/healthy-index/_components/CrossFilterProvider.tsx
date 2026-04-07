/**
 * CrossFilterProvider — shared cross-filter state for the Healthy Index MTU page.
 *
 * Every card, chart, and table reads from this context and dispatches
 * toggles through it. One click on any visual → entire page reacts.
 *
 * Pattern: React 19 Context + use() — no forwardRef needed.
 */
"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

/* ── Filter state shape ── */
export interface CrossFilterState {
    mtu: string | null;
    ultg: string | null;
    statusHi: string | null;
    gi: string | null;
    bay: string | null;
    prioritas: string | null;
    statusUsia: string | null;
    criticality: string | null;
    /** Global text search */
    search: string;
}

const EMPTY: CrossFilterState = {
    mtu: null,
    ultg: null,
    statusHi: null,
    gi: null,
    bay: null,
    prioritas: null,
    statusUsia: null,
    criticality: null,
    search: "",
};

/* ── Context value ── */
export interface CrossFilterContextValue {
    filters: CrossFilterState;
    /** Toggle a filter dimension (same value = clear, different = set) */
    toggle: <K extends keyof Omit<CrossFilterState, "search">>(
        key: K,
        value: string,
    ) => void;
    /** Set search text directly */
    setSearch: (text: string) => void;
    /** Atomically set GI + Bay (or clear both if already active) */
    drillToGiBay: (gi: string, bay: string) => void;
    /** Clear all filters */
    clearAll: () => void;
    /** True when any filter is active */
    hasFilters: boolean;
    /** Human-readable active filter summary */
    activeLabels: string[];
}

const CrossFilterContext = createContext<CrossFilterContextValue | null>(null);

/* ── Provider ── */
export function CrossFilterProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<CrossFilterState>(EMPTY);

    const toggle = useCallback(
        <K extends keyof Omit<CrossFilterState, "search">>(
            key: K,
            value: string,
        ) => {
            setFilters((prev) => {
                const newVal = prev[key] === value ? null : value;
                // Changing GI → clear bay selection
                if (key === "gi") {
                    return { ...prev, [key]: newVal, bay: null };
                }
                return { ...prev, [key]: newVal };
            });
        },
        [],
    );

    const setSearch = useCallback((text: string) => {
        setFilters((prev) => ({ ...prev, search: text }));
    }, []);

    const drillToGiBay = useCallback((gi: string, bay: string) => {
        setFilters((prev) => {
            // Toggle off if same GI + Bay already active
            if (prev.gi === gi && prev.bay === bay) {
                return { ...prev, gi: null, bay: null };
            }
            return { ...prev, gi, bay };
        });
    }, []);

    const clearAll = useCallback(() => {
        setFilters(EMPTY);
    }, []);

    const hasFilters = useMemo(
        () =>
            filters.mtu !== null ||
            filters.ultg !== null ||
            filters.statusHi !== null ||
            filters.gi !== null ||
            filters.bay !== null ||
            filters.prioritas !== null ||
            filters.statusUsia !== null ||
            filters.criticality !== null ||
            filters.search.length > 0,
        [filters],
    );

    const activeLabels = useMemo(() => {
        const out: string[] = [];
        if (filters.mtu) out.push(`MTU: ${filters.mtu}`);
        if (filters.ultg) out.push(`ULTG: ${filters.ultg}`);
        if (filters.statusHi) out.push(`Status: ${filters.statusHi}`);
        if (filters.gi) out.push(`GI: ${filters.gi}`);
        if (filters.bay) out.push(`Bay: ${filters.bay}`);
        if (filters.prioritas) out.push(`Prio: ${filters.prioritas}`);
        if (filters.statusUsia) out.push(`Usia: ${filters.statusUsia}`);
        if (filters.criticality) out.push(`Crit: ${filters.criticality}`);
        if (filters.search) out.push(`Search: "${filters.search}"`);
        return out;
    }, [filters]);

    const value = useMemo<CrossFilterContextValue>(
        () => ({ filters, toggle, setSearch, drillToGiBay, clearAll, hasFilters, activeLabels }),
        [filters, toggle, setSearch, drillToGiBay, clearAll, hasFilters, activeLabels],
    );

    return (
        <CrossFilterContext value={value}>
            {children}
        </CrossFilterContext>
    );
}

/* ── Hook ── */
export function useCrossFilter(): CrossFilterContextValue {
    const ctx = useContext(CrossFilterContext);
    if (!ctx) throw new Error("useCrossFilter must be used within CrossFilterProvider");
    return ctx;
}
