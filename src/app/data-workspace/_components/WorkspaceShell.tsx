"use client";

/**
 * WorkspaceShell — persistent chrome.
 *
 *  Layout:
 *   ┌─ TopBar ──────────────────────────────────┐
 *   │ brand · toggle · breadcrumb · utils       │
 *   ├──────┬────────────────────────────────────┤
 *   │ ds   │  main content                      │
 *   │ tree │                                    │
 *   └──────┴────────────────────────────────────┘
 *
 *  Sidebar collapsible via TopBar toggle button.
 *  Mobile (<md): sidebar = drawer overlay (hide by default, hamburger di TopBar).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceTopBar, type BreadcrumbItem } from "./WorkspaceTopBar";
import { DatasetTree } from "./DatasetTree";
import { Modal } from "./Modal";
import { ConfirmDialog, type ConfirmOptions } from "./ConfirmDialog";
import { NewDatasetForm } from "@/app/data-input/new/_shared/NewDatasetForm";
import { NewTableWizard } from "@/app/data-input/new/_shared/NewTableWizard";
import { NewGroupForm } from "./NewGroupForm";
import { useCategoryRegistry } from "@/lib/workspace/useCategoryRegistry";
import {
    FolderPlus, Table2, FolderTree, X, ChevronLeft, ChevronRight,
    Search, DatabaseZap, FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDatasetCategoryRegistry } from "@/lib/workspace/useDatasetCategoryRegistry";
import { resolveCategory } from "@/lib/workspace/category-resolver";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkspaceProvider, type WorkspaceActions } from "./WorkspaceContext";
import { WORKSPACE_SIDEBAR, WORKSPACE_CHROME } from "./workspace-tokens";

const {
    LS_KEY, LS_KEY_COLLAPSED,
    LS_KEY_EXPANDED_DS, LS_KEY_COLLAPSED_SECTIONS,
    MIN_PX: WIDTH_MIN, MAX_PX: WIDTH_MAX, DEFAULT_PX: WIDTH_DEFAULT,
    COLLAPSED_RAIL_PX,
    MOBILE_BREAKPOINT_PX,
} = WORKSPACE_SIDEBAR;

function readLSArray(key: string): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch { return []; }
}

/** Collapsed rail — mirror EXACT struktur DatasetTree expanded (group + dataset + table)
 *  pakai expansion state yg di-share via localStorage. Yg di-show di expanded =
 *  yg di-show di rail, beda cuma label di-hide jadi icon-only.
 *
 *  Row 1 (44px, border-b): search icon → expand sidebar.
 *  Below: untuk tiap group:
 *    [FolderTree icon]                     ← group icon, always show
 *      [DatabaseZap] [DatabaseZap] ...     ← dataset icons (cuma kalau group expanded)
 *        [Table2] [Table2] ...             ← table icons (cuma kalau dataset expanded) */
function CollapsedRail({ onExpand }: { onExpand: () => void }) {
    const pathname = usePathname() ?? "";
    const { categories } = useCategoryRegistry();
    const { overlay } = useDatasetCategoryRegistry();
    const [datasets, setDatasets] = useState<Array<{ id: string; friendlyName?: string }>>([]);
    const [tables, setTables] = useState<Record<string, Array<{ id: string }>>>({});

    /** Read shared expansion state from localStorage (DatasetTree persists ke sini). */
    const expandedDs = useMemo(() => new Set(readLSArray(LS_KEY_EXPANDED_DS)), []);
    const collapsedSecs = useMemo(() => new Set(readLSArray(LS_KEY_COLLAPSED_SECTIONS)), []);

    /** Active route for highlight. */
    const m = pathname.match(/^\/data-workspace\/([^/]+)(?:\/([^/]+))?/);
    const activeDs = m?.[1] ? decodeURIComponent(m[1]) : null;
    const activeTbl = m?.[2] ? decodeURIComponent(m[2]) : null;

    useEffect(() => {
        fetch("/api/data-input/datasets")
            .then((r) => r.json())
            .then((d) => { if (d.ok) setDatasets(d.datasets); })
            .catch(() => {});
    }, []);

    /** Fetch tables untuk dataset yg expanded (mirror lazy load DatasetTree). */
    useEffect(() => {
        for (const ds of expandedDs) {
            if (tables[ds]) continue;
            fetch(`/api/data-input/datasets/${encodeURIComponent(ds)}`)
                .then((r) => r.json())
                .then((res) => { if (res.ok) setTables((prev) => ({ ...prev, [ds]: res.dataset.tables })); })
                .catch(() => {});
        }
        // Active dataset juga preload tables-nya
        if (activeDs && !tables[activeDs]) {
            fetch(`/api/data-input/datasets/${encodeURIComponent(activeDs)}`)
                .then((r) => r.json())
                .then((res) => { if (res.ok) setTables((prev) => ({ ...prev, [activeDs]: res.dataset.tables })); })
                .catch(() => {});
        }
    }, [expandedDs, activeDs, tables]);

    /** Group datasets per category (mirror DatasetTree grouping logic). */
    const grouped = useMemo(() => {
        const groups = new Map<string, typeof datasets>();
        for (const c of categories) groups.set(c.key, []);
        groups.set("uncategory", []);
        for (const d of datasets) {
            const cat = resolveCategory(d.id, { fsCategory: overlay[d.id]?.category });
            const target = groups.has(cat) ? cat : "uncategory";
            groups.get(target)!.push(d);
        }
        return categories
            .map((c) => ({ key: c.key, label: c.label, items: groups.get(c.key) ?? [] }))
            .concat({ key: "uncategory", label: "Uncategory", items: groups.get("uncategory") ?? [] })
            .filter((g) => g.items.length > 0);
    }, [categories, datasets, overlay]);

    const railBtn = "ds-interactive ds-press ds-focus rounded h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-primary";

    return (
        <TooltipProvider delayDuration={200}>
            <aside className="w-full bg-card/30 flex flex-col min-h-0">
                {/* Row 1 — Search icon. Chrome height + border-b match topbar. */}
                <div
                    className="shrink-0 flex items-center justify-center border-b border-border/60"
                    style={{ height: WORKSPACE_CHROME.ROW_HEIGHT_PX }}
                >
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button type="button" onClick={onExpand} aria-label="Search" className={railBtn}>
                                <Search className="h-3.5 w-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={6}>Search · expand sidebar</TooltipContent>
                    </Tooltip>
                </div>

                {/* Mirror group + dataset + table tree dengan expansion state shared via LS. */}
                <div className="flex-1 min-h-0 overflow-y-auto py-1.5 flex flex-col items-center gap-0.5">
                    {grouped.map((g) => {
                        const sectionOpen = !collapsedSecs.has(g.key);
                        return (
                            <div key={g.key} className="w-full flex flex-col items-center gap-0.5">
                                {/* Group icon — orange kalau expanded, default kalau collapsed. */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={onExpand}
                                            aria-label={g.label}
                                            className={`${railBtn} ${sectionOpen ? "text-primary" : ""}`}
                                        >
                                            <FolderTree className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={6}>
                                        <span className="opacity-60">Group ·</span> {g.label}
                                    </TooltipContent>
                                </Tooltip>

                                {/* Datasets under this group — only kalau section expanded. */}
                                {sectionOpen && g.items.map((d) => {
                                    const dsExpanded = expandedDs.has(d.id);
                                    const alias = overlay[d.id]?.alias ?? d.friendlyName ?? d.id;
                                    const dsHref = `/data-workspace/${encodeURIComponent(d.id)}`;
                                    const dsActive = activeDs === d.id;
                                    return (
                                        <div key={d.id} className="w-full flex flex-col items-center gap-0.5">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Link
                                                        href={dsHref}
                                                        aria-label={alias}
                                                        className={`${railBtn} ${dsActive || dsExpanded ? "text-primary" : ""}`}
                                                    >
                                                        <DatabaseZap className="h-3.5 w-3.5" />
                                                    </Link>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" sideOffset={6}>
                                                    <span className="opacity-60">Dataset ·</span> {alias}
                                                </TooltipContent>
                                            </Tooltip>

                                            {/* Tables under this dataset — only kalau dataset expanded. */}
                                            {dsExpanded && tables[d.id]?.map((t) => {
                                                const tHref = `${dsHref}/${encodeURIComponent(t.id)}`;
                                                const tActive = activeDs === d.id && activeTbl === t.id;
                                                return (
                                                    <Tooltip key={t.id}>
                                                        <TooltipTrigger asChild>
                                                            <Link
                                                                href={tHref}
                                                                aria-label={t.id}
                                                                className={`${railBtn} ${tActive ? "text-primary" : ""}`}
                                                            >
                                                                <Table2 className="h-3.5 w-3.5" />
                                                            </Link>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" sideOffset={6}>
                                                            <span className="opacity-60">Table ·</span> {t.id}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </aside>
        </TooltipProvider>
    );
}

export function WorkspaceShell({
    breadcrumb,
    children,
}: {
    breadcrumb?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [width, setWidth] = useState<number>(WIDTH_DEFAULT);
    const [dragging, setDragging] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const startX = useRef(0);
    const startWidth = useRef(WIDTH_DEFAULT);

    const [modalOpen, setModalOpen] = useState<"dataset" | "table" | "group" | null>(null);
    const [tablePreselectDs, setTablePreselectDs] = useState<string | undefined>(undefined);
    const { categories } = useCategoryRegistry();

    const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
    const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);
    const confirm = useCallback((opts: ConfirmOptions) => {
        setConfirmState(opts);
        return new Promise<boolean>((resolve) => {
            confirmResolverRef.current = resolve;
        });
    }, []);
    const resolveConfirm = useCallback((ok: boolean) => {
        confirmResolverRef.current?.(ok);
        confirmResolverRef.current = null;
        setConfirmState(null);
    }, []);

    // Detect mobile breakpoint
    useEffect(() => {
        function check() {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
        }
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
        const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
        if (saved) {
            const n = parseInt(saved, 10);
            if (!Number.isNaN(n) && n >= WIDTH_MIN && n <= WIDTH_MAX) setWidth(n);
        }
        const c = typeof window !== "undefined" ? localStorage.getItem(LS_KEY_COLLAPSED) : null;
        if (c === "1") setCollapsed(true);
    }, []);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (collapsed || isMobile) return;
        e.preventDefault();
        setDragging(true);
        startX.current = e.clientX;
        startWidth.current = width;
    }, [width, collapsed, isMobile]);

    useEffect(() => {
        if (!dragging) return;
        let latest = startWidth.current;
        function onMove(e: MouseEvent) {
            const dx = e.clientX - startX.current;
            latest = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, startWidth.current + dx));
            setWidth(latest);
        }
        function onUp() {
            setDragging(false);
            try { localStorage.setItem(LS_KEY, String(latest)); } catch {}
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [dragging]);

    function resetWidth() {
        setWidth(WIDTH_DEFAULT);
        try { localStorage.setItem(LS_KEY, String(WIDTH_DEFAULT)); } catch {}
    }

    const toggleSidebar = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            try { localStorage.setItem(LS_KEY_COLLAPSED, next ? "1" : "0"); } catch {}
            return next;
        });
    }, []);

    const openMobileSidebar = useCallback(() => setMobileOpen(true), []);
    const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);

    const openNewDataset = useCallback(() => setModalOpen("dataset"), []);
    const openNewTable = useCallback((preselectDs?: string) => {
        setTablePreselectDs(preselectDs);
        setModalOpen("table");
    }, []);
    const openNewGroup = useCallback(() => setModalOpen("group"), []);
    const closeModal = useCallback(() => {
        setModalOpen(null);
        setTablePreselectDs(undefined);
    }, []);

    const actions = useMemo<WorkspaceActions>(
        () => ({ openNewDataset, openNewTable, openNewGroup, confirm }),
        [openNewDataset, openNewTable, openNewGroup, confirm],
    );

    /** Effective sidebar width — collapsed = narrow rail (icon-only), expanded = full width. */
    const effectiveSidebarWidth = isMobile
        ? 0
        : (collapsed ? COLLAPSED_RAIL_PX : width);

    /** Sidebar visible (drawer mobile vs always-rendered desktop). */
    const sidebarVisible = isMobile ? mobileOpen : true;

    return (
        <WorkspaceProvider value={actions}>
            {/* Outer wrapper — relative supaya divider absolute bisa span full viewport
             *  (dari atas TopBar sampai bawah layar). flex-col + flex-1 supaya
             *  inherit fixed inset-0 dari (authed)/layout.tsx. */}
            <div className="relative flex-1 flex flex-col min-h-0">
                <WorkspaceTopBar
                    breadcrumb={breadcrumb}
                    onOpenMobileSidebar={isMobile ? openMobileSidebar : undefined}
                    sidebarWidth={isMobile ? undefined : effectiveSidebarWidth}
                    sidebarDragging={dragging}
                />
                <div className="flex-1 flex min-h-0 relative">
                    {/* Desktop sidebar — inline, divider full-viewport diserahkan ke wrapper */}
                    {!isMobile && (
                        <div
                            data-dw-sidebar
                            style={{ width: effectiveSidebarWidth }}
                            className={`shrink-0 min-h-0 flex overflow-hidden ${
                                dragging ? "" : "transition-[width] duration-200 ease-out"
                            }`}
                        >
                            {/* DatasetTree always mounted — state + fetch dipertahankan saat toggle.
                             *  Saat collapsed: hide via CSS, ga unmount → no re-fetch / no state reset.
                             *  CollapsedRail mount on-demand (lightweight, fetch sendiri tapi cuma sekali per session). */}
                            <div className={`w-full flex min-h-0 ${collapsed ? "hidden" : ""}`}>
                                <DatasetTree onNewDataset={openNewDataset} onNewTable={openNewTable} />
                            </div>
                            {collapsed && <CollapsedRail onExpand={toggleSidebar} />}
                        </div>
                    )}

                    {/* Mobile drawer — overlay slide from left */}
                    {isMobile && (
                        <>
                            {/* Backdrop */}
                            {sidebarVisible && (
                                <button
                                    type="button"
                                    aria-label="Close sidebar"
                                    onClick={closeMobileSidebar}
                                    className="absolute inset-0 bg-background/60 backdrop-blur-sm z-30 ds-transition animate-in fade-in"
                                />
                            )}
                            {/* Drawer — width clamp via CSS, no window.innerWidth (SSR-safe) */}
                            <div
                                className={`absolute left-0 top-0 bottom-0 z-40 ds-transition shadow-2xl bg-card
                                    ${sidebarVisible ? "translate-x-0" : "-translate-x-full"}`}
                                style={{ width, maxWidth: "calc(100vw - 60px)" }}
                            >
                                <div className="relative h-full flex">
                                    <DatasetTree onNewDataset={openNewDataset} onNewTable={openNewTable} />
                                    <button
                                        type="button"
                                        onClick={closeMobileSidebar}
                                        aria-label="Close sidebar"
                                        className="absolute top-2 right-2 ds-transition rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 z-10"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
                        {children}
                    </section>
                </div>

                {/* Full-viewport vertical divider — top→bottom of screen.
                 *  Absolute relative ke wrapper di atas (covers TopBar + body).
                 *  Resize handle only — toggle pindah ke samping search di sidebar header.
                 *  Mobile: hidden (drawer pakai backdrop sendiri). */}
                {!isMobile && (
                    <div
                        className={`absolute top-0 bottom-0 w-1 group/handle z-30 ${
                            dragging ? "" : "transition-[left] duration-200 ease-out"
                        }`}
                        style={{ left: effectiveSidebarWidth }}
                    >
                        {/* Drag hit area — full viewport height, wider than visual line.
                         *  Hanya aktif saat sidebar expanded (rail collapsed = ga bisa resize). */}
                        {!collapsed && (
                            <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize sidebar"
                                onMouseDown={onMouseDown}
                                onDoubleClick={resetWidth}
                                title="Drag to resize · double-click to reset"
                                className={`absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize select-none ds-transition
                                    ${dragging ? "bg-primary/15" : "hover:bg-primary/10"}`}
                            />
                        )}

                        {/* Vertical line — default border tone, intensify ke primary on hover/drag */}
                        <div
                            className={`absolute inset-y-0 left-0 w-px ds-transition pointer-events-none
                                ${dragging
                                    ? "bg-primary"
                                    : "bg-border/60 group-hover/handle:bg-primary/60"
                                }`}
                        />

                        {/* Toggle — chevron only, sits ON divider line at search-row y-level
                         *  (sejajar dengan input "Find dataset or table…"). bg-background mask
                         *  supaya line ga nembus icon. Always visible. */}
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
                            title={collapsed ? "Show sidebar" : "Hide sidebar"}
                            style={{
                                top: WORKSPACE_CHROME.ROW_HEIGHT_PX + WORKSPACE_CHROME.ROW_HEIGHT_PX / 2,
                            }}
                            className="absolute left-0 -translate-y-1/2 -translate-x-1/2 z-10
                                ds-press ds-focus
                                flex items-center justify-center
                                py-1 px-px bg-background
                                text-primary hover:scale-110
                                ds-transition cursor-pointer"
                        >
                            {collapsed
                                ? <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                                : <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />}
                        </button>
                    </div>
                )}
            </div>

            <Modal
                open={modalOpen === "dataset"}
                onClose={closeModal}
                title="New Dataset"
                subtitle="BigQuery dataset — container untuk tables terkait"
                icon={FolderPlus}
                size="md"
            >
                <NewDatasetForm
                    onCancel={closeModal}
                    onSuccess={(id) => {
                        closeModal();
                        router.push(`/data-workspace/${encodeURIComponent(id)}`);
                    }}
                />
            </Modal>

            <Modal
                open={modalOpen === "table"}
                onClose={closeModal}
                title="New Table"
                subtitle={tablePreselectDs ? `Dataset: ${tablePreselectDs}` : "Pilih dataset parent + define schema"}
                icon={Table2}
                size="lg"
            >
                <NewTableWizard
                    preselectDs={tablePreselectDs}
                    onCancel={closeModal}
                    onSuccess={(ds, tbl) => {
                        closeModal();
                        router.push(`/data-workspace/${encodeURIComponent(ds)}/${encodeURIComponent(tbl)}`);
                    }}
                />
            </Modal>

            <Modal
                open={modalOpen === "group"}
                onClose={closeModal}
                title="New group"
                subtitle="Group untuk organisir dataset di sidebar"
                icon={FolderTree}
                size="md"
            >
                <NewGroupForm
                    existingCount={categories.length}
                    onCancel={closeModal}
                    onSuccess={closeModal}
                />
            </Modal>

            <ConfirmDialog
                open={confirmState !== null}
                options={confirmState}
                onResolve={resolveConfirm}
            />
        </WorkspaceProvider>
    );
}
