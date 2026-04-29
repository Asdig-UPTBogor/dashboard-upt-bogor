"use client";

/**
 * BQTableView — Detail per-table BQ: Schema + Data Preview (tab orchestrator).
 * Props: dataset, table.
 *
 * Tab:
 *   - Schema: kolom name + type + mode + description
 *   - Data Preview: page-able rows 100 per halaman (GET /api/data-connector-v5/bq-preview)
 *
 * User ga perlu buka BQ console buat lihat isi tabel.
 * Ref: Spreadsheet Sync/docs/SS_V5_SYSTEM.md §12a.
 */

import { useState } from "react";
import {
    Database, Columns, TableProperties, RefreshCw,
} from "lucide-react";
import { SchemaTab } from "./SchemaTab";
import { DataPreviewTab } from "./DataPreviewTab";
import { useTableMeta, type TabKind } from "./useTableMeta";

export default function BQTableView({
    dataset,
    table,
}: {
    dataset: string;
    table: string;
}) {
    const [tab, setTab] = useState<TabKind>("schema");
    const [page, setPage] = useState(1);

    const {
        schema,
        schemaLoading,
        preview,
        previewLoading,
        error,
        loadPreview,
    } = useTableMeta(dataset, table, tab, page);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">
            {/* Header */}
            <header className="flex items-start gap-3">
                <Database className="h-5 w-5 text-indigo-400 mt-1" />
                <div className="flex-1">
                    <p className="ds-small opacity-60 font-mono">{dataset}</p>
                    <h2 className="ds-heading">{table}</h2>
                    <p className="ds-small opacity-70 mt-1">
                        {schema?.nodeType && (
                            <>
                                Node type: <span className="font-mono">{schema.nodeType}</span> ·{" "}
                            </>
                        )}
                        {schema?.columns?.length ?? 0} kolom
                        {preview?.totalRows != null && (
                            <> · {preview.totalRows.toLocaleString("id-ID")} rows total</>
                        )}
                    </p>
                </div>
                {tab === "data" && (
                    <button
                        onClick={() => loadPreview(page)}
                        disabled={previewLoading}
                        className="ds-transition cursor-pointer flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                )}
            </header>

            {/* Tab toggle */}
            <div className="flex items-center gap-1 border-b border-white/10">
                <TabButton
                    active={tab === "schema"}
                    onClick={() => setTab("schema")}
                    icon={<Columns className="w-3.5 h-3.5" />}
                    label="Schema"
                />
                <TabButton
                    active={tab === "data"}
                    onClick={() => setTab("data")}
                    icon={<TableProperties className="w-3.5 h-3.5" />}
                    label="Data Preview"
                />
            </div>

            {/* Error banner */}
            {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 ds-small text-red-200">
                    {error}
                </div>
            )}

            {/* Content */}
            {tab === "schema" && <SchemaTab schema={schema} loading={schemaLoading} />}
            {tab === "data" && (
                <DataPreviewTab
                    preview={preview}
                    loading={previewLoading}
                    page={page}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => {
                        const totalPages = Math.max(
                            1,
                            Math.ceil((preview?.totalRows ?? 0) / 100)
                        );
                        setPage((p) => Math.min(totalPages, p + 1));
                    }}
                />
            )}
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`ds-transition cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 ${
                active
                    ? "border-indigo-500 text-indigo-300"
                    : "border-transparent opacity-70 hover:opacity-100"
            }`}
        >
            {icon}
            {label}
        </button>
    );
}
