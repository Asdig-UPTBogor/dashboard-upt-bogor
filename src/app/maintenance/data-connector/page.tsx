"use client";

/**
 * Data Connector V4 — 3-Step Wizard
 *
 * Flow:
 *   Step 1: PAGE SELECT   — pick dashboard page
 *   Step 2: SHEET PICK    — pick spreadsheets & sheets (checkbox tree)
 *   Step 3: CANVAS CONFIG — column mapping, hierarchy, Page Block
 *
 * Data Flow:
 *   1. GET /api/data-sources?pages=1       → list all dashboard pages
 *   2. GET /api/page-configs               → page config summaries
 *   3. GET /api/data-sources?raw=1         → master registry (all spreadsheets)
 *   4. GET /api/data-sources?explore=ID    → sheet headers (only for selected)
 *   5. PUT /api/page-configs               → save per-page config
 */

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    type Node,
    MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
    Cable, Database, Plus, Save, Trash2, Loader2,
    FileSpreadsheet, ChevronRight, RefreshCw,
    Search, X, Sparkles, ArrowLeft, Check,
    LayoutDashboard, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/* ── Local Components ── */
import SheetNode, { type SheetNodeData } from "../data-source/_components/xyflow/sheet-node";
import PageBlockNode, { type PageBlockData } from "../data-source/_components/xyflow/page-block-node";
import { AddSpreadsheetDialog } from "../data-source/_components/add-spreadsheet-dialog";
import type { RegistryEntry, ExploreSheet } from "../data-source/_types";

/* ── Types ── */
type WizardStep = "page-select" | "sheet-pick" | "canvas";

interface PageSummary {
    page: string;
    label: string;
    dataSourceCount: number;
    relationCount: number;
    updatedAt?: string;
}

interface SidebarPage {
    path: string;
    label: string;
    section: string;
    iconName: string;
    hasConfig: boolean;
    dataSourceCount: number;
    relationCount: number;
}

interface CanvasSheet {
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
const HIERARCHY_LEVELS = [
    { key: "ultg", columnNames: ["Master ULTG", "ULTG"] },
    { key: "gi", columnNames: ["Master Gardu Induk", "Gardu Induk"] },
    { key: "bay", columnNames: ["Master Bay", "Bay"] },
];

function detectHierarchyInHeaders(headers: string[]): {
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

/* ── xyflow node types ── */
const nodeTypes = { sheet: SheetNode, "page-block": PageBlockNode };

/* ── Page Block constants ── */
const PAGE_BLOCK_ID = "__page_block__";
const PAGE_BLOCK_X = 700;
const PAGE_BLOCK_Y = 200;

function makeRelationId(): string {
    return `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Parse xyflow handle ID: `{nodeId}::{column}__{source|target}`
 * nodeId contains `::` so we use lastIndexOf.
 */
function parseHandleId(handleId: string): { nodeId: string; column: string } | null {
    const suffixMatch = handleId.match(/__(source|target)$/);
    if (!suffixMatch) return null;
    const withoutType = handleId.slice(0, -suffixMatch[0].length);
    const lastSep = withoutType.lastIndexOf("::");
    if (lastSep === -1) return null;
    return { nodeId: withoutType.slice(0, lastSep), column: withoutType.slice(lastSep + 2) };
}

/** Create a sheet → page-block feed edge */
function makePageFeedEdge(sheetId: string, sheetName: string): Edge {
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
function makeColumnFeedEdge(sheetId: string, colName: string): Edge {
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

/* ═══════════════════════════════════════════════════
   Main Component
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

    const [showAddDialog, setShowAddDialog] = useState(false);

    /* ── Derived ── */
    const totalRelations = edges.filter(
        (e) => !e.id.startsWith("feed_") && e.target !== PAGE_BLOCK_ID
    ).length;
    const autoRelations = edges.filter((e) => e.id.startsWith("auto_")).length;
    const manualRelations = totalRelations - autoRelations;

    /* ══════════════════════════════════════════════
       Data Fetching
       ══════════════════════════════════════════════ */

    /** Fetch pages list + page config summaries */
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

    /** Fetch sheet headers for all spreadsheets — once for picker (parallel) */
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

    /* ── Initial load ── */
    useEffect(() => { fetchPages(); }, [fetchPages]);

    /* ── When registry loads → fetch all headers (parallel) ── */
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

        // Load existing config to pre-select sheets
        try {
            const res = await fetch(`/api/page-configs?page=${encodeURIComponent(pagePath)}`);
            const json = await res.json();
            if (json.success && json.config) {
                const config = json.config;
                setPageLabel(config.label || page?.label || pagePath);
                setSavedConfig(config); // Store for fallback

                const preSelected = new Set<string>();
                for (const ds of config.dataSources) {
                    preSelected.add(`${ds.spreadsheetId}::${ds.sheetName}`);
                }
                setSelectedSheetIds(preSelected);

                // Auto-expand spreadsheets that have selected sheets
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

        // Build canvas from selected sheets (with fallback to saved config)
        let selectedSheets = pickerSheets.filter((s) => selectedSheetIds.has(s.id));

        // Fallback: if pickerSheets not loaded yet (Google API slow), build from saved config
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

        // Count saved columns for initial display
        let initialColCount = 0;
        if (savedConfig?.dataSources) {
            for (const ds of savedConfig.dataSources) {
                initialColCount += (ds.columnsUsed || []).length;
            }
        }

        // Page Block node
        const pageBlockNode: Node<PageBlockData> = {
            id: PAGE_BLOCK_ID,
            type: "page-block",
            position: { x: PAGE_BLOCK_X, y: PAGE_BLOCK_Y },
            draggable: true,
            data: { pagePath: selectedPage, pageLabel, connectedSheets: selectedSheets.length, connectedColumns: initialColCount },
        };

        // Build sheet nodes
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

            // Feed edge: sheet → page block
            allEdges.push(makePageFeedEdge(s.id, s.sheetName));
        }

        // Restore per-column edges from saved config
        if (savedConfig?.dataSources) {
            for (const ds of savedConfig.dataSources) {
                const sheetId = `${ds.spreadsheetId}::${ds.sheetName}`;
                // Only restore if this sheet is on canvas
                if (!ids.has(sheetId)) continue;
                for (const col of (ds.columnsUsed || [])) {
                    allEdges.push(makeColumnFeedEdge(sheetId, col.name));
                }
            }
        }

        // Try loading saved relations
        let savedRelations: any[] = [];
        try {
            const res = await fetch(`/api/page-configs?page=${encodeURIComponent(selectedPage)}`);
            const json = await res.json();
            if (json.success && json.config) {
                savedRelations = json.config.relations || [];
            }
        } catch { /* ignore */ }

        // Rebuild saved relations
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
            // Auto-detect hierarchy connections
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
    }, [selectedPage, selectedSheetIds, pickerSheets, savedConfig, pageLabel, findAutoConnections, detectHierarchyInHeaders, setNodes, setEdges]);

    // Dynamically sync Page Block's connectedColumns count when edges change
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

    /** Handle edge deletion — mark unsaved + allow column edge removal */
    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            const hasColumnEdge = deletedEdges.some((e) => e.id.startsWith("colfeed_"));
            if (hasColumnEdge) {
                setHasUnsavedChanges(true);
            }
        },
        []
    );

    /** Track selected edges for floating delete button */
    const onSelectionChange = useCallback(
        ({ edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
            setSelectedEdgeIds(new Set(selEdges.map((e) => e.id)));
        },
        []
    );

    /** Delete selected edges via button */
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

            // Detect: column → Page Block connection
            if (connection.target === PAGE_BLOCK_ID) {
                const handleInfo = parseHandleId(connection.sourceHandle);
                if (!handleInfo || handleInfo.column === "__feed") return; // ignore feed handle

                // Prevent duplicate column edges
                const dupId = `colfeed_${connection.source}::${handleInfo.column}`;
                setEdges((eds) => {
                    if (eds.some((e) => e.id === dupId)) return eds;
                    return addEdge(makeColumnFeedEdge(connection.source!, handleInfo.column), eds);
                });
                setHasUnsavedChanges(true);
                return;
            }

            // Cross-sheet relation edge
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
        },
        [setEdges]
    );

    /** Save page config via API */
    const handleSave = async () => {
        if (!selectedPage) return;
        setSaving(true);
        try {
            const sheetNodes = nodes.filter((n) => n.type === "sheet");

            // Extract per-column edges: only columns connected to Page Block
            const columnEdges = edges.filter((e) =>
                e.id.startsWith("colfeed_") && e.target === PAGE_BLOCK_ID
            );

            const dataSources = sheetNodes.map((n) => {
                const d = n.data as SheetNodeData;
                const sheet = pickerSheets.find((s) => s.id === n.id);
                const allColumns = sheet?.columns || d.columns || [];

                // Only save columns that have edges to Page Block
                const connectedCols = columnEdges
                    .filter((e) => e.source === n.id)
                    .map((e) => {
                        const info = parseHandleId(e.sourceHandle || "");
                        return info?.column || "";
                    })
                    .filter(Boolean);

                // Map connected columns with their positions
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
                // Sync savedConfig so back→re-enter canvas uses latest saved data
                setSavedConfig(pageConfig);
                fetchPages();
            }
        } catch (err) {
            console.error("[DataConnector] Save failed:", err);
        } finally {
            setSaving(false);
        }
    };

    /** Go back one step */
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

    /* ══════════════════════════════════════════════
       Sheet Picker Helpers (Step 2)
       ══════════════════════════════════════════════ */

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

    /** Group sheets by spreadsheet for display */
    const sheetsBySpreadsheet = useMemo(() => {
        const map = new Map<string, { title: string; sheets: CanvasSheet[] }>();
        for (const s of pickerSheets) {
            const lower = s.sheetName.toLowerCase();
            const search = pickerSearch.toLowerCase();
            if (pickerSearch && !lower.includes(search) && !s.spreadsheetTitle.toLowerCase().includes(search)) continue;

            if (!map.has(s.spreadsheetId)) {
                map.set(s.spreadsheetId, { title: s.spreadsheetTitle, sheets: [] });
            }
            map.get(s.spreadsheetId)!.sheets.push(s);
        }
        return map;
    }, [pickerSheets, pickerSearch]);

    /* ══════════════════════════════════════════════
       Render: Step 1 — Page Selector
       ══════════════════════════════════════════════ */

    if (step === "page-select") {
        const sections = new Map<string, SidebarPage[]>();
        for (const p of sidebarPages) {
            const sec = p.section || "Lainnya";
            if (!sections.has(sec)) sections.set(sec, []);
            sections.get(sec)!.push(p);
        }

        return (
            <div className="flex h-screen flex-col bg-background">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                            <Cable className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-foreground">Data Connector</h1>
                            <p className="text-xs text-muted-foreground">Step 1 — Pilih halaman untuk mengatur sumber data</p>
                        </div>
                    </div>
                    <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Spreadsheet
                    </Button>
                </div>

                {/* Page Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                        </div>
                    ) : (
                        <div className="space-y-8 max-w-5xl mx-auto">
                            {[...sections.entries()].map(([section, pages]) => (
                                <div key={section}>
                                    <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold mb-3">{section}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {pages.map((p) => (
                                            <button
                                                key={p.path}
                                                onClick={() => handleSelectPage(p.path)}
                                                className="group text-left rounded-xl border border-border bg-card p-4 hover:border-indigo-500/30 hover:bg-accent transition-all"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <Database className="h-5 w-5 text-muted-foreground/60 group-hover:text-indigo-400 transition-colors" />
                                                    {p.hasConfig && (
                                                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px]">
                                                            configured
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm font-semibold text-foreground mb-0.5">{p.label}</p>
                                                <p className="text-[10px] text-muted-foreground/60 font-mono">{p.path}</p>
                                                {p.hasConfig && (
                                                    <p className="text-[10px] text-indigo-400/60 mt-2">{p.dataSourceCount} data source · {p.relationCount} relasi</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <AddSpreadsheetDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdded={handleAdded} />
            </div>
        );
    }

    /* ══════════════════════════════════════════════
       Render: Step 2 — Sheet Picker
       ══════════════════════════════════════════════ */

    if (step === "sheet-pick") {
        return (
            <div className="flex h-screen flex-col bg-background">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={handleBack} className="text-muted-foreground hover:text-foreground h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                            <FileSpreadsheet className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-foreground">{pageLabel}</h1>
                            <p className="text-xs text-muted-foreground">Step 2 — Pilih spreadsheet & sheet yang digunakan halaman ini</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleProceedToCanvas}
                        disabled={selectedSheetIds.size === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
                    >
                        Lanjut ke Canvas <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* Search */}
                <div className="border-b border-border px-6 py-3 shrink-0">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                        <Input
                            value={pickerSearch}
                            onChange={(e) => setPickerSearch(e.target.value)}
                            placeholder="Cari sheet atau spreadsheet..."
                            className="pl-9 bg-muted/30 border-border h-9 text-sm text-foreground/80"
                        />
                        {pickerSearch && (
                            <button onClick={() => setPickerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="h-3 w-3 text-muted-foreground/60" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground/60">{selectedSheetIds.size} sheet dipilih</span>
                        {selectedSheetIds.size > 0 && (
                            <button onClick={() => setSelectedSheetIds(new Set())} className="text-[10px] text-red-400 hover:text-red-300">
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Sheet Tree */}
                <div className="flex-1 overflow-y-auto p-6">
                    {pickerLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                            <span className="ml-3 text-sm text-muted-foreground">Memuat sheet dari Google Sheets...</span>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-3">
                            {[...sheetsBySpreadsheet.entries()].map(([spreadsheetId, { title, sheets }]) => {
                                const isExpanded = expandedSpreadsheets.has(spreadsheetId);
                                const selectedCount = sheets.filter((s) => selectedSheetIds.has(s.id)).length;
                                const allSelected = selectedCount === sheets.length;

                                return (
                                    <div key={spreadsheetId} className="rounded-xl border border-border bg-card overflow-hidden">
                                        {/* Spreadsheet header */}
                                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20" onClick={() => toggleSpreadsheet(spreadsheetId)}>
                                            <ChevronDown className={`h-4 w-4 text-muted-foreground/60 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                                            <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{title}</p>
                                                <p className="text-[10px] text-muted-foreground/60">{sheets.length} sheet · {selectedCount} dipilih</p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); selectAllSheetsInSpreadsheet(spreadsheetId, !allSelected); }}
                                                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${allSelected
                                                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                                    : "border-border text-muted-foreground hover:text-foreground/80"
                                                    }`}
                                            >
                                                {allSelected ? "Deselect All" : "Select All"}
                                            </button>
                                        </div>

                                        {/* Sheet list */}
                                        {isExpanded && (
                                            <div className="border-t border-border/50 divide-y divide-border/30">
                                                {sheets.map((sheet) => {
                                                    const isSelected = selectedSheetIds.has(sheet.id);
                                                    const hasHier = sheet.hierarchyColumns.length > 0;
                                                    return (
                                                        <button
                                                            key={sheet.id}
                                                            onClick={() => toggleSheet(sheet.id)}
                                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors ${isSelected ? "bg-indigo-500/5" : ""
                                                                }`}
                                                        >
                                                            <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${isSelected
                                                                ? "border-indigo-500 bg-indigo-500 text-foreground"
                                                                : "border-border text-transparent"
                                                                }`}>
                                                                <Check className="h-3 w-3" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm truncate ${isSelected ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                                                    {sheet.sheetName}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground/60">
                                                                    {sheet.columns.length} kolom
                                                                    {hasHier && (
                                                                        <span className="text-emerald-500 ml-2">
                                                                            · hierarchy: {sheet.hierarchyColumns.join(", ")}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            {isSelected && (
                                                                <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/20 text-[9px]">
                                                                    ✓
                                                                </Badge>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-5 py-3 shrink-0">
                    <div className="text-[10px] text-muted-foreground/60">
                        <span className="text-indigo-400 font-medium">{selectedPage}</span>
                        <span className="mx-2">·</span>
                        <span>{selectedSheetIds.size} sheet dipilih dari {pickerSheets.length} total</span>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleProceedToCanvas}
                        disabled={selectedSheetIds.size === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
                    >
                        Lanjut ke Canvas <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        );
    }

    /* ══════════════════════════════════════════════
       Render: Step 3 — Canvas Config
       ══════════════════════════════════════════════ */

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex h-screen flex-col bg-background">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={handleBack} className="text-muted-foreground hover:text-foreground h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                            <Cable className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-foreground">{pageLabel}</h1>
                            <p className="text-xs text-muted-foreground">
                                Step 3 — {onCanvasIds.size} sheet ·
                                tarik koneksi antar kolom hierarchy
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleBack}
                            className="border-border text-muted-foreground hover:text-foreground text-xs">
                            <ArrowLeft className="mr-1.5 h-3 w-3" /> Ubah Sheet
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                            {saving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                            Simpan
                        </Button>
                    </div>
                </div>

                {/* Canvas (full width, no sidebar) */}
                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onEdgesDelete={onEdgesDelete}
                        onSelectionChange={onSelectionChange}
                        deleteKeyCode={["Backspace", "Delete"]}
                        edgesFocusable={true}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        connectionLineStyle={{ stroke: "#6366f1", strokeWidth: 2 }}
                        defaultEdgeOptions={{
                            animated: true,
                            style: { stroke: "#6366f1", strokeWidth: 2 },
                        }}
                        proOptions={{ hideAttribution: true }}
                        style={{ background: "var(--background)" }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
                        <Controls className="!rounded-lg !shadow-xl" />
                        <MiniMap className="!rounded-lg" />
                        <Panel position="top-right" className="!m-3">
                            <div className="flex items-center gap-2">
                                {autoRelations > 0 && (
                                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                                        <Sparkles className="mr-1 h-3 w-3" />
                                        {autoRelations} auto
                                    </Badge>
                                )}
                                {manualRelations > 0 && (
                                    <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/20 text-[10px]">
                                        {manualRelations} manual
                                    </Badge>
                                )}
                                {hasUnsavedChanges && (
                                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[10px] animate-pulse">
                                        Unsaved
                                    </Badge>
                                )}
                            </div>
                        </Panel>

                        {/* Floating delete button when edge(s) selected */}
                        {selectedEdgeIds.size > 0 && (
                            <Panel position="bottom-center" className="!mb-4">
                                <button
                                    onClick={handleDeleteSelectedEdges}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/90 hover:bg-red-500
                                        text-foreground text-xs font-semibold shadow-lg shadow-red-500/30
                                        transition-all duration-200 hover:scale-105 backdrop-blur-sm"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Hapus {selectedEdgeIds.size} koneksi
                                </button>
                            </Panel>
                        )}
                    </ReactFlow>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-5 py-2 shrink-0">
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
                        <span className="text-indigo-400 font-medium">{selectedPage}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{onCanvasIds.size} data source</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{totalRelations} relasi ({autoRelations} auto, {manualRelations} manual)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                        {hasUnsavedChanges && (
                            <span className="text-amber-400 animate-pulse">● perubahan belum disimpan</span>
                        )}
                    </div>
                </div>

                <AddSpreadsheetDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdded={handleAdded} />
            </div>
        </TooltipProvider>
    );
}
