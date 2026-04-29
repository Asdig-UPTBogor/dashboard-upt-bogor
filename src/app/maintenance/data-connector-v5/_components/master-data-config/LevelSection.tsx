"use client";

/**
 * LevelSection — rendering per level (UPT/ULTG/GI/Bay).
 * Dataset picker + Table picker + Name column + Parent columns + AttrsEditor.
 *
 * Default: EXPANDED. Boleh collapse via toggle chevron di header.
 * Validation inline (red border + text) di setiap field yg missing.
 */

import { useState } from "react";
import {
    Database,
    Table2,
    ChevronDown,
    CheckCircle2,
    XCircle,
    AlertCircle,
} from "lucide-react";
import { LEVEL_META, PARENT_REQS } from "./constants";
import { AttrsEditor } from "./AttrsEditor";
import type {
    ColumnOption,
    DatasetOption,
    Level,
    LevelConfig,
    TableOption,
    TestResultEntry,
} from "./types";

/** Input/select shared class — data-dense, 36px height (sama dengan data-level-config/EditPanel). */
const INPUT_CLS =
    "ds-body w-full h-9 rounded-md border bg-background px-2.5 outline-none " +
    "focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/60 ds-transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT_OK = "border-border";
const INPUT_ERR = "border-red-500/50 focus:ring-red-500/40 focus:border-red-500/60";

export function LevelSection({
    level,
    cfg,
    datasets,
    tables,
    tablesLoading,
    columns,
    columnsLoading,
    testResult,
    fieldErrors,
    onChangeDataset,
    onChangeTable,
    onChangeColumnName,
    onChangeParent,
    onAttrChange,
    onAttrRename,
    onAttrRemove,
}: {
    level: Level;
    cfg: LevelConfig;
    datasets: DatasetOption[];
    tables: TableOption[];
    tablesLoading: boolean;
    columns: ColumnOption[];
    columnsLoading: boolean;
    testResult?: TestResultEntry;
    fieldErrors: string[];
    onChangeDataset: (v: string) => void;
    onChangeTable: (v: string) => void;
    onChangeColumnName: (v: string) => void;
    onChangeParent: (parent: "upt" | "ultg" | "gi", v: string) => void;
    onAttrChange: (key: string, colName: string) => void;
    onAttrRename: (oldKey: string, newKey: string) => void;
    onAttrRemove: (key: string) => void;
}) {
    const meta = LEVEL_META[level];
    const Icon = meta.Icon;
    const colNames = columns.map((c) => c.name);
    const parentReqs = PARENT_REQS[level];
    const [collapsed, setCollapsed] = useState(false);

    const completed = !!(cfg.dataset && cfg.table && cfg.columns.name);
    const hasErrors = fieldErrors.length > 0;

    // Per-field error flags (derived dari hook validation)
    const errDataset = !cfg.dataset;
    const errTable = !!cfg.dataset && !cfg.table;
    const errName = !!cfg.table && !cfg.columns.name;
    const errParent = (p: "upt" | "ultg" | "gi") =>
        !!cfg.table && parentReqs.includes(p) && !cfg.columns.parentNames?.[p];

    return (
        <section
            className={`rounded-lg border bg-card overflow-hidden ds-transition ${
                hasErrors
                    ? "border-red-500/30"
                    : completed
                    ? "border-emerald-500/25"
                    : "border-border/60"
            }`}
        >
            {/* Header */}
            <header
                className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/40 cursor-pointer select-none hover:bg-white/[0.02] ds-transition"
                onClick={() => setCollapsed((c) => !c)}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span
                        className={`flex items-center justify-center w-7 h-7 rounded-md border ${meta.bg}`}
                    >
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="ds-title leading-none">{meta.label}</h2>
                            <span
                                className={`ds-data rounded px-1.5 py-0.5 border ${meta.bg} ${meta.color}`}
                                title={`Level ${meta.label}`}
                            >
                                {level.toUpperCase()}
                            </span>
                        </div>
                        <p className="ds-small opacity-60 mt-0.5 truncate font-mono">
                            {cfg.dataset && cfg.table ? (
                                <>
                                    {cfg.dataset}
                                    <span className="opacity-40 mx-1">/</span>
                                    {cfg.table}
                                </>
                            ) : (
                                <span className="italic not-italic font-sans opacity-70">
                                    Belum di-config
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {testResult && (
                        <span
                            className={`ds-data flex items-center gap-1 rounded px-1.5 py-0.5 ${
                                testResult.ok
                                    ? "bg-emerald-500/10 text-emerald-300"
                                    : "bg-red-500/10 text-red-300"
                            }`}
                            title={testResult.ok ? "Test berhasil" : testResult.error}
                        >
                            {testResult.ok ? (
                                <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    {testResult.distinctCount}/{testResult.rowCount}
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-3 h-3" />
                                    err
                                </>
                            )}
                        </span>
                    )}
                    {hasErrors ? (
                        <span
                            className="ds-data flex items-center gap-1 rounded px-1.5 py-0.5 bg-red-500/10 text-red-300"
                            title={fieldErrors.join(" · ")}
                        >
                            <AlertCircle className="w-3 h-3" />
                            {fieldErrors.length}
                        </span>
                    ) : completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : null}
                    <ChevronDown
                        className={`w-4 h-4 opacity-50 ds-transition ${
                            collapsed ? "-rotate-90" : "rotate-0"
                        }`}
                    />
                </div>
            </header>

            {/* Body */}
            {!collapsed && (
                <div className="p-3 space-y-2.5">
                    {/* Dataset + Table picker */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <Field
                            label="Dataset"
                            icon={<Database className="w-3 h-3 opacity-60" />}
                            required
                            error={errDataset ? "Pilih dataset" : undefined}
                        >
                            <select
                                value={cfg.dataset}
                                onChange={(e) => onChangeDataset(e.target.value)}
                                className={`${INPUT_CLS} ${
                                    errDataset ? INPUT_ERR : INPUT_OK
                                } cursor-pointer`}
                            >
                                <option value="">— pilih dataset —</option>
                                {datasets.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.id}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field
                            label="Table"
                            icon={<Table2 className="w-3 h-3 opacity-60" />}
                            required
                            error={errTable ? "Pilih table" : undefined}
                        >
                            <select
                                value={cfg.table}
                                onChange={(e) => onChangeTable(e.target.value)}
                                disabled={!cfg.dataset || tablesLoading}
                                className={`${INPUT_CLS} ${
                                    errTable ? INPUT_ERR : INPUT_OK
                                } cursor-pointer`}
                            >
                                <option value="">
                                    {!cfg.dataset
                                        ? "— pilih dataset dulu —"
                                        : tablesLoading
                                        ? "Loading..."
                                        : "— pilih table —"}
                                </option>
                                {tables.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.id} ({t.rowCount.toLocaleString("id-ID")} rows)
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {/* Kolom Name */}
                    <Field
                        label={meta.nameHint}
                        required
                        error={errName ? "Pilih kolom nama" : undefined}
                    >
                        <select
                            value={cfg.columns.name}
                            onChange={(e) => onChangeColumnName(e.target.value)}
                            disabled={!cfg.table || columnsLoading}
                            className={`${INPUT_CLS} ${
                                errName ? INPUT_ERR : INPUT_OK
                            } cursor-pointer`}
                        >
                            <option value="">
                                {!cfg.table
                                    ? "— pilih table dulu —"
                                    : columnsLoading
                                    ? "Loading..."
                                    : "— pilih kolom —"}
                            </option>
                            {colNames.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {/* Parent columns */}
                    {parentReqs.length > 0 && (
                        <div className="grid grid-cols-2 gap-2.5">
                            {parentReqs.map((p) => (
                                <Field
                                    key={p}
                                    label={meta.parentHints[p] || `Kolom parent ${p}`}
                                    required
                                    error={
                                        errParent(p) ? `Pilih kolom parent ${p.toUpperCase()}` : undefined
                                    }
                                >
                                    <select
                                        value={cfg.columns.parentNames?.[p] || ""}
                                        onChange={(e) => onChangeParent(p, e.target.value)}
                                        disabled={!cfg.table || columnsLoading}
                                        className={`${INPUT_CLS} ${
                                            errParent(p) ? INPUT_ERR : INPUT_OK
                                        } cursor-pointer`}
                                    >
                                        <option value="">— pilih kolom —</option>
                                        {colNames.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            ))}
                        </div>
                    )}

                    {/* Attrs editor — inline compact, untuk GI & Bay */}
                    {(level === "gi" || level === "bay") && (
                        <AttrsEditor
                            attrs={cfg.columns.attrs || {}}
                            columnOptions={colNames}
                            disabled={!cfg.table || columnsLoading}
                            onAdd={(k) => onAttrChange(k, "")}
                            onChangeCol={onAttrChange}
                            onRenameKey={onAttrRename}
                            onRemove={onAttrRemove}
                        />
                    )}
                </div>
            )}
        </section>
    );
}

/* ─────────── Field helper ─────────── */

function Field({
    label,
    icon,
    required,
    error,
    children,
}: {
    label: string;
    icon?: React.ReactNode;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="ds-label flex items-center gap-1.5 mb-1 opacity-90">
                {icon}
                <span className="truncate">{label}</span>
                {required && <span className="text-red-400">*</span>}
            </span>
            {children}
            {error && (
                <span className="ds-small text-red-300/90 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                </span>
            )}
        </label>
    );
}
