"use client";

/**
 * BQTableNode — xyflow node untuk BQ user table di Canvas Page Config.
 *
 * Pattern adopted dari V4 `data-source/_components/xyflow/sheet-node.tsx`, beda:
 *   - Icon = Database (bukan FileSpreadsheet)
 *   - Level badge di top-right (LEVEL_META color)
 *   - Delete X icon di top-right — hover visible, onClick → data.onDelete()
 *   - Data shape: { dataset, table, level, columns, onDelete? }
 *
 * Handle convention (mirror V4):
 *   {nodeId}::__feed__source               → header right, source only (ke page block)
 *   {nodeId}::{colName}__source            → column row right, source
 *   {nodeId}::{colName}__target            → column row left, target
 *   {nodeId}::{colName}__source_left       → column row left, source (bidirectional)
 *   {nodeId}::{colName}__target_right      → column row right, target (bidirectional)
 */

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Database, X } from "lucide-react";
import { LEVEL_META } from "./constants";
import type { BQTableNodeData } from "./types";

export type BQTableNodeType = Node<BQTableNodeData, "bqTable">;

function BQTableNode({ data, id }: NodeProps<BQTableNodeType>) {
    const { dataset, table, level, columns, onDelete } = data;
    const meta = LEVEL_META[level];

    return (
        <div className="group rounded-xl border border-border bg-card shadow-xl shadow-black/10 dark:shadow-black/30 min-w-[240px] max-w-[280px]">
            {/* Header */}
            <div className="relative flex items-center gap-2 rounded-t-xl bg-linear-to-r from-zinc-700/20 to-zinc-500/20 px-3 py-2.5 border-b border-border/60">
                <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="ds-title truncate leading-tight">{table}</p>
                    <p className="ds-small font-mono truncate">{dataset}</p>
                </div>

                {/* Level badge */}
                <span
                    className={`ds-data shrink-0 rounded px-1.5 py-0.5 border ${meta.bg} ${meta.color}`}
                    title={meta.description}
                >
                    {meta.label}
                </span>

                {/* Delete X — hover visible */}
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="ds-transition opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 cursor-pointer shrink-0"
                        title={`Hapus ${table} dari canvas`}
                        aria-label="Hapus dari canvas"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}

                {/* Feed handle (right side header) → Page Block */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id={`${id}::__feed__source`}
                    style={{
                        top: "50%",
                        width: 10,
                        height: 10,
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        border: "2px solid var(--card)",
                        right: -5,
                    }}
                />
            </div>

            {/* Columns list */}
            <div className="py-1">
                {columns.length === 0 && (
                    <div className="px-3 py-2 ds-small italic opacity-50">
                        No columns
                    </div>
                )}
                {columns.map((col) => {
                    const handleId = `${id}::${col.name}`;
                    return (
                        <div
                            key={col.name}
                            className="relative flex items-center gap-2 px-3 h-7 text-xs transition-colors hover:bg-muted/50 text-muted-foreground"
                        >
                            <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/50" />
                            <span className="truncate font-mono flex-1 ds-body">{col.name}</span>
                            <span className="ds-small opacity-40 font-mono shrink-0">
                                {col.type}
                            </span>

                            {/* RIGHT side: source + target */}
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={`${handleId}__source`}
                                style={{ top: "50%", width: 8, height: 8, background: "var(--muted-foreground)", border: "2px solid var(--card)", right: -4 }}
                            />
                            <Handle
                                type="target"
                                position={Position.Right}
                                id={`${handleId}__target_right`}
                                style={{ top: "50%", width: 8, height: 8, background: "transparent", border: "none", right: -4 }}
                            />

                            {/* LEFT side: target + source */}
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={`${handleId}__target`}
                                style={{ top: "50%", width: 8, height: 8, background: "var(--muted-foreground)", border: "2px solid var(--card)", left: -4 }}
                            />
                            <Handle
                                type="source"
                                position={Position.Left}
                                id={`${handleId}__source_left`}
                                style={{ top: "50%", width: 8, height: 8, background: "transparent", border: "none", left: -4 }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default memo(BQTableNode);
