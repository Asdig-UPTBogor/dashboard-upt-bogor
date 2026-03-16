"use client";

/**
 * Data Connector V4 — 3-Step Wizard (Orchestrator)
 *
 * Flow:
 *   Step 1: PAGE SELECT   — pick dashboard page       → _components/step-page-select.tsx
 *   Step 2: SHEET PICK    — pick spreadsheets & sheets → _components/step-sheet-pick.tsx
 *   Step 3: CANVAS CONFIG — column mapping, hierarchy  → _components/step-canvas.tsx
 *
 * Shared types & helpers are in _lib/types.ts
 *
 * This file contains only state management and data fetching logic.
 * All UI rendering is delegated to step components.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    type Node,
    MarkerType,
} from "@xyflow/react";

import type { SheetNodeData } from "../data-source/_components/xyflow/sheet-node";

import type { PageBlockData } from "../data-source/_components/xyflow/page-block-node";
import type { RegistryEntry, ExploreSheet } from "../data-source/_types";

/* ── Extracted modules ── */
import {
    type WizardStep, type PageSummary, type SidebarPage, type CanvasSheet,
    HIERARCHY_LEVELS, detectHierarchyInHeaders, parseHandleId, indexToColLetter, getNearestPageHandle,
    PAGE_BLOCK_ID, PAGE_BLOCK_X, PAGE_BLOCK_Y,
    makeRelationId, makeColumnFeedEdge,
} from "./_lib/types";
import { StepPageSelect } from "./_components/step-page-select";
import { StepSheetPick } from "./_components/step-sheet-pick";
import { StepCanvas } from "./_components/step-canvas";

/* ═══════════════════════════════════════════════════
   Main Component — State & Logic Only
   ═══════════════════════════════════════════════════ */
export default function DataConnectorPage() {
    /* ── State: Wizard ── */
    const [step, setStep] = useState<WizardStep>("page-select");

    const [selectedPage, setSelectedPage] = useState<string | null>(null);
    const [pageLabel, setPageLabel] = useState("");
    const [sidebarPages, setSidebarPages] = useState<SidebarPage[]>([]);

    /* ── State: Data ── */
    const [registry, setRegistry] = useState<RegistryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    /* ── State: Step 2 — Sheet Picker ── */
    const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set());
    const [pickerSheets, setPickerSheets] = useState<CanvasSheet[]>([]);
    const [savedConfig, setSavedConfig] = useState<any>(null);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [pickerSearch, setPickerSearch] = useState("");
    const [expandedSpreadsheets, setExpandedSpreadsheets] = useState<Set<string>>(new Set());

    /* ── State: Step 3 — Canvas ── */
    const [onCanvasIds, setOnCanvasIds] = useState<Set<string>>(new Set());
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const autoEdgeCountRef = useRef(0);
    const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
    const [configMismatches, setConfigMismatches] = useState<{ sheetName: string; missing: string[] }[]>([]);

    /* ══════════════════════════════════════════════
       Data Fetching
       ══════════════════════════════════════════════ */

    const fetchPages = useCallback(async () => {
        setLoading(true);
        try {
            const [pagesRes, configsRes, registryRes] = await Promise.all([
                fetch("/api/data-sources?pages=1"),
                fetch("/api/page-configs"),
                fetch("/api/data-sources?raw=1"),
            ]);
            const [pagesJson, configsJson, registryJson] = await Promise.all([
                pagesRes.json(), configsRes.json(), registryRes.json(),
            ]);

            const configMap = new Map<string, PageSummary>();
            if (configsJson.success) {
                for (const c of configsJson.pages as PageSummary[]) configMap.set(c.page, c);
            }

            const pages: SidebarPage[] = [];
            if (pagesJson.success) {
                for (const p of pagesJson.pages) {
                    const cfg = configMap.get(p.path);
                    pages.push({
                        path: p.path, label: p.label, section: p.section || "",
                        iconName: p.iconName || "FileText",
                        hasConfig: !!cfg,
                        dataSourceCount: cfg?.dataSourceCount || 0,
                        relationCount: cfg?.relationCount || 0,
                        sheetNames: cfg?.sheetNames || [],
                    });
                }
                for (const [, c] of configMap) {
                    if (!pages.find((p) => p.path === c.page)) {
                        pages.push({
                            path: c.page, label: c.label, section: "",
                            iconName: "FileText", hasConfig: true,
                            dataSourceCount: c.dataSourceCount, relationCount: c.relationCount,
                            sheetNames: c.sheetNames || [],
                        });
                    }
                }
            }

            setSidebarPages(pages);
            if (registryJson.success) setRegistry(registryJson.data || []);
        } catch (err) {
            console.error("[DataConnector] Failed to fetch pages:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAllSheetHeaders = useCallback(async (entries: RegistryEntry[]) => {
        if (entries.length === 0) return;
        setPickerLoading(true);

        const results = await Promise.all(
            entries.map(async (entry) => {
                try {
                    const res = await fetch(`/api/data-sources?explore=${encodeURIComponent(entry.spreadsheetId)}&refresh=1`);
                    const json = await res.json();
                    if (json.success && json.sheets) {
                        return (json.sheets as ExploreSheet[]).map((s) => ({
                            id: `${entry.spreadsheetId}::${s.name}`,
                            spreadsheetId: entry.spreadsheetId,
                            spreadsheetTitle: entry.title,
                            sheetName: s.name,
                            columns: s.headers || [],
                            ...detectHierarchyInHeaders(s.headers || []),
                        }));
                    }
                } catch (err) {
                    console.error(`[DataConnector] Failed to explore ${entry.title}:`, err);
                }
                return [];
            })
        );

        setPickerSheets(results.flat());
        setPickerLoading(false);
    }, []);

    useEffect(() => { fetchPages(); }, [fetchPages]);

    useEffect(() => {
        if (registry.length > 0 && pickerSheets.length === 0) {
            fetchAllSheetHeaders(registry);
        }
    }, [registry, pickerSheets.length, fetchAllSheetHeaders]);

    /* ══════════════════════════════════════════════
       Step 1 → Step 2 transition
       ══════════════════════════════════════════════ */

    const handleSelectPage = useCallback(async (pagePath: string) => {
        setSelectedPage(pagePath);
        const page = sidebarPages.find((p) => p.path === pagePath);
        setPageLabel(page?.label || pagePath);

        try {
            const res = await fetch(`/api/page-configs?page=${encodeURIComponent(pagePath)}`);
            const json = await res.json();
            if (json.success && json.config) {
                const config = json.config;
                setPageLabel(config.label || page?.label || pagePath);
                setSavedConfig(config);

                const preSelected = new Set<string>();
                for (const ds of config.dataSources) {
                    preSelected.add(`${ds.spreadsheetId}::${ds.sheetName}`);
                }
                setSelectedSheetIds(preSelected);

                const expandIds = new Set<string>();
                for (const ds of config.dataSources) expandIds.add(ds.spreadsheetId);
                setExpandedSpreadsheets(expandIds);
            } else {
                setSelectedSheetIds(new Set());
                setSavedConfig(null);
            }
        } catch {
            setSelectedSheetIds(new Set());
            setSavedConfig(null);
        }

        setStep("sheet-pick");
    }, [sidebarPages]);

    /* ══════════════════════════════════════════════
       Step 2 → Step 3 transition
       ══════════════════════════════════════════════ */

    const findAutoConnections = useCallback((
        newSheet: CanvasSheet,
        existingSheets: CanvasSheet[],
        positions?: Record<string, { x: number; y: number }>,
    ): Edge[] => {
        const autoEdges: Edge[] = [];
        const newHierMap = newSheet.hierarchyMap;

        // REQUIRED: both ultg AND gi must exist in this sheet
        if (!newHierMap["ultg"] || !newHierMap["gi"]) return autoEdges;

        // Find candidates: other sheets that ALSO have both ultg AND gi
        const candidates = existingSheets.filter((existing) =>
            existing.hierarchyMap["ultg"] && existing.hierarchyMap["gi"]
        );
        if (candidates.length === 0) return autoEdges;

        // Pick nearest candidate by position
        let nearest = candidates[candidates.length - 1]; // fallback: last
        if (positions) {
            const newPos = positions[newSheet.id];
            if (newPos) {
                let minDist = Infinity;
                for (const c of candidates) {
                    const cPos = positions[c.id];
                    if (!cPos) continue;
                    const dist = Math.sqrt((newPos.x - cPos.x) ** 2 + (newPos.y - cPos.y) ** 2);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = c;
                    }
                }
            }
        }

        // Create edges for matched hierarchy levels (ultg, gi = required; bay = optional)
        for (const levelKey of Object.keys(newHierMap)) {
            const existingCol = nearest.hierarchyMap[levelKey];
            if (!existingCol) continue; // bay may not exist in nearest — skip, that's OK
            const newCol = newHierMap[levelKey];
            autoEdges.push({
                id: `auto_${nearest.id}_${existingCol}_${newSheet.id}_${newCol}`,
                source: nearest.id,
                target: newSheet.id,
                sourceHandle: `${nearest.id}::${existingCol}__source`,
                targetHandle: `${newSheet.id}::${newCol}__target`,
                animated: true,
                style: { stroke: "#10b981", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
                label: "AUTO",
                labelStyle: { fill: "#34d399", fontSize: 10, fontWeight: 700 },
                labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
            });
        }
        return autoEdges;
    }, []);

    const handleProceedToCanvas = useCallback(async () => {
        if (!selectedPage || selectedSheetIds.size === 0) return;

        // 1. Convert selected picker sheets into CanvasSheets as our base
        let selectedSheets = pickerSheets.filter((s) => selectedSheetIds.has(s.id));

        // 2. If NO sheets are selected from the picker (which shouldn't happen normally, 
        // but just in case), try falling back to the saved config.
        if (selectedSheets.length === 0 && savedConfig?.dataSources) {
            selectedSheets = savedConfig.dataSources.map((ds: any) => {
                const sheetId = `${ds.spreadsheetId}::${ds.sheetName}`;
                const columns = (ds.columnsUsed || []).map((c: any) => c.name);
                // Include hierarchy column names for auto-relationship detection
                const hierCols = Object.values(ds.hierarchyMapping || {}).filter(Boolean) as string[];
                for (const hc of hierCols) {
                    if (!columns.some((c: string) => c.toLowerCase() === hc.toLowerCase())) {
                        columns.push(hc);
                    }
                }
                return {
                    id: sheetId,
                    spreadsheetId: ds.spreadsheetId,
                    spreadsheetTitle: ds.label || ds.sheetName,
                    sheetName: ds.sheetName,
                    columns,
                    ...detectHierarchyInHeaders(columns),
                };
            });
        }

        let initialColCount = 0;
        if (savedConfig?.dataSources) {
            for (const ds of savedConfig.dataSources) {
                initialColCount += (ds.columnsUsed || []).length;
            }
        }

        const savedPageBlockPos = savedConfig?.nodePositions?.[PAGE_BLOCK_ID];
        const pageBlockNode: Node<PageBlockData> = {
            id: PAGE_BLOCK_ID,
            type: "page-block",
            position: { x: savedPageBlockPos?.x ?? PAGE_BLOCK_X, y: savedPageBlockPos?.y ?? PAGE_BLOCK_Y },
            draggable: true,
            data: { pagePath: selectedPage, pageLabel, connectedSheets: selectedSheets.length, connectedColumns: initialColCount },
        };

        const sheetNodes: Node<SheetNodeData>[] = [];
        const allEdges: Edge[] = [];
        const ids = new Set<string>();
        const COLS = 2;
        const X_GAP = 350;
        const Y_GAP = 350;

        // Restore saved positions if available
        const savedPositions: Record<string, { x: number; y: number }> = savedConfig?.nodePositions || {};

        for (let i = 0; i < selectedSheets.length; i++) {
            const s = selectedSheets[i];
            ids.add(s.id);
            // Use saved position if available, otherwise default grid
            const savedPos = savedPositions[s.id];
            const x = savedPos?.x ?? ((i % COLS) * X_GAP + 40);
            const y = savedPos?.y ?? (Math.floor(i / COLS) * Y_GAP + 40);

            // Cek apakah sheet ini punya config lama di savedConfig
            const savedDs = savedConfig?.dataSources?.find((ds: any) =>
                `${ds.spreadsheetId}::${ds.sheetName}` === s.id
            );

            // Kalau ada config lama, utamakan subset columnsUsed.
            // Tapi untuk GUI Canvas (handles rendering), Node BUTUH SEMUA columns
            // yang ada di spreadsheet nyata, karena Canvas adalah tempat untuk merakit relasi/centang field.
            // Karena itu, "columns" di sini WAJIB dari pickerSheets (s.columns) yang berisi daftar FULL headers.
            sheetNodes.push({
                id: s.id,
                type: "sheet",
                position: { x, y },
                data: {
                    spreadsheetId: s.spreadsheetId,
                    spreadsheetTitle: s.spreadsheetTitle,
                    sheetName: s.sheetName,
                    // Selalu persembahkan kolom yang utuh dari s.columns
                    columns: s.columns || [],
                    hierarchyColumns: s.hierarchyColumns || [],
                    // POS: A, B, C... berdasarkan index kolom di sheet
                    columnPositions: Object.fromEntries(
                        (s.columns || []).map((col, idx) => [col, indexToColLetter(idx)])
                    ),
                },
            });
        }

        if (savedConfig?.dataSources) {
            // Collect all hierarchy column names to skip them as visual edges
            const hierarchyColSet = new Set<string>();
            for (const ds of savedConfig.dataSources) {
                for (const hCol of Object.values(ds.hierarchyMapping || {})) {
                    if (hCol) hierarchyColSet.add((hCol as string).toLowerCase());
                }
            }

            for (const ds of savedConfig.dataSources) {
                const sheetId = `${ds.spreadsheetId}::${ds.sheetName}`;
                if (!ids.has(sheetId)) continue;
                const sheetNode = sheetNodes.find((n) => n.id === sheetId);
                // Ambil kolom aktual dari sheet node (dari Google Sheets headers)
                const actualCols = (sheetNode?.data as SheetNodeData)?.columns || [];
                for (const col of (ds.columnsUsed || [])) {
                    // Skip hierarchy columns — they're already shown as green AUTO edges
                    if (hierarchyColSet.has(col.name.toLowerCase())) continue;
                    // Skip ghost columns — kolom config lama yang sudah tidak ada di sheet aktual
                    if (!actualCols.some(h => h.toLowerCase() === col.name.toLowerCase())) continue;
                    allEdges.push(makeColumnFeedEdge(sheetId, col.name, sheetNode?.position, pageBlockNode.position));
                }
            }
        }

        let savedRelations: any[] = [];
        try {
            const res = await fetch(`/api/page-configs?page=${encodeURIComponent(selectedPage)}`);
            const json = await res.json();
            if (json.success && json.config) {
                savedRelations = json.config.relations || [];
            }
        } catch { /* ignore */ }

        // Restore only MANUAL relations from config (auto will be regenerated fresh)
        for (const rel of savedRelations.filter((r: any) => !r.auto)) {
            const sourceNode = sheetNodes.find((n) =>
                n.data.sheetName.toUpperCase() === rel.fromSheet.toUpperCase()
            );
            const targetNode = sheetNodes.find((n) =>
                n.data.sheetName.toUpperCase() === rel.toSheet.toUpperCase()
            );
            if (!sourceNode || !targetNode) continue;
            const isAuto = rel.auto;
            const color = isAuto ? "#10b981" : "#6366f1";
            allEdges.push({
                id: rel.id,
                source: sourceNode.id,
                target: targetNode.id,
                sourceHandle: `${sourceNode.id}::${rel.fromColumn}__source`,
                targetHandle: `${targetNode.id}::${rel.toColumn}__target`,
                animated: true,
                style: { stroke: color, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color },
                label: isAuto ? "AUTO" : rel.joinType.toUpperCase(),
                labelStyle: { fill: isAuto ? "#34d399" : "#94a3b8", fontSize: 10, fontWeight: 700 },
                labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
            });
        }

        // Always regenerate auto-relations from current positions
        // Only preserve manual (non-auto) relations from config
        if (selectedSheets.length > 1) {
            // Only sheets with BOTH ultg AND gi qualify
            const qualified = selectedSheets.filter(
                (s) => s.hierarchyMap["ultg"] && s.hierarchyMap["gi"]
            );

            // Build position map for sorting by nearest
            const posMap: Record<string, { x: number; y: number }> = {};
            for (const sn of sheetNodes) posMap[sn.id] = sn.position;

            // Per-level chain: nearest-neighbor (Euclidean distance)
            for (const level of HIERARCHY_LEVELS) {
                const pool = qualified.filter((s) => s.hierarchyMap[level.key]);
                if (pool.length < 2) continue;

                // Greedy nearest-neighbor chain
                const used = new Set<string>();
                // Start from leftmost sheet
                let current = pool.reduce((a, b) =>
                    (posMap[a.id]?.x ?? 0) <= (posMap[b.id]?.x ?? 0) ? a : b
                );
                used.add(current.id);

                while (used.size < pool.length) {
                    const cp = posMap[current.id] || { x: 0, y: 0 };
                    let nearest: typeof current | null = null;
                    let minDist = Infinity;
                    for (const candidate of pool) {
                        if (used.has(candidate.id)) continue;
                        const pp = posMap[candidate.id] || { x: 0, y: 0 };
                        const dist = Math.sqrt((cp.x - pp.x) ** 2 + (cp.y - pp.y) ** 2);
                        if (dist < minDist) { minDist = dist; nearest = candidate; }
                    }
                    if (!nearest) break;

                    const leftCol = current.hierarchyMap[level.key];
                    const rightCol = nearest.hierarchyMap[level.key];
                    if (leftCol && rightCol) {
                        // Smart handle: pick side based on relative position
                        const srcPos = posMap[current.id] || { x: 0, y: 0 };
                        const tgtPos = posMap[nearest.id] || { x: 0, y: 0 };
                        const srcIsLeft = srcPos.x <= tgtPos.x;
                        const srcHandle = srcIsLeft
                            ? `${current.id}::${leftCol}__source`       // right side
                            : `${current.id}::${leftCol}__source_left`; // left side
                        const tgtHandle = srcIsLeft
                            ? `${nearest.id}::${rightCol}__target`        // left side
                            : `${nearest.id}::${rightCol}__target_right`; // right side
                        allEdges.push({
                            id: `auto_${current.id}_${leftCol}_${nearest.id}_${rightCol}`,
                            source: current.id,
                            target: nearest.id,
                            sourceHandle: srcHandle,
                            targetHandle: tgtHandle,
                            animated: true,
                            style: { stroke: "#10b981", strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
                            label: "AUTO",
                            labelStyle: { fill: "#34d399", fontSize: 10, fontWeight: 700 },
                            labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
                        });
                    }

                    used.add(nearest.id);
                    current = nearest;
                }
            }
        }

        autoEdgeCountRef.current = allEdges.filter((e) => e.id.startsWith("auto_")).length;
        setOnCanvasIds(ids);
        setNodes([pageBlockNode as any, ...sheetNodes]);
        setEdges(allEdges);
        setHasUnsavedChanges(false);

        // Deteksi kolom mismatch: config lama vs sheet aktual
        // HANYA warning untuk kolom HILANG (ada di config tapi tidak di sheet)
        // Kolom yg ada di sheet tapi belum di-connect = normal (user pilih sendiri)
        const mismatches: { sheetName: string; missing: string[] }[] = [];
        if (savedConfig?.dataSources) {
            for (const ds of savedConfig.dataSources) {
                const sheetId = `${ds.spreadsheetId}::${ds.sheetName}`;
                const node = sheetNodes.find((n) => n.id === sheetId);
                if (!node) continue;
                const actualCols = ((node.data as SheetNodeData)?.columns || []).map((c: string) => c.toLowerCase());
                const configCols = (ds.columnsUsed || []).map((c: any) => c.name as string);
                const missing = configCols.filter((c: string) => !actualCols.includes(c.toLowerCase()));
                if (missing.length > 0) {
                    mismatches.push({ sheetName: ds.sheetName, missing });
                }
            }
        }
        setConfigMismatches(mismatches);

        setStep("canvas");
    }, [selectedPage, selectedSheetIds, pickerSheets, savedConfig, pageLabel, findAutoConnections, setNodes, setEdges]);

    useEffect(() => {
        const colCount = edges.filter((e) => e.id.startsWith("colfeed_")).length;
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id !== PAGE_BLOCK_ID) return n;
                const d = n.data as PageBlockData;
                if (d.connectedColumns === colCount) return n;
                return { ...n, data: { ...d, connectedColumns: colCount } };
            })
        );
    }, [edges, setNodes]);

    // Compute column colors from edge connections
    // Edge handle format: "nodeId::columnName__source" or "nodeId::columnName__target"
    useEffect(() => {
        const colorMap = new Map<string, Record<string, string>>(); // nodeId → { col → color }

        for (const edge of edges) {
            if (edge.id.startsWith("feed_")) continue; // skip sheet-to-page header edges, NOT colfeed_
            const color = (edge.style as { stroke?: string })?.stroke;
            if (!color) continue;

            // Extract column names from handles
            // Handle format: "{spreadsheetId}::{sheetName}::{colName}__source"
            // nodeId = "{spreadsheetId}::{sheetName}" — contains :: so use lastIndexOf
            const parseHandle = (handle: string | null | undefined) => {
                if (!handle) return null;
                // Strip suffix (__source, __target, etc)
                const stripped = handle.replace(/__(?:source|target|source_left|target_right)$/, "");
                if (stripped.includes("__feed_")) return null;
                // Split at LAST :: to get nodeId::colName
                const lastSep = stripped.lastIndexOf("::");
                if (lastSep === -1) return null;
                const nodeId = stripped.slice(0, lastSep);
                const colName = stripped.slice(lastSep + 2);
                if (!colName) return null;
                return { nodeId, colName };
            };

            const src = parseHandle(edge.sourceHandle);
            const tgt = parseHandle(edge.targetHandle);

            if (src) {
                if (!colorMap.has(src.nodeId)) colorMap.set(src.nodeId, {});
                colorMap.get(src.nodeId)![src.colName] = color;
            }
            if (tgt) {
                if (!colorMap.has(tgt.nodeId)) colorMap.set(tgt.nodeId, {});
                colorMap.get(tgt.nodeId)![tgt.colName] = color;
            }
        }

        // Only update nodes that need color changes
        setNodes((nds) =>
            nds.map((n) => {
                if (n.type !== "sheet") return n;
                const newColors = colorMap.get(n.id) || {};
                const d = n.data as SheetNodeData;
                const oldColors = d.columnColors || {};
                // Shallow equality check
                if (JSON.stringify(oldColors) === JSON.stringify(newColors)) return n;
                return { ...n, data: { ...d, columnColors: newColors } };
            })
        );
    }, [edges, setNodes]);

    /* ══════════════════════════════════════════════
       Canvas Actions (Step 3)
       ══════════════════════════════════════════════ */

    // Update feed edge routing on drag (no auto-relation regeneration)
    const onNodeDragStop = useCallback((_event: any, _draggedNode: Node) => {
        const currentSheetNodes = nodes.filter((n) => n.type === "sheet");
        const pageBlock = nodes.find((n) => n.id === PAGE_BLOCK_ID);
        if (!pageBlock) return;

        // Build fresh position map from current node positions
        const posMap: Record<string, { x: number; y: number }> = {};
        for (const sn of currentSheetNodes) posMap[sn.id] = sn.position;
        const pagePos = pageBlock.position;

        // Rebuild selectedSheets with hierarchy info for auto-relation generation
        const qualified: CanvasSheet[] = [];
        for (const sn of currentSheetNodes) {
            const cols = (sn.data as any).columns as string[] || [];
            const hier = detectHierarchyInHeaders(cols);
            if (hier.hierarchyMap["ultg"] && hier.hierarchyMap["gi"]) {
                qualified.push({
                    id: sn.id,
                    spreadsheetId: (sn.data as any).spreadsheetId as string,
                    spreadsheetTitle: (sn.data as any).spreadsheetTitle as string,
                    sheetName: (sn.data as any).sheetName as string,
                    columns: cols,
                    ...hier,
                });
            }
        }

        setEdges((eds) => {
            // Keep non-auto edges, re-route colfeed to nearest page handle
            const kept = eds
                .filter((e) => !e.id.startsWith("auto_"))
                .map((e) => {
                    if (e.target !== PAGE_BLOCK_ID || !e.id.startsWith("colfeed_")) return e;
                    const sheetNode = currentSheetNodes.find((n) => n.id === e.source);
                    if (!sheetNode) return e;
                    const newHandle = getNearestPageHandle(sheetNode.position, pagePos);
                    if (e.targetHandle === newHandle) return e;
                    return { ...e, targetHandle: newHandle };
                });

            // Regenerate auto edges with nearest-neighbor chain
            const autoEdges: Edge[] = [];
            for (const level of HIERARCHY_LEVELS) {
                const pool = qualified.filter((s) => s.hierarchyMap[level.key]);
                if (pool.length < 2) continue;

                const used = new Set<string>();
                let current = pool.reduce((a, b) =>
                    (posMap[a.id]?.x ?? 0) <= (posMap[b.id]?.x ?? 0) ? a : b
                );
                used.add(current.id);

                while (used.size < pool.length) {
                    const cp = posMap[current.id] || { x: 0, y: 0 };
                    let nearest: typeof current | null = null;
                    let minDist = Infinity;
                    for (const candidate of pool) {
                        if (used.has(candidate.id)) continue;
                        const pp = posMap[candidate.id] || { x: 0, y: 0 };
                        const dist = Math.sqrt((cp.x - pp.x) ** 2 + (cp.y - pp.y) ** 2);
                        if (dist < minDist) { minDist = dist; nearest = candidate; }
                    }
                    if (!nearest) break;

                    const leftCol = current.hierarchyMap[level.key];
                    const rightCol = nearest.hierarchyMap[level.key];
                    if (leftCol && rightCol) {
                        // Smart handle: pick side based on relative position
                        const srcPos = posMap[current.id] || { x: 0, y: 0 };
                        const tgtPos = posMap[nearest.id] || { x: 0, y: 0 };
                        const srcIsLeft = srcPos.x <= tgtPos.x;
                        const srcHandle = srcIsLeft
                            ? `${current.id}::${leftCol}__source`       // right side
                            : `${current.id}::${leftCol}__source_left`; // left side
                        const tgtHandle = srcIsLeft
                            ? `${nearest.id}::${rightCol}__target`        // left side
                            : `${nearest.id}::${rightCol}__target_right`; // right side
                        autoEdges.push({
                            id: `auto_${current.id}_${leftCol}_${nearest.id}_${rightCol}`,
                            source: current.id,
                            target: nearest.id,
                            sourceHandle: srcHandle,
                            targetHandle: tgtHandle,
                            animated: true,
                            style: { stroke: "#10b981", strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
                            label: "AUTO",
                            labelStyle: { fill: "#34d399", fontSize: 10, fontWeight: 700 },
                            labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
                        });
                    }

                    used.add(nearest.id);
                    current = nearest;
                }
            }

            return [...kept, ...autoEdges];
        });

        setHasUnsavedChanges(true);
    }, [nodes, setEdges]);

    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            const hasColumnEdge = deletedEdges.some((e) => e.id.startsWith("colfeed_"));
            if (hasColumnEdge) setHasUnsavedChanges(true);
        }, []);

    const onSelectionChange = useCallback(
        ({ edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
            setSelectedEdgeIds(new Set(selEdges.map((e) => e.id)));
        }, []);

    const onEdgeClick = useCallback(
        (_event: React.MouseEvent, edge: Edge) => {
            setSelectedEdgeIds(new Set([edge.id]));
        }, []);

    const onPaneClick = useCallback(() => {
        setSelectedEdgeIds(new Set());
    }, []);

    const handleDeleteSelectedEdges = useCallback(() => {
        if (selectedEdgeIds.size === 0) return;
        setEdges((eds) => eds.filter((e) => !selectedEdgeIds.has(e.id)));
        setSelectedEdgeIds(new Set());
        setHasUnsavedChanges(true);
    }, [selectedEdgeIds, setEdges]);

    const onConnect = useCallback(
        (connection: Connection) => {
            if (!connection.sourceHandle || !connection.targetHandle) return;
            if (connection.source === connection.target) return;

            // Normalize bidirectional: detect if either end is PAGE_BLOCK_ID
            let sheetNodeId = connection.source!;
            let sheetHandle = connection.sourceHandle;
            let isPageTarget = connection.target === PAGE_BLOCK_ID;
            let isPageSource = connection.source === PAGE_BLOCK_ID;

            // If user dragged FROM Page Block TO a sheet column, reverse it
            if (isPageSource && !isPageTarget) {
                sheetNodeId = connection.target!;
                sheetHandle = connection.targetHandle;
                isPageTarget = true;
            }

            if (isPageTarget) {
                const handleInfo = parseHandleId(sheetHandle);
                if (!handleInfo || handleInfo.column === "__feed") return;

                const dupId = `colfeed_${sheetNodeId}::${handleInfo.column}`;
                setEdges((eds) => {
                    if (eds.some((e) => e.id === dupId)) return eds;
                    return addEdge(makeColumnFeedEdge(sheetNodeId, handleInfo.column), eds);
                });
                setHasUnsavedChanges(true);
                return;
            }

            // Hierarchy / manual relation (normalize handle IDs to standard format)
            const normalizeHandle = (h: string) => {
                return h.replace(/__source_left$/, "__source").replace(/__target_right$/, "__target");
            };

            const newEdge: Edge = {
                id: makeRelationId(),
                source: connection.source!,
                target: connection.target!,
                sourceHandle: normalizeHandle(connection.sourceHandle),
                targetHandle: normalizeHandle(connection.targetHandle),
                animated: true,
                style: { stroke: "#6366f1", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
                label: "LEFT",
                labelStyle: { fill: "#94a3b8", fontSize: 10, fontWeight: 600 },
                labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
            };
            setEdges((eds) => addEdge(newEdge, eds));
            setHasUnsavedChanges(true);
        }, [setEdges]);

    const handleSave = async () => {
        if (!selectedPage) return;
        setSaving(true);
        try {
            const sheetNodes = nodes.filter((n) => n.type === "sheet");

            const columnEdges = edges.filter((e) =>
                e.id.startsWith("colfeed_") && e.target === PAGE_BLOCK_ID
            );

            const dataSources = sheetNodes.map((n) => {
                const d = n.data as SheetNodeData;
                const sheet = pickerSheets.find((s) => s.id === n.id);
                const allColumns = sheet?.columns || d.columns || [];

                const connectedCols = columnEdges
                    .filter((e) => e.source === n.id)
                    .map((e) => {
                        const info = parseHandleId(e.sourceHandle || "");
                        return info?.column || "";
                    })
                    .filter(Boolean)
                    // PENTING: buang ghost columns — hanya simpan kolom yang ada di sheet aktual
                    .filter((colName) => allColumns.some(
                        (h) => h.toLowerCase() === colName.toLowerCase()
                    ));

                const columnsUsed = connectedCols.map((colName) => {
                    const idx = allColumns.indexOf(colName);
                    return {
                        name: colName,
                        pos: idx >= 0 ? indexToColLetter(idx) : "?",
                    };
                });

                // Auto-include hierarchy columns (they're needed for data joins)
                const hierarchyColNames = Object.values(sheet?.hierarchyMap || {}).filter(Boolean) as string[];
                for (const hCol of hierarchyColNames) {
                    if (!columnsUsed.some((c) => c.name.toLowerCase() === hCol.toLowerCase())) {
                        const idx = allColumns.findIndex((h) => h.toLowerCase() === hCol.toLowerCase());
                        columnsUsed.unshift({
                            name: idx >= 0 ? allColumns[idx] : hCol,
                            pos: idx >= 0 ? indexToColLetter(idx) : "?",
                        });
                    }
                }

                return {
                    spreadsheetId: d.spreadsheetId,
                    sheetName: d.sheetName,
                    label: d.sheetName,
                    route: "",
                    columnsUsed,
                    hierarchyPresent: Object.keys(sheet?.hierarchyMap || {}).filter((k: string) =>
                        (sheet?.hierarchyMap || {} as Record<string, string>)[k]
                    ),
                    hierarchyMapping: sheet?.hierarchyMap || {},
                };
            });

            // Save ALL relations (WYSIWYG — what's on canvas = what's in config)
            const hierarchyEdges = edges.filter((e) =>
                !e.id.startsWith("colfeed_") && e.target !== PAGE_BLOCK_ID
            );
            const relations = hierarchyEdges.map((e) => {
                const srcInfo = parseHandleId(e.sourceHandle || "");
                const tgtInfo = parseHandleId(e.targetHandle || "");
                const sourceNode = sheetNodes.find((n) => n.id === e.source);
                const targetNode = sheetNodes.find((n) => n.id === e.target);
                return {
                    id: e.id,
                    fromSheet: sourceNode?.data.sheetName || "",
                    fromColumn: srcInfo?.column || "",
                    toSheet: targetNode?.data.sheetName || "",
                    toColumn: tgtInfo?.column || "",
                    joinType: (typeof e.label === "string" ? e.label.toLowerCase() : "left") === "auto"
                        ? "left" : (typeof e.label === "string" ? e.label.toLowerCase() : "left"),
                    auto: e.id.startsWith("auto_"),
                };
            }).filter((r) => r.fromSheet && r.toSheet);

            // Save node positions for canvas restore
            const nodePositions: Record<string, { x: number; y: number }> = {};
            for (const n of sheetNodes) {
                nodePositions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
            }
            // Also save page block position
            const pageBlock = nodes.find((n) => n.id === PAGE_BLOCK_ID);
            if (pageBlock) {
                nodePositions[PAGE_BLOCK_ID] = { x: Math.round(pageBlock.position.x), y: Math.round(pageBlock.position.y) };
            }

            const pageConfig = {
                page: selectedPage,
                label: pageLabel || selectedPage,
                dataSources,
                relations,
                nodePositions,
            };

            const res = await fetch("/api/page-configs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pageConfig),
            });
            const json = await res.json();
            if (json.success) {
                setHasUnsavedChanges(false);
                setSavedConfig(pageConfig);
                fetchPages();

                // Refresh config mismatch warnings berdasarkan config BARU
                const sheetNodes = nodes.filter((n) => n.type === "sheet");
                const newMismatches: { sheetName: string; missing: string[] }[] = [];
                for (const ds of dataSources) {
                    const sheetId = `${ds.spreadsheetId}::${ds.sheetName}`;
                    const node = sheetNodes.find((n) => n.id === sheetId);
                    if (!node) continue;
                    const actualCols = ((node.data as SheetNodeData)?.columns || []).map((c: string) => c.toLowerCase());
                    const configCols = (ds.columnsUsed || []).map((c: any) => c.name as string);
                    const missing = configCols.filter((c: string) => !actualCols.includes(c.toLowerCase()));
                    if (missing.length > 0) {
                        newMismatches.push({ sheetName: ds.sheetName, missing });
                    }
                }
                setConfigMismatches(newMismatches);
            }
        } catch (err) {
            console.error("[DataConnector] Save failed:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        if (step === "canvas") {
            if (hasUnsavedChanges && !confirm("Ada perubahan belum disimpan. Yakin mau keluar?")) return;
            setStep("sheet-pick");
        } else if (step === "sheet-pick") {
            setSelectedPage(null);
            setSelectedSheetIds(new Set());
            setStep("page-select");
        }
    };

    const handleAdded = () => { fetchPages(); };

    /* ── Sheet Picker Helpers ── */

    const toggleSheet = (sheetId: string) => {
        setSelectedSheetIds((prev) => {
            const next = new Set(prev);
            if (next.has(sheetId)) next.delete(sheetId);
            else next.add(sheetId);
            return next;
        });
    };

    const toggleSpreadsheet = (spreadsheetId: string) => {
        setExpandedSpreadsheets((prev) => {
            const next = new Set(prev);
            if (next.has(spreadsheetId)) next.delete(spreadsheetId);
            else next.add(spreadsheetId);
            return next;
        });
    };

    const selectAllSheetsInSpreadsheet = (spreadsheetId: string, selected: boolean) => {
        const sheetsInSpreadsheet = pickerSheets.filter((s) => s.spreadsheetId === spreadsheetId);
        setSelectedSheetIds((prev) => {
            const next = new Set(prev);
            for (const s of sheetsInSpreadsheet) {
                if (selected) next.add(s.id);
                else next.delete(s.id);
            }
            return next;
        });
    };

    /* ══════════════════════════════════════════════
       Render — Delegate to Step Components
       ══════════════════════════════════════════════ */

    if (step === "page-select") {
        return (
            <StepPageSelect
                loading={loading}
                sidebarPages={sidebarPages}
                onSelectPage={handleSelectPage}
                onAdded={handleAdded}

            />
        );
    }

    if (step === "sheet-pick") {
        return (
            <StepSheetPick
                pageLabel={pageLabel}
                selectedPage={selectedPage}
                pickerSheets={pickerSheets}
                selectedSheetIds={selectedSheetIds}
                pickerLoading={pickerLoading}
                pickerSearch={pickerSearch}
                expandedSpreadsheets={expandedSpreadsheets}
                onBack={handleBack}
                onProceedToCanvas={handleProceedToCanvas}
                onToggleSheet={toggleSheet}
                onToggleSpreadsheet={toggleSpreadsheet}
                onSelectAllSheetsInSpreadsheet={selectAllSheetsInSpreadsheet}
                onSetPickerSearch={setPickerSearch}
                onResetSelection={() => setSelectedSheetIds(new Set())}
            />
        );
    }

    return (
        <StepCanvas
            pageLabel={pageLabel}
            selectedPage={selectedPage}
            onCanvasIds={onCanvasIds}
            nodes={nodes}
            edges={edges}
            hasUnsavedChanges={hasUnsavedChanges}
            saving={saving}
            selectedEdgeIds={selectedEdgeIds}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onSelectionChange={onSelectionChange}
            onBack={handleBack}
            onSave={handleSave}
            onDeleteSelectedEdges={handleDeleteSelectedEdges}
            onAdded={handleAdded}
            onNodeDragStop={onNodeDragStop}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            driftIssueCount={0}
            driftHealth={100}
            configMismatches={configMismatches}
        />
    );
}
