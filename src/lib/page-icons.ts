/**
 * Single Source of Truth: Page → Icon mapping
 * 
 * Used by both AppSidebar and Data Source Manager
 * to keep icons consistent. Edit ONLY HERE.
 */
import {
    LayoutDashboard, MapPin, Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const PAGE_ICONS: Record<string, LucideIcon> = {
    "/": LayoutDashboard,
    "/asset-maps": MapPin,
    "/gardu-induk": Building2,
};
