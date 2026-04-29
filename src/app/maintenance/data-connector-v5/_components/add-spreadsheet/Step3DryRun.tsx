/**
 * Step 3 — Dry Run Preview
 * Summary stats, sheet tabs, per-sheet detail (header included/skipped + rejected + sample).
 * User konfirmasi "Yes, Create" → step 4.
 */

import { AlertCircle, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Button, Card, PreviewSheetDetail, SummaryStat } from "./shared";
import type { SheetPreview, TotalEstimate } from "./types";

export function Step3DryRun({
    preview,
    totalEstimate,
    activeSheet,
    samplePage,
    onSelectSheet,
    onPageChange,
    submitting,
    onBack,
    onCreate,
}: {
    preview: SheetPreview[];
    totalEstimate: TotalEstimate | null;
    activeSheet: string | null;
    samplePage: number;
    onSelectSheet: (sheet: string) => void;
    onPageChange: (p: number) => void;
    submitting: boolean;
    onBack: () => void;
    onCreate: () => void;
}) {
    const activePreview = preview.find((p) => p.sheet === activeSheet) ?? null;
    if (!activePreview) return null;

    return (
        <Card>
            <div className="mb-4">
                <h2 className="ds-title">Step 3: Dry Run Preview</h2>
                <p className="ds-small mt-1">
                    Simulasi sync TANPA create resource. Review hasil sebelum konfirmasi.
                </p>
            </div>

            {/* Summary */}
            {totalEstimate && (
                <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <SummaryStat label="Total Lembar" value={preview.length} />
                    <SummaryStat label="Estimasi Row" value={totalEstimate.rows.toLocaleString("id-ID")} />
                    <SummaryStat
                        label="Estimasi Rejected"
                        value={totalEstimate.rejected.toLocaleString("id-ID")}
                        alert={totalEstimate.rejected > 0}
                    />
                    <SummaryStat label="Storage ~" value={`${totalEstimate.storageKB} KB`} />
                </div>
            )}

            {/* Sheet tabs */}
            <div className="mb-3 flex flex-wrap gap-1 border-b border-border/40 pb-2">
                {preview.map((p) => (
                    <button
                        key={p.sheet}
                        type="button"
                        onClick={() => onSelectSheet(p.sheet)}
                        className={`ds-label ds-transition cursor-pointer rounded-md px-3 py-1 ${
                            p.sheet === activeSheet
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-muted/20 hover:bg-muted/40"
                        }`}
                    >
                        {p.sheet}
                        {p.error && <AlertTriangle className="inline h-3 w-3 ml-1 text-red-400" />}
                    </button>
                ))}
            </div>

            {activePreview.error ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-red-400">
                    <AlertCircle className="inline h-4 w-4 mr-2" />
                    <span className="ds-small">Error scan lembar: {activePreview.error}</span>
                </div>
            ) : (
                <PreviewSheetDetail
                    preview={activePreview}
                    samplePage={samplePage}
                    onPageChange={onPageChange}
                />
            )}

            <div className="mt-6 flex justify-between items-center border-t border-border/40 pt-4">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Batal / Edit Config
                </Button>
                <div className="flex items-center gap-2">
                    <span className="ds-small opacity-80">Yakin data sudah benar?</span>
                    <Button onClick={onCreate} disabled={submitting}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "✓ Yes, Create"}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
