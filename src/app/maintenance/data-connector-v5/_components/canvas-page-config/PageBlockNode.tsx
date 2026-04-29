"use client";

/**
 * PageBlockNode — xyflow sink node untuk dashboard page di Canvas Page Config.
 *
 * Adopt V4 `data-source/_components/xyflow/page-block-node.tsx` persis.
 * Beda: data shape pakai `connectedSources` (bukan `connectedSheets`) karena
 * V5 = BQ tables, bukan spreadsheet sheet.
 *
 * No delete icon — page block permanent.
 * 4 handles bidirectional (source + target tiap sisi).
 */

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { LayoutDashboard } from "lucide-react";
import type { PageBlockNodeData } from "./types";

export type PageBlockNodeType = Node<PageBlockNodeData, "page">;

function PageBlockNode({ data }: NodeProps<PageBlockNodeType>) {
    const { pagePath, pageLabel, connectedSources, connectedColumns } = data;

    return (
        <div className="rounded-2xl border-2 border-indigo-500/40 bg-card
            shadow-2xl shadow-indigo-500/10 min-w-[240px] max-w-[280px] backdrop-blur-sm">
            {/* Glow effect */}
            <div className="absolute -inset-[1px] rounded-2xl bg-linear-to-br from-indigo-500/20 to-violet-500/20 blur-sm -z-10" />

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-indigo-500/20">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
                    <LayoutDashboard className="h-4 w-4 text-foreground" />
                </div>
                <div className="min-w-0">
                    <p className="ds-title truncate leading-tight">{pageLabel}</p>
                    <p className="ds-small font-mono text-indigo-500 dark:text-indigo-300/70 truncate">
                        {pagePath}
                    </p>
                </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2.5">
                {/* Data Sources row */}
                <div className="flex items-center justify-between">
                    <span className="ds-label uppercase tracking-wider">Data Sources</span>
                    <span className="ds-data text-indigo-500 dark:text-indigo-400">
                        {connectedSources}
                    </span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-linear-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                        style={{ width: connectedSources > 0 ? "100%" : "0%" }}
                    />
                </div>

                {/* Sources info */}
                <p className="ds-small text-center">
                    {connectedSources > 0
                        ? `${connectedSources} tabel terhubung`
                        : "Tarik tabel BQ ke sini →"}
                </p>

                {/* Connected Columns row */}
                {connectedColumns > 0 && (
                    <div className="pt-1 border-t border-border/40">
                        <div className="flex items-center justify-between">
                            <span className="ds-label uppercase tracking-wider">Kolom</span>
                            <span className="ds-data text-cyan-500 dark:text-cyan-400">
                                {connectedColumns}
                            </span>
                        </div>
                        <p className="ds-small text-center text-cyan-600 dark:text-cyan-500 mt-1">
                            {connectedColumns} kolom connected
                        </p>
                    </div>
                )}
            </div>

            {/* Handles on all 4 sides — bidirectional */}
            {[
                { position: Position.Left, style: { top: "50%", left: -6 } },
                { position: Position.Right, style: { top: "50%", right: -6 } },
                { position: Position.Top, style: { left: "50%", top: -6 } },
                { position: Position.Bottom, style: { left: "50%", bottom: -6 } },
            ].map(({ position, style }) => (
                <span key={position}>
                    <Handle
                        type="target"
                        position={position}
                        id={`page-input-${position}`}
                        style={{
                            ...style,
                            width: 12,
                            height: 12,
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            border: "3px solid var(--card)",
                        }}
                    />
                    <Handle
                        type="source"
                        position={position}
                        id={`page-output-${position}`}
                        style={{
                            ...style,
                            width: 12,
                            height: 12,
                            background: "transparent",
                            border: "none",
                        }}
                    />
                </span>
            ))}
        </div>
    );
}

export default memo(PageBlockNode);
