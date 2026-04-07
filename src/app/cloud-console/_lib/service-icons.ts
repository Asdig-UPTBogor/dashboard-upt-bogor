/**
 * Shared icon map for Cloud Console services.
 * Registry stores icon as string key (e.g. "Zap").
 * This resolves to the actual Lucide component.
 */

import {
    Cloud, Table2, Zap, Activity, CloudRain, Database,
    MessageSquare, LayoutDashboard, Network, Server,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SERVICE_ICONS: Record<string, LucideIcon> = {
    Table2, Zap, Activity, CloudRain, Database, Cloud,
    MessageSquare, LayoutDashboard, Network, Server,
};

export function resolveIcon(name: string): LucideIcon {
    return SERVICE_ICONS[name] || Cloud;
}
