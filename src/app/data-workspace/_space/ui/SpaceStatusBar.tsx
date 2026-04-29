"use client";

/**
 * SpaceStatusBar — bottom strip dengan meta tabel + pagination.
 *
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │ N rows · M cols · PK: id · level: Bay · kind: master  |  K selected    │
 *  │                                                       |   « ‹ p/N › » │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 * Save/Discard udah pindah ke SpaceToolbar (samping tombol2 lain).
 */

import { Hash, Layers, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import type { RowData, WorkspaceTableConfig } from "@/app/data-input/_workspace/types";
import { SPACE_GRID } from "../core/space-tokens";

interface Props {
    rowCount: number;
    totalRowCount: number;
    selectedCount: number;
    colCount?: number;
    config?: WorkspaceTableConfig;
    table?: Table<RowData>;
}

const LEVEL_LABEL: Record<number, string> = {
    1: "UPT",
    2: "ULTG",
    3: "Gardu Induk",
    4: "Bay",
};

export function SpaceStatusBar({ rowCount, totalRowCount, selectedCount, colCount, config, table }: Props) {
    const filtered = rowCount !== totalRowCount;

    return (
        <div
            className="shrink-0 flex items-center gap-3 px-3 border-t border-border/60 bg-card/30 text-xs"
            style={{ height: SPACE_GRID.STATUS_HEIGHT_PX }}
        >
            {/* Row count (filtered or total) */}
            <Stat icon={Hash} label="baris">
                {filtered ? (
                    <>
                        <span className="text-primary tabular-nums">{rowCount.toLocaleString()}</span>
                        <span className="opacity-40 mx-0.5">/</span>
                        <span className="tabular-nums">{totalRowCount.toLocaleString()}</span>
                    </>
                ) : (
                    <span className="tabular-nums">{rowCount.toLocaleString()}</span>
                )}
            </Stat>

            {colCount !== undefined && (
                <>
                    <Sep />
                    <Stat icon={Layers} label="kolom">
                        <span className="tabular-nums">{colCount}</span>
                    </Stat>
                </>
            )}

            {config?.primaryKey && (
                <>
                    <Sep />
                    <Stat label="PK">
                        <span className="font-mono">{config.primaryKey}</span>
                    </Stat>
                </>
            )}

            {config?.level && LEVEL_LABEL[config.level] && (
                <>
                    <Sep />
                    <Stat label="level">{LEVEL_LABEL[config.level]}</Stat>
                </>
            )}

            {config?.category && (
                <>
                    <Sep />
                    <Stat label="jenis">{config.category}</Stat>
                </>
            )}

            {selectedCount > 0 && (
                <>
                    <Sep />
                    <span className="text-primary tabular-nums whitespace-nowrap">
                        {selectedCount} dipilih
                    </span>
                </>
            )}

            <div className="flex-1" />

            {table && table.getPageCount() > 1 && <PaginationControls table={table} />}
        </div>
    );
}

function Stat({
    icon: Icon, label, children,
}: {
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
            {Icon && <Icon className="h-3 w-3 opacity-50" />}
            <span className="opacity-50 uppercase tracking-wider text-[10px]">{label}</span>
            <span className="text-foreground/80">{children}</span>
        </span>
    );
}

function Sep() {
    return <span className="opacity-20">·</span>;
}

function PaginationControls({ table }: { table: Table<RowData> }) {
    const pageIndex = table.getState().pagination.pageIndex;
    const pageCount = table.getPageCount();
    const pageSize = table.getState().pagination.pageSize;
    const btn = "ds-interactive ds-press ds-focus rounded h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed";

    return (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <select
                value={pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="text-[11px] bg-transparent border border-border/50 rounded px-1 py-0 h-6 outline-none focus:border-primary/60"
                title="Baris per halaman"
            >
                {[100, 500, 1000, 5000, 100000].map((n) => (
                    <option key={n} value={n}>{n >= 100000 ? "Semua" : `${n}/halaman`}</option>
                ))}
            </select>
            <button type="button" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} className={btn} aria-label="Halaman pertama">
                <ChevronsLeft className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className={btn} aria-label="Sebelumnya">
                <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="tabular-nums opacity-70 px-1 select-none">
                {pageIndex + 1} <span className="opacity-40">dari</span> {pageCount}
            </span>
            <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className={btn} aria-label="Berikutnya">
                <ChevronRight className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()} className={btn} aria-label="Halaman terakhir">
                <ChevronsRight className="h-3 w-3" />
            </button>
        </div>
    );
}
