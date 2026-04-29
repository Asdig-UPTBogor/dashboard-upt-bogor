"use client";

/**
 * SpaceHeaderCell — column header.
 *
 *  ┌──────────────────────────────────────────────┐
 *  │ ⠿ │ Label · ↕ sort │ 🔻 menu │  ║resize     │
 *  └──────────────────────────────────────────────┘
 *
 * SINGLE chevron — semua fitur kolom (Sort/Filter/Dropdown setup/Hide/Pin/Delete)
 * masuk di dalam menu. Pattern Google Sheets-like.
 *
 * Menu = shadcn `Popover` + `ColumnHeaderMenu` content. Positioning, click-
 * outside, dan Escape dismiss di-handle Radix bawaan — TIDAK ada manual
 * position calc atau document listener di sini.
 *
 * Drag handle (GripVertical, kiri) — reorder column via @dnd-kit.
 * Resize handle (right edge, 8px) — drag to resize, double-click reset.
 */

import { useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown, GripVertical, ChevronDown } from "lucide-react";
import type { Header } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";

interface Props {
    header: Header<RowData, unknown>;
    dragAttributes?: Record<string, unknown>;
    dragListeners?: Record<string, unknown>;
}

export function SpaceHeaderCell({ header, dragAttributes, dragListeners }: Props) {
    const sortDir = header.column.getIsSorted();
    const canSort = header.column.getCanSort();
    const canResize = header.column.getCanResize();
    const meta = header.column.columnDef.meta;
    const required = meta?.required;
    const hasFilter = header.column.getFilterValue() !== undefined;
    const isPinned = !!header.column.getIsPinned();
    const dragEnabled = !!dragListeners && !isPinned;

    const [menuOpen, setMenuOpen] = useState(false);
    const tableMeta = header.getContext().table.options.meta;
    const consumerDataset = tableMeta?.consumerDataset ?? "";
    const consumerTable = tableMeta?.consumerTable ?? "";
    const rows = header.getContext().table.getCoreRowModel().rows;

    const SortIcon =
        sortDir === "asc" ? ArrowUp :
        sortDir === "desc" ? ArrowDown :
        ChevronsUpDown;

    return (
        <div className="group/hcell relative h-full flex items-center w-full select-none">
            {dragEnabled && (
                <button
                    type="button"
                    {...dragAttributes}
                    {...dragListeners}
                    className="shrink-0 ml-0.5 mr-0.5 h-5 w-4 inline-flex items-center justify-center text-muted-foreground/40 hover:text-primary cursor-grab active:cursor-grabbing opacity-0 group-hover/hcell:opacity-100 ds-transition"
                    title="Drag untuk reorder kolom"
                    aria-label="Reorder kolom"
                    onClick={(e) => e.preventDefault()}
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
            )}

            <button
                type="button"
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                onMouseDown={(e) => e.stopPropagation()}
                className={`flex-1 min-w-0 h-full flex items-center gap-1.5 px-1.5 select-none ${
                    canSort ? "cursor-pointer hover:text-primary" : ""
                }`}
                disabled={!canSort}
            >
                <span className="ds-label truncate text-left flex-1 select-none">
                    {String(header.column.columnDef.header ?? header.id)}
                </span>
                {required && <span className="text-destructive text-xs leading-none">*</span>}
                {canSort && (
                    <SortIcon
                        className={`h-3 w-3 shrink-0 ${
                            sortDir ? "text-primary" : "opacity-30 group-hover/hcell:opacity-60"
                        }`}
                    />
                )}
            </button>

            {/* Single chevron — semua fitur kolom di dalam menu (shadcn Popover) */}
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`shrink-0 mr-1.5 ds-press ds-focus rounded h-5 w-5 inline-flex items-center justify-center ds-transition relative ${
                            hasFilter || menuOpen
                                ? "text-primary opacity-100 bg-primary/10"
                                : "text-muted-foreground opacity-0 group-hover/hcell:opacity-60 hover:opacity-100 hover:text-primary"
                        }`}
                        title="Menu kolom"
                        aria-label="Menu kolom"
                    >
                        <ChevronDown className="h-3 w-3" />
                        {hasFilter && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[320px] p-0"
                    align="end"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <ColumnHeaderMenu
                        column={header.column}
                        rows={rows}
                        tableInstance={header.getContext().table}
                        dataset={consumerDataset}
                        table={consumerTable}
                        consumerTable={consumerTable}
                        onClose={() => setMenuOpen(false)}
                        onChange={() => { void tableMeta?.refresh?.(); }}
                    />
                </PopoverContent>
            </Popover>

            {canResize && (
                <div
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        header.getResizeHandler()(e);
                    }}
                    onTouchStart={(e) => {
                        e.stopPropagation();
                        header.getResizeHandler()(e);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        header.column.resetSize();
                    }}
                    className={`absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none flex items-center justify-center group/resize ${
                        header.column.getIsResizing() ? "bg-primary/20" : ""
                    }`}
                    title="Drag untuk resize · dobel-klik untuk reset"
                >
                    <span
                        className={`block h-3/5 w-0.5 rounded-full ds-transition ${
                            header.column.getIsResizing()
                                ? "bg-primary"
                                : "bg-border/0 group-hover/resize:bg-primary/60"
                        }`}
                    />
                </div>
            )}
        </div>
    );
}
