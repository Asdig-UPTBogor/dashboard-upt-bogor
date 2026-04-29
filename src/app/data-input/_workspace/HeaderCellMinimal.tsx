"use client";

/**
 * HeaderCellMinimal — grid header cell component (generic, props-driven).
 *
 * Layout: [title] [*] [↗ ancestor] [🔗 reference] | [sort ind] [filter ind] [chevron]
 *  ▸ Markers nempel title dalam inner flex (tetap adjacent kalau truncated)
 *  ▸ Status indicators (sort/filter) muncul HANYA kalau fitur aktif
 *  ▸ Chevron visible subtle default, bold on hover, rotate 180° saat menu open
 *  ▸ Click chevron → onOpenMenu callback (parent buka ColumnHeaderPopover)
 */

import type { SortColumn } from "react-data-grid";
import {
    ArrowUp, ArrowDown, ChevronDown, Link2, Filter as FilterIcon,
} from "lucide-react";

export interface HeaderCellMinimalProps {
    title: string;
    description?: string;
    required?: boolean;
    /** Virtual ancestor column (auto-resolved from _ancestors map) */
    ancestorHint?: boolean;
    /** REFERENCE-type column (FK dropdown to another Master table) */
    isReference?: boolean;
    sort: SortColumn | undefined;
    hasFilter: boolean;
    /** Menu untuk kolom ini sedang terbuka? chevron akan rotate 180°. */
    menuOpen?: boolean;
    onOpenMenu: (el: HTMLElement) => void;
}

export function HeaderCellMinimal({
    title, description, required, ancestorHint, isReference,
    sort, hasFilter, menuOpen, onOpenMenu,
}: HeaderCellMinimalProps) {
    const SortArrowIcon = sort ? (sort.direction === "ASC" ? ArrowUp : ArrowDown) : null;
    const tooltipParts = [description ?? title];
    if (required) tooltipParts.push("Required (NOT NULL)");
    if (ancestorHint) tooltipParts.push("Auto-resolved from parent FK chain");
    if (isReference) tooltipParts.push("References another Master table");
    const tooltip = tooltipParts.join(" · ");

    return (
        <div
            className="group/hdr flex items-center gap-1.5 overflow-hidden h-full w-full px-2 cursor-grab active:cursor-grabbing"
            title={tooltip}
        >
            <div className="flex items-center gap-1 min-w-0 flex-1">
                <span className="font-medium truncate">{title}</span>
                {required && (
                    <span
                        className="text-destructive text-[10px] shrink-0 leading-none font-bold"
                        title="Required (NOT NULL) — wajib diisi"
                    >*</span>
                )}
                {ancestorHint && (
                    <Link2
                        className="h-3 w-3 text-primary/70 shrink-0"
                        strokeWidth={2.25}
                        aria-label="Auto-resolved ancestor"
                    />
                )}
                {isReference && !ancestorHint && (
                    <Link2
                        className="h-3 w-3 text-sky-400/70 shrink-0"
                        strokeWidth={2.25}
                        aria-label="Reference column"
                    />
                )}
            </div>
            {SortArrowIcon && (
                <SortArrowIcon
                    className="h-3 w-3 text-primary shrink-0"
                    strokeWidth={2.5}
                    aria-label={sort!.direction === "ASC" ? "Sorted ascending" : "Sorted descending"}
                />
            )}
            {hasFilter && (
                <FilterIcon
                    className="h-3 w-3 text-primary shrink-0"
                    strokeWidth={2.5}
                    aria-label="Filter active"
                />
            )}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenMenu(e.currentTarget);
                }}
                title="Column options"
                aria-label={`Column options for ${title}`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`ds-transition shrink-0 rounded-md p-1 flex items-center justify-center
                    ${menuOpen
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground opacity-50 hover:opacity-100 hover:bg-foreground/10 hover:text-foreground group-hover/hdr:opacity-80"}`}
            >
                <ChevronDown
                    className={`h-3.5 w-3.5 ds-transition ${menuOpen ? "rotate-180" : "rotate-0"}`}
                    strokeWidth={2.25}
                />
            </button>
        </div>
    );
}
