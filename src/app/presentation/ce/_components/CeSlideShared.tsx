"use client";

/**
 * Shared visual primitives deck CE — bahasa visual SAMA dengan page /ce-next-level
 * (bar segmented close/open dengan % di dalam segmen) + deck Program Kerja
 * (dash caption, mono tabular, panel bg-1).
 *
 * STANDAR WARNA (LOCKED):
 *   - Close = var(--cond-very-good), Open = var(--cond-poor)
 *   - % semantic by value → pctColor (ce-types)
 *   - Identitas (ULTG/bidang) ≠ status — hanya untuk nama/dash/chip
 */

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CE_CLOSE, CE_OPEN, fmtNum, fmtPct, pct, pctColor } from "../_lib/ce-deck";

/* Teks gelap di atas segmen warna terang — konvensi page CE. */
const INK_ON_CLOSE = "#0b1a10";
const INK_ON_OPEN = "#1a0e00";

/* ─────────── SegBar ───────────
   Bar segmented close/open, % muncul DI DALAM segmen kalau muat (threshold %).
   total=0 → track kosong netral.
   ntClose (sunnah) = label gated konsep NT: bonus masuk angka utama HANYA setelah
   target tuntas → "118,8% (+18,8%)"; belum tuntas → "88,5% (+11,5%)". */
export function SegBar({
    close,
    total,
    ntClose = 0,
    height = 16,
    fontSize = 12.5,
    radius = 6,
    minPctLabel = 12,
}: {
    close: number;
    total: number;
    /** Non-target ("sunnah") close — anotasi label, bukan segmen bar. */
    ntClose?: number;
    height?: number;
    fontSize?: number;
    radius?: number;
    /** Segmen tampilkan label % kalau lebarnya ≥ nilai ini (dalam %). */
    minPctLabel?: number;
}) {
    if (total <= 0) {
        return <div style={{ height, background: "var(--bg-2)", borderRadius: radius }} />;
    }
    const pc = Math.min(Math.max(pct(close, total), 0), 100);
    const po = 100 - pc;
    const bonus = pct(ntClose, total);
    const closeLabel =
        ntClose > 0 && pc >= Math.max(minPctLabel * 2, 24)
            ? close >= total
                ? `${fmtPct(100 + bonus)}% (+${fmtPct(bonus)}%)`
                : `${fmtPct(pc)}% (+${fmtPct(bonus)}%)`
            : `${fmtPct(pc)}%`;
    const segBase: React.CSSProperties = {
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize,
        fontFamily: "var(--font-mono, monospace)",
        fontFeatureSettings: '"tnum"',
        overflow: "hidden",
        whiteSpace: "nowrap",
    };
    return (
        <div style={{ display: "flex", height, gap: 4 }}>
            {pc > 0 && (
                <div
                    style={{
                        ...segBase,
                        flex: `${pc} 1 0`,
                        background: CE_CLOSE,
                        color: INK_ON_CLOSE,
                        borderRadius: po > 0 ? `${radius}px 0 0 ${radius}px` : radius,
                    }}
                >
                    {pc >= minPctLabel ? closeLabel : ""}
                </div>
            )}
            {po > 0 && (
                <div
                    style={{
                        ...segBase,
                        flex: `${po} 1 0`,
                        background: CE_OPEN,
                        color: INK_ON_OPEN,
                        borderRadius: pc > 0 ? `0 ${radius}px ${radius}px 0` : radius,
                    }}
                >
                    {po >= minPctLabel ? `${fmtPct(po)}%` : ""}
                </div>
            )}
        </div>
    );
}

/* ─────────── StatBig ───────────
   Angka besar mono + label uppercase kecil (vertikal) — bahasa CeHero, skala deck.
   `extra` = anotasi kecil DI SAMPING angka (baseline), mis. "+7 NT" / "(+3)". */
export function StatBig({
    value,
    label,
    color,
    extra,
    size = 42,
}: {
    value: string;
    label: string;
    color?: string;
    /** Anotasi NT di samping angka — pattern hero page CE. */
    extra?: React.ReactNode;
    size?: number;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 7, whiteSpace: "nowrap" }}>
                <span
                    style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: size,
                        fontWeight: 700,
                        letterSpacing: "-0.03em",
                        fontFeatureSettings: '"tnum"',
                        color: color ?? "var(--fg-0)",
                        lineHeight: 1,
                    }}
                >
                    {value}
                </span>
                {extra}
            </span>
            <span
                style={{
                    fontSize: 12,
                    color: "var(--fg-1)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
        </div>
    );
}

/* ─────────── NtNote ───────────
   Anotasi non-target ("sunnah") mono kecil — warna LOCKED: close = cond-good,
   open = cond-poor (beda axis dari warna target). */
export function NtNote({ text, kind = "close", size = 15 }: { text: string; kind?: "close" | "open"; size?: number }) {
    return (
        <span
            className="num"
            style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: size,
                fontWeight: 600,
                fontFeatureSettings: '"tnum"',
                color: kind === "close" ? "var(--cond-good)" : "var(--cond-poor)",
                whiteSpace: "nowrap",
            }}
        >
            {text}
        </span>
    );
}

export function VDivider() {
    return <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />;
}

/* ─────────── FungsiChip ───────────
   Badge bidang fungsi (HARJAR/HARGI/HARPRO) — konvensi Caption nickname CeHero. */
export function FungsiChip({ text, color, size = 12 }: { text: string; color: string; size?: number }) {
    return (
        <span
            style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: size,
                fontWeight: 700,
                letterSpacing: "0.08em",
                padding: "3px 9px",
                borderRadius: 5,
                color,
                background: `color-mix(in oklab, ${color} 14%, transparent)`,
                border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
                whiteSpace: "nowrap",
                flexShrink: 0,
            }}
        >
            {text}
        </span>
    );
}

/* ─────────── DashCaption ───────────
   Dash + label uppercase — pattern caption deck PK. */
export function DashCaption({
    children,
    accent = "var(--fg-3)",
    size = 13,
    after,
}: {
    children: React.ReactNode;
    accent?: string;
    size?: number;
    after?: React.ReactNode;
}) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ width: 18, height: 2, background: accent, flexShrink: 0 }} />
            <span
                style={{
                    fontSize: size,
                    fontWeight: 700,
                    color: "var(--fg-0)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {children}
            </span>
            {after}
        </div>
    );
}

/* ─────────── CloseOpenCounts ───────────
   Pasangan "close / total" mono baseline-aligned. */
export function CloseOpenCounts({
    close,
    total,
    sizeClose = 22,
    sizeTotal = 17,
}: {
    close: number;
    total: number;
    sizeClose?: number;
    sizeTotal?: number;
}) {
    return (
        <span
            style={{
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 600,
                color: "var(--fg-1)",
                whiteSpace: "nowrap",
                fontFeatureSettings: '"tnum"',
                fontSize: sizeTotal,
            }}
        >
            <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: sizeClose }}>{fmtNum(close)}</span>
            <span style={{ color: "var(--fg-2)", margin: "0 5px" }}>/</span>
            {fmtNum(total)}
        </span>
    );
}

/* ─────────── UltgPanel ───────────
   Panel split per ULTG (hero kanan): identitas square dot ULTG (konvensi page CE),
   % besar SEMANTIK, counts pattern n(+nt), bar segmented BOTTOM-ALIGNED dengan
   panel highlight. Clickable = filter slide (pattern UltgBarRow page CE):
   hover tint 6% + ring 30%, active tint 10% + ring penuh, dim saat ULTG lain aktif. */
export function UltgPanel({
    name,
    accent,
    total,
    close,
    ntTotal = 0,
    ntClose = 0,
    isActive = false,
    isDimmed = false,
    onClick,
}: {
    name: string;
    accent: string;
    total: number;
    close: number;
    /** Non-target ("sunnah") ULTG ini — anotasi (+n) cond-good. */
    ntTotal?: number;
    ntClose?: number;
    isActive?: boolean;
    isDimmed?: boolean;
    /** Klik = toggle filter ULTG di slide. */
    onClick?: () => void;
}) {
    const [hover, setHover] = useState(false);
    const p = pct(close, total);
    const bonus = pct(ntClose, total);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={(e) => {
                if (onClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onClick();
                }
            }}
            title={onClick ? (isActive ? `Hapus filter ${name}` : `Filter ${name}`) : undefined}
            style={{
                flex: 1,
                padding: "20px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                minWidth: 0,
                cursor: onClick ? "pointer" : "default",
                opacity: isDimmed ? 0.45 : 1,
                background: isActive
                    ? `color-mix(in oklab, ${accent} 10%, transparent)`
                    : hover && onClick
                      ? `color-mix(in oklab, ${accent} 6%, transparent)`
                      : "transparent",
                boxShadow: isActive
                    ? `inset 0 0 0 1px ${accent}`
                    : hover && onClick
                      ? `inset 0 0 0 1px color-mix(in oklab, ${accent} 30%, transparent)`
                      : "none",
                transition: "opacity .25s ease, background .25s ease, box-shadow .25s ease",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0 }} />
                    <span
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "var(--fg-0)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {name}
                    </span>
                </span>
                <span
                    style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--fg-1)",
                        whiteSpace: "nowrap",
                        fontFeatureSettings: '"tnum"',
                    }}
                >
                    <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 15 }}>{fmtNum(close)}</span>
                    {ntClose > 0 && <span style={{ fontSize: 11, color: "var(--cond-good)" }}>(+{fmtNum(ntClose)})</span>}
                    <span style={{ color: "var(--fg-2)", margin: "0 4px" }}>/</span>
                    {fmtNum(total)}
                    {ntTotal > 0 && <span style={{ fontSize: 11, color: "var(--cond-good)" }}>(+{fmtNum(ntTotal)})</span>}
                    {" "}item
                </span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flex: 1 }}>
                <span
                    style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 46,
                        fontWeight: 700,
                        color: total > 0 ? pctColor(p) : "var(--fg-3)",
                        letterSpacing: "-0.035em",
                        fontFeatureSettings: '"tnum"',
                        lineHeight: 1,
                    }}
                >
                    {total > 0 ? fmtPct(p) : "—"}
                    {total > 0 && <span style={{ fontSize: "0.5em", fontWeight: 600, marginLeft: 3 }}>%</span>}
                </span>
                {ntClose > 0 && <NtNote text={`(+${fmtPct(bonus)}%)`} kind="close" size={16} />}
                <span
                    style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "var(--fg-2)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                    }}
                >
                    Close
                </span>
            </div>

            <SegBar close={close} total={total} ntClose={ntClose} height={16} fontSize={11.5} radius={5} minPctLabel={14} />
        </div>
    );
}

/* ─────────── SlideLoading ─────────── */
export function SlideLoading({ text }: { text: string }) {
    return (
        <section className="slide" style={{ alignItems: "center", justifyContent: "center", gap: 16 }}>
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-32 w-full max-w-2xl rounded-md" />
            <p className="ds-body">{text}</p>
        </section>
    );
}

/* ─────────── Footnotes ───────────
   Catatan kejujuran data — mono kecil, bottom slide. */
export function Footnotes({ notes }: { notes: string[] }) {
    if (notes.length === 0) return null;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 10 }}>
            {notes.map((n) => (
                <p
                    key={n}
                    style={{
                        fontSize: 11.5,
                        color: "var(--fg-2)",
                        margin: 0,
                        maxWidth: "none", /* override global p { max-width: 75ch } */
                        fontFamily: "var(--font-mono, monospace)",
                        letterSpacing: "0.04em",
                    }}
                >
                    * {n}
                </p>
            ))}
        </div>
    );
}
