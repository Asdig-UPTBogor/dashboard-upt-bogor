"use client";

/**
 * NewTableWizard — reusable 4-step wizard untuk create BQ table.
 *
 *  Pure component tanpa page chrome. Caller render di modal atau page.
 *  Props:
 *   ▸ preselectDs   — optional dataset pre-select (skip step 1)
 *   ▸ onSuccess(ds, tableId) — POST sukses, caller handle redirect
 *   ▸ onCancel()    — klik Batal
 */

import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft, ArrowRight, Loader2, AlertTriangle, Check,
    Plus, Trash2, Table2, ChevronDown, ChevronRight, DatabaseZap,
} from "lucide-react";
import { useCategoryRegistry } from "@/lib/workspace/useCategoryRegistry";
import { useDatasetCategoryRegistry } from "@/lib/workspace/useDatasetCategoryRegistry";
import { resolveCategory } from "@/lib/workspace/category-resolver";

interface DatasetInfo {
    id: string;
    friendlyName?: string;
    origin: "user" | "platform" | "legacy";
}

interface ColumnDef {
    name: string;
    type: string;
    mode: "REQUIRED" | "NULLABLE";
    description?: string;
    masterRef?: "UPT" | "ULTG" | "GI" | "Bay";
}

const BQ_TYPES = ["STRING", "INT64", "FLOAT64", "NUMERIC", "BOOL", "DATE", "TIMESTAMP"];

const MASTER_FK_NAME: Record<NonNullable<ColumnDef["masterRef"]>, string> = {
    UPT: "upt_id",
    ULTG: "ultg_id",
    GI: "gi_id",
    Bay: "bay_id",
};

const DEFAULT_COLUMNS: ColumnDef[] = [
    { name: "name", type: "STRING", mode: "REQUIRED", description: "Nama entri" },
];

export interface NewTableWizardProps {
    preselectDs?: string;
    onSuccess: (ds: string, tableId: string) => void;
    onCancel: () => void;
}

export function NewTableWizard({ preselectDs, onSuccess, onCancel }: NewTableWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(preselectDs ? 2 : 1);
    const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
    const [loadingDatasets, setLoadingDatasets] = useState(true);
    /** Background-fetched table counts: { [dsId]: number } */
    const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
    /** Which category sections collapsed — default all expanded (picker UX). */
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const { categories } = useCategoryRegistry();
    const { overlay: dsOverlay } = useDatasetCategoryRegistry();

    const [ds, setDs] = useState(preselectDs ?? "");
    const [id, setId] = useState("");
    const [description, setDescription] = useState("");
    const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
    const [addAudit, setAddAudit] = useState(true);

    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/data-input/datasets")
            .then((r) => r.json())
            .then((res) => {
                if (res.ok) setDatasets(res.datasets.filter((d: DatasetInfo) => d.origin !== "legacy"));
            })
            .finally(() => setLoadingDatasets(false));
    }, []);

    /** Fetch table count per dataset in background. Non-blocking. */
    useEffect(() => {
        if (datasets.length === 0) return;
        // Sequential-ish batch untuk avoid BQ rate-limit spike
        let cancelled = false;
        (async () => {
            for (const d of datasets) {
                if (cancelled) return;
                if (tableCounts[d.id] !== undefined) continue;
                try {
                    const res = await fetch(`/api/data-input/datasets/${encodeURIComponent(d.id)}`).then((r) => r.json());
                    if (cancelled) return;
                    if (res.ok && Array.isArray(res.dataset?.tables)) {
                        setTableCounts((prev) => ({ ...prev, [d.id]: res.dataset.tables.length }));
                    }
                } catch { /* ignore */ }
            }
        })();
        return () => { cancelled = true; };
    }, [datasets]); // eslint-disable-line react-hooks/exhaustive-deps

    /** Group datasets by category (same logic as sidebar). */
    const grouped = useMemo(() => {
        const groups = new Map<string, DatasetInfo[]>();
        for (const c of categories) groups.set(c.key, []);
        for (const d of datasets) {
            const cat = resolveCategory(d.id, { fsCategory: dsOverlay[d.id]?.category });
            const target = groups.has(cat) ? cat : "uncategory";
            if (!groups.has(target)) groups.set(target, []);
            groups.get(target)!.push(d);
        }
        for (const key of groups.keys()) {
            groups.get(key)!.sort((a, b) => {
                const ao = dsOverlay[a.id]?.datasetOrder ?? 9999;
                const bo = dsOverlay[b.id]?.datasetOrder ?? 9999;
                if (ao !== bo) return ao - bo;
                return (a.friendlyName ?? a.id).localeCompare(b.friendlyName ?? b.id);
            });
        }
        return groups;
    }, [datasets, dsOverlay, categories]);

    function toggleSection(key: string) {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    function canNext(): boolean {
        if (step === 1) return !!ds;
        if (step === 2) return !!id && /^[a-zA-Z0-9_]+$/.test(id);
        if (step === 3) return columns.length > 0 && columns.every((c) => c.name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c.name));
        return true;
    }

    async function handleSubmit() {
        if (!ds || !id) return;
        setSubmitting(true); setErr(null);
        try {
            const res = await fetch(`/api/data-input/datasets/${encodeURIComponent(ds)}/tables`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id, description, columns, audit: addAudit }),
            }).then((r) => r.json());
            if (!res.ok) throw new Error(res.message || "Gagal");
            onSuccess(ds, id);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    }

    function addColumn() { setColumns((cs) => [...cs, { name: "", type: "STRING", mode: "NULLABLE" }]); }
    function updateColumn(idx: number, patch: Partial<ColumnDef>) {
        setColumns((cs) => cs.map((c, i) => i === idx ? { ...c, ...patch } : c));
    }
    function removeColumn(idx: number) { setColumns((cs) => cs.filter((_, i) => i !== idx)); }

    return (
        <div className="space-y-5">
            {/* Step indicator — monochrome, amber saat active */}
            <ol className="flex items-center gap-2">
                {[
                    { n: 1 as const, label: "Dataset" },
                    { n: 2 as const, label: "Nama" },
                    { n: 3 as const, label: "Kolom" },
                    { n: 4 as const, label: "Review" },
                ].map((s, i, arr) => (
                    <li key={s.n} className="flex items-center gap-2 flex-1">
                        <div className={`ds-transition flex items-center gap-1.5 ${
                            step === s.n ? "text-primary"
                                : step > s.n ? "text-foreground/80"
                                : "text-muted-foreground/60"
                        }`}>
                            <span className={`h-6 w-6 rounded-full border flex items-center justify-center text-xs font-mono ${
                                step === s.n ? "border-primary/60 bg-primary/10"
                                    : step > s.n ? "border-foreground/40 bg-foreground/5"
                                    : "border-border/60"
                            }`}>
                                {step > s.n ? <Check className="h-3 w-3" /> : s.n}
                            </span>
                            <span className="ds-label">{s.label}</span>
                        </div>
                        {i < arr.length - 1 && (
                            <div className={`flex-1 h-px ${step > s.n ? "bg-foreground/20" : "bg-border/50"}`} />
                        )}
                    </li>
                ))}
            </ol>

            <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-4">
                {step === 1 && (
                    <section className="space-y-3">
                        <h2 className="ds-title">Pilih Dataset Parent</h2>
                        <p className="ds-small opacity-70">
                            Table akan dibuat di dalam dataset ini. Grouped by category (ikut sidebar).
                        </p>
                        {loadingDatasets ? (
                            <p className="ds-body opacity-60 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memuat dataset…
                            </p>
                        ) : datasets.length === 0 ? (
                            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <p className="ds-small opacity-80">Belum ada dataset. Buat dataset dulu.</p>
                            </div>
                        ) : (
                            <div className="max-h-[420px] overflow-y-auto pr-1 space-y-3">
                                {categories.map((cat) => {
                                    const inCat = grouped.get(cat.key) ?? [];
                                    if (inCat.length === 0) return null;
                                    const isCollapsed = collapsedSections.has(cat.key);
                                    return (
                                        <section key={cat.key} className="group/sec">
                                            <button
                                                type="button"
                                                onClick={() => toggleSection(cat.key)}
                                                aria-expanded={!isCollapsed}
                                                className="w-full flex items-center gap-1.5 mb-1.5 ds-transition"
                                                title={cat.hint}
                                            >
                                                {isCollapsed
                                                    ? <ChevronRight className="h-3 w-3 shrink-0 opacity-40 group-hover/sec:opacity-80" />
                                                    : <ChevronDown className="h-3 w-3 shrink-0 opacity-40 group-hover/sec:opacity-80" />}
                                                <span className="ds-label shrink-0 text-muted-foreground group-hover/sec:text-primary ds-transition">
                                                    {cat.label}
                                                </span>
                                                <span className="flex-1 h-px mx-1.5 bg-border/40 group-hover/sec:bg-primary/30 ds-transition" />
                                                <span className="ds-small font-mono opacity-50 tabular-nums">
                                                    {inCat.length}
                                                </span>
                                            </button>
                                            {!isCollapsed && (
                                                <ul className="space-y-1 pl-1">
                                                    {inCat.map((d) => {
                                                        const selected = ds === d.id;
                                                        const alias = dsOverlay[d.id]?.alias ?? d.friendlyName ?? d.id;
                                                        const tblCount = tableCounts[d.id];
                                                        return (
                                                            <li key={d.id}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDs(d.id)}
                                                                    className={`ds-transition w-full text-left rounded-md border px-3 py-2 flex items-center gap-2 ${
                                                                        selected
                                                                            ? "border-primary/60 bg-primary/5"
                                                                            : "border-border/50 hover:border-border hover:bg-muted/20"
                                                                    }`}
                                                                >
                                                                    <DatabaseZap className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className={`text-sm truncate ${selected ? "text-foreground font-medium" : "text-foreground"}`}>
                                                                            {alias}
                                                                        </div>
                                                                        {alias !== d.id && (
                                                                            <div className="ds-small font-mono opacity-40 truncate">{d.id}</div>
                                                                        )}
                                                                    </div>
                                                                    <span className="ds-small font-mono opacity-50 tabular-nums shrink-0">
                                                                        {tblCount !== undefined ? `${tblCount} table${tblCount === 1 ? "" : "s"}` : "…"}
                                                                    </span>
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {step === 2 && (
                    <section className="space-y-3">
                        <h2 className="ds-title">Nama + Deskripsi</h2>
                        <Field label="Nama Table" required help="Alphanumeric + underscore. Case sensitive.">
                            <input
                                type="text"
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                placeholder="contoh: daily_report"
                                autoFocus
                                className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 ds-transition"
                            />
                        </Field>
                        <Field label="Deskripsi" help="Tujuan table ini.">
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 ds-transition"
                            />
                        </Field>
                        <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border/40 px-3 py-2 hover:bg-muted/20">
                            <input
                                type="checkbox"
                                checked={addAudit}
                                onChange={(e) => setAddAudit(e.target.checked)}
                                className="mt-0.5"
                            />
                            <div>
                                <p className="ds-label">Tambah kolom audit</p>
                                <p className="ds-small opacity-70">
                                    Otomatis: is_active, valid_from, valid_to, created_by/at, updated_by/at.
                                    Recommended untuk SCD Type 2 + optimistic lock.
                                </p>
                            </div>
                        </label>
                    </section>
                )}

                {step === 3 && (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="ds-title">Define Kolom</h2>
                                <p className="ds-small opacity-70">
                                    Minimal 1 kolom. Tipe CHOICE/REFERENCE bisa di-setup setelah
                                    table jadi via Column Configurator.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addColumn}
                                className="ds-transition inline-flex items-center gap-1 rounded-md border border-primary/40 text-primary px-2 py-1 text-sm hover:bg-primary/10"
                            >
                                <Plus className="h-3 w-3" /> Kolom
                            </button>
                        </div>
                        <div className="grid grid-cols-[1fr_110px_100px_130px_32px] gap-2 items-center ds-small opacity-60 px-1">
                            <span>Nama Kolom</span>
                            <span>Tipe</span>
                            <span>Mode</span>
                            <span>Link ke Master</span>
                            <span></span>
                        </div>
                        <ul className="space-y-1.5">
                            {columns.map((c, i) => (
                                <li key={i} className="grid grid-cols-[1fr_110px_100px_130px_32px] gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="nama_kolom"
                                        value={c.name}
                                        onChange={(e) => updateColumn(i, { name: e.target.value })}
                                        disabled={!!c.masterRef}
                                        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                                    />
                                    <select
                                        value={c.type}
                                        onChange={(e) => updateColumn(i, { type: e.target.value })}
                                        disabled={!!c.masterRef}
                                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                                    >
                                        {BQ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <select
                                        value={c.mode}
                                        onChange={(e) => updateColumn(i, { mode: e.target.value as "REQUIRED" | "NULLABLE" })}
                                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="NULLABLE">Opsional</option>
                                        <option value="REQUIRED">Wajib</option>
                                    </select>
                                    <select
                                        value={c.masterRef ?? ""}
                                        onChange={(e) => {
                                            const mr = (e.target.value || undefined) as ColumnDef["masterRef"];
                                            if (mr) {
                                                updateColumn(i, { masterRef: mr, name: MASTER_FK_NAME[mr], type: "STRING" });
                                            } else {
                                                updateColumn(i, { masterRef: undefined });
                                            }
                                        }}
                                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        title="Link kolom ini ke Master Data — auto FK chain"
                                    >
                                        <option value="">— none —</option>
                                        <option value="UPT">UPT</option>
                                        <option value="ULTG">ULTG</option>
                                        <option value="GI">Gardu Induk</option>
                                        <option value="Bay">Bay</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => removeColumn(i)}
                                        disabled={columns.length === 1}
                                        className="ds-transition rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-30"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <p className="ds-small opacity-70 pt-1">
                            <strong className="text-primary">Link ke Master</strong>: pilih UPT/ULTG/GI/Bay → kolom
                            otomatis jadi FK ke Master Data. Nama + tipe di-lock ke konvensi.
                        </p>
                        {addAudit && (
                            <p className="ds-small opacity-60 mt-2">+ 7 kolom audit otomatis.</p>
                        )}
                    </section>
                )}

                {step === 4 && (
                    <section className="space-y-3">
                        <h2 className="ds-title">Review</h2>
                        <dl className="space-y-2">
                            <Row label="Dataset" value={ds} />
                            <Row label="Table" value={id} />
                            <Row label="Deskripsi" value={description || "(kosong)"} />
                            <Row label="Audit Kolom" value={addAudit ? "Ya (7 kolom)" : "Tidak"} />
                            <Row label="Total Kolom" value={`${columns.length}${addAudit ? " + 7 audit" : ""}`} />
                        </dl>
                        <div className="rounded-md border border-border/40 bg-background/60 p-3">
                            <p className="ds-label mb-2">Schema</p>
                            <ul className="space-y-0.5 ds-small font-mono">
                                <li className="opacity-60">-- PK auto: id (STRING GENERATE_UUID)</li>
                                {columns.map((c, i) => (
                                    <li key={i}>{c.name} : {c.type} {c.mode === "REQUIRED" ? "NOT NULL" : ""}</li>
                                ))}
                                {addAudit && (
                                    <>
                                        <li className="opacity-60 mt-1">-- audit</li>
                                        <li>is_active : BOOL</li>
                                        <li>valid_from : TIMESTAMP</li>
                                        <li>valid_to : TIMESTAMP</li>
                                        <li>created_by : STRING</li>
                                        <li>created_at : TIMESTAMP</li>
                                        <li>updated_by : STRING</li>
                                        <li>updated_at : TIMESTAMP</li>
                                    </>
                                )}
                            </ul>
                        </div>
                    </section>
                )}

                {err && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                        <p className="ds-small text-destructive">{err}</p>
                    </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                    {step > 1 && (
                        <button
                            type="button"
                            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                            className="ds-transition inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Balik
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="ds-transition rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40 disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <div className="flex-1" />
                    {step < 4 ? (
                        <button
                            type="button"
                            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                            disabled={!canNext()}
                            className="ds-transition inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            Lanjut <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="ds-transition inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Buat Table
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="ds-label flex items-center gap-1">
                {label}{required && <span className="text-destructive">*</span>}
            </label>
            {help && <p className="ds-small opacity-60">{help}</p>}
            {children}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-[140px_1fr] gap-3 items-baseline">
            <dt className="ds-label opacity-70">{label}</dt>
            <dd className="ds-body font-mono">{value}</dd>
        </div>
    );
}
