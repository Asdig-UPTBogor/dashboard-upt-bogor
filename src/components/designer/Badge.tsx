import React from "react";

type Tone = "neutral" | "very-good" | "good" | "fair" | "poor" | "critical";

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  size?: "sm" | "md";
}

const TONES: Record<Tone, { bg: string; fg: string }> = {
  "neutral":   { bg: "rgba(168,176,189,0.14)", fg: "var(--fg-1)" },
  "very-good": { bg: "rgba(62,207,142,0.14)",  fg: "var(--cond-very-good)" },
  "good":      { bg: "rgba(141,216,132,0.14)", fg: "var(--cond-good)" },
  "fair":      { bg: "rgba(243,193,75,0.18)",  fg: "var(--cond-fair)" },
  "poor":      { bg: "rgba(240,138,62,0.18)",  fg: "var(--cond-poor)" },
  "critical":  { bg: "rgba(229,72,77,0.18)",   fg: "var(--cond-critical)" },
};

export function Badge({ tone = "neutral", children, dot = false, size = "md" }: BadgeProps) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: size === "sm" ? "2px 8px" : "3px 10px",
        background: t.bg,
        color: t.fg,
        borderRadius: 999,
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: t.fg,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
