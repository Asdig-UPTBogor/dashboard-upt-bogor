"use client";

/**
 * /data-input — Data Input Dashboard landing.
 *
 * List semua BQ dataset yang auto-discover dari bq list. Click dataset =
 * drill ke /data-input/[ds]. Zero hardcode — sidebar + landing otomatis
 * reflect state BQ.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { DatabaseZap, Plus, FolderOpen, Loader2, AlertTriangle, RefreshCw, Lock, User } from "lucide-react";

interface DatasetInfo {
    id: string;
    location: string;
    description: string;
    friendlyName?: string;
    origin: "user" | "platform" | "legacy";
    platformName?: string;
    ownerEmail?: string;
}

export default function DataInputLandingPage() {
    const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/data-input/datasets").then((r) => r.json());
            if (!res.ok) throw new Error(res.message || "Gagal memuat datasets");
            setDatasets(res.datasets);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, []);

    return (
        <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <DatabaseZap className="h-5 w-5 text-primary" />
                        <h1 className="ds-heading">Data Input Dashboard</h1>
                    </div>
                    <p className="ds-body opacity-80 max-w-3xl">
                        Universal browser + editor untuk semua BigQuery dataset. Dataset ≡ spreadsheet,
                        table ≡ sheet tab. Pattern sama untuk Master Data, data platform Level 1/1E/2/3,
                        dan dataset baru yang kamu bikin.
                    </p>
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
                        href="/data-input/new/dataset"
                        className="ds-transition inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Dataset
                    </Link>
                    <Link
                        href="/data-input/new/table"
                        className="ds-transition inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Table
                    </Link>
                </div>
            </header>

            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="ds-small text-destructive">{error}</p>
                </div>
            )}

            {loading && datasets.length === 0 && (
                <div className="py-20 flex items-center justify-center gap-2 ds-body opacity-60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat dataset BigQuery...
                </div>
            )}

            {!loading && datasets.length === 0 && !error && (
                <div className="py-16 text-center space-y-3">
                    <FolderOpen className="h-12 w-12 mx-auto opacity-30" />
                    <p className="ds-body opacity-70">Belum ada dataset di project ini.</p>
                    <Link
                        href="/data-input/new/dataset"
                        className="ds-transition inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Dataset Pertama
                    </Link>
                </div>
            )}

            {datasets.length > 0 && (
                <>
                    <DatasetGroup
                        title="Dataset User"
                        description="Dataset yang kamu bikin lewat wizard [+ Dataset]. CRUD penuh."
                        items={datasets.filter((d) => d.origin === "user")}
                        accent="primary"
                    />
                    <DatasetGroup
                        title="Dataset Platform"
                        description="Dataset auto-dibuat oleh platform Level 1/1E/2/3 (Thor, Dispatch, dll). Treat sebagai read-only."
                        items={datasets.filter((d) => d.origin === "platform")}
                        accent="platform"
                    />
                    <DatasetGroup
                        title="Dataset Legacy"
                        description="Dataset dari sistem Spreadsheet Sync lama. Akan dihapus setelah Data Input stabil. Jangan bikin feature baru yang bergantung di sini."
                        items={datasets.filter((d) => d.origin === "legacy")}
                        accent="legacy"
                    />
                </>
            )}
        </div>
    );
}

/* ─── Dataset Group ──────────────────────────────────────── */

function DatasetGroup({
    title, description, items, accent,
}: {
    title: string;
    description: string;
    items: DatasetInfo[];
    accent: "primary" | "platform" | "legacy";
}) {
    if (items.length === 0) return null;
    const accentConfig = {
        primary:  { ring: "border-primary/30 bg-primary/5", badge: "ds-tag-primary", icon: User },
        platform: { ring: "border-border/60",               badge: "ds-tag-info",    icon: Lock },
        legacy:   { ring: "border-border/40 opacity-70",    badge: "ds-tag-warn",    icon: Lock },
    } as const;
    const { ring, badge: badgeCls, icon: Icon } = accentConfig[accent];

    return (
        <section>
            <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="ds-title">{title}</h2>
                <span className={`ds-label rounded border px-1.5 py-0.5 ${badgeCls}`}>
                    {items.length}
                </span>
            </div>
            <p className="ds-small opacity-70 mb-3">{description}</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((ds) => (
                    <li key={ds.id}>
                        <Link
                            href={`/data-input/${encodeURIComponent(ds.id)}`}
                            className={`ds-transition block rounded-xl border bg-card/30 p-4 hover:bg-muted/20 hover:border-primary/40 ${ring}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <FolderOpen className="h-4 w-4 text-primary" />
                                <h3 className="ds-title truncate flex-1">{ds.friendlyName ?? ds.id}</h3>
                                <span className={`ds-label rounded border px-1.5 py-0.5 text-[10px] ${badgeCls}`}>
                                    {ds.origin}
                                </span>
                            </div>
                            <p className="ds-small font-mono opacity-50 truncate">{ds.id}</p>
                            {ds.description && (
                                <p className="ds-small opacity-70 line-clamp-2 mt-1">{ds.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 ds-small opacity-50">
                                {ds.location && <span>📍 {ds.location}</span>}
                                {ds.ownerEmail && <span>· 👤 {ds.ownerEmail}</span>}
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
