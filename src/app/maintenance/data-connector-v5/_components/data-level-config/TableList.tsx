"use client";

/**
 * Data Level Config — LEFT panel: list tabel BQ + filter + search.
 */

import { useMemo, useState } from "react";
import {
    Database,
    Table2,
    AlertTriangle,
    RefreshCw,
    Search,
    ChevronRight,
    CheckCircle2,
    Layers,
} from "lucide-react";
import { LEVEL_META, LEVEL_ORDER, tableKey } from "./constants";
import type { Level, TableEntry } from "./types";

const INPUT_CLS =
    "ds-body h-8 rounded-md border border-border bg-background px-2.5 outline-none " +
    "focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/60 ds-transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

export function TableList({
    tables,
    loading,
    error,
    activeKey,
    onSelect,
    onRefresh,
}: {
    tables: TableEntry[];
    loading: boolean;
    error: string | null;
    activeKey: string | null;
    onSelect: (key: string) => void;
    onRefresh: () => void;
}) {
    const [search, setSearch] = useState("");
    const [levelFilter, setLevelFilter] = useState<Level | "ALL">("ALL");

    const grouped = useMemo(() => {
        const filtered = tables.filter((t) => {
            if (levelFilter !== "ALL" && t.level !== levelFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!t.table.toLowerCase().includes(q) && !t.dataset.toLowerCase().includes(q))
                    return false;
            }
            return true;
        });
        const byDataset = new Map<string, TableEntry[]>();
        for (const t of filtered) {
            if (!byDataset.has(t.dataset)) byDataset.set(t.dataset, []);
            byDataset.get(t.dataset)!.push(t);
        }
        return Array.from(byDataset.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [tables, levelFilter, search]);

    const totalConfigured = tables.filter((t) => t.configured).length;

    return (
        <div className="flex w-1/2 max-w-md flex-col border-r border-border/60 bg-card/30">
            {/* Header */}
            <div className="border-b border-border/60 px-4 py-3 space-y-2.5 bg-card/40">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-400" />
                            <h1 className="ds-heading">Data Level Config</h1>
                        </div>
                        <p className="ds-body mt-1">
                            Tentukan level hirarki per tabel BQ. Default FLAT. Set non-FLAT untuk enrich FK
                            hirarki.
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 ds-small opacity-70">
                            <span className="flex items-center gap-1">
                                <Table2 className="w-3 h-3" />
                                {tables.length} tabel
                            </span>
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                {totalConfigured} configured
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="ds-transition cursor-pointer flex items-center gap-1.5 text-xs h-8 px-2.5 rounded-md border border-border bg-background hover:bg-white/5 hover:border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        title="Reload dari BQ"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>

                {/* Filter bar */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search dataset atau tabel…"
                            className={`${INPUT_CLS} w-full pl-8 placeholder:opacity-40`}
                        />
                    </div>
                    <select
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value as Level | "ALL")}
                        className={`${INPUT_CLS} cursor-pointer`}
                    >
                        <option value="ALL">All levels</option>
                        {LEVEL_ORDER.map((lvl) => (
                            <option key={lvl} value={lvl}>
                                {lvl}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading && <SkeletonList />}

                {error && (
                    <div className="m-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="ds-small text-red-200">{error}</span>
                    </div>
                )}

                {!loading && !error && grouped.length === 0 && (
                    <div className="p-8 text-center">
                        <Table2 className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <div className="ds-small opacity-60">
                            {tables.length === 0
                                ? "Belum ada tabel user di BQ. Daftarin spreadsheet dulu."
                                : "Ga ada tabel match filter."}
                        </div>
                    </div>
                )}

                {!loading &&
                    grouped.map(([dataset, items]) => (
                        <div key={dataset} className="border-b border-border/30 last:border-b-0">
                            <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md px-3 py-1.5 border-b border-border/50 flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 opacity-60" />
                                <span className="ds-label opacity-90 truncate">{dataset}</span>
                                <span className="ds-small opacity-50 ml-auto">{items.length} tabel</span>
                            </div>
                            {items.map((t) => {
                                const meta = LEVEL_META[t.level];
                                const isActive = activeKey === tableKey(t);
                                return (
                                    <button
                                        key={tableKey(t)}
                                        onClick={() => onSelect(tableKey(t))}
                                        className={`ds-transition group w-full flex items-center gap-2 px-3 h-10 text-left border-l-2 cursor-pointer ${
                                            isActive
                                                ? "bg-emerald-500/5 border-emerald-500"
                                                : "border-transparent hover:bg-white/[0.04] hover:border-white/10"
                                        }`}
                                    >
                                        <Table2
                                            className={`w-3.5 h-3.5 shrink-0 ${
                                                isActive ? "opacity-80" : "opacity-50 group-hover:opacity-70"
                                            }`}
                                        />
                                        <span className="ds-body flex-1 truncate text-foreground/90">
                                            {t.table}
                                        </span>
                                        <span
                                            className={`ds-data rounded px-1.5 py-0.5 border ${meta.bg} ${meta.color} shrink-0`}
                                        >
                                            {meta.label}
                                        </span>
                                        {t.configured ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        ) : (
                                            <span className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        <ChevronRight
                                            className={`w-3 h-3 shrink-0 ds-transition ${
                                                isActive
                                                    ? "opacity-80 translate-x-0.5"
                                                    : "opacity-30 group-hover:opacity-60"
                                            }`}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    ))}
            </div>
        </div>
    );
}

function SkeletonList() {
    return (
        <div className="p-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2">
                    <div className="w-3.5 h-3.5 rounded bg-white/5 animate-pulse" />
                    <div
                        className="h-3 rounded bg-white/5 animate-pulse"
                        style={{ width: `${40 + (i * 7) % 40}%` }}
                    />
                    <div className="ml-auto w-10 h-4 rounded bg-white/5 animate-pulse" />
                </div>
            ))}
        </div>
    );
}
