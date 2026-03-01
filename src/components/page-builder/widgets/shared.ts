/* ── Shared utilities for Page Builder widgets ── */

export const COLORS = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
    red: "#ef4444", lime: "#84cc16", sky: "#38bdf8", violet: "#a78bfa",
};

export const CHART_COLORS = [
    COLORS.indigo, COLORS.teal, COLORS.amber, COLORS.purple,
    COLORS.pink, COLORS.emerald, COLORS.rose, COLORS.blue,
    COLORS.cyan, COLORS.orange, COLORS.lime, COLORS.sky,
    COLORS.violet, COLORS.red,
];

export const ECHART_BASE = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Inter, sans-serif", color: "#a1a1aa" },
};

export const ECHART_TOOLTIP = {
    backgroundColor: "rgba(15,15,30,0.9)",
    borderColor: "rgba(129,140,248,0.3)",
    textStyle: { color: "#e4e4e7", fontSize: 12 },
};

/** Count occurrences of a column value in row data, sorted descending */
export function countBy<T extends Record<string, unknown>>(
    rows: T[],
    key: string
): [string, number][] {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
        const v = String(r[key] || "N/A");
        counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
