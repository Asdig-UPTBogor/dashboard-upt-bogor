"use client";

/**
 * DashboardDataClient — Premium orchestrator.
 *
 * Layout:
 *   ┌─ Explorer (300px, animated) ─┬─ Grid (flex-1) ──────────────────┐
 *   │ 📂 Folders & sheets          │  Data grid with all columns      │
 *   └──────────────────────────────┴──────────────────────────────────┘
 *
 * - Smooth slide transition for explorer panel
 * - Premium empty state with visual hierarchy
 * - Explorer auto-hides on sheet selection
 * - [📂] toggle re-shows explorer as side panel alongside grid
 */

import { useState, useCallback } from "react";
import { SpreadsheetExplorer } from "./SpreadsheetExplorer";
import type { SpreadsheetInfo, SheetInfo } from "./SpreadsheetExplorer";
import { MasterDataGrid } from "../../master-data/_components/MasterDataGrid";
import {
    FileSpreadsheet, Table2, ArrowRight,
    Database, Layers, Grid3X3,
} from "lucide-react";

interface SelectedSheet {
    spreadsheet: SpreadsheetInfo;
    sheet: SheetInfo;
}

export function DashboardDataClient() {
    const [selected, setSelected] = useState<SelectedSheet | null>(null);
    const [explorerOpen, setExplorerOpen] = useState(true);

    const handleSelect = useCallback((spreadsheet: SpreadsheetInfo, sheet: SheetInfo) => {
        setSelected({ spreadsheet, sheet });
        setExplorerOpen(false);
    }, []);

    const handleOpenExplorer = useCallback(() => {
        setExplorerOpen(true);
    }, []);

    const handleCloseExplorer = useCallback(() => {
        setExplorerOpen(false);
    }, []);

    return (
        <div className="h-full flex overflow-hidden rounded-xl border border-slate-700/30 bg-slate-900/30">
            {/* ── Explorer Side Panel (animated) ── */}
            <div
                className="h-full shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
                style={{ width: explorerOpen ? 300 : 0 }}
            >
                <SpreadsheetExplorer
                    onSelect={handleSelect}
                    onClose={handleCloseExplorer}
                    activeSpreadsheetId={selected?.spreadsheet.id}
                    activeSheetName={selected?.sheet.sheetName}
                />
            </div>

            {/* ── Main Area ── */}
            <div className="flex-1 min-w-0 flex flex-col">
                {selected ? (
                    /* Grid view — sheet selected */
                    <MasterDataGrid
                        spreadsheetId={selected.spreadsheet.spreadsheetId}
                        spreadsheetTitle={selected.spreadsheet.title}
                        initialSheetName={selected.sheet.sheetName}
                        onOpenExplorer={!explorerOpen ? handleOpenExplorer : undefined}
                    />
                ) : (
                    /* Premium welcome/empty state */
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="max-w-sm text-center">
                            {/* Decorative icon cluster */}
                            <div className="flex justify-center mb-6">
                                <div className="relative">
                                    <div className="absolute -inset-8 rounded-full bg-linear-to-br from-blue-500/5 via-cyan-500/5 to-purple-500/5 blur-2xl" />
                                    <div className="relative flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/40 shadow-lg -rotate-6">
                                            <Database className="h-4.5 w-4.5 text-emerald-400/50" />
                                        </div>
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 shadow-xl shadow-blue-500/5">
                                            <Table2 className="h-6 w-6 text-blue-400" />
                                        </div>
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/40 shadow-lg rotate-6">
                                            <Layers className="h-4.5 w-4.5 text-purple-400/50" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-base font-semibold text-slate-200 mb-2">
                                Pilih Sheet dari Explorer
                            </h3>
                            <p className="text-[12px] text-slate-500 leading-relaxed mb-6">
                                Buka folder spreadsheet di panel kiri, lalu klik sheet
                                untuk menampilkan data di sini.
                            </p>

                            {/* Quick tips */}
                            <div className="space-y-2 text-left mb-6">
                                {[
                                    { icon: Grid3X3, text: "Semua kolom & data ditampilkan" },
                                    { icon: FileSpreadsheet, text: "Klik ikon folder di toolbar untuk buka explorer" },
                                    { icon: ArrowRight, text: "Pindah sheet langsung dari tab di grid" },
                                ].map(({ icon: Icon, text }, i) => (
                                    <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/20">
                                        <Icon className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                        <span className="text-xs text-slate-500">{text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Open explorer button (shown when explorer is closed) */}
                            {!explorerOpen && (
                                <button
                                    onClick={handleOpenExplorer}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-blue-400 text-[12px] font-medium hover:from-blue-500/15 hover:to-cyan-500/15 hover:border-blue-500/30 transition-all duration-200 shadow-lg shadow-blue-500/5"
                                >
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    Buka Explorer
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
