"use client";

/**
 * DatasetTree — sidebar IS config UI (no modal).
 *
 *  DnD:
 *   ▸ Drag dataset → drop ke section kategori   → PATCH dataset.category
 *   ▸ Drag section (grip di header) → reorder    → PATCH categories.order
 *
 *  Kategori:
 *   ▸ Hover header → pencil (rename) + trash (archive)
 *   ▸ Double-click label = shortcut rename
 *   ▸ + New category button inline di bawah list
 *
 *  Navigation:
 *   ▸ Click dataset body = navigate ke /data-workspace/[ds]
 *   ▸ Click chevron = expand tables inline
 *   ▸ Click table = navigate grid editor
 *
 *  Visual:
 *   ▸ Monochrome. Kategori aktif (berisi dataset yang sedang dibuka) = amber.
 *   ▸ First-open semua kategori collapsed.
 *   ▸ Empty kategori hidden. Uncategory hidden kalau kosong.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Loader2, AlertTriangle, RefreshCw, ChevronRight, ChevronDown, Search, X,
    Table2, Plus, FolderPlus, FolderTree, DatabaseZap, Trash2, Check, Pencil, MoreHorizontal,
    ArrowUp, ArrowDown, GripVertical, LayoutDashboard,
} from "lucide-react";
import {
    DndContext, closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors,
    useDroppable, DragOverlay,
    type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WORKSPACE_CHROME, WORKSPACE_SIDEBAR } from "./workspace-tokens";

const { LS_KEY_EXPANDED_DS, LS_KEY_COLLAPSED_SECTIONS } = WORKSPACE_SIDEBAR;

function readLSArray(key: string): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch { return []; }
}
function writeLSArray(key: string, value: Set<string>) {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(key, JSON.stringify(Array.from(value))); } catch {}
}
import { resolveCategory } from "@/lib/workspace/category-resolver";
import { useDatasetCategoryRegistry } from "@/lib/workspace/useDatasetCategoryRegistry";
import { useCategoryRegistry, type CategoryRecord } from "@/lib/workspace/useCategoryRegistry";
import { useWorkspace } from "./WorkspaceContext";

interface DatasetInfo {
    id: string;
    friendlyName?: string;
    description?: string;
    origin: "user" | "platform" | "legacy";
}

interface TableInfo {
    id: string;
    numRows: number;
    description?: string;
}

const DS_PREFIX = "dataset:";
const SEC_PREFIX = "section:";

function parseId(id: string): { kind: "dataset" | "section"; key: string } | null {
    if (id.startsWith(DS_PREFIX)) return { kind: "dataset", key: id.slice(DS_PREFIX.length) };
    if (id.startsWith(SEC_PREFIX)) return { kind: "section", key: id.slice(SEC_PREFIX.length) };
    return null;
}

export function DatasetTree({
    onNewDataset, onNewTable,
}: {
    onNewDataset: () => void;
    onNewTable: (dataset?: string) => void;
}) {
    const pathname = usePathname();
    const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
    const [tables, setTables] = useState<Record<string, TableInfo[]>>({});
    const [loadingDs, setLoadingDs] = useState(true);
    const [loadingTables, setLoadingTables] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(readLSArray(LS_KEY_EXPANDED_DS)));
    const [collapsedSections, setCollapsedSections] = useState<Set<string> | null>(() => {
        if (typeof window === "undefined") return null;
        const raw = window.localStorage.getItem(LS_KEY_COLLAPSED_SECTIONS);
        if (raw === null) return null;
        return new Set(readLSArray(LS_KEY_COLLAPSED_SECTIONS));
    });
    const [query, setQuery] = useState("");

    const [editingCat, setEditingCat] = useState<string | null>(null);
    const [editingDs, setEditingDs] = useState<string | null>(null);

    const [draggingDs, setDraggingDs] = useState<DatasetInfo | null>(null);
    const [writeErr, setWriteErr] = useState<string | null>(null);

    const { overlay: dsOverlay } = useDatasetCategoryRegistry();
    const { categories } = useCategoryRegistry();
    const { confirm, openNewGroup } = useWorkspace();

    const displayCategories = categories;

    const { activeDs, activeTable } = useMemo(() => {
        const m = pathname?.match(/^\/data-workspace\/([^/]+)(?:\/([^/]+))?/);
        return {
            activeDs: m?.[1] ? decodeURIComponent(m[1]) : null,
            activeTable: m?.[2] ? decodeURIComponent(m[2]) : null,
        };
    }, [pathname]);

    const loadDatasets = useCallback(async () => {
        setLoadingDs(true);
        setError(null);
        try {
            const res = await fetch("/api/data-input/datasets").then((r) => r.json());
            if (!res.ok) throw new Error(res.message || "Failed to load datasets");
            setDatasets(res.datasets);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingDs(false);
        }
    }, []);

    const loadTables = useCallback(async (ds: string) => {
        if (tables[ds]) return;
        setLoadingTables((prev) => ({ ...prev, [ds]: true }));
        try {
            const res = await fetch(`/api/data-input/datasets/${encodeURIComponent(ds)}`).then((r) => r.json());
            if (res.ok) setTables((prev) => ({ ...prev, [ds]: res.dataset.tables }));
        } finally {
            setLoadingTables((prev) => ({ ...prev, [ds]: false }));
        }
    }, [tables]);

    useEffect(() => { void loadDatasets(); }, [loadDatasets]);

    /** Persist expansion state ke localStorage agar CollapsedRail (saat sidebar
     *  hide) bisa mirror state yg sama. */
    useEffect(() => { writeLSArray(LS_KEY_EXPANDED_DS, expanded); }, [expanded]);
    useEffect(() => {
        if (collapsedSections !== null) writeLSArray(LS_KEY_COLLAPSED_SECTIONS, collapsedSections);
    }, [collapsedSections]);
    /** First-load: collapse semua. Saat user tambah kategori baru, kategori
     *  baru juga default collapsed (tidak nyembul expanded ganggu visual).
     *  Track previous keys via ref untuk diff add-only. */
    const lastKeysRef = useRef<string[]>([]);
    useEffect(() => {
        if (categories.length === 0) return;
        setCollapsedSections((prev) => {
            if (prev === null) {
                lastKeysRef.current = categories.map((c) => c.key);
                return new Set(lastKeysRef.current);
            }
            const lastSet = new Set(lastKeysRef.current);
            const newKeys = categories.filter((c) => !lastSet.has(c.key)).map((c) => c.key);
            lastKeysRef.current = categories.map((c) => c.key);
            if (newKeys.length === 0) return prev;
            const next = new Set(prev);
            for (const k of newKeys) next.add(k);
            return next;
        });
    }, [categories]);
    useEffect(() => { if (activeDs) void loadTables(activeDs); }, [activeDs, loadTables]);

    /** Saat user mulai search, preload tables semua dataset biar match
     *  bisa kena ke level table. Lazy — cache hit skipped otomatis. */
    useEffect(() => {
        if (query.trim().length === 0) return;
        let cancelled = false;
        (async () => {
            for (const d of datasets) {
                if (cancelled) return;
                if (tables[d.id]) continue;
                await loadTables(d.id);
            }
        })();
        return () => { cancelled = true; };
    }, [query, datasets, tables, loadTables]);

    function toggleDs(ds: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(ds)) next.delete(ds);
            else { next.add(ds); void loadTables(ds); }
            return next;
        });
    }

    function toggleSection(key: string) {
        setCollapsedSections((prev) => {
            const next = new Set(prev ?? []);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    const grouped = useMemo(() => {
        const groups = new Map<string, DatasetInfo[]>();
        for (const c of displayCategories) groups.set(c.key, []);
        for (const d of datasets) {
            const cat = resolveCategory(d.id, { fsCategory: dsOverlay[d.id]?.category });
            const targetKey = groups.has(cat) ? cat : "uncategory";
            if (!groups.has(targetKey)) groups.set(targetKey, []);
            groups.get(targetKey)!.push(d);
        }
        for (const key of groups.keys()) {
            groups.get(key)!.sort((a, b) => {
                const ao = dsOverlay[a.id]?.datasetOrder ?? 9999;
                const bo = dsOverlay[b.id]?.datasetOrder ?? 9999;
                if (ao !== bo) return ao - bo;
                return (a.friendlyName ?? a.id).localeCompare(b.friendlyName ?? b.id);
            });
        }
        return groups;
    }, [datasets, dsOverlay, displayCategories]);

    const activeCatKey = useMemo(() => {
        if (!activeDs) return null;
        const resolved = resolveCategory(activeDs, { fsCategory: dsOverlay[activeDs]?.category });
        return grouped.has(resolved) ? resolved : "uncategory";
    }, [activeDs, dsOverlay, grouped]);

    const q = query.trim().toLowerCase();
    function matches(d: DatasetInfo): boolean {
        if (!q) return true;
        if (d.id.toLowerCase().includes(q)) return true;
        if ((d.friendlyName ?? "").toLowerCase().includes(q)) return true;
        const ts = tables[d.id] ?? [];
        return ts.some((t) => t.id.toLowerCase().includes(q));
    }

    /* ─── DnD ─── */

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor),
    );

    function onDragStart(e: DragStartEvent) {
        const p = parseId(String(e.active.id));
        if (p?.kind === "dataset") {
            setDraggingDs(datasets.find((d) => d.id === p.key) ?? null);
        }
    }

    async function onDragEnd(e: DragEndEvent) {
        setDraggingDs(null);
        const active = parseId(String(e.active.id));
        const over = parseId(String(e.over?.id ?? ""));
        if (!active || !over) return;
        if (active.kind !== "dataset") return;

        const dsId = active.key;
        const currentCat = resolveCategory(dsId, { fsCategory: dsOverlay[dsId]?.category });

        // 1. Drop ke section header → cross-category assign
        if (over.kind === "section") {
            const targetCat = over.key;
            if (targetCat === currentCat) return;
            const payload = targetCat === "uncategory" ? { category: "" } : { category: targetCat };
            try {
                const res = await fetch(`/api/workspace/datasets/${encodeURIComponent(dsId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            } catch (err) {
                setWriteErr(`Gagal pindah ${dsId}: ${err instanceof Error ? err.message : String(err)}`);
            }
            return;
        }

        // 2. Drop ke dataset lain → within-section reorder
        if (over.kind === "dataset") {
            const overId = over.key;
            if (dsId === overId) return;
            const overCat = resolveCategory(overId, { fsCategory: dsOverlay[overId]?.category });

            if (overCat === currentCat) {
                // Same section → reorder via datasetOrder
                const sectionList = grouped.get(currentCat) ?? [];
                const oldIdx = sectionList.findIndex((d) => d.id === dsId);
                const newIdx = sectionList.findIndex((d) => d.id === overId);
                if (oldIdx === -1 || newIdx === -1) return;

                const reordered = arrayMove(sectionList, oldIdx, newIdx);
                // Commit order per-dataset (batch) — 1 write per dataset yang posisinya berubah
                const toSave = reordered
                    .map((d, i) => ({ id: d.id, order: i, old: dsOverlay[d.id]?.datasetOrder ?? 9999 }))
                    .filter((x) => x.order !== x.old);
                try {
                    await Promise.all(toSave.map((x) => fetch(
                        `/api/workspace/datasets/${encodeURIComponent(x.id)}`,
                        {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ datasetOrder: x.order }),
                        },
                    )));
                } catch (err) {
                    setWriteErr(`Reorder gagal: ${err instanceof Error ? err.message : String(err)}`);
                }
            } else {
                // Cross-section drop on a dataset → assign to that section's category
                const payload = overCat === "uncategory" ? { category: "" } : { category: overCat };
                try {
                    const res = await fetch(`/api/workspace/datasets/${encodeURIComponent(dsId)}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                } catch (err) {
                    setWriteErr(`Gagal pindah ${dsId}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }
    }

    /** Move category up/down in order — kebab menu action (bukan drag). */
    async function moveCategoryBy(key: string, delta: number) {
        const oldIdx = categories.findIndex((c) => c.key === key);
        const newIdx = oldIdx + delta;
        if (oldIdx === -1 || newIdx < 0 || newIdx >= categories.length) return;

        // Swap order antara kedua kategori — 2 writes saja.
        const a = categories[oldIdx];
        const b = categories[newIdx];
        try {
            await Promise.all([
                fetch("/api/workspace/categories", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ key: a.key, order: b.order }),
                }),
                fetch("/api/workspace/categories", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ key: b.key, order: a.order }),
                }),
            ]);
        } catch (err) {
            setWriteErr(`Reorder gagal: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /* ─── Inline category ops ─── */

    async function commitRename(key: string, newLabel: string, originalLabel: string) {
        setEditingCat(null);
        if (!newLabel.trim() || newLabel === originalLabel) return;
        try {
            const res = await fetch("/api/workspace/categories", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ key, label: newLabel.trim() }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            setWriteErr(`Rename gagal: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    async function archiveCategory(key: string, label: string) {
        const ok = await confirm({
            title: `Archive group "${label}"?`,
            description: "Dataset yang di group ini jadi Uncategory.\nData tidak hilang — bisa re-assign ke group lain kapan saja.",
            confirmLabel: "Archive",
            destructive: true,
        });
        if (!ok) return;
        try {
            const res = await fetch(`/api/workspace/categories?key=${encodeURIComponent(key)}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            setWriteErr(`Archive gagal: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /* ─── Dataset ops (alias rename, move up/down dalam section) ─── */

    async function renameDatasetAlias(dsId: string, newAlias: string, originalAlias: string) {
        setEditingDs(null);
        if (!newAlias.trim() || newAlias === originalAlias) return;
        try {
            const res = await fetch(`/api/workspace/datasets/${encodeURIComponent(dsId)}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ alias: newAlias.trim() }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            setWriteErr(`Rename gagal: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /** Move dataset up/down — swap datasetOrder dengan neighbor dalam section yang sama. */
    async function moveDatasetBy(dsId: string, delta: number) {
        const currentCat = resolveCategory(dsId, { fsCategory: dsOverlay[dsId]?.category });
        const sectionList = grouped.get(currentCat) ?? [];
        const oldIdx = sectionList.findIndex((d) => d.id === dsId);
        const newIdx = oldIdx + delta;
        if (oldIdx === -1 || newIdx < 0 || newIdx >= sectionList.length) return;

        const a = sectionList[oldIdx];
        const b = sectionList[newIdx];
        const aOrder = dsOverlay[a.id]?.datasetOrder ?? oldIdx;
        const bOrder = dsOverlay[b.id]?.datasetOrder ?? newIdx;
        try {
            await Promise.all([
                fetch(`/api/workspace/datasets/${encodeURIComponent(a.id)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ datasetOrder: bOrder }),
                }),
                fetch(`/api/workspace/datasets/${encodeURIComponent(b.id)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ datasetOrder: aOrder }),
                }),
            ]);
        } catch (err) {
            setWriteErr(`Move gagal: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const visibleSections = displayCategories.filter((cat) => {
        const inCat = grouped.get(cat.key) ?? [];
        return inCat.filter(matches).length > 0;
    });

    return (
        <aside className="w-full border-r border-border/60 bg-card/30 flex flex-col min-h-0">
            {/* Row 1 — Search + collapse-toggle. Chrome height. */}
            <div
                className="shrink-0 flex items-center gap-1.5 px-2.5 border-b border-border/60"
                style={{ height: WORKSPACE_CHROME.ROW_HEIGHT_PX }}
            >
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Find dataset or table…"
                        className="w-full pl-7 pr-6 py-1 text-xs rounded border border-border/50 bg-background/60 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            aria-label="Clear filter"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-50 hover:opacity-100"
                            title="Clear filter"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Row 2 — Datasets label + actions.
             *  Order kiri-kanan dari scope LUAS → KECIL:
             *  Overview (home) → Group → Dataset → Table → Refresh */}
            <div className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 border-b border-border/40">
                <span className="ds-label opacity-70 flex-1">Datasets</span>
                <IconBtn href="/data-workspace" title="Overview" active={pathname === "/data-workspace"}>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="New group" onClick={openNewGroup}>
                    <FolderTree className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="New dataset" onClick={onNewDataset}>
                    <FolderPlus className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="New table" onClick={() => onNewTable()}>
                    <Plus className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="Refresh datasets" onClick={loadDatasets} disabled={loadingDs}>
                    {loadingDs ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </IconBtn>
            </div>

            {writeErr && (
                <div className="shrink-0 mx-2 mt-2 flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="break-words flex-1">{writeErr}</span>
                    <button
                        type="button"
                        onClick={() => setWriteErr(null)}
                        aria-label="Dismiss error"
                        className="rounded p-0.5 opacity-60 hover:opacity-100"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <div className="flex-1 overflow-y-auto">
                    {loadingDs && datasets.length === 0 && (
                        <div className="py-8 flex flex-col items-center gap-2 opacity-60 text-xs">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Listing datasets…</span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive m-2">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="break-words">{error}</span>
                        </div>
                    )}

                    {!loadingDs && !error && visibleSections.map((cat, idx) => {
                            const inCat = grouped.get(cat.key) ?? [];
                            const visible = inCat.filter(matches);

                            // Saat search aktif, paksa expand section (biar user lihat match).
                            const searchActive = q.length > 0;
                            const isCollapsed = searchActive
                                ? false
                                : (collapsedSections?.has(cat.key) ?? true);
                            const isUncategory = cat.key === "uncategory";
                            // Emphasize (amber) saat section EXPANDED.
                            const emphasize = !isCollapsed;

                            return (
                                <DroppableSection
                                    key={cat.key}
                                    cat={cat}
                                    count={visible.length}
                                    collapsed={isCollapsed}
                                    emphasize={emphasize}
                                    isEditing={editingCat === cat.key}
                                    canMoveUp={idx > 0}
                                    canMoveDown={idx < visibleSections.length - 1}
                                    onToggle={() => toggleSection(cat.key)}
                                    onStartEdit={() => setEditingCat(cat.key)}
                                    onCommitRename={(v) => commitRename(cat.key, v, cat.label)}
                                    onCancelEdit={() => setEditingCat(null)}
                                    onArchive={() => archiveCategory(cat.key, cat.label)}
                                    onMoveUp={() => moveCategoryBy(cat.key, -1)}
                                    onMoveDown={() => moveCategoryBy(cat.key, 1)}
                                    canEdit={!isUncategory}
                                >
                                    {!isCollapsed && (
                                        <SortableContext
                                            items={visible.map((d) => `${DS_PREFIX}${d.id}`)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <ul className="space-y-0.5">
                                                {visible.map((ds, dsIdx) => {
                                                    const dsAlias = dsOverlay[ds.id]?.alias ?? ds.friendlyName ?? ds.id;
                                                    // Saat search: auto-expand dataset yg table-nya match query
                                                    const hasTableMatch = q.length > 0
                                                        && (tables[ds.id] ?? []).some((t) => t.id.toLowerCase().includes(q));
                                                    const effectivelyExpanded = expanded.has(ds.id) || hasTableMatch;
                                                    return (
                                                        <DatasetRow
                                                            key={ds.id}
                                                            ds={ds}
                                                            alias={dsAlias}
                                                            isActive={activeDs === ds.id}
                                                            isExpanded={effectivelyExpanded}
                                                            loadingTables={loadingTables[ds.id] ?? false}
                                                            tables={tables[ds.id] ?? []}
                                                            activeTable={activeDs === ds.id ? activeTable : null}
                                                            searchQuery={q}
                                                            isEditing={editingDs === ds.id}
                                                            canMoveUp={dsIdx > 0}
                                                            canMoveDown={dsIdx < visible.length - 1}
                                                            onToggleExpand={() => toggleDs(ds.id)}
                                                            onAddTable={() => onNewTable(ds.id)}
                                                            onStartEdit={() => setEditingDs(ds.id)}
                                                            onCommitRename={(v) => renameDatasetAlias(ds.id, v, dsAlias)}
                                                            onCancelEdit={() => setEditingDs(null)}
                                                            onMoveUp={() => moveDatasetBy(ds.id, -1)}
                                                            onMoveDown={() => moveDatasetBy(ds.id, 1)}
                                                        />
                                                    );
                                                })}
                                            </ul>
                                        </SortableContext>
                                    )}
                                </DroppableSection>
                            );
                        })}

                    {!loadingDs && !error && datasets.length === 0 && (
                        <div className="py-8 text-center opacity-50 text-xs">
                            No datasets yet. Create one →
                        </div>
                    )}

                </div>

                <DragOverlay
                    dropAnimation={null}
                    style={{ zIndex: 10000 }}
                >
                    {draggingDs && (
                        <div className="rounded border border-primary/60 bg-card shadow-xl px-2 py-1 text-xs flex items-center gap-1.5 min-w-[180px]">
                            <DatabaseZap className="h-3 w-3 opacity-60" />
                            <span className="truncate">
                                {dsOverlay[draggingDs.id]?.alias ?? draggingDs.friendlyName ?? draggingDs.id}
                            </span>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>
        </aside>
    );
}

/* ───── DroppableSection — drop target untuk dataset + inline rename ───── */

function DroppableSection({
    cat, count, collapsed, emphasize, isEditing, canMoveUp, canMoveDown,
    onToggle, onStartEdit, onCommitRename, onCancelEdit, onArchive, onMoveUp, onMoveDown,
    canEdit, children,
}: {
    cat: CategoryRecord;
    count: number;
    collapsed: boolean;
    emphasize: boolean;
    isEditing: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onToggle: () => void;
    onStartEdit: () => void;
    onCommitRename: (newLabel: string) => void;
    onCancelEdit: () => void;
    onArchive: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canEdit: boolean;
    children: React.ReactNode;
}) {
    const { isOver, setNodeRef } = useDroppable({ id: `${SEC_PREFIX}${cat.key}` });

    return (
        <section
            ref={setNodeRef}
            className={`px-2 pt-1.5 pb-0.5 group/sec-container ${
                isOver ? "bg-primary/5 ring-1 ring-primary/30 rounded" : ""
            }`}
        >
            <div className="w-full flex items-center gap-1 mb-1">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={!collapsed}
                    className="shrink-0 ds-transition rounded p-0.5 opacity-40 hover:opacity-80"
                    title={collapsed ? "Expand" : "Collapse"}
                >
                    {collapsed
                        ? <ChevronRight className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />}
                </button>
                {isEditing ? (
                    <InlineRenameInput
                        defaultValue={cat.label}
                        onCommit={onCommitRename}
                        onCancel={onCancelEdit}
                        emphasize={emphasize}
                    />
                ) : (
                    <span
                        onDoubleClick={canEdit ? onStartEdit : undefined}
                        className={`ds-label shrink-0 ds-transition group-hover/sec-container:text-primary ${
                            emphasize ? "text-primary" : "text-muted-foreground"
                        } ${canEdit ? "cursor-text" : ""}`}
                        title={canEdit ? `${cat.hint}\n\nDouble-click untuk rename.` : cat.hint}
                    >
                        {cat.label}
                    </span>
                )}
                <span
                    className={`flex-1 h-px mx-1.5 ds-transition group-hover/sec-container:bg-primary/30 ${
                        emphasize ? "bg-primary/30" : "bg-border/40"
                    }`}
                />
                <span className="ds-small font-mono opacity-50 tabular-nums">{count}</span>
                {canEdit && !isEditing && (
                    <CategoryMenu
                        onRename={onStartEdit}
                        onArchive={onArchive}
                        onMoveUp={canMoveUp ? onMoveUp : undefined}
                        onMoveDown={canMoveDown ? onMoveDown : undefined}
                        label={cat.label}
                    />
                )}
            </div>
            <div className="pl-1">{children}</div>
        </section>
    );
}

/* ───── Category kebab menu (hover-revealed, click-to-open popover) ───── */

function CategoryMenu({
    onRename, onArchive, onMoveUp, onMoveDown, onAddChild, addChildLabel, label,
}: {
    onRename: () => void;
    onArchive?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onAddChild?: () => void;
    addChildLabel?: string;
    label: string;
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        function onDocClick(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-category-menu]")) setOpen(false);
        }
        function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onEsc);
        };
    }, [open]);

    return (
        <div className="relative shrink-0" data-category-menu>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                aria-label={`Options for ${label}`}
                aria-expanded={open}
                title="More options"
                className={`ds-transition rounded p-0.5 hover:bg-muted/40 ${
                    open ? "opacity-100 bg-muted/40" : "opacity-0 group-hover/sec-container:opacity-60 hover:!opacity-100"
                }`}
            >
                <MoreHorizontal className="h-3 w-3" />
            </button>
            {open && (
                <div
                    className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-md border border-border/60 bg-popover shadow-lg py-1"
                    role="menu"
                >
                    {onAddChild && (
                        <>
                            <MenuItem
                                icon={Plus}
                                label={addChildLabel ?? "Add child"}
                                onClick={() => { setOpen(false); onAddChild(); }}
                            />
                            <div className="my-1 border-t border-border/60" />
                        </>
                    )}
                    <MenuItem icon={Pencil} label="Rename" onClick={() => { setOpen(false); onRename(); }} />
                    {onMoveUp && (
                        <MenuItem icon={ArrowUp} label="Move up" onClick={() => { setOpen(false); onMoveUp(); }} />
                    )}
                    {onMoveDown && (
                        <MenuItem icon={ArrowDown} label="Move down" onClick={() => { setOpen(false); onMoveDown(); }} />
                    )}
                    {onArchive && (
                        <>
                            <div className="my-1 border-t border-border/60" />
                            <MenuItem icon={Trash2} label="Archive" onClick={() => { setOpen(false); onArchive(); }} tone="destructive" />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function MenuItem({
    icon: Icon, label, onClick, tone = "default",
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    tone?: "default" | "destructive";
}) {
    const cls = tone === "destructive"
        ? "text-destructive hover:bg-destructive/10"
        : "text-foreground hover:bg-muted/40";
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={`ds-transition w-full flex items-center gap-2 px-2.5 py-1 text-xs text-left ${cls}`}
        >
            <Icon className="h-3 w-3 opacity-70" />
            <span>{label}</span>
        </button>
    );
}

/* ───── Inline rename input ───── */

function InlineRenameInput({
    defaultValue, onCommit, onCancel, emphasize,
}: {
    defaultValue: string;
    onCommit: (v: string) => void;
    onCancel: () => void;
    emphasize?: boolean;
}) {
    const [value, setValue] = useState(defaultValue);
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onCommit(value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommit(value); }
                if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            autoFocus
            onFocus={(e) => e.target.select()}
            className={`flex-1 min-w-0 rounded border border-primary/50 bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 ds-label ${
                emphasize ? "text-primary" : "text-foreground"
            }`}
        />
    );
}


/* ───── Dataset row — draggable, NO transform on original (DragOverlay handles visual) ───── */

function DatasetRow({
    ds, alias, isActive, isExpanded, loadingTables, tables, activeTable,
    searchQuery, isEditing, canMoveUp, canMoveDown,
    onToggleExpand, onAddTable,
    onStartEdit, onCommitRename, onCancelEdit, onMoveUp, onMoveDown,
}: {
    ds: DatasetInfo;
    alias: string;
    isActive: boolean;
    isExpanded: boolean;
    loadingTables: boolean;
    tables: TableInfo[];
    activeTable: string | null;
    searchQuery: string;
    isEditing: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onToggleExpand: () => void;
    onAddTable: () => void;
    onStartEdit: () => void;
    onCommitRename: (v: string) => void;
    onCancelEdit: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
        id: `${DS_PREFIX}${ds.id}`,
    });

    // Sortable: apply transform untuk intra-section reorder animation.
    // Opacity 0.35 saat dragging = placeholder. DragOverlay portal ke body
    // untuk visual yang follow cursor.
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
    };

    const displayTables = searchQuery
        ? tables.filter((t) => t.id.toLowerCase().includes(searchQuery) || ds.id.toLowerCase().includes(searchQuery))
        : tables;

    return (
        <li ref={setNodeRef} style={style}>
            <div
                className={`group/row ds-transition flex items-center gap-1 rounded px-1 py-0.5 text-xs
                    ${isActive ? "bg-primary/10 text-foreground" : "text-foreground/85 hover:bg-muted/30"}`}
            >
                <button
                    type="button"
                    onClick={onToggleExpand}
                    aria-expanded={isExpanded}
                    aria-label={`Toggle tables of ${ds.id}`}
                    className="ds-transition rounded p-0.5 opacity-60 hover:opacity-100 shrink-0"
                >
                    {isExpanded
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />}
                </button>
                {isEditing ? (
                    <InlineRenameInput
                        defaultValue={alias}
                        onCommit={onCommitRename}
                        onCancel={onCancelEdit}
                    />
                ) : (
                    <Link
                        href={`/data-workspace/${encodeURIComponent(ds.id)}`}
                        className="flex items-center gap-1.5 min-w-0 flex-1"
                        title={`${ds.id}\n\nClick: open · Double-click: rename`}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onStartEdit(); }}
                    >
                        <DatabaseZap className="h-3 w-3 shrink-0 opacity-60" />
                        <span className="flex-1 truncate text-xs">{alias}</span>
                    </Link>
                )}
                {!isEditing && (
                    <>
                        <button
                            type="button"
                            {...attributes}
                            {...listeners}
                            aria-label={`Drag ${ds.id} to another group`}
                            className="cursor-grab active:cursor-grabbing rounded p-0.5 opacity-0 group-hover/row:opacity-50 hover:!opacity-100 shrink-0"
                            title="Drag to move to another group"
                        >
                            <GripVertical className="h-3 w-3" />
                        </button>
                        <CategoryMenu
                            label={alias}
                            onRename={onStartEdit}
                            onMoveUp={canMoveUp ? onMoveUp : undefined}
                            onMoveDown={canMoveDown ? onMoveDown : undefined}
                            onAddChild={onAddTable}
                            addChildLabel="New table"
                        />
                    </>
                )}
            </div>

            {isExpanded && (
                <ul className="ml-3 border-l border-border/40 pl-1 py-0.5 space-y-0.5">
                    {loadingTables && (
                        <li className="flex items-center gap-1.5 px-1.5 py-1 text-xs opacity-50">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Loading tables…</span>
                        </li>
                    )}
                    {!loadingTables && displayTables.length === 0 && (
                        <li className="px-1.5 py-1 text-xs opacity-40 italic">
                            {searchQuery ? "No match" : "No tables"}
                        </li>
                    )}
                    {displayTables.map((t) => {
                        const isActiveT = isActive && activeTable === t.id;
                        return (
                            <li key={t.id}>
                                <Link
                                    href={`/data-workspace/${encodeURIComponent(ds.id)}/${encodeURIComponent(t.id)}`}
                                    className={`ds-transition flex items-center gap-1.5 rounded px-1.5 py-1 text-xs
                                        ${isActiveT
                                            ? "bg-primary/20 text-primary font-medium"
                                            : "text-foreground/80 hover:bg-muted/40 hover:text-foreground"}`}
                                >
                                    <Table2 className="h-3 w-3 shrink-0 opacity-60" />
                                    <span className="flex-1 truncate" title={t.id}>{t.id}</span>
                                    <span className="ds-small font-mono opacity-50 tabular-nums">
                                        {t.numRows > 999 ? `${Math.round(t.numRows / 1000)}k` : t.numRows}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
}

/** Generic toolbar icon button — used both as <button> AND <Link>.
 *  Same className → identical alignment di flex toolbar. */
function IconBtn({
    children, title, onClick, disabled, href, active,
}: {
    children: React.ReactNode;
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    href?: string;
    active?: boolean;
}) {
    const cls = `ds-interactive ds-press ds-focus rounded p-1 shrink-0 inline-flex items-center justify-center ${
        active
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground"
    }`;
    if (href) {
        return (
            <Link href={href} className={cls} title={title} aria-label={title}>
                {children}
            </Link>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            className={cls}
        >
            {children}
        </button>
    );
}
