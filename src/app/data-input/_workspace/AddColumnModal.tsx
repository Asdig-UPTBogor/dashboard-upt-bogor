"use client";

/**
 * AddColumnModal — wizard tambah kolom ke BQ table (ALTER TABLE ADD COLUMN).
 *
 * Field minimal:
 *   - Nama kolom (alphanumeric + underscore)
 *   - Tipe (Teks / Angka / Tanggal / Pilihan tunggal / Pilihan dari tabel lain / dst.)
 *   - Mode (Wajib / Opsional)
 *   - Deskripsi (opsional)
 *
 * Setup detail (opsi pilihan, sumber tabel, dll.) dilakukan SETELAH kolom dibuat,
 * lewat panel Atur Kolom. Drop "Link ke Master" inline — kelola di panel dedicated
 * supaya pintu konfigurasi cuma satu (post-feedback 2026-04-26).
 *
 * Submit → POST /api/data-input/datasets/[ds]/tables/[t]/columns
 */

import { useEffect, useRef, useState } from "react";
import { X, Save, Loader2, AlertTriangle, Plus } from "lucide-react";
import { apiFetch, formatApiError } from "@/lib/api-client";

type ColumnTypeOption =
    | "STRING" | "INT64" | "FLOAT64" | "NUMERIC" | "BOOL"
    | "DATE" | "TIMESTAMP" | "CHOICE" | "REFERENCE" | "URL" | "RICH_TEXT";

const TYPE_OPTIONS: Array<{ value: ColumnTypeOption; label: string }> = [
    { value: "STRING", label: "Teks" },
    { value: "INT64", label: "Angka bulat" },
    { value: "FLOAT64", label: "Angka desimal" },
    { value: "NUMERIC", label: "Angka presisi" },
    { value: "BOOL", label: "Ya / Tidak" },
    { value: "DATE", label: "Tanggal" },
    { value: "TIMESTAMP", label: "Tanggal & jam" },
    { value: "CHOICE", label: "Pilihan tunggal" },
    { value: "REFERENCE", label: "Pilihan dari tabel lain" },
    { value: "URL", label: "URL" },
    { value: "RICH_TEXT", label: "Teks panjang" },
];

interface Props {
    open: boolean;
    dataset: string;
    table: string;
    onClose: () => void;
    onSaved: () => void;
}

export function AddColumnModal({ open, dataset, table, onClose, onSaved }: Props) {
    const firstFieldRef = useRef<HTMLInputElement | null>(null);
    const [name, setName] = useState("");
    const [type, setType] = useState<ColumnTypeOption>("STRING");
    const [mode, setMode] = useState<"REQUIRED" | "NULLABLE">("NULLABLE");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setName(""); setType("STRING"); setMode("NULLABLE");
            setDescription(""); setErr(null);
            setTimeout(() => firstFieldRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !submitting) onClose(); }
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, submitting]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            setErr("Nama kolom hanya boleh huruf, angka, dan underscore (tidak boleh diawali angka)");
            return;
        }
        setSubmitting(true); setErr(null);
        try {
            // CHOICE / REFERENCE / URL / RICH_TEXT = STRING di BQ + overlay tipe.
            // Kirim ke server: nama + BQ-native type, overlay tipe akan dikonfigurasi
            // user setelahnya via panel Atur Kolom.
            const isOverlayType = type === "CHOICE" || type === "REFERENCE" || type === "URL" || type === "RICH_TEXT";
            const bqType = isOverlayType ? "STRING" : type;
            await apiFetch(
                `/api/data-input/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/columns`,
                {
                    method: "POST",
                    body: {
                        name,
                        type: bqType,
                        mode,
                        description: description || undefined,
                        // Kirim overlay type kalau berbeda dgn BQ native
                        overlayType: isOverlayType ? type : undefined,
                        actor: "admin",
                    },
                    timeoutMs: 20_000,
                }
            );
            onSaved();
            onClose();
        } catch (e2) {
            setErr(formatApiError(e2));
        } finally {
            setSubmitting(false);
        }
    }

    if (!open) return null;

    return (
        <>
            <div onClick={() => !submitting && onClose()} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
            <div
                role="dialog"
                aria-label="Tambah kolom"
                className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-xl shadow-2xl flex flex-col"
            >
                <header className="shrink-0 border-b border-border px-5 py-3 flex items-center gap-3">
                    <Plus className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                        <h2 className="ds-title">Tambah kolom</h2>
                        <p className="ds-small opacity-60 font-mono">{dataset}.{table}</p>
                    </div>
                    <button onClick={onClose} disabled={submitting}
                        className="ds-transition rounded-md p-1.5 hover:bg-muted/40 text-muted-foreground hover:text-foreground disabled:opacity-50">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    <Field label="Nama kolom" required help="Huruf, angka, dan underscore. Tidak boleh diawali angka.">
                        <input
                            ref={firstFieldRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="contoh: voltage"
                            disabled={submitting}
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Tipe" required>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as ColumnTypeOption)}
                                disabled={submitting}
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Mode">
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value as "REQUIRED" | "NULLABLE")}
                                disabled={submitting}
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                <option value="NULLABLE">Opsional</option>
                                <option value="REQUIRED">Wajib</option>
                            </select>
                        </Field>
                    </div>

                    <Field label="Deskripsi" help="Helper text (opsional)">
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={submitting}
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </Field>

                    {(type === "CHOICE" || type === "REFERENCE") && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-foreground/80">
                            Untuk tipe ini, isi pilihannya di panel <span className="font-medium">Atur Kolom</span> setelah kolom dibuat.
                        </div>
                    )}

                    {err && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            <p className="ds-small text-destructive">{err}</p>
                        </div>
                    )}
                </form>

                <footer className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2">
                    <button type="button" onClick={onClose} disabled={submitting}
                        className="ds-transition rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40 disabled:opacity-50">
                        Batal
                    </button>
                    <div className="flex-1" />
                    <button type="button" onClick={handleSubmit as unknown as () => void} disabled={submitting}
                        className="ds-transition inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Simpan kolom
                    </button>
                </footer>
            </div>
        </>
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
