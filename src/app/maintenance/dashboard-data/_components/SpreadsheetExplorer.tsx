"use client";

/**
 * SpreadsheetExplorer — Premium file-explorer side panel.
 *
 * Visual design:
 * - Glassmorphism panel with subtle gradient border
 * - Animated expand/collapse with smooth transitions
 * - Premium folder/file icons with color coding
 * - Search filter for quick sheet lookup
 * - Elegant hover effects and active states
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    ChevronRight, FileSpreadsheet, Loader2, AlertCircle,
    X, FolderOpen, Folder, Search, Grid3X3, ExternalLink,
    ShieldCheck, ShieldAlert,
} from "lucide-react";
import {
    buildValidSets, getStrictHierarchyColumnsInHeaders, countInvalidRows,
    type HierarchyValidSets,
} from "../../master-data/_components/hierarchy-qc";

/* ── Types ── */
export interface SheetInfo {
    sheetName: string;
    label: string;
    usedBy: string[];
    columnCount: number;
    hierarchyPresent: string[];
}

export interface SpreadsheetInfo {
    id: string;
    spreadsheetId: string;
    title: string;
    sheets: SheetInfo[];
}

interface SpreadsheetExplorerProps {
    onSelect: (spreadsheet: SpreadsheetInfo, sheet: SheetInfo) => void;
    onClose: () => void;
    activeSpreadsheetId?: string;
    activeSheetName?: string;
}

/* ── Color palette for spreadsheet icons ── */
const PALETTE = [
    { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20" },
    { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/20" },
    { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20" },
    { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/20" },
    { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/20" },
];

/* ── Component ── */
export function SpreadsheetExplorer({
    onSelect,
    onClose,
    activeSpreadsheetId,
    activeSheetName,
}: SpreadsheetExplorerProps) {
    const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");

    // ═══ QC State ═══
    const [validSets, setValidSets] = useState<HierarchyValidSets | null>(null);
    /** Map: "spreadsheetId::sheetName" → { total, invalid } */
    const [sheetQc, setSheetQc] = useState<Map<string, { total: number; invalid: number }>>(new Map());
    const [qcLoading, setQcLoading] = useState(false);

    /* ── Fetch spreadsheet tree ── */
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetch("/api/spreadsheet-list")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data: SpreadsheetInfo[]) => {
                if (cancelled) return;
                setSpreadsheets(data);
                const initial = new Set<string>();
                if (activeSpreadsheetId) {
                    initial.add(activeSpreadsheetId);
                } else if (data.length <= 3) {
                    data.forEach((ss) => initial.add(ss.id));
                }
                setExpanded(initial);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [activeSpreadsheetId]);

    /* ── Fetch hierarchy master data for QC ── */
    useEffect(() => {
        if (spreadsheets.length === 0) return;
        const hierarchySS = spreadsheets.find(ss => ss.title?.includes("MASTER HIERARCHY"));
        if (!hierarchySS) return;

        fetch(`/api/spreadsheet-data?spreadsheetId=${encodeURIComponent(hierarchySS.spreadsheetId)}`)
            .then(res => res.json())
            .then(data => {
                if (data?.sheets) {
                    const sets = buildValidSets(data.sheets);
                    setValidSets(sets);
                }
            })
            .catch(() => { });
    }, [spreadsheets]);

    /* ── Run QC on ALL sheets (detect hierarchy columns from actual data) ── */
    useEffect(() => {
        if (!validSets || spreadsheets.length === 0) return;
        // Fetch data for every non-MASTER spreadsheet and scan headers
        const ssToFetch = spreadsheets.filter(ss => !ss.title?.includes("MASTER HIERARCHY"));
        if (ssToFetch.length === 0) return;

        setQcLoading(true);
        const results = new Map<string, { total: number; invalid: number }>();

        Promise.all(
            ssToFetch.map(ss =>
                fetch(`/api/spreadsheet-data?spreadsheetId=${encodeURIComponent(ss.spreadsheetId)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (!data?.sheets) return;
                        for (const sheetData of data.sheets) {
                            if (!sheetData?.rows || sheetData.rows.length === 0) continue;
                            const headers = sheetData.headers || Object.keys(sheetData.rows[0] || {});
                            const hierCols = getStrictHierarchyColumnsInHeaders(headers);
                            if (hierCols.length === 0) continue; // No hierarchy columns → skip
                            const invalid = countInvalidRows(sheetData.rows, hierCols, validSets);
                            results.set(`${ss.spreadsheetId}::${sheetData.sheetName}`, { total: sheetData.rows.length, invalid });
                        }
                    })
                    .catch(() => { })
            )
        ).then(() => {
            setSheetQc(results);
            setQcLoading(false);
            console.log('[QC Explorer]', results.size, 'sheets checked');
        });
    }, [validSets, spreadsheets]);

    /* ── Filter by search ── */
    const filteredSpreadsheets = useMemo(() => {
        if (!searchQuery.trim()) return spreadsheets;
        const q = searchQuery.toLowerCase();
        return spreadsheets
            .map((ss) => ({
                ...ss,
                sheets: ss.sheets.filter(
                    (sh) =>
                        sh.sheetName.toLowerCase().includes(q) ||
                        sh.label.toLowerCase().includes(q) ||
                        ss.title.toLowerCase().includes(q)
                ),
            }))
            .filter((ss) => ss.sheets.length > 0 || ss.title.toLowerCase().includes(q));
    }, [spreadsheets, searchQuery]);

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const totalSheets = spreadsheets.reduce((s, ss) => s + ss.sheets.length, 0);

    return (
        <div
            className="h-full flex flex-col border-r border-slate-700/40 bg-linear-to-b from-slate-900/95 to-slate-900/80 backdrop-blur-sm"
            style={{ width: 300, minWidth: 300 }}
        >
            {/* ── Panel Header ── */}
            <div className="flex-none px-3 py-2.5 border-b border-slate-700/40">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/15">
                            <FileSpreadsheet className="h-3 w-3 text-blue-400" />
                        </div>
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            Explorer
                        </span>
                        <span className="text-xs text-slate-600 font-mono tabular-nums">
                            {spreadsheets.length}/{totalSheets}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-700/60 transition-colors"
                        title="Tutup Explorer"
                    >
                        <X className="h-3 w-3 text-slate-500 hover:text-slate-300" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-600" />
                    <input
                        type="text"
                        placeholder="Cari sheet..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-7 pl-7 pr-2 text-xs bg-slate-800/60 border border-slate-700/40 rounded-md text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                </div>
            </div>

            {/* ── Tree Content ── */}
            <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent">
                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="relative">
                            <div className="absolute -inset-2 rounded-full bg-blue-500/10 blur-lg" />
                            <Loader2 className="relative h-5 w-5 text-blue-400 animate-spin" />
                        </div>
                        <span className="text-xs text-slate-500">Memuat spreadsheet...</span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mx-3 mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div className="flex items-center gap-2 text-red-400 mb-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Error</span>
                        </div>
                        <p className="text-xs text-red-400/70">{error}</p>
                    </div>
                )}

                {/* Empty search */}
                {!loading && !error && filteredSpreadsheets.length === 0 && searchQuery && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
                        <Search className="h-4 w-4" />
                        <span className="text-xs">Tidak ditemukan "{searchQuery}"</span>
                    </div>
                )}

                {/* Tree */}
                {!loading && filteredSpreadsheets.map((ss, ssIndex) => {
                    const isExpanded = expanded.has(ss.id) || searchQuery.length > 0;
                    const isActiveSpreadsheet = ss.id === activeSpreadsheetId;
                    const color = PALETTE[ssIndex % PALETTE.length];

                    // Compute spreadsheet-level QC
                    let ssTotalErrors = 0;
                    let ssCheckedSheets = 0;
                    let ssCleanSheets = 0;
                    ss.sheets.forEach(sh => {
                        const qc = sheetQc.get(`${ss.spreadsheetId}::${sh.sheetName}`);
                        if (qc) {
                            ssCheckedSheets++;
                            ssTotalErrors += qc.invalid;
                            if (qc.invalid === 0) ssCleanSheets++;
                        }
                    });

                    return (
                        <div key={ss.id} className="mb-0.5">
                            {/* Spreadsheet folder */}
                            <button
                                onClick={() => toggleExpand(ss.id)}
                                className={`w-full flex items-center gap-1.5 px-2.5 py-[6px] text-left transition-all duration-150 group
                                    ${isActiveSpreadsheet
                                        ? "bg-slate-800/60"
                                        : "hover:bg-slate-800/40"
                                    }`}
                            >
                                <ChevronRight
                                    className={`h-3 w-3 text-slate-600 shrink-0 transition-transform duration-200
                                        ${isExpanded ? "rotate-90" : ""}`}
                                />
                                <div className={`flex h-4.5 w-4.5 items-center justify-center rounded ${color.bg} shrink-0`}>
                                    {isExpanded
                                        ? <FolderOpen className={`h-3 w-3 ${color.text}`} />
                                        : <Folder className={`h-3 w-3 ${color.text}`} />
                                    }
                                </div>
                                <span className={`flex-1 text-[11.5px] font-medium truncate transition-colors
                                    ${isActiveSpreadsheet ? "text-slate-200" : "text-slate-400 group-hover:text-slate-300"}`}>
                                    {ss.title.replace(/ - UPT Bogor$/, "")}
                                </span>
                                {/* Spreadsheet badge: sheet count + QC status */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {ssCheckedSheets > 0 && ssTotalErrors > 0 && (
                                        <span
                                            className="flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400"
                                            title={`${ssTotalErrors} baris error di ${ssCheckedSheets - ssCleanSheets} sheet`}
                                        >
                                            <ShieldAlert className="w-2.5 h-2.5" />
                                            {ssTotalErrors}
                                        </span>
                                    )}
                                    {ssCheckedSheets > 0 && ssTotalErrors === 0 && (
                                        <span
                                            className="flex items-center text-xs px-1 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500/50"
                                            title={`${ssCleanSheets} sheet hierarchy OK`}
                                        >
                                            <ShieldCheck className="w-2.5 h-2.5" />
                                        </span>
                                    )}
                                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                                        {ss.sheets.length}
                                    </span>
                                </div>
                            </button>

                            {/* Sheet items — animated */}
                            {isExpanded && (
                                <div className="ml-4 border-l border-slate-800/60">
                                    {ss.sheets.map((sheet) => {
                                        const isSheetActive =
                                            ss.id === activeSpreadsheetId &&
                                            sheet.sheetName === activeSheetName;
                                        const qc = sheetQc.get(`${ss.spreadsheetId}::${sheet.sheetName}`);

                                        return (
                                            <button
                                                key={sheet.sheetName}
                                                onClick={() => onSelect(ss, sheet)}
                                                className={`w-full flex items-center gap-1.5 pl-3 pr-2.5 py-[5px] text-left transition-all duration-150 group/sheet
                                                    ${isSheetActive
                                                        ? "bg-blue-500/10 border-l-2 border-blue-400 -ml-px"
                                                        : "hover:bg-slate-800/40 border-l-2 border-transparent -ml-px hover:border-slate-600"
                                                    }`}
                                            >
                                                <Grid3X3 className={`h-3 w-3 shrink-0 transition-colors
                                                    ${isSheetActive ? "text-blue-400" : "text-slate-700 group-hover/sheet:text-slate-500"}`}
                                                />
                                                <span className={`flex-1 text-xs truncate transition-colors
                                                    ${isSheetActive
                                                        ? "text-blue-300 font-medium"
                                                        : "text-slate-500 group-hover/sheet:text-slate-300"
                                                    }`}>
                                                    {sheet.sheetName}
                                                </span>
                                                {/* Right side: QC + page info */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {/* QC indicator */}
                                                    {qc && qc.invalid > 0 && (
                                                        <span
                                                            className="flex items-center gap-0.5 text-xs font-mono px-1 py-0.5 rounded bg-red-500/15 text-red-400"
                                                            title={`${qc.invalid} dari ${qc.total} baris bermasalah hierarchy`}
                                                        >
                                                            <ShieldAlert className="w-2.5 h-2.5" />
                                                            {qc.invalid}/{qc.total}
                                                        </span>
                                                    )}
                                                    {qc && qc.invalid === 0 && (
                                                        <span
                                                            className="flex items-center gap-0.5 text-xs px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500/50"
                                                            title={`${qc.total} baris — hierarchy OK`}
                                                        >
                                                            <ShieldCheck className="w-2.5 h-2.5" />
                                                            {qc.total}
                                                        </span>
                                                    )}
                                                    {/* Page usage */}
                                                    {sheet.usedBy.length > 0 && (
                                                        <span className={`text-xs font-mono px-1 py-0.5 rounded transition-colors
                                                            ${isSheetActive
                                                                ? "bg-blue-500/10 text-blue-400/60"
                                                                : "bg-slate-800/40 text-slate-600"
                                                            }`}>
                                                            {sheet.usedBy.length}p
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Footer with QC summary ── */}
            {!loading && spreadsheets.length > 0 && (
                <div className="flex-none flex items-center justify-between px-3 py-2 border-t border-slate-700/40 bg-slate-900/50">
                    <span className="text-xs text-slate-600 font-mono tabular-nums">
                        {spreadsheets.length} spreadsheet · {totalSheets} sheet
                    </span>
                    {sheetQc.size > 0 && (() => {
                        let totalErr = 0;
                        sheetQc.forEach(qc => totalErr += qc.invalid);
                        return totalErr > 0
                            ? <span className="text-xs font-mono text-red-400/70">{totalErr} error</span>
                            : <span className="text-xs font-mono text-emerald-500/50">QC OK</span>;
                    })()}
                    {qcLoading && <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />}
                </div>
            )}
        </div>
    );
}
