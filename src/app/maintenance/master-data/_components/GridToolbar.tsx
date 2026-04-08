"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Loader2, Search, Plus, Save, CheckCircle2, ExternalLink,
    CheckCircle, Table2, FileSpreadsheet,
    ZoomIn, ZoomOut, Columns, Eye, EyeOff, Link2, BarChart3, ShieldAlert
} from "lucide-react";

export interface GridToolbarProps {
    spreadsheetTitle?: string;
    currentSheet: any;
    onOpenExplorer?: () => void;
    // Search
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    // Row actions
    onAddRow: () => void;
    onSave: () => void;
    hasUnsavedChanges: boolean;
    editedCount: number;
    isSaving: boolean;
    isRevalidating: boolean;
    // Zoom
    zoomLevel: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomReset: () => void;
    // Column visibility
    headers: string[];
    hiddenColumns: Set<string>;
    showColumnPanel: boolean;
    setShowColumnPanel: (v: boolean) => void;
    onToggleColumn: (col: string) => void;
    onShowAll: () => void;
    onShowOnlyConfig: () => void;
    // QC
    invalidRowCount: number;
    showQcErrorsOnly: boolean;
    onToggleQcFilter: () => void;
}

export function GridToolbar({
    spreadsheetTitle, currentSheet, onOpenExplorer,
    searchQuery, setSearchQuery,
    onAddRow, onSave, hasUnsavedChanges, editedCount, isSaving, isRevalidating,
    zoomLevel, onZoomIn, onZoomOut, onZoomReset,
    headers, hiddenColumns, showColumnPanel, setShowColumnPanel,
    onToggleColumn, onShowAll, onShowOnlyConfig,
    invalidRowCount, showQcErrorsOnly, onToggleQcFilter,
}: GridToolbarProps) {
    const connected = currentSheet?.columnsConnected || [];
    const lineage: Record<string, string[]> = currentSheet?.columnLineage || {};

    return (
        <div className="flex-none flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-700/50 bg-slate-900/50 min-w-0">
            {/* Left: Sheet info (truncatable) */}
            <div className="flex items-center gap-1.5 min-w-0 shrink">
                {onOpenExplorer && (
                    <button onClick={onOpenExplorer} className="p-1 hover:bg-slate-700/60 rounded transition-colors shrink-0" title="Buka Explorer">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400" />
                    </button>
                )}
                <Table2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-200 truncate">
                    {spreadsheetTitle || currentSheet?.sheetName}
                </span>
                {currentSheet?.spreadsheetId && (
                    <a
                        href={`https://docs.google.com/spreadsheets/d/${currentSheet.spreadsheetId}/edit`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-0.5 hover:bg-slate-700 rounded transition-colors shrink-0"
                    >
                        <ExternalLink className="h-3 w-3 text-slate-500 hover:text-slate-300" />
                    </a>
                )}
                <div className="h-3.5 w-px bg-slate-700 shrink-0" />
                {/* QC Hierarchy Status */}
                {invalidRowCount > 0 ? (
                    <button
                        onClick={onToggleQcFilter}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border shrink-0 transition-colors ${showQcErrorsOnly ? 'bg-red-500/20 border-red-500/40' : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'}`}
                        title={`${invalidRowCount} baris tidak konsisten — klik untuk filter`}
                    >
                        <ShieldAlert className="h-2.5 w-2.5 text-red-400" />
                        <span className="text-xs text-red-400 font-bold tabular-nums">{invalidRowCount}</span>
                    </button>
                ) : (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-medium">OK</span>
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-1" />

            {/* Right: Actions — scrolls internally when space is tight */}
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
                {/* Search */}
                <div className="relative shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                    <Input
                        placeholder="Cari..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-7 h-6 w-[100px] text-xs bg-slate-800/50 border-slate-700/50 rounded focus:w-[140px] transition-all"
                    />
                </div>

                {/* Add row */}
                <Button onClick={onAddRow} variant="ghost" size="sm" className="h-6 text-xs px-1.5 text-slate-400 hover:text-slate-200 shrink-0" title="Tambah Baris">
                    <Plus className="h-3 w-3" />
                </Button>

                {/* Save */}
                <Button
                    onClick={onSave}
                    variant={hasUnsavedChanges ? "default" : "ghost"}
                    size="sm"
                    disabled={!hasUnsavedChanges || isSaving}
                    className={`h-6 text-xs px-1.5 transition-all shrink-0 ${hasUnsavedChanges ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20' : 'text-slate-500'}`}
                    title={hasUnsavedChanges ? `Simpan (${editedCount})` : 'Saved'}
                >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : hasUnsavedChanges ? <Save className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                </Button>

                <div className="h-3.5 w-px bg-slate-700 shrink-0" />

                {/* Zoom */}
                <button onClick={onZoomOut} className="p-0.5 hover:bg-slate-700/60 rounded transition-colors text-slate-400 hover:text-slate-200 shrink-0" title="Zoom Out">
                    <ZoomOut className="h-3 w-3" />
                </button>
                <button onClick={onZoomReset} className="px-1 py-0.5 text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded tabular-nums shrink-0" title="Reset Zoom">
                    {Math.round(zoomLevel * 100)}%
                </button>
                <button onClick={onZoomIn} className="p-0.5 hover:bg-slate-700/60 rounded transition-colors text-slate-400 hover:text-slate-200 shrink-0" title="Zoom In">
                    <ZoomIn className="h-3 w-3" />
                </button>

                <div className="h-3.5 w-px bg-slate-700 shrink-0" />

                {/* Column visibility */}
                <div className="relative shrink-0">
                    <button
                        onClick={() => setShowColumnPanel(!showColumnPanel)}
                        className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-colors ${showColumnPanel ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'}`}
                        title="Kolom"
                    >
                        <Columns className="h-3 w-3" />
                        {hiddenColumns.size > 0 && (
                            <span className="px-1 py-px rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">{hiddenColumns.size}</span>
                        )}
                    </button>

                    {showColumnPanel && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowColumnPanel(false)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-[260px] max-h-[360px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/60 rounded-lg shadow-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/40">
                                    <span className="text-xs font-semibold text-slate-300">Tampilkan Kolom</span>
                                    <div className="flex gap-1">
                                        <button onClick={onShowAll} className="px-2 py-0.5 text-xs rounded bg-slate-700/60 text-slate-300 hover:bg-slate-600/60">Semua</button>
                                        <button onClick={onShowOnlyConfig} className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Hanya Config</button>
                                    </div>
                                </div>
                                <div className="overflow-y-auto max-h-[300px] py-1">
                                    {headers.filter((h: string) => !h.startsWith('_')).map((h: string) => {
                                        const isHier = ["Master ULTG", "Master Gardu Induk", "Master Bay"].includes(h);
                                        const isCfg = connected.includes(h);
                                        const pages = lineage[h] || [];
                                        const isVisible = !hiddenColumns.has(h);
                                        return (
                                            <button key={h} onClick={() => onToggleColumn(h)}
                                                className={`flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-slate-800/60 transition-colors ${isVisible ? '' : 'opacity-50'}`}
                                            >
                                                {isVisible ? <Eye className="h-3 w-3 text-emerald-400 shrink-0" /> : <EyeOff className="h-3 w-3 text-slate-500 shrink-0" />}
                                                <span className={`text-xs truncate flex-1 ${isHier ? 'text-emerald-300' : isCfg ? 'text-blue-200' : 'text-slate-400'}`}>{h}</span>
                                                {isHier && <Link2 className="h-2.5 w-2.5 text-emerald-500/50 shrink-0" />}
                                                {isCfg && !isHier && <BarChart3 className="h-2.5 w-2.5 text-blue-500/50 shrink-0" />}
                                                {pages.length > 0 && <span className="text-xs text-blue-500/60 font-mono shrink-0">{pages.length}p</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {isRevalidating && !isSaving && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
            </div>
        </div>
    );
}
