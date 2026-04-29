/**
 * Add Spreadsheet Wizard — shared UI atoms
 * Small reusable pieces: Steps, Card, Button, Field, ColDropdown, SummaryStat,
 * MetaCard, PreviewSheetDetail.
 */

import { AlertTriangle, Database } from "lucide-react";
import type { SheetPreview } from "./types";

export function Steps({ current }: { current: number }) {
    const steps = ["Scan", "Configure", "Dry Run", "Selesai"];
    return (
        <div className="mb-6 flex items-center gap-2">
            {steps.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                    <div
                        className={`ds-data flex h-7 w-7 items-center justify-center rounded-full ds-transition ${
                            i + 1 <= current
                                ? "bg-blue-500/30 text-blue-400"
                                : "bg-muted/40 opacity-60"
                        }`}
                    >
                        {i + 1}
                    </div>
                    <span
                        className={`ds-small ${
                            i + 1 === current ? "text-foreground" : "opacity-80"
                        }`}
                    >
                        {s}
                    </span>
                    {i < steps.length - 1 && <div className="ml-2 flex-1 border-t border-border/40" />}
                </div>
            ))}
        </div>
    );
}

export function Card({ children }: { children: React.ReactNode }) {
    return <div className="rounded-lg border border-border/40 bg-card/30 p-6">{children}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="ds-small uppercase tracking-wider mb-1 block opacity-80">{label}</label>
            {children}
        </div>
    );
}

export function Button({
    onClick,
    children,
    disabled,
    variant,
}: {
    onClick?: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    variant?: "ghost";
}) {
    const base =
        "ds-label ds-transition cursor-pointer inline-flex items-center rounded-md px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const style =
        variant === "ghost"
            ? "hover:bg-muted/40"
            : "bg-blue-500/30 text-blue-400 hover:bg-blue-500/40";
    return (
        <button onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
            {children}
        </button>
    );
}

export function ColDropdown({
    headers,
    value,
    onChange,
    allowEmpty,
}: {
    headers: string[];
    value: string;
    onChange: (v: string) => void;
    allowEmpty?: boolean;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="ds-data cursor-pointer w-full rounded border border-border bg-background px-2 py-1"
        >
            {allowEmpty && <option value="">(tidak dipilih)</option>}
            {headers.map((h) => (
                <option key={h} value={h}>
                    {h}
                </option>
            ))}
        </select>
    );
}

export function SummaryStat({
    label,
    value,
    alert,
}: {
    label: string;
    value: string | number;
    alert?: boolean;
}) {
    return (
        <div
            className={`rounded-lg border p-3 ${
                alert ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 bg-muted/10"
            }`}
        >
            <div className="ds-small uppercase tracking-wider opacity-80">{label}</div>
            <div className={`ds-kpi mt-1 ${alert ? "text-amber-400" : ""}`}>{value}</div>
        </div>
    );
}

export function MetaCard({
    label,
    value,
    mono,
}: {
    label: string;
    value: string | number;
    mono?: boolean;
}) {
    return (
        <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
            <div className="ds-small uppercase tracking-wider opacity-80">{label}</div>
            <div className={`${mono ? "ds-data" : "ds-label"} mt-0.5`}>{value}</div>
        </div>
    );
}

const SAMPLE_PAGE_SIZE = 5;

export function PreviewSheetDetail({
    preview,
    samplePage,
    onPageChange,
}: {
    preview: SheetPreview;
    samplePage: number;
    onPageChange: (p: number) => void;
}) {
    const pageStart = samplePage * SAMPLE_PAGE_SIZE;
    const pageRows = preview.sampleRows.slice(pageStart, pageStart + SAMPLE_PAGE_SIZE);
    const pageCount = Math.ceil(preview.sampleRows.length / SAMPLE_PAGE_SIZE);
    const includedHeaders = preview.headers.filter((h) => h.included);
    const skippedHeaders = preview.headers.filter((h) => !h.included);

    return (
        <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MetaCard label="BQ Table" value={preview.tableName} mono />
                <MetaCard label="Mode" value={preview.hierarchyLevel} />
                <MetaCard label="Total Row" value={preview.totalRowsEstimate.toLocaleString("id-ID")} />
                <MetaCard label="Storage ~" value={`${preview.storageEstimateKB} KB`} />
            </div>

            {/* Headers included/skipped */}
            <div>
                <p className="ds-label mb-2">
                    Header ter-sync ke BQ ({includedHeaders.length}/{preview.headers.length})
                </p>
                <div className="flex flex-wrap gap-1">
                    {includedHeaders.map((h) => (
                        <span
                            key={h.safeName}
                            className="ds-data rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400"
                            title={h.name}
                        >
                            {h.safeName}
                        </span>
                    ))}
                </div>
                {skippedHeaders.length > 0 && (
                    <>
                        <p className="ds-label mt-3 mb-2">
                            Header di-skip ({skippedHeaders.length}) — G10 rule: kosong = skip
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {skippedHeaders.map((h, i) => (
                                <span
                                    key={i}
                                    className="ds-data rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-red-400 line-through opacity-70"
                                    title={h.reason}
                                >
                                    col_{i + 1}
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Rejected preview */}
            {preview.rejectedSample.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="ds-label text-amber-400 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Sample Rejected ({preview.rejectedSample.length} dari {preview.rejectedEstimate} estimasi)
                    </p>
                    <div className="space-y-1">
                        {preview.rejectedSample.map((r, i) => (
                            <div key={i} className="ds-small flex items-center gap-2">
                                <span className="ds-data rounded bg-red-500/10 px-2 py-0.5 text-red-400">{r.reason}</span>
                                <span className="opacity-80">row {r.rowNumber}:</span>
                                <span className="font-mono">{r.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sample data pagination */}
            {preview.sampleRows.length > 0 ? (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="ds-label flex items-center gap-2">
                            <Database className="h-3.5 w-3.5" />
                            Sample Data ({preview.sampleRows.length} baris preview)
                        </p>
                        {pageCount > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => onPageChange(Math.max(0, samplePage - 1))}
                                    disabled={samplePage === 0}
                                >
                                    ← Prev
                                </Button>
                                <span className="ds-small">
                                    {samplePage + 1} / {pageCount}
                                </span>
                                <Button
                                    variant="ghost"
                                    onClick={() => onPageChange(Math.min(pageCount - 1, samplePage + 1))}
                                    disabled={samplePage >= pageCount - 1}
                                >
                                    Next →
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border/40">
                        <table className="w-full text-left">
                            <thead className="bg-muted/20">
                                <tr>
                                    {includedHeaders.map((h) => (
                                        <th
                                            key={h.safeName}
                                            className="ds-small uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                                        >
                                            {h.safeName}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((row, i) => (
                                    <tr key={i} className="border-t border-border/20 hover:bg-muted/10">
                                        {includedHeaders.map((h) => (
                                            <td
                                                key={h.safeName}
                                                className="ds-data px-3 py-1.5 whitespace-nowrap opacity-80"
                                            >
                                                {row[h.safeName] || <span className="opacity-40">—</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <p className="ds-small opacity-60 italic">Tidak ada sample data tersedia</p>
            )}
        </div>
    );
}
