/**
 * Step 2 — Configure (V2 2026-04-23: simplified)
 * Per-sheet: include checkbox + tableName. Dataset name editable.
 * V2 Mode C: no PK needed (CREATE OR REPLACE atomic).
 * FK hirarki tidak di sini — di-setup via Data Level Config page.
 */

import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button, Card, Field } from "./shared";
import type { SheetConfigFE, SpreadsheetInfo } from "./types";

export function Step2Configure({
    info,
    configs,
    datasetId,
    onDatasetIdChange,
    onUpdateConfig,
    dryRunning,
    onBack,
    onDryRun,
}: {
    info: SpreadsheetInfo;
    configs: Record<string, SheetConfigFE>;
    datasetId: string;
    onDatasetIdChange: (v: string) => void;
    onUpdateConfig: (sheet: string, patch: Partial<SheetConfigFE>) => void;
    dryRunning: boolean;
    onBack: () => void;
    onDryRun: () => void;
}) {
    return (
        <Card>
            <div className="mb-4">
                <h2 className="ds-title">Step 2: Pilih Lembar yang Mau Di-sync</h2>
                <p className="ds-small mt-1">
                    <span className="font-mono">{info.name}</span> · {info.sheets.length} Lembar · Owner:{" "}
                    {info.owner}
                </p>
                <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                    <p className="ds-small flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                        <span>
                            <strong>Mode C Full Replace</strong> — setiap cycle table di-overwrite atomic.
                            Tidak butuh PK; bebas insert/delete/reorder row di Sheet. Set level hirarki
                            (UPT/ULTG/GI/BAY) terpisah di <span className="font-mono">Data Level Config</span>{" "}
                            setelah sync aktif.
                        </span>
                    </p>
                </div>
            </div>

            <Field label="BQ Dataset Name">
                <input
                    type="text"
                    value={datasetId}
                    onChange={(e) => onDatasetIdChange(e.target.value)}
                    className="ds-data w-full rounded border border-border bg-background px-3 py-2"
                />
            </Field>

            <div className="mt-4 space-y-3">
                {info.sheets.map((s) => {
                    const c = configs[s.title];
                    if (!c) return null;
                    return (
                        <div key={s.title} className="rounded-lg border border-border/40 bg-card/20 p-4">
                            <label className="mb-3 flex cursor-pointer items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={c.include}
                                    onChange={(e) => onUpdateConfig(s.title, { include: e.target.checked })}
                                />
                                <span className="ds-title">{s.title}</span>
                                <span className="ds-small opacity-80">
                                    ({s.rowCount} rows · {s.headers.length} kolom)
                                </span>
                            </label>
                            {c.include && (
                                <Field label="Nama BQ Table">
                                    <input
                                        type="text"
                                        value={c.tableName}
                                        onChange={(e) => onUpdateConfig(s.title, { tableName: e.target.value })}
                                        className="ds-data w-full rounded border border-border bg-background px-2 py-1"
                                    />
                                </Field>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex justify-between">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button onClick={onDryRun} disabled={dryRunning || !datasetId}>
                    {dryRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dry Run Preview"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </Card>
    );
}
