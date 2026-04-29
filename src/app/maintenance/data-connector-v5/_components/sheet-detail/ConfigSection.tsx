"use client";

/**
 * ConfigSection — sheet sync metadata V2 (sheet API related).
 *
 * Hierarchy Level + FK columns di-set di Data Level Config (Layer 2-B di BQ),
 * source of truth = `bq_table_levels/{dataset}__{table}` collection.
 * Pointer `levelRef` di V2 SheetConfig → tampil di sini.
 */

import { Layers } from "lucide-react";

export function ConfigSection({
    sheetTabId,
    levelRef,
    datasetId,
    tableName,
}: {
    sheetTabId: string;
    levelRef: string | null;
    datasetId: string;
    tableName?: string;
}) {
    return (
        <section>
            <h3 className="ds-small uppercase tracking-widest opacity-70 mb-3 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" /> Sync Metadata (V2)
            </h3>
            <div className="rounded-lg border border-border bg-card divide-y divide-border text-sm">
                <Row label="Sheet Tab ID (permanent)" value={sheetTabId} mono />
                <Row label="BQ Table" value={`${datasetId}.${tableName ?? ""}`} mono />
                <Row
                    label="Level Ref"
                    value={levelRef ?? "unset — belum di-config di Data Level Config"}
                    mono={!!levelRef}
                />
            </div>
            <p className="ds-small opacity-60 mt-2">
                Level hirarki + FK kolom di-set di <span className="font-mono">Data Level Config</span> (Layer 2-B).
            </p>
        </section>
    );
}

function Row({
    label,
    value,
    mono,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="flex justify-between items-center px-3 py-2 gap-3">
            <span className="ds-small opacity-70 shrink-0">{label}</span>
            <span className={`text-right text-xs truncate ${mono ? "font-mono" : ""}`}>
                {value}
            </span>
        </div>
    );
}
