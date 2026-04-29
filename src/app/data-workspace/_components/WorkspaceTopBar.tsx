"use client";

/**
 * WorkspaceTopBar — Row 1 chrome.
 *
 *   ┌─ Brand cell (auto width) ─┬─ Breadcrumb ────────────┬─ Utils ──┐
 *   │ 📁 DATA WORKSPACE         │ ‹ Master_Data › UPT       │  …      │
 *   └────────────────────────────┴──────────────────────────┴─────────┘
 *
 *  Sidebar collapse/expand handled di vertical divider WorkspaceShell
 *  (center-toggle pattern), bukan di topbar lagi.
 *  Mobile: hamburger ditampilkan untuk open drawer overlay.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import {
    DatabaseZap, LogOut, ChevronRight, Menu,
} from "lucide-react";
import { WORKSPACE_CHROME } from "./workspace-tokens";
import { WorkspaceClock } from "./WorkspaceClock";
import { WorkspaceThemeToggle } from "./WorkspaceThemeToggle";

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

export function WorkspaceTopBar({
    breadcrumb = [],
    onOpenMobileSidebar,
    sidebarWidth,
    sidebarDragging,
}: {
    breadcrumb?: BreadcrumbItem[];
    onOpenMobileSidebar?: () => void;
    /** Effective sidebar width (collapsed/mobile → 0). Brand cell matches ini supaya
     *  breadcrumb mulai sejajar dengan divider sidebar↔main. */
    sidebarWidth?: number;
    /** True saat user lagi drag resize handle — disable width transition agar snap follow cursor. */
    sidebarDragging?: boolean;
}) {
    const router = useRouter();

    async function logout() {
        await fetch("/api/workspace/auth/logout", { method: "POST" });
        router.replace("/data-workspace/login");
    }

    return (
        <header
            className="shrink-0 flex items-center border-b border-border/60 bg-card/40 backdrop-blur"
            style={{ height: WORKSPACE_CHROME.ROW_HEIGHT_PX }}
        >
            {/* Brand cell — width = sidebar width (atau auto compact saat collapsed/mobile)
             *  supaya breadcrumb mulai sejajar dengan divider sidebar↔main.
             *  No border-r: topbar = strip horizontal bersih, divider hanya di bawah. */}
            <div
                className={`shrink-0 flex items-center gap-2 px-3 h-full overflow-hidden ${
                    sidebarDragging ? "" : "transition-[width] duration-200 ease-out"
                }`}
                style={sidebarWidth ? { width: sidebarWidth } : undefined}
            >
                {/* Mobile hamburger — show on small only */}
                {onOpenMobileSidebar && (
                    <button
                        type="button"
                        onClick={onOpenMobileSidebar}
                        aria-label="Open sidebar"
                        className="md:hidden ds-transition rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    >
                        <Menu className="h-4 w-4" />
                    </button>
                )}
                <Link href="/data-workspace" className="flex items-center gap-2 min-w-0 group/brand">
                    <div
                        style={{ height: WORKSPACE_CHROME.BRAND_BOX_PX, width: WORKSPACE_CHROME.BRAND_BOX_PX }}
                        className="rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0"
                    >
                        <DatabaseZap className="h-4 w-4 text-primary" strokeWidth={2.25} />
                    </div>
                    <span className="ds-label truncate group-hover/brand:text-primary ds-transition hidden sm:inline">
                        Data Workspace
                    </span>
                </Link>
            </div>

            {/* Breadcrumb — FLAT flex row (no nested li), semua sibling di 1 parent.
             *  Items-center center-align icon ↔ text di cross-axis. Tiap text wrapped
             *  div fixed h-4 supaya cross-axis size konsisten meski font weight beda
             *  (regular vs medium punya line-box height beda di Geist). */}
            <nav
                className="flex-1 min-w-0 px-3 overflow-hidden flex items-center"
                aria-label="Breadcrumb"
            >
                <div className="flex items-center min-w-0 text-xs gap-1.5">
                    {breadcrumb.map((b, i) => {
                        const last = i === breadcrumb.length - 1;
                        const labelCls = last
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground ds-transition";
                        const text = (
                            <div className="h-4 flex items-center min-w-0 max-w-[300px]">
                                <span className={`${labelCls} truncate leading-none`}>{b.label}</span>
                            </div>
                        );
                        return (
                            <Fragment key={i}>
                                {i > 0 && (
                                    <ChevronRight
                                        className="h-3 w-3 opacity-40 shrink-0"
                                        strokeWidth={2}
                                    />
                                )}
                                {b.href && !last
                                    ? <Link href={b.href} className="min-w-0 max-w-[300px] flex items-center">{text}</Link>
                                    : text}
                            </Fragment>
                        );
                    })}
                </div>
            </nav>

            {/* Utilities */}
            <div
                className="flex items-center shrink-0 pr-2"
                style={{ gap: WORKSPACE_CHROME.GAP_PX * 2 }}
            >
                <WorkspaceClock />
                <WorkspaceThemeToggle />
                <button
                    type="button"
                    onClick={logout}
                    className="ds-transition text-xs inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    title="End session"
                    aria-label="Sign out"
                >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Sign out</span>
                </button>
            </div>
        </header>
    );
}
