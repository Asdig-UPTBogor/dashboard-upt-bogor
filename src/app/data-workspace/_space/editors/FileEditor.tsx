"use client";

/**
 * FileEditor — upload file ke GCS via /api/workspace/upload (Phase 5).
 *
 * Schema:
 *   columnMeta.file = {
 *     bucket?: string;        // default 'workspace-uploads'
 *     accept?: string[];      // mime types
 *     maxSize?: number;       // bytes
 *     multi?: boolean;
 *   }
 *
 * Storage: GCS path string `gs://bucket/key.ext` (atau JSON array kalau multi).
 *
 * NOTE: backend endpoint `/api/workspace/upload` BELUM ADA. Phase 5 task:
 *   1. Endpoint POST multipart → GCS Storage SDK (signed URL atau direct upload)
 *   2. Return { ok, path: "gs://..." }
 *   3. Update cell value dengan path
 *
 * Sementara ini: menampilkan info pending implementation + skip commit.
 */

import { useRef, useState } from "react";
import { Upload, AlertCircle, FileIcon, X } from "lucide-react";
import type { CellEditorProps } from "./types";

const DEFAULT_ACCEPT = ["image/*", "application/pdf", ".csv", ".xlsx"];
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function FileEditor({ value, onCommit, onCancel, columnMeta }: CellEditorProps) {
    const cfg = columnMeta?.file;
    const accept = cfg?.accept ?? DEFAULT_ACCEPT;
    const maxSize = cfg?.maxSize ?? DEFAULT_MAX_SIZE;
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const cur = value == null ? "" : String(value);

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > maxSize) {
            setError(`File terlalu besar (max ${Math.round(maxSize / 1024 / 1024)}MB)`);
            return;
        }
        setError(null);
        setUploading(true);

        // TODO: POST ke /api/workspace/upload — Phase 5.
        // Sementara hanya simulate dengan path placeholder.
        const placeholderPath = `gs://workspace-uploads/pending/${f.name}`;
        setTimeout(() => {
            setUploading(false);
            onCommit(placeholderPath);
        }, 500);
    };

    const handleClear = () => {
        onCommit(null);
    };

    return (
        <div className="absolute z-30 left-0 top-0 w-[300px] p-3 bg-popover border border-primary rounded shadow-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="ds-label text-xs flex items-center gap-1">
                    <Upload className="h-3 w-3" />
                    File upload
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Close"
                    className="opacity-50 hover:opacity-100"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>

            {cur && !uploading && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded bg-muted/30 border border-border/40">
                    <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1 font-mono">{cur.split("/").pop()}</span>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-[10px] text-destructive hover:underline shrink-0"
                    >
                        clear
                    </button>
                </div>
            )}

            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded border-2 border-dashed border-border/40 hover:border-primary/40 ds-transition text-xs text-muted-foreground hover:text-primary"
            >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : "Click to choose file"}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept={accept.join(",")}
                onChange={handlePick}
                className="hidden"
            />

            {error && (
                <div className="flex items-start gap-1.5 mt-2 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 mt-2">
                Backend upload endpoint pending (Phase 5). Cell value sementara di-isi placeholder GCS path.
            </p>
        </div>
    );
}
