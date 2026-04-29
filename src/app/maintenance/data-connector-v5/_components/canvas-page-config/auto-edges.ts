/**
 * Auto-edge computation — pure function (testable tanpa React).
 *
 * Chain level: UPT → ULTG → GI → BAY
 * Untuk tiap node level ≥ ULTG → cari immediate parent level di canvas.
 * Kalau parent ga ada → climb ke grandparent (BAY skip GI → ULTG, dst).
 * FLAT/UPT → ga punya parent (UPT = root, FLAT = standalone).
 *
 * Label FK: "_upt_id" / "_ultg_id" / "_gi_id" sesuai target parent level.
 */

import type { Level } from "./types";

const LEVEL_CHAIN: Array<Exclude<Level, "FLAT">> = ["UPT", "ULTG", "GI", "BAY"];

export function edgeLabel(
    _fromLevel: Level,
    toLevel: Level
): string {
    switch (toLevel) {
        case "UPT":
            return "_upt_id";
        case "ULTG":
            return "_ultg_id";
        case "GI":
            return "_gi_id";
        default:
            return "";
    }
}

export interface AutoEdge {
    id: string;
    from: string;
    to: string;
    label: string;
}

export function computeAutoEdges(
    nodes: Array<{ id: string; level: Level }>,
    removedAutoEdges: string[] = []
): AutoEdge[] {
    const removedSet = new Set(removedAutoEdges);
    const edges: AutoEdge[] = [];

    // Index nodes by level — kalau ada >1 node level sama, pick first (user bisa
    // override via manualEdges kalau mau pilih parent spesifik).
    const byLevel = new Map<Level, Array<{ id: string; level: Level }>>();
    for (const n of nodes) {
        const arr = byLevel.get(n.level) ?? [];
        arr.push(n);
        byLevel.set(n.level, arr);
    }

    for (const node of nodes) {
        // FLAT = standalone, ga ada parent. UPT = root, juga ga ada parent.
        if (node.level === "FLAT" || node.level === "UPT") continue;

        const myIdx = LEVEL_CHAIN.indexOf(node.level as Exclude<Level, "FLAT">);
        if (myIdx <= 0) continue; // safety (ULTG idx=1, cari ≥0 = UPT)

        // Climb up: coba parent level satu tingkat, kalau ga ada → grandparent, dst.
        for (let i = myIdx - 1; i >= 0; i--) {
            const parentLevel = LEVEL_CHAIN[i];
            const parents = byLevel.get(parentLevel);
            if (!parents || parents.length === 0) continue;

            const parent = parents[0];
            const pairKey = `${node.id}->${parent.id}`;
            if (removedSet.has(pairKey)) {
                // User opted out dari edge ini — skip, jangan climb higher.
                break;
            }
            edges.push({
                id: `auto::${node.id}->${parent.id}`,
                from: node.id,
                to: parent.id,
                label: edgeLabel(node.level, parentLevel),
            });
            break; // found nearest parent, stop climbing
        }
    }

    return edges;
}
