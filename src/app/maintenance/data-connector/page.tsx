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
    detectHierarchyInHeaders, parseHandleId,
    PAGE_BLOCK_ID, PAGE_BLOCK_X, PAGE_BLOCK_Y,
    makeRelationId, makePageFeedEdge, makeColumnFeedEdge,
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
                    });
                }
                for (const [, c] of configMap) {
                    if (!pages.find((p) => p.path === c.page)) {
                        pages.push({
                            path: c.page, label: c.label, section: "",
                            iconName: "FileText", hasConfig: true,
                            dataSourceCount: c.dataSourceCount, relationCount: c.relationCount,
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
                    const res = await fetch(`/api/data-sources?explore=${encodeURIComponent(entry.spreadsheetId)}`);
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
    ): Edge[] => {
        const autoEdges: Edge[] = [];
        const newHierMap = newSheet.hierarchyMap;
        if (Object.keys(newHierMap).length === 0) return autoEdges;

        for (const existing of existingSheets) {
            for (const levelKey of Object.keys(newHierMap)) {
                const existingCol = existing.hierarchyMap[levelKey];
                if (!existingCol) continue;
                const newCol = newHierMap[levelKey];
                autoEdges.push({
                    id: `auto_${existing.id}_${existingCol}_${newSheet.id}_${newCol}`,
                    source: existing.id,
                    target: newSheet.id,
                    sourceHandle: `${existing.id}::${existingCol}__source`,
                    targetHandle: `${newSheet.id}::${newCol}__target`,
                    animated: true,
                    style: { stroke: "#10b981", strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
                    label: "AUTO",
                    labelStyle: { fill: "#34d399", fontSize: 10, fontWeight: 700 },
                    labelBgStyle: { fill: "var(--card)", fillOpacity: 0.95 },
                });
            }
        }
        return autoEdges;
    }, []);

    const handleProceedToCanvas = useCallback(async () => {
        if (!selectedPage || selectedSheetIds.size === 0) return;

        let selectedSheets = pickerSheets.filter((s) => selectedSheetIds.has(s.id));

        if (selectedSheets.length === 0 && savedConfig?.dataSources) {
            selectedSheets = savedConfig.dataSources.map((ds: any) => {
                const sheetId = `${ds.spreadsheetId}::${ds.sheetName}`;
                const columns = (ds.columnsUsed || []).map((c: any) => c.name);
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

        const pageBlockNode: Node<PageBlockData> = {
            id: PAGE_BLOCK_ID,
            type: "page-block",
            position: { x: PAGE_BLOCK_X, y: PAGE_BLOCK_Y },
            draggable: true,
            data: { pagePath: selectedPage, pageLabel, connectedSheets: selectedSheets.length, connectedColumns: initialColCount },
        };

        const sheetNodes: Node<SheetNodeData>[] = [];
        const allEdges: Edge[] = [];
        const ids = new Set<string>();
        const COLS = 2;
        const X_GAP = 350;
        const Y_GAP = 350;

        for (let i = 0; i < selectedSheets.length; i++) {
            const s = selectedSheets[i];
            ids.add(s.id);
            const x = (i % COLS) * X_GAP + 40;
            const y = Math.floor(i / COLS) * Y_GAP + 40;

            sheetNodes.push({
                id: s.id,
                type: "sheet",
                position: { x, y },
                data: {
                    spreadsheetId: s.spreadsheetId,
                    spreadsheetTitle: s.spreadsheetTitle,
                    sheetName: s.sheetName,
                    columns: s.columns,
                    hierarchyColumns: s.hierarchyColumns,
                },
            });

            allEdges.push(makePageFeedEdge(s.id, s.sheetName));
        }

        if (savedConfig?.dataSources) {
            for (const ds of savedConfig.dataSources) {
                const sheetId = `${ds.spreadsheetId}::${ds.sheetName}`;
                if (!ids.has(sheetId)) continue;
                for (const col of (ds.columnsUsed || [])) {
                    allEdges.push(makeColumnFeedEdge(sheetId, col.name));
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

        if (savedRelations.length > 0) {
            for (const rel of savedRelations) {
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
        } else if (selectedSheets.length > 1) {
            for (let i = 1; i < selectedSheets.length; i++) {
                const autoEdges = findAutoConnections(selectedSheets[i], selectedSheets.slice(0, i));
                allEdges.push(...autoEdges);
            }
        }

        autoEdgeCountRef.current = allEdges.filter((e) => e.id.startsWith("auto_")).length;
        setOnCanvasIds(ids);
        setNodes([pageBlockNode as any, ...sheetNodes]);
        setEdges(allEdges);
        setHasUnsavedChanges(false);
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

    /* ══════════════════════════════════════════════
       Canvas Actions (Step 3)
       ══════════════════════════════════════════════ */

    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            const hasColumnEdge = deletedEdges.some((e) => e.id.startsWith("colfeed_"));
            if (hasColumnEdge) setHasUnsavedChanges(true);
        }, []);

    const onSelectionChange = useCallback(
        ({ edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
            setSelectedEdgeIds(new Set(selEdges.map((e) => e.id)));
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

            if (connection.target === PAGE_BLOCK_ID) {
                const handleInfo = parseHandleId(connection.sourceHandle);
                if (!handleInfo || handleInfo.column === "__feed") return;

                const dupId = `colfeed_${connection.source}::${handleInfo.column}`;
                setEdges((eds) => {
                    if (eds.some((e) => e.id === dupId)) return eds;
                    return addEdge(makeColumnFeedEdge(connection.source!, handleInfo.column), eds);
                });
                setHasUnsavedChanges(true);
                return;
            }

            const newEdge: Edge = {
                id: makeRelationId(),
                source: connection.source!,
                target: connection.target!,
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
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
                    .filter(Boolean);

                const columnsUsed = connectedCols.map((colName) => {
                    const idx = allColumns.indexOf(colName);
                    return {
                        name: colName,
                        pos: idx >= 0 ? String.fromCharCode(65 + idx) : "?",
                    };
                });

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

            const hierarchyEdges = edges.filter((e) =>
                !e.id.startsWith("feed_") && e.target !== PAGE_BLOCK_ID
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

            const pageConfig = {
                page: selectedPage,
                label: pageLabel || selectedPage,
                dataSources,
                relations,
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
        />
    );
}
