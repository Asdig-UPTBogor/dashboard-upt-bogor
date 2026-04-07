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
 *
 * columnColors: peta kolom → warna edge yang terhubung.
 * Jika kolom dipakai oleh sebuah page (connected via edge), warnanya = warna line.
 */

export type SheetNodeData = {
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheetName: string;
    columns: string[];
    hierarchyColumns?: string[];
    /** Kolom → warna edge (hex). Diisi dari edges yang terhubung ke kolom ini. */
    columnColors?: Record<string, string>;
    /** Kolom → posisi (A, B, C...). Diisi dari actual column index. */
    columnPositions?: Record<string, string>;
};

export type SheetNodeType = Node<SheetNodeData, "sheet">;

function SheetNode({ data, id }: NodeProps<SheetNodeType>) {
    const { spreadsheetTitle, sheetName, columns, hierarchyColumns = [], columnColors = {}, columnPositions = {} } = data;
    const hierSet = new Set(hierarchyColumns.map((c) => c.toLowerCase()));

    return (
        <div className="rounded-xl border border-border bg-card shadow-xl shadow-black/10 dark:shadow-black/30 min-w-[220px] max-w-[260px]">
            {/* Header */}
            <div className="relative flex items-center gap-2 rounded-t-xl bg-linear-to-r from-blue-600/20 to-indigo-600/20 px-3 py-2.5 border-b border-border/60">
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

            {/* Columns — each row has BIDIRECTIONAL handles (source+target on BOTH sides) */}
            <div className="py-1">
                {columns.map((col) => {
                    const isHierarchy = hierSet.has(col.toLowerCase());
                    const handleId = `${id}::${col}`;

                    // Warna kolom: dari edge color jika terhubung, else default
                    const connectedColor = columnColors[col];
                    const hasColor = !!connectedColor;

                    const dotColor = hasColor
                        ? connectedColor
                        : isHierarchy
                            ? "#34d399"
                            : "color-mix(in oklch, var(--muted-foreground) 50%, transparent)";

                    // Background tint sesuai warna edge
                    const rowBg = hasColor
                        ? { backgroundColor: `${connectedColor}10` }
                        : {};

                    return (
                        <div
                            key={col}
                            className={`
                                relative flex items-center gap-2 px-3 h-7 text-[11px]
                                transition-colors hover:bg-muted/50
                                ${isHierarchy && !hasColor ? "text-emerald-500 dark:text-emerald-400" : ""}
                                ${!isHierarchy && !hasColor ? "text-muted-foreground" : ""}
                            `}
                            style={{
                                ...rowBg,
                                ...(hasColor ? { color: connectedColor } : {}),
                            }}
                        >
                            <span
                                className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: dotColor }}
                            />
                            {columnPositions[col] && (
                                <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-muted/80 text-muted-foreground/70 font-mono shrink-0 leading-none">
                                    {columnPositions[col]}
                                </span>
                            )}
                            <span className="truncate font-mono flex-1">{col}</span>

                            {/* RIGHT side: source + target */}
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={`${handleId}__source`}
                                style={{ top: "50%", width: 8, height: 8, background: dotColor, border: "2px solid var(--card)", right: -4 }}
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
                                style={{ top: "50%", width: 8, height: 8, background: dotColor, border: "2px solid var(--card)", left: -4 }}
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

export default memo(SheetNode);
