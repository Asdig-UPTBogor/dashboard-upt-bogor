/**
 * Step 4 — Done
 * Success state: summary create result + links.
 */

import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button, Card } from "./shared";
import type { CreateResult } from "./types";

export function Step4Done({ result }: { result: CreateResult }) {
    return (
        <Card>
            <div className="text-center">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
                <h2 className="ds-heading mb-2">Berhasil!</h2>
                <p className="ds-body">
                    Spreadsheet <span className="font-mono">{result.datasetId}</span> terdaftar.
                    <br />
                    <span className="ds-small">
                        {result.created ?? 0} DTS Scheduled Query dibuat · first-sync running background.
                    </span>
                </p>

                {result.results && (
                    <div className="mt-4 rounded-lg border border-border/40 bg-card/20 p-4 text-left max-h-60 overflow-y-auto">
                        <p className="ds-label mb-2">Hasil per Lembar:</p>
                        {result.results.map((r) => (
                            <div key={r.sheet} className="ds-small flex items-center justify-between py-1">
                                <span className="font-mono">{r.sheet}</span>
                                {r.ok ? (
                                    <span className="text-emerald-400">✓ OK</span>
                                ) : (
                                    <span className="text-red-400">✗ {r.error}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex justify-center gap-2">
                    <Button variant="ghost" onClick={() => window.location.reload()}>
                        Tambah Lagi
                    </Button>
                    <a
                        href="/cloud-console/spreadsheet-sync"
                        className="ds-label ds-transition cursor-pointer flex items-center gap-2 rounded-md bg-blue-500/20 px-4 py-2 text-blue-400 hover:bg-blue-500/30"
                    >
                        Buka Cloud Console <ExternalLink className="h-4 w-4" />
                    </a>
                </div>
            </div>
        </Card>
    );
}
