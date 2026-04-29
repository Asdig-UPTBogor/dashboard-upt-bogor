"use client";

/**
 * /data-workspace/[dataset]/[table] — god-mode spreadsheet editor.
 * Shell persistent via (authed)/layout.tsx; halaman ini cuma render main area.
 */

import { useParams } from "next/navigation";
import { Space } from "@/app/data-workspace/_space/Space";
import { useTableWorkspace } from "@/hooks/useTableWorkspace";
import { Loader2, AlertTriangle } from "lucide-react";

export default function TableEditorPage() {
    const params = useParams<{ dataset: string; table: string }>();
    const ds = params?.dataset;
    const t = params?.table;
    const ws = useTableWorkspace(ds, t);

    if (!ds || !t) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-destructive">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Invalid dataset / table parameter.
            </div>
        );
    }

    if (!ws.meta) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                {ws.error ? (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive max-w-md">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-medium">Failed to load schema</div>
                            <div className="opacity-80 mt-1">{ws.error}</div>
                        </div>
                    </div>
                ) : (
                    <>
                        <Loader2 className="h-6 w-6 animate-spin opacity-60" />
                        <span className="ds-small opacity-60">Loading schema + data…</span>
                    </>
                )}
            </div>
        );
    }

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

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <Space
                config={config}
                columns={ws.columns}
                rows={ws.rows}
                loading={ws.loading}
                error={ws.error}
                onRefresh={() => void ws.refresh(true)}
                onCreateRow={ws.createRow}
                onUpdateRow={ws.updateRow}
                onArchiveRow={ws.archiveRow}
                onColumnsUpdated={() => void ws.reloadSchema()}
            />
        </div>
    );
}
