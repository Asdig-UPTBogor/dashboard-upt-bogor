"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { COLORS } from "./shared";

export interface DataTableColumn {
    /** Column key in the data */
    key: string;
    /** Display header label */
    label: string;
    /** Is this column only visible when "show all" is toggled? */
    expandOnly?: boolean;
    /** Max width CSS class (e.g. "max-w-[140px]") */
    maxWidth?: string;
    /** Render as clickable badge that triggers onCellClick */
    clickable?: boolean;
    /** Render as colored status badge */
    statusColors?: Record<string, string>;
    /** Use monospace font */
    mono?: boolean;
    /** Bold text */
    bold?: boolean;
}

export interface DataTableWidgetProps {
    /** Title displayed in card header */
    title: string;
    /** Lucide icon for the header */
    icon?: LucideIcon;
    /** Row data array */
    data: Record<string, unknown>[];
    /** Column definitions */
    columns: DataTableColumn[];
    /** Items per page (default: 25) */
    pageSize?: number;
    /** Show row numbers (default: true) */
    showRowNumbers?: boolean;
    /** Called when a clickable cell is clicked */
    onCellClick?: (column: string, value: string) => void;
}

export function DataTableWidget({
    title,
    icon: Icon,
    data,
    columns,
    pageSize = 25,
    showRowNumbers = true,
    onCellClick,
}: DataTableWidgetProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [showAllColumns, setShowAllColumns] = useState(false);

    const totalPages = Math.ceil(data.length / pageSize);
    const paginatedData = useMemo(
        () => data.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [data, currentPage, pageSize]
    );

    const visibleColumns = useMemo(
        () => (showAllColumns ? columns : columns.filter((c) => !c.expandOnly)),
        [columns, showAllColumns]
    );

    const hasExpandColumns = columns.some((c) => c.expandOnly);

    const renderCell = (row: Record<string, unknown>, col: DataTableColumn) => {
        const value = String(row[col.key] || "—");

        if (col.clickable && onCellClick) {
            return (
                <Badge
                    variant="outline"
                    className="text-xs cursor-pointer"
                    onClick={() => onCellClick(col.key, value)}
                >
                    {value}
                </Badge>
            );
        }

        if (col.statusColors) {
            const color = col.statusColors[value] || COLORS.amber;
            return (
                <Badge
                    className="text-xs"
                    style={{ backgroundColor: `${color}20`, color }}
                >
                    {value}
                </Badge>
            );
        }

        return (
            <span
                className={`text-xs ${col.mono ? "font-mono" : ""} ${col.bold ? "font-medium" : ""} ${col.maxWidth ? `${col.maxWidth} truncate block` : ""}`}
                title={col.maxWidth ? value : undefined}
            >
                {value}
            </span>
        );
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4 text-primary" />}
                        {title}
                        <Badge variant="secondary" className="text-xs">
                            {data.length.toLocaleString()} baris
                        </Badge>
                    </CardTitle>
                    {hasExpandColumns && (
                        <button
                            onClick={() => setShowAllColumns(!showAllColumns)}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted transition-colors"
                        >
                            {showAllColumns ? (
                                <ChevronUp className="h-3 w-3" />
                            ) : (
                                <ChevronDown className="h-3 w-3" />
                            )}
                            {showAllColumns ? "Kolom Ringkas" : "Semua Kolom"}
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {showRowNumbers && (
                                    <TableHead className="w-10">No</TableHead>
                                )}
                                {visibleColumns.map((col) => (
                                    <TableHead key={col.key}>{col.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.map((row, i) => (
                                <TableRow
                                    key={i}
                                    className="hover:bg-muted/50 transition-colors"
                                >
                                    {showRowNumbers && (
                                        <TableCell className="text-muted-foreground text-xs">
                                            {(currentPage - 1) * pageSize + i + 1}
                                        </TableCell>
                                    )}
                                    {visibleColumns.map((col) => (
                                        <TableCell key={col.key}>
                                            {renderCell(row, col)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground">
                            Halaman {currentPage} dari {totalPages} ·{" "}
                            {data.length.toLocaleString()} baris
                        </p>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs rounded border hover:bg-muted disabled:opacity-50 transition-colors"
                            >
                                ← Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const page =
                                    currentPage <= 3
                                        ? i + 1
                                        : currentPage >= totalPages - 2
                                            ? totalPages - 4 + i
                                            : currentPage - 2 + i;
                                if (page < 1 || page > totalPages) return null;
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`px-3 py-1 text-xs rounded border transition-colors ${currentPage === page
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-muted"
                                            }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() =>
                                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                                }
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs rounded border hover:bg-muted disabled:opacity-50 transition-colors"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
