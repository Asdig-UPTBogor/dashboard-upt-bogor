"use client";

/**
 * StatusDot — semantic status indicator (dot + optional label).
 * Colors pakai Tailwind semantic tokens supaya konsisten dark/light theme.
 */

type DotVariant = 'online' | 'offline' | 'standby' | 'unknown' | 'warn';

const VARIANT_CLASS: Record<DotVariant, { dot: string; ring?: string }> = {
    online: { dot: 'bg-emerald-400', ring: 'shadow-[0_0_6px_rgba(52,211,153,0.5)]' },
    offline: { dot: 'bg-red-400' },
    standby: { dot: 'bg-slate-500' },
    unknown: { dot: 'bg-muted-foreground/30' },
    warn: { dot: 'bg-amber-400' },
};

interface Props {
    variant: DotVariant;
    label?: string;
    title?: string; // tooltip native
}

export function StatusDot({ variant, label, title }: Props) {
    const { dot, ring } = VARIANT_CLASS[variant];
    return (
        <span className="inline-flex items-center gap-1.5" title={title}>
            <span className={`h-2 w-2 rounded-full ${dot} ${ring || ''}`} />
            {label && <span className="ds-small text-muted-foreground/70">{label}</span>}
        </span>
    );
}
