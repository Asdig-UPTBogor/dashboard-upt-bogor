"use client";

/**
 * DStackedBar — replicate Claude Designer StackedBar pattern.
 * Bar: height 8 (default), border-radius 999, gap 2 antar segment, bg var(--muted).
 * Legend: dot 8x8 radius 2, label fg-2, value fg-0 weight 500, % fg-2.
 */

interface Segment {
    label: string;
    value: number;
    color: string;
}

interface DStackedBarProps {
    segments: Segment[];
    height?: number;
    showLegend?: boolean;
}

export function DStackedBar({ segments, height = 8, showLegend = true }: DStackedBarProps) {
    const total = segments.reduce((a, b) => a + b.value, 0) || 1;
    return (
        <div>
            <div
                style={{
                    display: "flex",
                    height,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "var(--muted)",
                    gap: 2,
                }}
            >
                {segments.map((s, i) => {
                    const pct = (s.value / total) * 100;
                    if (pct < 0.3) return null;
                    return (
                        <div
                            key={i}
                            title={`${s.label}: ${s.value.toLocaleString("id-ID")} (${pct.toFixed(1)}%)`}
                            style={{
                                width: pct + "%",
                                background: s.color,
                                transition: "width .4s ease",
                            }}
                        />
                    );
                })}
            </div>
            {showLegend && (
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px 16px",
                        marginTop: 10,
                        fontSize: 11.5,
                        color: "var(--foreground)",
                    }}
                >
                    {segments.map((s, i) => {
                        const pct = (s.value / total) * 100;
                        return (
                            <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 8, height: 8, background: s.color, borderRadius: 2, display: "inline-block" }} />
                                <span style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
                                <span style={{ color: "var(--foreground)", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
                                    {s.value.toLocaleString("id-ID")}
                                </span>
                                <span style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                                    {pct.toFixed(1)}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
