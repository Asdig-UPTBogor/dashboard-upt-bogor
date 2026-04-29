/**
 * Step 1 — Detect
 * User paste URL spreadsheet, klik scan → fetch `/api/ss-v5/wizard/detect-sheets`.
 */

import { ArrowRight, Loader2, Info } from "lucide-react";
import { Button, Card } from "./shared";

export function Step1Detect({
    url,
    onUrlChange,
    detecting,
    onDetect,
    masterConfigured,
}: {
    url: string;
    onUrlChange: (v: string) => void;
    detecting: boolean;
    onDetect: () => void;
    masterConfigured?: boolean;
}) {
    return (
        <Card>
            <h2 className="ds-title mb-2">Step 1: Paste URL Spreadsheet</h2>
            <p className="ds-small mb-3">
                Share spreadsheet ke Service Account terlebih dahulu:{" "}
                <code className="rounded bg-muted/40 px-1 font-mono">
                    spreadsheet-reader-bot@automaticspreadsheet.iam.gserviceaccount.com
                </code>
            </p>

            {masterConfigured === false && (
                <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="ds-small text-amber-200">
                        <strong className="font-semibold">Master Data Config belum di-set.</strong>{" "}
                        Spreadsheet bisa tetap di-register, tapi semua tabel BQ akan tersync sebagai
                        <span className="ds-data mx-1 rounded bg-zinc-700/40 px-1.5">FLAT</span>
                        (raw, no FK enrichment). Setelah Master Data Config + Data Level Config di-setup,
                        tabel ini bisa di-upgrade level-nya via{" "}
                        <span className="font-mono text-amber-300">Data Level Config</span> tab.
                    </div>
                </div>
            )}

            <input
                type="text"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="ds-body w-full rounded-md border border-border bg-background px-3 py-2"
            />
            <div className="mt-4 flex justify-end">
                <Button onClick={onDetect} disabled={detecting || !url}>
                    {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan Spreadsheet"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </Card>
    );
}
