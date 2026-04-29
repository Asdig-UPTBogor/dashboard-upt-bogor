import React from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  noPad?: boolean;
  noBody?: boolean;
  className?: string;
}

export function Card({ title, subtitle, actions, children, style, noPad, noBody, className }: CardProps) {
  return (
    <section
      className={className}
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-1)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {(title || subtitle || actions) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-0)" }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--fg-2)" }}>{subtitle}</p>
            )}
          </div>
          {actions && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{actions}</div>
          )}
        </header>
      )}
      {!noBody && (
        <div style={{ padding: noPad ? 0 : 20, flex: 1, minHeight: 0 }}>{children}</div>
      )}
      {noBody && children}
    </section>
  );
}
