"use client";

import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    type Edge,
    type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    Cable, Save, Trash2, Loader2,
    ArrowLeft, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import SheetNode from "../../data-source/_components/xyflow/sheet-node";
import PageBlockNode from "../../data-source/_components/xyflow/page-block-node";
import { AddSpreadsheetDialog } from "../../data-source/_components/add-spreadsheet-dialog";
import { useState } from "react";
import { PAGE_BLOCK_ID } from "../_lib/types";

/* ── xyflow node types ── */
const nodeTypes = { sheet: SheetNode, "page-block": PageBlockNode };

interface StepCanvasProps {
    pageLabel: string;
    selectedPage: string | null;
    onCanvasIds: Set<string>;
    nodes: Node[];
    edges: Edge[];
    hasUnsavedChanges: boolean;
    saving: boolean;
    selectedEdgeIds: Set<string>;
    onNodesChange: (changes: any) => void;
    onEdgesChange: (changes: any) => void;
    onConnect: (connection: any) => void;
    onEdgesDelete: (edges: Edge[]) => void;
    onSelectionChange: (params: { nodes: Node[]; edges: Edge[] }) => void;
    onBack: () => void;
    onSave: () => void;
    onDeleteSelectedEdges: () => void;
    onAdded: () => void;
    onNodeDragStop?: (event: any, node: Node) => void;
    onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
    onPaneClick?: () => void;
}

export function StepCanvas({
    pageLabel,
    selectedPage,
    onCanvasIds,
    nodes,
    edges,
    hasUnsavedChanges,
    saving,
    selectedEdgeIds,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgesDelete,
    onSelectionChange,
    onBack,
    onSave,
    onDeleteSelectedEdges,
    onAdded,
    onNodeDragStop,
    onEdgeClick,
    onPaneClick,
}: StepCanvasProps) {
    const [showAddDialog, setShowAddDialog] = useState(false);

    const totalRelations = edges.filter(
        (e) => !e.id.startsWith("feed_") && e.target !== PAGE_BLOCK_ID
    ).length;
    const autoRelations = edges.filter((e) => e.id.startsWith("auto_")).length;
    const manualRelations = totalRelations - autoRelations;

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex h-screen flex-col bg-background">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground h-8 w-8">
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
                        <Button variant="outline" size="sm" onClick={onBack}
                            className="border-border text-muted-foreground hover:text-foreground text-xs">
                            <ArrowLeft className="mr-1.5 h-3 w-3" /> Ubah Sheet
                        </Button>
                        <Button size="sm" onClick={onSave} disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                            {saving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                            Simpan
                        </Button>
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onEdgesDelete={onEdgesDelete}
                        onSelectionChange={onSelectionChange}
                        onNodeDragStop={onNodeDragStop}
                        onEdgeClick={onEdgeClick}
                        onPaneClick={onPaneClick}
                        deleteKeyCode={["Backspace", "Delete"]}
                        edgesFocusable={true}
                        selectNodesOnDrag={false}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.3 }}
                        connectionLineStyle={{ stroke: "#6366f1", strokeWidth: 2 }}
                        defaultEdgeOptions={{
                            animated: true,
                            interactionWidth: 20,
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
                            <Panel position="top-center" className="!mt-3">
                                <button
                                    onClick={onDeleteSelectedEdges}
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

                <AddSpreadsheetDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdded={onAdded} />
            </div>
        </TooltipProvider>
    );
}
