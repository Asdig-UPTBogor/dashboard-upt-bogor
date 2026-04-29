"use client";

/**
 * SpaceToolbar — Row 1 toolbar.
 *
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │ 🔍 Search…    │ N rows · M selected │ ⊞ columns ↻ refresh + new │
 *  └──────────────────────────────────────────────────────────────────┘
 *
 *  Hover-to-reveal kontrol minor. Search & action buttons selalu visible.
 */

import { Search, X, RefreshCw, Plus, Columns3, Loader2, Download, Upload, ColumnsIcon, Save, Undo2, FileText, FileSpreadsheet } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import type { MouseEvent } from "react";
import type { RowData } from "@/app/data-input/_workspace/types";
import { SPACE_GRID } from "../core/space-tokens";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
    table: Table<RowData>;
    globalFilter: string;
    setGlobalFilter: (q: string) => void;
    rowCount: number;
    selectedCount: number;
    loading?: boolean;
    readOnly?: boolean;
    onRefresh?: () => void;
    onNewRow?: () => void;
    onColumnsPanel?: (e: MouseEvent<HTMLButtonElement>) => void;
    onExportCsv?: () => void;
    onExportXlsx?: () => void;
    onExportPdf?: () => void;
    onImport?: () => void;
    onAddColumn?: () => void;
    /** Dirty/save controls — hadir kalau ada unsaved change. */
    dirtyCount?: number;
    saving?: boolean;
    onSave?: () => void;
    onDiscard?: () => void;
}

export function SpaceToolbar({
    table, globalFilter, setGlobalFilter,
    rowCount, selectedCount, loading, readOnly,
    onRefresh, onNewRow, onColumnsPanel, onExportCsv, onExportXlsx, onExportPdf, onImport, onAddColumn,
    dirtyCount = 0, saving, onSave, onDiscard,
}: Props) {
    const visibleCount = table.getVisibleLeafColumns().length;
    const totalCount = table.getAllLeafColumns().length;

    const btn = "ds-interactive ds-press ds-focus rounded h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-primary";
    const btnPrimary = "ds-interactive ds-press ds-focus rounded inline-flex items-center gap-1.5 px-2.5 h-7 text-xs border border-primary/50 bg-primary/15 text-primary hover:bg-primary/20 hover:border-primary/70";

    return (
        <div
            className="shrink-0 flex items-center gap-2 px-3 border-b border-border/60 bg-card/30"
            style={{ height: SPACE_GRID.TOOLBAR_HEIGHT_PX }}
        >
            {/* Search */}
            <div className="relative flex-1 max-w-sm min-w-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                    type="search"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Cari baris..."
                    className="w-full pl-7 pr-6 h-7 text-xs rounded border border-border/50 bg-background/60 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                {globalFilter && (
                    <button
                        type="button"
                        onClick={() => setGlobalFilter("")}
                        aria-label="Hapus pencarian"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-50 hover:opacity-100"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>

            {/* Row counter */}
            <div className="ds-small opacity-60 tabular-nums whitespace-nowrap shrink-0">
                {rowCount.toLocaleString()} baris
                {selectedCount > 0 && (
                    <span className="ml-1.5 text-primary">· {selectedCount} dipilih</span>
                )}
            </div>

            <div className="flex-1" />

            {/* Dirty / Save controls — muncul kalau ada perubahan belum disimpan */}
            {dirtyCount > 0 && (
                <>
                    <span className="ds-small text-amber-500 tabular-nums whitespace-nowrap">
                        {dirtyCount} belum disimpan
                    </span>
                    {onDiscard && (
                        <button
                            type="button"
                            onClick={onDiscard}
                            disabled={saving}
                            className="ds-interactive ds-press ds-focus rounded h-7 inline-flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title="Batalkan semua perubahan"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            <span>Batalkan</span>
                        </button>
                    )}
                    {onSave && (
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={saving}
                            className={btnPrimary}
                            title="Simpan semua perubahan"
                        >
                            {saving
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Save className="h-3.5 w-3.5" />}
                            <span>Simpan</span>
                        </button>
                    )}
                    <div className="w-px h-5 bg-border/60 mx-1" />
                </>
            )}

            {/* Actions */}
            {onColumnsPanel && (
                <button
                    type="button"
                    onClick={onColumnsPanel}
                    title={`Kolom (${visibleCount}/${totalCount})`}
                    aria-label="Kolom"
                    className={btn}
                >
                    <Columns3 className="h-3.5 w-3.5" />
                </button>
            )}
            {!readOnly && onAddColumn && (
                <button
                    type="button"
                    onClick={onAddColumn}
                    title="Tambah kolom"
                    aria-label="Tambah kolom"
                    className={btn}
                >
                    <ColumnsIcon className="h-3.5 w-3.5" />
                </button>
            )}
            {!readOnly && onImport && (
                <button
                    type="button"
                    onClick={onImport}
                    title="Impor CSV / Excel"
                    aria-label="Impor"
                    className={btn}
                >
                    <Upload className="h-3.5 w-3.5" />
                </button>
            )}
            {(onExportCsv || onExportXlsx || onExportPdf) && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            title="Ekspor"
                            aria-label="Ekspor"
                            className={btn}
                        >
                            <Download className="h-3.5 w-3.5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="ds-label uppercase tracking-wider text-[10px]">
                            Ekspor
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {onExportCsv && (
                            <DropdownMenuItem onClick={onExportCsv} className="text-xs">
                                <FileText className="h-3.5 w-3.5 opacity-70" />
                                <span className="flex-1">CSV</span>
                                <span className="ds-small font-mono opacity-50">.csv</span>
                            </DropdownMenuItem>
                        )}
                        {onExportXlsx && (
                            <DropdownMenuItem onClick={onExportXlsx} className="text-xs">
                                <FileSpreadsheet className="h-3.5 w-3.5 opacity-70" />
                                <span className="flex-1">Excel</span>
                                <span className="ds-small font-mono opacity-50">.xlsx</span>
                            </DropdownMenuItem>
                        )}
                        {onExportPdf && (
                            <DropdownMenuItem onClick={onExportPdf} className="text-xs">
                                <Download className="h-3.5 w-3.5 opacity-70" />
                                <span className="flex-1">PDF</span>
                                <span className="ds-small font-mono opacity-50">.pdf</span>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {onRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Muat ulang"
                    aria-label="Muat ulang"
                    className={btn}
                >
                    {loading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5" />}
                </button>
            )}
            {!readOnly && onNewRow && (
                <button
                    type="button"
                    onClick={onNewRow}
                    className={btnPrimary}
                    aria-label="Baris baru"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Baris baru</span>
                </button>
            )}
        </div>
    );
}
