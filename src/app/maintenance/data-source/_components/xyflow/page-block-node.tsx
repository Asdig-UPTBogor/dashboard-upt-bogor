"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { LayoutDashboard } from "lucide-react";

/**
 * PageBlockNode — Custom xyflow node representing the target dashboard page.
 *
 * This is the "sink" node on the canvas — sheets connect TO this block
 * to indicate which data sources feed this page.
 *
 * Visual: a larger, prominent card with page name + path,
 * with target handles on the left side for incoming connections.
 */

export type PageBlockData = {
    pagePath: string;
    pageLabel: string;
    connectedSheets: number;
    connectedColumns: number;
};

export type PageBlockNodeType = Node<PageBlockData, "page-block">;

function PageBlockNode({ data }: NodeProps<PageBlockNodeType>) {
    const { pagePath, pageLabel, connectedSheets, connectedColumns = 0 } = data;

    return (
        <div className="rounded-2xl border-2 border-indigo-500/40 bg-card
            shadow-2xl shadow-indigo-500/10 min-w-[220px] max-w-[260px] backdrop-blur-sm">
            {/* Glow effect */}
            <div className="absolute -inset-[1px] rounded-2xl bg-linear-to-br from-indigo-500/20 to-violet-500/20 blur-sm -z-10" />

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-indigo-500/20">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
                    <LayoutDashboard className="h-4.5 w-4.5 text-white" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{pageLabel}</p>
                    <p className="text-xs text-indigo-500 dark:text-indigo-300/70 font-mono truncate">{pagePath}</p>
                </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2.5">
                {/* Data Sources row */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Data Sources</span>
                    <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">{connectedSheets}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-linear-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                        style={{ width: connectedSheets > 0 ? "100%" : "0%" }}
                    />
                </div>

                {/* Sheets info */}
                <p className="text-xs text-muted-foreground text-center">
                    {connectedSheets > 0
                        ? `${connectedSheets} sheet terhubung`
                        : "Tarik sheet ke sini →"}
                </p>

                {/* Connected Columns row (only show when > 0) */}
                {connectedColumns > 0 && (
                    <div className="pt-1 border-t border-border/40">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Kolom</span>
                            <span className="text-xs font-bold text-cyan-500 dark:text-cyan-400">{connectedColumns}</span>
                        </div>
                        <p className="text-xs text-cyan-600 dark:text-cyan-500 text-center mt-1">
                            {connectedColumns} kolom connected
                        </p>
                    </div>
                )}

                {connectedColumns === 0 && connectedSheets > 0 && (
                    <div className="pt-1 border-t border-border/40">
                        <p className="text-xs text-amber-600/80 text-center">
                            Drag kolom ke sini untuk connect
                        </p>
                    </div>
                )}
            </div>

            {/* Handles on all 4 sides — bidirectional (source + target) */}
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
