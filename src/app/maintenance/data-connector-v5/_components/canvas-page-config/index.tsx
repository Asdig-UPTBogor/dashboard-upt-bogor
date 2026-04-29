"use client";

/**
 * CanvasPageConfig — orchestrator untuk mapping page ↔ BQ table via XYFlow.
 *
 * Layout:
 *   ┌─────────────┬──────────────────────────────┐
 *   │ TableSidebar│ Toolbar (actions)            │
 *   │  (drag src) │ ─ ReactFlow ──── ─ ─ ─       │
 *   │             │ [BG + Controls + MiniMap]    │
 *   └─────────────┴──────────────────────────────┘
 *
 * Flow:
 *   1. useFirestorePagesV5 hydrate v5Sources + nodePositions + edges state
 *   2. User drag table dari sidebar → onDrop handler panggil addTable() +
 *      screenToFlowPosition simpan position
 *   3. Nodes = PageBlockNode (fixed id=PAGE_BLOCK_ID) + BQTableNode per v5Source
 *      - Inject onDelete callback → setDeleteTarget → render dialog
 *   4. Edges = computeAutoEdges (dari level chain) + manualEdges + column feed
 *      (bukti mapping kolom ke page block)
 *   5. Save button → useCanvasState.saveCanvas() → POST /api/data-connector-v5/mapping
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    MarkerType,
    useReactFlow,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    type Node,
    type Edge,
    type NodeChange,
    type EdgeChange,
    type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import BQTableNode from "./BQTableNode";
import PageBlockNode from "./PageBlockNode";
import { TableSidebar, DRAG_MIME } from "./TableSidebar";
import { DeleteNodeDialog } from "./DeleteNodeDialog";
import { useCanvasState } from "./useCanvasState";
import { buildCanvasEdges } from "./build-edges";
import { PAGE_BLOCK_ID, PAGE_BLOCK_X, PAGE_BLOCK_Y, sourceNodeId } from "./constants";
import type { Level, V5Source, BQTableNodeData, PageBlockNodeData } from "./types";

const nodeTypes = { bqTable: BQTableNode, page: PageBlockNode };

interface Props {
    pagePath: string;
    pageLabel: string;
    onSaved?: () => void;
}

export default function CanvasPageConfig(props: Props) {
    return (
        <ReactFlowProvider>
            <CanvasInner {...props} />
        </ReactFlowProvider>
    );
}

function CanvasInner({ pagePath, pageLabel, onSaved }: Props) {
    const {
        v5Sources,
        nodePositions,
        manualEdges,
        removedAutoEdges,
        hydrated,
        saving,
        error,
        addTable,
        removeTable,
        setNodePosition,
        saveCanvas,
    } = useCanvasState({ pagePath, pageLabel });

    const [deleteTarget, setDeleteTarget] = useState<{ dataset: string; table: string } | null>(
        null
    );
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    /* ─── Build nodes + edges ─── */

    const nodes = useMemo<Node[]>(() => {
        if (!hydrated) return [];

        const colCount = v5Sources.reduce((n, s) => n + s.columns.length, 0);
        const pageData: PageBlockNodeData = {
            pagePath,
            pageLabel: pageLabel || pagePath,
            connectedSources: v5Sources.length,
            connectedColumns: colCount,
        };

        const pageNode: Node<PageBlockNodeData> = {
            id: PAGE_BLOCK_ID,
            type: "page",
            position: nodePositions[PAGE_BLOCK_ID] || { x: PAGE_BLOCK_X, y: PAGE_BLOCK_Y },
            data: pageData,
            draggable: true,
        };

        const tableNodes: Array<Node<BQTableNodeData>> = v5Sources.map((src, idx) => {
            const id = sourceNodeId(src.dataset, src.table);
            const pos = nodePositions[id] || { x: 40, y: 40 + idx * 260 };
            const data: BQTableNodeData = {
                dataset: src.dataset,
                table: src.table,
                level: src.level || "FLAT",
                columns: src.columns,
                onDelete: () => setDeleteTarget({ dataset: src.dataset, table: src.table }),
            };
            return {
                id,
                type: "bqTable",
                position: pos,
                data,
                draggable: true,
            };
        });

        return [pageNode, ...tableNodes];
    }, [hydrated, v5Sources, nodePositions, pagePath, pageLabel]);

    const edges = useMemo<Edge[]>(
        () => (hydrated ? buildCanvasEdges(v5Sources, manualEdges, removedAutoEdges) : []),
        [hydrated, v5Sources, manualEdges, removedAutoEdges]
    );

    /* ─── Local XYFlow state (position tracking) ───
     * Pakai pattern "computed from props + apply local changes on drag".
     * onNodesChange tangkap drag, persist ke useCanvasState.setNodePosition.
     */
    const [localNodes, setLocalNodes] = useState<Node[]>([]);
    const [localEdges, setLocalEdges] = useState<Edge[]>([]);

    useEffect(() => {
        setLocalNodes(nodes);
    }, [nodes]);
    useEffect(() => {
        setLocalEdges(edges);
    }, [edges]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setLocalNodes((nds) => {
                const next = applyNodeChanges(changes, nds);
                // persist drag end positions
                for (const c of changes) {
                    if (c.type === "position" && c.dragging === false) {
                        const n = next.find((x) => x.id === c.id);
                        if (n) setNodePosition(n.id, { x: n.position.x, y: n.position.y });
                    }
                }
                return next;
            });
        },
        [setNodePosition]
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setLocalEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const onConnect = useCallback(
        (conn: Connection) => {
            setLocalEdges((eds) =>
                addEdge(
                    {
                        ...conn,
                        id: `m::${conn.source}->${conn.target}::${Date.now()}`,
                        animated: false,
                        style: { stroke: "#a78bfa", strokeWidth: 1.5 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: "#a78bfa" },
                    },
                    eds
                )
            );
        },
        []
    );

    /* ─── Drop handler ─── */
    const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, []);

    const onDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData(DRAG_MIME);
            if (!raw) return;
            let payload: { dataset: string; table: string; level: Level };
            try {
                payload = JSON.parse(raw);
            } catch {
                return;
            }
            const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            await addTable(payload.dataset, payload.table, payload.level);
            // Note: actual nid = dataset::table, persist position setelah state updated.
            setNodePosition(sourceNodeId(payload.dataset, payload.table), pos);
        },
        [screenToFlowPosition, addTable, setNodePosition]
    );

    /* ─── Save ─── */
    const handleSave = useCallback(async () => {
        setSaveStatus(null);
        const result = await saveCanvas();
        if (result.ok) {
            setSaveStatus("Tersimpan.");
            onSaved?.();
            setTimeout(() => setSaveStatus(null), 2500);
        }
    }, [saveCanvas, onSaved]);

    /* ─── Render ─── */
    return (
        <div className="flex h-full w-full">
            <TableSidebar currentSources={v5Sources as V5Source[]} />

            <div className="flex-1 flex flex-col relative">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="ds-label truncate">{pageLabel || pagePath}</span>
                        <span className="ds-small opacity-60">
                            {v5Sources.length} tabel · {localEdges.length} edge
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {error && (
                            <span className="ds-small text-red-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {error}
                            </span>
                        )}
                        {saveStatus && (
                            <span className="ds-small text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {saveStatus}
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || !hydrated}
                            className="ds-transition flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/40 hover:bg-indigo-500/20 text-indigo-300 text-sm cursor-pointer disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>

                {/* Canvas */}
                <div
                    ref={reactFlowWrapper}
                    className="flex-1 relative"
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                >
                    <ReactFlow
                        nodes={localNodes}
                        edges={localEdges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                    >
                        <Background />
                        <Controls />
                        <MiniMap pannable zoomable />
                    </ReactFlow>
                </div>
            </div>

            {/* Delete dialog */}
            <DeleteNodeDialog
                open={deleteTarget !== null}
                tableName={deleteTarget ? `${deleteTarget.dataset}.${deleteTarget.table}` : ""}
                pageLabel={pageLabel || pagePath}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (deleteTarget) {
                        removeTable(deleteTarget.dataset, deleteTarget.table);
                    }
                    setDeleteTarget(null);
                }}
            />
        </div>
    );
}
