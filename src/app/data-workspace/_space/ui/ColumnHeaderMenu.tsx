"use client";

/**
 * ColumnHeaderMenu — content panel untuk header chevron (Sort / Filter /
 * Dropdown setup / Manage).
 *
 *  ┌─────────────────────────────────────┐
 *  │ Sort A→Z · Sort Z→A · Clear sort    │
 *  ├─────────────────────────────────────┤
 *  │ [Filter] [Dropdown] [Manage]        │  ← tabs
 *  ├─────────────────────────────────────┤
 *  │  ... tab content (filter/dropdown/manage)
 *  └─────────────────────────────────────┘
 *
 * Komponen ini di-render di dalam shadcn `<PopoverContent>` di parent
 * (`SpaceHeaderCell`). Positioning + click-outside + Escape dismiss
 * di-handle Radix bawaan — tidak ada manual position calc atau document
 * listener di sini.
 */

import { useState } from "react";
import {
    ArrowUp, ArrowDown, RotateCcw, Filter, ListChecks, Settings,
    Trash2, EyeOff, Pin, PinOff, AlertTriangle, Loader2,
} from "lucide-react";
import type { Column, Row, Table } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";
import { apiFetch, formatApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { SheetFilterPanel, type FilterAllowed } from "./SheetFilterPanel";
import { DropdownSetupPanel } from "./DropdownSetupPanel";

type Tab = "filter" | "dropdown" | "manage";

interface Props {
    column: Column<RowData, unknown>;
    rows: ReadonlyArray<Row<RowData>>;
    /** TanStack table instance — dipakai DropdownSetupPanel CASCADE mode. */
    tableInstance?: Table<RowData>;
    dataset: string;
    table: string;
    consumerTable?: string;
    onClose: () => void;
    onChange?: () => void;
}

export function ColumnHeaderMenu({
    column, rows, tableInstance, dataset, table, consumerTable, onClose, onChange,
}: Props) {
    const [tab, setTab] = useState<Tab>("filter");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const sortDir = column.getIsSorted();
    const colLabel = String(column.columnDef.header ?? column.id);
    const pinSide = column.getIsPinned();

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await apiFetch<{ ok: boolean; message?: string }>(
                `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/columns/${encodeURIComponent(column.id)}`,
                { method: "DELETE", timeoutMs: 30_000 },
            );
            if (!res.ok) throw new Error(res.message ?? "Gagal menghapus kolom");
            toast.success(`Kolom "${column.id}" dihapus`);
            onChange?.();
            onClose();
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setDeleting(false);
        }
    };

    const applyFilter = (allowed: FilterAllowed | null) => {
        if (!allowed) column.setFilterValue(undefined);
        else column.setFilterValue({ kind: "set", values: allowed });
        onChange?.();
    };

    return (
        <div className="flex flex-col" style={{ maxHeight: "70vh" }}>
            {/* Header — column label */}
            <div className="shrink-0 border-b border-border/40 px-3 py-2 flex items-center justify-between">
                <span className="ds-label uppercase tracking-wider text-[10px] truncate">
                    Kolom: <span className="text-primary normal-case font-mono">{colLabel}</span>
                </span>
            </div>

            {/* Sort actions (selalu visible) */}
            <div className="shrink-0 border-b border-border/40 px-1 py-1 flex items-center gap-0.5 text-xs">
                <SortBtn active={sortDir === "asc"} onClick={() => { column.toggleSorting(false); onChange?.(); }}>
                    <ArrowUp className="h-3 w-3" /> A→Z
                </SortBtn>
                <SortBtn active={sortDir === "desc"} onClick={() => { column.toggleSorting(true); onChange?.(); }}>
                    <ArrowDown className="h-3 w-3" /> Z→A
                </SortBtn>
                <SortBtn active={false} onClick={() => { column.clearSorting(); onChange?.(); }}>
                    <RotateCcw className="h-3 w-3" /> Reset
                </SortBtn>
            </div>

            {/* Tabs */}
            <div className="shrink-0 border-b border-border/40 flex">
                <TabBtn active={tab === "filter"} onClick={() => setTab("filter")}>
                    <Filter className="h-3 w-3" /> Filter
                    {column.getFilterValue() !== undefined && <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
                </TabBtn>
                <TabBtn active={tab === "dropdown"} onClick={() => setTab("dropdown")}>
                    <ListChecks className="h-3 w-3" /> Dropdown
                </TabBtn>
                <TabBtn active={tab === "manage"} onClick={() => setTab("manage")}>
                    <Settings className="h-3 w-3" /> Atur
                </TabBtn>
            </div>

            {/* Tab content */}
            {tab === "filter" && (
                <SheetFilterPanel
                    column={column}
                    rows={rows}
                    consumerTable={consumerTable}
                    onApply={applyFilter}
                    onClose={onClose}
                />
            )}

            {tab === "dropdown" && (
                <DropdownSetupPanel
                    column={column}
                    tableInstance={tableInstance}
                    dataset={dataset}
                    table={table}
                    onClose={onClose}
                    onSaved={onChange}
                />
            )}

            {tab === "manage" && (
                <div className="flex-1 overflow-y-auto py-1">
                    {!confirmDelete ? (
                        <>
                            <MenuItem onClick={() => { column.toggleVisibility(false); onChange?.(); onClose(); }}>
                                <EyeOff className="h-3.5 w-3.5" /> Sembunyikan kolom
                            </MenuItem>
                            <MenuItem onClick={() => { column.pin(pinSide === "left" ? false : "left"); onChange?.(); }}>
                                {pinSide === "left"
                                    ? <><PinOff className="h-3.5 w-3.5" /> Lepas pin (saat ini di kiri)</>
                                    : <><Pin className="h-3.5 w-3.5" /> Pin ke kiri</>}
                            </MenuItem>
                            <MenuItem onClick={() => { column.pin(pinSide === "right" ? false : "right"); onChange?.(); }}>
                                {pinSide === "right"
                                    ? <><PinOff className="h-3.5 w-3.5" /> Lepas pin (saat ini di kanan)</>
                                    : <><Pin className="h-3.5 w-3.5 rotate-180" /> Pin ke kanan</>}
                            </MenuItem>
                            <div className="border-t border-border/40 my-1" />
                            <MenuItem destructive onClick={() => setConfirmDelete(true)}>
                                <Trash2 className="h-3.5 w-3.5" /> Hapus kolom
                            </MenuItem>
                        </>
                    ) : (
                        <div className="p-3 text-xs">
                            <div className="flex items-start gap-2 mb-3">
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-medium">Hapus kolom permanen?</div>
                                    <div className="text-muted-foreground text-[11px] mt-1">
                                        Kolom <span className="font-mono text-foreground/80">{colLabel}</span> beserta seluruh data akan dihapus dari BigQuery.
                                        Aksi <span className="text-destructive">tidak bisa dibatalkan</span>.
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
                                    className="px-2.5 h-7 rounded text-xs hover:bg-muted/50">Batal</button>
                                <button type="button" onClick={handleDelete} disabled={deleting}
                                    className="px-2.5 h-7 rounded text-xs bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/20 inline-flex items-center gap-1">
                                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                    Hapus
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function SortBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded ds-transition ${
                active ? "bg-primary/15 text-primary" : "hover:bg-muted/40 text-muted-foreground"
            }`}>
            {children}
        </button>
    );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] border-b-2 ds-transition ${
                active ? "border-primary text-primary" : "border-transparent hover:bg-muted/40 text-muted-foreground"
            }`}>
            {children}
        </button>
    );
}

function MenuItem({ onClick, destructive, children }: { onClick: () => void; destructive?: boolean; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted/50"
            }`}>
            {children}
        </button>
    );
}
