"use client";
import type { ProgramItem } from "../program-kerja-data";

interface Props {
    items: ProgramItem[];
    accent: string;
    /** Jumlah BARIS visible sebelum scroll trigger. Default 6. */
    maxVisible?: number;
    /** Jumlah kolom internal grid (1 atau 2). Default 1. */
    cols?: number;
}

/** Tinggi 1 row (bar + label) — sync sama BarRow content */
const ROW_HEIGHT = 56;
/** Gap antar row dalam 1 kolom */
const ROW_GAP = 14;

/**
 * Bar chart visual untuk card ABO/LM di dashboard.
 * - Render SEMUA item, sort desc by progress %
 * - Tinggi container di-cap di `maxVisible` baris (default 6)
 * - Scroll vertikal kalau item per kolom > maxVisible
 * - Cols=2 = split rata kiri-kanan
 */
export function ProgramBarChart({ items, accent, maxVisible = 6, cols = 1 }: Props) {
    const safeCols = Math.max(1, cols);

    if (items.length === 0) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "var(--fg-2)", fontSize: 12 }}>
                Belum ada program.
            </div>
        );
    }

    const sorted = [...items].sort((a, b) => {
        const pa = a.totalTarget === 0 ? -1 : (a.totalRealisasi / a.totalTarget) * 100;
        const pb = b.totalTarget === 0 ? -1 : (b.totalRealisasi / b.totalTarget) * 100;
        return pb - pa;
    });

    /* Split rata ke N kolom — kolom kiri ambil duluan */
    const itemsPerCol = Math.ceil(sorted.length / safeCols);
    const columns: ProgramItem[][] = [];
    for (let c = 0; c < safeCols; c++) {
        columns.push(sorted.slice(c * itemsPerCol, (c + 1) * itemsPerCol));
    }

    /**
     * Auto-height kalau maxVisible >= itemsPerCol — render all natural (untuk slide deck maxVisible=999).
     * Dashboard caller (maxVisible=6 < itemsPerCol) → fixed cap, scroll per kolom.
     */
    const autoHeight = maxVisible >= itemsPerCol;
    const containerHeight = autoHeight
        ? undefined
        : ROW_HEIGHT * maxVisible + Math.max(0, maxVisible - 1) * ROW_GAP;

    return (
        <div
            className="@container"
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))`,
                columnGap: safeCols > 1 ? 24 : 0,
                height: containerHeight,
                ["--scroll-color" as string]: accent,
            }}
        >
            {columns.map((col, ci) => {
                const isLast = ci === safeCols - 1;
                const colNeedsScroll = col.length > maxVisible;
                return (
                <div
                    key={ci}
                    className={colNeedsScroll ? "ds-scroll-accent" : undefined}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: ROW_GAP,
                        minWidth: 0,
                        height: "100%",
                        overflowY: colNeedsScroll ? "auto" : "visible",
                        paddingRight: colNeedsScroll ? 10 : (isLast || safeCols === 1 ? 0 : 20),
                        scrollbarGutter: colNeedsScroll ? "stable" : "auto",
                        borderRight: !isLast && safeCols > 1 ? "1px solid var(--line)" : undefined,
                    }}
                >
                    {col.map((it, i) => (
                        <BarRow key={`${ci}-${it.no || i}`} item={it} accent={accent} />
                    ))}
                </div>
                );
            })}
        </div>
    );
}

function BarRow({ item, accent }: { item: ProgramItem; accent: string }) {
    const pct = item.totalTarget === 0 ? 0 : (item.totalRealisasi / item.totalTarget) * 100;
    const empty = item.totalTarget === 0;

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "center",
                minWidth: 0,
            }}
        >
            {/* Label nama + bar / empty state */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <span
                    title={item.namaProgram}
                    style={{
                        fontSize: 14,
                        color: "var(--fg-0)",
                        lineHeight: 1.35,
                        fontWeight: 500,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-word",
                        minWidth: 0,
                    }}
                >
                    {item.namaProgram}
                </span>
                {empty ? (
                    <span style={{
                        fontSize: 11,
                        color: "var(--fg-1)",
                        fontStyle: "italic",
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                    }}>
                        Tidak ada target
                    </span>
                ) : (
                    <div
                        style={{
                            height: 10,
                            background: "var(--bg-2)",
                            borderRadius: 5,
                            overflow: "hidden",
                            position: "relative",
                        }}
                        title={`${item.totalRealisasi.toLocaleString("id-ID")} / ${item.totalTarget.toLocaleString("id-ID")}`}
                    >
                        <div
                            style={{
                                width: `${Math.max(2, Math.min(100, pct))}%`,
                                height: "100%",
                                background: accent,
                                borderRadius: 5,
                                transition: "width .4s ease",
                                boxShadow: `0 0 8px ${accent}55`,
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Kanan: persen besar + value/target mono */}
            {!empty && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 2,
                        minWidth: 72,
                        flexShrink: 0,
                        textAlign: "right",
                        fontFamily: "var(--font-mono, monospace)",
                        fontFeatureSettings: '"tnum"',
                    }}
                >
                    <span style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: accent,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                    }}>
                        {pct.toFixed(0)}%
                    </span>
                    <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--fg-1)",
                        letterSpacing: "0.02em",
                        lineHeight: 1.2,
                    }}>
                        <span style={{ color: "var(--fg-0)" }}>{item.totalRealisasi.toLocaleString("id-ID")}</span>
                        <span style={{ color: "var(--fg-1)", margin: "0 4px" }}>/</span>
                        <span style={{ color: "var(--fg-1)" }}>{item.totalTarget.toLocaleString("id-ID")}</span>
                    </span>
                </div>
            )}
        </div>
    );
}
