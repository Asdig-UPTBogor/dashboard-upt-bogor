"use client";

/**
 * /data-input/[ds] — halaman detail dataset.
 *
 * Tampilkan meta dataset BQ (location, description) + list semua table
 * di dalamnya (card: nama, row count, size, description). Click table =
 * drill ke /data-input/[ds]/[t] (workspace grid).
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    FolderOpen, Table2, Plus, Loader2, AlertTriangle, ChevronRight,
    RefreshCw, ArrowLeft,
} from "lucide-react";

interface TableSummary {
    id: string;
    type: string;
    numRows: number;
    numBytes: number;
    description: string;
    lastModified?: string;
}

interface DatasetDetail {
    id: string;
    location: string;
    description: string;
    friendlyName?: string;
    creationTime?: string;
    lastModifiedTime?: string;
    tables: TableSummary[];
}

export default function DatasetPage() {
    const params = useParams<{ ds: string }>();
    const ds = params?.ds;
    const [data, setData] = useState<DatasetDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        if (!ds) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/data-input/datasets/${encodeURIComponent(ds)}`).then((r) => r.json());
            if (!res.ok) throw new Error(res.message || "Gagal memuat dataset");
            setData(res.dataset);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [ds]);

    if (!ds) return <div className="p-8">Dataset tidak valid.</div>;

    return (
        <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-6">
            <nav className="flex items-center gap-1 ds-small opacity-70">
                <Link href="/data-input" className="ds-transition hover:text-foreground inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Data Input
                </Link>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span className="font-mono">{ds}</span>
            </nav>

            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-primary" />
                        <h1 className="ds-heading">{data?.friendlyName ?? ds}</h1>
                        <span className="ds-label rounded bg-muted px-2 py-0.5 uppercase tracking-wider opacity-80">
                            Dataset
                        </span>
                    </div>
                    <p className="ds-small font-mono opacity-50">{ds}</p>
                    {data?.description && <p className="ds-body opacity-80 max-w-3xl">{data.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        className="ds-transition rounded-md border border-border p-1.5 hover:bg-muted/40 disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <Link
                        href={`/data-input/new/table?ds=${encodeURIComponent(ds)}`}
                        className="ds-transition inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Table
                    </Link>
                </div>
            </header>

            {/* Meta grid */}
            {data && (
                <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetaCard label="Location" value={data.location || "—"} />
                    <MetaCard label="Tables" value={String(data.tables.length)} />
                    <MetaCard label="Dibuat" value={fmtDate(data.creationTime)} />
                    <MetaCard label="Diubah" value={fmtDate(data.lastModifiedTime)} />
                </section>
            )}

            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="ds-small text-destructive">{error}</p>
                </div>
            )}

            {loading && !data && (
                <div className="py-16 flex items-center justify-center gap-2 ds-body opacity-60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat tables...
                </div>
            )}

            {data && (
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="ds-title">Tables</h2>
                        <span className="ds-small font-mono opacity-50">
                            {data.tables.length} table{data.tables.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    {data.tables.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
                            <Table2 className="h-8 w-8 mx-auto opacity-30 mb-2" />
                            <p className="ds-body opacity-70">Dataset ini belum punya table.</p>
                            <Link
                                href={`/data-input/new/table?ds=${encodeURIComponent(ds)}`}
                                className="ds-transition mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Tambah Table Pertama
                            </Link>
                        </div>
                    ) : (
                        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {data.tables.map((t) => (
                                <li key={t.id}>
                                    <Link
                                        href={`/data-input/${encodeURIComponent(ds)}/${encodeURIComponent(t.id)}`}
                                        className="ds-transition block rounded-xl border border-border/40 bg-card/30 p-4 hover:bg-muted/20 hover:border-primary/40"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Table2 className="h-4 w-4 text-primary" />
                                            <h3 className="ds-title truncate">{t.id}</h3>
                                            <span className="ds-label font-mono opacity-50 ml-auto">{t.type}</span>
                                        </div>
                                        <div className="flex items-center gap-3 ds-small opacity-60 mt-2">
                                            <span><span className="ds-data">{t.numRows.toLocaleString()}</span> rows</span>
                                            <span>·</span>
                                            <span>{fmtBytes(t.numBytes)}</span>
                                        </div>
                                        {t.description && (
                                            <p className="ds-small opacity-70 line-clamp-2 mt-2">{t.description}</p>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}

function MetaCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3">
            <p className="ds-small opacity-60 uppercase tracking-wider">{label}</p>
            <p className="ds-data text-foreground mt-1 truncate" title={value}>{value}</p>
        </div>
    );
}

function fmtDate(s?: string): string {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("id-ID", {
            timeZone: "Asia/Jakarta",
            day: "2-digit", month: "short", year: "numeric",
        });
    } catch { return s; }
}

function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
