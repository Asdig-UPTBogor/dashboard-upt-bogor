"use client";

/**
 * TableSidebar — panel kiri Canvas Page Config.
 *
 * List tabel BQ dari `/api/bq-table-levels` (sama endpoint Data Level Config).
 * Group by dataset, searchable. Tabel yang udah ada di canvas (currentSources)
 * di-exclude dari list.
 *
 * Draggable — onDragStart simpan JSON { dataset, table, level } ke dataTransfer,
 * orchestrator di index.tsx handle onDrop via screenToFlowPosition + addTable.
 */

import { useEffect, useMemo, useState } from "react";
import {
    Database, Table2, Loader2, AlertTriangle, RefreshCw, Filter, GripVertical,
} from "lucide-react";
import { LEVEL_META, LEVEL_ORDER, tableKey } from "./constants";
import type { Level, V5Source } from "./types";

export interface SidebarTable {
    dataset: string;
    table: string;
    level: Level;
    configured: boolean;
}

export const DRAG_MIME = "application/x-bq-table";

export function TableSidebar({ currentSources }: { currentSources: V5Source[] }) {
    const [tables, setTables] = useState<SidebarTable[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [levelFilter, setLevelFilter] = useState<Level | "ALL">("ALL");

    const reload = useMemo(
        () => async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/bq-table-levels");
                const json = await res.json();
                if (!json.ok) throw new Error(json.error || "Fetch failed");
                setTables(
                    (json.tables || []).map((t: SidebarTable) => ({
                        dataset: t.dataset,
                        table: t.table,
                        level: t.level,
                        configured: Boolean((t as { configured?: boolean }).configured),
                    }))
                );
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        void reload();
    }, [reload]);

    const inCanvasSet = useMemo(() => {
        const s = new Set<string>();
        for (const src of currentSources) s.add(tableKey(src));
        return s;
    }, [currentSources]);

    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = tables.filter((t) => {
            if (inCanvasSet.has(tableKey(t))) return false;
            if (levelFilter !== "ALL" && t.level !== levelFilter) return false;
            if (q && !t.table.toLowerCase().includes(q) && !t.dataset.toLowerCase().includes(q)) {
                return false;
            }
            return true;
        });
        const byDataset = new Map<string, SidebarTable[]>();
        for (const t of filtered) {
            const arr = byDataset.get(t.dataset) ?? [];
            arr.push(t);
            byDataset.set(t.dataset, arr);
        }
        return Array.from(byDataset.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [tables, search, levelFilter, inCanvasSet]);

    return (
        <aside className="flex w-80 shrink-0 flex-col border-r border-border/40 bg-card/20">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/40">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="ds-label">Tabel BQ Tersedia</h2>
                    <button
                        onClick={() => void reload()}
                        disabled={loading}
                        className="ds-transition p-1 rounded hover:bg-muted opacity-60 hover:opacity-100 disabled:opacity-30 cursor-pointer"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="ds-body w-full rounded-md border border-border bg-background pl-7 pr-2 py-1.5 placeholder:opacity-50"
                        />
                        <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50" />
                    </div>
                    <select
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value as Level | "ALL")}
                        className="ds-body rounded-md border border-border bg-background px-1.5 py-1.5"
                    >
                        <option value="ALL">All</option>
                        {LEVEL_ORDER.map((lvl) => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="p-4 text-center ds-small opacity-60">
                        <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-2" />
                        Loading...
                    </div>
                )}
                {error && (
                    <div className="m-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
                        <AlertTriangle className="h-4 w-4 inline mr-1.5" />
                        {error}
                    </div>
                )}
                {!loading && !error && grouped.length === 0 && (
                    <div className="p-4 text-center ds-small opacity-60">
                        {tables.length === 0
                            ? "Belum ada tabel user di BQ."
                            : "Semua tabel sudah di canvas, atau tidak match filter."}
                    </div>
                )}
                {grouped.map(([dataset, items]) => (
                    <div key={dataset} className="border-b border-border/20 last:border-b-0">
                        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur px-3 py-1.5 border-b border-border/30 flex items-center gap-1.5">
                            <Database className="h-3 w-3 opacity-60 shrink-0" />
                            <span className="ds-label truncate flex-1">{dataset}</span>
                            <span className="ds-small opacity-50">{items.length}</span>
                        </div>
                        {items.map((t) => {
                            const meta = LEVEL_META[t.level];
                            return (
                                <div
                                    key={tableKey(t)}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = "copy";
                                        e.dataTransfer.setData(
                                            DRAG_MIME,
                                            JSON.stringify({
                                                dataset: t.dataset,
                                                table: t.table,
                                                level: t.level,
                                            })
                                        );
                                    }}
                                    className="ds-transition group flex items-center gap-2 px-3 py-2 border-l-2 border-transparent hover:bg-muted/50 hover:border-indigo-500/50 cursor-grab active:cursor-grabbing"
                                >
                                    <GripVertical className="h-3 w-3 opacity-30 group-hover:opacity-70 shrink-0" />
                                    <Table2 className="h-3 w-3 opacity-50 shrink-0" />
                                    <span className="ds-body truncate flex-1 font-mono">{t.table}</span>
                                    <span
                                        className={`ds-data rounded px-1.5 py-0.5 border ${meta.bg} ${meta.color} shrink-0`}
                                    >
                                        {meta.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-border/40 bg-muted/10">
                <p className="ds-small opacity-60">
                    Drag tabel ke canvas untuk nambahin ke page ini.
                </p>
            </div>
        </aside>
    );
}
