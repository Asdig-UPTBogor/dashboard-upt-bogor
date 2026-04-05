"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import {
    ChevronRight, ChevronDown,
    BarChart3, TrendingUp, Gauge, Building2, Shield,
    Radio, FileText, Activity, MapPin, Zap, Route,
    Wrench, Database, TreePine, Hammer,
    FileImage, FileCheck, CalendarDays, LogOut, BatteryCharging,
    ClipboardList, LayoutGrid, FlaskConical, LayoutDashboard, Cable,
    Table2, Cloud, Lock, Eye, EyeOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SIDEBAR_SECTIONS as SIDEBAR_CONFIG } from "@/lib/sidebar-config";
import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
    SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
    SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ICON_MAP: Record<string, LucideIcon> = {
    LayoutDashboard, BarChart3, ClipboardList, TrendingUp, Gauge,
    Radio, Building2, Shield, FileText, CalendarDays, Activity,
    MapPin, Zap, Route, Hammer, FileImage, FileCheck, Database,
    Wrench, TreePine, BatteryCharging, LayoutGrid, FlaskConical,
    Cable, Table2, Cloud,
};

const resolveIcon = (name: string): LucideIcon => ICON_MAP[name] || FileText;

interface SubItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

interface SidebarSection {
    key: string;
    label: string;
    icon: LucideIcon;
    items: SubItem[];
}

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

const STANDALONE_KEYS = new Set(["overview", "ce-next-level", "asset-maps", "jadwal-pekerjaan", "program-kerja"]);
const BOTTOM_STANDALONE_KEYS = new Set(["cloud-console"]);

const STANDALONE_PAGES = SIDEBAR_SECTIONS.filter((s) => STANDALONE_KEYS.has(s.key));
const BOTTOM_STANDALONE_PAGES = SIDEBAR_SECTIONS.filter((s) => BOTTOM_STANDALONE_KEYS.has(s.key));

const COLLAPSIBLE_SECTIONS = SIDEBAR_SECTIONS.filter((s) => !STANDALONE_KEYS.has(s.key) && !BOTTOM_STANDALONE_KEYS.has(s.key));

export function AppSidebar() {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState<string | null>(() => {
        for (const section of COLLAPSIBLE_SECTIONS) {
            if (section.items.some(item => pathname === item.href)) return section.key;
        }
        return null;
    });

    /* ── Cloud Console password gate ── */
    const SH_KEY = "sh_unlocked";
    const SH_PASS = "uptbogor2026";
    const [shUnlocked, setShUnlocked] = useState(false);
    const [showPassDialog, setShowPassDialog] = useState(false);
    const [passInput, setPassInput] = useState("");
    const [passError, setPassError] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const passInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (typeof window !== "undefined" && sessionStorage.getItem(SH_KEY) === "1") setShUnlocked(true);
    }, []);

    useEffect(() => {
        if (showPassDialog) setTimeout(() => passInputRef.current?.focus(), 100);
    }, [showPassDialog]);

    const handleShClick = useCallback((e: React.MouseEvent, href: string) => {
        if (shUnlocked) return; // allow normal navigation
        e.preventDefault();
        setShowPassDialog(true);
        setPassInput("");
        setPassError(false);
    }, [shUnlocked]);

    const submitPass = useCallback(() => {
        if (passInput === SH_PASS) {
            setShUnlocked(true);
            setShowPassDialog(false);
            sessionStorage.setItem(SH_KEY, "1");
            // Navigate to Cloud Console
            const shItem = BOTTOM_STANDALONE_PAGES[0]?.items[0];
            if (shItem) window.location.href = shItem.href;
        } else {
            setPassError(true);
        }
    }, [passInput]);

    const toggleSection = (key: string) => {
        setExpanded(prev => prev === key ? null : key);
    };

    const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prefetchedRef = useRef<Set<string>>(new Set());

    const handleLinkHover = useCallback((href: string) => {
        if (href === pathname || prefetchedRef.current.has(href)) return;
        if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = setTimeout(() => {
            prefetchedRef.current.add(href);
            fetch(`/api/page-data?page=${encodeURIComponent(href)}`, {
                priority: "low" as RequestPriority,
            }).catch(() => {
                // Ignore sidebar prefetch errors.
            });
        }, 100);
    }, [pathname]);

    const handleLinkLeave = useCallback(() => {
        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
            prefetchTimerRef.current = null;
        }
    }, []);

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
                            {STANDALONE_PAGES.map((section) => {
                                const item = section.items[0];
                                const Icon = item.icon;
                                return (
                                    <SidebarMenuItem key={section.key}>
                                        <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + "/")} tooltip={item.label}>
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

                            {COLLAPSIBLE_SECTIONS.map((section) => {
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
                                            className={`transition-all duration-200 overflow-hidden ${isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
                                        >
                                            {section.items.map((item) => (
                                                <SidebarMenuSubItem key={item.href}>
                                                    <SidebarMenuSubButton
                                                        asChild
                                                        isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
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

                            {/* Bottom standalone items (e.g. Cloud Console) — after all sections */}
                            {BOTTOM_STANDALONE_PAGES.map((section) => {
                                const item = section.items[0];
                                const Icon = shUnlocked ? item.icon : Lock;
                                return (
                                    <SidebarMenuItem key={section.key}>
                                        <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + "/")} tooltip={item.label}>
                                            <Link
                                                href={item.href}
                                                onClick={(e) => handleShClick(e, item.href)}
                                                onMouseEnter={() => handleLinkHover(item.href)}
                                                onMouseLeave={handleLinkLeave}
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span>{item.label}</span>
                                                {!shUnlocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-3 space-y-2">
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

            {/* Password dialog overlay */}
            {showPassDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPassDialog(false)}>
                    <div className="bg-card border border-border rounded-xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4">
                            <Lock className="h-5 w-5 text-primary" />
                            <h3 className="text-sm font-bold">Cloud Console</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">Masukkan password untuk mengakses Cloud Console</p>
                        <div className="relative mb-3">
                            <input
                                ref={passInputRef}
                                type={showPass ? "text" : "password"}
                                value={passInput}
                                onChange={e => { setPassInput(e.target.value); setPassError(false); }}
                                onKeyDown={e => e.key === "Enter" && submitPass()}
                                placeholder="Password"
                                className={`w-full px-3 py-2 pr-9 text-sm bg-muted/50 border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 transition ${passError ? "border-red-500 shake" : "border-border"}`}
                            />
                            <button onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {passError && <p className="text-[11px] text-red-400 mb-2">Password salah</p>}
                        <div className="flex gap-2">
                            <button onClick={() => setShowPassDialog(false)} className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition">Batal</button>
                            <button onClick={submitPass} className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition">Masuk</button>
                        </div>
                    </div>
                </div>
            )}
        </Sidebar>
    );
}
