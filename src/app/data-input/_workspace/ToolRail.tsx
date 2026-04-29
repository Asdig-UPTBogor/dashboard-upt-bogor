"use client";

/**
 * ToolRail — Workspace Sidebar (vertical activity bar kiri workspace).
 *
 * Pattern reference: VS Code activity bar + Linear navigation.
 *   ▸ Icon-only 48px rail, fixed left
 *   ▸ Active indicator = accent bar di edge kiri button (2px solid primary)
 *     visual strong, konsisten dengan VS Code pattern
 *   ▸ Hover state: bg lembut + text foreground
 *   ▸ Grouping via RailDivider item (type: "divider")
 *   ▸ Badge indicator (count) di kanan-atas icon
 *   ▸ Tooltip via native title attribute + aria-label accessibility
 */

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";

export interface RailAction {
    type?: "action";
    key: string;
    label: string;
    icon: LucideIcon;
    badge?: number | string;
    active?: boolean;
    disabled?: boolean;
    /** Icon spin animation (e.g. Refresh while fetching). */
    isLoading?: boolean;
    tone?: "default" | "success" | "warning" | "destructive";
    onClick: () => void;
}

export interface RailDivider {
    type: "divider";
    key: string;
}

export type RailItem = RailAction | RailDivider;

export function ToolRail({
    items, itemRefs,
}: {
    items: RailItem[];
    /** Optional refs per-item key — caller dapat akses DOM button element. */
    itemRefs?: Record<string, React.RefObject<HTMLButtonElement | null>>;
}) {
    return (
        <nav
            className="shrink-0 w-12 border-r border-border bg-card/40 flex flex-col items-center py-2 gap-0.5"
            aria-label="Workspace sidebar"
        >
            {items.map((it) => {
                if (it.type === "divider") {
                    return <div key={it.key} className="h-px w-6 bg-border/50 my-1.5" aria-hidden />;
                }
                return <RailButton key={it.key} item={it} ref={itemRefs?.[it.key]} />;
            })}
        </nav>
    );
}

const TONE_CLASS: Record<NonNullable<RailAction["tone"]>, string> = {
    default: "text-primary",
    success: "text-emerald-400",
    warning: "text-amber-400",
    destructive: "text-destructive",
};

const TONE_ACCENT_BG: Record<NonNullable<RailAction["tone"]>, string> = {
    default: "bg-primary",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    destructive: "bg-destructive",
};

export const RailButton = forwardRef<HTMLButtonElement, { item: RailAction }>(
    function RailButton({ item }, ref) {
        const Icon = item.icon;
        const isActive = !!item.active;
        const tone = item.tone ?? "default";
        const activeText = TONE_CLASS[tone];
        const accentBg = TONE_ACCENT_BG[tone];

        return (
            <button
                ref={ref}
                type="button"
                onClick={item.onClick}
                disabled={item.disabled}
                title={item.label}
                aria-label={item.label}
                aria-pressed={isActive}
                className={`group relative h-9 w-9 rounded-md flex items-center justify-center ds-transition
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${isActive
                        ? activeText + " bg-foreground/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
            >
                {/* Active accent bar — VS Code pattern, left edge, 2px, rounded-r */}
                <span
                    aria-hidden
                    className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full ds-transition
                        ${isActive ? accentBg : "bg-transparent group-hover:bg-foreground/20"}`}
                />

                <Icon
                    className={`h-4 w-4 ${item.isLoading ? "animate-spin" : ""}`}
                    strokeWidth={isActive ? 2.25 : 2}
                />

                {item.badge != null && (
                    <span
                        className={`absolute -top-0.5 -right-0.5 rounded-full
                            ds-small font-mono font-bold
                            px-1 min-w-[16px] h-4 flex items-center justify-center
                            text-[10px] leading-none shadow-sm
                            ${tone === "warning" ? "bg-amber-500 text-black"
                                : tone === "success" ? "bg-emerald-500 text-white"
                                : tone === "destructive" ? "bg-destructive text-destructive-foreground"
                                : "bg-primary text-primary-foreground"}`}
                    >
                        {item.badge}
                    </span>
                )}
            </button>
        );
    }
);
