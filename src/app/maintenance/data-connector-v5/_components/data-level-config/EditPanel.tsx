"use client";

/**
 * Data Level Config — RIGHT panel: edit level + columns + dry-run + save/highlight.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Database,
    Table2,
    X,
    TestTube2,
    Loader2,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import { LEVEL_ORDER, LEVEL_META, REQUIRED_COLUMNS, VISIBLE_COLUMNS } from "./constants";
import type { Level, LevelColumns, DryRunResult, TableEntry, ColumnMeta } from "./types";
import { DryRunReport } from "./DryRunReport";

const INPUT_CLS =
    "ds-body w-full h-9 rounded-md border border-border bg-background px-2.5 outline-none " +
    "focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/60 ds-transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

export function EditPanel({
    entry,
    onSaved,
    onClose,
}: {
    entry: TableEntry;
    onSaved: () => void;
    onClose: () => void;
}) {
    const [level, setLevel] = useState<Level>(entry.level);
    const [columns, setColumns] = useState<LevelColumns>(entry.columns || {});
    const [bqColumns, setBqColumns] = useState<ColumnMeta[]>([]);
    const [colLoading, setColLoading] = useState(false);

    const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(entry.lastDryRun || null);
    const [dryRunning, setDryRunning] = useState(false);
    const [saving, setSaving] = useState(false);
    const [highlighting, setHighlighting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    /* Load BQ columns */
    useEffect(() => {
        let cancelled = false;
        setColLoading(true);
        fetch(
            `/api/data-connector-v5/bq-schema?dataset=${encodeURIComponent(entry.dataset)}&table=${encodeURIComponent(entry.table)}`
        )
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                if (json.ok && Array.isArray(json.columns)) setBqColumns(json.columns);
            })
            .catch(() => {
                /* silent */
            })
            .finally(() => {
                if (!cancelled) setColLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [entry.dataset, entry.table]);

    const colNames = bqColumns.map((c) => c.name);
    const requiredCols = REQUIRED_COLUMNS[level];
    const validationErrors = useMemo(() => {
        const errs: string[] = [];
        for (const k of requiredCols) {
            if (!columns[k]) errs.push(`Kolom nama ${k.toUpperCase()} belum dipilih`);
        }
        return errs;
    }, [columns, requiredCols]);
    const isValid = validationErrors.length === 0;

    /* Actions */
    const runDryRun = useCallback(async () => {
        setError(null);
        setStatus(null);
        if (!isValid) {
            setError(validationErrors[0]);
            return;
        }
        setDryRunning(true);
        try {
            const res = await fetch("/api/bq-table-levels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "dry-run",
                    dataset: entry.dataset,
                    table: entry.table,
                    level,
                    columns,
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                const codeHint = json.code ? ` [${json.code}]` : "";
                throw new Error((json.error || "Dry run failed") + codeHint);
            }
            setDryRunResult(json.dryRun);
            setStatus("Dry run selesai. Review hasil, pilih aksi.");
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setDryRunning(false);
        }
    }, [entry, level, columns, isValid, validationErrors]);

    const saveAndCommit = useCallback(async () => {
        setError(null);
        setStatus(null);
        setSaving(true);
        try {
            const res = await fetch("/api/bq-table-levels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "save",
                    dataset: entry.dataset,
                    table: entry.table,
                    level,
                    columns,
                    dryRunResult,
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                const codeHint = json.code ? ` [${json.code}]` : "";
                throw new Error((json.error || "Save failed") + codeHint);
            }
            setStatus("Config tersimpan. Next sync cycle akan enrich FK.");
            onSaved();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }, [entry, level, columns, dryRunResult, onSaved]);

    const highlightPreview = useCallback(async () => {
        setError(null);
        setStatus(null);
        setHighlighting(true);
        try {
            const res = await fetch("/api/bq-table-levels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "highlight-preview",
                    dataset: entry.dataset,
                    table: entry.table,
                    level,
                    columns,
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                const codeHint = json.code ? ` [${json.code}]` : "";
                throw new Error((json.error || "Highlight failed") + codeHint);
            }
            setStatus(
                "Highlight preview selesai. Buka Sheet, betulin cell merah, balik sini, klik Dry Run lagi."
            );
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setHighlighting(false);
        }
    }, [entry, level, columns]);

    const setColumn = (k: keyof LevelColumns, v: string) => {
        setColumns((prev) => ({ ...prev, [k]: v || undefined }));
    };

    const meta = LEVEL_META[level];

    return (
        <div className="flex flex-col gap-4 p-5 pb-8">
            {/* Header */}
            <header className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 ds-small opacity-60">
                        <Database className="w-3 h-3" />
                        <span className="font-mono">{entry.dataset}</span>
                        <span className="opacity-40">/</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <Table2 className="w-4 h-4 opacity-70" />
                        <h2 className="ds-title truncate">{entry.table}</h2>
                        <span
                            className={`ds-data rounded px-1.5 py-0.5 border ${meta.bg} ${meta.color}`}
                        >
                            {meta.label}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="ds-transition cursor-pointer p-1.5 rounded-md border border-transparent hover:bg-white/5 hover:border-border opacity-60 hover:opacity-100"
                    title="Tutup panel"
                >
                    <X className="w-4 h-4" />
                </button>
            </header>

            {/* Level picker */}
            <section className="rounded-lg border border-border/60 bg-card p-4">
                <div className="mb-2.5">
                    <div className="ds-label flex items-center gap-1.5 mb-1">
                        <meta.Icon className={`w-4 h-4 ${meta.color}`} />
                        Level Hirarki
                    </div>
                    <p className="ds-small opacity-70">{meta.description}</p>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                    {LEVEL_ORDER.map((lvl) => {
                        const m = LEVEL_META[lvl];
                        const selected = level === lvl;
                        const LvlIcon = m.Icon;
                        return (
                            <button
                                key={lvl}
                                onClick={() => setLevel(lvl)}
                                className={`ds-transition cursor-pointer rounded-md border py-2 px-1 flex flex-col items-center gap-1 ${
                                    selected
                                        ? `${m.bg} ring-2 ring-offset-2 ring-offset-card ${m.ring}`
                                        : "border-border/60 bg-background/60 hover:bg-white/5 hover:border-border opacity-75 hover:opacity-100"
                                }`}
                                title={m.description}
                            >
                                <LvlIcon
                                    className={`w-3.5 h-3.5 ${selected ? m.color : "opacity-70"}`}
                                />
                                <div className={`ds-data ${selected ? m.color : "opacity-80"}`}>
                                    {m.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Columns picker (non-FLAT) */}
            {level !== "FLAT" && (
                <section className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="mb-3">
                        <div className="ds-label mb-1">Kolom di tabel yang berisi nama hirarki</div>
                        <p className="ds-small opacity-70">
                            Dropdown populate dari actual BQ columns. Case + trim-insensitive match ke{" "}
                            <span className="ds-data text-foreground/80">dim_*</span>.
                        </p>
                    </div>
                    {colLoading && (
                        <div className="ds-small opacity-60 flex items-center gap-1.5 mb-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading columns...
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {(["upt", "ultg", "gi", "bay"] as const).map((k) => {
                            const required = requiredCols.includes(k);
                            const visible = VISIBLE_COLUMNS[level].includes(k);
                            if (!visible) return null;
                            const labelText = {
                                upt: "Kolom nama UPT",
                                ultg: "Kolom nama ULTG",
                                gi: "Kolom nama Gardu Induk",
                                bay: "Kolom nama Bay",
                            }[k];
                            return (
                                <label key={k} className="block">
                                    <span className="ds-label flex items-center gap-1 mb-1 opacity-90">
                                        {labelText}
                                        {required && <span className="text-red-400">*</span>}
                                    </span>
                                    <select
                                        value={columns[k] || ""}
                                        onChange={(e) => setColumn(k, e.target.value)}
                                        disabled={colLoading}
                                        className={`${INPUT_CLS} cursor-pointer`}
                                    >
                                        <option value="">— pilih kolom —</option>
                                        {colNames.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            );
                        })}
                    </div>
                    {!isValid && (
                        <div className="mt-3 ds-small text-red-300 flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            {validationErrors.join(" · ")}
                        </div>
                    )}
                </section>
            )}

            {/* Dry Run button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={runDryRun}
                    disabled={dryRunning || (!isValid && level !== "FLAT")}
                    className="ds-transition cursor-pointer flex items-center gap-1.5 text-sm h-9 px-4 rounded-md border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {dryRunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <TestTube2 className="w-3.5 h-3.5" />
                    )}
                    Dry Run
                </button>
                <span className="ds-small opacity-60">
                    Simulasi JOIN ke <span className="ds-data text-foreground/70">dim_*</span> — tanpa
                    commit apapun
                </span>
            </div>

            {/* Error / status */}
            {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-red-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="ds-small text-red-200">{error}</div>
                </div>
            )}
            {status && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="ds-small text-emerald-200">{status}</div>
                </div>
            )}

            {/* Dry run result + 3 actions */}
            {dryRunResult && (
                <DryRunReport
                    result={dryRunResult}
                    saving={saving}
                    highlighting={highlighting}
                    onSave={saveAndCommit}
                    onHighlight={highlightPreview}
                />
            )}
        </div>
    );
}
