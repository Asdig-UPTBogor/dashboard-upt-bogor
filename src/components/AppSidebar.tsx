"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import {
    ChevronRight, ChevronDown,
    BarChart3, TrendingUp, Gauge, Building2, Shield,
    Radio, FileText, Activity, MapPin, Zap, Route,
    Wrench, Database, RefreshCw, TreePine, Hammer,
    FileImage, FileCheck, CalendarDays, LogOut, BatteryCharging,
    ClipboardList, LayoutGrid, FlaskConical, LayoutDashboard, Cable,
} from "lucide-react";
import { useWorkerProgress, useWorkerStatus } from "@/hooks/useWorkerSSE";
import type { LucideIcon } from "lucide-react";
import { SIDEBAR_SECTIONS as SIDEBAR_CONFIG } from "@/lib/sidebar-config";
import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
    SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
    SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ── Icon Name → Component resolver ── */
const ICON_MAP: Record<string, LucideIcon> = {
    LayoutDashboard, BarChart3, ClipboardList, TrendingUp, Gauge,
    Radio, Building2, Shield, FileText, CalendarDays, Activity,
    MapPin, Zap, Route, Hammer, FileImage, FileCheck, Database,
    Wrench, RefreshCw, TreePine, BatteryCharging, LayoutGrid, FlaskConical,
    Cable,
};

const resolveIcon = (name: string): LucideIcon => ICON_MAP[name] || FileText;

/* ── Build sidebar structure from shared config ── */
interface SubItem { href: string; label: string; icon: LucideIcon; }
interface SidebarSection { key: string; label: string; icon: LucideIcon; items: SubItem[]; }

const SIDEBAR_SECTIONS: SidebarSection[] = SIDEBAR_CONFIG.map((section) => ({
    key: section.key,
    label: section.label,
    icon: resolveIcon(section.iconName),
    items: section.items.map((item) => ({
        href: item.href,
        label: item.label,
        icon: resolveIcon(item.iconName),
    })),
}));

/* ── Standalone pages (not in collapsible sections) ── */
const STANDALONE_PAGES = SIDEBAR_SECTIONS.filter(
    (s) => s.key === "overview" || s.key === "asset-maps" || s.key === "jadwal-pekerjaan"
);
const COLLAPSIBLE_SECTIONS = SIDEBAR_SECTIONS.filter(
    (s) => s.key !== "overview" && s.key !== "asset-maps" && s.key !== "jadwal-pekerjaan"
);

/* ── Cache status types (for initial snapshot) ── */
interface SheetInfo {
    key: string;
    rows: number;
    columns: number;
    age: number;
    fetchMs: number;
}

export function AppSidebar() {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState<string | null>(() => {
        for (const section of COLLAPSIBLE_SECTIONS) {
            if (section.items.some(item => pathname === item.href)) return section.key;
        }
        return null;
    });
    const [showBenchmark, setShowBenchmark] = useState(false);

    const toggleSection = (key: string) => {
        setExpanded(prev => prev === key ? null : key);
    };

    // ── Prefetch on hover (Layer 3) ──
    const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prefetchedRef = useRef<Set<string>>(new Set());

    const handleLinkHover = useCallback((href: string) => {
        if (href === pathname || prefetchedRef.current.has(href)) return;
        if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = setTimeout(() => {
            prefetchedRef.current.add(href);
            fetch(`/api/page-data?page=${encodeURIComponent(href)}`, {
                priority: "low" as RequestPriority,
            }).then(res => {
                if (res.ok) console.log(`[Prefetch] ⚡ Warmed cache for ${href}`);
            }).catch(() => { /* ignore prefetch failures */ });
        }, 100);
    }, [pathname]);

    const handleLinkLeave = useCallback(() => {
        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
            prefetchTimerRef.current = null;
        }
    }, []);

    // ── SSE-based worker status (replaces polling) ──
    const { status, countdown } = useWorkerStatus();
    const { isRefreshing, progress, totalSheets, allSheetNames, groups } = useWorkerProgress();

    const dotColor = isRefreshing ? "bg-blue-500 animate-pulse" :
        status?.rateLimited ? "bg-red-500 animate-pulse" :
            "bg-emerald-500";

    // Benchmark data from initial snapshot
    const cachedSheets = status?.cache.sheets || [];
    const maxFetchMs = Math.max(...cachedSheets.map(s => s.fetchMs), 1);
    const totalFetchMs = cachedSheets.reduce((sum, s) => sum + s.fetchMs, 0);
    const sheetsPerCycle = status?.sheetsPerCycle ?? totalSheets;
    const quotaLimit = status?.quotaLimit ?? 300;
    const usagePct = sheetsPerCycle > 0 ? Math.round((sheetsPerCycle / quotaLimit) * 100) : 0;

    return (
        <Sidebar>
            <SidebarHeader className="p-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 shadow-md">
                        <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold leading-tight">PLN UPT BOGOR</p>
                        <p className="text-[9px] text-muted-foreground">Transmission Dashboard</p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {/* Standalone pages */}
                            {STANDALONE_PAGES.map((section) => {
                                const item = section.items[0];
                                const Icon = item.icon;
                                return (
                                    <SidebarMenuItem key={section.key}>
                                        <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                                            <Link
                                                href={item.href}
                                                onMouseEnter={() => handleLinkHover(item.href)}
                                                onMouseLeave={handleLinkLeave}
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}

                            {/* Expandable sections */}
                            {COLLAPSIBLE_SECTIONS.map(section => {
                                const isExpanded = expanded === section.key;
                                const hasActive = section.items.some(item => pathname === item.href);

                                return (
                                    <SidebarMenuItem key={section.key}>
                                        <SidebarMenuButton
                                            onClick={() => toggleSection(section.key)}
                                            isActive={hasActive}
                                            tooltip={section.label}
                                            className="cursor-pointer"
                                        >
                                            <section.icon className="h-4 w-4" />
                                            <span className="flex-1">{section.label}</span>
                                            {isExpanded
                                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                            }
                                        </SidebarMenuButton>

                                        <SidebarMenuSub
                                            className={`transition-all duration-200 overflow-hidden
                                                ${isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
                                        >
                                            {section.items.map(item => (
                                                <SidebarMenuSubItem key={item.href}>
                                                    <SidebarMenuSubButton
                                                        asChild
                                                        isActive={pathname === item.href}
                                                    >
                                                        <Link
                                                            href={item.href}
                                                            onMouseEnter={() => handleLinkHover(item.href)}
                                                            onMouseLeave={handleLinkLeave}
                                                        >
                                                            <item.icon className="h-3.5 w-3.5" />
                                                            <span>{item.label}</span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ))}
                                        </SidebarMenuSub>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-3 space-y-2">
                {/* ── Worker Status & Benchmark Panel ── */}
                <div className="rounded-lg bg-muted/50 overflow-hidden">
                    {/* Header row — always visible */}
                    <button
                        onClick={() => setShowBenchmark(prev => !prev)}
                        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                        <span className="flex-1 text-left truncate">
                            {isRefreshing
                                ? progress.length > 0
                                    ? `(${progress.length}/${totalSheets}) ${progress[progress.length - 1]?.sheet ?? "..."}`
                                    : "Refreshing data..."
                                : `Refresh in: ${countdown ?? "—"}s`
                            }
                        </span>
                        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${showBenchmark ? "rotate-180" : ""}`} />
                    </button>

                    {/* Quota bar — deterministic */}
                    <div className="px-2.5 pb-1">
                        <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-[4px] bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
                                    style={{ width: `${Math.max(2, usagePct)}%` }}
                                />
                            </div>
                            <span className="text-[8px] tabular-nums text-muted-foreground/60 shrink-0">
                                {sheetsPerCycle}/{quotaLimit}
                            </span>
                        </div>
                    </div>

                    {/* Live progress during refresh */}
                    {isRefreshing && progress.length > 0 && (
                        <div className="px-2.5 pb-1.5">
                            <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                                {progress.map((p, i) => (
                                    <span key={i} className={`text-[8px] ${p.ok ? "text-emerald-500" : "text-red-400"}`}>
                                        {p.ok ? "✓" : "✗"}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Expandable benchmark panel */}
                    <div
                        className={`transition-all duration-200 overflow-y-auto ${showBenchmark ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}
                    >
                        <div className="px-2.5 pb-2 space-y-1">
                            {(() => {
                                // Progress lookup
                                const progressMap = new Map(progress.map(p => [p.sheet, p]));

                                // Always build groups: prefer SSE groups, fallback to cache-derived
                                const displayGroups = groups.length > 0
                                    ? groups
                                    : (() => {
                                        const gm = new Map<string, { spreadsheetId: string; label: string; sheets: string[] }>();
                                        for (const s of cachedSheets) {
                                            const [ssId, sheet] = s.key.includes("::") ? s.key.split("::") : [s.key, s.key];
                                            let g = gm.get(ssId);
                                            if (!g) { g = { spreadsheetId: ssId, label: ssId.slice(0, 12) + "…", sheets: [] }; gm.set(ssId, g); }
                                            g.sheets.push(sheet);
                                        }
                                        return [...gm.values()];
                                    })();

                                // Compute max/total for bar scaling
                                const allMs = isRefreshing
                                    ? progress.map(p => p.ms)
                                    : cachedSheets.map(s => s.fetchMs);
                                const maxMs = Math.max(...allMs, 1);
                                const totalMs = allMs.reduce((a, b) => a + b, 0);

                                // Render one sheet row
                                const sheetRow = (name: string) => {
                                    const p = progressMap.get(name);
                                    const cached = cachedSheets.find(s => (s.key.split("::")[1] || s.key) === name);
                                    const isWaiting = isRefreshing && !p;
                                    const isError = p && !p.ok;
                                    const ms = isRefreshing ? (p?.ms ?? 0) : (cached?.fetchMs ?? 0);
                                    const pct = isWaiting ? 0 : ms > 0 ? Math.max(4, (ms / maxMs) * 100) : 4;
                                    const barColor = isError ? "bg-red-500/60"
                                        : ms > 2000 ? "bg-red-500/60"
                                            : ms > 1000 ? "bg-amber-500/60"
                                                : "bg-emerald-500/60";
                                    return (
                                        <div key={name} className={`flex items-center gap-1.5 pl-1 ${isWaiting ? "opacity-30" : ""}`}>
                                            <span className="text-[9px] text-muted-foreground truncate w-[76px] shrink-0" title={name}>
                                                {name}
                                            </span>
                                            <div className="flex-1 h-[5px] bg-muted rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-[9px] tabular-nums text-muted-foreground w-[34px] text-right shrink-0">
                                                {isWaiting ? "⏳" : isError ? "ERR"
                                                    : ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}
                                            </span>
                                        </div>
                                    );
                                };

                                return (
                                    <>
                                        {/* Summary */}
                                        <div className="flex justify-between text-[9px] text-muted-foreground/70 px-0.5 pb-1 border-b border-border/50">
                                            <span>
                                                {isRefreshing
                                                    ? `${progress.length}/${totalSheets} fetching...`
                                                    : `${cachedSheets.length} sheets cached`}
                                            </span>
                                            <span>
                                                {totalMs > 1000
                                                    ? `${(totalMs / 1000).toFixed(1)}s total`
                                                    : `${totalMs}ms total`}
                                            </span>
                                        </div>

                                        {cachedSheets.length === 0 && !isRefreshing && (
                                            <p className="text-[9px] text-muted-foreground/50 py-2 text-center">
                                                Menunggu cycle pertama...
                                            </p>
                                        )}

                                        {/* Always grouped */}
                                        {displayGroups.map(g => (
                                            <div key={g.spreadsheetId}>
                                                <div className="flex justify-between text-[8px] text-muted-foreground/50 uppercase tracking-wider pt-1.5 pb-0.5 px-0.5">
                                                    <span className="font-medium">{g.label}</span>
                                                    <span>{g.sheets.length} sheets</span>
                                                </div>
                                                {g.sheets.map(sheetRow)}
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* ── Admin card ── */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                    <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">AD</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold truncate">Admin UPT</p>
                        <p className="text-[9px] text-muted-foreground">Bogor</p>
                    </div>
                    <LogOut className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition" />
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
