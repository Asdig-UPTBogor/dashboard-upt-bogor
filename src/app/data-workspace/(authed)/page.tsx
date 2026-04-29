"use client";

/**
 * /data-workspace — Overview landing.
 *  Uses shared WorkspaceUI primitives untuk konsistensi visual dengan
 *  page lain (Dataset hub, Table editor).
 */

import { useEffect, useMemo, useState } from "react";
import {
    DatabaseZap, Table2, FolderTree, FolderPlus, Plus, RefreshCw, Layers,
} from "lucide-react";
import { useWorkspace } from "../_components/WorkspaceContext";
import { useCategoryRegistry } from "@/lib/workspace/useCategoryRegistry";
import { useDatasetCategoryRegistry } from "@/lib/workspace/useDatasetCategoryRegistry";
import { resolveCategory } from "@/lib/workspace/category-resolver";
import {
    PageShell, PageHeader, SectionHeader,
    StatRow, ActionPill, ListContainer, ListRow,
    EmptyState, LoadingState, ErrorBanner, Chip,
} from "../_components/WorkspaceUI";

interface DatasetInfo {
    id: string;
    friendlyName?: string;
    description?: string;
    origin: "user" | "platform" | "legacy";
}

interface TableSummary {
    id: string;
    numRows: number;
    numBytes: number;
    description?: string;
}

interface DatasetWithTables extends DatasetInfo {
    tables?: TableSummary[];
}

function fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
}

export default function WorkspaceOverviewPage() {
    const { openNewGroup, openNewDataset, openNewTable } = useWorkspace();
    const { categories } = useCategoryRegistry();
    const { overlay: dsOverlay } = useDatasetCategoryRegistry();

    const [datasets, setDatasets] = useState<DatasetWithTables[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/data-input/datasets").then((r) => r.json());
            if (!res.ok) throw new Error(res.message || "Failed to load datasets");
            setDatasets(res.datasets);
            for (const d of res.datasets as DatasetInfo[]) {
                fetch(`/api/data-input/datasets/${encodeURIComponent(d.id)}`)
                    .then((r) => r.json())
                    .then((dr) => {
                        if (dr.ok) {
                            setDatasets((prev) => prev.map((x) =>
                                x.id === d.id ? { ...x, tables: dr.dataset.tables } : x
                            ));
                        }
                    })
                    .catch(() => {});
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, []);

    const stats = useMemo(() => {
        const totalDs = datasets.length;
        const totalTables = datasets.reduce((sum, d) => sum + (d.tables?.length ?? 0), 0);
        const totalRows = datasets.reduce((sum, d) =>
            sum + (d.tables?.reduce((s, t) => s + (t.numRows || 0), 0) ?? 0), 0);
        return { totalDs, totalTables, totalRows };
    }, [datasets]);

    const groupBreakdown = useMemo(() => {
        const counts = new Map<string, number>();
        for (const d of datasets) {
            const cat = resolveCategory(d.id, { fsCategory: dsOverlay[d.id]?.category });
            counts.set(cat, (counts.get(cat) ?? 0) + 1);
        }
        return categories
            .map((c) => ({ key: c.key, label: c.label, count: counts.get(c.key) ?? 0, hint: c.hint }))
            .filter((x) => x.count > 0);
    }, [datasets, dsOverlay, categories]);

    return (
        <PageShell>
            <PageHeader
                title="Overview"
                subtitle={`${stats.totalDs} dataset · ${stats.totalTables} table · ~${fmtNum(stats.totalRows)} rows`}
                action={
                    <ActionPill
                        icon={RefreshCw}
                        label="Refresh"
                        onClick={load}
                        busy={loading}
                    />
                }
            />

            {error && <ErrorBanner title="Failed to load" message={error} />}

            <StatRow stats={[
                { icon: DatabaseZap, label: "Datasets", value: stats.totalDs },
                { icon: Table2, label: "Tables", value: stats.totalTables },
                { icon: Layers, label: "Rows", value: fmtNum(stats.totalRows) },
            ]} />

            <div className="flex flex-wrap gap-2">
                <ActionPill icon={FolderTree} label="New group" onClick={openNewGroup} />
                <ActionPill icon={FolderPlus} label="New dataset" onClick={openNewDataset} />
                <ActionPill icon={Plus} label="New table" onClick={() => openNewTable()} primary />
            </div>

            {groupBreakdown.length > 0 && (
                <section className="space-y-2">
                    <SectionHeader title="By group" />
                    <div className="flex flex-wrap gap-1.5">
                        {groupBreakdown.map((g) => (
                            <Chip key={g.key} label={g.label} value={g.count} hint={g.hint} />
                        ))}
                    </div>
                </section>
            )}

            <section className="space-y-2">
                <SectionHeader title="All datasets" hint="click to open" />
                {loading && datasets.length === 0 ? (
                    <LoadingState label="Listing datasets…" />
                ) : datasets.length === 0 && !error ? (
                    <EmptyState icon={DatabaseZap} title="No datasets yet" />
                ) : (
                    <ListContainer>
                        {datasets.map((d) => {
                            const alias = dsOverlay[d.id]?.alias ?? d.friendlyName ?? d.id;
                            const tblCount = d.tables?.length;
                            const cat = resolveCategory(d.id, { fsCategory: dsOverlay[d.id]?.category });
                            const catLabel = categories.find((c) => c.key === cat)?.label ?? cat;
                            return (
                                <ListRow
                                    key={d.id}
                                    href={`/data-workspace/${encodeURIComponent(d.id)}`}
                                    icon={DatabaseZap}
                                    title={alias}
                                    meta={
                                        <>
                                            <span className="hidden sm:inline truncate max-w-[120px]">{catLabel}</span>
                                            <span className="font-mono tabular-nums w-12 text-right">
                                                {tblCount !== undefined ? `${tblCount} tbl` : "…"}
                                            </span>
                                        </>
                                    }
                                />
                            );
                        })}
                    </ListContainer>
                )}
            </section>
        </PageShell>
    );
}
