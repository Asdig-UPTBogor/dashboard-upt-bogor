"use client";

/**
 * MultiSelectEditor — multi-pick popover di atas shadcn `Popover` + `Command`.
 *
 * Storage: array of value strings (BQ REPEATED atau JSON-encoded string).
 * Display di cell: pill chip per value, dengan label dari choices.
 *
 * UX:
 *  - Trigger ialah cell (always-visible card) — render via DropdownCell-like
 *    wrapper. MultiSelect render sendiri popover karena commit pakai array
 *    bukan single value.
 *  - Popover: search + checkbox list. Toggle pilih. Tutup popover = commit.
 */

import { useEffect, useState, useMemo } from "react";
import { Check, ChevronsUpDown, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import type { CellEditorProps } from "./types";

export function MultiSelectEditor({
    value, onCommit, onCancel, columnMeta, autoFocus = true,
}: CellEditorProps) {
    const choices = columnMeta?.choices ?? [];
    const initial = Array.isArray(value) ? value.map(String) : [];
    const [selected, setSelected] = useState<string[]>(initial);
    const [open, setOpen] = useState(autoFocus);

    useEffect(() => {
        if (autoFocus) setOpen(true);
    }, [autoFocus]);

    const selectedSet = useMemo(() => new Set(selected), [selected]);

    const toggle = (v: string) => {
        setSelected((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
    };

    const removeOne = (v: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelected((prev) => prev.filter((x) => x !== v));
    };

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            // Commit on close — beda dengan single-select yg commit per pick.
            onCommit(selected.length === 0 ? null : selected);
            onCancel(); // exit edit mode
        }
    };

    const triggerInner = selected.length === 0 ? (
        <span className="truncate text-muted-foreground/50">Pilih beberapa...</span>
    ) : (
        <span className="flex-1 min-w-0 flex flex-wrap items-center gap-1 truncate">
            {selected.map((v) => {
                const opt = choices.find((c) => c.value === v);
                if (!opt) return (
                    <span key={v} className="font-mono text-amber-600 dark:text-amber-500 text-[11px]" title={`Tidak ditemukan: ${v}`}>
                        {v}
                    </span>
                );
                const color = opt.color ?? "var(--muted-foreground)";
                return (
                    <span
                        key={v}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] truncate"
                        style={{
                            color,
                            borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
                            backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
                        }}
                    >
                        <span className="truncate">{opt.label}</span>
                        <button
                            type="button"
                            onMouseDown={(e) => removeOne(v, e)}
                            className="opacity-60 hover:opacity-100"
                            aria-label={`Hapus ${opt.label}`}
                        >
                            <XIcon className="h-2.5 w-2.5" />
                        </button>
                    </span>
                );
            })}
        </span>
    );

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "h-full w-full flex items-center gap-1.5 px-2 text-xs text-left ds-transition",
                        "border-0 bg-transparent hover:bg-muted/30 focus:outline-none cursor-pointer",
                        "data-[state=open]:bg-primary/5 data-[state=open]:ring-2 data-[state=open]:ring-primary/40 data-[state=open]:ring-inset",
                    )}
                >
                    {triggerInner}
                    <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
                align="start"
                sideOffset={2}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <Command>
                    <CommandInput placeholder="Cari..." className="text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-3 text-xs text-center text-muted-foreground italic">
                            Tidak ada hasil cocok.
                        </CommandEmpty>
                        <CommandGroup>
                            {choices.map((opt) => {
                                const checked = selectedSet.has(opt.value);
                                const optColor = opt.color ?? "var(--muted-foreground)";
                                return (
                                    <CommandItem
                                        key={opt.value}
                                        value={`${opt.label} ${opt.value}`}
                                        onSelect={() => toggle(opt.value)}
                                        className="text-xs"
                                    >
                                        <span
                                            className={cn(
                                                "h-3.5 w-3.5 rounded border inline-flex items-center justify-center shrink-0",
                                                checked ? "border-primary bg-primary/20" : "border-border/60",
                                            )}
                                        >
                                            {checked && <Check className="h-2.5 w-2.5 text-primary" />}
                                        </span>
                                        <span
                                            className="inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] truncate"
                                            style={{
                                                color: optColor,
                                                borderColor: `color-mix(in oklch, ${optColor} 40%, transparent)`,
                                                backgroundColor: `color-mix(in oklch, ${optColor} 12%, transparent)`,
                                            }}
                                        >
                                            <span className="truncate">{opt.label}</span>
                                        </span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                    <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>{selected.length} dipilih</span>
                        <span className="opacity-60">Klik untuk toggle · klik luar untuk simpan</span>
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
