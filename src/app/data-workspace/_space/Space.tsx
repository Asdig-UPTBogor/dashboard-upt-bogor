"use client";

/**
 * Space — god-mode editor untuk satu BQ table.
 *
 * Replacement untuk `MasterGrid`. Stack: TanStack Table v8 + react-virtual.
 *
 * Layout:
 *   ┌─ SpaceToolbar (search · filter · refresh · new) ─┐
 *   ├─────────────────────────────────────────────────┤
 *   │ SpaceContainer (virtualized rows)                │
 *   ├─────────────────────────────────────────────────┤
 *   └─ SpaceStatusBar (count · dirty · save) ─────────┘
 *
 * Status fitur:
 *  Phase 1 ✓ Display all types · sort · filter · search · resize · pin · select · virtualize · persist prefs
 *  Phase 2 ✓ Edit cell (dblclick) · dirty state (LS) · save (per-row commit)
 *  Phase 3 ⏳ CHOICE/CASCADE/REFERENCE editors
 *  Phase 4 ⏳ Keyboard nav · undo · paste · per-col filter
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ColumnMeta as ColumnSchema, RowData, RowValue, WorkspaceTableConfig } from "@/app/data-input/_workspace/types";
import { useSpaceColumns } from "./core/useSpaceColumns";
import { useSpaceTable } from "./core/useSpaceTable";
import { useDirtyState } from "./features/useDirtyState";
import { useUndoRedo } from "./features/useUndoRedo";
import { SpaceHeader } from "./ui/SpaceHeader";
import { SpaceToolbar } from "./ui/SpaceToolbar";
import { SpaceContainer } from "./ui/SpaceContainer";
import { SpaceStatusBar } from "./ui/SpaceStatusBar";
import { RowFormModal } from "./ui/RowFormModal";
import { CellRenderer } from "./renderers/CellRenderer";
import { Loader2, AlertTriangle } from "lucide-react";

// Reuse existing modals dari MasterGrid ekosistem (loosely-coupled, prop-based).
import { BulkImportPanel } from "@/app/data-input/_workspace/BulkImportModal";
import { AddColumnModal } from "@/app/data-input/_workspace/AddColumnModal";
import { ColumnSidePanel } from "@/app/data-input/_workspace/ColumnSidePanel";
import { WorkspaceDrawer } from "@/app/data-input/_workspace/WorkspaceDrawer";
import { downloadCsv, stringifyCsv } from "@/lib/csv";
import { exportXlsx, exportPdf, type ExportColumn } from "@/lib/export-helpers";

export interface SpaceProps {
    config: WorkspaceTableConfig;
    columns: ColumnSchema[];
    rows: RowData[];
    loading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    onCreateRow?: (values: RowData) => Promise<void>;
    onUpdateRow?: (pk: string, changes: Record<string, unknown>, updatedAtAtRead?: string) => Promise<void>;
    onArchiveRow?: (pk: string) => Promise<void>;
    onColumnsUpdated?: () => void;
}

export function Space({
    config, columns, rows, loading, error,
    onRefresh, onCreateRow, onUpdateRow, onArchiveRow, onColumnsUpdated,
}: SpaceProps) {
    void onArchiveRow; void onColumnsUpdated; // reserved untuk Phase 3+ (row context menu, column panel wiring)

    const readOnly = config.readOnly ?? false;
    const pkColumn = config.primaryKey;

    // Phase 2 — dirty state hook tracks per-cell edits + persists ke localStorage.
    const dirty = useDirtyState({
        dataset: config.dataset,
        table: config.table,
        rows,
    });

    // Display rows = originals merged dengan overlay (so renderer + editor lihat value terkini).
    // PERF: deps spesifik (dirtyRows + getRowPatch) — bukan whole `dirty` object
    // yg useMemo di useDirtyState. Tetap stable kalau cuma editingCell change.
    const displayRows = useMemo(() => {
        if (dirty.dirtyRows.length === 0) return rows;
        return rows.map((r, i) => {
            const patch = dirty.getRowPatch(i);
            if (Object.keys(patch).length === 0) return r;
            return { ...r, ...patch };
        });
    }, [rows, dirty.dirtyRows, dirty.getRowPatch]);

    const [saving, setSaving] = useState(false);
    const [bulkImportOpen, setBulkImportOpen] = useState(false);
    const [addColumnOpen, setAddColumnOpen] = useState(false);
    const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
    const [newRowOpen, setNewRowOpen] = useState(false);
    const [editingCell, setEditingCell] = useState<{ rowIdx: number; colId: string } | null>(null);
    const columnsBtnRef = useRef<HTMLButtonElement | null>(null);

    // Undo/Redo — apply via dirty.updateCell, suppress recordEdit recursion via flag.
    const undoApi = useUndoRedo({
        onUndo: (e) => dirty.updateCell(e.rowIdx, e.colId, e.prev as RowValue),
        onRedo: (e) => dirty.updateCell(e.rowIdx, e.colId, e.next as RowValue),
    });
    const isApplyingHistoryRef = useRef(false);

    // PERF: deps EKSPLISIT — pakai fungsi spesifik (semua useCallback stable di
    // useDirtyState/useUndoRedo), JANGAN whole `dirty`/`undoApi` object yang
    // re-create tiap render. Tanpa ini meta re-build tiap edit → TanStack
    // table re-instantiate → 266 cells re-render.
    const dirtyUpdateCell = dirty.updateCell;
    const dirtyGetCellValue = dirty.getCellValue;
    const dirtyGetOriginalValue = dirty.getOriginalValue;
    const dirtyIsDirty = dirty.isDirty;
    const dirtyGetRowPatch = dirty.getRowPatch;
    const dirtyMarkRowSaved = dirty.markRowSaved;
    const recordEdit = undoApi.recordEdit;

    // E06 Cascade reset: map parent column id → children column ids (CHOICE_CASCADE
    // yg parentColumn-nya kolom ini). Dipakai di updateCell untuk auto-reset child
    // saat parent berubah. Computed sekali per change `columns` schema.
    const cascadeChildrenMap = useMemo(() => {
        const m = new Map<string, string[]>();
        for (const c of columns) {
            const parent = c.parentColumn;
            if (!parent) continue;
            if (!m.has(parent)) m.set(parent, []);
            m.get(parent)!.push(c.name);
        }
        return m;
    }, [columns]);

    const meta = useMemo(() => ({
        updateCell: (rowIdx: number, colId: string, value: unknown) => {
            const prev = dirtyGetCellValue(rowIdx, colId);
            dirtyUpdateCell(rowIdx, colId, value as RowValue);
            if (!isApplyingHistoryRef.current) {
                recordEdit(rowIdx, colId, prev as RowValue, value as RowValue);
            }
            // E06: reset semua child cascade column kalau parent ini berubah.
            const children = cascadeChildrenMap.get(colId);
            if (children && children.length > 0 && prev !== value) {
                for (const childId of children) {
                    const childPrev = dirtyGetCellValue(rowIdx, childId);
                    if (childPrev != null && childPrev !== "") {
                        dirtyUpdateCell(rowIdx, childId, null);
                        if (!isApplyingHistoryRef.current) {
                            recordEdit(rowIdx, childId, childPrev as RowValue, null);
                        }
                    }
                }
            }
        },
        commitRow: async (rowIdx: number): Promise<{ ok: boolean; error?: string }> => {
            if (!onUpdateRow || !pkColumn) {
                return { ok: false, error: "Handler simpan belum dikonfigurasi" };
            }
            const original = rows[rowIdx];
            const patch = dirtyGetRowPatch(rowIdx);
            const pk = String(original?.[pkColumn] ?? "");
            if (!pk) return { ok: false, error: `Missing primary key (${pkColumn})` };
            if (Object.keys(patch).length === 0) return { ok: true };
            try {
                await onUpdateRow(pk, patch);
                dirtyMarkRowSaved(rowIdx);
                return { ok: true };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                return { ok: false, error: msg };
            }
        },
        refresh: async () => onRefresh?.(),
        isDirty: dirtyIsDirty,
        getError: () => null,
        getOriginalValue: dirtyGetOriginalValue,
        getCellValue: dirtyGetCellValue,
        consumerDataset: config.dataset,
        consumerTable: config.table,
    }), [
        dirtyUpdateCell, dirtyGetCellValue, dirtyGetOriginalValue, dirtyIsDirty,
        dirtyGetRowPatch, dirtyMarkRowSaved, recordEdit, cascadeChildrenMap,
        onUpdateRow, onRefresh, pkColumn, rows,
        config.dataset, config.table,
    ]);

    // Edit mode handlers — STABLE refs (deps tidak include editingCell agar
    // meta tidak ikut re-create saat user pindah cell edit). State dipass ke
    // SpaceContainer via prop terpisah biar TanStack table instance stabil.
    const requestEdit = useCallback((rowIdx: number, colId: string) => {
        setEditingCell({ rowIdx, colId });
    }, []);
    const exitEdit = useCallback(() => setEditingCell(null), []);

    const columnDefs = useSpaceColumns(columns).map((c) => ({ ...c, cell: CellRenderer }));

    const { table, globalFilter, setGlobalFilter } = useSpaceTable({
        dataset: config.dataset,
        table: config.table,
        columns: columnDefs,
        rows: displayRows,
        schemas: columns,
        readOnly,
        meta,
    });

    const visibleRows = table.getRowModel().rows.length;
    const totalRows = rows.length;
    const selectedCount = Object.keys(table.getState().rowSelection).length;

    /** Save semua dirty rows sequentially. */
    const handleSaveAll = useCallback(async () => {
        if (dirty.dirtyRows.length === 0 || saving) return;
        setSaving(true);
        let ok = 0, fail = 0;
        const errors: string[] = [];
        for (const rowIdx of dirty.dirtyRows) {
            const res = await meta.commitRow(rowIdx);
            if (res.ok) ok++;
            else { fail++; if (res.error) errors.push(res.error); }
        }
        setSaving(false);
        if (fail === 0) {
            toast.success(`${ok} baris tersimpan`);
            onRefresh?.();
        } else if (ok === 0) {
            toast.error(`Gagal simpan: ${errors[0] ?? "kesalahan tidak diketahui"}`);
        } else {
            toast.warning(`${ok} tersimpan, ${fail} gagal: ${errors[0] ?? ""}`);
            onRefresh?.();
        }
    }, [dirty, meta, saving, onRefresh]);

    const handleDiscard = useCallback(() => {
        dirty.revertAll();
        toast.info("Semua perubahan dibatalkan");
    }, [dirty]);

    const handleNewRow = useCallback(() => {
        if (!onCreateRow) return;
        setNewRowOpen(true);
    }, [onCreateRow]);

    const handleSubmitNewRow = useCallback(async (values: RowData) => {
        if (!onCreateRow) throw new Error("Create handler not configured");
        await onCreateRow(values);
        toast.success("Baris ditambahkan");
        onRefresh?.();
    }, [onCreateRow, onRefresh]);

    /** Build helper: visible columns sebagai ExportColumn[] (name + alias) + filtered rows. */
    const buildExportPayload = useCallback(() => {
        const visibleCols: ExportColumn[] = table.getVisibleLeafColumns().map((c) => ({
            name: c.id,
            alias: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
        }));
        const filteredRows = table.getRowModel().rows.map((r) => r.original);
        const today = new Date().toISOString().slice(0, 10);
        const filename = `${config.dataset}_${config.table}_${today}`;
        return { visibleCols, filteredRows, filename, today };
    }, [table, config.dataset, config.table]);

    /** Export CSV — pakai stringifyCsv existing (light & fast). */
    const handleExportCsv = useCallback(() => {
        const visibleColIds = table.getVisibleLeafColumns().map((c) => c.id);
        const filteredRows = table.getRowModel().rows.map((r) => r.original);
        const csv = stringifyCsv(visibleColIds, filteredRows);
        const today = new Date().toISOString().slice(0, 10);
        downloadCsv(`${config.dataset}_${config.table}_${today}`, csv);
        toast.success("CSV diunduh");
    }, [table, config.dataset, config.table]);

    /** Export XLSX — pakai exportXlsx (ExcelJS) dari export-helpers (proper formatting + autoFilter + header style). */
    const handleExportXlsx = useCallback(async () => {
        try {
            const { visibleCols, filteredRows, filename } = buildExportPayload();
            await exportXlsx({
                filename,
                sheetName: config.table.slice(0, 31),
                columns: visibleCols,
                rows: filteredRows,
            });
            toast.success("Excel diunduh");
        } catch (e) {
            toast.error(`Ekspor Excel gagal: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [buildExportPayload, config.table]);

    /** Export PDF — pakai exportPdf (jsPDF + autotable) dengan title, subtitle, dan styling. */
    const handleExportPdf = useCallback(() => {
        try {
            const { visibleCols, filteredRows, filename } = buildExportPayload();
            const title = config.displayName || config.table;
            const subtitle = `${config.dataset}.${config.table}${
                config.description ? ` · ${config.description}` : ""
            }`;
            exportPdf({
                filename,
                title,
                subtitle,
                columns: visibleCols,
                rows: filteredRows,
            });
            toast.success("PDF diunduh");
        } catch (e) {
            toast.error(`Ekspor PDF gagal: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [buildExportPayload, config.dataset, config.table, config.displayName, config.description]);

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive max-w-md">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-medium">Gagal memuat data</div>
                        <div className="opacity-80 mt-1">{error}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading && rows.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                <Loader2 className="h-6 w-6 animate-spin opacity-60" />
                <span className="ds-small opacity-60">Memuat data...</span>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col bg-background group/header">
            <SpaceHeader
                config={config}
            />
            <SpaceToolbar
                table={table}
                globalFilter={globalFilter}
                setGlobalFilter={setGlobalFilter}
                rowCount={visibleRows}
                selectedCount={selectedCount}
                loading={loading}
                readOnly={readOnly}
                onRefresh={onRefresh}
                onNewRow={onCreateRow ? handleNewRow : undefined}
                onColumnsPanel={(e) => { columnsBtnRef.current = e.currentTarget; setColumnsPanelOpen((p) => !p); }}
                onExportCsv={handleExportCsv}
                onExportXlsx={handleExportXlsx}
                onExportPdf={handleExportPdf}
                onImport={!readOnly ? () => setBulkImportOpen(true) : undefined}
                onAddColumn={!readOnly ? () => setAddColumnOpen(true) : undefined}
                dirtyCount={dirty.dirtyCount}
                saving={saving}
                onSave={dirty.dirtyCount > 0 ? handleSaveAll : undefined}
                onDiscard={dirty.dirtyCount > 0 ? handleDiscard : undefined}
            />
            <SpaceContainer
                table={table}
                editingCell={editingCell}
                onRequestEdit={requestEdit}
                onExitEdit={exitEdit}
            />
            <SpaceStatusBar
                rowCount={visibleRows}
                totalRowCount={totalRows}
                selectedCount={selectedCount}
                colCount={columns.length}
                config={config}
                table={table}
            />

            {/* ─── Modal flyouts (reuse existing ekosistem) ─────────────── */}
            {bulkImportOpen && (
                <BulkImportPanel
                    dataset={config.dataset}
                    table={config.table}
                    onClose={() => setBulkImportOpen(false)}
                    onDone={() => {
                        setBulkImportOpen(false);
                        onRefresh?.();
                    }}
                />
            )}
            <AddColumnModal
                open={addColumnOpen}
                dataset={config.dataset}
                table={config.table}
                onClose={() => setAddColumnOpen(false)}
                onSaved={() => {
                    setAddColumnOpen(false);
                    onRefresh?.();
                }}
            />
            <WorkspaceDrawer
                open={columnsPanelOpen}
                title="Columns"
                subtitle={`${columns.length} column${columns.length === 1 ? "" : "s"} · drag to reorder`}
                anchorEl={columnsBtnRef.current}
                defaultWidth={420}
                onClose={() => setColumnsPanelOpen(false)}
            >
                <ColumnSidePanel
                    dataset={config.dataset}
                    table={config.table}
                    columns={columns}
                    onColumnsUpdated={() => {
                        onRefresh?.();
                    }}
                />
            </WorkspaceDrawer>
            <RowFormModal
                open={newRowOpen}
                columns={columns}
                onClose={() => setNewRowOpen(false)}
                onSubmit={handleSubmitNewRow}
            />
        </div>
    );
}
