"use client";

/**
 * DropdownCell — spreadsheet-style dropdown cell.
 *
 * Pattern (one shared component untuk CHOICE / CHOICE_CASCADE / REFERENCE):
 *  · Cell SELALU render sebagai card trigger (value + chevron) — value ga hilang
 *    walau popover open.
 *  · Trigger pakai shadcn Popover (Radix) — auto positioning + collision detect.
 *  · Content pakai shadcn Command (cmdk) — searchable list dengan keyboard nav
 *    bawaan (↑↓ pilih, Enter konfirmasi, Esc tutup, Cmd-K filter).
 *  · "(kosong)" item paling atas untuk clear value.
 *  · Loading / error state inline di list.
 *
 * Visual: ikut theme dashboard via `ds-transition`, `bg-card`, `border-border`,
 * `bg-primary/5` saat open. Tidak ada hardcode warna.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface DropdownOption {
    value: string;
    label: string;
    color?: string;
}

interface Props {
    value: string | null | undefined;
    options: ReadonlyArray<DropdownOption>;
    onCommit: (next: string | null) => void;
    placeholder?: string;
    /** Show colored dot prefix (CHOICE / CHOICE_CASCADE). REFERENCE: false. */
    showColor?: boolean;
    /** Auto-open popover on first render (saat user "enter edit"). */
    autoOpen?: boolean;
    /** Dipanggil saat popover ditutup (untuk lift edit state ke parent). */
    onClose?: () => void;
    /** Cell read-only — render trigger biasa tanpa popover. */
    disabled?: boolean;
    /** Disable + tampilkan hint text (e.g. "Isi kolom parent dulu" for CASCADE). */
    disabledHint?: string;
    loading?: boolean;
    error?: string | null;
    /** Footer source label (e.g. `Master_Data.Bay`). */
    sourceLabel?: string;
    /** Style number/text alignment. Default left. */
    align?: "start" | "center" | "end";
    /** E10 quick-add: kalau di-set, popover render item "+ Tambah pilihan baru: {query}"
     *  saat search ga ketemu match. Handler responsible append ke options + commit value.
     *  Hanya untuk CHOICE — REFERENCE source ga bisa di-mutate dari sini. */
    onAddOption?: (label: string) => Promise<void> | void;
}

export function DropdownCell({
    value, options, onCommit,
    placeholder = "Pilih...",
    showColor = false,
    autoOpen = false, onClose,
    disabled = false, disabledHint,
    loading = false, error = null,
    sourceLabel,
    align = "start",
    onAddOption,
}: Props) {
    const [open, setOpen] = useState(autoOpen);
    const [search, setSearch] = useState("");
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (autoOpen) setOpen(true);
    }, [autoOpen]);

    const cur = value == null ? "" : String(value);
    const selected = useMemo(
        () => options.find((o) => o.value === cur),
        [options, cur],
    );

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) onClose?.();
    };

    const commit = (val: string | null) => {
        onCommit(val);
        setOpen(false);
        onClose?.();
    };

    // Render mode:
    //  · CHOICE (showColor=true) + selected: colored pill badge (border + bg tint + dot)
    //  · REFERENCE (showColor=false) + selected: plain label (no dot, no badge)
    //  · empty: muted placeholder
    //  · cur tidak ditemukan di options: amber font-mono fallback
    const triggerInner = (() => {
        if (selected && showColor) {
            const color = selected.color ?? "var(--muted-foreground)";
            return (
                <span className={cn(
                    "flex-1 min-w-0 flex items-center truncate",
                    align === "center" && "justify-center",
                    align === "end" && "justify-end",
                )}>
                    <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] truncate max-w-full"
                        style={{
                            color,
                            borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
                            backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
                        }}
                    >
                        <span className="truncate">{selected.label}</span>
                    </span>
                </span>
            );
        }
        if (selected) {
            return (
                <span className={cn(
                    "flex-1 min-w-0 flex items-center gap-1.5 truncate",
                    align === "center" && "justify-center",
                    align === "end" && "justify-end",
                )}>
                    <span className="truncate">{selected.label}</span>
                </span>
            );
        }
        if (cur) {
            return (
                <span className="flex-1 min-w-0 flex items-center truncate">
                    <span
                        className="truncate font-mono text-amber-600 dark:text-amber-500"
                        title={`Tidak ditemukan: ${cur}`}
                    >
                        {cur}
                    </span>
                </span>
            );
        }
        return (
            <span className="flex-1 min-w-0 flex items-center truncate">
                <span className="truncate text-muted-foreground/50">{placeholder}</span>
            </span>
        );
    })();

    const triggerClass = cn(
        "h-full w-full flex items-center gap-1.5 px-2 text-xs text-left ds-transition",
        "border-0 bg-transparent",
        !disabled && "hover:bg-muted/30 focus:outline-none cursor-pointer",
        "data-[state=open]:bg-primary/5 data-[state=open]:ring-2 data-[state=open]:ring-primary/40 data-[state=open]:ring-inset",
        disabled && "cursor-not-allowed opacity-70",
    );

    if (disabled) {
        return (
            <div className={triggerClass} title={disabledHint ?? "Read-only"}>
                {triggerInner}
                <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            </div>
        );
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button type="button" className={triggerClass}>
                    {triggerInner}
                    <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
                align="start"
                sideOffset={2}
                onOpenAutoFocus={(e) => {
                    // biar input search yang fokus, bukan trigger
                    e.preventDefault();
                }}
            >
                <Command shouldFilter={!loading}>
                    <CommandInput
                        placeholder="Cari..."
                        className="text-xs"
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Memuat...
                            </div>
                        ) : error ? (
                            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
                        ) : (
                            <>
                                <CommandEmpty className="py-3 text-xs text-center text-muted-foreground italic">
                                    {onAddOption && search.trim() ? (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (adding) return;
                                                setAdding(true);
                                                try { await onAddOption(search.trim()); setSearch(""); }
                                                finally { setAdding(false); }
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-primary hover:bg-primary/10 ds-transition not-italic"
                                        >
                                            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                            Tambah pilihan baru: <span className="font-medium">&quot;{search.trim()}&quot;</span>
                                        </button>
                                    ) : (
                                        <>Tidak ada hasil cocok.</>
                                    )}
                                </CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        value="__kosong__"
                                        onSelect={() => commit(null)}
                                        className="text-xs italic text-muted-foreground"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-muted/60 shrink-0" />
                                        <span className="flex-1">(kosong)</span>
                                        <Check className={cn(
                                            "h-3 w-3 shrink-0",
                                            cur === "" ? "opacity-100 text-primary" : "opacity-0",
                                        )} />
                                    </CommandItem>
                                    {options.map((opt) => {
                                        const optColor = opt.color ?? "var(--muted-foreground)";
                                        return (
                                            <CommandItem
                                                key={opt.value}
                                                value={`${opt.label} ${opt.value}`}
                                                onSelect={() => commit(opt.value)}
                                                className="text-xs"
                                            >
                                                {showColor ? (
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
                                                ) : (
                                                    <span className="flex-1 truncate">{opt.label}</span>
                                                )}
                                                {showColor && <span className="flex-1" />}
                                                <Check className={cn(
                                                    "h-3 w-3 shrink-0",
                                                    cur === opt.value ? "opacity-100 text-primary" : "opacity-0",
                                                )} />
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                    {sourceLabel && !loading && !error && (
                        <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground font-mono truncate">
                            {sourceLabel}
                        </div>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
}
