"use client";

/**
 * useMasterConfig — hook manage state + actions (hydrate, save, test, rebuild).
 * Extracted dari MasterHierarchyConfig monolith.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFirestoreSSConfig } from "../shared/useFirestore";
import { LEVEL_ORDER, LEVEL_META, PARENT_REQS, colKey, emptyConfig } from "./constants";
import type {
    ColumnOption,
    DatasetOption,
    Level,
    LevelConfig,
    MasterConfig,
    TableOption,
    TestResult,
} from "./types";

export function useMasterConfig() {
    const { config: ssConfig } = useFirestoreSSConfig<{ masterConfig?: unknown }>();

    const [cfg, setCfg] = useState<MasterConfig>(emptyConfig());
    const [hydrated, setHydrated] = useState(false);
    const [legacyDetected, setLegacyDetected] = useState(false);

    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [rebuilding, setRebuilding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    // BQ schema cache
    const [datasets, setDatasets] = useState<DatasetOption[]>([]);
    const [datasetsLoading, setDatasetsLoading] = useState(false);
    const [tablesCache, setTablesCache] = useState<Record<string, TableOption[]>>({});
    const [tablesLoading, setTablesLoading] = useState<Record<string, boolean>>({});
    const [columnsCache, setColumnsCache] = useState<Record<string, ColumnOption[]>>({});
    const [columnsLoading, setColumnsLoading] = useState<Record<string, boolean>>({});

    /* ─── Hydrate config dari Firestore (sekali) ─── */
    useEffect(() => {
        if (hydrated) return;
        if (!ssConfig) return;
        const existing = ssConfig.masterConfig as Partial<MasterConfig> | undefined;
        if (!existing) {
            setHydrated(true);
            return;
        }
        if (existing.version !== 2 || existing.source !== "bigquery") {
            setLegacyDetected(true);
            setHydrated(true);
            return;
        }
        setCfg({
            ...emptyConfig(),
            ...(existing as MasterConfig),
            levels: {
                ...emptyConfig().levels,
                ...((existing.levels ?? {}) as MasterConfig["levels"]),
            },
        });
        setHydrated(true);
    }, [ssConfig, hydrated]);

    /* ─── Load datasets sekali (+ manual refresh) ─── */
    const loadDatasets = useCallback(async () => {
        setDatasetsLoading(true);
        try {
            const res = await fetch("/api/data-connector-v5/bq-schema");
            const json = await res.json();
            if (json.ok && Array.isArray(json.datasets)) {
                setDatasets(json.datasets);
            }
        } catch {
            // silent — UI akan tampilkan empty
        } finally {
            setDatasetsLoading(false);
        }
    }, []);
    useEffect(() => {
        loadDatasets();
    }, [loadDatasets]);

    /* ─── Lazy load tables per dataset ─── */
    const loadTables = useCallback(
        async (dataset: string) => {
            if (!dataset) return;
            if (tablesCache[dataset]) return;
            setTablesLoading((m) => ({ ...m, [dataset]: true }));
            try {
                const res = await fetch(`/api/data-connector-v5/bq-schema?dataset=${encodeURIComponent(dataset)}`);
                const json = await res.json();
                if (json.ok && Array.isArray(json.tables)) {
                    setTablesCache((m) => ({ ...m, [dataset]: json.tables }));
                }
            } catch {
                // silent
            } finally {
                setTablesLoading((m) => ({ ...m, [dataset]: false }));
            }
        },
        [tablesCache]
    );

    /* ─── Lazy load columns per (dataset, table) ─── */
    const loadColumns = useCallback(
        async (dataset: string, table: string) => {
            if (!dataset || !table) return;
            const key = colKey(dataset, table);
            if (columnsCache[key]) return;
            setColumnsLoading((m) => ({ ...m, [key]: true }));
            try {
                const res = await fetch(
                    `/api/data-connector-v5/bq-schema?dataset=${encodeURIComponent(dataset)}&table=${encodeURIComponent(table)}`
                );
                const json = await res.json();
                if (json.ok && Array.isArray(json.columns)) {
                    setColumnsCache((m) => ({ ...m, [key]: json.columns }));
                }
            } catch {
                // silent
            } finally {
                setColumnsLoading((m) => ({ ...m, [key]: false }));
            }
        },
        [columnsCache]
    );

    /* ─── Auto-load tables/columns untuk level yang sudah filled ─── */
    useEffect(() => {
        for (const lvl of LEVEL_ORDER) {
            const lc = cfg.levels[lvl];
            if (lc.dataset) loadTables(lc.dataset);
            if (lc.dataset && lc.table) loadColumns(lc.dataset, lc.table);
        }
    }, [cfg, loadTables, loadColumns]);

    /* ─── Mutators (immutable update) ─── */
    const setLevelField = <K extends keyof LevelConfig>(lvl: Level, field: K, value: LevelConfig[K]) => {
        setCfg((prev) => {
            const next = { ...prev, levels: { ...prev.levels } };
            const lvlCfg = { ...next.levels[lvl], [field]: value };
            if (field === "dataset") {
                lvlCfg.table = "";
                lvlCfg.columns = { ...lvlCfg.columns, name: "", parentNames: {}, attrs: {} };
            }
            if (field === "table") {
                lvlCfg.columns = { ...lvlCfg.columns, name: "", parentNames: {}, attrs: {} };
            }
            next.levels[lvl] = lvlCfg;
            return next;
        });
    };

    const setColumnName = (lvl: Level, value: string) => {
        setCfg((prev) => {
            const next = { ...prev, levels: { ...prev.levels } };
            const lvlCfg = { ...next.levels[lvl] };
            lvlCfg.columns = { ...lvlCfg.columns, name: value };
            next.levels[lvl] = lvlCfg;
            return next;
        });
    };

    const setParentName = (lvl: Level, parent: "upt" | "ultg" | "gi", value: string) => {
        setCfg((prev) => {
            const next = { ...prev, levels: { ...prev.levels } };
            const lvlCfg = { ...next.levels[lvl] };
            const parents = { ...(lvlCfg.columns.parentNames || {}), [parent]: value };
            lvlCfg.columns = { ...lvlCfg.columns, parentNames: parents };
            next.levels[lvl] = lvlCfg;
            return next;
        });
    };

    const setAttr = (lvl: Level, attrKey: string, colName: string) => {
        setCfg((prev) => {
            const next = { ...prev, levels: { ...prev.levels } };
            const lvlCfg = { ...next.levels[lvl] };
            const attrs = { ...(lvlCfg.columns.attrs || {}), [attrKey]: colName };
            lvlCfg.columns = { ...lvlCfg.columns, attrs };
            next.levels[lvl] = lvlCfg;
            return next;
        });
    };

    const renameAttrKey = (lvl: Level, oldKey: string, newKey: string) => {
        if (!newKey || oldKey === newKey) return;
        setCfg((prev) => {
            const next = { ...prev, levels: { ...prev.levels } };
            const lvlCfg = { ...next.levels[lvl] };
            const oldAttrs = lvlCfg.columns.attrs || {};
            if (newKey in oldAttrs) return prev;
            const { [oldKey]: val, ...rest } = oldAttrs;
            lvlCfg.columns = { ...lvlCfg.columns, attrs: { ...rest, [newKey]: val || "" } };
            next.levels[lvl] = lvlCfg;
            return next;
        });
    };

    const removeAttr = (lvl: Level, attrKey: string) => {
        setCfg((prev) => {
            const next = { ...prev, levels: { ...prev.levels } };
            const lvlCfg = { ...next.levels[lvl] };
            const oldAttrs = lvlCfg.columns.attrs || {};
            const { [attrKey]: _drop, ...rest } = oldAttrs;
            void _drop;
            lvlCfg.columns = { ...lvlCfg.columns, attrs: rest };
            next.levels[lvl] = lvlCfg;
            return next;
        });
    };

    /* ─── Validasi FE (untuk enable tombol) ─── */
    const validationErrors = useMemo(() => {
        const errs: string[] = [];
        for (const lvl of LEVEL_ORDER) {
            const lc = cfg.levels[lvl];
            if (!lc.dataset) errs.push(`${LEVEL_META[lvl].label}: pilih Dataset`);
            else if (!lc.table) errs.push(`${LEVEL_META[lvl].label}: pilih Table`);
            else if (!lc.columns.name) errs.push(`${LEVEL_META[lvl].label}: pilih Kolom Name`);
            for (const p of PARENT_REQS[lvl]) {
                if (!lc.columns.parentNames?.[p]) errs.push(`${LEVEL_META[lvl].label}: pilih kolom parent ${p.toUpperCase()}`);
            }
        }
        return errs;
    }, [cfg]);
    const isValid = validationErrors.length === 0;

    /* ─── Actions ─── */
    const handleTest = useCallback(async () => {
        setError(null);
        setStatus(null);
        setTestResult(null);
        if (!isValid) {
            setError("Masih ada field kosong — cek daftar di atas.");
            return;
        }
        setTesting(true);
        try {
            const res = await fetch("/api/ss-v5/master-wizard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "test-extraction", masterConfig: cfg }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || "test-extraction gagal");
            setTestResult(json.extraction);
            setStatus("Test extraction selesai — cek hasil di tiap section.");
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setTesting(false);
        }
    }, [cfg, isValid]);

    const handleSave = useCallback(async () => {
        setError(null);
        setStatus(null);
        if (!isValid) {
            setError("Masih ada field kosong — cek daftar di atas.");
            return;
        }
        setSaving(true);
        setStatus("⏳ Step 1/3: Saving config ke Firestore...");
        try {
            // Step 1: Save config aja dulu (skipRebuild) — cepat, kalau gagal user tau langsung
            const saveRes = await fetch("/api/ss-v5/master-wizard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "save", masterConfig: cfg, skipRebuild: true }),
            });
            const saveJson = await saveRes.json();
            if (!saveJson.ok) {
                const codeHint = saveJson.code ? ` [${saveJson.code}]` : "";
                const validation = saveJson.validation
                    ? "\n\nValidation errors:\n" + saveJson.validation.map((v: { message: string }) => `  • ${v.message}`).join("\n")
                    : "";
                throw new Error((saveJson.error || "Save gagal") + codeHint + validation);
            }
            setStatus("✓ Step 1/3: Config tersimpan di Firestore. Step 2/3: Triggering CF master-rebuild...");

            // Step 2: Trigger rebuild (separate API call, biar user liat progress)
            const rebuildRes = await fetch("/api/ss-v5/master-wizard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "rebuild" }),
            });
            const rebuildJson = await rebuildRes.json();
            if (!rebuildJson.ok) {
                throw new Error(`Config tersimpan, tapi rebuild dim_* gagal: ${rebuildJson.error}. Pakai tombol "Rebuild Ulang" setelah fix.`);
            }

            // Step 3: Done
            const c = rebuildJson.counts || {};
            const durationMs = rebuildJson.durationMs || 0;
            setStatus(
                `✓ DONE (${(durationMs / 1000).toFixed(1)}s) — Config tersimpan + dim_* populated:\n` +
                `  • dim_upt:  ${c.upt || 0} row\n` +
                `  • dim_ultg: ${c.ultg || 0} row\n` +
                `  • dim_gi:   ${c.gi || 0} row\n` +
                `  • dim_bay:  ${c.bay || 0} row`
            );
            if (rebuildJson.warnings && rebuildJson.warnings.length > 0) {
                setStatus((s) => (s || "") + `\n\n⚠ Warnings: ${rebuildJson.warnings.join("; ")}`);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }, [cfg, isValid]);

    const handleRebuildOnly = useCallback(async () => {
        setError(null);
        setStatus(null);
        setRebuilding(true);
        try {
            const res = await fetch("/api/ss-v5/master-wizard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "rebuild" }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || "Rebuild gagal");
            const c = json.counts || {};
            setStatus(
                `✓ dim_* rebuilt: ${c.upt || 0} UPT / ${c.ultg || 0} ULTG / ${c.gi || 0} GI / ${c.bay || 0} Bay (${json.durationMs}ms)`
            );
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setRebuilding(false);
        }
    }, []);

    return {
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
    };
}
