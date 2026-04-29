"use client";

/**
 * BulkImportModal — modal overlay 5-step untuk bulk CSV import ke BQ table.
 *
 * Migrate dari /data-input/[ds]/[t]/import page — sekarang jadi modal di
 * dalam workspace (user tidak leave halaman grid).
 *
 * Strategies:
 *   ▸ INSERT (append)      — default, streaming insert
 *   ▸ UPSERT (by key col)  — BQ MERGE, butuh natural key (iter 2)
 *   ▸ REPLACE ALL (admin)  — soft-delete rows existing + insert batch baru
 */

import { useEffect, useState } from "react";
import {
    Upload, ArrowLeft, ArrowRight, Check, AlertTriangle, Loader2,
    FileText, Download, Database, X, Trash2, Plus, RefreshCw,
} from "lucide-react";
import { parseCsv, downloadCsv, stringifyCsv } from "@/lib/csv";
import { apiFetch, formatApiError } from "@/lib/api-client";
import type { ColumnMeta } from "./types";

type Step = 1 | 2 | 3 | 4 | 5;
type Mode = "insert" | "upsert" | "replace";

interface ValidationError {
    rowIdx: number;
    column: string;
    message: string;
}

interface Props {
    dataset: string;
    table: string;
    onClose: () => void;
    onDone: () => void;
}

const BATCH_CHUNK = 2000;

/**
 * BulkImportPanel — wizard 5-step Bulk Import CSV → BQ.
 *
 * Rendered sebagai konten WorkspaceDrawer (pattern konsisten dengan Panel Kolom).
 * Dulu modal standalone (BulkImportModal), migrated 2026-04-24 supaya UX
 * seragam dengan tool lain di Sidebar Workspace.
 */
export function BulkImportPanel({ dataset, table, onClose, onDone }: Props) {
    const open = true; // drawer wrapper control open; komponen ini selalu render saat dipasang
    const [step, setStep] = useState<Step>(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);
    const [columns, setColumns] = useState<ColumnMeta[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [skipRowsWithErrors, setSkipRowsWithErrors] = useState(true);
    const [mode, setMode] = useState<Mode>("insert");
    const [committing, setCommitting] = useState(false);
    const [result, setResult] = useState<{ inserted: number; failed: number; errors: string[]; replaced?: number } | null>(null);
    const [err, setErr] = useState<string | null>(null);

    // Reset state saat modal closed/opened
    useEffect(() => {
        if (!open) return;
        setStep(1);
        setFile(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setMapping({});
        setValidationErrors([]);
        setMode("insert");
        setResult(null);
        setErr(null);
    }, [open]);

    // Fetch BQ schema once when open
    useEffect(() => {
        if (!open || !dataset || !table) return;
        apiFetch<{ ok: boolean; columns: ColumnMeta[] }>(
            `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}`,
            { timeoutMs: 20_000 },
        )
            .then((r) => setColumns(r.columns))
            .catch((e) => setErr(formatApiError(e)));
    }, [open, dataset, table]);

    // Esc close
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !committing) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, committing]);

    async function handleFile(f: File) {
        setFile(f);
        setErr(null);
        try {
            const text = await f.text();
            const parsed = parseCsv(text);
            setCsvHeaders(parsed.headers);
            setCsvRows(parsed.rows);

            const autoMap: Record<string, string> = {};
            for (const ch of parsed.headers) {
                const chLower = ch.toLowerCase().replace(/\s+/g, "_");
                const match = columns.find(
                    (c) => c.name.toLowerCase() === chLower ||
                           c.alias?.toLowerCase() === ch.toLowerCase()
                );
                if (match) autoMap[ch] = match.name;
            }
            setMapping(autoMap);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Gagal parse CSV");
        }
    }

    function validate(): ValidationError[] {
        const errs: ValidationError[] = [];
        const editableCols = columns.filter((c) => !c.readOnly);
        csvRows.forEach((row, idx) => {
            for (const csvHeader of Object.keys(mapping)) {
                const bqCol = mapping[csvHeader];
                if (!bqCol) continue;
                const col = editableCols.find((c) => c.name === bqCol);
                if (!col) continue;
                const val = row[csvHeader] ?? "";
                if (col.mode === "REQUIRED" && (val === "" || val == null)) {
                    errs.push({ rowIdx: idx, column: bqCol, message: "kosong (wajib)" });
                    continue;
                }
                if (val === "") continue;
                if (col.type === "INT64" && !/^-?\d+$/.test(val.trim())) {
                    errs.push({ rowIdx: idx, column: bqCol, message: `"${val}" bukan bilangan bulat` });
                }
                if ((col.type === "FLOAT64" || col.type === "NUMERIC") && isNaN(Number(val))) {
                    errs.push({ rowIdx: idx, column: bqCol, message: `"${val}" bukan angka` });
                }
                if (col.type === "BOOL" && !/^(true|false|yes|no|1|0|y|n)$/i.test(val.trim())) {
                    errs.push({ rowIdx: idx, column: bqCol, message: `"${val}" bukan boolean` });
                }
                if (col.type === "DATE" && isNaN(Date.parse(val))) {
                    errs.push({ rowIdx: idx, column: bqCol, message: `"${val}" bukan format tanggal valid` });
                }
            }
        });
        return errs;
    }

    async function handleCommit() {
        if (!dataset || !table) return;

        if (mode === "replace") {
            const ok = confirm(
                `Replace All will deactivate ALL existing rows in ${dataset}.${table} (is_active=false), `
                + `then insert ${csvRows.length} new rows.\n\nThis cannot be undone. Proceed?`
            );
            if (!ok) return;
        }

        setCommitting(true);
        setErr(null);

        const errSet = new Set(validationErrors.map((e) => e.rowIdx));
        const rowsToCommit = skipRowsWithErrors
            ? csvRows.filter((_, idx) => !errSet.has(idx))
            : csvRows;

        const typedRows = rowsToCommit.map((row) => {
            const out: Record<string, unknown> = {};
            for (const [csvHeader, bqCol] of Object.entries(mapping)) {
                if (!bqCol) continue;
                const col = columns.find((c) => c.name === bqCol);
                if (!col || col.readOnly) continue;
                const val = row[csvHeader];
                if (val === "" || val == null) continue;
                if (col.type === "INT64") out[bqCol] = parseInt(val, 10);
                else if (col.type === "FLOAT64" || col.type === "NUMERIC") out[bqCol] = parseFloat(val);
                else if (col.type === "BOOL") out[bqCol] = /^(true|yes|y|1)$/i.test(val.trim());
                else out[bqCol] = val;
            }
            return out;
        });

        let totalInserted = 0;
        let replaced = 0;
        const allErrors: string[] = [];

        try {
            // REPLACE ALL: deactivate existing rows first
            if (mode === "replace") {
                const resp = await apiFetch<{ ok: boolean; deactivated: number }>(
                    `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/rows/replace`,
                    { method: "POST", body: { actor: "admin" }, timeoutMs: 60_000 }
                );
                replaced = resp.deactivated ?? 0;
            }

            for (let i = 0; i < typedRows.length; i += BATCH_CHUNK) {
                const chunk = typedRows.slice(i, i + BATCH_CHUNK);
                const res = await apiFetch<{ ok: boolean; inserted: number; failed: Array<{ index: number; errors: string[] }> }>(
                    `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/rows/batch`,
                    { method: "POST", body: { rows: chunk, actor: "admin" }, timeoutMs: 60_000 }
                );
                totalInserted += res.inserted;
                if (res.failed && res.failed.length > 0) {
                    for (const f of res.failed) {
                        allErrors.push(`Batch ${Math.floor(i / BATCH_CHUNK) + 1} row ${f.index}: ${f.errors.join(", ")}`);
                    }
                }
            }

            setResult({
                inserted: totalInserted,
                failed: typedRows.length - totalInserted,
                errors: allErrors,
                replaced: mode === "replace" ? replaced : undefined,
            });
            setStep(5);
        } catch (e) {
            setErr(formatApiError(e));
        } finally {
            setCommitting(false);
        }
    }

    if (!open) return null;

    const mappedCount = Object.values(mapping).filter(Boolean).length;
    const ds = dataset;
    const t = table;

    return (
        <div className="relative flex flex-col h-full">
            {/* Sub-header dalam drawer — Upload icon + target table info
             *  (drawer outer sudah punya title "Import CSV" dari WorkspaceDrawer) */}
            <div className="shrink-0 flex items-center gap-2 border-b border-border/60 px-4 py-2 bg-background/30">
                <Upload className="h-4 w-4 text-primary shrink-0" />
                <p className="ds-small opacity-70 font-mono truncate">{ds}.{t}</p>
            </div>

            {/* Step indicator */}
                <ol className="shrink-0 flex items-center gap-2 border-b border-border/60 bg-background/60 px-5 py-2.5">
                    {[
                        { n: 1 as Step, label: "Unggah" },
                        { n: 2 as Step, label: "Cocokkan" },
                        { n: 3 as Step, label: "Validasi" },
                        { n: 4 as Step, label: "Tinjau" },
                        { n: 5 as Step, label: "Hasil" },
                    ].map((s, i, arr) => (
                        <li key={s.n} className="flex items-center gap-2 flex-1">
                            <div className={`flex items-center gap-1.5 ${
                                step === s.n ? "text-primary" : step > s.n ? "text-emerald-400" : "text-muted-foreground opacity-50"
                            }`}>
                                <span className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-mono ${
                                    step === s.n ? "border-primary bg-primary/10"
                                        : step > s.n ? "border-emerald-400/40 bg-emerald-400/10"
                                        : "border-border"
                                }`}>
                                    {step > s.n ? <Check className="h-2.5 w-2.5" /> : s.n}
                                </span>
                                <span className="ds-small">{s.label}</span>
                            </div>
                            {i < arr.length - 1 && (
                                <div className={`flex-1 h-px ${step > s.n ? "bg-emerald-400/40" : "bg-border/60"}`} />
                            )}
                        </li>
                    ))}
                </ol>

                {err && (
                    <div className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-5 py-2 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                        <p className="ds-small text-destructive">{err}</p>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-5">
                    {step === 1 && (
                        <section className="space-y-3">
                            <p className="ds-small opacity-70">
                                Pick a .csv file. First row = header. Max 5000 rows per file (auto-split).
                            </p>
                            <label className="block cursor-pointer border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-primary/40 hover:bg-primary/5 ds-transition">
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <p className="ds-body">Click to pick a CSV file</p>
                                <p className="ds-small opacity-60">or drag-drop here</p>
                                <input
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) void handleFile(f);
                                    }}
                                    className="hidden"
                                />
                            </label>
                            {file && (
                                <div className="rounded-md border border-border px-3 py-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="ds-body flex-1">{file.name}</span>
                                    <span className="ds-small opacity-60">{csvRows.length} baris · {csvHeaders.length} kolom</span>
                                </div>
                            )}
                        </section>
                    )}

                    {step === 2 && (
                        <section className="space-y-3">
                            <p className="ds-small opacity-70">
                                Headers auto-matched by name. Override if wrong. Columns marked — will be skipped.
                            </p>
                            <div className="rounded-md border border-border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/40">
                                        <tr>
                                            <th className="text-left px-3 py-2 ds-label">CSV Header</th>
                                            <th className="text-left px-3 py-2 ds-label">→ Table Column</th>
                                            <th className="text-left px-3 py-2 ds-label">Sample</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvHeaders.map((h) => (
                                            <tr key={h} className="border-t border-border/40">
                                                <td className="px-3 py-2 font-mono">{h}</td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={mapping[h] ?? ""}
                                                        onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                                                        className="rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                                    >
                                                        <option value="">— Skip —</option>
                                                        {columns.filter((c) => !c.readOnly).map((c) => (
                                                            <option key={c.name} value={c.name}>
                                                                {c.name}{c.alias ? ` (${c.alias})` : ""} · {c.type}{c.mode === "REQUIRED" ? " *" : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2 ds-small opacity-70 truncate max-w-xs">
                                                    {csvRows[0]?.[h] ?? "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="ds-small opacity-60">
                                {mappedCount} of {csvHeaders.length} columns mapped.
                            </p>
                        </section>
                    )}

                    {step === 3 && (
                        <section className="space-y-3">
                            {validationErrors.length === 0 ? (
                                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-start gap-2">
                                    <Check className="h-4 w-4 text-emerald-400 mt-0.5" />
                                    <p className="ds-body text-emerald-300">
                                        Semua {csvRows.length} baris valid. Lanjut ke simpan.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5" />
                                        <div>
                                            <p className="ds-body text-amber-200">
                                                {validationErrors.length} error pada {new Set(validationErrors.map((e) => e.rowIdx)).size} baris.
                                            </p>
                                            <label className="ds-small flex items-center gap-2 mt-1">
                                                <input type="checkbox" checked={skipRowsWithErrors}
                                                    onChange={(e) => setSkipRowsWithErrors(e.target.checked)} />
                                                Skip rows with errors on commit
                                            </label>
                                        </div>
                                    </div>
                                    <div className="rounded-md border border-border max-h-64 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 sticky top-0">
                                                <tr>
                                                    <th className="text-left px-3 py-2 ds-label">Row</th>
                                                    <th className="text-left px-3 py-2 ds-label">Column</th>
                                                    <th className="text-left px-3 py-2 ds-label">Issue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {validationErrors.slice(0, 200).map((e, i) => (
                                                    <tr key={i} className="border-t border-border/40">
                                                        <td className="px-3 py-1.5 font-mono">{e.rowIdx + 2}</td>
                                                        <td className="px-3 py-1.5 font-mono">{e.column}</td>
                                                        <td className="px-3 py-1.5 text-destructive ds-small">{e.message}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const errorRows = Array.from(new Set(validationErrors.map((e) => e.rowIdx)))
                                                .map((idx) => {
                                                    const row = csvRows[idx];
                                                    const errs = validationErrors.filter((e) => e.rowIdx === idx);
                                                    return { ...row, __errors: errs.map((e) => `${e.column}: ${e.message}`).join("; ") };
                                                });
                                            const csv = stringifyCsv([...csvHeaders, "__errors"], errorRows);
                                            downloadCsv(`import_errors_${new Date().toISOString().slice(0, 10)}`, csv);
                                        }}
                                        className="ds-btn ds-btn-secondary ds-btn-sm"
                                    >
                                        <Download className="h-3.5 w-3.5" /> Unduh baris bermasalah
                                    </button>
                                </>
                            )}
                        </section>
                    )}

                    {step === 4 && (
                        <section className="space-y-4">
                            <div>
                                <h3 className="ds-label mb-2">Commit Mode</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <ModeCard
                                        active={mode === "insert"}
                                        icon={Plus}
                                        title="Insert"
                                        desc="Append new rows. Existing data untouched."
                                        tone="default"
                                        onClick={() => setMode("insert")}
                                    />
                                    <ModeCard
                                        active={mode === "upsert"}
                                        icon={RefreshCw}
                                        title="Update"
                                        desc="Next iteration — requires natural key config."
                                        tone="muted"
                                        disabled
                                        onClick={() => { /* noop */ }}
                                    />
                                    <ModeCard
                                        active={mode === "replace"}
                                        icon={Trash2}
                                        title="Replace All"
                                        desc="Deactivate all active rows (is_active=false) then insert new batch."
                                        tone="danger"
                                        onClick={() => setMode("replace")}
                                    />
                                </div>
                            </div>

                            <dl className="space-y-2 rounded-md border border-border/40 p-4 bg-background/60">
                                <DlRow label="File" value={file?.name ?? "—"} />
                                <DlRow label="CSV rows" value={String(csvRows.length)} />
                                <DlRow label="Columns mapped" value={String(mappedCount)} />
                                <DlRow label="Validation errors" value={String(validationErrors.length)} />
                                <DlRow label="Rows to commit" value={String(
                                    skipRowsWithErrors
                                        ? csvRows.length - new Set(validationErrors.map((e) => e.rowIdx)).size
                                        : csvRows.length
                                )} />
                                <DlRow label="Target" value={`${ds}.${t}`} />
                                <DlRow label="Mode" value={
                                    mode === "insert" ? "Insert" : mode === "replace" ? "Replace All" : "Update"
                                } />
                            </dl>

                            {mode === "replace" ? (
                                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                                    <p className="ds-small text-destructive">
                                        <strong>Warning.</strong> All active rows will be deactivated
                                        (soft delete: is_active=false). Existing data stays in BigQuery
                                        for audit, but disappears from the workspace.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-start gap-2">
                                    <Database className="h-4 w-4 text-primary mt-0.5" />
                                    <p className="ds-small">
                                        BQ streaming insert (append only). Split into batches of
                                        {" "}{BATCH_CHUNK} rows. New rows enter the streaming buffer for
                                        ~90 seconds before being update-able / delete-able.
                                    </p>
                                </div>
                            )}
                        </section>
                    )}

                    {step === 5 && result && (
                        <section className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {result.replaced != null && (
                                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                                        <p className="ds-label text-amber-300 mb-1">DEACTIVATED</p>
                                        <p className="ds-kpi text-amber-400">{result.replaced}</p>
                                    </div>
                                )}
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                                    <p className="ds-label text-emerald-300 mb-1">INSERTED</p>
                                    <p className="ds-kpi text-emerald-400">{result.inserted}</p>
                                </div>
                                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                                    <p className="ds-label text-destructive mb-1">FAILED</p>
                                    <p className="ds-kpi text-destructive">{result.failed}</p>
                                </div>
                            </div>
                            {result.errors.length > 0 && (
                                <div className="rounded-md border border-destructive/30 max-h-48 overflow-y-auto p-2">
                                    <p className="ds-label mb-1">Error detail:</p>
                                    <ul className="space-y-0.5 ds-small font-mono">
                                        {result.errors.slice(0, 50).map((e, i) => (
                                            <li key={i} className="text-destructive">• {e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                <footer className="shrink-0 flex items-center gap-2 border-t border-border px-4 py-2.5 bg-background/60">
                    {step > 1 && step < 5 && (
                        <button
                            type="button"
                            onClick={() => setStep((s) => (s - 1) as Step)}
                            disabled={committing}
                            className="ds-btn ds-btn-secondary ds-btn-sm"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back
                        </button>
                    )}
                    {step < 5 && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={committing}
                            className="ds-btn ds-btn-ghost ds-btn-sm"
                        >
                            <X className="h-3.5 w-3.5" /> Batal
                        </button>
                    )}
                    <div className="flex-1" />
                    {step === 4 && (
                        <button
                            type="button"
                            onClick={handleCommit}
                            disabled={committing || csvRows.length === 0}
                            className={`ds-btn ds-btn-sm ${
                                mode === "replace" ? "ds-btn-destructive" : "ds-btn-primary"
                            }`}
                        >
                            {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {mode === "replace" ? "Ganti Semua" : "Simpan"}
                        </button>
                    )}
                    {step < 4 && (
                        <button
                            type="button"
                            disabled={
                                (step === 1 && csvRows.length === 0) ||
                                (step === 2 && mappedCount === 0)
                            }
                            onClick={() => {
                                if (step === 2) setValidationErrors(validate());
                                setStep((s) => (s + 1) as Step);
                            }}
                            className="ds-btn ds-btn-primary ds-btn-sm"
                        >
                            Lanjut <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {step === 5 && (
                        <>
                            <button
                                type="button"
                                onClick={() => { setStep(1); setFile(null); setResult(null); setCsvRows([]); setCsvHeaders([]); setMapping({}); }}
                                className="ds-btn ds-btn-secondary ds-btn-sm"
                            >
                                Impor Lagi
                            </button>
                            <button
                                type="button"
                                onClick={() => { onDone(); onClose(); }}
                                className="ds-btn ds-btn-primary ds-btn-sm"
                            >
                                Lihat Tabel →
                            </button>
                        </>
                    )}
                </footer>
        </div>
    );
}

function DlRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-[180px_1fr] gap-3 items-baseline">
            <dt className="ds-label opacity-70">{label}</dt>
            <dd className="ds-body font-mono">{value}</dd>
        </div>
    );
}

function ModeCard({
    active, disabled, icon: Icon, title, desc, tone, onClick,
}: {
    active: boolean;
    disabled?: boolean;
    icon: typeof Plus;
    title: string;
    desc: string;
    tone: "default" | "muted" | "danger";
    onClick: () => void;
}) {
    const toneBorder = tone === "danger"
        ? active ? "border-destructive/60 bg-destructive/10" : "border-border hover:border-destructive/40"
        : tone === "muted"
        ? "border-border/40 opacity-50"
        : active ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/40";
    const iconTone = tone === "danger" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "text-primary";
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`ds-transition rounded-lg border-2 p-3 text-left disabled:cursor-not-allowed ${toneBorder}`}
        >
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 ${iconTone}`} />
                <span className="ds-label font-bold">{title}</span>
            </div>
            <p className="ds-small opacity-70 leading-snug">{desc}</p>
        </button>
    );
}
