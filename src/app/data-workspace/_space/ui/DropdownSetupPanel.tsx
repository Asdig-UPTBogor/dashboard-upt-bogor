"use client";

/**
 * DropdownSetupPanel — set up dropdown source untuk kolom.
 *
 * Mode:
 *  · NONE        — teks bebas (default, ga ada dropdown)
 *  · CHOICE      — daftar pilihan manual (atau dari template tersimpan)
 *  · REFERENCE   — dari tabel lain (dataset + table picker)
 *
 * UI design (post-feedback 2026-04-26):
 *  · Daftar pilihan: 1 kolom input "Pilihan" + 1 kotak warna. Drop Value/Label
 *    dual-input — internal `value === label` supaya 99% case ga bingung.
 *  · Template (catalog) dipindah ke `<details>` collapsible di bawah daftar,
 *    biar default UI clean.
 *
 * Save → Firestore overlay (`data_platform_columns`) lewat /api/.../schema PATCH.
 * Catalog → Firestore `data_platform_choice_catalogs` (registry shared).
 */

import { useEffect, useState, useMemo } from "react";
import {
    Save, Loader2, ListChecks, Database, X, Plus, Trash2, Library, Sparkles, GitBranch,
} from "lucide-react";
import type { Column, Table } from "@tanstack/react-table";
import type { RowData } from "@/app/data-input/_workspace/types";
import { apiFetch, formatApiError } from "@/lib/api-client";
import { toast } from "sonner";

type Mode = "NONE" | "CHOICE" | "REFERENCE" | "CASCADE";

interface ChoiceOpt { value: string; label: string; color?: string }
interface CatalogItem { slug: string; name: string; description?: string | null; options: ChoiceOpt[] }

interface Props {
    column: Column<RowData, unknown>;
    /** TanStack table instance — dipakai untuk akses kolom lain (CASCADE).
     *  Optional: kalau tidak di-pass, mode CASCADE tidak bisa dipakai. */
    tableInstance?: Table<RowData>;
    dataset: string;
    table: string;
    onClose: () => void;
    onSaved?: () => void;
}

interface DatasetItem { id: string }
interface TableItem { id: string }
interface ColumnItem { name: string; type: string }

export function DropdownSetupPanel({ column, tableInstance, dataset, table, onClose, onSaved }: Props) {
    const meta = column.columnDef.meta;
    const initial: Mode = meta?.editor === "CHOICE" ? "CHOICE"
        : meta?.editor === "REFERENCE" ? "REFERENCE"
        : meta?.editor === "CHOICE_CASCADE" ? "CASCADE"
        : "NONE";
    const [mode, setMode] = useState<Mode>(initial);
    const [saving, setSaving] = useState(false);

    // ─── CHOICE state ──────────────────────────────────────
    const [opts, setOpts] = useState<ChoiceOpt[]>(() => {
        const cur = (meta?.choices ?? []) as ChoiceOpt[];
        if (cur.length > 0) return cur.map((c) => ({ value: c.value, label: c.label, color: c.color }));
        return [{ value: "", label: "" }, { value: "", label: "" }];
    });
    const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
    const [showSaveCatalog, setShowSaveCatalog] = useState(false);
    const [newCatalogSlug, setNewCatalogSlug] = useState("");
    const [newCatalogName, setNewCatalogName] = useState("");

    useEffect(() => {
        if (mode !== "CHOICE") return;
        if (catalogs.length > 0) return;
        apiFetch<{ ok: boolean; catalogs?: CatalogItem[] }>("/api/data-input/choice-catalogs")
            .then((r) => { if (r.ok && r.catalogs) setCatalogs(r.catalogs); })
            .catch(() => {});
    }, [mode, catalogs.length]);

    // ─── CASCADE state (E03) ──────────────────────────────
    // Schema: { parentColumn: string, mapping: Record<parentValue, ChoiceOpt[]> }
    const [cascadeParent, setCascadeParent] = useState<string>(meta?.cascade?.parentColumn ?? "");
    const [cascadeMap, setCascadeMap] = useState<Record<string, ChoiceOpt[]>>(() => {
        const m = meta?.cascade?.mapping;
        if (!m) return {};
        const out: Record<string, ChoiceOpt[]> = {};
        for (const [k, arr] of Object.entries(m)) {
            out[k] = arr.map((o) => ({ value: o.value, label: o.label, color: o.color }));
        }
        return out;
    });

    // List parent column candidates: kolom CHOICE/REFERENCE selain kolom ini.
    const parentCandidates = useMemo<Array<{ id: string; label: string }>>(() => {
        if (!tableInstance) return [];
        return tableInstance.getAllLeafColumns()
            .filter((c) => c.id !== column.id)
            .filter((c) => {
                const e = c.columnDef.meta?.editor;
                return e === "CHOICE" || e === "REFERENCE";
            })
            .map((c) => ({
                id: c.id,
                label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
            }));
    }, [tableInstance, column.id]);

    // Daftar parent value: ambil dari parent column choices (CHOICE) atau lookup REF.
    const parentValues = useMemo<string[]>(() => {
        if (!cascadeParent || !tableInstance) return [];
        const parentCol = tableInstance.getColumn(cascadeParent);
        if (!parentCol) return [];
        const choices = parentCol.columnDef.meta?.choices;
        if (choices) return choices.map((c) => c.value);
        // REFERENCE parent: ambil dari rows yg sudah ada (best-effort).
        const seen = new Set<string>();
        for (const row of tableInstance.getCoreRowModel().rows) {
            const v = row.getValue(cascadeParent);
            if (v != null && v !== "") seen.add(String(v));
        }
        return Array.from(seen).sort();
    }, [cascadeParent, tableInstance]);

    function updateCascadeOpt(parent: string, idx: number, text: string) {
        setCascadeMap((prev) => {
            const arr = prev[parent] ?? [];
            const next = arr.map((o, i) => i === idx ? { ...o, value: text, label: text } : o);
            return { ...prev, [parent]: next };
        });
    }
    function updateCascadeColor(parent: string, idx: number, color: string) {
        setCascadeMap((prev) => {
            const arr = prev[parent] ?? [];
            const next = arr.map((o, i) => i === idx ? { ...o, color } : o);
            return { ...prev, [parent]: next };
        });
    }
    function addCascadeOpt(parent: string) {
        setCascadeMap((prev) => {
            const arr = prev[parent] ?? [];
            const next = `Pilihan ${arr.length + 1}`;
            return { ...prev, [parent]: [...arr, { value: next, label: next }] };
        });
    }
    function removeCascadeOpt(parent: string, idx: number) {
        setCascadeMap((prev) => {
            const arr = prev[parent] ?? [];
            return { ...prev, [parent]: arr.filter((_, i) => i !== idx) };
        });
    }

    // ─── REFERENCE state ───────────────────────────────────
    // UX simplification (2026-04-26): dulu user pilih displayCol + valueCol terpisah.
    // Sekarang user cuma pilih 1 kolom — value = label = isi kolom itu. Pattern
    // CHOICE-like, no FK split. Kalau di-load dari row existing dengan displayCol
    // != valueCol, fallback pakai displayCol sebagai default.
    const [refDataset, setRefDataset] = useState(meta?.reference?.dataset ?? "");
    const [refTable, setRefTable] = useState(meta?.reference?.table ?? "");
    const [refColumn, setRefColumn] = useState(
        meta?.reference?.displayCol ?? meta?.reference?.valueCol ?? "",
    );
    const [datasets, setDatasets] = useState<DatasetItem[]>([]);
    const [tables, setTables] = useState<TableItem[]>([]);
    const [columns, setColumns] = useState<ColumnItem[]>([]);

    useEffect(() => {
        if (mode !== "REFERENCE" || datasets.length > 0) return;
        apiFetch<{ ok: boolean; datasets?: DatasetItem[] }>("/api/data-input/datasets")
            .then((r) => { if (r.ok && r.datasets) setDatasets(r.datasets); }).catch(() => {});
    }, [mode, datasets.length]);

    useEffect(() => {
        if (mode !== "REFERENCE" || !refDataset) return;
        apiFetch<{ ok: boolean; dataset?: { tables: TableItem[] } }>(`/api/data-input/datasets/${encodeURIComponent(refDataset)}`)
            .then((r) => { if (r.ok && r.dataset) setTables(r.dataset.tables); }).catch(() => {});
    }, [mode, refDataset]);

    useEffect(() => {
        if (mode !== "REFERENCE" || !refDataset || !refTable) return;
        apiFetch<{ ok: boolean; columns?: Array<{ name: string; bqType: string }> }>(
            `/api/data-input/datasets/${encodeURIComponent(refDataset)}/tables/${encodeURIComponent(refTable)}`
        ).then((r) => {
            if (r.ok && r.columns) setColumns(r.columns.map((c) => ({ name: c.name, type: c.bqType })));
        }).catch(() => {});
    }, [mode, refDataset, refTable]);

    // ─── CHOICE row helpers ────────────────────────────────
    // Single-input UX: setiap row punya 1 input "Pilihan" — internal value = label.
    const updatePilihan = (i: number, text: string) =>
        setOpts((cur) => cur.map((o, j) => j === i ? { ...o, value: text, label: text } : o));
    const updateColor = (i: number, color: string) =>
        setOpts((cur) => cur.map((o, j) => j === i ? { ...o, color } : o));
    const addOpt = () => setOpts((cur) => [...cur, { value: "", label: "" }]);
    const removeOpt = (i: number) => setOpts((cur) => cur.filter((_, j) => j !== i));

    const loadCatalog = (slug: string) => {
        const cat = catalogs.find((c) => c.slug === slug);
        if (!cat) return;
        setOpts(cat.options.map((o) => ({ ...o })));
        toast.success(`Template "${cat.name}" dimuat — ${cat.options.length} opsi`);
    };

    const saveAsCatalog = async () => {
        const validOpts = opts.filter((o) => (o.label ?? o.value).trim() !== "");
        if (validOpts.length === 0) { toast.error("Isi minimal 1 opsi dulu"); return; }
        if (!newCatalogSlug.trim() || !/^[a-z0-9_-]+$/.test(newCatalogSlug)) {
            toast.error("Slug tidak valid (huruf kecil, angka, -, _)"); return;
        }
        if (!newCatalogName.trim()) { toast.error("Nama template wajib diisi"); return; }
        try {
            await apiFetch("/api/data-input/choice-catalogs", {
                method: "POST",
                body: { slug: newCatalogSlug, name: newCatalogName, options: validOpts },
                timeoutMs: 10_000,
            });
            toast.success(`Template "${newCatalogName}" disimpan — bisa dipakai di kolom lain`);
            setShowSaveCatalog(false);
            setNewCatalogSlug("");
            setNewCatalogName("");
            const r = await apiFetch<{ ok: boolean; catalogs?: CatalogItem[] }>("/api/data-input/choice-catalogs");
            if (r.ok && r.catalogs) setCatalogs(r.catalogs);
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    // ─── Save column overlay ──────────────────────────────
    const save = async () => {
        setSaving(true);
        try {
            let patch: Record<string, unknown> = {};
            if (mode === "NONE") {
                patch = { editor: "TEXT", choices: null, reference: null };
            } else if (mode === "CHOICE") {
                const choices = opts
                    .map((o) => ({ value: (o.value ?? o.label).trim(), label: (o.label ?? o.value).trim(), color: o.color || undefined }))
                    .filter((o) => o.value !== "");
                if (choices.length === 0) throw new Error("Isi minimal 1 opsi");
                patch = { editor: "CHOICE", choices, reference: null, parentColumn: null, optionsMap: null };
            } else if (mode === "CASCADE") {
                if (!cascadeParent) throw new Error("Pilih kolom induk dulu");
                // Filter out empty entries dan empty arrays
                const cleanMap: Record<string, ChoiceOpt[]> = {};
                for (const [k, arr] of Object.entries(cascadeMap)) {
                    const filtered = arr
                        .map((o) => ({ value: (o.value ?? o.label).trim(), label: (o.label ?? o.value).trim(), color: o.color || undefined }))
                        .filter((o) => o.value !== "");
                    if (filtered.length > 0) cleanMap[k] = filtered;
                }
                if (Object.keys(cleanMap).length === 0) throw new Error("Isi minimal 1 pilihan untuk salah satu nilai induk");
                patch = {
                    editor: "CHOICE_CASCADE",
                    parentColumn: cascadeParent,
                    optionsMap: cleanMap,
                    choices: null,
                    reference: null,
                };
            } else {
                if (!refDataset || !refTable || !refColumn)
                    throw new Error("Lengkapi dataset, tabel, dan kolom yang dipakai");
                patch = {
                    editor: "REFERENCE",
                    // displayCol = valueCol = kolom yang dipilih user. Backend & cache
                    // tetap support split (legacy data), tapi UI simplified.
                    reference: { dataset: refDataset, table: refTable, displayCol: refColumn, valueCol: refColumn },
                    choices: null,
                };
            }
            await apiFetch(
                `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/schema`,
                { method: "PATCH", body: { columns: { [column.id]: patch } }, timeoutMs: 15_000 },
            );
            toast.success(`Dropdown "${column.id}" tersimpan`);
            onSaved?.();
            onClose();
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setSaving(false);
        }
    };

    const filledCount = opts.filter((o) => (o.label ?? o.value).trim() !== "").length;

    return (
        <div className="flex flex-col" style={{ maxHeight: 520 }}>
            {/* Mode picker */}
            <div className="shrink-0 border-b border-border/40 p-2 grid grid-cols-2 gap-1">
                <ModeBtn active={mode === "NONE"} onClick={() => setMode("NONE")}>
                    <X className="h-3 w-3" /> Teks bebas
                </ModeBtn>
                <ModeBtn active={mode === "CHOICE"} onClick={() => setMode("CHOICE")}>
                    <ListChecks className="h-3 w-3" /> Daftar pilihan
                </ModeBtn>
                <ModeBtn active={mode === "REFERENCE"} onClick={() => setMode("REFERENCE")}>
                    <Database className="h-3 w-3" /> Dari tabel lain
                </ModeBtn>
                <ModeBtn active={mode === "CASCADE"} onClick={() => setMode("CASCADE")}>
                    <GitBranch className="h-3 w-3" /> Bertingkat
                </ModeBtn>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 text-xs">
                {mode === "NONE" && (
                    <p className="text-muted-foreground italic">
                        Sel akan jadi input teks bebas, tanpa pilihan.
                    </p>
                )}

                {mode === "CHOICE" && (
                    <div className="space-y-3">
                        <p className="text-[11px] text-muted-foreground">
                            Tulis daftar pilihan yang muncul di dropdown. Klik kotak warna untuk badge.
                        </p>

                        {/* Options list */}
                        <div className="rounded-md border border-border/50 overflow-hidden">
                            <div className="grid grid-cols-[2rem_1fr_2.5rem_2rem] gap-1.5 px-2 py-1.5 bg-muted/40 text-[10px] font-medium text-muted-foreground border-b border-border/40">
                                <div>#</div>
                                <div>Pilihan</div>
                                <div className="text-center">Warna</div>
                                <div></div>
                            </div>
                            {opts.map((opt, i) => (
                                <div key={i} className="grid grid-cols-[2rem_1fr_2.5rem_2rem] gap-1.5 px-2 py-1.5 border-t border-border/20 items-center hover:bg-muted/20 ds-transition">
                                    <div className="text-[11px] text-muted-foreground text-center tabular-nums">{i + 1}</div>
                                    <input type="text" value={opt.label || opt.value}
                                        onChange={(e) => updatePilihan(i, e.target.value)}
                                        placeholder="Misal: Open"
                                        className="rounded border border-border/40 bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40" />
                                    <input type="color" value={opt.color ?? "#94a3b8"}
                                        onChange={(e) => updateColor(i, e.target.value)}
                                        className="w-full h-7 rounded border border-border/40 cursor-pointer bg-transparent"
                                        title="Pilih warna badge" />
                                    <button type="button" onClick={() => removeOpt(i)}
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded p-1 ds-transition"
                                        title="Hapus baris">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={addOpt}
                                className="w-full text-[11px] py-2 hover:bg-primary/5 inline-flex items-center justify-center gap-1.5 border-t border-dashed border-border/40 text-primary font-medium ds-transition">
                                <Plus className="h-3.5 w-3.5" /> Tambah opsi
                            </button>
                        </div>

                        {/* Templates — collapsible (advanced) */}
                        <details className="rounded-md border border-border/30 bg-muted/10 overflow-hidden">
                            <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/20 ds-transition flex items-center justify-between">
                                <span>Template tersimpan</span>
                                <span className="text-[10px] tabular-nums">
                                    {catalogs.length} tersedia
                                </span>
                            </summary>
                            <div className="p-2 space-y-2 border-t border-border/30">
                                {/* Action buttons */}
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button type="button" onClick={() => setShowSaveCatalog(false)}
                                        className="text-[11px] inline-flex items-center justify-center gap-1.5 rounded-md border border-border/50 bg-card hover:bg-muted/40 hover:border-primary/30 px-2 py-1.5 ds-transition">
                                        <Library className="h-3 w-3" /> Pilih template
                                    </button>
                                    <button type="button" onClick={() => setShowSaveCatalog(true)}
                                        disabled={filledCount === 0}
                                        className="text-[11px] inline-flex items-center justify-center gap-1.5 rounded-md border border-border/50 bg-card hover:bg-muted/40 hover:border-primary/30 px-2 py-1.5 ds-transition disabled:opacity-40 disabled:cursor-not-allowed">
                                        <Sparkles className="h-3 w-3" /> Simpan jadi template
                                    </button>
                                </div>

                                {/* Catalog list */}
                                {!showSaveCatalog && (
                                    <div className="rounded border border-border/40 max-h-44 overflow-y-auto divide-y divide-border/20 bg-card">
                                        {catalogs.length === 0 && (
                                            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground italic">
                                                Belum ada template
                                            </div>
                                        )}
                                        {catalogs.map((c) => (
                                            <button key={c.slug} type="button" onClick={() => loadCatalog(c.slug)}
                                                className="w-full text-left px-3 py-2 hover:bg-primary/10 ds-transition">
                                                <div className="text-xs font-medium text-foreground">{c.name}</div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                    <span className="font-mono">{c.slug}</span>
                                                    <span>·</span>
                                                    <span>{c.options.length} opsi</span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                    {c.options.slice(0, 5).map((o) => {
                                                        const optColor = o.color ?? "var(--muted-foreground)";
                                                        return (
                                                            <span key={o.value}
                                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border"
                                                                style={{
                                                                    color: optColor,
                                                                    borderColor: `color-mix(in oklch, ${optColor} 40%, transparent)`,
                                                                    backgroundColor: `color-mix(in oklch, ${optColor} 12%, transparent)`,
                                                                }}>
                                                                {o.label}
                                                            </span>
                                                        );
                                                    })}
                                                    {c.options.length > 5 && (
                                                        <span className="text-[10px] text-muted-foreground">+{c.options.length - 5}</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Save as template form */}
                                {showSaveCatalog && (
                                    <div className="rounded border border-primary/40 bg-primary/5 p-2 space-y-2">
                                        <Field label="ID template (huruf kecil, angka, -, _)">
                                            <input type="text" value={newCatalogSlug}
                                                onChange={(e) => setNewCatalogSlug(e.target.value.toLowerCase())}
                                                placeholder="status-pekerjaan"
                                                className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/40" />
                                        </Field>
                                        <Field label="Nama template">
                                            <input type="text" value={newCatalogName}
                                                onChange={(e) => setNewCatalogName(e.target.value)}
                                                placeholder="Status Pekerjaan"
                                                className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" />
                                        </Field>
                                        <button type="button" onClick={saveAsCatalog}
                                            className="w-full text-[11px] rounded-md bg-primary text-primary-foreground hover:opacity-90 px-2 py-1.5 inline-flex items-center justify-center gap-1.5 font-medium ds-transition">
                                            Simpan template
                                        </button>
                                    </div>
                                )}
                            </div>
                        </details>
                    </div>
                )}

                {mode === "REFERENCE" && (
                    <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground">
                            Ambil pilihan dari isi kolom di tabel lain. User pilih label, label itu langsung jadi nilai.
                        </p>
                        <Field label="Dataset">
                            <select value={refDataset} onChange={(e) => { setRefDataset(e.target.value); setRefTable(""); setRefColumn(""); setColumns([]); }}
                                className="w-full rounded border border-border/50 bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40">
                                <option value="">— pilih dataset —</option>
                                {datasets.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
                            </select>
                        </Field>
                        <Field label="Tabel">
                            <select value={refTable} onChange={(e) => { setRefTable(e.target.value); setRefColumn(""); setColumns([]); }}
                                disabled={!refDataset}
                                className="w-full rounded border border-border/50 bg-background px-2 py-1 text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/40">
                                <option value="">— pilih tabel —</option>
                                {tables.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                            </select>
                        </Field>
                        <Field label="Kolom yang dipakai">
                            <select value={refColumn} onChange={(e) => setRefColumn(e.target.value)}
                                disabled={columns.length === 0}
                                className="w-full rounded border border-border/50 bg-background px-2 py-1 text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary/40">
                                <option value="">— pilih kolom —</option>
                                {columns.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                            </select>
                        </Field>
                        <p className="text-[10px] text-muted-foreground italic">
                            Kalau tabel sumber punya kolom <code>source_table</code>, baris otomatis difilter sesuai tabel ini.
                        </p>
                    </div>
                )}

                {mode === "CASCADE" && (
                    <div className="space-y-3">
                        <p className="text-[11px] text-muted-foreground">
                            Pilihan kolom ini berubah otomatis tergantung isi kolom induk.
                            Contoh: kolom <code>brand</code> = NR → kolom ini menampilkan tipe relay merk NR saja.
                        </p>
                        <Field label="Kolom induk">
                            <select
                                value={cascadeParent}
                                onChange={(e) => setCascadeParent(e.target.value)}
                                className="w-full rounded border border-border/50 bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                            >
                                <option value="">— pilih kolom induk —</option>
                                {parentCandidates.length === 0 && (
                                    <option value="" disabled>Belum ada kolom dengan tipe Pilihan / Dari tabel lain</option>
                                )}
                                {parentCandidates.map((p) => (
                                    <option key={p.id} value={p.id}>{p.label} ({p.id})</option>
                                ))}
                            </select>
                        </Field>

                        {cascadeParent && parentValues.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">
                                Kolom induk belum punya nilai pilihan. Atur dulu daftar pilihan di kolom <code>{cascadeParent}</code>.
                            </p>
                        )}

                        {cascadeParent && parentValues.length > 0 && (
                            <div className="space-y-2">
                                {parentValues.map((pv) => {
                                    const arr = cascadeMap[pv] ?? [];
                                    return (
                                        <details key={pv} open className="rounded-md border border-border/40 overflow-hidden">
                                            <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] hover:bg-muted/30 flex items-center justify-between bg-muted/10">
                                                <span>Saat induk = <span className="font-mono text-foreground">{pv}</span></span>
                                                <span className="text-[10px] text-muted-foreground tabular-nums">{arr.length} pilihan</span>
                                            </summary>
                                            <div className="p-2 space-y-1">
                                                {arr.map((opt, i) => (
                                                    <div key={i} className="grid grid-cols-[24px_1fr_24px] gap-1 items-center">
                                                        <input
                                                            type="color"
                                                            value={opt.color ?? "#5b8def"}
                                                            onChange={(e) => updateCascadeColor(pv, i, e.target.value)}
                                                            className="h-6 w-6 rounded border border-border cursor-pointer"
                                                            title="Pilih warna"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={opt.label || opt.value}
                                                            onChange={(e) => updateCascadeOpt(pv, i, e.target.value)}
                                                            placeholder="Tulis pilihan..."
                                                            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCascadeOpt(pv, i)}
                                                            className="ds-transition rounded p-0.5 text-destructive hover:bg-destructive/10"
                                                            title="Hapus pilihan"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => addCascadeOpt(pv)}
                                                    className="w-full text-[11px] py-1 hover:bg-primary/5 inline-flex items-center justify-center gap-1.5 rounded text-primary font-medium ds-transition">
                                                    <Plus className="h-3 w-3" /> Tambah pilihan
                                                </button>
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="shrink-0 border-t border-border/40 p-2 flex items-center gap-2">
                <button type="button" onClick={onClose}
                    className="text-[11px] rounded border border-border/50 px-2 py-1 hover:bg-muted/40">
                    Batal
                </button>
                <div className="flex-1" />
                <button type="button" onClick={save} disabled={saving}
                    className="text-[11px] inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Simpan
                </button>
            </div>
        </div>
    );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`flex-1 text-[11px] rounded px-2 py-1.5 inline-flex items-center justify-center gap-1 ds-transition ${
                active ? "bg-primary/15 border border-primary/40 text-primary"
                       : "border border-border/40 hover:bg-muted/40 text-muted-foreground"
            }`}>
            {children}
        </button>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block ds-label mb-1">{label}</label>
            {children}
        </div>
    );
}
