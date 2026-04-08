"use client";

import { useMemo, useState } from "react";
import {
    ChevronDown, FileSpreadsheet, ExternalLink,
    Loader2, ArrowRight, Layers, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAllPages } from "@/lib/sidebar-config";
import type { RegistryEntry, ExploreSheet, DeleteTarget } from "../_types";

/**
 * RegisteredSpreadsheets — 3-level drill-down explorer.
 *
 * Level 1: Click panel header → expand/collapse section
 * Level 2: Click spreadsheet → fetch ALL sheets from Google Sheets API
 * Level 3: Click sheet → show column headers
 *
 * Sheets from the API are cross-referenced with registry
 * to show link status (linked, registered-but-unlinked, unregistered).
 */
export function RegisteredSpreadsheets({ entries, onDelete }: { entries: RegistryEntry[]; onDelete?: (target: DeleteTarget) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [expandedSpreadsheet, setExpandedSpreadsheet] = useState<string | null>(null);
    const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
    const [exploreData, setExploreData] = useState<Record<string, ExploreSheet[]>>({});
    const [exploring, setExploring] = useState<string | null>(null);
    const allPages = useMemo(() => getAllPages(), []);

    const getPageLabel = (path: string) => allPages.find((p) => p.path === path)?.label || path;

    // Only show spreadsheets that have at least one sheet linked to a page.
    // Fully-unused spreadsheets are managed by the UnusedSpreadsheets component.
    const activeEntries = entries.filter((e) => e.sheets.some((sh) => sh.usedBy.length > 0));

    const totalSheets = activeEntries.reduce((s, e) => s + e.sheets.length, 0);
    const linkedSheets = activeEntries.reduce((s, e) => s + e.sheets.filter((sh) => sh.usedBy.length > 0).length, 0);

    const toggleSpreadsheet = async (spreadsheetId: string) => {
        if (expandedSpreadsheet === spreadsheetId) {
            setExpandedSpreadsheet(null);
            setExpandedSheet(null);
            return;
        }
        setExpandedSpreadsheet(spreadsheetId);
        setExpandedSheet(null);
        if (!exploreData[spreadsheetId]) {
            setExploring(spreadsheetId);
            try {
                const res = await fetch(`/api/data-sources?explore=${spreadsheetId}`);
                const json = await res.json();
                if (json.success) {
                    setExploreData((prev) => ({ ...prev, [spreadsheetId]: json.sheets }));
                }
            } catch { /* ignore */ }
            finally { setExploring(null); }
        }
    };

    const toggleSheet = (key: string) => {
        setExpandedSheet((prev) => (prev === key ? null : key));
    };

    return (
        <Collapsible open={expanded} onOpenChange={setExpanded} className="mb-4">
            <Card className="border-border bg-muted/30 overflow-hidden p-0 gap-0">
                <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-white/[0.04] rounded-xl">
                        <div className="flex items-center gap-3">
                            {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300" /> : <ChevronDown className="h-5 w-5 text-muted-foreground -rotate-90 transition-transform duration-300" />}
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                                <Layers className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-foreground/80">Registered Spreadsheets</h2>
                                <p className="text-xs text-muted-foreground/60">
                                    {activeEntries.length} spreadsheet · {linkedSheets}/{totalSheets} sheet linked
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className={linkedSheets === totalSheets ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400" : "border-amber-500/30 bg-amber-500/15 text-amber-400"}>
                            {linkedSheets === totalSheets ? "All Linked" : `${totalSheets - linkedSheets} Available`}
                        </Badge>
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="border-t border-border/50 divide-y divide-white/[0.04]">
                        {activeEntries.map((entry) => {
                            const isOpen = expandedSpreadsheet === entry.spreadsheetId;
                            const sheets = exploreData[entry.spreadsheetId];
                            const isLoading = exploring === entry.spreadsheetId;
                            return (
                                <div key={entry.spreadsheetId}>
                                    {/* Spreadsheet header */}
                                    <div
                                        className="flex items-center gap-3 bg-white/[0.015] px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                        onClick={() => toggleSpreadsheet(entry.spreadsheetId)}
                                    >
                                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300" /> : <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90 transition-transform duration-300" />}
                                        <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                        <span className="text-sm font-medium text-foreground flex-1">{entry.title}</span>
                                        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
                                        <span className="text-xs text-muted-foreground">
                                            {entry.sheets.length} sheet terdaftar
                                        </span>
                                        <a href={`https://docs.google.com/spreadsheets/d/${entry.spreadsheetId}`} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                                            onClick={(e) => e.stopPropagation()}>
                                            <ExternalLink className="h-3 w-3" /> Buka
                                        </a>
                                        {onDelete && (() => {
                                            const allUnlinked = entry.sheets.every(sh => sh.usedBy.length === 0);
                                            return (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            className={`ml-1 rounded p-1 transition-colors ${allUnlinked
                                                                ? "text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10"
                                                                : "text-muted-foreground/40 cursor-not-allowed opacity-40"
                                                                }`}
                                                            disabled={!allUnlinked}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (allUnlinked) {
                                                                    onDelete({
                                                                        type: "spreadsheet",
                                                                        id: entry.spreadsheetId,
                                                                        title: entry.title,
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-popover border-border text-foreground">
                                                        {allUnlinked ? "Hapus spreadsheet dari registry" : "Lepas semua sheet dari halaman dulu"}
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })()}
                                    </div>

                                    {/* Level 2: Sheets */}
                                    {isOpen && (
                                        <div className="bg-white/[0.01]">
                                            {isLoading && !sheets && (
                                                <div className="flex items-center gap-2 px-8 py-3 text-xs text-muted-foreground">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching sheets from Google...
                                                </div>
                                            )}
                                            {sheets && sheets.map((sheet) => {
                                                const sheetKey = `${entry.spreadsheetId}::${sheet.name}`;
                                                const isSheetOpen = expandedSheet === sheetKey;
                                                return (
                                                    <div key={sheet.name}>
                                                        <div
                                                            className="flex items-center gap-3 px-8 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                                                            onClick={() => toggleSheet(sheetKey)}
                                                        >
                                                            {isSheetOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-300" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 -rotate-90 transition-transform duration-300" />}
                                                            <span className="text-sm text-foreground/80 flex-1 font-mono text-xs">{sheet.name}</span>
                                                            <span className="text-xs text-muted-foreground/60">{sheet.rowCount.toLocaleString()} rows · {sheet.colCount} cols</span>
                                                            {sheet.registered ? (
                                                                sheet.usedBy.length > 0 ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                                                                        {sheet.usedBy.map((p: string) => (
                                                                            <Badge key={p} variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs">
                                                                                {getPageLabel(p)}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs">
                                                                            Terdaftar · belum linked
                                                                        </Badge>
                                                                        {onDelete && (
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <button
                                                                                        className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-red-400 hover:bg-red-500/10"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onDelete({
                                                                                                type: "sheet",
                                                                                                id: entry.spreadsheetId,
                                                                                                title: entry.title,
                                                                                                sheetName: sheet.name,
                                                                                            });
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent className="bg-popover border-border text-foreground">Hapus sheet dari registry</TooltipContent>
                                                                            </Tooltip>
                                                                        )}
                                                                    </div>
                                                                )
                                                            ) : (
                                                                <Badge variant="outline" className="border-border bg-muted/40 text-muted-foreground/60 text-xs">
                                                                    Belum terdaftar
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {/* Level 3: Columns */}
                                                        {isSheetOpen && (
                                                            <div className="px-14 pb-3 pt-1">
                                                                {sheet.headers.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {sheet.headers.map((col: string, i: number) => (
                                                                            <Badge key={i} variant="outline" className="border-border bg-white/[0.04] text-muted-foreground font-mono text-xs">
                                                                                {col}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground/60 italic">Sheet kosong atau tidak ada header</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
