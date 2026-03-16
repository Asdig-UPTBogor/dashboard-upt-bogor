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
    sheetNames?: string[];
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
    sheetNames?: string[];
    issueCount?: number;
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
 * Parse xyflow handle ID: `{nodeId}::{column}__{source|target|source_left|target_right}`
 * nodeId contains `::` so we use lastIndexOf.
 */
export function parseHandleId(handleId: string): { nodeId: string; column: string } | null {
    const suffixMatch = handleId.match(/__(source|target|source_left|target_right)$/);
    if (!suffixMatch) return null;
    const withoutType = handleId.slice(0, -suffixMatch[0].length);
    const lastSep = withoutType.lastIndexOf("::");
    if (lastSep === -1) return null;
    return { nodeId: withoutType.slice(0, lastSep), column: withoutType.slice(lastSep + 2) };
}

/** Determine which page-block handle side is nearest to a sheet position */
export function getNearestPageHandle(
    sheetPos: { x: number; y: number },
    pagePos: { x: number; y: number },
    pageWidth = 240,
    pageHeight = 180,
): string {
    // Center of page block
    const cx = pagePos.x + pageWidth / 2;
    const cy = pagePos.y + pageHeight / 2;
    // Center of sheet (approx)
    const sx = sheetPos.x + 150;
    const sy = sheetPos.y + 100;

    const dx = sx - cx;
    const dy = sy - cy;

    // Pick the side based on which axis has more distance
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx < 0 ? "page-input-left" : "page-input-right";
    }
    return dy < 0 ? "page-input-top" : "page-input-bottom";
}

/** Create a sheet → page-block feed edge */
export function makePageFeedEdge(
    sheetId: string,
    sheetName: string,
    sheetPos?: { x: number; y: number },
    pagePos?: { x: number; y: number },
): Edge {
    const handle = sheetPos && pagePos
        ? getNearestPageHandle(sheetPos, pagePos)
        : "page-input-left";
    return {
        id: `feed_${sheetId}`,
        source: sheetId,
        target: PAGE_BLOCK_ID,
        sourceHandle: `${sheetId}::__feed__source`,
        targetHandle: handle,
        animated: false,
        style: { stroke: "#6366f1", strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
        label: sheetName,
        labelStyle: { fill: "#818cf8", fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
    };
}

/** Column-to-page edge — solid cyan line showing a column is used by this page */
export function makeColumnFeedEdge(
    sheetId: string,
    colName: string,
    sheetPos?: { x: number; y: number },
    pagePos?: { x: number; y: number },
): Edge {
    const pageHandle = sheetPos && pagePos
        ? getNearestPageHandle(sheetPos, pagePos)
        : "page-input-left";

    // Pilih sisi sheet yang paling dekat ke Page Block
    // Jika Page Block di kiri sheet → keluar dari dot kiri, dan sebaliknya
    let sourceHandle = `${sheetId}::${colName}__source`; // default: kanan
    if (sheetPos && pagePos) {
        const sheetCenterX = sheetPos.x + 150;
        const pageCenterX = pagePos.x + 120;
        if (pageCenterX < sheetCenterX) {
            // Page Block ada di KIRI sheet → pakai dot kiri
            sourceHandle = `${sheetId}::${colName}__source_left`;
        }
    }

    return {
        id: `colfeed_${sheetId}::${colName}`,
        source: sheetId,
        target: PAGE_BLOCK_ID,
        sourceHandle,
        targetHandle: pageHandle,
        animated: false,
        interactionWidth: 20,
        style: { stroke: "#06b6d4", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#06b6d4" },
        label: colName,
        labelStyle: { fill: "#22d3ee", fontSize: 9, fontWeight: 500 },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
    };
}

/** Convert 0-based column index to letter (0=A, 25=Z, 26=AA) */
export function indexToColLetter(index: number): string {
    let letter = "";
    let i = index;
    while (true) {
        letter = String.fromCharCode(65 + (i % 26)) + letter;
        i = Math.floor(i / 26) - 1;
        if (i < 0) break;
    }
    return letter;
}
