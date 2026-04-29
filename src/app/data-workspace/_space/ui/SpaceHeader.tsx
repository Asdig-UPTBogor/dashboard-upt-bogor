"use client";

/**
 * SpaceHeader — title + bq id + description (clean look).
 *
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │ 📊 Table Alias                                  [edit alias ✎]  │
 *  │    bigquery: dataset.table_name                                  │
 *  │    description (kalau ada)                                       │
 *  └──────────────────────────────────────────────────────────────────┘
 *
 * Stats meta (rows/cols/PK/level/kind) DIPINDAH ke SpaceStatusBar (footer).
 */

import { Table2, Database, Lock, Pencil } from "lucide-react";
import type { WorkspaceTableConfig } from "@/app/data-input/_workspace/types";

interface Props {
    config: WorkspaceTableConfig;
    onEditAlias?: () => void;
}

export function SpaceHeader({ config, onEditAlias }: Props) {
    const alias = config.displayName || config.table;
    const bqId = `${config.dataset}.${config.table}`;
    const showDifferentAlias = alias !== config.table;

    return (
        <div className="shrink-0 border-b border-border/60 bg-card/30">
            <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Table2 className="h-4 w-4 shrink-0 text-primary" />
                        <h1 className="ds-title truncate">{alias}</h1>
                        {onEditAlias && (
                            <button
                                type="button"
                                onClick={onEditAlias}
                                title="Edit table alias"
                                aria-label="Edit alias"
                                className="ds-interactive ds-press ds-focus rounded h-5 w-5 inline-flex items-center justify-center text-muted-foreground hover:text-primary opacity-0 group-hover/header:opacity-60 ds-transition"
                            >
                                <Pencil className="h-3 w-3" />
                            </button>
                        )}
                        {config.readOnly && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-muted/50 text-muted-foreground border border-border/40">
                                <Lock className="h-2.5 w-2.5" />
                                read-only
                            </span>
                        )}
                    </div>
                    <div className="ds-small font-mono opacity-50 mt-0.5 truncate flex items-center gap-1.5">
                        <Database className="h-3 w-3 shrink-0" />
                        {bqId}
                        {showDifferentAlias && (
                            <span className="opacity-40 ml-1.5">(table: {config.table})</span>
                        )}
                    </div>
                    {config.description && (
                        <p className="text-xs text-muted-foreground/80 mt-1.5 max-w-2xl">
                            {config.description}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
