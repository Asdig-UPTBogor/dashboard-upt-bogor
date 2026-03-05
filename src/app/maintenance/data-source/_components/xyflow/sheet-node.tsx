"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { FileSpreadsheet } from "lucide-react";

/**
 * SheetNode — Custom xyflow node representing a spreadsheet sheet.
 *
 * Displays sheet name + column list.
 * Each column row has source (right) + target (left) handles.
 *
 * Handle positioning: Handles are placed INSIDE each row's <div> and use
 * position:absolute + top:50% to vertically center within the row.
 * This guarantees edges connect exactly at the column row, not drifting.
 */

export type SheetNodeData = {
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheetName: string;
    columns: string[];
    hierarchyColumns?: string[];
};

export type SheetNodeType = Node<SheetNodeData, "sheet">;

function SheetNode({ data, id }: NodeProps<SheetNodeType>) {
    const { spreadsheetTitle, sheetName, columns, hierarchyColumns = [] } = data;
    const hierSet = new Set(hierarchyColumns.map((c) => c.toLowerCase()));

    return (
        <div className="rounded-xl border border-border bg-card shadow-xl shadow-black/10 dark:shadow-black/30 min-w-[220px] max-w-[260px]">
            {/* Header */}
            <div className="relative flex items-center gap-2 rounded-t-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 px-3 py-2.5 border-b border-border/60">
                <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{sheetName}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{spreadsheetTitle}</p>
                </div>
                {/* Feed handle (right side of header) — connects to Page Block */}
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
                        boxShadow: "0 0 6px rgba(99,102,241,0.3)",
                    }}
                />
            </div>

            {/* Columns — each row has its own handles, positioned relative to the row */}
            <div className="py-1">
                {columns.map((col) => {
                    const isHierarchy = hierSet.has(col.toLowerCase());
                    const handleId = `${id}::${col}`;

                    return (
                        <div
                            key={col}
                            className={`
                                relative flex items-center gap-2 px-3 h-7 text-[11px]
                                transition-colors hover:bg-muted/50
                                ${isHierarchy ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground"}
                            `}
                        >
                            <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${isHierarchy ? "bg-emerald-500 dark:bg-emerald-400" : "bg-muted-foreground/40"}`} />
                            <span className="truncate font-mono flex-1">{col}</span>

                            {/* Source handle (right) — relative to THIS row via top:50% */}
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={`${handleId}__source`}
                                style={{
                                    top: "50%",
                                    width: 8,
                                    height: 8,
                                    background: isHierarchy ? "#34d399" : "color-mix(in oklch, var(--muted-foreground) 50%, transparent)",
                                    border: "2px solid var(--card)",
                                    right: -4,
                                }}
                            />

                            {/* Target handle (left) — relative to THIS row via top:50% */}
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={`${handleId}__target`}
                                style={{
                                    top: "50%",
                                    width: 8,
                                    height: 8,
                                    background: isHierarchy ? "#34d399" : "color-mix(in oklch, var(--muted-foreground) 50%, transparent)",
                                    border: "2px solid var(--card)",
                                    left: -4,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default memo(SheetNode);
