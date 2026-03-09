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
}

export interface SidebarSectionDef {
    key: string;
    label: string;
    iconName: string;
    items: SidebarPageItem[];
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
        key: "jadwal-pekerjaan",
        label: "Jadwal Pekerjaan",
        iconName: "ClipboardList",
        items: [
            { href: "/jadwal-pekerjaan", label: "Jadwal Pekerjaan", iconName: "ClipboardList" },
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
            { href: "/transmisi/program-kerja", label: "Program Kerja Jaringan", iconName: "CalendarDays" },
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
            { href: "/maintenance/data-source", label: "Data Source Manager", iconName: "Database" },
            { href: "/maintenance/data-connector", label: "Data Connector", iconName: "Cable" },
            { href: "/maintenance/dashboard-data", label: "Dashboard Data", iconName: "Table2" },
            { href: "/maintenance/worker-sync", label: "Worker Sync", iconName: "Activity" },
            { href: "/maintenance/page-builder", label: "Page Builder", iconName: "LayoutGrid" },
            { href: "/maintenance/test-page", label: "Test Page", iconName: "FlaskConical" },
            { href: "/maintenance/sync-log", label: "Sync Log", iconName: "RefreshCw" },
            { href: "/maintenance/tree-data", label: "Tree Data", iconName: "TreePine" },
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
    return SIDEBAR_SECTIONS.flatMap((section) =>
        section.items.map((item) => ({
            path: item.href,
            label: item.label,
            section: section.label,
            sectionIconName: section.iconName,
            iconName: item.iconName,
            recommendedRoute: `/api${item.href}`,
        }))
    );
}

/**
 * Find a page by its path.
 */
export function findPageByPath(path: string): FlatPage | undefined {
    return getAllPages().find((p) => p.path === path);
}
