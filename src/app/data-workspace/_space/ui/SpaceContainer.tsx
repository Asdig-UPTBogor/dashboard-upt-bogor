"use client";

/**
 * SpaceContainer — virtualized scrollable grid (canonical TanStack v8 + react-virtual pattern).
 *
 *  https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-rows
 *
 *  Layout RULES (CRITICAL untuk scroll work):
 *   1. Outer scroll container: position:relative + overflow:auto + bounded height
 *   2. Inner uses CSS grid display:
 *        - <div display:grid width=totalSize>          ← root grid
 *           <div display:grid sticky top:0>            ← header band (sticky vertical)
 *           <div display:grid position:relative        ← body band
 *                height={virt.totalSize}>              ← REAL height untuk scrollbar
 *               ...absolute rows translateY              ← virtualized
 *  3. Body height MUST equal virtualizer.getTotalSize() — itu yg bikin scrollbar muncul
 *  4. Outer container height = constrained dari parent flex chain (flex-1 min-h-0)
 */

import { useRef, useEffect, useState, useCallback, memo } from "react";
import type { Table, Header, Cell, Row } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    DndContext, type DragEndEvent, MouseSensor, TouchSensor,
    KeyboardSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
    SortableContext, horizontalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SPACE_GRID } from "../core/space-tokens";
import { SpaceHeaderCell } from "./SpaceHeaderCell";
import { SpaceBodyCell } from "./SpaceBodyCell";
import type { RowData } from "@/app/data-input/_workspace/types";

interface ActiveCell { rowIdx: number; colId: string }

interface Props {
    table: Table<RowData>;
    rowHeight?: number;
    /** Cell yang sedang dalam edit mode (state dilift ke Space.tsx untuk performance). */
    editingCell?: ActiveCell | null;
    onRequestEdit?: (rowIdx: number, colId: string) => void;
    onExitEdit?: () => void;
}

export function SpaceContainer({
    table,
    rowHeight = SPACE_GRID.ROW_HEIGHT_PX,
    editingCell = null,
    onRequestEdit,
    onExitEdit,
}: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const rows = table.getRowModel().rows;
    const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
    const tableMeta = table.options.meta;

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => rowHeight,
        overscan: SPACE_GRID.VIRT_OVERSCAN,
    });

    // Re-measure saat parent resize (height berubah → virtualizer recompute viewport).
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => rowVirtualizer.measure());
        ro.observe(el);
        return () => ro.disconnect();
    }, [rowVirtualizer]);

    // Auto-scroll ke posisi visual baru cell aktif kalau row pindah karena
    // sort recompute (akibat edit commit pada kolom sort key).
    // Pattern: track previous visual pos di ref, scroll hanya saat berubah.
    const prevActiveVisualPosRef = useRef<number>(-1);
    useEffect(() => {
        if (!activeCell || !scrollRef.current) {
            prevActiveVisualPosRef.current = -1;
            return;
        }
        const rowsArr = table.getRowModel().rows;
        const rowVi = rowsArr.findIndex((r) => r.index === activeCell.rowIdx);
        if (rowVi < 0) return;
        if (prevActiveVisualPosRef.current !== rowVi) {
            prevActiveVisualPosRef.current = rowVi;
            // RAF: scroll setelah React commit + virtualizer measure final.
            requestAnimationFrame(() => {
                rowVirtualizer.scrollToIndex(rowVi, { align: "auto" });
            });
        }
    });

    // Keyboard nav: Arrow / Tab / Home / End / PageUp / PageDown / Esc / Enter / F2.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const tgt = e.target as HTMLElement | null;
            if (tgt?.matches("input, textarea, select, [contenteditable]")) return;
            if (!activeCell) return;
            // Block nav saat lagi edit mode (editor handle Enter/Escape sendiri).
            if (editingCell) return;
            const visibleCols = table.getVisibleLeafColumns();
            const colIdx = visibleCols.findIndex((c) => c.id === activeCell.colId);
            if (colIdx < 0) return;
            const rowsArr = table.getRowModel().rows;
            // PENTING: pakai r.index (BQ original) — konsisten dgn handleCellClick.
            // Sort/filter ubah urutan rowsArr tapi r.index stable.
            const rowVi = rowsArr.findIndex((r) => r.index === activeCell.rowIdx);
            if (rowVi < 0) return;

            const goTo = (nr: number, nc: number) => {
                nr = Math.max(0, Math.min(rowsArr.length - 1, nr));
                nc = Math.max(0, Math.min(visibleCols.length - 1, nc));
                const targetCol = visibleCols[nc];
                setActiveCell({ rowIdx: rowsArr[nr].index, colId: targetCol.id });
                rowVirtualizer.scrollToIndex(nr, { align: "auto" });
                const el = scrollRef.current;
                if (el) {
                    const colStart = targetCol.getStart("center");
                    const colEnd = colStart + targetCol.getSize();
                    const viewLeft = el.scrollLeft;
                    const viewRight = viewLeft + el.clientWidth;
                    if (colStart < viewLeft) {
                        el.scrollTo({ left: colStart, behavior: "auto" });
                    } else if (colEnd > viewRight) {
                        el.scrollTo({ left: colEnd - el.clientWidth, behavior: "auto" });
                    }
                }
            };

            const move = (dr: number, dc: number) => {
                let nr = rowVi + dr;
                let nc = colIdx + dc;
                if (nc < 0) {
                    if (nr > 0) { nr--; nc = visibleCols.length - 1; } else nc = 0;
                } else if (nc >= visibleCols.length) {
                    if (nr < rowsArr.length - 1) { nr++; nc = 0; } else nc = visibleCols.length - 1;
                }
                goTo(nr, nc);
            };

            // Excel pattern (Ctrl/Cmd + Arrow):
            //   Ctrl+Left   → kolom 0 (first col, same row)
            //   Ctrl+Right  → kolom last
            //   Ctrl+Up     → row 0 (first row, same col)
            //   Ctrl+Down   → row last
            //   Ctrl+Home   → row 0 col 0
            //   Ctrl+End    → row last col last
            const isJump = e.ctrlKey || e.metaKey;

            switch (e.key) {
                case "ArrowLeft":  e.preventDefault(); isJump ? goTo(rowVi, 0) : move(0, -1); break;
                case "ArrowRight": e.preventDefault(); isJump ? goTo(rowVi, visibleCols.length - 1) : move(0, 1); break;
                case "ArrowUp":    e.preventDefault(); isJump ? goTo(0, colIdx) : move(-1, 0); break;
                case "ArrowDown":  e.preventDefault(); isJump ? goTo(rowsArr.length - 1, colIdx) : move(1, 0); break;
                case "Tab": e.preventDefault(); move(0, e.shiftKey ? -1 : 1); break;
                case "Home": e.preventDefault(); isJump ? goTo(0, 0) : goTo(rowVi, 0); break;
                case "End":  e.preventDefault(); isJump ? goTo(rowsArr.length - 1, visibleCols.length - 1) : goTo(rowVi, visibleCols.length - 1); break;
                case "PageDown": {
                    e.preventDefault();
                    const next = Math.min(rowsArr.length - 1, rowVi + 20);
                    setActiveCell({ rowIdx: rowsArr[next].index, colId: activeCell.colId });
                    rowVirtualizer.scrollToIndex(next, { align: "auto" });
                    break;
                }
                case "PageUp": {
                    e.preventDefault();
                    const prev = Math.max(0, rowVi - 20);
                    setActiveCell({ rowIdx: rowsArr[prev].index, colId: activeCell.colId });
                    rowVirtualizer.scrollToIndex(prev, { align: "auto" });
                    break;
                }
                case "Escape": e.preventDefault(); setActiveCell(null); break;
                case "Enter":
                case "F2": {
                    e.preventDefault();
                    // Trigger edit mode untuk cell aktif (spreadsheet feel).
                    onRequestEdit?.(activeCell.rowIdx, activeCell.colId);
                    break;
                }
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [activeCell, table, rowVirtualizer, editingCell, onRequestEdit]);

    // Event delegation: 1 listener di row, baca data-col-id dari closest cell.
    // PERF: replace per-cell onClick arrow function biar memo BodyCellWrap effective.
    const handleRowClick = useCallback((row: Row<RowData>, e: React.MouseEvent<HTMLDivElement>) => {
        if (e.ctrlKey || e.metaKey) {
            row.toggleSelected();
            return;
        }
        const target = e.target as HTMLElement;
        const cellEl = target.closest("[data-col-id]") as HTMLElement | null;
        if (!cellEl) return;
        const colId = cellEl.getAttribute("data-col-id");
        if (!colId) return;
        setActiveCell({ rowIdx: row.index, colId });
    }, []);

    const headerGroups = table.getHeaderGroups();
    const totalWidth = table.getTotalSize();
    const totalHeight = rowVirtualizer.getTotalSize();
    const virtualRows = rowVirtualizer.getVirtualItems();

    // Resize visual overlay
    const resizeInfo = table.getState().columnSizingInfo;
    const isResizingAny = !!resizeInfo.isResizingColumn;

    // Drag-to-reorder columns (godmode B05). Sensors:
    //   · MouseSensor activation distance 6px → guard agar click sort tidak
    //     memicu drag, dan resize handle tidak konflik.
    //   · TouchSensor delay 200ms — biarkan tap normal.
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        useSensor(KeyboardSensor),
    );

    const handleDragEnd = useCallback((e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
        const fromIdx = visibleIds.indexOf(String(active.id));
        const toIdx = visibleIds.indexOf(String(over.id));
        if (fromIdx < 0 || toIdx < 0) return;
        const next = arrayMove(visibleIds, fromIdx, toIdx);
        table.setColumnOrder(next);
    }, [table]);

    return (
        <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-auto bg-background select-none"
            style={{ position: "relative" }}
        >
            {/* Root grid — width = total kolom, hosts header + body bands. */}
            <div style={{ display: "grid", width: totalWidth }}>
                {/* Header band — sticky vertical, DndContext handle drag-reorder. */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                <div
                    className="bg-card/80 backdrop-blur border-b border-border/60"
                    style={{
                        display: "grid",
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                    }}
                >
                    {headerGroups.map((headerGroup) => {
                        const headerIds = headerGroup.headers.map((h) => h.column.id);
                        return (
                            <SortableContext key={headerGroup.id} items={headerIds} strategy={horizontalListSortingStrategy}>
                                <div style={{ display: "flex", width: "100%", height: SPACE_GRID.HEADER_HEIGHT_PX }}>
                                    {headerGroup.headers.map((header) => (
                                        <HeaderCellWrap
                                            key={header.id}
                                            header={header}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        );
                    })}
                </div>
                </DndContext>

                {/* Body band — height = virtualizer total, beri scrollbar height yang akurat. */}
                <div
                    style={{
                        display: "grid",
                        position: "relative",
                        height: totalHeight,
                    }}
                >
                    {rows.length === 0 && <EmptyRow />}
                    {virtualRows.map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        // PENTING: activeCell.rowIdx = row.index (original BQ idx, stable across sort).
                        // virtualRow.index = posisi visual setelah sort/filter — JANGAN dipake utk identity.
                        const isActiveRow = activeCell?.rowIdx === row.index;
                        return (
                            <div
                                key={row.id}
                                data-row-index={row.index}
                                onClick={(e) => handleRowClick(row, e)}
                                className={`flex border-b border-border/30 hover:bg-muted/40 cursor-default ${
                                    virtualRow.index % 2 === 1 ? "bg-muted/10" : ""
                                } ${row.getIsSelected() ? "!bg-primary/10" : ""} ${
                                    isActiveRow ? "!bg-primary/5 outline outline-1 -outline-offset-1 outline-primary/30" : ""
                                }`}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: virtualRow.size,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                {row.getVisibleCells().map((cell) => {
                                    const isCellActive = activeCell?.rowIdx === row.index && activeCell?.colId === cell.column.id;
                                    const isCellEditing = editingCell?.rowIdx === row.index && editingCell?.colId === cell.column.id;
                                    return (
                                        <BodyCellWrap
                                            key={cell.id}
                                            cell={cell}
                                            colId={cell.column.id}
                                            cellId={cell.id}
                                            cellValue={cell.getValue()}
                                            width={cell.column.getSize()}
                                            pinSide={cell.column.getIsPinned()}
                                            pinLeft={cell.column.getStart("left")}
                                            pinRight={cell.column.getAfter("right")}
                                            isActive={isCellActive}
                                            isEditing={isCellEditing}
                                            onRequestEdit={onRequestEdit}
                                            onExitEdit={onExitEdit}
                                        />
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Resize overlay vertical guide line saat drag kolom resize. */}
            {isResizingAny && <ResizeGuide table={table} />}
        </div>
    );
}

function HeaderCellWrap({
    header,
}: {
    header: Header<RowData, unknown>;
}) {
    const pinSide = header.column.getIsPinned();
    const left = header.column.getStart("left");
    const right = header.column.getAfter("right");

    // useSortable — enable drag-to-reorder. Column id (string) sebagai sortable id.
    // Pinned columns: drag disabled (pin lock-position).
    const sortable = useSortable({
        id: header.column.id,
        disabled: !!pinSide,
    });
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

    const style: React.CSSProperties = {
        width: header.getSize(),
        ...(pinSide === "left" ? { left } : pinSide === "right" ? { right } : {}),
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 30 : pinSide ? 10 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            className={`shrink-0 border-r border-border/40 ${
                pinSide ? "sticky bg-card/95 backdrop-blur" : ""
            } ${isDragging ? "shadow-lg ring-2 ring-primary/40" : ""}`}
            style={style}
        >
            <SpaceHeaderCell
                header={header}
                dragAttributes={attributes as unknown as Record<string, unknown>}
                dragListeners={listeners as unknown as Record<string, unknown> | undefined}
            />
        </div>
    );
}

interface BodyCellWrapProps {
    cell: Cell<RowData, unknown>;
    /** Primitive props — captured per render dari parent, jadi memo equality
        beneran detect change (cell instance dari TanStack di-reuse, getSize()
        baca state CURRENT — equalityFn pakai cell.x.y() akan SELALU true). */
    colId: string;
    cellId: string;
    cellValue: unknown;
    width: number;
    pinSide: false | "left" | "right";
    pinLeft: number;
    pinRight: number;
    isActive?: boolean;
    isEditing?: boolean;
    onRequestEdit?: (rowIdx: number, colId: string) => void;
    onExitEdit?: () => void;
}

const BodyCellWrap = memo(function BodyCellWrap({
    cell, colId, width, pinSide, pinLeft, pinRight, isActive, isEditing, onRequestEdit, onExitEdit,
}: BodyCellWrapProps) {
    return (
        <div
            data-col-id={colId}
            className={`shrink-0 border-r border-border/30 ${
                pinSide ? "sticky z-10 bg-inherit" : ""
            } ${
                isActive ? "outline outline-2 -outline-offset-2 outline-primary z-[5]" : ""
            }`}
            style={{
                width,
                ...(pinSide === "left" ? { left: pinLeft } : pinSide === "right" ? { right: pinRight } : {}),
            }}
        >
            <SpaceBodyCell
                cell={cell}
                isEditing={!!isEditing}
                onRequestEdit={onRequestEdit}
                onExitEdit={onExitEdit}
            />
        </div>
    );
}, (prev, next) => {
    // Memo equality pakai PRIMITIVE props (captured per render) supaya benar2
    // detect column size/position changes saat resize/reorder.
    return (
        prev.isActive === next.isActive
        && prev.isEditing === next.isEditing
        && prev.cellId === next.cellId
        && prev.cellValue === next.cellValue
        && prev.width === next.width
        && prev.pinSide === next.pinSide
        && prev.pinLeft === next.pinLeft
        && prev.pinRight === next.pinRight
        && prev.onRequestEdit === next.onRequestEdit
        && prev.onExitEdit === next.onExitEdit
    );
});

function ResizeGuide({ table }: { table: Table<RowData> }) {
    const info = table.getState().columnSizingInfo;
    const colId = info.isResizingColumn;
    if (!colId) return null;
    const col = table.getColumn(colId);
    if (!col) return null;
    const startOffset = col.getStart("center") + col.getSize() + (info.deltaOffset ?? 0);
    return (
        <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-primary"
            style={{ left: startOffset, boxShadow: "0 0 0 1px rgba(243, 193, 75, 0.4)" }}
        />
    );
}

function EmptyRow() {
    return (
        <div className="flex items-center justify-center py-12 text-muted-foreground/60 text-sm">
            No rows match current filter.
        </div>
    );
}
