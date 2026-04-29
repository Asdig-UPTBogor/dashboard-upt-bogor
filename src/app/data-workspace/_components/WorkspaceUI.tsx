"use client";

/**
 * WorkspaceUI — shared visual primitives untuk Overview, Dataset hub, dan
 * page-page workspace lainnya.
 *
 *  Goal: konsistensi total — semua page pakai building block yang sama.
 *  Edit 1 component di sini = semua page ikut. Zero hardcoded styling
 *  per page. Animasi/hover/border/typography uniform.
 *
 *  Building blocks:
 *   ▸ <PageShell>      — page container with consistent max-w + spacing
 *   ▸ <PageHeader>     — title + subtitle + action slot
 *   ▸ <SectionHeader>  — minor heading with optional right hint
 *   ▸ <StatRow>        — horizontal stat strip (used in dashboards)
 *   ▸ <StatCard>       — single stat tile (when stats need separate cards)
 *   ▸ <ActionPill>     — small inline button for header action
 *   ▸ <ListContainer>  — wrapper for divided list rows
 *   ▸ <ListRow>        — list item with consistent hover, props-driven
 *   ▸ <EmptyState>     — standard "no data" pattern with optional CTA
 *
 *  All primitives use:
 *   - `ds-interactive` for click feedback
 *   - `ds-press` for tactile press
 *   - `ds-card-hover` for cards (lift + glow on hover)
 *   - Tailwind utility tokens, NO custom hex colors
 */

import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Loader2 } from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

/* ───── PageShell ───── */

export function PageShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto p-5 md:p-6 space-y-5">
                {children}
            </div>
        </div>
    );
}

/* ───── PageHeader ───── */

export function PageHeader({
    title, subtitle, action,
}: {
    title: string;
    subtitle?: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <header className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-0.5">
                <h1 className="text-base font-semibold leading-tight truncate">{title}</h1>
                {subtitle && (
                    <div className="ds-small opacity-50 leading-tight">{subtitle}</div>
                )}
            </div>
            {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </header>
    );
}

/* ───── SectionHeader ───── */

export function SectionHeader({
    title, hint, action,
}: {
    title: string;
    hint?: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-medium opacity-60 uppercase tracking-wider">{title}</h2>
            {hint && <span className="ds-small opacity-40">{hint}</span>}
            {action}
        </div>
    );
}

/* ───── StatRow — horizontal split stats sharing 1 container border ───── */

export function StatRow({ stats }: {
    stats: Array<{ icon: IconType; label: string; value: React.ReactNode }>;
}) {
    return (
        <div
            className="rounded-md border border-border/50 bg-card/30 grid divide-x divide-border/40 overflow-hidden"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
        >
            {stats.map((s, i) => (
                <StatCell key={i} icon={s.icon} label={s.label} value={s.value} />
            ))}
        </div>
    );
}

function StatCell({
    icon: Icon, label, value,
}: {
    icon: IconType;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="px-3 py-2.5 flex items-center gap-2.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider opacity-50 leading-none">
                    {label}
                </div>
                <div className="text-base font-semibold tabular-nums leading-tight mt-1 truncate">
                    {value}
                </div>
            </div>
        </div>
    );
}

/* ───── StatCard — single bordered card (alternative when stats are big enough to warrant it) ───── */

export function StatCard({
    icon: Icon, label, value,
}: {
    icon: IconType;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="ds-card-hover rounded-md border border-border/50 bg-card/30 px-3 py-2.5 flex items-center gap-2.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider opacity-50 leading-none">
                    {label}
                </div>
                <div className="text-base font-semibold tabular-nums leading-tight mt-1 truncate">
                    {value}
                </div>
            </div>
        </div>
    );
}

/* ───── ActionPill — small button for header / inline actions ───── */

export function ActionPill({
    icon: Icon, label, onClick, primary, disabled, busy,
}: {
    icon?: IconType;
    label: string;
    onClick?: () => void;
    primary?: boolean;
    disabled?: boolean;
    busy?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            className={`ds-interactive ds-press ds-focus rounded-md border px-2.5 py-1 inline-flex items-center gap-1.5 text-xs ${
                primary
                    ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/20 hover:border-primary/70"
                    : "border-border/50 bg-card/30 hover:border-primary/40 hover:text-primary"
            }`}
        >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                : Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" /> : null}
            <span>{label}</span>
        </button>
    );
}

/* ───── ListContainer + ListRow ───── */

export function ListContainer({ children }: { children: React.ReactNode }) {
    return (
        <ul className="divide-y divide-border/40 rounded-md border border-border/50 bg-card/20 overflow-hidden">
            {children}
        </ul>
    );
}

export function ListRow({
    href, icon: Icon, title, meta, onClick,
}: {
    /** Link href — kalau ada, pakai <Link>, kalau ga pakai <button> */
    href?: Route | string;
    icon?: IconType;
    title: string;
    /** Right-side metadata (text or React node, displayed inline). */
    meta?: React.ReactNode;
    onClick?: () => void;
}) {
    const inner = (
        <>
            {Icon && (
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover/lr:text-primary ds-transition" />
            )}
            <span className="text-xs flex-1 truncate">{title}</span>
            {meta && <span className="shrink-0 flex items-center gap-2 text-[10px] opacity-60">{meta}</span>}
            <ChevronRight className="h-3 w-3 opacity-30 shrink-0 group-hover/lr:opacity-100 group-hover/lr:text-primary ds-transition" />
        </>
    );

    const cls = "ds-interactive ds-press group/lr flex items-center gap-2.5 px-3 py-1.5";

    return (
        <li>
            {href ? (
                <Link href={href as Route} className={cls}>{inner}</Link>
            ) : (
                <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>
                    {inner}
                </button>
            )}
        </li>
    );
}

/* ───── EmptyState ───── */

export function EmptyState({
    icon: Icon, title, description, action,
}: {
    icon: IconType;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="rounded-md border border-dashed border-border/50 bg-card/20 px-6 py-8 flex flex-col items-center gap-2 text-center max-w-md mx-auto">
            <Icon className="h-7 w-7 opacity-30" />
            <p className="text-sm opacity-70">{title}</p>
            {description && <p className="ds-small opacity-50">{description}</p>}
            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}

/* ───── LoadingState ───── */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
    return (
        <div className="py-10 flex flex-col items-center gap-2 opacity-60">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ds-small">{label}</span>
        </div>
    );
}

/* ───── ErrorBanner ───── */

import { AlertTriangle } from "lucide-react";

export function ErrorBanner({ title, message }: { title?: string; message: string }) {
    return (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
                {title && <div className="font-medium">{title}</div>}
                <div className={title ? "opacity-80 mt-1" : ""}>{message}</div>
            </div>
        </div>
    );
}

/* ───── Chip — for category/badge display ───── */

export function Chip({
    label, value, hint, tone = "default",
}: {
    label: string;
    value?: React.ReactNode;
    hint?: string;
    tone?: "default" | "primary";
}) {
    const cls = tone === "primary"
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border/50 bg-card/30";
    return (
        <span
            title={hint}
            className={`ds-interactive ds-press inline-flex items-center gap-1.5 rounded-md border ${cls} px-2 py-1 text-xs`}
        >
            <span className="truncate max-w-[140px]">{label}</span>
            {value !== undefined && (
                <span className="font-mono opacity-60 tabular-nums">{value}</span>
            )}
        </span>
    );
}
