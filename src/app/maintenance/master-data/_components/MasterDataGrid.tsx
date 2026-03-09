"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePageData } from "@/hooks/usePageData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Loader2, Search, AlertTriangle, Filter, Hash, X,
    ChevronDown, Link2, BarChart3, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import 'react-data-grid/lib/styles.css';
import { DataGrid, type Column, type FillEvent, type RenderEditCellProps } from 'react-data-grid';

/* ── Split modules ── */
import { type EditableRow, getUltgColor, getColumnWidth, colLetter } from './grid-helpers';
import { ColumnDropdownMenu } from './ColumnDropdownMenu';
import { GridToolbar } from './GridToolbar';
import { GridStyles } from './GridStyles';
import {
    buildValidSets, resolveHierarchyColumn, validateHierarchyCell,
    getHierarchyColumnsInHeaders, countInvalidRows,
    type HierarchyValidSets,
} from './hierarchy-qc';

/* ══════════════════════════════════════════════════════════════════════
   INLINE EDITORS
   ══════════════════════════════════════════════════════════════════════ */
function TextEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<EditableRow>) {
    return (
        <input
            autoFocus
            className="w-full h-full border-2 border-blue-500 bg-blue-950/90 text-white px-1.5 outline-none text-[12px]"
            value={(row.data[column.key] as string) || ''}
            onChange={(e) => onRowChange({ ...row, data: { ...row.data, [column.key]: e.target.value } })}
            onBlur={() => onClose(true, false)}
            onKeyDown={(e) => { if (e.key === 'Enter') onClose(true, false); }}
        />
    );
}

function DropdownEditor({ row, column, onRowChange, onClose, options }: RenderEditCellProps<EditableRow> & { options: string[] }) {
    const cellRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const [highlight, setHighlight] = useState(() => {
        const cur = (row.data[column.key] as string) || "";
        const idx = options.indexOf(cur);
        return idx >= 0 ? idx : 0;
    });
    const currentVal = (row.data[column.key] as string) || "";

    // Position list below cell
    useEffect(() => {
        if (cellRef.current) {
            const rect = cellRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 200) });
        }
    }, []);

    // Scroll highlighted item into view
    useEffect(() => {
        if (listRef.current) {
            const el = listRef.current.children[highlight] as HTMLElement;
            el?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlight]);

    const select = (val: string) => {
        onRowChange({ ...row, data: { ...row.data, [column.key]: val } }, true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, options.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); select(options[highlight]); }
        else if (e.key === 'Escape') { onClose(true, false); }
    };

    return (
        <>
            {/* Cell — matches view-mode renderCell exactly */}
            <div ref={cellRef} className="flex items-center w-full h-full px-2 text-[13px] cursor-pointer" tabIndex={0} onKeyDown={handleKeyDown}>
                <span className="truncate flex-1">{currentVal}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
            </div>
            {/* Portal dropdown list */}
            {pos && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => onClose(true, false)} />
                    <div
                        ref={listRef}
                        className="fixed z-[9999] border border-border bg-popover text-popover-foreground rounded-md shadow-lg overflow-y-auto py-0.5"
                        style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 240 }}
                    >
                        {options.map((opt, i) => (
                            <div
                                key={opt}
                                onMouseEnter={() => setHighlight(i)}
                                onClick={() => select(opt)}
                                className={`px-3 py-1.5 text-[13px] cursor-pointer flex items-center gap-2 transition-colors ${i === highlight ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                                    } ${opt === currentVal ? 'font-medium !text-foreground' : ''}`}
                            >
                                <span className="w-3 shrink-0 text-[10px] text-primary">{opt === currentVal ? '✓' : ''}</span>
                                {opt}
                            </div>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </>
    );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
interface MasterDataGridProps {
    /** If provided, fetch data for this specific spreadsheet instead of page config */
    spreadsheetId?: string;
    /** Spreadsheet title for display */
    spreadsheetTitle?: string;
    /** Which sheet to open initially */
    initialSheetName?: string;
    /** Callback to open the spreadsheet explorer */
    onOpenExplorer?: () => void;
}

export function MasterDataGrid({
    spreadsheetId: propSpreadsheetId,
    spreadsheetTitle,
    initialSheetName,
    onOpenExplorer,
}: MasterDataGridProps = {}) {
    /* ── Data fetching: dual mode ── */
    // Mode A: Legacy — usePageData for /maintenance/master-data
    const pageData = usePageData("/maintenance/master-data", { enabled: !propSpreadsheetId });

    // Mode B: Spreadsheet-specific — fetch from /api/spreadsheet-data
    const [ssSheets, setSsSheets] = useState<any[]>([]);
    const [ssLoading, setSsLoading] = useState(false);
    const [ssRevalidating, setSsRevalidating] = useState(false);

    useEffect(() => {
        if (!propSpreadsheetId) return;
        let cancelled = false;
        setSsLoading(true);

        fetch(`/api/spreadsheet-data?spreadsheetId=${encodeURIComponent(propSpreadsheetId)}`)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setSsSheets(data.sheets || []);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("[DashboardData] Fetch error:", err);
                setSsSheets([]);
            })
            .finally(() => {
                if (!cancelled) setSsLoading(false);
            });

        return () => { cancelled = true; };
    }, [propSpreadsheetId]);

    // Unified: pick the right data source
    const sheets = propSpreadsheetId ? ssSheets : pageData.sheets;
    const loading = propSpreadsheetId ? ssLoading : pageData.loading;
    const isRevalidating = propSpreadsheetId ? ssRevalidating : pageData.isRevalidating;

    // Tab state — auto-select initialSheetName if provided
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    useEffect(() => {
        if (initialSheetName && sheets.length > 0) {
            const idx = sheets.findIndex((s: any) => s.sheetName === initialSheetName);
            if (idx >= 0) setActiveTabIndex(idx);
        }
    }, [initialSheetName, sheets]);

    const currentSheet = useMemo(() => sheets[activeTabIndex] || sheets[0], [sheets, activeTabIndex]);
    const rawData = useMemo(() => currentSheet?.rows || [], [currentSheet]);
    // Reorder headers to follow columnsConnected order (from page config columnsUsed)
    const headers = useMemo(() => {
        const apiHeaders = currentSheet?.headers || [];
        const connected = (currentSheet as any)?.columnsConnected;
        if (!connected || connected.length === 0) return apiHeaders;
        const ordered = connected.filter((c: string) => apiHeaders.includes(c));
        const rest = apiHeaders.filter((h: string) => !connected.includes(h));
        return [...ordered, ...rest];
    }, [currentSheet]);

    // ═══ HIERARCHY QC — fetch valid values from MASTER HIERARCHY spreadsheet ═══
    const [hierarchySheets, setHierarchySheets] = useState<any[]>([]);
    useEffect(() => {
        // Find MASTER HIERARCHY spreadsheet ID from registry
        fetch('/api/spreadsheet-list')
            .then(res => res.json())
            .then(data => {
                // API returns array directly OR { spreadsheets: [...] }
                const list = Array.isArray(data) ? data : (data.spreadsheets || []);
                const hierarchySS = list.find((ss: any) =>
                    ss.title?.includes("MASTER HIERARCHY")
                );
                if (!hierarchySS) {
                    console.warn('[QC] MASTER HIERARCHY spreadsheet not found in registry');
                    return;
                }
                console.log('[QC] Loading hierarchy from:', hierarchySS.title);
                // Fetch its sheets data
                return fetch(`/api/spreadsheet-data?spreadsheetId=${encodeURIComponent(hierarchySS.spreadsheetId)}`);
            })
            .then(res => res?.json())
            .then(data => {
                if (data?.sheets) {
                    setHierarchySheets(data.sheets);
                    console.log('[QC] Hierarchy loaded:', data.sheets.length, 'sheets');
                }
            })
            .catch((err) => {
                console.error('[QC] Failed to load hierarchy:', err);
            });
    }, []);

    const validHierarchyValues = useMemo(() => buildValidSets(hierarchySheets), [hierarchySheets]);

    // For cascading edit-dropdowns — look in hierarchySheets first (cross-spreadsheet), fallback to same-spreadsheet
    const masterGISheet = useMemo(() =>
        hierarchySheets.find((s: any) => s.sheetName === "Master Gardu Induk")
        || sheets.find((s: any) => s.sheetName === "Master Gardu Induk"),
        [hierarchySheets, sheets]);
    const masterBaySheet = useMemo(() =>
        hierarchySheets.find((s: any) => s.sheetName === "Master Bay")
        || sheets.find((s: any) => s.sheetName === "Master Bay"),
        [hierarchySheets, sheets]);

    // QC filter state
    const [showQcErrorsOnly, setShowQcErrorsOnly] = useState(false);

    // Grid state
    const [gridData, setGridData] = useState<EditableRow[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Per-column sort & filter
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
    const [openHeaderMenu, setOpenHeaderMenu] = useState<string | null>(null);

    // ═══ ZOOM ═══
    const ZOOM_STEPS = [0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.3, 1.5];
    const [zoomLevel, setZoomLevel] = useState<number>(() => {
        try { return parseFloat(localStorage.getItem('grid-zoom') || '1') || 1; } catch { return 1; }
    });
    const zoomIn = useCallback(() => {
        setZoomLevel(prev => {
            const idx = ZOOM_STEPS.findIndex(z => z >= prev);
            const next = ZOOM_STEPS[Math.min(idx + 1, ZOOM_STEPS.length - 1)];
            try { localStorage.setItem('grid-zoom', String(next)); } catch { }
            return next;
        });
    }, []);
    const zoomOut = useCallback(() => {
        setZoomLevel(prev => {
            const idx = ZOOM_STEPS.findIndex(z => z >= prev);
            const next = ZOOM_STEPS[Math.max(idx - 1, 0)];
            try { localStorage.setItem('grid-zoom', String(next)); } catch { }
            return next;
        });
    }, []);
    const zoomReset = useCallback(() => {
        setZoomLevel(1);
        try { localStorage.setItem('grid-zoom', '1'); } catch { }
    }, []);

    // ═══ COLUMN VISIBILITY ═══
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('grid-hidden-cols');
            return saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set<string>();
        } catch { return new Set(); }
    });
    const [showColumnPanel, setShowColumnPanel] = useState(false);
    const toggleColumnVisibility = useCallback((col: string) => {
        setHiddenColumns(prev => {
            const next = new Set(prev);
            if (next.has(col)) next.delete(col);
            else next.add(col);
            try { localStorage.setItem('grid-hidden-cols', JSON.stringify([...next])); } catch { }
            return next;
        });
    }, []);
    const showAllColumns = useCallback(() => {
        setHiddenColumns(new Set());
        try { localStorage.setItem('grid-hidden-cols', '[]'); } catch { }
    }, []);
    const showOnlyConfig = useCallback(() => {
        const connected = (currentSheet as any)?.columnsConnected || [];
        const hierarchyCols = ["Master ULTG", "Master Gardu Induk", "Master Bay"];
        const toHide = new Set<string>(headers.filter((h: string) => !connected.includes(h) && !hierarchyCols.includes(h) && !h.startsWith('_')));
        setHiddenColumns(toHide);
        try { localStorage.setItem('grid-hidden-cols', JSON.stringify([...toHide])); } catch { }
    }, [currentSheet, headers]);

    // Persistent column widths: { "sheetKey::colName": width }
    const colWidthsRef = useRef<Record<string, number>>({});
    const sheetKey = `${currentSheet?.spreadsheetId}::${currentSheet?.sheetName}`;

    // Load saved widths from localStorage once
    useEffect(() => {
        try {
            const saved = localStorage.getItem('master-data-col-widths');
            if (saved) colWidthsRef.current = JSON.parse(saved);
        } catch { }
    }, []);

    const handleColumnResize = useCallback((column: any, width: number) => {
        const key = `${sheetKey}::${column.key}`;
        colWidthsRef.current[key] = width;
        try {
            localStorage.setItem('master-data-col-widths', JSON.stringify(colWidthsRef.current));
        } catch { }
    }, [sheetKey]);

    // ═══ PAGE-LEVEL CASCADING FILTERS ═══
    const [filterULTG, setFilterULTG] = useState<string>("__all__");
    const [filterGI, setFilterGI] = useState<string>("__all__");
    const [filterBay, setFilterBay] = useState<string>("__all__");

    // Get unique values from grid data for filter dropdowns
    const ultgOptions = useMemo(() => {
        const vals = new Set<string>();
        gridData.forEach(r => {
            const v = r.data["Master ULTG"]?.trim();
            if (v) vals.add(v);
        });
        return Array.from(vals).sort();
    }, [gridData]);

    const giOptions = useMemo(() => {
        let data = gridData;
        if (filterULTG !== "__all__") {
            data = data.filter(r => r.data["Master ULTG"]?.trim() === filterULTG);
        }
        const vals = new Set<string>();
        data.forEach(r => {
            const v = r.data["Master Gardu Induk"]?.trim();
            if (v) vals.add(v);
        });
        return Array.from(vals).sort();
    }, [gridData, filterULTG]);

    const bayOptions = useMemo(() => {
        let data = gridData;
        if (filterULTG !== "__all__") data = data.filter(r => r.data["Master ULTG"]?.trim() === filterULTG);
        if (filterGI !== "__all__") data = data.filter(r => r.data["Master Gardu Induk"]?.trim() === filterGI);
        const vals = new Set<string>();
        data.forEach(r => {
            const v = r.data["Master Bay"]?.trim();
            if (v) vals.add(v);
        });
        return Array.from(vals).sort();
    }, [gridData, filterULTG, filterGI]);

    // Which hierarchy columns exist in current sheet
    const hasULTG = headers.includes("Master ULTG");
    const hasGI = headers.includes("Master Gardu Induk");
    const hasBay = headers.includes("Master Bay");
    const hasAnyFilter = hasULTG || hasGI || hasBay;
    const activeFilterCount = (filterULTG !== "__all__" ? 1 : 0) + (filterGI !== "__all__" ? 1 : 0) + (filterBay !== "__all__" ? 1 : 0);

    // Reset child filters when parent changes
    const handleULTGChange = (val: string) => {
        setFilterULTG(val);
        setFilterGI("__all__");
        setFilterBay("__all__");
    };
    const handleGIChange = (val: string) => {
        setFilterGI(val);
        setFilterBay("__all__");
    };
    const clearAllFilters = () => {
        setFilterULTG("__all__");
        setFilterGI("__all__");
        setFilterBay("__all__");
    };

    const handleDeleteRow = (id: string) => {
        setGridData(prev => prev.filter(r => r.id !== id));
        toast.info("Baris dihapus");
    };

    /* ── Columns ── */
    const columns: Column<EditableRow>[] = useMemo(() => {
        if (!headers || headers.length === 0) return [];
        // Enforce hierarchy-first ordering: Master ULTG → Master Gardu Induk → Master Bay → rest
        const HIERARCHY_ORDER = ["Master ULTG", "Master Gardu Induk", "Master Bay"];
        const filtered = headers.filter((h: string) => !h.startsWith("_") && !hiddenColumns.has(h));
        const hierCols = HIERARCHY_ORDER.filter(h => filtered.includes(h));
        const restCols = filtered.filter((h: string) => !HIERARCHY_ORDER.includes(h));
        const visibleHeaders = [...hierCols, ...restCols];
        // Deduplicate headers — keep first occurrence only (duplicate column names can't work correctly)
        const uniqueHeaders = visibleHeaders.filter((h, i) => visibleHeaders.indexOf(h) === i);

        // Row number column — includes QC health dot
        const rowNumCol: Column<EditableRow> = {
            key: '__rowNum__',
            name: '',
            frozen: true,
            width: 44,
            minWidth: 44,
            maxWidth: 44,
            editable: false,
            headerCellClass: 'rdg-row-num-header',
            cellClass: 'rdg-row-num-cell',
            renderHeaderCell: () => <div className="flex items-center justify-center w-full h-full"><Hash className="w-3 h-3 opacity-40" /></div>,
            renderCell: ({ row, rowIdx }: { row: EditableRow; rowIdx: number }) => {
                // QC check: validate hierarchy columns with chain context (v2)
                const hierCols = getHierarchyColumnsInHeaders(headers);
                let invalidCount = 0;
                let checkedCount = 0;
                const errorMsgs: string[] = [];
                hierCols.forEach(c => {
                    const result = validateHierarchyCell(c, row.data[c], validHierarchyValues, row.data);
                    if (row.data[c]?.toString().trim()) checkedCount++;
                    if (!result.isValid) {
                        invalidCount++;
                        errorMsgs.push(result.message);
                    }
                });
                let dotEl: React.ReactNode = null;
                if (checkedCount > 0 && invalidCount > 0) {
                    dotEl = <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title={errorMsgs.join('\n')} />;
                } else if (checkedCount > 0) {
                    dotEl = <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 shrink-0" />;
                }
                return (
                    <div className="flex items-center justify-center gap-0.5 w-full h-full text-[10px] text-slate-500 font-mono select-none">
                        {dotEl}
                        <span>{rowIdx + 1}</span>
                    </div>
                );
            },
        };

        // Data columns
        const dataCols: Column<EditableRow>[] = uniqueHeaders.map((h: string, idx: number) => {
            let renderEditCell = TextEditor as any;

            // ── Cascading hierarchy dropdowns ──
            if (h === "Master ULTG" && masterGISheet) {
                const opts = Array.from(new Set(masterGISheet.rows.map((r: any) => r["Master ULTG"]).filter(Boolean))) as string[];
                renderEditCell = (props: any) => <DropdownEditor {...props} options={opts.sort()} />;
            }
            if (h === "Master Gardu Induk" && masterGISheet) {
                renderEditCell = (props: any) => {
                    const ultg = props.row.data["Master ULTG"];
                    let gis: string[];
                    if (ultg && validHierarchyValues?.ultgToGI?.has(ultg)) {
                        // Cascade: only GIs under selected ULTG
                        gis = Array.from(validHierarchyValues.ultgToGI.get(ultg)!);
                    } else {
                        // Fallback: all GIs from master
                        gis = masterGISheet.rows.map((r: any) => r["Master Gardu Induk"]).filter(Boolean);
                    }
                    return <DropdownEditor {...props} options={Array.from(new Set(gis)).sort() as string[]} />;
                };
            }
            if (h === "Master Bay" && masterBaySheet) {
                renderEditCell = (props: any) => {
                    const gi = props.row.data["Master Gardu Induk"];
                    let bays: string[];
                    if (gi && validHierarchyValues?.giToBay?.has(gi)) {
                        // Cascade: only Bays under selected GI
                        bays = Array.from(validHierarchyValues.giToBay.get(gi)!);
                    } else {
                        // Fallback: all Bays from master
                        bays = masterBaySheet.rows.map((r: any) => r["Master Bay"]).filter(Boolean);
                    }
                    return <DropdownEditor {...props} options={Array.from(new Set(bays)).sort() as string[]} />;
                };
            }

            const sampleValues = rawData.slice(0, 30).map((r: any) => r[h] || "");

            const isDropdownCol = ["Master ULTG", "Master Gardu Induk", "Master Bay"].includes(h);

            return {
                key: h,
                name: h,
                width: colWidthsRef.current[`${sheetKey}::${h}`] || getColumnWidth(h, sampleValues),
                resizable: true,
                editable: true,
                renderEditCell,

                renderHeaderCell: ({ column: col }: any) => {
                    const colIsSorted = sortColumn === h;
                    const colIsFiltered = columnFilters[h] && columnFilters[h].size > 0;
                    const isMenuOpen = openHeaderMenu === h;

                    // Column classification
                    const connected = (currentSheet as any)?.columnsConnected || [];
                    const lineage: Record<string, string[]> = (currentSheet as any)?.columnLineage || {};
                    const isHierarchy = ["Master ULTG", "Master Gardu Induk", "Master Bay"].includes(h);
                    const isConfig = connected.includes(h);
                    const pagesList = lineage[h] || [];

                    // Color system per feature map
                    let borderColor = "border-l-transparent";
                    let letterColor = "text-slate-500";
                    let nameColor = "text-slate-300";
                    let badgeEl: React.ReactNode = null;

                    if (isHierarchy) {
                        borderColor = "border-l-emerald-500";
                        letterColor = "text-emerald-600";
                        nameColor = "text-emerald-300";
                        badgeEl = <span className="flex items-center px-1 py-px rounded bg-emerald-500/15 shrink-0"><Link2 className="w-2.5 h-2.5 text-emerald-400" /></span>;
                    } else if (isConfig) {
                        borderColor = "border-l-blue-500";
                        letterColor = "text-blue-500";
                        nameColor = "text-blue-200";
                        badgeEl = <span className="flex items-center px-1 py-px rounded bg-blue-500/15 shrink-0"><BarChart3 className="w-2.5 h-2.5 text-blue-400" /></span>;
                    }

                    // Lineage tooltip
                    const tooltipText = pagesList.length > 0
                        ? `Dipakai di: ${pagesList.join(", ")}`
                        : isConfig ? "Kolom terdaftar" : "";

                    // Get unique values for filter
                    const uniqueVals = (() => {
                        const vals = new Set<string>();
                        gridData.forEach(r => {
                            const v = r.data[h]?.trim();
                            if (v) vals.add(v);
                        });
                        return Array.from(vals).sort();
                    })();

                    const currentFilter = columnFilters[h] || new Set<string>();

                    return (
                        <div
                            className={`col-header-menu flex items-center w-full h-full px-1.5 gap-0 leading-tight relative border-l-2 ${borderColor}`}
                            title={tooltipText}
                        >
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <span className={`text-[9px] ${letterColor}`}>{colLetter(idx)}</span>
                                    {pagesList.length > 0 && (
                                        <span className="text-[7px] text-blue-500/50 font-mono">{pagesList.length}p</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={`text-[12px] font-medium truncate ${nameColor}`}>{col.name}</span>
                                    {badgeEl}
                                    {colIsSorted && (
                                        <span className="text-[9px] text-blue-400 shrink-0">
                                            {sortDir === 'asc' ? '▲' : '▼'}
                                        </span>
                                    )}
                                    {colIsFiltered && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                                </div>
                            </div>
                            <button
                                ref={(el) => {
                                    if (!el) return;
                                    el.onclick = (ev) => {
                                        ev.stopPropagation();
                                        ev.preventDefault();
                                        setOpenHeaderMenu(isMenuOpen ? null : h);
                                    };
                                }}
                                className={`shrink-0 p-0.5 rounded transition-colors ${isMenuOpen ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <ChevronDown className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* ═══ Column Menu Dropdown (Portal — rendered at body) ═══ */}
                            {isMenuOpen && (
                                <ColumnDropdownMenu
                                    columnKey={h}
                                    isSorted={colIsSorted}
                                    sortDir={sortDir}
                                    isFiltered={colIsFiltered}
                                    uniqueVals={uniqueVals}
                                    currentFilter={currentFilter}
                                    setSortColumn={setSortColumn}
                                    setSortDir={setSortDir}
                                    setColumnFilters={setColumnFilters}
                                    setOpenHeaderMenu={setOpenHeaderMenu}
                                    headerEl={(() => {
                                        const cells = document.querySelectorAll('.master-grid .rdg-header-row .rdg-cell');
                                        return cells[idx + 1] as HTMLElement | null;
                                    })()}
                                />
                            )}
                        </div>
                    );
                },
                renderCell: ({ row }: { row: EditableRow }) => {
                    const val = row.data[h] || "";
                    if (!val) return <span className="text-slate-600 text-[11px]">—</span>;

                    // ═══ Hierarchy QC v2 — chain validation with row context ═══
                    const qcResult = validateHierarchyCell(h, val, validHierarchyValues, row.data);
                    const isInvalid = !qcResult.isValid;

                    if (h === "Master ULTG") {
                        return (
                            <div className="flex items-center w-full h-full group cursor-pointer">
                                <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${isInvalid ? 'bg-red-500/15 text-red-300 border-red-500/40 ring-1 ring-red-500/30' : getUltgColor(val).badge}`}
                                    title={isInvalid ? `⚠ ${qcResult.message}` : undefined}
                                >
                                    {val}
                                </span>
                                <ChevronDown className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary shrink-0 ml-auto transition-colors" />
                            </div>
                        );
                    }
                    if (h === "Master Gardu Induk" || h === "Master Bay") {
                        return (
                            <div className="flex items-center w-full h-full group cursor-pointer">
                                <span
                                    className={isInvalid
                                        ? 'text-[11px] font-medium text-red-300 bg-red-500/10 px-1 rounded ring-1 ring-red-500/30'
                                        : 'text-[11px] font-medium text-slate-100'
                                    }
                                    title={isInvalid ? `⚠ ${qcResult.message}` : undefined}
                                >
                                    {val}
                                </span>
                                <ChevronDown className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary shrink-0 ml-auto transition-colors" />
                            </div>
                        );
                    }
                    if (h === "Status" || h.includes("Type")) {
                        return (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30">
                                {val}
                            </span>
                        );
                    }
                    return <span className="text-[11px] text-slate-300">{val}</span>;
                },
            };
        });

        // Action column
        const actionCol: Column<EditableRow> = {
            key: '__actions__',
            name: '',
            width: 32,
            minWidth: 32,
            editable: false,
            renderCell: ({ row }: { row: EditableRow }) => {
                if (!row.isNew) return null;
                return (
                    <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10 cursor-pointer flex h-full w-full items-center justify-center"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                );
            }
        } as any;

        return [rowNumCol, ...dataCols, actionCol];
    }, [headers, currentSheet?.sheetName, masterGISheet, masterBaySheet, validHierarchyValues, rawData, sortColumn, sortDir, columnFilters, openHeaderMenu, gridData, hiddenColumns]);

    /* ── Data Sync ── */
    const lastSheetRef = useRef<string | null>(null);
    useEffect(() => {
        if (!loading && rawData.length > 0) {
            setGridData(prev => {
                const key = `${currentSheet?.spreadsheetId}::${currentSheet?.sheetName}`;
                const isSheetChange = lastSheetRef.current !== key;
                if (isSheetChange) {
                    lastSheetRef.current = key;
                    return rawData.map((row: any, idx: number) => ({
                        id: `ssot-${idx}`, isNew: false, isEdited: false, data: { ...row },
                    }));
                }
                if (prev.length === 0) {
                    return rawData.map((row: any, idx: number) => ({
                        id: `ssot-${idx}`, isNew: false, isEdited: false, data: { ...row },
                    }));
                }
                const newRows = prev.filter(r => r.isNew);
                const merged: EditableRow[] = [...newRows];
                rawData.forEach((row: any, idx: number) => {
                    const rowId = `ssot-${idx}`;
                    const existing = prev.find(r => r.id === rowId);
                    if (existing?.isEdited) merged.push(existing);
                    else merged.push({ id: rowId, isNew: false, isEdited: false, data: { ...row } });
                });
                return merged;
            });
        } else if (!loading && rawData.length === 0) {
            setGridData([]);
        }
    }, [rawData, loading, currentSheet?.spreadsheetId, currentSheet?.sheetName]);

    /* ── Handlers ── */
    const handleAddRow = () => {
        const newRowData: Record<string, string> = {};
        headers.forEach((h: string) => { newRowData[h] = ""; });
        setGridData(prev => [...prev, { id: `new-${Date.now()}`, isNew: true, isEdited: true, data: newRowData }]);
        toast.info("Baris baru ditambahkan");
    };

    const handleRowsChange = (newRows: EditableRow[]) => {
        setGridData(prev => newRows.map((newRow, idx) => {
            const oldRow = prev[idx];
            return oldRow && oldRow !== newRow ? { ...newRow, isEdited: true } : newRow;
        }));
    };

    const handleFill = ({ columnKey, sourceRow, targetRow }: FillEvent<EditableRow>): EditableRow => ({
        ...targetRow, isEdited: true,
        data: { ...targetRow.data, [columnKey]: sourceRow.data[columnKey] }
    });

    const handleSave = async () => {
        const modifiedRows = gridData.filter(r => r.isEdited);
        if (modifiedRows.length === 0) return;
        setIsSaving(true);
        try {
            const appends = modifiedRows.filter(r => r.isNew).map(r => ({ data: r.data }));
            const updates = modifiedRows
                .filter(r => !r.isNew && r.data._rowIndex)
                .map(r => ({ _rowIndex: parseInt(r.data._rowIndex), data: r.data }));
            const res = await fetch("/api/write-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    spreadsheetId: currentSheet?.spreadsheetId,
                    sheetName: currentSheet?.sheetName,
                    appends, updates
                })
            });
            if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan");
            setGridData(prev => prev.map(row => ({ ...row, isNew: false, isEdited: false })));
            toast.success(`${modifiedRows.length} baris disinkronisasi`);

            // Post-save: trigger worker refresh → re-fetch cache → QC marks update
            fetch("/api/worker-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "refresh" }),
            }).catch(() => { }); // fire-and-forget
        } catch (error: any) {
            toast.error(error.message || "Gagal menyimpan");
        } finally {
            setIsSaving(false);
        }
    };

    /* ── Filter + Sort ── */
    const filteredGrid = useMemo(() => {
        let data = gridData;

        // Page-level hierarchy filters
        if (filterULTG !== "__all__" && hasULTG) {
            data = data.filter(r => r.data["Master ULTG"]?.trim() === filterULTG);
        }
        if (filterGI !== "__all__" && hasGI) {
            data = data.filter(r => r.data["Master Gardu Induk"]?.trim() === filterGI);
        }
        if (filterBay !== "__all__" && hasBay) {
            data = data.filter(r => r.data["Master Bay"]?.trim() === filterBay);
        }

        // Per-column value filters (from header menus)
        for (const [col, allowedVals] of Object.entries(columnFilters)) {
            if (allowedVals.size > 0) {
                data = data.filter(row => allowedVals.has(row.data[col]?.trim() || ""));
            }
        }

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(row => Object.values(row.data).some(val => String(val || "").toLowerCase().includes(q)));
        }

        // Sort
        if (sortColumn) {
            data = [...data].sort((a, b) => {
                const va = (a.data[sortColumn] || "").toLowerCase();
                const vb = (b.data[sortColumn] || "").toLowerCase();
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            });
        }

        // QC filter — show only rows with hierarchy errors
        if (showQcErrorsOnly) {
            const hierCols = getHierarchyColumnsInHeaders(headers);
            data = data.filter(row => {
                for (const c of hierCols) {
                    const result = validateHierarchyCell(c, row.data[c], validHierarchyValues, row.data);
                    if (!result.isValid) return true;
                }
                return false;
            });
        }

        return data;
    }, [gridData, searchQuery, filterULTG, filterGI, filterBay, hasULTG, hasGI, hasBay, columnFilters, sortColumn, sortDir, showQcErrorsOnly, headers, validHierarchyValues]);

    // QC stats
    const invalidRowCount = useMemo(() => {
        const hierCols = getHierarchyColumnsInHeaders(headers);
        return countInvalidRows(gridData.map(r => r.data), hierCols, validHierarchyValues);
    }, [gridData, headers, validHierarchyValues]);


    const hasUnsavedChanges = useMemo(() => gridData.some(r => r.isEdited), [gridData]);
    const editedCount = useMemo(() => gridData.filter(r => r.isEdited).length, [gridData]);

    /* ── Row class with ULTG color coding ── */
    const rowClass = (row: EditableRow) => {
        if (row.isNew) return "rdg-row-new";
        if (row.isEdited) return "rdg-row-edited";
        const ultg = row.data["Master ULTG"]?.trim()?.toUpperCase();
        if (ultg === "BOGOR") return "rdg-row-ultg-bogor";
        if (ultg === "SUKABUMI") return "rdg-row-ultg-sukabumi";
        return "";
    };

    /* ── Loading states ── */
    if (loading && !sheets.length) {
        return (
            <div className="h-[70vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span className="text-sm">Memuat data spreadsheet...</span>
                </div>
            </div>
        );
    }

    if (!loading && sheets.length === 0) {
        return (
            <div className="h-[70vh] flex items-center justify-center">
                <div className="flex items-center gap-3 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-6 py-4">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-sm">Tidak dapat memuat data dari Google Sheets</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <GridToolbar
                spreadsheetTitle={spreadsheetTitle}
                currentSheet={currentSheet}
                onOpenExplorer={onOpenExplorer}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onAddRow={handleAddRow}
                onSave={handleSave}
                hasUnsavedChanges={hasUnsavedChanges}
                editedCount={editedCount}
                isSaving={isSaving}
                isRevalidating={isRevalidating}
                zoomLevel={zoomLevel}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onZoomReset={zoomReset}
                headers={headers}
                hiddenColumns={hiddenColumns}
                showColumnPanel={showColumnPanel}
                setShowColumnPanel={setShowColumnPanel}
                onToggleColumn={toggleColumnVisibility}
                onShowAll={showAllColumns}
                onShowOnlyConfig={showOnlyConfig}
                invalidRowCount={invalidRowCount}
                showQcErrorsOnly={showQcErrorsOnly}
                onToggleQcFilter={() => setShowQcErrorsOnly(v => !v)}
            />

            {/* ═══ CASCADING FILTER BAR ═══ */}
            {hasAnyFilter && (
                <div className="flex-none flex items-center gap-3 px-3 py-2 border-b border-slate-700/40 bg-slate-800/30">
                    <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="text-[11px] text-slate-500 font-medium shrink-0">Filter:</span>

                    {/* ULTG Filter */}
                    {hasULTG && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500">ULTG</span>
                            <select
                                value={filterULTG}
                                onChange={(e) => handleULTGChange(e.target.value)}
                                className="h-6 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 outline-none focus:border-blue-500/50 cursor-pointer appearance-none pr-5"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                            >
                                <option value="__all__">Semua ({ultgOptions.length})</option>
                                {ultgOptions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                    )}

                    {/* GI Filter */}
                    {hasGI && (
                        <>
                            <span className="text-slate-600 text-[10px]">›</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500">Gardu Induk</span>
                                <select
                                    value={filterGI}
                                    onChange={(e) => handleGIChange(e.target.value)}
                                    className="h-6 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 outline-none focus:border-blue-500/50 cursor-pointer appearance-none pr-5 max-w-[200px]"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                                >
                                    <option value="__all__">Semua ({giOptions.length})</option>
                                    {giOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {/* Bay Filter */}
                    {hasBay && (
                        <>
                            <span className="text-slate-600 text-[10px]">›</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500">Bay</span>
                                <select
                                    value={filterBay}
                                    onChange={(e) => setFilterBay(e.target.value)}
                                    className="h-6 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 outline-none focus:border-blue-500/50 cursor-pointer appearance-none pr-5 max-w-[220px]"
                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                                >
                                    <option value="__all__">Semua ({bayOptions.length})</option>
                                    {bayOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {/* Clear all filters */}
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors text-[10px] text-red-400 ml-1"
                        >
                            <X className="h-2.5 w-2.5" />
                            Clear ({activeFilterCount})
                        </button>
                    )}

                    <div className="flex-1" />

                    {/* Row count after filtering */}
                    <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {filteredGrid.length} / {gridData.length} rows
                    </span>
                </div>
            )}

            {/* ═══ Sheet Tabs ═══ */}
            <div className="flex-none flex items-center border-b border-slate-700/50 bg-slate-900/80 h-8">
                <div className="flex items-center gap-0.5 px-2 overflow-x-auto no-scrollbar">
                    {sheets.map((sheet: any, idx: number) => {
                        // Compute per-tab QC
                        let tabInvalid = 0;
                        const tabRows = sheet.rows || [];
                        if (tabRows.length > 0 && validHierarchyValues) {
                            const tabHeaders = sheet.headers || Object.keys(tabRows[0] || {});
                            const tabHierCols = getHierarchyColumnsInHeaders(tabHeaders);
                            if (tabHierCols.length > 0) {
                                tabInvalid = countInvalidRows(tabRows, tabHierCols, validHierarchyValues);
                            }
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (hasUnsavedChanges && !confirm("Ada perubahan belum disimpan. Pindah tab?")) return;
                                    setActiveTabIndex(idx);
                                    setSearchQuery("");
                                    clearAllFilters();
                                    setSortColumn(null);
                                    setColumnFilters({});
                                    setOpenHeaderMenu(null);
                                }}
                                className={`px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-all border-b-2 ${activeTabIndex === idx
                                    ? tabInvalid > 0
                                        ? "border-red-500 text-red-400 bg-red-500/10"
                                        : "border-blue-500 text-blue-400 bg-blue-500/10"
                                    : tabInvalid > 0
                                        ? "border-transparent text-red-400/70 bg-red-500/5 hover:bg-red-500/10"
                                        : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                                    }`}
                                title={tabInvalid > 0 ? `${tabInvalid} baris bermasalah` : ""}
                            >
                                {sheet.label || sheet.sheetName}
                                {tabInvalid > 0
                                    ? <span className="ml-1.5 text-[9px] text-red-400 font-mono">⚠{tabInvalid}</span>
                                    : <span className="ml-1.5 text-[9px] opacity-60">{sheet.rowCount || 0}</span>
                                }
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══ Spreadsheet Grid ═══ */}
            <div className="flex-1 min-h-0 relative" style={{ zoom: zoomLevel }}>
                <DataGrid
                    columns={columns}
                    rows={filteredGrid}
                    onRowsChange={handleRowsChange}
                    rowKeyGetter={(row: EditableRow) => row.id}
                    rowClass={rowClass}
                    onFill={handleFill}
                    className="h-full master-grid"
                    style={{ height: '100%', border: 'none' }}
                    headerRowHeight={42}
                    rowHeight={28}
                    onColumnResize={handleColumnResize}
                    onCellClick={(args: any) => {
                        // Single-click → edit for dropdown columns (like spreadsheet data validation)
                        const dropdownCols = ["Master ULTG", "Master Gardu Induk", "Master Bay"];
                        if (dropdownCols.includes(args.column.key)) {
                            args.selectCell(true); // true = enter edit mode
                        }
                    }}
                />
                {filteredGrid.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none">
                        <Search className="h-6 w-6 mb-2 opacity-30" />
                        <p className="text-xs">Tidak ada data{activeFilterCount > 0 ? " (coba ubah filter)" : ""}</p>
                    </div>
                )}
            </div>

            <GridStyles />
        </div>
    );
}
