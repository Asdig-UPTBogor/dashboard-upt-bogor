"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    ChevronRight, ChevronDown,
    BarChart3, TrendingUp, Gauge, Building2, Shield,
    Radio, FileText, Activity, MapPin, Zap, Route, ShieldAlert,
    Wrench, Database, RefreshCw, TreePine, Hammer,
    FileImage, FileCheck, CalendarDays, LogOut, BatteryCharging,
    ClipboardList
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PAGE_ICONS } from "@/lib/page-icons";
import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
    SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
    SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ── Sidebar Menu Configuration ── */
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

const SIDEBAR_SECTIONS: SidebarSection[] = [
    {
        key: "general",
        label: "General Informasi",
        icon: BarChart3,
        items: [
            { href: "/general/jadwal-pekerjaan", label: "Jadwal Pekerjaan", icon: ClipboardList },
            { href: "/general/trend-gangguan", label: "Trend Gangguan", icon: TrendingUp },
            { href: "/general/pembebanan", label: "Pembebanan Trafo & Penghantar", icon: Gauge },
            { href: "/general/asset-transmisi", label: "Asset Transmisi", icon: Radio },
            { href: "/general/asset-gi", label: "Asset Gardu Induk", icon: Building2 },
            { href: "/general/asset-proteksi", label: "Asset Proteksi", icon: Shield },
        ],
    },
    {
        key: "transmisi",
        label: "Transmisi",
        icon: Radio,
        items: [
            { href: "/transmisi/asset", label: "Asset Transmisi", icon: FileText },
            { href: "/transmisi/program-kerja", label: "Program Kerja Jaringan", icon: CalendarDays },
            { href: "/transmisi/healty-index", label: "Healty Index Transmisi", icon: Activity },
            { href: "/transmisi/tower", label: "Tower", icon: MapPin },
            { href: "/transmisi/anomali", label: "Anomali Tower", icon: ShieldAlert },
            { href: "/transmisi/petir", label: "Petir", icon: Zap },
            { href: "/transmisi/row", label: "Row", icon: Route },
        ],
    },
    {
        key: "gardu-induk",
        label: "Gardu Induk",
        icon: Building2,
        items: [
            { href: "/gardu-induk", label: "Asset Gardu Induk", icon: FileText },
            { href: "/gardu-induk/program-kerja", label: "Program Kerja Gardu Induk", icon: CalendarDays },
            { href: "/gardu-induk/healty-index", label: "Healty Index MTU", icon: Activity },
            { href: "/gardu-induk/hi-trafo", label: "HI Trafo", icon: Activity },
            { href: "/gardu-induk/kelengkapan-trafo", label: "Kelengkapan Trafo", icon: Gauge },
        ],
    },
    {
        key: "proteksi",
        label: "Proteksi",
        icon: Shield,
        items: [
            { href: "/proteksi/asset", label: "Asset Proteksi", icon: FileText },
            { href: "/proteksi/program-kerja", label: "Program Kerja Proteksi", icon: CalendarDays },
            { href: "/proteksi/healty-index", label: "Healty Index Proteksi", icon: Activity },
            { href: "/proteksi/remote-reading", label: "Remote Reading Proteksi", icon: RefreshCw },
            { href: "/proteksi/catu-daya", label: "Catu Daya dan Battery", icon: BatteryCharging },
        ],
    },
    {
        key: "utilities",
        label: "Utilities",
        icon: Hammer,
        items: [
            { href: "/utilities/sld-viewer", label: "SLD Viewer", icon: FileImage },
            { href: "/utilities/ba-maker", label: "BA Maker", icon: FileCheck },
            { href: "/utilities/weekly-post", label: "Weekly Post Maker", icon: CalendarDays },
        ],
    },
    {
        key: "maintenance",
        label: "Maintenance & Admin",
        icon: Wrench,
        items: [
            { href: "/maintenance/data-source", label: "Data Source Manager", icon: Database },
            { href: "/maintenance/sync-log", label: "Sync Log", icon: RefreshCw },
            { href: "/maintenance/tree-data", label: "Tree Data", icon: TreePine },
        ],
    },
];

export function AppSidebar() {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState<string | null>(() => {
        // Auto-expand section that contains current route
        for (const section of SIDEBAR_SECTIONS) {
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
                            {/* Overview — always visible, no sub-menu */}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Overview">
                                    <Link href="/">
                                        {(() => { const I = PAGE_ICONS["/"]; return I ? <I className="h-4 w-4" /> : null; })()}
                                        <span>Overview</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Asset Maps — standalone */}
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === "/asset-maps"} tooltip="Asset Maps">
                                    <Link href="/asset-maps">
                                        {(() => { const I = PAGE_ICONS["/asset-maps"]; return I ? <I className="h-4 w-4" /> : null; })()}
                                        <span>Asset Maps</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Expandable sections */}
                            {SIDEBAR_SECTIONS.map(section => {
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

                                        {/* Sub-menu */}
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
