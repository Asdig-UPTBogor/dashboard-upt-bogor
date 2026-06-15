"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/designer/Card";
import { pctColor, pctEff, type CeSummaryRow } from "../ce-types";
import { SegBar } from "./SegBar";

interface Props {
    items: CeSummaryRow[];
    accent: string;
    activeProgram?: string | null;
    onProgramClick?: (program: string) => void;
    /** Judul setelah kata "Progress" (default "Per Program Kerja"). */
    title?: string;
    /** Non-target per program ("sunnah") — tampil kecil oranye di kolom angka. */
    ntByProgram?: Record<string, { total: number; close: number }>;
    /** Konten "nyelip" antara header dan bar program (mis. strip per-ULTG). */
    topSlot?: React.ReactNode;
    /** Override style Card (mis. flex:1 saat di dalam flex container). */
    style?: React.CSSProperties;
}

/* Lebar kolom FIXED — semua bar antar-row mulai & berhenti di titik yang sama (sejajar). */
const COL_LABEL = 230;
const COL_VALUE = 130;
const BAR_H = 13;

/**
 * Per-program (Sub CE) progress — layout row: label kiri · bar segmented close/open
 * (style bar ULTG) · angka kanan. Klik row = filter program (drill semua).
 */
export function CeProgramBars({ items, accent, activeProgram, onProgramClick, title = "Per Program Kerja", ntByProgram, topSlot, style }: Props) {
    const sorted = useMemo(
        () => [...items].sort((a, b) => b.persen - a.persen || b.target - a.target),
        [items],
    );

    return (
        <Card style={{ gridColumn: "span 12", ...style }} noPad>
            {/* Header */}
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

            {topSlot && (
                <div style={{ borderBottom: "1px solid var(--line)" }}>{topSlot}</div>
            )}

            <div style={{ padding: "10px 20px 14px" }}>
                {sorted.length === 0 ? (
                    <div className="ds-small" style={{ padding: 20, textAlign: "center", color: "var(--fg-2)" }}>
                        Belum ada program.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {sorted.map((it) => (
                            <ProgramRow
                                key={it.program}
                                row={it}
                                nt={ntByProgram?.[it.program]}
                                accent={accent}
                                active={activeProgram === it.program}
                                dimmed={!!activeProgram && activeProgram !== it.program}
                                onClick={onProgramClick ? () => onProgramClick(it.program) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>

        </Card>
    );
}

function ProgramRow({
    row,
    nt,
    accent,
    active,
    dimmed,
    onClick,
}: {
    row: CeSummaryRow;
    /** Non-target ("sunnah") program ini — info kecil oranye. */
    nt?: { total: number; close: number };
    accent: string;
    active: boolean;
    dimmed: boolean;
    onClick?: () => void;
}) {
    const [hover, setHover] = useState(false);
    // Bonus NT: >100% hanya kalau semua target close (16/16 +3 NT -> 118,8%)
    const pct = pctEff(row.realisasi, row.target, nt?.close ?? 0);
    const w = Math.min(Math.max(pct, 0), 100);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            style={{
                display: "grid",
                gridTemplateColumns: `${COL_LABEL}px minmax(0, 1fr) ${COL_VALUE}px`,
                gap: 16,
                alignItems: "center",
                padding: "11px 10px",
                borderRadius: "var(--r-sm)",
                cursor: onClick ? "pointer" : "default",
                opacity: dimmed ? 0.4 : 1,
                background: active
                    ? `color-mix(in oklab, ${accent} 10%, transparent)`
                    : hover && onClick
                      ? `color-mix(in oklab, ${accent} 6%, transparent)`
                      : "transparent",
                boxShadow: active
                    ? `inset 0 0 0 1px ${accent}`
                    : hover && onClick
                      ? `inset 0 0 0 1px color-mix(in oklab, ${accent} 30%, transparent)`
                      : "none",
                transition: "background .2s ease, opacity .25s ease, box-shadow .2s ease",
            }}
        >
            {/* Label program — kolom fixed, ellipsis */}
            <span
                title={row.program}
                style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--fg-0)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {row.program}
            </span>

            {/* Bar 3 segmen: close · NT (sunnah) · open — SSOT SegBar */}
            <SegBar close={row.realisasi} target={row.target} ntClose={nt?.close ?? 0} ntOpen={nt ? nt.total - nt.close : 0} height={BAR_H} />

            {/* Value — kolom fixed kanan (sejajar) */}
            <span
                className="num"
                style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    textAlign: "right",
                }}
            >
                <span style={{ color: "var(--fg-1)", fontWeight: 500 }}>
                    {row.realisasi.toLocaleString("id-ID")}
                </span>
                {(nt?.close ?? 0) > 0 && (
                    <span style={{ fontSize: 10, color: "var(--cond-good)" }}>(+{(nt?.close ?? 0).toLocaleString("id-ID")})</span>
                )}
                <span style={{ color: "var(--fg-3)", margin: "0 2px" }}>/</span>
                <span style={{ color: "var(--fg-1)", fontWeight: 500 }}>
                    {row.target.toLocaleString("id-ID")}
                </span>
                {(nt?.total ?? 0) > 0 && (
                    <span style={{ fontSize: 10, color: "var(--cond-good)" }}>(+{(nt?.total ?? 0).toLocaleString("id-ID")})</span>
                )}
            </span>
        </div>
    );
}
