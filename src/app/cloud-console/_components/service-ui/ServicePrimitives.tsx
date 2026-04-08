"use client";

import React, { useState, useRef } from "react";
import { Eye, EyeOff, ChevronDown, Check, Copy } from "lucide-react";

/* ═══════════════════════════════════════════════════
   ServiceStatCard — Metric readouts
   ═══════════════════════════════════════════════════ */

export function ServiceStatCard({ label, value, icon, alert }: {
    label: string; value: string | number; icon: React.ReactNode; alert?: boolean;
}) {
    return (
        <div className={`rounded-lg border px-4 py-3 ${alert ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-muted/20"}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <div className={`text-lg font-bold font-mono tabular-nums ${alert ? "text-amber-400" : "text-foreground"}`}>
                {value}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   ServiceSection — Collapsible section wrapper
   ═══════════════════════════════════════════════════ */

export function ServiceSection({
    title, icon, badge, badgeColor, children, defaultOpen = true, id, noCollapse = false
}: {
    title: string;
    icon?: React.ReactNode;
    badge?: string;
    badgeColor?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    id?: string;
    noCollapse?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    if (noCollapse) {
        return (
            <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    {icon && <span className="text-muted-foreground/50">{icon}</span>}
                    {title}
                    {badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${badgeColor || "bg-muted text-muted-foreground"}`}>
                            {badge}
                        </span>
                    )}
                </h3>
                {children}
            </div>
        );
    }

    return (
        <div className="border border-border/50 rounded-lg overflow-hidden bg-muted/5">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={id ? `section-${id}` : undefined}
                className="w-full flex items-center justify-between py-3 px-4 group
                    hover:bg-muted/10 border-b border-transparent data-[open=true]:border-border/50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30
                    transition-all duration-150"
                data-open={open}
            >
                <div className="flex items-center gap-2.5 uppercase tracking-wider">
                    {icon && <span className="text-muted-foreground/50">{icon}</span>}
                    <span className="text-[12px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{title}</span>
                    {badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor || "bg-muted text-muted-foreground"}`}>
                            {badge}
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200
                        ${open ? "rotate-180" : "rotate-0"}`}
                    aria-hidden="true"
                />
            </button>
            <div
                id={id ? `section-${id}` : undefined}
                className={`grid transition-[grid-template-rows] duration-300 ease-out
                    ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
                <div className="overflow-hidden">
                    <div className="p-4" data-section={id}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   ServiceGrid — Property-value list (from Spreadsheet Sync)
   ═══════════════════════════════════════════════════ */

export function ServiceGrid({ items, copyFields, copiedField, onCopy }: {
    items: { label: string; value: unknown; highlight?: 'emerald' | 'amber' }[];
    copyFields?: Record<string, string | null | undefined>;
    copiedField?: string | null;
    onCopy?: (text: string, field: string) => void;
}) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                {items.filter(i => i.value !== undefined && i.value !== null).map(({ label, value, highlight }) => (
                    <div key={label} className="flex items-center justify-between py-1 border-b border-border/30">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className={`text-xs font-mono tabular-nums ${
                            highlight === 'emerald' ? 'text-emerald-400' :
                            highlight === 'amber' ? 'text-amber-400' :
                            'text-foreground/80'
                        }`}>
                            {String(value)}
                        </span>
                    </div>
                ))}
            </div>
            {copyFields && onCopy && Object.entries(copyFields).filter(([, v]) => v).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(copyFields).filter(([, v]) => v).map(([label, value]) => (
                        <button key={label} onClick={() => onCopy(value!, label)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                            {copiedField === label ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   InputField & DisplayField
   ═══════════════════════════════════════════════════ */

export function InputField({
    label, value, onChange, placeholder, sensitive = false, mono = false, disabled = false, name,
}: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; sensitive?: boolean; mono?: boolean; disabled?: boolean; name?: string;
}) {
    const [visible, setVisible] = useState(!sensitive);
    const inputId = useRef(`input-${label.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`);

    return (
        <div>
            <label
                htmlFor={inputId.current}
                className="text-xs text-muted-foreground/70 mb-0.5 block cursor-pointer"
            >
                {label}
            </label>
            <div className="relative">
                <input
                    id={inputId.current}
                    name={name || label.replace(/\s+/g, "_").toLowerCase()}
                    type={sensitive && !visible ? "password" : "text"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete={sensitive ? "off" : "on"}
                    spellCheck={false}
                    className={`w-full h-8 pl-3 pr-10 text-[12px] rounded-md border border-border/50
                        bg-muted/20 text-foreground/80 placeholder:text-muted-foreground/30
                        focus-visible:outline-none focus-visible:border-blue-500/50
                        focus-visible:ring-2 focus-visible:ring-blue-500/20
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-[border-color,box-shadow] duration-150
                        ${mono ? "font-mono" : ""}`}
                />
                {sensitive && (
                    <button
                        type="button"
                        onClick={() => setVisible((v) => !v)}
                        aria-label={visible ? "Hide value" : "Show value"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 opacity-40
                            hover:opacity-100 focus-visible:opacity-100
                            transition-opacity duration-150"
                    >
                        {visible
                            ? <EyeOff className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                            : <Eye className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        }
                    </button>
                )}
            </div>
        </div>
    );
}

export function DisplayField({ label, value, color }: {
    label: string; value: string; color?: string;
}) {
    return (
        <div>
            <span className="text-xs text-muted-foreground/70 mb-0.5 block">{label}</span>
            <div className={`w-full h-8 pl-3 pr-3 flex items-center text-[12px] font-mono rounded-md
                border border-border/30 bg-muted/10 select-none overflow-hidden
                tabular-nums ${color || "text-foreground/60"}`}>
                <span className="truncate">{value || "—"}</span>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   Core UI — Toast & Skeletons
   ═══════════════════════════════════════════════════ */

export function ServiceToast({ message, ok }: { message: string; ok: boolean }) {
    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg border text-sm font-medium
                shadow-lg animate-in slide-in-from-right-5
                transition-[opacity,transform] duration-300
                ${ok
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
        >
            {message}
        </div>
    );
}

export function ServiceSkeleton() {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4" aria-busy="true" aria-label="Loading configuration…">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-muted/30 animate-pulse" />
                    <div className="space-y-1.5">
                        <div className="h-4 w-28 rounded bg-muted/30 animate-pulse" />
                        <div className="h-3 w-48 rounded bg-muted/20 animate-pulse" />
                    </div>
                </div>
            </div>
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border/30 bg-card p-5">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted/30 animate-pulse" />
                        <div className="h-4 w-32 rounded bg-muted/30 animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}
