"use client";

/**
 * ColumnSidePanel — Panel Kolom di Sidebar Workspace.
 *
 * ONE concern: SEMUA config kolom di sini (bukan di grid header chevron).
 *   ▸ Quick actions (inline): hide/show, pin L/R, drag reorder
 *   ▸ Click nama kolom → expand form inline untuk edit detail:
 *       - Alias & description
 *       - BQ type (STRING/INT/FLOAT/BOOL/DATE/TIMESTAMP/CHOICE/REFERENCE/URL/RICH_TEXT)
 *       - CHOICE options editor (value/label/color)
 *       - REFERENCE picker (link ke Master_Data.*)
 *
 * Pattern: DRAFT MODE — semua perubahan queue ke pendingOverlay (merged
 * preview live), commit batch PATCH Firestore data_platform_columns.
 */

import { useEffect, useMemo, useState } from "react";
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    Eye, EyeOff, GripVertical,
    Search as SearchIcon, X, Link2, Loader2, Check, Undo2,
    ChevronDown, ChevronRight, Plus, Trash2,
} from "lucide-react";
import type { ColumnMeta, ChoiceOption, ColumnType } from "./types";
import { apiFetch, formatApiError } from "@/lib/api-client";

interface Props {
    dataset: string;
    table: string;
    columns: ColumnMeta[];
    onColumnsUpdated: () => void;
    /** Panel lapor jumlah pending ke parent supaya parent bisa confirm sebelum close.
     *  Pattern lift-state-to-parent untuk prevent data loss tanpa useImperativeHandle. */
    onPendingChange?: (count: number) => void;
}

type Group = "pinned" | "visible" | "hidden" | "fk";
type PendingMap = Record<string, Partial<ColumnMeta>>;

const GROUP_LABEL: Record<Group, string> = {
    pinned: "Disematkan",
    visible: "Terlihat",
    hidden: "Disembunyikan",
    fk: "Referensi",
};

const BQ_TYPES: ColumnType[] = [
    "STRING", "INT64", "FLOAT64", "NUMERIC", "BOOL",
    "DATE", "TIMESTAMP", "CHOICE", "REFERENCE", "URL", "RICH_TEXT",
];

const TYPE_LABEL: Partial<Record<ColumnType, string>> = {
    STRING: "Teks",
    INT64: "Angka bulat",
    FLOAT64: "Angka desimal",
    NUMERIC: "Angka presisi",
    BOOL: "Ya / Tidak",
    DATE: "Tanggal",
    TIMESTAMP: "Tanggal & jam",
    CHOICE: "Pilihan tunggal",
    REFERENCE: "Pilihan dari tabel lain",
    URL: "URL",
    RICH_TEXT: "Teks panjang",
};

export function ColumnSidePanel({ dataset, table, columns, onColumnsUpdated, onPendingChange }: Props) {
    const [search, setSearch] = useState("");
    const [pending, setPending] = useState<PendingMap>({});
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [expandedCol, setExpandedCol] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
    );

    const merged = useMemo<ColumnMeta[]>(() => {
        return columns.map((c) => pending[c.name] ? { ...c, ...pending[c.name] } : c);
    }, [columns, pending]);

    const ordered = useMemo(() => {
        return [...merged].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }, [merged]);

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!s) return ordered;
        return ordered.filter(
            (c) => c.name.toLowerCase().includes(s) || (c.alias ?? "").toLowerCase().includes(s)
        );
    }, [ordered, search]);

    const groups = useMemo<Record<Group, ColumnMeta[]>>(() => {
        const g: Record<Group, ColumnMeta[]> = { pinned: [], visible: [], hidden: [], fk: [] };
        for (const c of filtered) {
            if (c.pin === "left" || c.pin === "right") g.pinned.push(c);
            else if (c.type === "REFERENCE") g.fk.push(c);
            else if (c.hidden) g.hidden.push(c);
            else g.visible.push(c);
        }
        return g;
    }, [filtered]);

    function stage(name: string, patch: Partial<ColumnMeta>) {
        setErr(null);
        setPending((prev) => {
            const existing = prev[name] ?? {};
            return { ...prev, [name]: { ...existing, ...patch } };
        });
    }

    function stageBulk(updates: PendingMap) {
        if (Object.keys(updates).length === 0) return;
        setErr(null);
        setPending((prev) => {
            const next: PendingMap = { ...prev };
            for (const [name, patch] of Object.entries(updates)) {
                next[name] = { ...(next[name] ?? {}), ...patch };
            }
            return next;
        });
    }

    /** Validasi pending sebelum commit — prevent data invalid sampai ke Firestore.
     *  Rules:
     *    - CHOICE: value tidak kosong + unik within options + label tidak kosong
     *    - REFERENCE: harus punya reference object (dataset/table/valueCol/displayCol)
     *    - Alias: boleh duplicate (user pilih sendiri), tidak block
     *  Return null kalau valid, atau error message. */
    function validatePending(): string | null {
        for (const [colName, patch] of Object.entries(pending)) {
            const merged = { ...columns.find((c) => c.name === colName), ...patch };
            if (merged.type === "CHOICE") {
                const opts = merged.options ?? [];
                const values = new Set<string>();
                for (const [idx, o] of opts.entries()) {
                    const v = o.value?.trim() ?? "";
                    const l = o.label?.trim() ?? "";
                    if (!v) return `Kolom "${colName}" · pilihan #${idx + 1}: nilai tidak boleh kosong`;
                    if (!l) return `Kolom "${colName}" · pilihan #${idx + 1}: label tidak boleh kosong`;
                    if (values.has(v)) return `Kolom "${colName}" · nilai duplikat "${v}"`;
                    values.add(v);
                }
            }
            if (merged.type === "REFERENCE") {
                const ref = merged.reference;
                if (!ref || !ref.dataset || !ref.table || !ref.valueCol || !ref.displayCol) {
                    return `Kolom "${colName}" tipe Pilihan dari tabel: pilih tabel sumbernya dulu`;
                }
            }
        }
        return null;
    }

    async function commit() {
        if (Object.keys(pending).length === 0) return;
        const validationError = validatePending();
        if (validationError) {
            setErr(validationError);
            return;
        }
        setSaving(true);
        setErr(null);
        try {
            await apiFetch(
                `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/schema`,
                {
                    method: "PATCH",
                    body: { columns: pending },
                    timeoutMs: 15_000,
                }
            );
            setPending({});
            onColumnsUpdated();
        } catch (e) {
            setErr(formatApiError(e));
        } finally {
            setSaving(false);
        }
    }

    function discard() {
        setPending({});
        setErr(null);
    }

    function onDragEnd(e: DragEndEvent) {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        // Kolom hidden tidak boleh di-reorder — reorder hanya berlaku untuk visible set
        const visibleOrdered = ordered.filter((c) => !c.hidden);
        const names = visibleOrdered.map((c) => c.name);
        const oldIdx = names.indexOf(String(active.id));
        const newIdx = names.indexOf(String(over.id));
        if (oldIdx === -1 || newIdx === -1) return;
        const next = arrayMove(names, oldIdx, newIdx);
        const updates: PendingMap = {};
        next.forEach((n, i) => { updates[n] = { order: i }; });
        stageBulk(updates);
    }

    async function dropColumn(name: string) {
        if (!confirm(`Hapus kolom "${name}"?\n\nALTER TABLE DROP COLUMN di BigQuery — seluruh data di kolom ini akan hilang permanen.`)) return;
        setSaving(true);
        setErr(null);
        try {
            await apiFetch(
                `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/columns/${encodeURIComponent(name)}`,
                { method: "DELETE", timeoutMs: 30_000 }
            );
            // Drop overlay entry kalau ada
            setPending((prev) => {
                const { [name]: _omit, ...rest } = prev;
                return rest;
            });
            setExpandedCol(null);
            onColumnsUpdated();
        } catch (e) {
            setErr(formatApiError(e));
        } finally {
            setSaving(false);
        }
    }

    const visibleCount = merged.filter((c) => !c.hidden).length;
    const hiddenCount = merged.length - visibleCount;
    const pendingCount = Object.keys(pending).length;

    // Report pending count ke parent — parent guard close dengan confirm
    useEffect(() => {
        onPendingChange?.(pendingCount);
    }, [pendingCount, onPendingChange]);

    function showAll() {
        const updates: PendingMap = {};
        for (const c of merged) if (c.hidden) updates[c.name] = { hidden: false };
        stageBulk(updates);
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search + counter bar */}
            <div className="shrink-0 border-b border-border/60 p-3 space-y-2">
                <div className="relative">
                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Cari ${columns.length} kolom...`}
                        className="w-full rounded-md border border-border bg-background pl-7 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 ds-small">
                    <span>
                        <span className="ds-data text-primary">{visibleCount}</span>
                        <span className="opacity-60"> / {columns.length} terlihat</span>
                    </span>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={showAll}
                        disabled={hiddenCount === 0}
                        className="ds-transition underline decoration-dotted opacity-70 hover:opacity-100 disabled:opacity-30 disabled:no-underline"
                    >
                        Tampilkan semua ({hiddenCount})
                    </button>
                </div>
            </div>

            {/* List + inline expand config */}
            <div className="flex-1 overflow-y-auto p-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext
                        items={ordered.map((c) => c.name)}
                        strategy={verticalListSortingStrategy}
                    >
                        {(Object.keys(groups) as Group[]).map((g) => {
                            const items = groups[g];
                            if (items.length === 0) return null;
                            return (
                                <section key={g} className="mb-3">
                                    <h4 className="ds-label uppercase tracking-wider px-2 py-1 opacity-60">
                                        {GROUP_LABEL[g]}
                                        <span className="ds-data ml-1.5 font-mono opacity-80">{items.length}</span>
                                    </h4>
                                    <ul className="space-y-0.5">
                                        {items.map((c) => (
                                            <SortableItem
                                                key={c.name}
                                                col={c}
                                                isDirty={!!pending[c.name]}
                                                isExpanded={expandedCol === c.name}
                                                dragDisabled={!!c.hidden}
                                                onToggleExpand={() =>
                                                    setExpandedCol((v) => v === c.name ? null : c.name)
                                                }
                                                onPatch={(p) => stage(c.name, p)}
                                                onDelete={() => void dropColumn(c.name)}
                                            />
                                        ))}
                                    </ul>
                                </section>
                            );
                        })}
                        {filtered.length === 0 && (
                            <p className="ds-small opacity-50 text-center py-6">
                                Tidak ada kolom cocok &quot;{search}&quot;
                            </p>
                        )}
                    </SortableContext>
                </DndContext>
            </div>

            {/* Footer Save/Discard — muncul saat ada pending */}
            {pendingCount > 0 && (
                <div className="shrink-0 border-t border-border bg-card px-3 py-2.5 space-y-2">
                    {err && <p className="ds-small text-destructive">{err}</p>}
                    <div className="flex items-center gap-2">
                        <span className="ds-small">
                            <span className="ds-data text-amber-400 font-mono">{pendingCount}</span>
                            <span className="opacity-70"> perubahan belum disimpan</span>
                        </span>
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={discard}
                            disabled={saving}
                            title="Batalkan semua perubahan"
                            className="ds-btn ds-btn-secondary ds-btn-sm"
                        >
                            <Undo2 className="h-3 w-3" /> Batalkan
                        </button>
                        <button
                            type="button"
                            onClick={commit}
                            disabled={saving}
                            title="Simpan ke Firestore data_platform_columns"
                            className="ds-btn ds-btn-success ds-btn-sm"
                        >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Simpan
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Sortable item (collapsed quick-row + expandable config form) ──── */

function SortableItem({
    col, isDirty, isExpanded, dragDisabled, onToggleExpand, onPatch, onDelete,
}: {
    col: ColumnMeta;
    isDirty: boolean;
    isExpanded: boolean;
    dragDisabled: boolean;
    onToggleExpand: () => void;
    onPatch: (p: Partial<ColumnMeta>) => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: col.name,
        disabled: dragDisabled,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };
    const [editingAlias, setEditingAlias] = useState(false);
    const [aliasDraft, setAliasDraft] = useState(col.alias ?? "");
    const label = col.alias ?? col.name;
    const borderClass = isDirty
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-transparent hover:border-border/60 hover:bg-muted/30";

    function commitAlias() {
        const v = aliasDraft.trim();
        if (v !== (col.alias ?? "")) {
            onPatch({ alias: v || undefined });
        }
        setEditingAlias(false);
    }

    function startAliasEdit() {
        setAliasDraft(col.alias ?? "");
        setEditingAlias(true);
    }

    return (
        <li ref={setNodeRef} style={style} className={`rounded border ${borderClass} ds-transition`}>
            <div className="flex items-center gap-1 px-1 py-1">
                {/* Drag handle — disabled saat kolom hidden (order hanya untuk visible) */}
                <button
                    type="button"
                    {...(dragDisabled ? {} : attributes)}
                    {...(dragDisabled ? {} : listeners)}
                    disabled={dragDisabled}
                    title={dragDisabled ? "Disembunyikan — tampilkan dulu untuk geser urutan" : "Geser untuk ubah urutan"}
                    className={`p-0.5 touch-none ds-transition ${
                        dragDisabled
                            ? "opacity-20 cursor-not-allowed"
                            : "text-muted-foreground cursor-grab active:cursor-grabbing opacity-60 hover:opacity-100"
                    }`}
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>

                {/* Expand toggle — buka form detail (type, CHOICE/REFERENCE, description) */}
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className="ds-transition rounded p-0.5 opacity-60 hover:opacity-100"
                    title={isExpanded ? "Tutup detail" : "Buka detail"}
                >
                    {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                </button>

                {/* Alias row — double-click untuk rename. Nama BQ asli + type SELALU
                 *  visible di baris bawah (context tidak hilang saat edit). */}
                <div className="flex-1 min-w-0">
                    {editingAlias ? (
                        <input
                            type="text"
                            autoFocus
                            value={aliasDraft}
                            onChange={(e) => setAliasDraft(e.target.value)}
                            onBlur={commitAlias}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commitAlias(); }
                                if (e.key === "Escape") { setAliasDraft(col.alias ?? ""); setEditingAlias(false); }
                            }}
                            placeholder={prettify(col.name)}
                            className="w-full rounded border border-primary/60 bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    ) : (
                        <p
                            className="text-sm truncate cursor-text select-text rounded hover:bg-muted/30 px-1 -mx-1"
                            onDoubleClick={startAliasEdit}
                            title="Dobel-klik untuk ubah alias"
                        >
                            {label}
                        </p>
                    )}
                    {/* Context line — nama BQ asli + type + FK (selalu visible, read-only) */}
                    <p className="ds-small font-mono opacity-40 truncate px-1 -mx-1">
                        <span>{col.name}</span>
                        <span className="ml-1 opacity-60">· {col.type}</span>
                        {col.reference && (
                            <span className="ml-1 text-primary inline-flex items-center gap-0.5">
                                <Link2 className="h-2.5 w-2.5" /> {col.reference.table}
                            </span>
                        )}
                    </p>
                </div>

                {/* Quick actions: show/hide · delete
                 *  Pin L/R DIHAPUS — redundant dengan drag-drop reorder
                 *  (kolom pertama = paling kiri = efektif "pinned") */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => onPatch({ hidden: !col.hidden })}
                        title={col.hidden ? "Tampilkan kolom" : "Sembunyikan kolom"}
                        className={`ds-transition rounded p-1 ${
                            col.hidden
                                ? "text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted/40"
                                : "text-primary opacity-80 hover:opacity-100 hover:bg-primary/10"
                        }`}
                    >
                        {col.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        title="Hapus kolom (ALTER TABLE DROP COLUMN) — tidak bisa dibatalkan"
                        className="ds-transition rounded p-1 text-muted-foreground opacity-40 hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Expanded — form untuk type/CHOICE/REFERENCE/description
             *  Alias sudah diedit inline di atas, tidak duplicate di sini. */}
            {isExpanded && (
                <div className="border-t border-border/40 px-2 py-2 space-y-2 bg-background/40">
                    <ColumnEditForm col={col} onPatch={onPatch} />
                </div>
            )}
        </li>
    );
}

/* ─── Full edit form (alias + type + CHOICE/REFERENCE) ──── */

function ColumnEditForm({
    col, onPatch,
}: {
    col: ColumnMeta;
    onPatch: (p: Partial<ColumnMeta>) => void;
}) {
    return (
        <div className="space-y-2.5">
            {/* Alias edit sudah inline di header row — tidak duplicate di sini */}

            {/* Deskripsi */}
            <div>
                <label className="ds-label block mb-1 opacity-70">Deskripsi (tooltip)</label>
                <textarea
                    value={col.description ?? ""}
                    onChange={(e) => onPatch({ description: e.target.value || undefined })}
                    rows={2}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
            </div>

            {/* Tipe */}
            <div>
                <label className="ds-label block mb-1 opacity-70">Tipe</label>
                <select
                    value={col.type}
                    onChange={(e) => onPatch({ type: e.target.value as ColumnType })}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    {BQ_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
                </select>
                <p className="ds-small opacity-60 mt-0.5">
                    Tipe BigQuery asli tetap sama — pengaturan ini mengubah tampilan & cara isi di sini.
                </p>
            </div>

            {/* CHOICE options (conditional) */}
            {col.type === "CHOICE" && (
                <ChoiceOptionsEditor
                    options={col.options ?? []}
                    onChange={(opts) => onPatch({ options: opts })}
                />
            )}

            {/* REFERENCE picker (conditional) */}
            {col.type === "REFERENCE" && (
                <ReferencePicker
                    current={col.reference}
                    onChange={(ref) => onPatch({ reference: ref })}
                />
            )}

            {/* Delete button sudah ada di quick-actions row (icon ✕) — tidak duplicate */}
        </div>
    );
}

function ChoiceOptionsEditor({
    options, onChange,
}: {
    options: ChoiceOption[];
    onChange: (opts: ChoiceOption[]) => void;
}) {
    // Single-input UX: 1 baris = 1 input "Pilihan" + warna. Internal value = label.
    function add() {
        const next = `Pilihan ${options.length + 1}`;
        onChange([...options, { value: next, label: next, color: "#5b8def" }]);
    }
    function updPilihan(i: number, text: string) {
        onChange(options.map((o, idx) => idx === i ? { ...o, value: text, label: text } : o));
    }
    function updColor(i: number, color: string) {
        onChange(options.map((o, idx) => idx === i ? { ...o, color } : o));
    }
    function rm(i: number) {
        onChange(options.filter((_, idx) => idx !== i));
    }
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="ds-label opacity-70">Pilihan ({options.length})</span>
                <button
                    type="button"
                    onClick={add}
                    className="ds-small text-primary hover:underline inline-flex items-center gap-1"
                >
                    <Plus className="h-3 w-3" /> Tambah
                </button>
            </div>
            {options.length === 0 && (
                <p className="ds-small opacity-60 text-center py-2">Belum ada pilihan</p>
            )}
            <ul className="space-y-1">
                {options.map((o, i) => (
                    <li key={i} className="grid grid-cols-[24px_1fr_24px] gap-1 items-center">
                        <input
                            type="color"
                            value={o.color ?? "#5b8def"}
                            onChange={(e) => updColor(i, e.target.value)}
                            className="h-6 w-6 rounded border border-border cursor-pointer"
                            title="Pilih warna"
                        />
                        <input
                            type="text"
                            placeholder="Tulis pilihan..."
                            value={o.label || o.value}
                            onChange={(e) => updPilihan(i, e.target.value)}
                            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                            type="button"
                            onClick={() => rm(i)}
                            className="ds-transition rounded p-0.5 text-destructive hover:bg-destructive/10"
                            title="Hapus pilihan"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ReferencePicker({
    current, onChange,
}: {
    current: ColumnMeta["reference"];
    onChange: (ref: ColumnMeta["reference"]) => void;
}) {
    // Auto-discover datasets + tables + columns dari BQ. Drop hardcode MASTER_FK.
    const [datasets, setDatasets] = useState<Array<{ id: string }>>([]);
    const [tables, setTables] = useState<Array<{ id: string }>>([]);
    const [columns, setColumns] = useState<Array<{ name: string; type: string }>>([]);
    const [refDataset, setRefDataset] = useState(current?.dataset ?? "");
    const [refTable, setRefTable] = useState(current?.table ?? "");
    // UX simplification: 1 kolom dipakai untuk display + value (no FK split).
    const [refColumn, setRefColumn] = useState(current?.displayCol ?? current?.valueCol ?? "");

    useEffect(() => {
        apiFetch<{ ok: boolean; datasets?: Array<{ id: string }> }>("/api/data-input/datasets")
            .then((r) => { if (r.ok && r.datasets) setDatasets(r.datasets); }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!refDataset) return;
        apiFetch<{ ok: boolean; dataset?: { tables: Array<{ id: string }> } }>(`/api/data-input/datasets/${encodeURIComponent(refDataset)}`)
            .then((r) => { if (r.ok && r.dataset) setTables(r.dataset.tables); }).catch(() => {});
    }, [refDataset]);

    useEffect(() => {
        if (!refDataset || !refTable) return;
        apiFetch<{ ok: boolean; columns?: Array<{ name: string; bqType: string }> }>(
            `/api/data-input/datasets/${encodeURIComponent(refDataset)}/tables/${encodeURIComponent(refTable)}`
        ).then((r) => {
            if (r.ok && r.columns) setColumns(r.columns.map((c) => ({ name: c.name, type: c.bqType })));
        }).catch(() => {});
    }, [refDataset, refTable]);

    function commit(d: string, t: string, c: string) {
        if (!d || !t || !c) {
            onChange(undefined);
            return;
        }
        // displayCol = valueCol = kolom yg dipilih. Backend tetap simpan dual,
        // tapi UI hanya satu (post-feedback 2026-04-26).
        onChange({ dataset: d, table: t, displayCol: c, valueCol: c });
    }

    return (
        <div className="space-y-2">
            <p className="ds-small opacity-60">
                Ambil pilihan dari isi kolom di tabel lain. Yang user lihat sama dengan yang disimpan.
            </p>
            <div>
                <label className="ds-label block mb-1 opacity-70">Dataset</label>
                <select
                    value={refDataset}
                    onChange={(e) => {
                        const d = e.target.value;
                        setRefDataset(d); setRefTable(""); setRefColumn(""); setColumns([]); setTables([]);
                        commit(d, "", "");
                    }}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    <option value="">— pilih dataset —</option>
                    {datasets.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
                </select>
            </div>
            <div>
                <label className="ds-label block mb-1 opacity-70">Tabel</label>
                <select
                    value={refTable}
                    onChange={(e) => {
                        const t = e.target.value;
                        setRefTable(t); setRefColumn(""); setColumns([]);
                        commit(refDataset, t, "");
                    }}
                    disabled={!refDataset}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                    <option value="">— pilih tabel —</option>
                    {tables.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                </select>
            </div>
            <div>
                <label className="ds-label block mb-1 opacity-70">Kolom yang dipakai</label>
                <select
                    value={refColumn}
                    onChange={(e) => {
                        const c = e.target.value;
                        setRefColumn(c);
                        commit(refDataset, refTable, c);
                    }}
                    disabled={columns.length === 0}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                    <option value="">— pilih kolom —</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                </select>
            </div>
        </div>
    );
}


function prettify(name: string): string {
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
