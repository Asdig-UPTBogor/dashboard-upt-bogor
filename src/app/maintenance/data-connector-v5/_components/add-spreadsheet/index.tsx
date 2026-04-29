/**
 * SS V5 Add Spreadsheet Wizard (4-step) — simplified scope
 *
 * Flow:
 *   1. Detect        — paste URL, scan via Sheets API, get metadata
 *   2. Configure     — per-sheet: include checkbox + tableName (V2 Mode C, no PK needed)
 *   3. Dry Run       — scan + preview (headers included/skipped per G10, sample 20 row, storage estimate)
 *   4. Done          — after register success
 *
 * Scope sempit (3-layer architecture):
 *   - Spreadsheet Sync wizard ini cuma: URL → pilih Lembar → sync mentah ke BQ (FLAT mode)
 *   - Zero urusan hirarki — FK enrichment di-setup terpisah via page Data Level Config (`/api/bq-table-levels`)
 *   - Default hierarchyLevel=FLAT (raw copy, zero JOIN) — dikirim ke backend sebagai default, tidak expose ke user
 *
 * Rules applied:
 *   - G10: header kosong → skip kolom (preview tunjuk jelas mana yg skip + reason)
 *   - G17: DRY RUN step wajib sebelum create (user konfirmasi "Yes" / "Batal")
 *
 * Backend:
 *   - POST /api/ss-v5/wizard/detect-sheets   — Step 1 scan
 *   - POST /api/ss-v5/wizard/dry-run          — Step 3 preview
 *   - POST /api/ss-v5/wizard/create           — Step 3→4 actual create (register + DTS + first sync)
 */
"use client";

import { useCallback, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Steps } from "./shared";
import { Step1Detect } from "./Step1Detect";
import { Step2Configure } from "./Step2Configure";
import { Step3DryRun } from "./Step3DryRun";
import { Step4Done } from "./Step4Done";
import type {
    CreateResult,
    DetectedSheet,
    SheetConfigFE,
    SheetPreview,
    SpreadsheetInfo,
    TotalEstimate,
} from "./types";

export default function AddSpreadsheetEmbed({
    masterConfigured,
}: {
    masterConfigured?: boolean;
} = {}) {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [url, setUrl] = useState("");
    const [detecting, setDetecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<SpreadsheetInfo | null>(null);
    const [configs, setConfigs] = useState<Record<string, SheetConfigFE>>({});
    const [datasetId, setDatasetId] = useState("");
    const [dryRunning, setDryRunning] = useState(false);
    const [preview, setPreview] = useState<SheetPreview[] | null>(null);
    const [totalEstimate, setTotalEstimate] = useState<TotalEstimate | null>(null);
    const [activeSheet, setActiveSheet] = useState<string | null>(null);
    const [samplePage, setSamplePage] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<CreateResult | null>(null);

    // ─── Step 1: Detect
    const onDetect = useCallback(async () => {
        setError(null);
        setDetecting(true);
        try {
            const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            const ssId = match?.[1] ?? url.trim();
            const r = await fetch("/api/ss-v5/wizard/detect-sheets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadsheetId: ssId }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Detect failed");
            setInfo(d);

            // Init default configs — scope sempit: default FLAT sync, zero FK.
            // FK hirarki di-setup terpisah via Data Level Config page (`/api/bq-table-levels`).
            const cfg: Record<string, SheetConfigFE> = {};
            for (const s of d.sheets as DetectedSheet[]) {
                cfg[s.title] = {
                    include: true,
                    tableName: `n_${s.title.replace(/[^a-zA-Z0-9]/g, "_")}`,
                };
            }
            setConfigs(cfg);
            setDatasetId(d.name.replace(/[^a-zA-Z0-9]/g, "_"));
            setStep(2);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDetecting(false);
        }
    }, [url]);

    // ─── Helper: update config
    const updateConfig = useCallback(
        (sheet: string, patch: Partial<SheetConfigFE>) => {
            setConfigs((prev) => {
                const cur = prev[sheet];
                if (!cur) return prev;
                return { ...prev, [sheet]: { ...cur, ...patch } };
            });
        },
        []
    );

    // ─── Step 2 → 3: Dry Run
    // Backend expect `sheets: Record<string, SheetConfig>` with hierarchyLevel — kirim default 'FLAT'
    // (user ga pilih level di wizard; FK setup terpisah di Data Level Config).
    const onDryRun = useCallback(async () => {
        setError(null);
        setDryRunning(true);
        setPreview(null);
        try {
            const sheets: Record<string, any> = {};
            for (const [name, c] of Object.entries(configs)) {
                if (!c.include) continue;
                sheets[name] = {
                    tableName: c.tableName,
                    hierarchyLevel: "FLAT",
                    // pkColumn dropped V2 (Mode C)
                };
            }
            const r = await fetch("/api/ss-v5/wizard/dry-run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    spreadsheetId: info!.spreadsheetId,
                    sheets,
                }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Dry run failed");
            setPreview(d.preview);
            setTotalEstimate(d.totalEstimate);
            setActiveSheet(d.preview?.[0]?.sheet ?? null);
            setSamplePage(0);
            setStep(3);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDryRunning(false);
        }
    }, [info, configs]);

    // ─── Step 3 → 4: Create (user klik "Yes, Create")
    const onCreate = useCallback(async () => {
        setError(null);
        setSubmitting(true);
        try {
            const sheets: Record<string, any> = {};
            for (const [name, c] of Object.entries(configs)) {
                if (!c.include) continue;
                sheets[name] = {
                    tableName: c.tableName,
                    hierarchyLevel: "FLAT",
                    // pkColumn dropped V2 (Mode C)
                };
            }
            const r = await fetch("/api/ss-v5/wizard/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    datasetId,
                    spreadsheetId: info!.spreadsheetId,
                    spreadsheetName: info!.name,
                    spreadsheetUrl: info!.webViewLink,
                    syncEnabled: true,
                    sheets,
                }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Create failed");
            setResult(d);
            setStep(4);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    }, [info, configs, datasetId]);

    const onSelectSheet = useCallback((sheet: string) => {
        setActiveSheet(sheet);
        setSamplePage(0);
    }, []);

    return (
        <div className="mx-auto max-w-5xl p-6">
            <header className="mb-6">
                <h1 className="ds-heading">SS V5 — Tambah Spreadsheet</h1>
                <p className="ds-small mt-1">
                    Daftarkan Google Sheet ke pipeline sync — raw sync ke BigQuery (FK hirarki di-setup terpisah)
                </p>
            </header>

            <Steps current={step} />

            {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="ds-small">{error}</span>
                </div>
            )}

            {step === 1 && (
                <Step1Detect
                    url={url}
                    onUrlChange={setUrl}
                    detecting={detecting}
                    onDetect={onDetect}
                    masterConfigured={masterConfigured}
                />
            )}

            {step === 2 && info && (
                <Step2Configure
                    info={info}
                    configs={configs}
                    datasetId={datasetId}
                    onDatasetIdChange={setDatasetId}
                    onUpdateConfig={updateConfig}
                    dryRunning={dryRunning}
                    onBack={() => setStep(1)}
                    onDryRun={onDryRun}
                />
            )}

            {step === 3 && preview && (
                <Step3DryRun
                    preview={preview}
                    totalEstimate={totalEstimate}
                    activeSheet={activeSheet}
                    samplePage={samplePage}
                    onSelectSheet={onSelectSheet}
                    onPageChange={setSamplePage}
                    submitting={submitting}
                    onBack={() => setStep(2)}
                    onCreate={onCreate}
                />
            )}

            {step === 4 && result && <Step4Done result={result} />}
        </div>
    );
}
