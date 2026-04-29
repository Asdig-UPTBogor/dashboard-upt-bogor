"use client";

/**
 * MasterGrid — spreadsheet-first workspace pakai react-data-grid.
 *
 * Pattern: BQ-backed Google Sheets. Data real-time dari Master_Data.*, UI/UX custom.
 *
 * Fitur:
 *  ▸ Inline edit (dblclick / ketik langsung → Tab/Enter commit)
 *  ▸ Keyboard nav (Arrow / Tab / Shift+Tab / Enter / Esc)
 *  ▸ Copy-paste multi-cell (native react-data-grid)
 *  ▸ Click row = highlight
 *  ▸ Column header: click = sort, funnel = filter (Sheets-style checkbox), gear = config
 *  ▸ Per-column filter: checkbox unique values + Pilih/Hapus Semua + search
 *  ▸ Column Configurator: edit alias, CHOICE options, dropdown from range (REFERENCE)
 *  ▸ Add Row → modal dinamis
 *  ▸ Bulk archive by selected rows
 *  ▸ FK resolve lintas tabel via refOptions cache
 */

import "react-data-grid/lib/styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    DataGrid,
    type Column, type RenderCellProps, type RenderEditCellProps,
    type SortColumn,
} from "react-data-grid";
import {
    Search, Plus, RefreshCw, Archive as ArchiveIcon, X, Loader2,
    Upload, Check,
    AlertTriangle, BookKey, Lock, Filter as FilterIcon,
    Columns3, FileDown,
    ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import type { ColumnMeta, RowData } from "./types";
import { fetchCrossRows } from "@/hooks/useTableWorkspace";
import { SheetFilterPopup, SheetFilterBody, type SheetFilter } from "./SheetFilterPopup";
import { AddColumnModal } from "./AddColumnModal";
import { ToolRail, type RailItem } from "./ToolRail";
import { WorkspaceDrawer } from "./WorkspaceDrawer";
import { ColumnSidePanel } from "./ColumnSidePanel";
import { BulkImportPanel } from "./BulkImportModal";
import { SIDEBAR_LAYOUT, computePanelAnchor } from "./sidebar-layout";
import { apiFetch, formatApiError } from "@/lib/api-client";
import { stringifyCsv, downloadCsv } from "@/lib/csv";
import { estimateWidth, formatRelativeTime } from "./grid-utils";
import { renderCellView, renderEditor } from "./cell-renderers";
import { HeaderCellMinimal } from "./HeaderCellMinimal";
import { ColumnHeaderPopover, PopoverItem, type ColumnMenuEntry } from "./ColumnHeaderPopover";
import { ExportMenuPopup } from "./ExportMenuPopup";
import { StatusChip, StatusPopup } from "./StatusChip";
import { useCellSelection } from "./hooks/useCellSelection";
import { useSortState } from "./hooks/useSortState";
import { useColumnFilters } from "./hooks/useColumnFilters";
import { useDraftMode } from "./hooks/useDraftMode";
import { exportXlsx, exportPdf } from "@/lib/export-helpers";

export interface MasterConfig {
    dataset: string;
    table: string;
    primaryKey: string;
    displayKey: string;
    displayName: string;
    description: string;
    category: "master";
    level: number;
}

interface Props {
    config: MasterConfig;
    columns: ColumnMeta[];
    rows: RowData[];
    loading: boolean;
    error: string | null;
    breadcrumb?: Array<{ label: string; href?: string }>;
    /** Level key buat API call: upt/ultg/gi/bay */
    tableKey: string;
    onRefresh: () => void;
    onCreateRow: (values: RowData) => Promise<void>;
    onUpdateRow: (pk: string, changes: Record<string, unknown>, updatedAtAtRead?: string) => Promise<void>;
    onArchiveRow: (pk: string) => Promise<void>;
    onColumnsUpdated?: (newCols?: ColumnMeta[]) => void;
}

type RefOptions = Record<string, Array<{ value: string; label: string }>>;

export function MasterGrid({
    config, columns, rows: serverRows, loading, error, breadcrumb, tableKey,
    onRefresh, onCreateRow, onUpdateRow, onArchiveRow, onColumnsUpdated,
}: Props) {
    const { selectedRows, setSelectedRows, handleCellClick } = useCellSelection(config.primaryKey);
    const [addColumnOpen, setAddColumnOpen] = useState(false);
    const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
    const showToast = useCallback((kind: "ok" | "err", msg: string) => {
        setToast({ kind, msg });
        setTimeout(() => setToast(null), 3000);
    }, []);
    /** Sidebar Workspace tool state — MUTEX: cuma 1 tool aktif.
     *  "kolom" + "import" = drawer panel penuh
     *  "export" = popup kecil
     *  null = tidak ada yang aktif
     *  Rail button click → setActiveTool(toolKey) otomatis auto-close yang lain. */
    const [activeTool, setActiveTool] = useState<"kolom" | "import" | "export" | null>(null);
    /** Status chip popup state — klik chip di toolbar buka popup detail. */
    const [statusPopup, setStatusPopup] = useState<"filters" | "sort" | null>(null);
    const [statusPopupEl, setStatusPopupEl] = useState<HTMLElement | null>(null);
    const exportMenuOpen = activeTool === "export";
    function toggleTool(tool: "kolom" | "import" | "export") {
        setActiveTool((curr) => curr === tool ? null : tool);
    }

    /* Column sort state — controlled, TIDAK auto-trigger dari RDG header click.
     *  Sort hanya aktif via tombol icon explicit di header. */
    const { sortColumns, setSortColumns, toggleSort, sortRows } = useSortState();

    /* ═══ STAGED COLUMN CONFIG ═══
     *  Optimistic UI: drag/resize column = local state update dulu (langsung
     *  visible), batch PATCH Firestore saat user klik Save config.
     *  Pattern Excel/Airtable: config changes staged, save eksplisit. */
    const [pendingConfig, setPendingConfig] = useState<Record<string, Partial<ColumnMeta>>>({});
    const [savingConfig, setSavingConfig] = useState(false);
    /* Count EFFECTIVE pending — hanya kolom yg value berbeda dari server.
     * Reorder 1 kolom = stage `order` untuk N kolom (rebalance), tapi count
     * hanya yg BENAR-BENAR berubah dari server-side existing. */
    const configPendingCount = useMemo(() => {
        let n = 0;
        for (const [name, patch] of Object.entries(pendingConfig)) {
            const serverCol = columns.find((c) => c.name === name);
            if (!serverCol) { n++; continue; }
            const patchEntries = Object.entries(patch) as [keyof ColumnMeta, unknown][];
            const hasRealChange = patchEntries.some(([k, v]) => {
                const cur = serverCol[k];
                // Loose equality for undefined/null, strict for values
                if (cur == null && v == null) return false;
                return cur !== v;
            });
            if (hasRealChange) n++;
        }
        return n;
    }, [pendingConfig, columns]);
    const stageConfig = useCallback((updates: Record<string, Partial<ColumnMeta>>) => {
        setPendingConfig((prev) => {
            const next = { ...prev };
            for (const [name, patch] of Object.entries(updates)) {
                next[name] = { ...(next[name] ?? {}), ...patch };
            }
            return next;
        });
    }, []);
    const saveConfig = useCallback(async () => {
        if (Object.keys(pendingConfig).length === 0) return;
        setSavingConfig(true);
        try {
            await apiFetch(
                `/api/data-input/datasets/${encodeURIComponent(config.dataset)}/tables/${encodeURIComponent(config.table)}/schema`,
                { method: "PATCH", body: { columns: pendingConfig }, timeoutMs: 15_000 }
            );
            setPendingConfig({});
            onColumnsUpdated?.();
        } catch (e) {
            console.error("[MasterGrid] saveConfig failed:", formatApiError(e));
        } finally {
            setSavingConfig(false);
        }
    }, [config.dataset, config.table, pendingConfig, onColumnsUpdated]);
    const discardConfig = useCallback(() => {
        setPendingConfig({});
    }, []);

    const [filterAnchor, setFilterAnchor] = useState<{ col: string; el: HTMLElement } | null>(null);
    /** Header menu anchor — popover berisi Sort + Filter + future column actions.
     *  Pattern: klik header kolom = open popover (bukan auto-sort). */
    const [headerMenuAnchor, setHeaderMenuAnchor] = useState<{ col: string; el: HTMLElement } | null>(null);

    /* Reference options cache — untuk editor dropdown REFERENCE (edit mode).
     *  NOTE: Chain ancestor resolve sekarang di BE (server-side JOIN).
     *  Row.`_ancestors.{dataset}.{table}` → label. FE cuma render inline. */
    const [refOptions, setRefOptions] = useState<RefOptions>({});

    /* Load REFERENCE options untuk direct parent — dipakai editor dropdown
     *  saat user edit cell FK (searchable). Cuma direct, bukan chain (chain
     *  sudah resolved di BE via _ancestors field). */
    useEffect(() => {
        const refCols = columns.filter((c) => c.type === "REFERENCE" && c.reference);
        const keys = new Set(refCols.map((c) => `${c.reference!.dataset}.${c.reference!.table}`));
        keys.forEach(async (key) => {
            if (refOptions[key]) return;
            const [dsX, tb] = key.split(".");
            const col = refCols.find((c) => c.reference && `${c.reference.dataset}.${c.reference.table}` === key)!;
            const ref = col.reference!;
            const parentRows = await fetchCrossRows(dsX, tb);
            const opts = (parentRows as Array<Record<string, unknown>>)
                .filter((r) => r["is_active"] !== false)
                .map((r) => ({
                    value: String(r[ref.valueCol] ?? ""),
                    label: String(r[ref.displayCol] ?? ""),
                }));
            setRefOptions((s) => ({ ...s, [key]: opts }));
        });
    }, [columns, refOptions]);


    /* Lookup map untuk label display REFERENCE di SheetFilterPopup */
    const refLookup = useMemo<Record<string, Map<string, string>>>(() => {
        const out: Record<string, Map<string, string>> = {};
        for (const [key, opts] of Object.entries(refOptions)) {
            out[key] = new Map(opts.map((o) => [o.value, o.label]));
        }
        return out;
    }, [refOptions]);

    /* ═══ DRAFT MODE ═══ edits staged locally, batch commit via Save. */
    const draft = useDraftMode({
        config, columns, serverRows, selectedRows, setSelectedRows,
        onUpdateRow, onArchiveRow, onRefresh, showToast,
    });
    const { rows, dirtyMap, saving, pendingCount, stagingRow,
        handleRowsChange, handleCellCopy, handleCellPaste, handleFill, handleCellKeyDown,
        markDeleted, saveChanges, discardChanges, rowClass } = draft;

    /* Column filters + global search (hook-encapsulated). */
    const { filters, setFilters, filteredRows, search, setSearch } = useColumnFilters(rows, columns, refLookup);

    /* Ancestor chain — derive dari row pertama yang punya _ancestors field.
     *  BE pre-resolve chain via JOIN di SQL; FE cuma baca keys dari
     *  row._ancestors untuk tau level mana saja yang tersedia.
     *  Display order: ancestors paling root di kiri → direct parent di kanan.
     *  Urutan JOIN di BE sudah correct: t1 (direct), t2, t3, ... tN (root). */
    const ancestorChain = useMemo(() => {
        const sample = rows.find((r) => r._ancestors && typeof r._ancestors === "object") as
            | (RowData & { _ancestors?: Record<string, string> }) | undefined;
        if (!sample || !sample._ancestors) return [];
        // Keys in insertion order: [direct, grandparent, great-grandparent, ...]
        // Reverse for display: [great-grandparent (root), ..., direct]
        const keys = Object.keys(sample._ancestors);
        return keys.slice().reverse().map((k) => ({
            datasetKey: k,
            tableName: k.split(".").pop() ?? k,
        }));
    }, [rows]);

    /* Resolver per-row: baca langsung dari row._ancestors (zero walk di client). */
    const resolveAncestors = useCallback((row: RowData): Record<string, string> => {
        const anc = (row as RowData & { _ancestors?: Record<string, string> })._ancestors;
        return anc ?? {};
    }, []);

    /* Build RDG columns — virtual ancestor columns di kiri + kolom asli + "+" di kanan.
     *  Bay workspace: [UPT] [ULTG] [gi_id resolved] [bay_name] [bay_function] ... [+]
     *  FK REFERENCE kolom auto-resolve ke nama display (contoh: gi_id → "GI 150KV..."). */
    const rdgColumns = useMemo<Column<RowData>[]>(() => {
        // Virtual ancestor columns — skip tail (direct parent sudah ada di columns sebagai REFERENCE)
        const virtualAncestorCols: Column<RowData>[] = ancestorChain.slice(0, -1).map((level) => {
            const colKey = `__ancestor_${level.datasetKey}`;
            return {
                key: colKey,
                name: level.tableName,
                minWidth: 120,
                width: 160,
                resizable: true,
                sortable: false, // explicit sort button
                editable: false,
                renderHeaderCell: () => {
                    const sort = sortColumns.find((s) => s.columnKey === colKey);
                    const hasFilter = !!filters[colKey];
                    const menuOpen = headerMenuAnchor?.col === colKey;
                    return (
                        <HeaderCellMinimal
                            title={level.tableName}
                            description={`Parent chain — ${level.tableName} (auto-resolved)`}
                            ancestorHint
                            sort={sort}
                            hasFilter={hasFilter}
                            menuOpen={menuOpen}
                            onOpenMenu={(el) => setHeaderMenuAnchor({ col: colKey, el })}
                        />
                    );
                },
                renderCell: ({ row }: RenderCellProps<RowData>) => {
                    const labels = resolveAncestors(row);
                    const label = labels[level.datasetKey];
                    return label
                        ? <span className="truncate opacity-90">{label}</span>
                        : <span className="opacity-30 italic">—</span>;
                },
            };
        });

        /* Merge server columns + pending staged config untuk optimistic UI.
         *  Drag/resize langsung visible via pendingConfig, commit via Save. */
        const merged = columns.map((c) =>
            pendingConfig[c.name] ? { ...c, ...pendingConfig[c.name] } : c
        );
        /* Apply overlay order + pin: left-pinned dulu (frozen), lalu sisanya. */
        const orderedAll = [...merged].sort(
            (a, b) => (a.order ?? 9999) - (b.order ?? 9999)
        );
        const leftPinned = orderedAll.filter((c) => c.pin === "left" && !c.hidden);
        const rightPinned = orderedAll.filter((c) => c.pin === "right" && !c.hidden);
        const unpinned = orderedAll.filter(
            (c) => c.pin !== "left" && c.pin !== "right" && !c.hidden
        );
        const visibleCols = [...leftPinned, ...unpinned, ...rightPinned];
        const dataCols = visibleCols.map((col) => {
            const frozen = col.pin === "left";
            const title = col.alias ?? col.name;
            const editable = !col.readOnly;
            const hasFilter = !!filters[col.name];

            return {
                key: col.name,
                name: title,
                minWidth: 80,
                width: col.width ?? estimateWidth(col),
                resizable: true,
                sortable: false, // Sort via icon explicit, bukan click-header
                editable: editable,
                frozen,
                renderHeaderCell: () => {
                    const sort = sortColumns.find((s) => s.columnKey === col.name);
                    const menuOpen = headerMenuAnchor?.col === col.name;
                    return (
                        <HeaderCellMinimal
                            title={title}
                            description={col.description}
                            required={col.mode === "REQUIRED"}
                            isReference={col.type === "REFERENCE"}
                            sort={sort}
                            hasFilter={hasFilter}
                            menuOpen={menuOpen}
                            onOpenMenu={(el) => setHeaderMenuAnchor({ col: col.name, el })}
                        />
                    );
                },
                renderCell: (props: RenderCellProps<RowData>) => renderCellView(col, props, refLookup),
                renderEditCell: editable
                    ? (props: RenderEditCellProps<RowData>) => renderEditor(col, props, refOptions)
                    : undefined,
            };
        });

        /* Virtual "+" column di rightmost — click header untuk add column baru */
        const addColCol: Column<RowData> = {
            key: "__add_col__",
            name: "",
            minWidth: 44,
            width: 44,
            resizable: false,
            sortable: false,
            editable: false,
            frozen: false,
            renderHeaderCell: () => (
                <button
                    type="button"
                    onClick={() => setAddColumnOpen(true)}
                    className="ds-transition w-full h-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 rounded"
                    title="Tambah kolom baru (ALTER TABLE)"
                >
                    <Plus className="h-4 w-4" />
                </button>
            ),
            renderCell: () => <span className="opacity-20">·</span>,
        };

        return [...virtualAncestorCols, ...dataCols, addColCol];
    }, [columns, pendingConfig, refOptions, refLookup, filters, ancestorChain, resolveAncestors, sortColumns, headerMenuAnchor]);

    /* Apply sort — handles real cols + virtual ancestor cols via useSortState. */
    const sortedRows = useMemo(() => sortRows(filteredRows), [filteredRows, sortRows]);

    /* Grid rows = sorted filtered rows + staging row di bottom. Staging ga kena filter/sort. */
    const gridRows = useMemo(() => [...sortedRows, stagingRow], [sortedRows, stagingRow]);

    const rowKeyGetter = useCallback((r: RowData) => String(r[config.primaryKey]), [config.primaryKey]);

    async function handleArchiveSelected() {
        const pks = Array.from(selectedRows);
        if (!pks.length) return;
        if (!confirm(`Archive ${pks.length} row? (is_active → FALSE)`)) return;
        try {
            for (const pk of pks) await onArchiveRow(pk);
            setSelectedRows(new Set());
            showToast("ok", `${pks.length} row di-archive`);
        } catch (err) {
            showToast("err", err instanceof Error ? err.message : "Archive gagal");
        }
    }

    const hiddenColCount = columns.filter((c) => c.hidden).length;
    // Rail button refs — panel positioned dinamis ke tombol yg di-klik
    // (bukan anchor ke rail container). Dependency-free scaling: tambah
    // tombol baru = tinggal bikin ref baru, sinkron otomatis.
    const kolomBtnRef = useRef<HTMLButtonElement | null>(null);
    const importBtnRef = useRef<HTMLButtonElement | null>(null);
    const exportBtnRef = useRef<HTMLButtonElement | null>(null);
    const refreshBtnRef = useRef<HTMLButtonElement | null>(null);

    /** Track waktu refresh terakhir — untuk tooltip senior-UX pattern. */
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
    /** Track pending count per panel drawer — untuk close-confirm guard. */
    const columnPanelPendingRef = useRef(0);

    /* STAGED config pending di-lift ke atas (sebelum rdgColumns useMemo)
     * untuk avoid TDZ error. Lihat declaration ~line 118. */

    /** Column resize — STAGED (optimistic UI). Width di-update ke pendingConfig,
     *  user lihat langsung. Save button muncul, commit saat user klik Save. */
    const handleColumnResize = useCallback((column: { key: string }, width: number) => {
        const colName = column.key;
        if (colName.startsWith("__")) return; // skip virtual cols
        stageConfig({ [colName]: { width: Math.round(width) } });
    }, [stageConfig]);
    /** Column reorder via drag — STAGED (optimistic UI). New order compute
     *  dari existing + pending, save batch saat user klik Save. */
    const handleColumnsReorder = useCallback((sourceKey: string, targetKey: string) => {
        if (sourceKey.startsWith("__") || targetKey.startsWith("__")) return;

        // Merged view (server + pending) untuk baca order current
        const merged = columns.map((c) =>
            pendingConfig[c.name] ? { ...c, ...pendingConfig[c.name] } : c
        );
        const orderedAll = [...merged].sort(
            (a, b) => (a.order ?? 9999) - (b.order ?? 9999)
        );
        const names = orderedAll.map((c) => c.name);
        const fromIdx = names.indexOf(sourceKey);
        const toIdx = names.indexOf(targetKey);
        if (fromIdx === -1 || toIdx === -1) return;

        const reordered = [...names];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);

        const updates: Record<string, Partial<ColumnMeta>> = {};
        reordered.forEach((n, i) => { updates[n] = { order: i }; });
        stageConfig(updates);
    }, [columns, pendingConfig, stageConfig]);
    useEffect(() => {
        // Saat serverRows berubah + ga loading → anggap refresh sukses
        if (!loading && serverRows) setLastRefreshedAt(new Date());
    }, [serverRows, loading]);

    /** Close Panel Kolom dengan confirm kalau ada pending config.
     *  Prevent user accidentally click X/Esc → semua edit kolom hilang. */
    const handleCloseKolomPanel = useCallback(() => {
        const n = columnPanelPendingRef.current;
        if (n > 0) {
            const ok = confirm(
                `Ada ${n} perubahan kolom belum disimpan.\n\n`
                + `Tutup panel akan buang semua. Lanjutkan?`
            );
            if (!ok) return;
        }
        setActiveTool(null);
    }, []);

    /** Refresh handler dgn dirty confirm — prevent data loss. */
    const handleRefresh = useCallback(() => {
        const pendingCount = Object.keys(dirtyMap).length;
        if (pendingCount > 0) {
            const ok = confirm(
                `Ada ${pendingCount} perubahan baris belum disimpan.\n\n`
                + `Muat Ulang akan buang semua draft. Lanjutkan?`
            );
            if (!ok) return;
        }
        onRefresh();
    }, [dirtyMap, onRefresh]);

    const railItems: RailItem[] = [
        {
            key: "kolom",
            label: `Columns · ${columns.length - hiddenColCount} / ${columns.length} visible`,
            icon: Columns3,
            active: activeTool === "kolom",
            badge: hiddenColCount > 0 ? hiddenColCount : undefined,
            onClick: () => toggleTool("kolom"),
        },
        {
            key: "import",
            label: "Import CSV",
            icon: Upload,
            active: activeTool === "import",
            onClick: () => toggleTool("import"),
        },
        {
            key: "export",
            label: "Export · CSV / Excel / PDF",
            icon: FileDown,
            active: exportMenuOpen,
            disabled: filteredRows.length === 0,
            onClick: () => toggleTool("export"),
        },
        {
            key: "refresh",
            label: loading
                ? "Loading…"
                : `Refresh${lastRefreshedAt ? ` · Last: ${formatRelativeTime(lastRefreshedAt)}` : ""}`,
            icon: RefreshCw,
            isLoading: loading,
            disabled: loading,
            onClick: handleRefresh,
        },
    ];

    return (
        <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
            {/* ── WORKSPACE SIDEBAR (vertical rail, selalu visible di KIRI) ── */}
            <ToolRail
                items={railItems}
                itemRefs={{
                    kolom: kolomBtnRef,
                    import: importBtnRef,
                    export: exportBtnRef,
                    refresh: refreshBtnRef,
                }}
            />

            {/* ── SIDEBAR DRAWER · PANEL KOLOM — anchor ke tombol Kolom di rail ── */}
            <WorkspaceDrawer
                open={activeTool === "kolom"}
                title="Columns"
                subtitle={`${columns.filter((c) => !c.hidden).length} of ${columns.length} visible`}
                anchorEl={kolomBtnRef.current}
                defaultWidth={380}
                onClose={handleCloseKolomPanel}
            >
                <ColumnSidePanel
                    dataset={config.dataset}
                    table={config.table}
                    columns={columns}
                    onColumnsUpdated={() => onColumnsUpdated?.()}
                    onPendingChange={(n) => { columnPanelPendingRef.current = n; }}
                />
            </WorkspaceDrawer>

            {/* ── SIDEBAR DRAWER · PANEL IMPOR CSV — anchor ke tombol Import ── */}
            <WorkspaceDrawer
                open={activeTool === "import"}
                title="Import CSV"
                subtitle={`${config.dataset}.${config.table}`}
                anchorEl={importBtnRef.current}
                defaultWidth={560}
                maxWidth={860}
                onClose={() => setActiveTool(null)}
            >
                <BulkImportPanel
                    dataset={config.dataset}
                    table={config.table}
                    onClose={() => setActiveTool(null)}
                    onDone={() => onRefresh()}
                />
            </WorkspaceDrawer>

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* ── SECTION 1: BREADCRUMB (inline text, no flex, consistent baseline) ── */}
            {breadcrumb && breadcrumb.length > 0 && (
                <nav
                    aria-label="Breadcrumb"
                    className="shrink-0 ds-small px-4 py-2.5 truncate text-muted-foreground"
                >
                    {breadcrumb.map((b, i) => {
                        const isLast = i === breadcrumb.length - 1;
                        return (
                            <span key={i}>
                                {i > 0 && <span className="mx-2 opacity-40" aria-hidden>›</span>}
                                {b.href && !isLast ? (
                                    <a
                                        href={b.href}
                                        className="hover:text-foreground ds-transition"
                                    >
                                        {b.label}
                                    </a>
                                ) : (
                                    <span
                                        className={isLast ? "text-foreground font-medium" : ""}
                                        aria-current={isLast ? "page" : undefined}
                                    >
                                        {b.label}
                                    </span>
                                )}
                            </span>
                        );
                    })}
                </nav>
            )}

            {/* ── SECTION 2: TITLE (H1 page, ds-heading 24px) ── */}
            <header className="shrink-0 border-b border-border bg-card/50 px-4 py-2.5 flex items-center gap-2.5">
                <BookKey className="h-5 w-5 text-primary shrink-0" />
                <h1
                    className="ds-heading shrink-0"
                    title={config.description || undefined}
                >
                    {config.displayName}
                </h1>
                {config.description && (
                    <span className="ds-small opacity-60 truncate hidden md:inline">
                        {config.description}
                    </span>
                )}
            </header>

            {/* ── SECTION 3: TOOLBAR (search · status · save) ────── */}
            <div className="shrink-0 border-b border-border/60 bg-background/50 px-4 py-2.5 flex items-center gap-2 flex-wrap">
                <div className="relative shrink-0" style={{ width: 240 }}>
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Search ${filteredRows.length} rows…`}
                        className="w-full rounded-md border border-border bg-background pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
                <StatusChip
                    icon={FilterIcon}
                    label="Filters"
                    count={Object.keys(filters).length}
                    tone="primary"
                    onClick={(el) => { setStatusPopupEl(el); setStatusPopup("filters"); }}
                />
                <StatusChip
                    icon={ArrowUpDown}
                    label="Sort"
                    count={sortColumns.length}
                    tone="primary"
                    onClick={(el) => { setStatusPopupEl(el); setStatusPopup("sort"); }}
                />
                {/* Staged config pill — muncul saat drag/resize column pending.
                 *  Click Save → batch PATCH ke Firestore overlay. */}
                {configPendingCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 pl-2 pr-1 py-0.5 text-xs shrink-0">
                        <span className="text-amber-400 font-medium">
                            {configPendingCount} unsaved
                        </span>
                        <button
                            type="button"
                            onClick={discardConfig}
                            disabled={savingConfig}
                            title="Discard column config changes"
                            className="ds-transition rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-muted/40 ml-1"
                        >
                            <X className="h-3 w-3" />
                        </button>
                        <button
                            type="button"
                            onClick={saveConfig}
                            disabled={savingConfig}
                            className="ds-btn ds-btn-primary ds-btn-sm"
                            title="Save column config (order, width, hide, pin, alias)"
                        >
                            {savingConfig
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Check className="h-3 w-3" />}
                            Save config
                        </button>
                    </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                        {pendingCount > 0 && (
                            <>
                                <button
                                    type="button"
                                    onClick={discardChanges}
                                    disabled={saving}
                                    title="Discard all changes, revert to server state"
                                    className="ds-btn ds-btn-secondary ds-btn-sm"
                                >
                                    <X className="h-3.5 w-3.5" /> Discard
                                </button>
                                <button
                                    type="button"
                                    onClick={saveChanges}
                                    disabled={saving}
                                    title="Save all pending changes to BigQuery"
                                    className="ds-btn ds-btn-primary ds-btn-sm"
                                >
                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                    Save ({pendingCount})
                                </button>
                                <span className="h-5 w-px bg-border/60 mx-1" />
                            </>
                        )}
                        {/* Semua aksi (Kolom/Import/Export/Muat Ulang) pindah ke
                         *  Sidebar Workspace di kiri. Toolbar tinggal Cari + Simpan/Batalkan. */}
                </div>
            </div>
            {/* ── END TOOLBAR SECTION 3 ─────────────────────────── */}

            {/* Bulk Bar row removed — Selected StatusChip di toolbar + popup
             *  (Airtable pattern) menggantikan stacked bar. */}

            {/* ── ERROR ────────────────────────────────────────── */}
            {error && (
                <div className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-4 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="ds-small text-destructive">{error}</p>
                </div>
            )}

            {/* ── GRID ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden relative">
                {loading && rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ds-body opacity-70">Loading data from BigQuery…</span>
                        <span className="ds-small opacity-50">First query ~5-8s (cold), cached 60s after.</span>
                    </div>
                ) : !loading && filteredRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <BookKey className="h-6 w-6 opacity-40" />
                        </div>
                        {rows.length === 0 ? (
                            <>
                                <p className="ds-title">No rows yet</p>
                                <p className="ds-small opacity-60 max-w-md">
                                    Click an empty cell at the bottom of the grid to start adding rows,
                                    or use Import CSV from the sidebar.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="ds-title">No matching rows</p>
                                <p className="ds-small opacity-60 max-w-md">
                                    {rows.length} row{rows.length === 1 ? "" : "s"} hidden by filters or search.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { setSearch(""); setFilters({}); }}
                                    className="ds-btn ds-btn-secondary ds-btn-sm"
                                >
                                    Clear all filters
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <DataGrid
                        columns={rdgColumns}
                        rows={gridRows}
                        rowKeyGetter={rowKeyGetter}
                        onRowsChange={handleRowsChange}
                        onCellClick={handleCellClick as unknown as (args: { row: RowData; column: { key: string } }, e: React.MouseEvent) => void}
                        onCellKeyDown={handleCellKeyDown}
                        onCellCopy={handleCellCopy}
                        onCellPaste={handleCellPaste}
                        onFill={handleFill}
                        rowClass={rowClass}
                        className="rdg-dark h-full"
                        style={{ blockSize: "100%" }}
                        headerRowHeight={36}
                        rowHeight={32}
                        sortColumns={sortColumns}
                        onSortColumnsChange={setSortColumns}
                        onColumnResize={handleColumnResize}
                        onColumnsReorder={handleColumnsReorder}
                        defaultColumnOptions={{
                            resizable: true,
                            // sortable: false — click header TIDAK auto-sort.
                            // Sort via explicit icon button di renderHeaderCell.
                            sortable: false,
                            draggable: true,
                        }}
                    />
                )}
            </div>

            {/* ── FOOTER ───────────────────────────────────────── */}
            <footer className="shrink-0 border-t border-border/60 bg-background/80 px-4 py-1.5 flex items-center justify-between ds-small opacity-70">
                <div className="flex items-center gap-3">
                    <span><span className="ds-data">{filteredRows.length}</span><span className="opacity-60"> / {rows.length} row</span></span>
                    {selectedRows.size > 0 && (
                        <span className="text-primary inline-flex items-center gap-2">
                            <span>
                                <span className="ds-data">{selectedRows.size}</span>
                                <span> selected</span>
                            </span>
                            <span className="opacity-50 text-[10px] hidden lg:inline">
                                ⌫ Delete · Esc clear
                            </span>
                        </span>
                    )}
                    {Object.keys(filters).length > 0 && (
                        <span className="text-primary">
                            <FilterIcon className="h-3 w-3 inline mr-0.5" />
                            {Object.keys(filters).length} filter
                        </span>
                    )}
                </div>
                <span className="font-mono opacity-60">{config.dataset}.{config.table}</span>
            </footer>
            </div>

            {/* ── EXPORT MENU (popup anchor dinamis ke tombol Export di rail) ── */}
            {exportMenuOpen && (
                <ExportMenuPopup
                    anchorEl={exportBtnRef.current}
                    onClose={() => setActiveTool(null)}
                    onCsv={() => {
                        const visibleCols = columns.filter((c) => !c.hidden).map((c) => c.name);
                        const csv = stringifyCsv(visibleCols, filteredRows);
                        downloadCsv(`${config.dataset}_${config.table}_${new Date().toISOString().slice(0, 10)}`, csv);
                        showToast("ok", `Export ${filteredRows.length} row ke CSV`);
                        setActiveTool(null);
                    }}
                    onXlsx={async () => {
                        const visibleCols = columns.filter((c) => !c.hidden);
                        try {
                            await exportXlsx({
                                filename: `${config.dataset}_${config.table}_${new Date().toISOString().slice(0, 10)}`,
                                sheetName: config.table,
                                columns: visibleCols.map((c) => ({ name: c.name, alias: c.alias })),
                                rows: filteredRows as Array<Record<string, unknown>>,
                            });
                            showToast("ok", `Export ${filteredRows.length} row ke Excel`);
                        } catch (e) {
                            showToast("err", `Export Excel gagal: ${e instanceof Error ? e.message : String(e)}`);
                        }
                        setActiveTool(null);
                    }}
                    onPdf={() => {
                        const visibleCols = columns.filter((c) => !c.hidden);
                        try {
                            exportPdf({
                                filename: `${config.dataset}_${config.table}_${new Date().toISOString().slice(0, 10)}`,
                                title: config.displayName,
                                subtitle: `${config.dataset}.${config.table}`,
                                columns: visibleCols.map((c) => ({ name: c.name, alias: c.alias })),
                                rows: filteredRows as Array<Record<string, unknown>>,
                            });
                            showToast("ok", `Export ${filteredRows.length} row ke PDF`);
                        } catch (e) {
                            showToast("err", `Export PDF gagal: ${e instanceof Error ? e.message : String(e)}`);
                        }
                        setActiveTool(null);
                    }}
                />
            )}

            {/* Import CSV sekarang rendered dalam WorkspaceDrawer di atas (Panel Import). */}

            {/* ── OVERLAYS ─────────────────────────────────────── */}
            {/* Column header popover — sections registry extensible.
             *  Tambah fitur baru (group, aggregate, freeze, cascade source, dll) =
             *  append section di buildColumnMenuSections() tanpa touch komponen. */}
            {headerMenuAnchor && (() => {
                const colKey = headerMenuAnchor.col;
                const el = headerMenuAnchor.el;
                const isAncestor = colKey.startsWith("__ancestor_");
                const col = isAncestor ? null : columns.find((c) => c.name === colKey);
                const title = col?.alias ?? col?.name ?? colKey.replace("__ancestor_", "").split(".").pop() ?? colKey;
                const sort = sortColumns.find((s) => s.columnKey === colKey);
                const hasFilter = !isAncestor && !!filters[colKey];
                const close = () => setHeaderMenuAnchor(null);

                /* Cascading menu entries — English enterprise labels (Airtable
                 *  / Supabase convention). Tambah fitur masa depan = append
                 *  entry baru dengan renderSubmenu. */
                const entries: ColumnMenuEntry[] = [
                    {
                        key: "sort",
                        icon: ArrowUpDown,
                        label: "Sort",
                        active: !!sort,
                        hint: sort ? (sort.direction === "ASC" ? "A→Z" : "Z→A") : undefined,
                        renderSubmenu: () => (
                            <ul className="space-y-0.5">
                                <li>
                                    <button
                                        type="button"
                                        onClick={(e: React.MouseEvent) => {
                                            setSortColumns((prev) => {
                                                const others = prev.filter((s) => s.columnKey !== colKey);
                                                const next: SortColumn = { columnKey: colKey, direction: "ASC" };
                                                return e.shiftKey ? [...others, next] : [next];
                                            });
                                            close();
                                        }}
                                        className={`ds-transition w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left ${
                                            sort?.direction === "ASC"
                                                ? "text-primary bg-primary/10"
                                                : "text-foreground hover:bg-muted/40"
                                        }`}
                                    >
                                        <ArrowUp className="h-3.5 w-3.5 shrink-0" />
                                        <span className="flex-1">Sort A → Z</span>
                                        {sort?.direction === "ASC" && <Check className="h-3 w-3" />}
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        onClick={(e: React.MouseEvent) => {
                                            setSortColumns((prev) => {
                                                const others = prev.filter((s) => s.columnKey !== colKey);
                                                const next: SortColumn = { columnKey: colKey, direction: "DESC" };
                                                return e.shiftKey ? [...others, next] : [next];
                                            });
                                            close();
                                        }}
                                        className={`ds-transition w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left ${
                                            sort?.direction === "DESC"
                                                ? "text-primary bg-primary/10"
                                                : "text-foreground hover:bg-muted/40"
                                        }`}
                                    >
                                        <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                                        <span className="flex-1">Sort Z → A</span>
                                        {sort?.direction === "DESC" && <Check className="h-3 w-3" />}
                                    </button>
                                </li>
                                {sort && (
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSortColumns((prev) => prev.filter((s) => s.columnKey !== colKey));
                                                close();
                                            }}
                                            className="ds-transition w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                        >
                                            <X className="h-3.5 w-3.5 shrink-0" />
                                            <span className="flex-1">Clear sort</span>
                                        </button>
                                    </li>
                                )}
                                <li className="pt-1 px-2">
                                    <p className="ds-small opacity-50">Shift+click = multi-sort</p>
                                </li>
                            </ul>
                        ),
                    },
                    {
                        key: "filter",
                        icon: FilterIcon,
                        label: "Filter",
                        active: hasFilter,
                        hint: hasFilter ? `${filters[colKey]?.allowed.size ?? 0}/${filters[colKey]?.totalUnique ?? "?"}` : undefined,
                        // Filter available untuk data col DAN virtual ancestor
                        renderSubmenu: () => {
                            /* Synthetic col untuk virtual ancestor — nama = key,
                             * type STRING, alias = display title. SheetFilterBody +
                             * applySheetFilter auto-detect prefix __ancestor_ dan
                             * ekstrak value dari _ancestors map. */
                            const filterCol: ColumnMeta = col ?? {
                                name: colKey,
                                type: "STRING",
                                mode: "NULLABLE",
                                alias: title,
                            };
                            return (
                                <SheetFilterBody
                                    col={filterCol}
                                    allRows={rows}
                                    refLookup={refLookup}
                                    current={filters[colKey] ?? null}
                                    listMaxHeight={260}
                                    onApply={(f) => {
                                        setFilters((prev) => {
                                            if (!f) {
                                                const { [colKey]: _omit, ...rest } = prev;
                                                return rest;
                                            }
                                            return { ...prev, [f.column]: f };
                                        });
                                    }}
                                    onClose={close}
                                />
                            );
                        },
                    },
                    // FUTURE: append entry baru di sini dengan renderSubmenu —
                    // zero modification di ColumnHeaderPopover component.
                    // Examples:
                    //   { key: "group", icon: Group, label: "Group by", renderSubmenu: ... }
                    //   { key: "freeze", icon: Pin, label: "Freeze column", renderSubmenu: ... }
                    //   { key: "config", icon: Settings, label: "Edit column…", renderSubmenu: ... }
                ];

                return (
                    <ColumnHeaderPopover
                        anchorEl={el}
                        title={title}
                        entries={entries}
                        onClose={close}
                    />
                );
            })()}

            {/* Legacy SheetFilterPopup (standalone popup) removed — filter UI now
             *  rendered inline in cascading submenu via SheetFilterBody. */}

            {/* Status popup — detail untuk StatusChip Filter / Sort */}
            {statusPopup && statusPopupEl && (
                <StatusPopup
                    anchorEl={statusPopupEl}
                    kind={statusPopup}
                    filters={filters}
                    columns={columns}
                    sortColumns={sortColumns}
                    onClearFilter={(key) => {
                        setFilters((prev) => {
                            const { [key]: _omit, ...rest } = prev;
                            return rest;
                        });
                    }}
                    onClearAllFilters={() => setFilters({})}
                    onClearSort={(key) => {
                        setSortColumns((prev) => prev.filter((s) => s.columnKey !== key));
                    }}
                    onClearAllSort={() => setSortColumns([])}
                    onClose={() => { setStatusPopup(null); setStatusPopupEl(null); }}
                />
            )}

            {/* Bulk action UX minimal — keyboard-driven (Delete key = mark, Esc =
             *  clear selection). Footer hint shows count + shortcut hint.
             *  Upgrade ke floating bar hanya kalau ada 3+ bulk actions di masa depan. */}

            {addColumnOpen && (
                <AddColumnModal
                    open
                    dataset={config.dataset}
                    table={config.table}
                    onClose={() => setAddColumnOpen(false)}
                    onSaved={() => { setAddColumnOpen(false); onRefresh(); showToast("ok", "Column added"); }}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-4 right-4 z-[60] rounded-md px-3 py-2 shadow-lg ds-small animate-in slide-in-from-bottom-2 ${
                    toast.kind === "ok"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-destructive/20 text-destructive border border-destructive/30"
                }`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

/* ─── Cell renderers / editors / utils di-extract ke file terpisah:
 *     ./cell-renderers.tsx  — renderCellView + renderEditor
 *     ./cell-editors.tsx    — Bool/Number/Choice/Reference editors
 *     ./grid-utils.ts       — estimateWidth + formatRelativeTime + formatDate
 */


/* Extracted:
 *   HeaderCellMinimal      → ./HeaderCellMinimal.tsx
 *   ColumnHeaderPopover    → ./ColumnHeaderPopover.tsx  (+ PopoverItem, ColumnMenuEntry)
 *   ExportMenuPopup        → ./ExportMenuPopup.tsx       (+ ExportMenuItem)
 *   StatusChip, StatusPopup → ./StatusChip.tsx
 *   cell renderers/editors  → ./cell-renderers.tsx, ./cell-editors.tsx
 *   utils                   → ./grid-utils.ts
 */
