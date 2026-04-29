/**
 * useSpaceColumns — convert ColumnMeta[] (BQ schema + Firestore overlay)
 * → TanStack ColumnDef[] dengan meta yang fully typed.
 *
 * Logika:
 *  1. Map BQ type → editor type (STRING→TEXT, INT64→NUMBER, etc).
 *  2. App-level type (CHOICE/REFERENCE/CASCADE/FILE) override.
 *  3. Inject schema reference ke meta.schema (untuk lookup downstream).
 *  4. Apply order (Firestore overlay) untuk sort kolom.
 *  5. Apply hidden/pin dari overlay.
 *
 * Tidak handle: data fetch, state, render — pure data transform.
 */

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ColumnMeta as ColumnSchema, RowData, ColumnType } from "@/app/data-input/_workspace/types";
import { spaceColumnFilter } from "../features/useColumnFilter";

/** Editor type yang valid di TanStack columnMeta.editor. */
type EditorType =
    | "TEXT" | "NUMBER" | "FLOAT" | "DATE" | "TIMESTAMP" | "BOOL"
    | "CHOICE" | "CHOICE_CASCADE" | "REFERENCE" | "MULTI_SELECT"
    | "RICH_TEXT" | "URL" | "FILE";

const VALID_EDITORS: ReadonlySet<string> = new Set([
    "TEXT", "NUMBER", "FLOAT", "DATE", "TIMESTAMP", "BOOL",
    "CHOICE", "CHOICE_CASCADE", "REFERENCE", "MULTI_SELECT",
    "RICH_TEXT", "URL", "FILE",
]);
function isValidEditor(s: string): s is EditorType {
    return VALID_EDITORS.has(s);
}

/** Map BQ + app type → editor type. */
export function resolveEditor(type: ColumnType): EditorType {
    switch (type) {
        case "STRING": return "TEXT";
        case "INT64":
        case "NUMERIC": return "NUMBER";
        case "FLOAT64": return "FLOAT";
        case "DATE": return "DATE";
        case "TIMESTAMP": return "TIMESTAMP";
        case "BOOL": return "BOOL";
        case "JSON":
        case "BYTES":
        case "GEOGRAPHY": return "TEXT"; // fallback display
        case "CHOICE": return "CHOICE";
        case "CHOICE_CASCADE": return "CHOICE_CASCADE";
        case "REFERENCE": return "REFERENCE";
        case "FILE": return "FILE";
        case "RICH_TEXT": return "RICH_TEXT";
        case "URL": return "URL";
        default: return "TEXT";
    }
}

/** Hasil — TanStack ColumnDef[] siap di-feed ke useReactTable. */
export function useSpaceColumns(schemas: readonly ColumnSchema[]): ColumnDef<RowData>[] {
    return useMemo(() => {
        // Filter hidden + sort by order
        const visible = schemas.filter((c) => !c.hidden);
        const sorted = [...visible].sort((a, b) => {
            const ao = a.order ?? 9999;
            const bo = b.order ?? 9999;
            if (ao !== bo) return ao - bo;
            return a.name.localeCompare(b.name);
        });

        return sorted.map((schema) => {
            // Editor priority: overlay editor (from Firestore) → fallback resolveEditor(type)
            // Bug fix: dulu hanya pakai resolveEditor(type), ignore overlay editor field.
            const editorOverride = (schema as unknown as { editor?: string }).editor;
            const editor = (editorOverride && isValidEditor(editorOverride))
                ? editorOverride
                : resolveEditor(schema.type);
            // Choices: legacy `options` field di ColumnMeta atau modern `choices` field di overlay.
            const choicesOverride = (schema as unknown as { choices?: ReadonlyArray<{ value: string; label: string; color?: string }> }).choices;
            const choices = choicesOverride ?? schema.options;
            const def: ColumnDef<RowData> = {
                id: schema.name,
                accessorKey: schema.name,
                header: schema.alias ?? schema.name,
                size: schema.width ?? undefined,
                enableSorting: true,
                enableHiding: true,
                enableResizing: true,
                enableColumnFilter: true,
                filterFn: spaceColumnFilter,
                meta: {
                    editor: editor as EditorType,
                    choices,
                    cascade: schema.parentColumn && schema.optionsMap
                        ? { parentColumn: schema.parentColumn, mapping: schema.optionsMap }
                        : undefined,
                    reference: schema.reference,
                    required: schema.mode === "REQUIRED",
                    schema,
                },
            };
            return def;
        });
    }, [schemas]);
}

/** Helper — resolve initial pinning state dari schema. */
export function pinningFromSchemas(schemas: readonly ColumnSchema[]): {
    left: string[];
    right: string[];
} {
    const left: string[] = [];
    const right: string[] = [];
    for (const c of schemas) {
        if (c.hidden) continue;
        if (c.pin === "left") left.push(c.name);
        else if (c.pin === "right") right.push(c.name);
    }
    return { left, right };
}

/** Helper — resolve initial visibility map dari schema (false = hidden). */
export function visibilityFromSchemas(schemas: readonly ColumnSchema[]): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const c of schemas) {
        if (c.hidden) out[c.name] = false;
    }
    return out;
}
