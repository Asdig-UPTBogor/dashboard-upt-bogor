"use client";

import type { ReactNode, CSSProperties, MouseEventHandler } from "react";

/**
 * DCard — replicate Claude Designer Card pattern dari components.jsx.
 * Header: padding 16/20, border-bottom, title 13/600, subtitle 11.5/fg-2.
 * Body: padding 20.
 *
 * Token mapping (CSS var globals.css):
 *   --bg-1   → var(--card)
 *   --line   → var(--border)
 *   --fg-0   → var(--foreground)
 *   --fg-2   → var(--muted-foreground)
 *   --r-lg   → 0.5rem (rounded-lg)
 */

interface DCardProps {
    title?: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
    /** Hilangkan padding body (untuk table/list yg flush) */
    noPad?: boolean;
    /** Hilangkan body sama sekali */
    noBody?: boolean;
    style?: CSSProperties;
    className?: string;
    onClick?: MouseEventHandler<HTMLElement>;
}

export function DCard({ title, subtitle, actions, children, noPad, noBody, style, className, onClick }: DCardProps) {
    const hasHeader = title || subtitle || actions;
    return (
        <section
            onClick={onClick}
            className={className}
            style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                boxShadow: "var(--shadow-sm)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                cursor: onClick ? "pointer" : undefined,
                transition: "box-shadow .15s, border-color .15s",
                ...style,
            }}
        >
            {hasHeader && (
                <header
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border)",
                        gap: 12,
                    }}
                >
                    <div style={{ minWidth: 0 }}>
                        {title && (
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    letterSpacing: "-0.01em",
                                    color: "var(--foreground)",
                                }}
                            >
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 11.5,
                                    color: "var(--muted-foreground)",
                                }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {actions && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{actions}</div>
                    )}
                </header>
            )}
            {!noBody && (
                <div style={{ padding: noPad ? 0 : "20px", flex: 1, minHeight: 0 }}>
                    {children}
                </div>
            )}
        </section>
    );
}
