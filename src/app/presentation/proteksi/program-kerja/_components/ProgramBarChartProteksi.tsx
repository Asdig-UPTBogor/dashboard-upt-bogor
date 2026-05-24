"use client";
import type { ProteksiItem } from "../_data/proteksi-items";

interface Props {
    items: ProteksiItem[];
    accent: string;
    cols?: number;
}

export function ProgramBarChartProteksi({ items, accent, cols = 1 }: Props) {
    const safeCols = Math.max(1, cols);

    if (items.length === 0) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "var(--fg-2)", fontSize: 12 }}>
                Belum ada program.
            </div>
        );
    }

    /* Sort: target > 0 di atas (descending %), target = 0 paling akhir */
    const sorted = [...items].sort((a, b) => {
        const pa = a.totalTarget === 0 ? -1 : a.totalPersen;
        const pb = b.totalTarget === 0 ? -1 : b.totalPersen;
        return pb - pa;
    });

    const itemsPerCol = Math.ceil(sorted.length / safeCols);
    const columns: ProteksiItem[][] = [];
    for (let c = 0; c < safeCols; c++) {
        columns.push(sorted.slice(c * itemsPerCol, (c + 1) * itemsPerCol));
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))`,
                gap: safeCols > 1 ? 24 : 14,
                height: "100%",
            }}
        >
            {columns.map((col, ci) => {
                const isLast = ci === safeCols - 1;
                return (
                    <div
                        key={ci}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                            minWidth: 0,
                            borderRight: !isLast && safeCols > 1 ? "1px solid var(--line)" : undefined,
                            paddingRight: !isLast && safeCols > 1 ? 20 : 0,
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

function BarRow({ item, accent }: { item: ProteksiItem; accent: string }) {
    const pct = item.totalPersen;
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
                        title={`${item.totalReal} / ${item.totalTarget}${item.totalNt > 0 ? ` · NT ${item.totalNt}` : ""}`}
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
                        <span style={{ color: "var(--fg-0)" }}>{item.totalReal.toLocaleString("id-ID")}</span>
                        <span style={{ margin: "0 4px" }}>/</span>
                        <span>{item.totalTarget.toLocaleString("id-ID")}</span>
                        {item.totalNt > 0 && (
                            <span style={{ marginLeft: 6, color: "#f97316", fontWeight: 700 }}>
                                +{item.totalNt}
                            </span>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
}
