"use client";

import { useMemo } from "react";
import {
    FileSpreadsheet, ChevronRight, ChevronDown,
    Search, X, ArrowLeft, Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CanvasSheet } from "../_lib/types";

interface StepSheetPickProps {
    pageLabel: string;
    selectedPage: string | null;
    pickerSheets: CanvasSheet[];
    selectedSheetIds: Set<string>;
    pickerLoading: boolean;
    pickerSearch: string;
    expandedSpreadsheets: Set<string>;
    onBack: () => void;
    onProceedToCanvas: () => void;
    onToggleSheet: (sheetId: string) => void;
    onToggleSpreadsheet: (spreadsheetId: string) => void;
    onSelectAllSheetsInSpreadsheet: (spreadsheetId: string, selected: boolean) => void;
    onSetPickerSearch: (search: string) => void;
    onResetSelection: () => void;
}

export function StepSheetPick({
    pageLabel,
    selectedPage,
    pickerSheets,
    selectedSheetIds,
    pickerLoading,
    pickerSearch,
    expandedSpreadsheets,
    onBack,
    onProceedToCanvas,
    onToggleSheet,
    onToggleSpreadsheet,
    onSelectAllSheetsInSpreadsheet,
    onSetPickerSearch,
    onResetSelection,
}: StepSheetPickProps) {

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

    return (
        <div className="flex h-screen flex-col bg-background">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                        <FileSpreadsheet className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-foreground">{pageLabel}</h1>
                        <p className="text-xs text-muted-foreground">Step 2 — Pilih spreadsheet &amp; sheet yang digunakan halaman ini</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={onProceedToCanvas}
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
                        onChange={(e) => onSetPickerSearch(e.target.value)}
                        placeholder="Cari sheet atau spreadsheet..."
                        className="pl-9 bg-muted/30 border-border h-9 text-sm text-foreground/80"
                    />
                    {pickerSearch && (
                        <button onClick={() => onSetPickerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-3 w-3 text-muted-foreground/60" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground/60">{selectedSheetIds.size} sheet dipilih</span>
                    {selectedSheetIds.size > 0 && (
                        <button onClick={onResetSelection} className="text-xs text-red-400 hover:text-red-300">
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
                                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20" onClick={() => onToggleSpreadsheet(spreadsheetId)}>
                                        <ChevronDown className={`h-4 w-4 text-muted-foreground/60 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                                        <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{title}</p>
                                            <p className="text-xs text-muted-foreground/60">{sheets.length} sheet · {selectedCount} dipilih</p>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onSelectAllSheetsInSpreadsheet(spreadsheetId, !allSelected); }}
                                            className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${allSelected
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
                                                        onClick={() => onToggleSheet(sheet.id)}
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
                                                            <p className="text-xs text-muted-foreground/60">
                                                                {sheet.columns.length} kolom
                                                                {hasHier && (
                                                                    <span className="text-emerald-500 ml-2">
                                                                        · hierarchy: {sheet.hierarchyColumns.join(", ")}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        {isSelected && (
                                                            <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/20 text-xs">
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
                <div className="text-xs text-muted-foreground/60">
                    <span className="text-indigo-400 font-medium">{selectedPage}</span>
                    <span className="mx-2">·</span>
                    <span>{selectedSheetIds.size} sheet dipilih dari {pickerSheets.length} total</span>
                </div>
                <Button
                    size="sm"
                    onClick={onProceedToCanvas}
                    disabled={selectedSheetIds.size === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
                >
                    Lanjut ke Canvas <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
