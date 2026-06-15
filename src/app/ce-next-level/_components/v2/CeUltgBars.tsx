"use client";
import { useState } from "react";
import { Card } from "@/components/designer/Card";
import { SegBar } from "./SegBar";

/** 1 baris bar ULTG — basis angka sama dengan donut (target-only). */
export interface CeUltgBarRow {
    /** Nama ULTG persis dari ce_detail (uppercase) — nilai filter yang sama dengan chip. */
    key: string;
    /** Label tampil, mis. "ULTG BOGOR". */
    name: string;
    /** Total item basis donut (target). */
    total: number;
    /** Item close (realisasi). */
    close: number;
    /** Non-target ("sunnah") — di luar target resmi, ditampilkan kecil oranye. */
    ntTotal?: number;
    ntClose?: number;
    /** Accent ULTG — token domain, fallback accent bidang. */
    accent: string;
}

interface Props {
    rows: CeUltgBarRow[];
    /** Key aktif (filter) — klik row = toggle. */
    active: string | null;
    /** Toggle filter. */
    onToggle: (key: string) => void;
    /** Item tanpa kategori — gak masuk bar, footnote kejujuran data (default 0 = hidden). */
    noUltgCount?: number;
    /** Judul panel setelah kata "Progress". null/undefined = TANPA header (pattern golden PK). */
    title?: string | null;
    /** Arah stack row (default "row" side-by-side; "column" = stacked ke bawah). */
    direction?: "row" | "column";
    /** Render polos tanpa Card wrapper (dipakai di dalam card gabungan). */
    bare?: boolean;
    /** Override style Card (mis. flex:1 saat di dalam flex container). */
    style?: React.CSSProperties;
}

const COLOR_CLOSE = "var(--cond-very-good)";
const COLOR_OPEN = "var(--cond-poor)";

/** Token warna domain per ULTG (globals.css) — fallback ke accent bidang. */
export function ultgColor(name: string, fallback: string): string {
    const n = name.toUpperCase();
    if (n.includes("BOGOR")) return "var(--color-ultg-bogor)";
    if (n.includes("SUKABUMI")) return "var(--color-ultg-sukabumi)";
    return fallback;
}

/**
 * Panel progress bar segmented (pattern UltgProgressCard Transmisi:
 * bar close/open semantik + active ring + hover tint + dim) — klik row = filter.
 * Reusable: Per ULTG (default) maupun Per Program Kerja (via prop `title`).
 */
export function CeUltgBars({ rows, active, onToggle, noUltgCount = 0, title = null, direction = "row", bare = false, style }: Props) {
    const Wrapper = bare ? "div" : Card;
    return (
        <Wrapper style={style} {...(bare ? {} : { noPad: true })}>
            {title && (
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--line)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <span style={{ width: 16, height: 1.5, background: "var(--cond-very-good)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
                        <span style={{ color: "var(--cond-very-good)" }}>Progress</span>
                        <span style={{ color: "var(--fg-0)", marginLeft: 6 }}>{title}</span>
                    </span>
                </div>
            )}

            {/* ULTG berdampingan (side-by-side), bukan stacked — request user 2026-06-12.
                Wrap ke bawah otomatis kalau layar sempit. */}
            <div
                style={{
                    padding: "18px 20px",
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: direction === "column" ? "1fr" : `repeat(auto-fit, minmax(280px, 1fr))`,
                    alignItems: direction === "column" ? "start" : "stretch",
                    alignContent: direction === "column" ? "space-evenly" : undefined,
                    gap: direction === "column" ? 24 : 28,
                }}
            >
                {rows.map((r) => (
                    <UltgBarRow
                        key={r.key}
                        row={r}
                        isActive={active === r.key}
                        isDimmed={active !== null && active !== r.key}
                        onClick={() => onToggle(r.key)}
                    />
                ))}
            </div>

            {/* Footnote — kejujuran data (hidden kalau 0) */}
            {noUltgCount > 0 && (
                <div style={{ padding: "0 20px 12px" }}>
                    <span style={{ fontSize: 11, color: "var(--fg-2)" }}>
                        <span className="num" style={{ color: "var(--cond-fair)", fontWeight: 600 }}>
                            {noUltgCount.toLocaleString("id-ID")}
                        </span>{" "}
                        item tanpa ULTG tidak masuk bar
                    </span>
                </div>
            )}
        </Wrapper>
    );
}

export function UltgBarRow({
    row,
    isActive,
    isDimmed,
    onClick,
}: {
    row: CeUltgBarRow;
    isActive: boolean;
    isDimmed: boolean;
    onClick: () => void;
}) {
    const [hover, setHover] = useState(false);
    const open = Math.max(row.total - row.close, 0);
    const pctClose = Math.min(row.total === 0 ? 0 : (row.close / row.total) * 100, 100);
    const pctOpen = 100 - pctClose;

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
            title={isActive ? `Hapus filter ${row.name}` : `Filter ${row.name}`}
            style={{
                cursor: "pointer",
                padding: 10,
                margin: -10,
                borderRadius: "var(--r-md)",
                opacity: isDimmed ? 0.5 : 1,
                background: isActive
                    ? `color-mix(in oklab, ${row.accent} 10%, transparent)`
                    : hover
                      ? `color-mix(in oklab, ${row.accent} 6%, transparent)`
                      : "transparent",
                boxShadow: isActive
                    ? `inset 0 0 0 1px ${row.accent}`
                    : hover
                      ? `inset 0 0 0 1px color-mix(in oklab, ${row.accent} 30%, transparent)`
                      : "none",
                transition: "opacity .25s ease, background .25s ease, box-shadow .25s ease",
            }}
        >
            {/* Header row — nama + close/total */}
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 8,
                }}
            >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: row.accent,
                            flexShrink: 0,
                        }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{row.name}</span>
                </span>
                <span className="num" style={{ fontSize: 11.5, color: "var(--fg-2)", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--fg-1)" }}>{row.close.toLocaleString("id-ID")}</span>
                    {(row.ntClose ?? 0) > 0 && (
                        <span style={{ fontSize: 10, color: "var(--cond-good)" }}>(+{(row.ntClose ?? 0).toLocaleString("id-ID")})</span>
                    )}
                    {" / "}
                    {row.total.toLocaleString("id-ID")}
                    {(row.ntTotal ?? 0) > 0 && (
                        <span style={{ fontSize: 10, color: "var(--cond-good)" }}>(+{(row.ntTotal ?? 0).toLocaleString("id-ID")})</span>
                    )}
                    {" "}item
                </span>
            </div>

            {/* Bar 3 segmen: close · NT (sunnah) · open — SSOT SegBar */}
            <SegBar close={row.close} target={row.total} ntClose={row.ntClose ?? 0} ntOpen={(row.ntTotal ?? 0) - (row.ntClose ?? 0)} height={16} />

            {/* Legend proporsional — istilah CE: Close / Open */}
            <div style={{ display: "flex", gap: 4, marginTop: 8, fontSize: 11.5, color: "var(--fg-1)" }}>
                {pctClose > 0 && (
                    <div
                        style={{
                            flex: `${pctClose} 1 0`,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span style={{ width: 8, height: 8, background: COLOR_CLOSE, borderRadius: 2, flexShrink: 0 }} />
                        <span style={{ color: "var(--fg-2)" }}>Close</span>
                        <span className="num" style={{ color: COLOR_CLOSE, fontWeight: 600 }}>
                            {row.close.toLocaleString("id-ID")}
                        </span>
                        {(row.ntClose ?? 0) > 0 && (
                            <span className="num" style={{ color: "var(--cond-good)", fontWeight: 600, fontSize: 10 }}>
                                (+{(row.ntClose ?? 0).toLocaleString("id-ID")})
                            </span>
                        )}
                    </div>
                )}
                {pctOpen > 0 && (
                    <div
                        style={{
                            flex: `${pctOpen} 1 0`,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span style={{ width: 8, height: 8, background: COLOR_OPEN, borderRadius: 2, flexShrink: 0 }} />
                        <span style={{ color: "var(--fg-2)" }}>Open</span>
                        <span className="num" style={{ color: COLOR_OPEN, fontWeight: 600 }}>
                            {open.toLocaleString("id-ID")}
                        </span>
                        {((row.ntTotal ?? 0) - (row.ntClose ?? 0)) > 0 && (
                            <span className="num" style={{ color: "var(--cond-poor)", fontWeight: 600, fontSize: 10 }}>
                                (+{((row.ntTotal ?? 0) - (row.ntClose ?? 0)).toLocaleString("id-ID")})
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
