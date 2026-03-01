/**
 * Page Icons — Auto-detected from Sidebar Config
 *
 * Instead of maintaining a separate hardcoded map, this module builds
 * the icon lookup from sidebar-config.ts automatically. When a new page
 * is added to the sidebar, it gets its icon here for free.
 */

import { type LucideIcon } from "lucide-react";
import {
    LayoutDashboard, BarChart3, ClipboardList, TrendingUp, Gauge,
    Radio, Building2, Shield, FileText, CalendarDays, Activity,
    MapPin, Zap, Route, Hammer, FileImage, FileCheck, Database,
    Wrench, RefreshCw, TreePine, BatteryCharging,
} from "lucide-react";
import { getAllPages } from "./sidebar-config";

/* ── Icon Name → Component map ── */
const ICON_MAP: Record<string, LucideIcon> = {
    LayoutDashboard,
    BarChart3,
    ClipboardList,
    TrendingUp,
    Gauge,
    Radio,
    Building2,
    Shield,
    FileText,
    CalendarDays,
    Activity,
    MapPin,
    Zap,
    Route,
    Hammer,
    FileImage,
    FileCheck,
    Database,
    Wrench,
    RefreshCw,
    TreePine,
    BatteryCharging,
};

/* ── Build PAGE_ICONS automatically from sidebar config ── */
const _buildPageIcons = (): Record<string, LucideIcon> => {
    const result: Record<string, LucideIcon> = {};
    for (const page of getAllPages()) {
        // Use the section icon for the page (more recognizable at page-section level)
        const icon = ICON_MAP[page.sectionIconName] || ICON_MAP[page.iconName];
        if (icon) result[page.path] = icon;
    }
    return result;
};

/**
 * Auto-generated icon map: page path → LucideIcon.
 * Derived from sidebar-config.ts — no hardcoding needed.
 */
export const PAGE_ICONS: Record<string, LucideIcon> = _buildPageIcons();

/**
 * Get icon for a given page path.
 * Falls back to Database icon if not found.
 */
export function getPageIcon(path: string): LucideIcon {
    return PAGE_ICONS[path] || Database;
}
