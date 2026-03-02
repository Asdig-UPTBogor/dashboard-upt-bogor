/**
 * Shared types and helpers for Data Connector wizard
 */

import { type Edge, MarkerType } from "@xyflow/react";

/* ── Types ── */
export type WizardStep = "page-select" | "sheet-pick" | "canvas";

export interface PageSummary {
    page: string;
    label: string;
    dataSourceCount: number;
    relationCount: number;
    updatedAt?: string;
}

export interface SidebarPage {
    path: string;
    label: string;
    section: string;
    iconName: string;
    hasConfig: boolean;
    dataSourceCount: number;
    relationCount: number;
}

export interface CanvasSheet {
    id: string;
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheetName: string;
    columns: string[];
    hierarchyColumns: string[];
    hierarchyMap: Record<string, string>;
}

/**
 * Hierarchy levels — 2-level priority per level.
 * Priority 1 ("Master ULTG") is tried first, then priority 2 ("ULTG").
 */
export const HIERARCHY_LEVELS = [
    { key: "ultg", columnNames: ["Master ULTG", "ULTG"] },
    { key: "gi", columnNames: ["Master Gardu Induk", "Gardu Induk"] },
    { key: "bay", columnNames: ["Master Bay", "Bay"] },
];

export function detectHierarchyInHeaders(headers: string[]): {
    hierarchyColumns: string[];
    hierarchyMap: Record<string, string>;
} {
    const trimmed = headers.map((h) => h.trim());
    const hierarchyColumns: string[] = [];
    const hierarchyMap: Record<string, string> = {};
    for (const level of HIERARCHY_LEVELS) {
        for (const candidate of level.columnNames) {
            const found = trimmed.find((h) => h.toLowerCase() === candidate.toLowerCase());
            if (found) {
                hierarchyColumns.push(found);
                hierarchyMap[level.key] = found;
                break;
            }
        }
    }
    return { hierarchyColumns, hierarchyMap };
}

/* ── XYFlow constants ── */
export const PAGE_BLOCK_ID = "__page_block__";
export const PAGE_BLOCK_X = 700;
export const PAGE_BLOCK_Y = 200;

export function makeRelationId(): string {
    return `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Parse xyflow handle ID: `{nodeId}::{column}__{source|target}`
 * nodeId contains `::` so we use lastIndexOf.
 */
export function parseHandleId(handleId: string): { nodeId: string; column: string } | null {
    const suffixMatch = handleId.match(/__(source|target)$/);
    if (!suffixMatch) return null;
    const withoutType = handleId.slice(0, -suffixMatch[0].length);
    const lastSep = withoutType.lastIndexOf("::");
    if (lastSep === -1) return null;
    return { nodeId: withoutType.slice(0, lastSep), column: withoutType.slice(lastSep + 2) };
}

/** Create a sheet → page-block feed edge */
export function makePageFeedEdge(sheetId: string, sheetName: string): Edge {
    return {
        id: `feed_${sheetId}`,
        source: sheetId,
        target: PAGE_BLOCK_ID,
        sourceHandle: `${sheetId}::__feed__source`,
        targetHandle: "page-input",
        animated: false,
        style: { stroke: "#6366f1", strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
        label: sheetName,
        labelStyle: { fill: "#818cf8", fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
    };
}

/** Column-to-page edge — solid cyan line showing a column is used by this page */
export function makeColumnFeedEdge(sheetId: string, colName: string): Edge {
    return {
        id: `colfeed_${sheetId}::${colName}`,
        source: sheetId,
        target: PAGE_BLOCK_ID,
        sourceHandle: `${sheetId}::${colName}__source`,
        targetHandle: "page-input",
        animated: false,
        interactionWidth: 20,
        style: { stroke: "#06b6d4", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#06b6d4" },
        label: colName,
        labelStyle: { fill: "#22d3ee", fontSize: 9, fontWeight: 500 },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
    };
}
