/**
 * Edge builder — convert canvas state ke xyflow Edge[].
 *
 * Layers (render order: auto → manual → column feed):
 *   1. Auto edges  — dari level chain (cyan dashed, FK label)
 *   2. Manual edges — user-drawn (violet solid, custom label)
 *   3. Column feed — legacy V4 compat (cyan thin, kolom → page block)
 */

import { MarkerType, type Edge } from "@xyflow/react";
import { computeAutoEdges } from "./auto-edges";
import { PAGE_BLOCK_ID, sourceNodeId } from "./constants";
import type { Level, ManualEdge, V5Source } from "./types";

export function buildCanvasEdges(
    v5Sources: V5Source[],
    manualEdges: ManualEdge[],
    removedAutoEdges: string[]
): Edge[] {
    const levelNodes = v5Sources.map((s) => ({
        id: sourceNodeId(s.dataset, s.table),
        level: (s.level || "FLAT") as Level,
    }));
    const auto = computeAutoEdges(levelNodes, removedAutoEdges);

    const autoEdges: Edge[] = auto.map((a) => ({
        id: a.id,
        source: a.from,
        target: a.to,
        animated: false,
        label: a.label,
        style: { stroke: "#22d3ee", strokeWidth: 1.5, strokeDasharray: "4 2" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
        labelStyle: { fill: "#67e8f9", fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
    }));

    const manEdges: Edge[] = manualEdges.map((m, idx) => ({
        id: m.id || `m::${m.from}->${m.to}::${idx}`,
        source: m.from,
        target: m.to,
        label: m.label,
        animated: false,
        style: { stroke: "#a78bfa", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#a78bfa" },
        labelStyle: { fill: "#c4b5fd", fontSize: 9, fontWeight: 500 },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
    }));

    // Column feed edges — tiap kolom di v5Sources render edge ke page block
    // buat visualisasi "kolom ini dipakai page".
    const colEdges: Edge[] = [];
    for (const src of v5Sources) {
        const srcId = sourceNodeId(src.dataset, src.table);
        for (const col of src.columns) {
            colEdges.push({
                id: `colfeed::${srcId}::${col.name}`,
                source: srcId,
                target: PAGE_BLOCK_ID,
                sourceHandle: `${srcId}::${col.name}__source`,
                targetHandle: "page-input-left",
                animated: false,
                interactionWidth: 12,
                style: { stroke: "#06b6d4", strokeWidth: 1, strokeOpacity: 0.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#06b6d4" },
            });
        }
    }

    return [...autoEdges, ...manEdges, ...colEdges];
}
