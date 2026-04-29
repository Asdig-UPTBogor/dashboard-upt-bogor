"use client";

/**
 * MasterDataConfig — accordion (collapse) per level UPT/ULTG/GI/Bay.
 *
 * Pattern:
 *   - 4 collapsible sections (UPT, ULTG, GI, Bay) — default collapsed
 *   - Klik header → expand → form muncul inline
 *   - Status visible di header tiap section (✓ ready / ⚠ N field / empty)
 *   - Sticky footer: Test + Save & Rebuild dim_*
 *
 * Output: ss_platform.dim_* populated → FK enrichment di tabel user.
 * Ref: Spreadsheet Sync/docs/SS_V5_SYSTEM.md §7
 */

import { useState } from "react";
import {
    Save, Loader2, CheckCircle2, AlertTriangle, AlertCircle,
    TestTube2, Database, RefreshCw, Sparkles, ChevronDown,
} from "lucide-react";
import { LEVEL_ORDER, LEVEL_META, colKey } from "./constants";
import { LevelSection } from "./LevelSection";
import { useMasterConfig } from "./useMasterConfig";
import type { Level } from "./types";

const LEVEL_FULL_NAME: Record<Level, string> = {
    upt: "Unit Pelaksana Transmisi",
    ultg: "Unit Layanan Transmisi dan Gardu Induk",
    gi: "Gardu Induk",
    bay: "Bay",
};

const LEVEL_LABEL_PREFIX: Record<Level, string> = {
    upt: "UPT",
    ultg: "ULTG",
    gi: "GI (Gardu Induk)",
    bay: "Bay",
};

export default function MasterDataConfig() {
    const [expanded, setExpanded] = useState<Set<Level>>(new Set());
    const {
        cfg,
        legacyDetected,
        datasets,
        datasetsLoading,
        tablesCache,
        tablesLoading,
        columnsCache,
        columnsLoading,
        saving,
        testing,
        rebuilding,
        error,
        status,
        testResult,
        validationErrors,
        isValid,
        loadDatasets,
        setLevelField,
        setColumnName,
        setParentName,
        setAttr,
        renameAttrKey,
        removeAttr,
        handleTest,
        handleSave,
        handleRebuildOnly,
    } = useMasterConfig();

    const toggleLevel = (lvl: Level) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(lvl)) next.delete(lvl);
            else next.add(lvl);
            return next;
        });
    };

    // Per-level error grouping
    const errorsByLevel: Record<Level, string[]> = { upt: [], ultg: [], gi: [], bay: [] };
    for (const err of validationErrors) {
        for (const lvl of LEVEL_ORDER) {
            const meta = LEVEL_LABEL_PREFIX[lvl];
            if (err.startsWith(meta)) {
                errorsByLevel[lvl].push(err.slice(meta.length).replace(/^:\s*/, ""));
                break;
            }
        }
    }

    const configuredCount = LEVEL_ORDER.reduce((acc, lvl) => {
        const lc = cfg.levels[lvl];
        return acc + (lc.dataset && lc.table && lc.columns.name ? 1 : 0);
    }, 0);

    const datasetsEmpty = !datasetsLoading && datasets.length === 0;

    return (
        <div className="flex h-full w-full min-h-0 flex-col bg-background">
            {/* HEADER */}
            <header className="shrink-0 flex items-start justify-between gap-4 border-b border-border/60 bg-card/40 px-6 py-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <h1 className="ds-heading">Master Data Config</h1>
                    </div>
                    <p className="ds-body mt-1 max-w-3xl">
                        Tentukan dari BQ table mana sistem ambil data master hirarki organisasi.
                        Output: <span className="ds-data rounded bg-zinc-800/80 px-1.5 py-0.5 text-foreground">ss_platform.dim_*</span> populated → dipakai untuk enrich FK ID
                        (<span className="font-mono text-foreground/80 text-xs">_upt_id, _gi_id, _bay_id, ...</span>) di tabel user.
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 ds-small">
                        <ProgressDots configuredCount={configuredCount} />
                        <span className={configuredCount === 4 ? "text-emerald-300" : "opacity-70"}>
                            {configuredCount}/4 level configured
                        </span>
                        {cfg.configuredAt && (
                            <>
                                <span className="opacity-40">•</span>
                                <span className="opacity-60">
                                    last save{" "}
                                    <span className="text-foreground/80">
                                        {new Date(cfg.configuredAt).toLocaleString("id-ID")}
                                    </span>
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <button
                    onClick={loadDatasets}
                    disabled={datasetsLoading}
                    className="ds-transition cursor-pointer flex items-center gap-1.5 text-xs h-8 px-2.5 rounded-md border border-border bg-background hover:bg-white/5 hover:border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    title="Reload daftar dataset dari BQ"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${datasetsLoading ? "animate-spin" : ""}`} />
                    Refresh BQ
                </button>
            </header>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {legacyDetected && (
                    <Banner tone="amber" icon={<AlertTriangle className="w-4 h-4" />}>
                        <strong>Config lama terdeteksi.</strong> Schema sekarang BQ-based. Edit
                        tiap level → Save & Rebuild untuk migrate.
                    </Banner>
                )}
                {datasetsEmpty && (
                    <Banner tone="blue" icon={<Database className="w-4 h-4" />}>
                        <strong>Belum ada dataset di BQ.</strong> Daftarin spreadsheet master dulu via
                        tombol <span className="ds-data rounded bg-blue-500/20 px-1">+ Add Spreadsheet</span>.
                    </Banner>
                )}
                {error && <Banner tone="red" icon={<AlertCircle className="w-4 h-4" />}>{error}</Banner>}
                {status && <Banner tone="emerald" icon={<CheckCircle2 className="w-4 h-4" />}>{status}</Banner>}

                {/* Quick action: expand/collapse all */}
                <div className="flex items-center justify-end gap-2 ds-small">
                    <button
                        onClick={() => setExpanded(new Set(LEVEL_ORDER))}
                        className="ds-transition cursor-pointer hover:text-foreground opacity-60"
                    >
                        Expand all
                    </button>
                    <span className="opacity-30">|</span>
                    <button
                        onClick={() => setExpanded(new Set())}
                        className="ds-transition cursor-pointer hover:text-foreground opacity-60"
                    >
                        Collapse all
                    </button>
                </div>

                {/* 4 Accordion sections */}
                <div className="space-y-2">
                    {LEVEL_ORDER.map((lvl) => {
                        const meta = LEVEL_META[lvl];
                        const Icon = meta.Icon;
                        const lc = cfg.levels[lvl];
                        const filled = !!(lc.dataset && lc.table && lc.columns.name);
                        const errCount = errorsByLevel[lvl].length;
                        const isOpen = expanded.has(lvl);

                        return (
                            <div
                                key={lvl}
                                className="rounded-lg border border-border/60 bg-card/30 overflow-hidden ds-transition"
                            >
                                {/* Header (clickable, toggle) */}
                                <button
                                    onClick={() => toggleLevel(lvl)}
                                    className="ds-transition w-full cursor-pointer flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
                                >
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-md border ${meta.bg} ${meta.color}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`ds-title ${meta.color}`}>{meta.label}</span>
                                            <span className="ds-small opacity-60">·</span>
                                            <span className="ds-small opacity-70">{LEVEL_FULL_NAME[lvl]}</span>
                                        </div>
                                        {filled ? (
                                            <div className="ds-small opacity-70 mt-0.5 truncate">
                                                <span className="font-mono">{lc.dataset}.{lc.table}</span>
                                                <span className="opacity-50 mx-1">·</span>
                                                <span className="font-mono">{lc.columns.name}</span>
                                            </div>
                                        ) : (
                                            <div className="ds-small opacity-50 italic mt-0.5">
                                                Belum di-config
                                            </div>
                                        )}
                                    </div>
                                    <StatusBadge filled={filled} errCount={errCount} testResult={testResult?.[lvl]} />
                                    <ChevronDown
                                        className={`w-4 h-4 opacity-60 ds-transition ${isOpen ? "rotate-180" : ""}`}
                                    />
                                </button>

                                {/* Body (expand/collapse) */}
                                {isOpen && (
                                    <div className="border-t border-border/40 px-4 py-4 bg-background/30">
                                        <LevelSection
                                            level={lvl}
                                            cfg={cfg.levels[lvl]}
                                            datasets={datasets}
                                            tables={tablesCache[cfg.levels[lvl].dataset] || []}
                                            tablesLoading={!!tablesLoading[cfg.levels[lvl].dataset]}
                                            columns={
                                                columnsCache[
                                                    colKey(cfg.levels[lvl].dataset, cfg.levels[lvl].table)
                                                ] || []
                                            }
                                            columnsLoading={
                                                !!columnsLoading[
                                                    colKey(cfg.levels[lvl].dataset, cfg.levels[lvl].table)
                                                ]
                                            }
                                            testResult={testResult?.[lvl]}
                                            fieldErrors={errorsByLevel[lvl]}
                                            onChangeDataset={(v) => setLevelField(lvl, "dataset", v)}
                                            onChangeTable={(v) => setLevelField(lvl, "table", v)}
                                            onChangeColumnName={(v) => setColumnName(lvl, v)}
                                            onChangeParent={(parent, v) => setParentName(lvl, parent, v)}
                                            onAttrChange={(k, v) => setAttr(lvl, k, v)}
                                            onAttrRename={(oldK, newK) => renameAttrKey(lvl, oldK, newK)}
                                            onAttrRemove={(k) => removeAttr(lvl, k)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* FOOTER (sticky) */}
            <footer className="shrink-0 flex items-center gap-2 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
                <button
                    onClick={handleRebuildOnly}
                    disabled={rebuilding || saving}
                    className="ds-transition cursor-pointer flex items-center gap-1.5 text-xs h-9 px-3 rounded-md border border-border bg-background hover:bg-white/5 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Rebuild dim_* pakai config tersimpan (tidak save config baru)"
                >
                    {rebuilding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Rebuild Ulang
                </button>
                <button
                    onClick={handleTest}
                    disabled={testing || saving || !isValid}
                    className="ds-transition cursor-pointer flex items-center gap-1.5 text-xs h-9 px-3 rounded-md border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Simulasi extraction tanpa commit"
                >
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                    Test Extraction
                </button>
                <div className="flex-1" />
                {!isValid && (
                    <span className="ds-small text-amber-300 flex items-center gap-1 mr-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {validationErrors.length} field belum lengkap — expand level dengan badge ⚠
                    </span>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || testing || !isValid}
                    className="ds-transition cursor-pointer flex items-center gap-1.5 text-sm h-9 px-4 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-emerald-500/20"
                    title={isValid ? "Save config + rebuild dim_*" : "Lengkapi 4 level dulu"}
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save & Rebuild dim_*
                </button>
            </footer>
        </div>
    );
}

/* ─────────── Sub-components ─────────── */

function ProgressDots({ configuredCount }: { configuredCount: number }) {
    return (
        <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                        i < configuredCount ? "bg-emerald-500" : "bg-border"
                    }`}
                />
            ))}
        </div>
    );
}

function StatusBadge({
    filled,
    errCount,
    testResult,
}: {
    filled: boolean;
    errCount: number;
    testResult?: { ok: boolean; distinctCount?: number; rowCount?: number; error?: string };
}) {
    if (filled) {
        return (
            <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="ds-data rounded bg-emerald-500/15 text-emerald-300 px-2 py-0.5 inline-flex items-center gap-1 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready
                </span>
                {testResult?.ok && (
                    <span className="ds-small opacity-50 text-[10px]">
                        {testResult.distinctCount} distinct
                    </span>
                )}
            </div>
        );
    }
    if (errCount > 0) {
        return (
            <span className="ds-data rounded bg-amber-500/15 text-amber-300 px-2 py-0.5 inline-flex items-center gap-1 text-[10px] shrink-0">
                <AlertTriangle className="w-3 h-3" />
                {errCount} ⚠
            </span>
        );
    }
    return (
        <span className="ds-data rounded bg-zinc-700/40 text-zinc-400 px-2 py-0.5 text-[10px] shrink-0">
            empty
        </span>
    );
}

function Banner({
    tone,
    icon,
    children,
}: {
    tone: "amber" | "blue" | "red" | "emerald";
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    const toneMap = {
        amber: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        blue: "border-blue-500/40 bg-blue-500/10 text-blue-200",
        red: "border-red-500/40 bg-red-500/10 text-red-200",
        emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    } as const;
    return (
        <div className={`rounded-lg border px-4 py-2.5 flex items-start gap-2 ${toneMap[tone]}`}>
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="ds-small">{children}</div>
        </div>
    );
}
