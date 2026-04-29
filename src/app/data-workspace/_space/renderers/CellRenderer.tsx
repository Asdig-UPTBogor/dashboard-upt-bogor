"use client";

/**
 * CellRenderer — display value berdasarkan editor type.
 *
 * Read-only render. Edit mode delegated ke EditorRouter.
 * Setiap type punya formatting natif:
 *  - NUMBER → tabular-nums right-align
 *  - DATE → ISO format
 *  - BOOL → ✓ / ─
 *  - CHOICE → colored badge
 *  - REFERENCE → display name (auto-lookup ke master table via useReferenceCache)
 *  - FILE → filename + icon
 *  - URL → clickable link
 */

import { ExternalLink, Check, Minus, FileIcon, Loader2 } from "lucide-react";
import type { CellContext } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";
import { useReferenceLookup } from "../features/useReferenceCache";

type Ctx = CellContext<RowData, unknown>;

export function CellRenderer(ctx: Ctx) {
    const value = ctx.getValue();
    const meta = ctx.column.columnDef.meta;
    if (!meta) return formatPlain(value);

    // Custom formatter wins.
    if (meta.formatter) return meta.formatter(value, ctx.row.original);

    switch (meta.editor) {
        case "NUMBER":
        case "FLOAT":
            return <NumberCell value={value} />;
        case "DATE":
            return <DateCell value={value} />;
        case "TIMESTAMP":
            return <TimestampCell value={value} />;
        case "BOOL":
            return <BoolCell value={value} />;
        case "CHOICE":
            return <ChoiceCell value={value} choices={meta.choices} />;
        case "MULTI_SELECT":
            return <MultiSelectCell value={value} choices={meta.choices} />;
        case "URL":
            return <UrlCell value={value} />;
        case "FILE":
            return <FileCell value={value} />;
        case "REFERENCE":
            return <ReferenceCell value={value} reference={meta.reference} />;
        default:
            return <TextCell value={value} />;
    }
}

/* ─── Formatters per type ─────────────────────────────────────────── */

function formatPlain(v: unknown): React.ReactNode {
    if (v === null || v === undefined || v === "") return <Empty />;
    return String(v);
}

function Empty() {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
}

function TextCell({ value }: { value: unknown }) {
    if (value === null || value === undefined || value === "") return <Empty />;
    return <span className="truncate">{String(value)}</span>;
}

function NumberCell({ value }: { value: unknown }) {
    if (value === null || value === undefined || value === "") return <Empty />;
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return <span className="text-destructive">{String(value)}</span>;
    return <span className="tabular-nums font-mono text-right block w-full">{n.toLocaleString()}</span>;
}

function DateCell({ value }: { value: unknown }) {
    if (!value) return <Empty />;
    const s = String(value);
    return <span className="tabular-nums font-mono text-xs">{s.slice(0, 10)}</span>;
}

function TimestampCell({ value }: { value: unknown }) {
    if (!value) return <Empty />;
    const s = String(value);
    // ISO 2026-04-25T05:14:32.000Z → 2026-04-25 12:14:32 (display only; tz is approximate)
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    return (
        <span className="tabular-nums font-mono text-xs">
            {m ? `${m[1]} ${m[2]}` : s.slice(0, 19)}
        </span>
    );
}

function BoolCell({ value }: { value: unknown }) {
    if (value === null || value === undefined || value === "") return <Empty />;
    const truthy = value === true || value === "true" || value === 1 || value === "1";
    return truthy
        ? <Check className="h-3.5 w-3.5 text-primary" />
        : <Minus className="h-3.5 w-3.5 opacity-30" />;
}

function ChoiceCell({
    value, choices,
}: {
    value: unknown;
    choices?: ReadonlyArray<{ value: string; label: string; color?: string }>;
}) {
    if (value === null || value === undefined || value === "") return <Empty />;
    const v = String(value);
    const opt = choices?.find((c) => c.value === v);
    if (!opt) return <span className="text-xs">{v}</span>;
    const color = opt.color ?? "currentColor";
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] border"
            style={{
                color,
                borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
                backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
            }}
        >
            {opt.label}
        </span>
    );
}

function MultiSelectCell({
    value, choices,
}: {
    value: unknown;
    choices?: ReadonlyArray<{ value: string; label: string; color?: string }>;
}) {
    if (value === null || value === undefined || value === "") return <Empty />;
    const arr: string[] = Array.isArray(value)
        ? value.map(String)
        : typeof value === "string" && value.startsWith("[")
            ? (() => { try { const p = JSON.parse(value); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } })()
            : String(value).split(",").map((s) => s.trim()).filter(Boolean);
    if (arr.length === 0) return <Empty />;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {arr.map((v) => {
                const opt = choices?.find((c) => c.value === v);
                if (!opt) return (
                    <span key={v} className="font-mono text-amber-600 dark:text-amber-500 text-[11px]" title={`Tidak ditemukan: ${v}`}>
                        {v}
                    </span>
                );
                const color = opt.color ?? "currentColor";
                return (
                    <span
                        key={v}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] border"
                        style={{
                            color,
                            borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
                            backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
                        }}
                    >
                        {opt.label}
                    </span>
                );
            })}
        </span>
    );
}

function UrlCell({ value }: { value: unknown }) {
    if (!value) return <Empty />;
    const s = String(value);
    return (
        <a
            href={s}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
        >
            <span className="truncate">{s}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
        </a>
    );
}

function FileCell({ value }: { value: unknown }) {
    if (!value) return <Empty />;
    const s = String(value);
    const name = s.split("/").pop() ?? s;
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <FileIcon className="h-3 w-3 opacity-60 shrink-0" />
            <span className="truncate">{name}</span>
        </span>
    );
}

function ReferenceCell({
    value, reference,
}: {
    value: unknown;
    reference?: { dataset: string; table: string; displayCol: string; valueCol: string };
}) {
    const { lookup, loading, error } = useReferenceLookup(reference);
    if (!value || value === "") return <Empty />;
    const id = String(value);
    const label = lookup(value);
    if (label) {
        return (
            <span
                className="inline-flex items-center gap-1 truncate"
                title={`${label} (${id})`}
            >
                <span className="truncate text-foreground">{label}</span>
            </span>
        );
    }
    if (loading) {
        return (
            <span className="inline-flex items-center gap-1 text-muted-foreground/60" title={id}>
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                <span className="font-mono text-[10px] truncate">{id.slice(0, 8)}…</span>
            </span>
        );
    }
    // Lookup miss (master row hilang / ID typo) — fallback ID dengan warning style
    return (
        <span
            className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500"
            title={error ?? `Reference not found in master ${reference?.table}: ${id}`}
        >
            <span className="font-mono text-xs truncate">{id}</span>
            <span className="text-[10px] opacity-60">⚠</span>
        </span>
    );
}
