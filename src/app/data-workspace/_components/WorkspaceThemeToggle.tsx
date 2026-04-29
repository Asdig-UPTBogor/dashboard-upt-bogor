"use client";

/**
 * WorkspaceThemeToggle — cycle light → dark → system → light …
 *
 *  Mengikuti convention di ThemeProvider (next-themes). Kompak, cocok di chrome
 *  workspace (hidden sm labels, icon-only pada mobile).
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { WORKSPACE_OVERLAY } from "./workspace-tokens";

const ORDER = ["light", "dark", "system"] as const;
type Theme = typeof ORDER[number];

const ICON: Record<Theme, React.ComponentType<{ className?: string }>> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
};

const LABEL: Record<Theme, string> = {
    light: "Light",
    dark: "Dark",
    system: "System",
};

export function WorkspaceThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const current = (theme ?? "system") as Theme;
    const Icon = ICON[current] ?? Monitor;
    const nextTheme: Theme = (() => {
        const idx = ORDER.indexOf(current);
        return ORDER[(idx + 1) % ORDER.length];
    })();

    if (!mounted) {
        return (
            <div
                style={{ width: WORKSPACE_OVERLAY.THEME_PLACEHOLDER_PX }}
                className="h-7 shrink-0"
                aria-hidden
            />
        );
    }

    return (
        <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            title={`Theme: ${LABEL[current]} · click for ${LABEL[nextTheme]}`}
            aria-label={`Switch to ${LABEL[nextTheme]} theme`}
            className="ds-transition inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2 py-0.5 ds-small hover:bg-muted/40 shrink-0"
        >
            <Icon className="h-3 w-3 opacity-70" />
            <span className="hidden sm:inline capitalize">{current}</span>
        </button>
    );
}
