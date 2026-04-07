/**
 * HiDataTable — Full data table for Healthy Index rows.
 *
 * Features:
 *  - Global search (syncs with cross-filter search)
 *  - Per-column dropdown filters (MTU, ULTG, GI, Status HI, Prioritas, Status Usia, Criticality, Merek)
 *  - Sortable columns (click header = toggle asc/desc)
 *  - Pagination (50 per page)
 *  - Color-coded Status HI + Prioritas badges
 *  - Default sort: Nilai HI descending
 */
"use client";

import { memo, useMemo, useState, useCallback, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCrossFilter } from "./CrossFilterProvider";
import { COLORS, STATUS_HI_ORDER, LAYOUT } from "./design-tokens";
import type { HiRow, HiStats } from "./useHealthyIndexData";

/* ── Table column definition ── */
interface ColDef {
    key: keyof HiRow;
    label: string;
    /** If set, render a dropdown filter using allStats unique values */
    filterKey?: keyof HiStats;
    /** Cross-filter key name (matches CrossFilterState) */
    crossKey?: string;
    sortable?: boolean;
    badge?: boolean;
    align?: "left" | "right" | "center";
    width?: string;
}

const COLUMNS: ColDef[] = [
    { key: "mtu",            label: "MTU",          filterKey: "uniqueMtu",        crossKey: "mtu",        sortable: true },
    { key: "ultg",           label: "ULTG",         filterKey: "uniqueUltg",       crossKey: "ultg",       sortable: true },
    { key: "gi",             label: "Gardu Induk",  filterKey: "uniqueGi",         crossKey: "gi",         sortable: true },
    { key: "bay",            label: "Bay",          sortable: true },
    { key: "phasa",          label: "Phasa",        sortable: true },
    { key: "tegangan",       label: "Tegangan/MVA", sortable: true },
    { key: "merek",          label: "Merek",        sortable: true },
    { key: "tipe",           label: "Tipe",         sortable: true },
    { key: "serialId",       label: "Serial ID",    sortable: true },
    { key: "tahunBuat",      label: "Thn Buat",     sortable: true, align: "center" },
    { key: "tahunOperasi",   label: "Thn Operasi",  sortable: true, align: "center" },
    { key: "criticalityGi",  label: "Criticality",  filterKey: "uniqueCriticality", crossKey: "criticality", sortable: true, badge: true },
    { key: "prioritas",      label: "Prioritas",    filterKey: "uniquePrioritas",  crossKey: "prioritas",  sortable: true, badge: true },
    { key: "justifikasi",    label: "Justifikasi",  sortable: false },
    { key: "statusUsia",     label: "Status Usia",  filterKey: "uniqueStatusUsia", crossKey: "statusUsia", sortable: true, badge: true },
    { key: "rencana",        label: "Rencana",      sortable: false },
    { key: "statusHi",       label: "Status HI",    filterKey: "uniqueStatusHi",   crossKey: "statusHi",   sortable: true, badge: true },
    { key: "nilaiHi",        label: "Nilai HI",     sortable: true, align: "right" },
];

type SortDir = "asc" | "desc" | null;

interface Props {
    filteredRows: HiRow[];
    allStats: HiStats;
}

function HiDataTableInner({ filteredRows, allStats }: Props) {
    const { filters, toggle, setSearch } = useCrossFilter();

    // Sort state — default: nilaiHi desc
    const [sortKey, setSortKey] = useState<keyof HiRow>("nilaiHi");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    // Pagination
    const [page, setPage] = useState(0);
    const pageSize = LAYOUT.pageSize;

    // Toggle sort
    const handleSort = useCallback((key: keyof HiRow) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
        setPage(0);
    }, [sortKey]);

    // Sorted rows
    const sorted = useMemo(() => {
        if (!sortDir) return filteredRows;
        const data = [...filteredRows];
        data.sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            if (typeof va === "number" && typeof vb === "number") {
                return sortDir === "asc" ? va - vb : vb - va;
            }
            const sa = String(va || "");
            const sb = String(vb || "");
            return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
        return data;
    }, [filteredRows, sortKey, sortDir]);

    // Paginated view
    const totalPages = Math.ceil(sorted.length / pageSize);
    const paged = useMemo(
        () => sorted.slice(page * pageSize, (page + 1) * pageSize),
        [sorted, page, pageSize],
    );

    // Reset page if past total
    useEffect(() => {
        if (page > 0 && page >= totalPages) setPage(Math.max(0, totalPages - 1));
    }, [page, totalPages]);

    // Badge color helper
    const badgeColor = (col: ColDef, value: string): string | undefined => {
        if (col.key === "statusHi") return COLORS.statusHi[value];
        if (col.key === "prioritas") return COLORS.prioritas[value];
        if (col.key === "statusUsia") return COLORS.statusUsia[value];
        if (col.key === "criticalityGi") return COLORS.criticality[value];
        return undefined;
    };

    // Sort icon per column
    const SortIcon = ({ col }: { col: ColDef }) => {
        if (!col.sortable) return null;
        if (sortKey === col.key && sortDir === "asc") return <ChevronUp className="inline h-3 w-3" />;
        if (sortKey === col.key && sortDir === "desc") return <ChevronDown className="inline h-3 w-3" />;
        return <ChevronsUpDown className="inline h-3 w-3 opacity-30" />;
    };

    return (
        <Card className="border-border/30 rounded-sm py-0 gap-0">
            <CardHeader className="px-3 py-2 pb-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-xs font-semibold">
                        Data Detail ({sorted.length.toLocaleString()} rows)
                    </CardTitle>

                    {/* Global search */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Cari GI, Bay, Merek, Tipe..."
                            className="h-8 pl-7 pr-7 text-xs"
                            value={filters.search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(0);
                            }}
                        />
                        {filters.search && (
                            <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setSearch("")}
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Per-column dropdown filters */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {COLUMNS.filter((c) => c.filterKey && c.crossKey).map((col) => {
                        const options = (allStats[col.filterKey!] as string[]) || [];
                        const key = col.crossKey as "mtu" | "ultg" | "gi" | "statusHi" | "prioritas" | "statusUsia" | "criticality";
                        const active = filters[key] as string;
                        return (
                            <Select
                                key={col.key}
                                value={active || "__all__"}
                                onValueChange={(v) => {
                                    if (v === "__all__") {
                                        if (active) toggle(key, active);
                                    } else {
                                        toggle(key, v);
                                    }
                                    setPage(0);
                                }}
                            >
                                <SelectTrigger className="h-7 w-auto min-w-22.5 gap-1 border-border/40 text-[10px]">
                                    <SelectValue placeholder={col.label} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All {col.label}</SelectItem>
                                    {options.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                            {opt}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        );
                    })}
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10 text-center text-[10px]">#</TableHead>
                                {COLUMNS.map((col) => (
                                    <TableHead
                                        key={col.key}
                                        className={`whitespace-nowrap text-[10px] ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.sortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                                        onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                    >
                                        {col.label} <SortIcon col={col} />
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={COLUMNS.length + 1} className="h-24 text-center text-xs text-muted-foreground">
                                        Tidak ada data yang cocok.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paged.map((row, i) => (
                                    <TableRow key={`${row.gi}-${row.bay}-${row.mtu}-${row.phasa}-${i}`} className="h-8">
                                        <TableCell className="text-center text-[10px] text-muted-foreground">
                                            {page * pageSize + i + 1}
                                        </TableCell>
                                        {COLUMNS.map((col) => {
                                            const val = String(row[col.key] ?? "");
                                            const color = col.badge ? badgeColor(col, val) : undefined;
                                            return (
                                                <TableCell
                                                    key={col.key}
                                                    className={`whitespace-nowrap text-xs ${col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : ""}`}
                                                >
                                                    {color ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[9px] font-medium"
                                                            style={{
                                                                borderColor: color,
                                                                color: color,
                                                                backgroundColor: `${color}15`,
                                                            }}
                                                        >
                                                            {val}
                                                        </Badge>
                                                    ) : col.key === "nilaiHi" ? (
                                                        (row.nilaiHi || 0).toFixed(2)
                                                    ) : (
                                                        val
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border/30 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">
                            Hal {page + 1} dari {totalPages} ({sorted.length.toLocaleString()} rows)
                        </span>
                        <div className="flex gap-1">
                            <button
                                className="rounded border border-border/40 px-2 py-0.5 text-[10px] disabled:opacity-30"
                                disabled={page === 0}
                                onClick={() => setPage(0)}
                            >
                                &laquo;
                            </button>
                            <button
                                className="rounded border border-border/40 px-2 py-0.5 text-[10px] disabled:opacity-30"
                                disabled={page === 0}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                &lsaquo; Prev
                            </button>
                            <button
                                className="rounded border border-border/40 px-2 py-0.5 text-[10px] disabled:opacity-30"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next &rsaquo;
                            </button>
                            <button
                                className="rounded border border-border/40 px-2 py-0.5 text-[10px] disabled:opacity-30"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(totalPages - 1)}
                            >
                                &raquo;
                            </button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const HiDataTable = memo(HiDataTableInner);
