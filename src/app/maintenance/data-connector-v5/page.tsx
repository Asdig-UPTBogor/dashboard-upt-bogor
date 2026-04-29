/**
 * Data Connector V5 — HUB (redesigned sidebar 2026-04-20)
 *
 * Sidebar structure (user-driven):
 *   ACTION BUTTONS (atas)
 *     [+ Add Spreadsheet]
 *     [Master Hierarchy Wizard]
 *
 *   📊 Overview — executive summary system state
 *
 *   📄 Page Data Config — list 41 dashboard page, klik → Canvas XYFlow
 *
 *   🗄️ BQ Table — tree dataset + table, klik → detail schema
 *
 *   📁 Data Source Spreadsheet — tree SS + sheet, klik → detail config
 *
 * Load pattern: REALTIME via Firestore onSnapshot (zero polling).
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Cable, ChevronDown, ChevronRight, Database, FilePlus, Layers,
    FileSpreadsheet, LayoutDashboard, FileText, Folder, Plus,
    Loader2,
} from "lucide-react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import AddSpreadsheetEmbed from "./_components/add-spreadsheet";
import MasterDataConfig from "./_components/master-data-config";
import CanvasPageConfig from "./_components/canvas-page-config";
import Overview from "./_components/overview";
import BQTableView from "./_components/bq-table";
import SheetDetail from "./_components/sheet-detail";
import DataLevelConfig from "./_components/data-level-config";
import SpreadsheetDetail from "./_components/spreadsheet-detail";
import {
    useFirestorePagesV5,
    useFirestoreDataSourcesV2,
    useFirestoreSSConfig,
    type DataSourceV2Doc,
} from "./_components/shared/useFirestore";

type View =
    | { kind: "overview" }
    | { kind: "canvas"; pagePath: string; pageLabel: string }
    | { kind: "bq-table"; dataset: string; table: string }
    | { kind: "sheet-detail"; datasetId: string; sheetTabId: string }
    | { kind: "spreadsheet-detail"; datasetId: string }
    | { kind: "add-spreadsheet" }
    | { kind: "master-wizard" }
    | { kind: "data-level-config" };

interface SidebarPage { path: string; label: string; section?: string; }
interface BQDataset { id: string; category?: string; tables?: string[] }

export default function DataConnectorV5PageWrapper() {
    return (
        <ErrorBoundary label="DataConnectorV5Hub">
            <DataConnectorV5Hub />
        </ErrorBoundary>
    );
}

function DataConnectorV5Hub() {
    const [view, setView] = useState<View>({ kind: "overview" });

    // Realtime Firestore
    const { pages: v5Pages, loading: v5Loading } = useFirestorePagesV5();
    const { dataSources, loading: dsLoading } = useFirestoreDataSourcesV2();
    const { config: ssConfig } = useFirestoreSSConfig<any>();

    // Non-realtime page list
    const [pages, setPages] = useState<SidebarPage[]>([]);
    const [pagesLoading, setPagesLoading] = useState(true);
    const [bqDatasets, setBqDatasets] = useState<BQDataset[]>([]);

    useEffect(() => {
        (async () => {
            setPagesLoading(true);
            try {
                const [pagesRes, bqRes] = await Promise.all([
                    fetch("/api/data-sources?pages=1").then((r) => r.json()).catch(() => ({ pages: [] })),
                    fetch("/api/data-connector-v5/bq-schema").then((r) => r.json()).catch(() => ({ datasets: [] })),
                ]);
                setPages(Array.isArray(pagesRes?.pages) ? pagesRes.pages : []);
                setBqDatasets(Array.isArray(bqRes?.datasets) ? bqRes.datasets : []);
            } finally {
                setPagesLoading(false);
            }
        })();
    }, []);

    // Master Data Config sudah ter-set kalau level UPT + GI minimum punya BQ source pointer.
    const masterConfigured = !!(
        ssConfig?.masterConfig?.levels?.upt?.dataset &&
        ssConfig?.masterConfig?.levels?.gi?.dataset
    );

    // Add Spreadsheet TIDAK depend Master Config (Layer 1 vs Layer 2 separation).
    // Tetap buka wizard. Notif FLAT-mode dikasih di dalam wizard kalau master belum siap.
    const handleAddSpreadsheet = useCallback(() => {
        setView({ kind: "add-spreadsheet" });
    }, []);

    return (
        <div className="flex h-screen bg-background">
            {/* ═════ Sidebar ═════ */}
            <aside className="w-72 shrink-0 border-r border-border/40 bg-card/20 overflow-y-auto">
                {/* Header */}
                <div className="p-4 border-b border-border/40">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600">
                            <Cable className="h-4 w-4 text-foreground" />
                        </div>
                        <div>
                            <h1 className="ds-label">Data Connector V5</h1>
                            <p className="ds-small opacity-70">Hub SS V5</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-3 space-y-1.5 border-b border-border/40">
                    <button
                        onClick={handleAddSpreadsheet}
                        className="w-full ds-transition cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium"
                    >
                        <Plus className="h-4 w-4" />
                        Add Spreadsheet
                    </button>
                    <button
                        onClick={() => setView({ kind: "master-wizard" })}
                        className="w-full ds-transition cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm"
                    >
                        <Layers className="h-4 w-4" />
                        Master Data Config
                    </button>
                </div>

                {/* Nav: Overview + Data Level Config */}
                <nav className="p-2 space-y-0.5">
                    <SideItem
                        active={view.kind === "overview"}
                        onClick={() => setView({ kind: "overview" })}
                        icon={<LayoutDashboard className="h-4 w-4" />}
                        label="Overview"
                    />
                    <SideItem
                        active={view.kind === "data-level-config"}
                        onClick={() => setView({ kind: "data-level-config" })}
                        icon={<Layers className="h-4 w-4" />}
                        label="Data Level Config"
                    />
                </nav>

                {/* Page Data Config */}
                <CollapsibleSection title="Page Data Config" icon={<FileText className="h-4 w-4" />} count={pages.length}>
                    {pagesLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 ds-small opacity-60">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                        </div>
                    ) : (
                        <PageList
                            pages={pages}
                            configured={v5Pages}
                            active={view.kind === "canvas" ? (view as any).pagePath : null}
                            onSelect={(p) =>
                                setView({ kind: "canvas", pagePath: p.path, pageLabel: p.label })
                            }
                        />
                    )}
                </CollapsibleSection>

                {/* BQ Table */}
                <CollapsibleSection title="BQ Table" icon={<Database className="h-4 w-4" />} count={bqDatasets.length}>
                    {bqDatasets.length === 0 ? (
                        <div className="px-3 py-2 ds-small opacity-60">
                            {pagesLoading ? "Loading..." : "No dataset"}
                        </div>
                    ) : (
                        bqDatasets.map((ds) => (
                            <DatasetTree
                                key={ds.id}
                                dataset={ds}
                                activeTable={
                                    view.kind === "bq-table" && (view as any).dataset === ds.id
                                        ? (view as any).table
                                        : null
                                }
                                onSelectTable={(dataset, table) =>
                                    setView({ kind: "bq-table", dataset, table })
                                }
                            />
                        ))
                    )}
                </CollapsibleSection>

                {/* Data Source Spreadsheet */}
                <CollapsibleSection
                    title="Data Source Spreadsheet"
                    icon={<FileSpreadsheet className="h-4 w-4" />}
                    count={dataSources.length}
                >
                    {dsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2 ds-small opacity-60">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                        </div>
                    ) : (
                        dataSources.map((ds) => (
                            <SpreadsheetTree
                                key={ds.id}
                                dataSource={ds}
                                activeSheetTabId={
                                    view.kind === "sheet-detail" && view.datasetId === ds.id
                                        ? view.sheetTabId
                                        : null
                                }
                                activeSpreadsheet={
                                    view.kind === "spreadsheet-detail" ? view.datasetId : null
                                }
                                onSelectSpreadsheet={(datasetId) =>
                                    setView({ kind: "spreadsheet-detail", datasetId })
                                }
                                onSelectSheet={(dsId, sheetTabId) =>
                                    setView({ kind: "sheet-detail", datasetId: dsId, sheetTabId })
                                }
                            />
                        ))
                    )}
                </CollapsibleSection>
            </aside>

            {/* ═════ Main content ═════ */}
            {/* overflow-hidden + min-h-0 → child component manages its own scroll
                supaya sticky footer (Save bar) di Master Data Config & Data Level Config
                stay di bawah viewport, tidak ikut ke-scroll. */}
            <main className="flex-1 overflow-hidden min-h-0 flex flex-col">
                {view.kind === "overview" && <Overview />}
                {view.kind === "canvas" && (
                    <CanvasPageConfig
                        pagePath={(view as any).pagePath}
                        pageLabel={(view as any).pageLabel}
                        onSaved={() => setView({ kind: "overview" })}
                    />
                )}
                {view.kind === "bq-table" && (
                    <BQTableView
                        dataset={(view as any).dataset}
                        table={(view as any).table}
                    />
                )}
                {view.kind === "sheet-detail" && (
                    <SheetDetail
                        datasetId={view.datasetId}
                        sheetTabId={view.sheetTabId}
                    />
                )}
                {view.kind === "spreadsheet-detail" && (
                    <SpreadsheetDetail datasetId={view.datasetId} />
                )}
                {view.kind === "add-spreadsheet" && (
                    <AddSpreadsheetEmbed masterConfigured={masterConfigured} />
                )}
                {view.kind === "master-wizard" && <MasterDataConfig />}
                {view.kind === "data-level-config" && <DataLevelConfig />}
            </main>
        </div>
    );
}

/* ─────────────── Components ─────────────── */

function SideItem({
    active,
    onClick,
    icon,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    count?: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full ds-transition cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left ${
                active
                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                    : "hover:bg-muted/40"
            }`}
        >
            {icon}
            <span className="flex-1 truncate">{label}</span>
            {count != null && count > 0 && (
                <span className="ds-small opacity-60 font-mono">{count}</span>
            )}
        </button>
    );
}

function CollapsibleSection({
    title,
    icon,
    count,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    count?: number;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(true);
    return (
        <div className="border-t border-border/40">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full ds-transition cursor-pointer flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20"
            >
                {open ? (
                    <ChevronDown className="h-3 w-3 opacity-60" />
                ) : (
                    <ChevronRight className="h-3 w-3 opacity-60" />
                )}
                {icon}
                <span className="ds-small uppercase tracking-widest opacity-80 flex-1 text-left">
                    {title}
                </span>
                {count != null && count > 0 && (
                    <span className="ds-small opacity-60 font-mono">{count}</span>
                )}
            </button>
            {open && <div className="pb-2">{children}</div>}
        </div>
    );
}

function PageList({
    pages,
    configured,
    active,
    onSelect,
}: {
    pages: SidebarPage[];
    configured: Map<string, any>;
    active: string | null;
    onSelect: (p: SidebarPage) => void;
}) {
    // Group by section
    const grouped = useMemo(() => {
        const m = new Map<string, SidebarPage[]>();
        for (const p of pages) {
            const s = p.section || "Lainnya";
            if (!m.has(s)) m.set(s, []);
            m.get(s)!.push(p);
        }
        return Array.from(m.entries());
    }, [pages]);

    return (
        <div>
            {grouped.map(([section, items]) => {
                // Single-item section = render flat (no collapsible wrapper) — e.g., Overview page
                if (items.length === 1) {
                    const p = items[0];
                    const cfg = configured.get(p.path);
                    const isActive = active === p.path;
                    return (
                        <button
                            key={section}
                            onClick={() => onSelect(p)}
                            className={`w-full ds-transition cursor-pointer flex items-center gap-2 pl-6 pr-3 py-1 text-xs text-left ${
                                isActive ? "bg-indigo-500/15 text-indigo-400" : "hover:bg-muted/40"
                            }`}
                        >
                            <span className="flex-1 truncate">{p.label}</span>
                            {cfg && (
                                <span className="ds-data rounded bg-emerald-500/10 text-emerald-400 px-1 text-[9px] shrink-0">
                                    V5
                                </span>
                            )}
                        </button>
                    );
                }
                // Multi-item section = collapsible group
                return (
                    <CollapsibleSubSection key={section} title={section} count={items.length}>
                        {items.map((p) => {
                            const cfg = configured.get(p.path);
                            const isActive = active === p.path;
                            return (
                                <button
                                    key={p.path}
                                    onClick={() => onSelect(p)}
                                    className={`w-full ds-transition cursor-pointer flex items-center gap-2 pl-8 pr-3 py-1 text-xs text-left ${
                                        isActive ? "bg-indigo-500/15 text-indigo-400" : "hover:bg-muted/40"
                                    }`}
                                >
                                    <span className="flex-1 truncate">{p.label}</span>
                                    {cfg && (
                                        <span className="ds-data rounded bg-emerald-500/10 text-emerald-400 px-1 text-[9px] shrink-0">
                                            V5
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </CollapsibleSubSection>
                );
            })}
        </div>
    );
}

function CollapsibleSubSection({
    title,
    count,
    children,
}: {
    title: string;
    count?: number;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full ds-transition cursor-pointer flex items-center gap-2 px-3 py-1 text-left hover:bg-muted/20"
            >
                {open ? (
                    <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                ) : (
                    <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                )}
                <span className="ds-small opacity-60 uppercase tracking-wide text-[10px] flex-1 text-left">
                    {title}
                </span>
                {count != null && count > 0 && (
                    <span className="ds-small opacity-50 font-mono text-[10px]">{count}</span>
                )}
            </button>
            {open && <div>{children}</div>}
        </div>
    );
}

function DatasetTree({
    dataset,
    activeTable,
    onSelectTable,
}: {
    dataset: BQDataset;
    activeTable: string | null;
    onSelectTable: (dataset: string, table: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [tables, setTables] = useState<string[] | null>(
        Array.isArray(dataset.tables) ? dataset.tables : null
    );
    const [loading, setLoading] = useState(false);

    // Lazy fetch tables saat first expand
    useEffect(() => {
        if (!open || tables != null || loading) return;
        setLoading(true);
        fetch(`/api/data-connector-v5/bq-schema?dataset=${encodeURIComponent(dataset.id)}`)
            .then((r) => r.json())
            .then((j) => {
                const list = Array.isArray(j.tables) ? j.tables : [];
                setTables(list.map((t: any) => (typeof t === "string" ? t : t.id)));
            })
            .catch(() => setTables([]))
            .finally(() => setLoading(false));
    }, [open, tables, loading, dataset.id]);

    const count = Array.isArray(tables) ? tables.length : null;

    return (
        <div>
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full ds-transition cursor-pointer flex items-center gap-2 px-3 py-1 text-xs hover:bg-muted/40 text-left"
            >
                {open ? (
                    <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                ) : (
                    <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                )}
                <Folder className="h-3 w-3 opacity-70 shrink-0" />
                <span className="truncate flex-1 font-mono">{dataset.id}</span>
                {count != null && (
                    <span className="ds-small opacity-50 font-mono">{count}</span>
                )}
            </button>
            {open && (
                <div className="ml-1">
                    {loading && (
                        <div className="flex items-center gap-2 pl-8 pr-3 py-1 ds-small opacity-60">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading...
                        </div>
                    )}
                    {!loading &&
                        (tables ?? []).map((t) => {
                            const isActive = activeTable === t;
                            return (
                                <button
                                    key={t}
                                    onClick={() => onSelectTable(dataset.id, t)}
                                    className={`w-full ds-transition cursor-pointer flex items-center gap-2 pl-8 pr-3 py-1 text-xs text-left font-mono ${
                                        isActive
                                            ? "bg-indigo-500/15 text-indigo-400"
                                            : "hover:bg-muted/40 opacity-80"
                                    }`}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    {!loading && tables != null && tables.length === 0 && (
                        <div className="pl-8 pr-3 py-1 ds-small opacity-50 italic">
                            No tables
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function SpreadsheetTree({
    dataSource,
    activeSheetTabId,
    activeSpreadsheet,
    onSelectSpreadsheet,
    onSelectSheet,
}: {
    dataSource: DataSourceV2Doc;
    activeSheetTabId: string | null;
    activeSpreadsheet: string | null;
    onSelectSpreadsheet: (datasetId: string) => void;
    onSelectSheet: (datasetId: string, sheetTabId: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const sheetEntries = Object.entries(dataSource.sheets ?? {});
    const isSpreadsheetActive = activeSpreadsheet === dataSource.id;
    const spreadsheetName = dataSource.identity?.name || dataSource.id;
    const isMaster = dataSource.identity?.isMasterHierarchy ?? false;
    return (
        <div>
            {/* Header row: chevron toggle (kiri) + clickable spreadsheet info (rest) */}
            <div
                className={`ds-transition flex items-stretch text-xs ${
                    isSpreadsheetActive ? "bg-indigo-500/15" : "hover:bg-muted/40"
                }`}
            >
                <button
                    onClick={() => setOpen((o) => !o)}
                    className="cursor-pointer flex items-center px-2 hover:bg-white/5"
                    title={open ? "Collapse" : "Expand"}
                >
                    {open ? (
                        <ChevronDown className="h-3 w-3 opacity-60" />
                    ) : (
                        <ChevronRight className="h-3 w-3 opacity-60" />
                    )}
                </button>
                <button
                    onClick={() => onSelectSpreadsheet(dataSource.id)}
                    className={`cursor-pointer flex items-center gap-2 pr-3 py-1 text-left flex-1 min-w-0 ${
                        isSpreadsheetActive ? "text-indigo-400" : ""
                    }`}
                    title="Lihat detail spreadsheet"
                >
                    <FileSpreadsheet className="h-3 w-3 opacity-70 shrink-0" />
                    <span className="truncate flex-1">{spreadsheetName}</span>
                    {isMaster && (
                        <span className="ds-data rounded bg-violet-500/15 text-violet-400 px-1 text-[9px] shrink-0">
                            MASTER
                        </span>
                    )}
                    <span className="ds-small opacity-50 font-mono">{sheetEntries.length}</span>
                </button>
            </div>
            {open && (
                <div className="ml-1">
                    {sheetEntries.map(([sheetTabId, cfg]) => {
                        const isActive =
                            activeSheetTabId === sheetTabId && activeSpreadsheet !== dataSource.id;
                        const label = cfg.tabName || sheetTabId;
                        return (
                            <button
                                key={sheetTabId}
                                onClick={() => onSelectSheet(dataSource.id, sheetTabId)}
                                className={`w-full ds-transition cursor-pointer flex items-center gap-2 pl-8 pr-3 py-1 text-xs text-left ${
                                    isActive ? "bg-indigo-500/15 text-indigo-400" : "hover:bg-muted/40 opacity-80"
                                }`}
                            >
                                <span className="truncate flex-1">{label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
