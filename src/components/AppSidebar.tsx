"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    ChevronRight, ChevronDown,
    BarChart3, TrendingUp, Gauge, Building2, Shield,
    Radio, FileText, Activity, MapPin, Zap, Route,
    Wrench, Database, RefreshCw, TreePine, Hammer,
    FileImage, FileCheck, CalendarDays, LogOut, BatteryCharging,
    ClipboardList, LayoutGrid, FlaskConical, LayoutDashboard, Cable,
} from "lucide-react";
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
    (s) => s.key === "overview" || s.key === "asset-maps"
);
const COLLAPSIBLE_SECTIONS = SIDEBAR_SECTIONS.filter(
    (s) => s.key !== "overview" && s.key !== "asset-maps"
);

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
                            {/* Standalone pages (Overview, Asset Maps) */}
                            {STANDALONE_PAGES.map((section) => {
                                const item = section.items[0];
                                const Icon = item.icon;
                                return (
                                    <SidebarMenuItem key={section.key}>
                                        <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                                            <Link href={item.href}>
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
                                                        <Link href={item.href}>
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

            <SidebarFooter className="p-3">
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
