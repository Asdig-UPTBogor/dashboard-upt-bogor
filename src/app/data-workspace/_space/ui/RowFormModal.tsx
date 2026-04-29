"use client";

/**
 * RowFormModal — modal "Tambah row baru" di atas shadcn `Dialog`.
 *
 * Render satu input per visible column, dispatch ke EditorRouter (reuse
 * editor components). Required field ditandai *. Dropdown editors
 * (CHOICE/REFERENCE) tidak auto-open di context modal — `autoFocus={false}`.
 *
 * Submit → call onSubmit(values), parent yg handle POST + close modal.
 * Backdrop / Escape / focus trap / scroll lock di-handle Radix Dialog.
 */

import { useState, useMemo } from "react";
import { Save, Loader2, AlertTriangle, Plus } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import type { ColumnMeta as ColumnSchema, RowData, RowValue } from "@/app/data-input/_workspace/types";
import { EditorRouter } from "../editors/EditorRouter";
import { resolveEditor } from "../core/useSpaceColumns";

interface Props {
    open: boolean;
    columns: ColumnSchema[];
    onClose: () => void;
    onSubmit: (values: RowData) => Promise<void>;
}

export function RowFormModal({ open, columns, onClose, onSubmit }: Props) {
    const [values, setValues] = useState<RowData>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const editableCols = useMemo(() => {
        return columns
            .filter((c) => !c.hidden && !c.readOnly)
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }, [columns]);

    const requiredMissing = useMemo(() => {
        return editableCols
            .filter((c) => c.mode === "REQUIRED")
            .filter((c) => {
                const v = values[c.name];
                return v == null || v === "";
            })
            .map((c) => c.alias ?? c.name);
    }, [editableCols, values]);

    const reset = () => {
        setValues({});
        setError(null);
        setSubmitting(false);
    };

    const handleClose = () => {
        if (submitting) return;
        reset();
        onClose();
    };

    const handleSubmit = async () => {
        if (submitting) return;
        if (requiredMissing.length > 0) {
            setError(`Kolom wajib kosong: ${requiredMissing.join(", ")}`);
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit(values);
            reset();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="shrink-0 flex flex-row items-center gap-3 px-4 py-3 border-b border-border/60 space-y-0">
                    <div className="rounded-md bg-primary/10 border border-primary/30 h-8 w-8 flex items-center justify-center shrink-0">
                        <Plus className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="ds-title">Tambah row baru</DialogTitle>
                        <DialogDescription className="ds-small opacity-60 mt-0.5">
                            {editableCols.length} kolom
                            {requiredMissing.length > 0 && (
                                <span className="text-amber-500 ml-2">· {requiredMissing.length} wajib belum diisi</span>
                            )}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Form */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                    {editableCols.map((col) => {
                        const v = values[col.name];
                        const editor = resolveEditor(col.type);
                        const required = col.mode === "REQUIRED";
                        return (
                            <div key={col.name} className="space-y-1">
                                <label className="ds-label text-xs flex items-center gap-1">
                                    <span>{col.alias ?? col.name}</span>
                                    {required && <span className="text-destructive">*</span>}
                                    {col.alias && (
                                        <span className="opacity-40 font-mono ml-auto">{col.name}</span>
                                    )}
                                </label>
                                <div className="h-8 border border-border/50 rounded overflow-hidden bg-background">
                                    <EditorRouter
                                        editor={editor}
                                        value={v as RowValue | undefined}
                                        onCommit={(next) => setValues((prev) => ({ ...prev, [col.name]: next }))}
                                        onCancel={() => { /* no-op in modal mode */ }}
                                        columnMeta={{
                                            editor,
                                            choices: col.options,
                                            cascade: col.parentColumn && col.optionsMap
                                                ? { parentColumn: col.parentColumn, mapping: col.optionsMap }
                                                : undefined,
                                            reference: col.reference,
                                            required,
                                            schema: col,
                                        }}
                                        required={required}
                                        autoFocus={false}
                                    />
                                </div>
                                {col.description && (
                                    <p className="text-[11px] text-muted-foreground/70">{col.description}</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Error + Footer */}
                {error && (
                    <div className="shrink-0 mx-4 my-2 flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}
                <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-border/60">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="ds-interactive ds-press ds-focus rounded px-3 h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || requiredMissing.length > 0}
                        className="ds-interactive ds-press ds-focus rounded inline-flex items-center gap-1.5 px-3 h-7 text-xs border border-primary/50 bg-primary/15 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Simpan
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
