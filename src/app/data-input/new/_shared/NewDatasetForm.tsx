"use client";

/**
 * NewDatasetForm — reusable form untuk create BQ dataset.
 *
 *  Pure component tanpa chrome/breadcrumb. Caller provides outer layout.
 *  Props:
 *   ▸ onSuccess(id)  — dipanggil setelah POST sukses, caller handle redirect
 *   ▸ onCancel()     — klik Batal, caller handle navigation
 */

import { useState } from "react";
import { Loader2, AlertTriangle, Check } from "lucide-react";

const LOCATIONS = [
    { value: "asia-southeast2", label: "asia-southeast2 (Jakarta) — default" },
    { value: "asia-southeast1", label: "asia-southeast1 (Singapore)" },
    { value: "US", label: "US (multi-region)" },
    { value: "EU", label: "EU (multi-region)" },
];

export interface NewDatasetFormProps {
    onSuccess: (id: string) => void;
    onCancel: () => void;
}

export function NewDatasetForm({ onSuccess, onCancel }: NewDatasetFormProps) {
    const [id, setId] = useState("");
    const [friendlyName, setFriendlyName] = useState("");
    const [location, setLocation] = useState("asia-southeast2");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    function validateId(v: string): string | null {
        if (!v) return "Nama dataset wajib";
        if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Hanya huruf, angka, underscore";
        if (v.length > 1024) return "Maksimal 1024 karakter";
        return null;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const idErr = validateId(id);
        if (idErr) { setErr(idErr); return; }
        setErr(null);
        setSubmitting(true);
        try {
            const res = await fetch("/api/data-input/datasets", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id, location, description, friendlyName, ownerEmail: "admin" }),
            }).then((r) => r.json());
            if (!res.ok) throw new Error(res.message || "Gagal");
            onSuccess(id);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-4">
            <Field label="Nama Dataset" required help="Alphanumeric + underscore. Jadi bagian URL.">
                <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="contoh: Operasional_Harian"
                    disabled={submitting}
                    autoFocus
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ds-transition"
                />
            </Field>

            <Field label="Nama Tampilan (opsional)" help="Lebih mudah dibaca (boleh spasi, tanda baca).">
                <input
                    type="text"
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    placeholder="contoh: Operasional Harian UPT Bogor"
                    disabled={submitting}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ds-transition"
                />
            </Field>

            <Field label="Location" required help="Region BQ. Sesuaikan dengan dataset lain untuk JOIN hemat.">
                <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ds-transition"
                >
                    {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
            </Field>

            <Field label="Deskripsi" help="Tujuan dataset ini (ditampilkan di card + tooltip).">
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={submitting}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ds-transition"
                />
            </Field>

            {err && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="ds-small text-destructive">{err}</p>
                </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting}
                    className="ds-transition rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40 disabled:opacity-50"
                >
                    Batal
                </button>
                <div className="flex-1" />
                <button
                    type="submit"
                    disabled={submitting}
                    className="ds-transition inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Buat Dataset
                </button>
            </div>
        </form>
    );
}

function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="ds-label flex items-center gap-1">
                {label}
                {required && <span className="text-destructive">*</span>}
            </label>
            {help && <p className="ds-small opacity-60">{help}</p>}
            {children}
        </div>
    );
}
