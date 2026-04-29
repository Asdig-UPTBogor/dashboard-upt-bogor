"use client";

/**
 * /data-workspace/[dataset] — dataset hub page.
 *
 *  Displays:
 *   ▸ Header: alias H1, BQ ID copy chip, group badge, description
 *   ▸ Stats cards: total tables, total rows, total bytes, last updated
 *   ▸ Table list: sortable, click → editor
 *   ▸ Right rail: metadata (location, created, owner) + quick actions
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    Table2, Loader2, AlertTriangle, ChevronRight, RefreshCw, DatabaseZap, Plus,
    Copy, Check, MapPin, Layers, HardDrive, Calendar,
} from "lucide-react";
import { useWorkspace } from "../../_components/WorkspaceContext";
import { useDatasetCategoryRegistry } from "@/lib/workspace/useDatasetCategoryRegistry";
import { useCategoryRegistry } from "@/lib/workspace/useCategoryRegistry";
import { resolveCategory } from "@/lib/workspace/category-resolver";

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

function formatBytes(n: number): string {
    if (!n) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0, x = n;
    while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
    return `${x.toFixed(x >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
}

function formatRelative(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" });
}

export default function DatasetHubPage() {
    const params = useParams<{ dataset: string }>();
    const ds = params?.dataset;
    const { openNewTable } = useWorkspace();
    const { overlay: dsOverlay } = useDatasetCategoryRegistry();
    const { categories } = useCategoryRegistry();

    const [data, setData] = useState<DatasetDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    async function load() {
        if (!ds) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/data-input/datasets/${encodeURIComponent(ds)}`).then((r) => r.json());
            if (!res.ok) throw new Error(res.message || "Failed to load dataset");
            setData(res.dataset);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [ds]);

    const alias = ds ? (dsOverlay[ds]?.alias ?? data?.friendlyName ?? ds) : "";
    const groupKey = ds ? resolveCategory(ds, { fsCategory: dsOverlay[ds]?.category }) : null;
    const groupLabel = categories.find((c) => c.key === groupKey)?.label ?? groupKey ?? "—";

    const stats = useMemo(() => {
        const tables = data?.tables ?? [];
        const totalRows = tables.reduce((s, t) => s + (t.numRows || 0), 0);
        const totalBytes = tables.reduce((s, t) => s + (t.numBytes || 0), 0);
        return {
            totalTables: tables.length,
            totalRows,
            totalBytes,
        };
    }, [data]);

    function copyId() {
        if (!ds) return;
        navigator.clipboard?.writeText(ds);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <div className="flex-1 overflow-auto">
            <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
                {/* Header */}
                <header className="space-y-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                                <DatabaseZap className="h-5 w-5 text-primary shrink-0" />
                                <h1 className="ds-heading truncate">{alias}</h1>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="ds-small uppercase tracking-widest opacity-50">BQ ID</span>
                                <code className="text-xs font-mono opacity-80 px-2 py-0.5 rounded bg-muted/40 border border-border/40">
                                    {ds}
                                </code>
                                <button
                                    type="button"
                                    onClick={copyId}
                                    title="Copy BQ ID"
                                    className="ds-transition text-xs inline-flex items-center gap-1 opacity-50 hover:opacity-100 hover:text-primary"
                                >
                                    {copied
                                        ? <><Check className="h-3 w-3" /> copied</>
                                        : <><Copy className="h-3 w-3" /> copy</>}
                                </button>
                                <span className="opacity-30">·</span>
                                <span className="ds-small opacity-60">{groupLabel}</span>
                            </div>
                            {data?.description && (
                                <p className="ds-body opacity-80 max-w-3xl pt-1">{data.description}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={load}
                                disabled={loading}
                                className="ds-btn ds-btn-secondary ds-btn-sm"
                                title="Refresh"
                            >
                                {loading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <RefreshCw className="h-3.5 w-3.5" />}
                                <span>Refresh</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => openNewTable(ds)}
                                className="ds-btn ds-btn-primary ds-btn-sm"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>New table</span>
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-medium">Failed to load dataset</div>
                            <div className="opacity-80 mt-1">{error}</div>
                        </div>
                    </div>
                )}

                {loading && !data ? (
                    <div className="py-16 flex flex-col items-center gap-3 opacity-60">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ds-small">Loading…</span>
                    </div>
                ) : data ? (
                    <>
                        {/* Stat cards */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard icon={Table2} label="Tables" value={stats.totalTables.toString()} />
                            <StatCard icon={Layers} label="Total rows" value={formatNum(stats.totalRows)} />
                            <StatCard icon={HardDrive} label="Storage" value={formatBytes(stats.totalBytes)} />
                            <StatCard icon={MapPin} label="Region" value={data.location || "—"} />
                        </div>

                        {/* Tables list */}
                        <section className="space-y-2">
                            <div className="flex items-baseline justify-between">
                                <h2 className="ds-label opacity-70">Tables ({stats.totalTables})</h2>
                                {data.tables.length > 0 && (
                                    <span className="ds-small opacity-50">click row to edit data</span>
                                )}
                            </div>

                            {data.tables.length === 0 ? (
                                /* Empty state — kompak, tidak penuhin layout */
                                <div className="rounded-md border border-dashed border-border/50 bg-card/20 px-6 py-8 flex flex-col items-center gap-2 text-center max-w-md mx-auto">
                                    <Table2 className="h-7 w-7 opacity-30" />
                                    <p className="text-sm opacity-70">Belum ada table di dataset ini.</p>
                                    <button
                                        type="button"
                                        onClick={() => openNewTable(ds)}
                                        className="ds-btn ds-btn-primary ds-btn-sm mt-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Create first table</span>
                                    </button>
                                </div>
                            ) : (
                                <ul className="divide-y divide-border/40 rounded-md border border-border/50 bg-card/20 overflow-hidden">
                                    <li className="grid grid-cols-[1fr_100px_100px_140px_24px] gap-3 px-3 py-1.5 ds-small uppercase tracking-widest opacity-50 bg-muted/20">
                                        <span>Table</span>
                                        <span className="text-right">Rows</span>
                                        <span className="text-right">Size</span>
                                        <span className="text-right">Last modified</span>
                                        <span></span>
                                    </li>
                                    {data.tables.map((t) => (
                                        <li key={t.id}>
                                            <Link
                                                href={`/data-workspace/${encodeURIComponent(ds!)}/${encodeURIComponent(t.id)}`}
                                                className="ds-transition grid grid-cols-[1fr_100px_100px_140px_24px] gap-3 px-3 py-2 items-center hover:bg-muted/30 group/trow"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover/trow:text-primary ds-transition" />
                                                    <div className="min-w-0">
                                                        <div className="text-sm truncate">{t.id}</div>
                                                        {t.description && (
                                                            <div className="ds-small opacity-50 truncate">{t.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-mono opacity-70 tabular-nums text-right">
                                                    {formatNum(t.numRows)}
                                                </span>
                                                <span className="text-xs font-mono opacity-70 tabular-nums text-right">
                                                    {formatBytes(t.numBytes)}
                                                </span>
                                                <span className="text-xs opacity-60 text-right">
                                                    {formatRelative(t.lastModified)}
                                                </span>
                                                <ChevronRight className="h-3.5 w-3.5 opacity-30 group-hover/trow:opacity-100 group-hover/trow:text-primary ds-transition" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Metadata footer */}
                        <section className="space-y-2 pt-4 border-t border-border/40">
                            <h2 className="ds-label opacity-70">Metadata</h2>
                            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                                <Meta icon={Calendar} label="Created" value={data.creationTime ? formatRelative(data.creationTime) : "—"} />
                                <Meta icon={Calendar} label="Last modified" value={data.lastModifiedTime ? formatRelative(data.lastModifiedTime) : "—"} />
                                <Meta icon={MapPin} label="Region" value={data.location || "—"} />
                                <Meta icon={Layers} label="Group" value={groupLabel} />
                            </dl>
                        </section>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function StatCard({
    icon: Icon, label, value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-md border border-border/50 bg-card/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="ds-label opacity-70">{label}</span>
            </div>
            <div className="ds-kpi">{value}</div>
        </div>
    );
}

function Meta({
    icon: Icon, label, value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="h-3 w-3 opacity-50 shrink-0" />
            <span className="opacity-60">{label}:</span>
            <span className="font-medium truncate">{value}</span>
        </div>
    );
}
