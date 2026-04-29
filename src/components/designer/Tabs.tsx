import React from "react";

interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (value: string) => void;
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)" }}>
      {items.map((it) => {
        const isActive = it.value === active;
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: isActive ? "var(--fg-0)" : "var(--fg-2)",
              border: "none",
              borderBottom: "2px solid " + (isActive ? "var(--accent-amber)" : "transparent"),
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              marginBottom: -1,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "color .15s",
            }}
          >
            {it.label}
            {it.count != null && (
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 7px",
                  borderRadius: 999,
                  background: isActive
                    ? "color-mix(in oklab, var(--accent-amber) 20%, transparent)"
                    : "var(--bg-2)",
                  color: isActive ? "var(--accent-amber)" : "var(--fg-2)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                }}
              >
                {it.count.toLocaleString("id-ID")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
