"use client";

/**
 * /data-input/[ds]/[t] — workspace grid untuk edit table BQ langsung.
 *
 * Generic render via MasterGrid — bekerja untuk table apapun, config dinamis
 * dari BQ schema + Firestore overlay.
 */

import { useParams } from "next/navigation";
import { MasterGrid } from "../../_workspace/MasterGrid";
import { useTableWorkspace } from "@/hooks/useTableWorkspace";

export default function TableWorkspacePage() {
    const params = useParams<{ ds: string; t: string }>();
    const ds = params?.ds;
    const t = params?.t;
    const ws = useTableWorkspace(ds, t);

    if (!ds || !t) return <div className="p-8">Parameter dataset/table tidak valid.</div>;

    if (!ws.meta) {
        return (
            <div className="p-8 space-y-3">
                <div className="flex items-center gap-2 ds-body opacity-70">
                    {!ws.error && (
                        <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                    {ws.error ? `Error: ${ws.error}` : "Memuat schema + data dari BigQuery..."}
                </div>
                {!ws.error && (
                    <p className="ds-small opacity-50">
                        First-hit cold query ~5-8s; selanjutnya cached 60s.
                    </p>
                )}
            </div>
        );
    }

    // Level derivation: Master_Data hierarchy canonical
    // UPT=1 · ULTG=2 · Gardu_Induk=3 · Bay=4 · lainnya=0 (flat)
    const LEVEL_MAP: Record<string, number> = { UPT: 1, ULTG: 2, Gardu_Induk: 3, Bay: 4 };
    const level = ds === "Master_Data" ? (LEVEL_MAP[t] ?? 0) : 0;

    const config = {
        dataset: ds,
        table: t,
        primaryKey: ws.meta.primaryKey,
        displayKey: ws.meta.displayKey,
        displayName: ws.meta.tableAlias ?? t,
        description: ws.meta.description ?? "",
        category: "master" as const,
        level,
    };

    const breadcrumb = [
        { label: "Data Input", href: "/data-input" },
        { label: ds, href: `/data-input/${encodeURIComponent(ds)}` },
        { label: ws.meta.tableAlias ?? t },
    ];

    return (
        <MasterGrid
            config={config}
            columns={ws.columns}
            rows={ws.rows}
            loading={ws.loading}
            error={ws.error}
            breadcrumb={breadcrumb}
            tableKey={`${ds}/${t}`}
            onRefresh={() => void ws.refresh()}
            onCreateRow={ws.createRow}
            onUpdateRow={ws.updateRow}
            onArchiveRow={ws.archiveRow}
            onColumnsUpdated={() => void ws.reloadSchema()}
        />
    );
}
