import React from "react";
import { Icon } from "./Icon";

interface IconBtnProps {
  icon: string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  size?: number;
}

export function IconBtn({ icon, onClick, active, title, size = 32 }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--bg-2)" : "transparent",
        color: active ? "var(--fg-0)" : "var(--fg-1)",
        border: "1px solid " + (active ? "var(--line-2)" : "var(--line)"),
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        transition: "all .15s ease",
      }}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

interface BtnProps {
  variant?: "ghost" | "primary" | "subtle";
  icon?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  size?: "sm" | "md";
}

const VARIANTS = {
  ghost:   { bg: "transparent",          fg: "var(--fg-1)", bd: "var(--line)" },
  primary: { bg: "var(--accent-amber)",  fg: "#1a1300",     bd: "var(--accent-amber)" },
  subtle:  { bg: "var(--bg-2)",          fg: "var(--fg-0)", bd: "var(--line)" },
};

export function Btn({ variant = "ghost", icon, children, onClick, size = "md" }: BtnProps) {
  const pad = size === "sm" ? "4px 10px" : "6px 12px";
  const v = VARIANTS[variant];
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        background: v.bg,
        color: v.fg,
        border: "1px solid " + v.bd,
        borderRadius: "var(--r-sm)",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}
