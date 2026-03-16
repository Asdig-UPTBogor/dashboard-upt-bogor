"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import {
    ChevronRight, ChevronDown,
    BarChart3, TrendingUp, Gauge, Building2, Shield,
    Radio, FileText, Activity, MapPin, Zap, Route,
    Wrench, Database, TreePine, Hammer,
    FileImage, FileCheck, CalendarDays, LogOut, BatteryCharging,
    ClipboardList, LayoutGrid, FlaskConical, LayoutDashboard, Cable,
    Table2, Cloud,
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

const STANDALONE_KEYS = new Set(["overview", "asset-maps", "jadwal-pekerjaan", "program-kerja"]);
const BOTTOM_STANDALONE_KEYS = new Set(["serverless-hub"]);

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

                            {/* Bottom standalone items (e.g. Serverless Hub) — after all sections */}
                            {BOTTOM_STANDALONE_PAGES.map((section) => {
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
        </Sidebar>
    );
}
