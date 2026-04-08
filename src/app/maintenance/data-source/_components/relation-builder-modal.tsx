"use client";

/**
 * RelationBuilderModal — Full-screen xyflow canvas for building
 * cross-sheet column relations.
 *
 * Opens from DSM page, shows all linked sheets for a page as nodes,
 * lets user draw edges between column handles to create relations.
 * Saves relation config to registry via save-relations API.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    type Node,
    MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Trash2, Cable } from "lucide-react";

import SheetNode, { type SheetNodeData } from "./xyflow/sheet-node";
import type { DataRelation } from "@/lib/data-source-registry";

/* ── Node Types (must be stable/memoized) ── */
const nodeTypes = { sheet: SheetNode };

/* ── Types ── */
interface SheetInfo {
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheetName: string;
    columns: string[];
    hierarchyColumns?: string[];
}

interface RelationBuilderModalProps {
    open: boolean;
    onClose: () => void;
    pagePath: string;
    pageLabel: string;
    sheets: SheetInfo[];
    onSaved?: () => void;
}

/* ── Helper: parse handle ID → column info ── */
function parseHandleId(handleId: string): { nodeId: string; column: string; type: "source" | "target" } | null {
    // Format: "nodeId::columnName__source" or "nodeId::columnName__target"
    const match = handleId.match(/^(.+?)::(.+?)__(source|target)$/);
    if (!match) return null;
    return { nodeId: match[1], column: match[2], type: match[3] as "source" | "target" };
}

/* ── Helper: generate unique relation ID ── */
function makeRelationId(): string {
    return `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */
export function RelationBuilderModal({
    open, onClose, pagePath, pageLabel, sheets, onSaved,
}: RelationBuilderModalProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<SheetNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    /* ── Build nodes from sheets ── */
    useEffect(() => {
        if (!open || sheets.length === 0) return;

        // Auto-layout: position sheets in a grid
        const COLS = Math.min(sheets.length, 3);
        const X_GAP = 320;
        const Y_GAP = 360;

        const sheetNodes: Node<SheetNodeData>[] = sheets.map((s, i) => ({
            id: `${s.spreadsheetId}::${s.sheetName}`,
            type: "sheet",
            position: {
                x: (i % COLS) * X_GAP + 40,
                y: Math.floor(i / COLS) * Y_GAP + 40,
            },
            data: {
                spreadsheetId: s.spreadsheetId,
                spreadsheetTitle: s.spreadsheetTitle,
                sheetName: s.sheetName,
                columns: s.columns,
                hierarchyColumns: s.hierarchyColumns,
            },
        }));

        setNodes(sheetNodes);

        // Load existing relations
        loadRelations(sheetNodes);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, sheets]);

    /* ── Load existing relations from API ── */
    const loadRelations = async (currentNodes: Node<SheetNodeData>[]) => {
        try {
            const res = await fetch("/api/data-sources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get-relations" }),
            });
            const json = await res.json();
            if (json.success && json.relations) {
                const nodeIds = new Set(currentNodes.map((n) => n.id));
                const existingEdges: Edge[] = (json.relations as DataRelation[])
                    .filter((r) => {
                        const fromId = `${r.fromSpreadsheet}::${r.fromSheet}`;
                        const toId = `${r.toSpreadsheet}::${r.toSheet}`;
                        return nodeIds.has(fromId) && nodeIds.has(toId);
                    })
                    .map((r) => ({
                        id: r.id,
                        source: `${r.fromSpreadsheet}::${r.fromSheet}`,
                        target: `${r.toSpreadsheet}::${r.toSheet}`,
                        sourceHandle: `${r.fromSpreadsheet}::${r.fromSheet}::${r.fromColumn}__source`,
                        targetHandle: `${r.toSpreadsheet}::${r.toSheet}::${r.toColumn}__target`,
                        animated: true,
                        style: { stroke: "#6366f1", strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
                        label: r.joinType.toUpperCase(),
                        labelStyle: { fill: "#94a3b8", fontSize: 9, fontWeight: 600 },
                        labelBgStyle: { fill: "#1e293b", fillOpacity: 0.9 },
                        data: { relation: r },
                    }));
                setEdges(existingEdges);
            }
        } catch { /* ignore */ }
        setLoaded(true);
    };

    /* ── Handle new connections ── */
    const onConnect = useCallback(
        (connection: Connection) => {
            if (!connection.sourceHandle || !connection.targetHandle) return;

            // Prevent self-connections on same node
            if (connection.source === connection.target) return;

            const sourceInfo = parseHandleId(connection.sourceHandle);
            const targetInfo = parseHandleId(connection.targetHandle);
            if (!sourceInfo || !targetInfo) return;

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
                labelStyle: { fill: "#94a3b8", fontSize: 9, fontWeight: 600 },
                labelBgStyle: { fill: "#1e293b", fillOpacity: 0.9 },
            };

            setEdges((eds) => addEdge(newEdge, eds));
        },
        [setEdges]
    );

    /* ── Convert edges to DataRelation[] ── */
    const edgesToRelations = useCallback((): DataRelation[] => {
        return edges
            .map((edge) => {
                const sourceInfo = parseHandleId(edge.sourceHandle || "");
                const targetInfo = parseHandleId(edge.targetHandle || "");
                if (!sourceInfo || !targetInfo) return null;

                // Parse node IDs: "spreadsheetId::sheetName"
                const [fromSpreadsheet, fromSheet] = (edge.source || "").split("::");
                const [toSpreadsheet, toSheet] = (edge.target || "").split("::");

                return {
                    id: edge.id,
                    fromSpreadsheet,
                    fromSheet,
                    fromColumn: sourceInfo.column,
                    toSpreadsheet,
                    toSheet,
                    toColumn: targetInfo.column,
                    joinType: (typeof edge.label === "string" ? edge.label.toLowerCase() : "left") as "left" | "inner",
                } satisfies DataRelation;
            })
            .filter(Boolean) as DataRelation[];
    }, [edges]);

    /* ── Save relations ── */
    const handleSave = async () => {
        setSaving(true);
        try {
            const relations = edgesToRelations();
            const res = await fetch("/api/data-sources", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "save-relations", relations }),
            });
            const json = await res.json();
            if (json.success) {
                onSaved?.();
                onClose();
            }
        } catch (err) {
            console.error("[RelationBuilder] Save failed:", err);
        } finally {
            setSaving(false);
        }
    };

    /* ── Clear all edges ── */
    const handleClearAll = () => setEdges([]);

    /* ── Edge count memo ── */
    const edgeCount = edges.length;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-[90vw] h-[85vh] bg-card border-border p-0 gap-0 flex flex-col">
                {/* Header */}
                <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                                <Cable className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-semibold text-foreground">
                                    Data Relation Builder
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground">
                                    {pageLabel} · <code className="text-muted-foreground/60">{pagePath}</code> · {sheets.length} sheet
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {edgeCount > 0 && (
                                <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-xs">
                                    {edgeCount} relasi
                                </Badge>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {/* Canvas */}
                <div className="flex-1 relative">
                    {!loaded ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            nodeTypes={nodeTypes}
                            fitView
                            fitViewOptions={{ padding: 0.3 }}
                            connectionLineStyle={{ stroke: "#6366f1", strokeWidth: 2 }}
                            defaultEdgeOptions={{
                                animated: true,
                                style: { stroke: "#6366f1", strokeWidth: 2 },
                            }}
                            proOptions={{ hideAttribution: true }}
                            style={{ background: "#0a0e1a" }}
                        >
                            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
                            <Controls
                                className="!bg-card !border-border !rounded-lg !shadow-xl"
                            />
                            <MiniMap
                                className="!bg-card !border-border !rounded-lg"
                                nodeColor="#334155"
                                maskColor="rgba(0,0,0,0.7)"
                            />
                        </ReactFlow>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="px-5 py-3 border-t border-border shrink-0 flex-row justify-between items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground/60">
                            Drag dari kolom satu ke kolom lain untuk membuat relasi
                        </p>
                        {edgeCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleClearAll}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7">
                                <Trash2 className="mr-1 h-3 w-3" /> Clear All
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2.5">
                        <Button variant="outline" onClick={onClose}
                            className="border-border bg-muted/40 text-foreground/80 hover:bg-white/10">
                            Batal
                        </Button>
                        <Button onClick={handleSave} disabled={saving}
                            className="bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30">
                            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                            Simpan Relasi {edgeCount > 0 && `(${edgeCount})`}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
