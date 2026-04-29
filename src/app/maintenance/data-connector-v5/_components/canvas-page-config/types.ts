/**
 * Canvas Page Config — shared types.
 *
 * Mirror data shape di Firestore `dashboard_pages_v5/{pageId}`:
 *   - v5Sources[]      — BQ table yang nempel ke page
 *   - nodePositions    — persisted canvas coords (escape: __ → $$ untuk FS field rule)
 *   - manualEdges      — user-drawn relations (override auto-edge)
 *   - removedAutoEdges — opt-out edges dari chain auto (format "fromId->toId")
 */

import type { Level } from "../data-level-config/types";
export type { Level };

export interface V5Column {
    name: string;
    type: string;
}

export interface V5Source {
    dataset: string;
    table: string;
    nodeType: "n_table" | "dim" | "view" | "ext" | "rejected" | "raw";
    /** cached level dari `bq_table_levels` (optional — UI bisa fallback FLAT) */
    level?: Level;
    columns: V5Column[];
}

export interface ManualEdge {
    id?: string;
    from: string;
    to: string;
    label?: string;
}

export interface CanvasPageConfig {
    pagePath: string;
    pageLabel: string;
    v5Sources: V5Source[];
    nodePositions?: Record<string, { x: number; y: number }>;
    manualEdges?: ManualEdge[];
    /** format "fromNode->toNode" (pure node ids, no handle) */
    removedAutoEdges?: string[];
}

export interface BQTableNodeData {
    dataset: string;
    table: string;
    level: Level;
    columns: V5Column[];
    /** callback dari orchestrator → trigger DeleteNodeDialog */
    onDelete?: () => void;
    [key: string]: unknown;
}

export interface PageBlockNodeData {
    pagePath: string;
    pageLabel: string;
    connectedSources: number;
    connectedColumns: number;
    [key: string]: unknown;
}
