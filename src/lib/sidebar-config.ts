/**
 * Shared Sidebar Configuration — Single Source of Truth
 *
 * All dashboard pages and their menu structure are defined here.
 * Used by: AppSidebar (navigation), Data Source Manager (page linking & icons).
 *
 * Icon names are stored as strings so this file works in both
 * server and client contexts. The actual LucideIcon components
 * are resolved on the client side via page-icons.ts.
 */

/* ── Types ── */

export interface SidebarPageItem {
    href: string;
    label: string;
    iconName: string; // Lucide icon name, e.g. "Shield", "MapPin"
    /** Open in new tab (uses target="_blank" + rel="noopener"). */
    newTab?: boolean;
}

/** Support 1-level nested group inside a section (e.g. Master Data collapsible). */
export interface SidebarSubGroup {
    key: string;
    label: string;
    iconName: string;
    items: SidebarPageItem[];
}

export type SidebarSectionEntry = SidebarPageItem | SidebarSubGroup;

export function isSidebarSubGroup(x: SidebarSectionEntry): x is SidebarSubGroup {
    return "items" in x && Array.isArray((x as SidebarSubGroup).items);
}

export interface SidebarSectionDef {
    key: string;
    label: string;
    iconName: string;
    items: SidebarSectionEntry[];
}

/* ── Menu Structure ── */

export const SIDEBAR_SECTIONS: SidebarSectionDef[] = [
    {
        key: "overview",
        label: "Overview",
        iconName: "LayoutDashboard",
        items: [
            { href: "/overview", label: "Overview", iconName: "LayoutDashboard" },
        ],
    },
    {
        key: "ce-next-level",
        label: "CE Next Level",
        iconName: "TrendingUp",
        items: [
            { href: "/ce-next-level", label: "CE Next Level", iconName: "TrendingUp" },
        ],
    },
    {
        key: "jadwal-pekerjaan",
        label: "Jadwal Pekerjaan",
        iconName: "ClipboardList",
        items: [
            { href: "/jadwal-pekerjaan", label: "Jadwal Pekerjaan", iconName: "ClipboardList" },
        ],
    },
    {
        key: "program-kerja",
        label: "Monitoring Program Kerja",
        iconName: "CalendarDays",
        items: [
            { href: "/program-kerja", label: "Monitoring Program Kerja", iconName: "CalendarDays" },
        ],
    },
    {
        key: "general",
        label: "General Informasi",
        iconName: "BarChart3",
        items: [

            { href: "/general/trend-gangguan", label: "Trend Gangguan", iconName: "TrendingUp" },
            { href: "/general/pembebanan", label: "Pembebanan Trafo & Penghantar", iconName: "Gauge" },
            { href: "/general/asset-transmisi", label: "Asset Transmisi", iconName: "Radio" },
            { href: "/general/asset-gi", label: "Asset Gardu Induk", iconName: "Building2" },
            { href: "/general/asset-proteksi", label: "Asset Proteksi", iconName: "Shield" },
        ],
    },
    {
        key: "transmisi",
        label: "Transmisi",
        iconName: "Radio",
        items: [
            { href: "/transmisi/asset", label: "Asset Transmisi", iconName: "FileText" },
            { href: "/transmisi/kerawanan", label: "Kerawanan Transmisi", iconName: "AlertTriangle" },
            { href: "/transmisi/monitoring-tower-kritis", label: "Monitoring Tower Kritis", iconName: "Radio" },
            { href: "/transmisi/anomali", label: "Anomali Tower", iconName: "ShieldAlert" },
            { href: "/transmisi/sld-tower", label: "SLD Tower", iconName: "FileImage" },
            { href: "/transmisi/program-kerja", label: "Program Kerja Transmisi", iconName: "CalendarDays" },
            { href: "/transmisi/healthy-index", label: "Healthy Index Transmisi", iconName: "Activity" },
            { href: "/transmisi/tower", label: "Tower", iconName: "MapPin" },
            { href: "/transmisi/petir", label: "Petir", iconName: "Zap" },
            { href: "/transmisi/row", label: "Row", iconName: "Route" },
        ],
    },
    {
        key: "gardu-induk",
        label: "Gardu Induk",
        iconName: "Building2",
        items: [
            { href: "/gardu-induk", label: "Asset Gardu Induk", iconName: "FileText" },
            { href: "/gardu-induk/program-kerja", label: "Program Kerja Gardu Induk", iconName: "CalendarDays" },
            { href: "/gardu-induk/healthy-index", label: "Healthy Index MTU", iconName: "Activity" },
            { href: "/gardu-induk/hi-trafo", label: "Health Index Trafo", iconName: "Gauge" },
            { href: "/gardu-induk/kelengkapan-trafo", label: "Kelengkapan Trafo", iconName: "Gauge" },
        ],
    },
    {
        key: "proteksi",
        label: "Proteksi",
        iconName: "Shield",
        items: [
            { href: "/proteksi/asset", label: "Asset Proteksi", iconName: "FileText" },
            { href: "/proteksi/program-kerja", label: "Program Kerja Proteksi", iconName: "CalendarDays" },
            { href: "/proteksi/healthy-index", label: "Healthy Index Proteksi", iconName: "Activity" },
            { href: "/proteksi/remote-reading", label: "Remote Reading Proteksi", iconName: "RefreshCw" },
            { href: "/proteksi/catu-daya", label: "Catu Daya dan Battery", iconName: "BatteryCharging" },
        ],
    },
    {
        key: "asset-maps",
        label: "Asset Maps",
        iconName: "MapPin",
        items: [
            { href: "/asset-maps", label: "Asset Maps", iconName: "MapPin" },
        ],
    },
    {
        key: "utilities",
        label: "Utilities",
        iconName: "Hammer",
        items: [
            { href: "/utilities/sld-viewer", label: "SLD Viewer", iconName: "FileImage" },
            { href: "/utilities/ba-maker", label: "BA Maker", iconName: "FileCheck" },
            { href: "/utilities/weekly-post", label: "Weekly Post Maker", iconName: "CalendarDays" },
        ],
    },
    {
        key: "maintenance",
        label: "Maintenance & Admin",
        iconName: "Wrench",
        items: [
            // SS V5 Hub — 1 entry konsolidasi (Add Spreadsheet + DSM Inspector + Master Wizard + Page Config)
            { href: "/maintenance/data-connector-v5", label: "Data Connector V5", iconName: "Cable" },
            // Legacy V4 (paralel, tetap ada sampai migrate)
            { href: "/maintenance/data-source", label: "Data Source Manager (V4)", iconName: "Database" },
            { href: "/maintenance/data-connector", label: "Data Connector (V4)", iconName: "Cable" },
            // Non-V5 utilities
            { href: "/maintenance/dashboard-data", label: "Dashboard Data", iconName: "Table2" },
            { href: "/maintenance/page-builder", label: "Page Builder", iconName: "LayoutGrid" },
            { href: "/maintenance/test-page", label: "Test Page", iconName: "FlaskConical" },
            { href: "/maintenance/sync-log", label: "Sync Log", iconName: "RefreshCw" },
            { href: "/maintenance/tree-data", label: "Tree Data", iconName: "TreePine" },
            { href: "/maintenance/design-dictionary", label: "Kamus Design FE", iconName: "BookOpen" },
        ],
    },
    {
        key: "data-workspace",
        label: "Data Workspace",
        iconName: "DatabaseZap",
        // Single entry that opens in a new tab — dedicated full-screen editor
        // at /data-workspace (password-gated via middleware).
        items: [
            { href: "/data-workspace", label: "Open workspace", iconName: "DatabaseZap", newTab: true },
        ],
    },
    {
        key: "cloud-console",
        label: "Cloud Console",
        iconName: "Cloud",
        items: [
            { href: "/cloud-console", label: "Cloud Console", iconName: "Cloud" },
        ],
    },
];

/* ── Flat page list (for dropdowns, search, etc.) ── */

export interface FlatPage {
    path: string;           // e.g. "/proteksi/asset"
    label: string;          // e.g. "Asset Proteksi"
    section: string;        // e.g. "Proteksi"
    sectionIconName: string; // e.g. "Shield" (parent section icon)
    iconName: string;       // e.g. "FileText" (item-level icon)
    recommendedRoute: string; // e.g. "/api/proteksi/asset"
}

/**
 * Get a flat list of all pages from all sidebar sections.
 * Each page includes a recommended API route derived from its path.
 */
export function getAllPages(): FlatPage[] {
    const pages: FlatPage[] = [];
    for (const section of SIDEBAR_SECTIONS) {
        for (const entry of section.items) {
            if (isSidebarSubGroup(entry)) {
                for (const child of entry.items) {
                    pages.push({
                        path: child.href,
                        label: child.label,
                        section: `${section.label} › ${entry.label}`,
                        sectionIconName: section.iconName,
                        iconName: child.iconName,
                        recommendedRoute: `/api${child.href}`,
                    });
                }
            } else {
                pages.push({
                    path: entry.href,
                    label: entry.label,
                    section: section.label,
                    sectionIconName: section.iconName,
                    iconName: entry.iconName,
                    recommendedRoute: `/api${entry.href}`,
                });
            }
        }
    }
    return pages;
}

/**
 * Find a page by its path.
 */
export function findPageByPath(path: string): FlatPage | undefined {
    return getAllPages().find((p) => p.path === path);
}
