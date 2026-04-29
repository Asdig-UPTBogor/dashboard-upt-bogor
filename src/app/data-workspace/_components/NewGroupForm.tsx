"use client";

/**
 * NewGroupForm — modal form untuk create category (group) baru.
 *
 *  Pure component, props-driven. Caller render di Modal.
 *  POST /api/workspace/categories.
 */

import { useState } from "react";
import { Loader2, Check, AlertTriangle } from "lucide-react";

export interface NewGroupFormProps {
    onSuccess: (key: string) => void;
    onCancel: () => void;
    /** Existing categories count — dipakai untuk default order. */
    existingCount: number;
}

export function NewGroupForm({ onSuccess, onCancel, existingCount }: NewGroupFormProps) {
    const [key, setKey] = useState("");
    const [label, setLabel] = useState("");
    const [hint, setHint] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const slug = key.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
        if (!slug || !label.trim()) {
            setErr("Key + label wajib diisi");
            return;
        }
        setSubmitting(true);
        setErr(null);
        try {
            const res = await fetch("/api/workspace/categories", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    key: slug,
                    label: label.trim(),
                    order: existingCount + 1,
                    hint: hint.trim() || label.trim(),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            onSuccess(slug);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <Field
                label="Key (slug)"
                required
                help="Lowercase + dash. Internal ID — jangan ubah setelah ada dataset assigned."
            >
                <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="contoh: substation-protection"
                    autoFocus
                    disabled={submitting}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ds-transition"
                />
            </Field>

            <Field label="Display label" required help="Nama yang muncul di sidebar.">
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="contoh: Substation Protection"
                    disabled={submitting}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ds-transition"
                />
            </Field>

            <Field label="Hint (opsional)" help="Tooltip saat hover group header.">
                <input
                    type="text"
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="Singkat, jelaskan isi group ini"
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
                    className="ds-btn ds-btn-secondary ds-btn-sm"
                >
                    Batal
                </button>
                <div className="flex-1" />
                <button
                    type="submit"
                    disabled={submitting || !key || !label}
                    className="ds-btn ds-btn-primary ds-btn-sm"
                >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Create group
                </button>
            </div>
        </form>
    );
}

function Field({ label, required, help, children }: {
    label: string;
    required?: boolean;
    help?: string;
    children: React.ReactNode;
}) {
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
