"use client";

/**
 * DataInputSidebarTree — dynamic tree untuk section "Data Input" di AppSidebar.
 *
 * Struktur:
 *   Data Input Dashboard (expandable)
 *     ├─ + Dataset          action → /data-input/new/dataset
 *     ├─ + Tabel            action → /data-input/new/table
 *     ├─ Overview           link   → /data-input
 *     ├─ <dataset> ▸        expandable (tables nested)
 *     │   └─ <table>        link → /data-input/[ds]/[t]
 *     └─ ...
 *
 * Dataset urutkan: user → platform → legacy (alfabetis per grup).
 * Origin badge kecil per dataset (U/P/L) biar user bedakan.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    FolderOpen, FolderClosed, Table2, Loader2, RefreshCw,
    ChevronDown, ChevronRight, Plus, DatabaseZap, LayoutDashboard,
} from "lucide-react";
import {
    SidebarMenuItem, SidebarMenuButton, SidebarMenuSub,
    SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";

interface DatasetInfo {
    id: string;
    friendlyName?: string;
    origin: "user" | "platform" | "legacy";
}

interface TableSummary {
    id: string;
    type: string;
    numRows: number;
}

const ORIGIN_ORDER = { user: 0, platform: 1, legacy: 2 } as const;

export function DataInputSidebarTree({
    sectionExpanded,
    onToggleSection,
}: {
    sectionExpanded: boolean;
    onToggleSection: () => void;
}) {
    const pathname = usePathname();
    const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [tablesByDs, setTablesByDs] = useState<Record<string, TableSummary[]>>({});
    const [expandedDs, setExpandedDs] = useState<Set<string>>(new Set());
    const [loadingDs, setLoadingDs] = useState<Set<string>>(new Set());

    const loadDatasets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/data-input/datasets").then((r) => r.json());
            if (res.ok) {
                // Sort: origin priority → alfabetis per origin
                const sorted = [...(res.datasets as DatasetInfo[])].sort((a, b) => {
                    const ord = ORIGIN_ORDER[a.origin] - ORIGIN_ORDER[b.origin];
                    if (ord !== 0) return ord;
                    return a.id.localeCompare(b.id);
                });
                setDatasets(sorted);
            }
        } catch (err) {
            console.warn("[DataInputSidebarTree] fetch datasets failed:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (sectionExpanded) void loadDatasets();
    }, [sectionExpanded, loadDatasets]);

    // Auto-expand dataset kalau path aktif di dalamnya
    useEffect(() => {
        const match = pathname?.match(/^\/data-input\/([^/]+)/);
        if (match && match[1] !== "new") {
            const ds = decodeURIComponent(match[1]);
            setExpandedDs((prev) => {
                if (prev.has(ds)) return prev;
                const next = new Set(prev);
                next.add(ds);
                return next;
            });
        }
    }, [pathname]);

    async function toggleDataset(dsId: string) {
        setExpandedDs((prev) => {
            const next = new Set(prev);
            if (next.has(dsId)) next.delete(dsId); else next.add(dsId);
            return next;
        });
        if (!tablesByDs[dsId] && !loadingDs.has(dsId)) {
            setLoadingDs((s) => new Set(s).add(dsId));
            try {
                const res = await fetch(`/api/data-input/datasets/${encodeURIComponent(dsId)}`).then((r) => r.json());
                if (res.ok) {
                    setTablesByDs((prev) => ({ ...prev, [dsId]: res.dataset.tables ?? [] }));
                }
            } finally {
                setLoadingDs((s) => {
                    const next = new Set(s);
                    next.delete(dsId);
                    return next;
                });
            }
        }
    }

    const isDataInputActive = pathname?.startsWith("/data-input") ?? false;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                onClick={onToggleSection}
                isActive={isDataInputActive}
                tooltip="Data Input Dashboard"
                className="cursor-pointer"
            >
                <DatabaseZap className="h-4 w-4" />
                <span className="flex-1">Data Input Dashboard</span>
                {sectionExpanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                }
            </SidebarMenuButton>

            <SidebarMenuSub
                className={`transition-all duration-200 overflow-hidden ${sectionExpanded ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"}`}
            >
                {/* Actions: Add Dataset, Add Table */}
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === "/data-input/new/dataset"}>
                        <Link href="/data-input/new/dataset">
                            <Plus className="h-3.5 w-3.5 text-primary" />
                            <span>Add Dataset</span>
                        </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === "/data-input/new/table"}>
                        <Link href="/data-input/new/table">
                            <Plus className="h-3.5 w-3.5 text-primary" />
                            <span>Add Table</span>
                        </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>

                {/* Overview */}
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === "/data-input"}>
                        <Link href="/data-input">
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            <span>Overview</span>
                        </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>

                {/* Divider */}
                <li className="px-2 py-1.5">
                    <div className="h-px bg-border/40" />
                </li>

                {/* Loading state */}
                {loading && datasets.length === 0 && (
                    <SidebarMenuSubItem>
                        <div className="flex items-center gap-2 px-2 py-1.5 ds-small opacity-60">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Memuat dataset...
                        </div>
                    </SidebarMenuSubItem>
                )}

                {/* Flat dataset list (sudah di-sort per origin) */}
                {datasets.map((ds) => {
                    const isExpanded = expandedDs.has(ds.id);
                    const isLoading = loadingDs.has(ds.id);
                    const tables = tablesByDs[ds.id];
                    const isDsActive = pathname === `/data-input/${ds.id}` || pathname === `/data-input/${encodeURIComponent(ds.id)}`;
                    const dim = ds.origin === "legacy";
                    const originBadge = ds.origin === "user" ? "U" : ds.origin === "platform" ? "P" : "L";
                    const originColor = ds.origin === "user"
                        ? "text-primary border-primary/40 bg-primary/10"
                        : ds.origin === "platform"
                        ? "text-blue-300 border-blue-500/30 bg-blue-500/10"
                        : "text-amber-300/70 border-amber-500/20 bg-amber-500/5";
                    return (
                        <SidebarMenuSubItem key={ds.id} className={dim ? "opacity-60 hover:opacity-100 ds-transition" : ""}>
                            <div className="flex items-center gap-0.5 w-full group/ds">
                                <button
                                    type="button"
                                    onClick={() => toggleDataset(ds.id)}
                                    className="ds-transition p-0.5 rounded hover:bg-muted/40 text-muted-foreground shrink-0"
                                    title="Expand tables"
                                >
                                    {isLoading
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                    }
                                </button>
                                <SidebarMenuSubButton asChild isActive={isDsActive} className="flex-1 pl-1">
                                    <Link href={`/data-input/${encodeURIComponent(ds.id)}`}>
                                        {isExpanded
                                            ? <FolderOpen className="h-3.5 w-3.5" />
                                            : <FolderClosed className="h-3.5 w-3.5" />
                                        }
                                        <span className="truncate flex-1" title={ds.id}>
                                            {ds.friendlyName ?? ds.id}
                                        </span>
                                        <span
                                            className={`ds-small font-mono text-[9px] rounded-sm border px-1 shrink-0 opacity-0 group-hover/ds:opacity-100 ds-transition ${originColor}`}
                                            title={`origin: ${ds.origin}`}
                                        >
                                            {originBadge}
                                        </span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </div>

                            {isExpanded && tables && (
                                <ul className="ml-5 border-l border-border/30 space-y-0.5 my-0.5">
                                    {tables.length === 0 && (
                                        <li className="pl-2 py-1 ds-small opacity-50 italic">Belum ada table</li>
                                    )}
                                    {tables.map((t) => {
                                        const href = `/data-input/${encodeURIComponent(ds.id)}/${encodeURIComponent(t.id)}`;
                                        const isActive = pathname === href || pathname === `/data-input/${ds.id}/${t.id}`;
                                        return (
                                            <li key={t.id}>
                                                <Link
                                                    href={href}
                                                    className={`ds-transition flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded text-sm ${
                                                        isActive
                                                            ? "bg-primary/10 text-primary"
                                                            : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    <Table2 className="h-3 w-3 shrink-0" />
                                                    <span className="truncate flex-1" title={t.id}>{t.id}</span>
                                                    {t.numRows > 0 && (
                                                        <span className="ds-small font-mono opacity-50 shrink-0">
                                                            {formatCount(t.numRows)}
                                                        </span>
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </SidebarMenuSubItem>
                    );
                })}

                {/* Refresh footer */}
                <li className="px-2 py-1 mt-1 flex items-center justify-end">
                    <button
                        type="button"
                        onClick={loadDatasets}
                        disabled={loading}
                        className="ds-transition ds-small inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-50"
                        title="Refresh list"
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </li>
            </SidebarMenuSub>
        </SidebarMenuItem>
    );
}

function formatCount(n: number): string {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
    return `${(n / 1_000_000).toFixed(1)}M`;
}
