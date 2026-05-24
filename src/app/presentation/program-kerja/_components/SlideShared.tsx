"use client";

/**
 * Shared slide components — sync 1:1 dengan standalone Transmisi page (locked spec).
 * Modern stack: shadcn/ui Card + Progress primitives, ds-* typography classes,
 * design tokens (var(--*)). Slide canvas dipertahankan 1920×1080.
 *
 * Public exports (signature stable):
 *   - SlideHeadCompact, HeroSlim, UltgCard, PanelCard
 *   - HeroPanel, CountItem (types)
 *   - fmtNum, pct, getISOWeek (utils)
 *
 * Kalau ada update sizing/spacing, update DI SINI saja — semua slide otomatis ikut.
 */

/* Raw HTML — slide layout unique, ga pakai library Card (no shadcn, no designer) */

export function fmtNum(n: number): string {
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

export function pct(num: number, den: number): number {
    if (!den || den === 0) return 0;
    return (num / den) * 100;
}

export function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/* ─────────── SlideHeadCompact ───────────
   Header meta block (top-right of slide): page#/total · section · date · week. */
export function SlideHeadCompact({ pageNo, total, section }: { pageNo: number; total: number; section: string }) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const week = getISOWeek(today);
    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
            fontFamily: "var(--font-mono, monospace)", fontSize: 11,
            textTransform: "uppercase", letterSpacing: "0.16em",
            color: "var(--fg-1)", fontWeight: 600, lineHeight: 1.4,
        }}>
            <span>
                <span style={{ color: "var(--fg-0)", fontWeight: 700 }}>{String(pageNo).padStart(2, "0")}</span>
                <span style={{ margin: "0 6px", color: "var(--fg-2)" }}>/</span>
                {String(total).padStart(2, "0")}
                <span style={{ margin: "0 10px", color: "var(--fg-2)" }}>·</span>
                <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>{section}</span>
            </span>
            <span>UPT Bogor &middot; {dateStr} &middot; Minggu {week}</span>
        </div>
    );
}

/* ─────────── HeroSlim ───────────
   Wide KPI strip dipakai di atas slide. Pakai shadcn Card sebagai shell
   + Progress untuk mini bar. Layout tetap horizontal grid (1 highlight bisa lebih lebar). */
export interface HeroPanel {
    caption: string;
    count: number;
    target: number;
    real: number;
    accent: string;
    highlight?: boolean;
    /** Optional key untuk click filter (e.g. "abo", "lm") */
    key?: string;
}

export function HeroSlim({
    panels,
    activeKey,
    onPanelClick,
}: {
    panels: HeroPanel[];
    activeKey?: string | null;
    onPanelClick?: (key: string) => void;
}) {
    const cols = panels.map((p) => (p.highlight ? "1.4fr" : "1fr")).join(" ");
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: cols,
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 16,
            }}
        >
            {panels.map((p, i) => {
                const isActive = !!p.key && activeKey === p.key;
                const isDimmed = !!activeKey && !!p.key && activeKey !== p.key;
                return (
                    <HeroSlimPanel
                        key={p.caption}
                        data={p}
                        hasBorderRight={i < panels.length - 1}
                        isActive={isActive}
                        isDimmed={isDimmed}
                        onClick={onPanelClick && p.key ? () => onPanelClick(p.key!) : undefined}
                    />
                );
            })}
        </div>
    );
}

function HeroSlimPanel({
    data,
    hasBorderRight,
    isActive,
    isDimmed,
    onClick,
}: {
    data: HeroPanel;
    hasBorderRight: boolean;
    isActive?: boolean;
    isDimmed?: boolean;
    onClick?: () => void;
}) {
    const p = pct(data.real, data.target);
    const baseBg = data.highlight
        ? `linear-gradient(135deg, ${data.accent}12 0%, transparent 70%)`
        : "transparent";
    const activeBg = isActive ? `color-mix(in oklab, ${data.accent} 10%, transparent)` : baseBg;
    return (
        <div
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            style={{
                padding: "20px 26px",
                background: activeBg,
                borderRight: hasBorderRight ? "1px solid var(--line)" : "none",
                display: "flex", flexDirection: "column", gap: 14,
                position: "relative", overflow: "hidden",
                cursor: onClick ? "pointer" : "default",
                opacity: isDimmed ? 0.5 : 1,
                boxShadow: isActive ? `inset 0 0 0 1px ${data.accent}` : "none",
                transition: "opacity .25s ease, background .25s ease, box-shadow .25s ease",
            }}>
            {/* Top: dash + caption + persen GEDE */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 16, height: 1.5, background: data.accent, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--fg-0)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                    }}>{data.caption}</span>
                </div>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: data.highlight ? 44 : 38,
                    fontWeight: 700,
                    color: data.accent,
                    letterSpacing: "-0.03em",
                    fontFeatureSettings: '"tnum"',
                    lineHeight: 1,
                    flexShrink: 0,
                }}>{p.toFixed(1)}%</span>
            </div>
            {/* Bottom: program count mini + accent-tinted bar + realisasi/target */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="ds-label" style={{
                    color: "var(--fg-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    fontWeight: 600,
                }}>
                    <span className="ds-data" style={{
                        color: "var(--fg-0)",
                        marginRight: 4,
                        fontSize: 13,
                    }}>{fmtNum(data.count)}</span>
                    Program
                </span>
                <AccentProgress value={Math.min(100, p)} accent={data.accent} className="flex-1 min-w-0" />
                <span className="ds-label" style={{
                    color: "var(--fg-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 600,
                }}>
                    <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 13, marginRight: 4 }}>
                        {fmtNum(data.real)}
                    </span>
                    /
                    <span style={{ marginLeft: 4 }}>{fmtNum(data.target)}</span>
                </span>
            </div>
        </div>
    );
}

/* AccentProgress — custom HTML bar dengan tint accent. No shadcn dependency. */
function AccentProgress({ value, accent, className }: { value: number; accent: string; className?: string }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <div
            className={className}
            style={{
                height: 6,
                background: "var(--bg-2)",
                borderRadius: 3,
                overflow: "hidden",
                position: "relative",
            }}
        >
            <div
                style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: accent,
                    borderRadius: 3,
                    boxShadow: `0 0 6px ${accent}66`,
                    transition: "width .4s ease",
                }}
            />
        </div>
    );
}

/* ─────────── UltgCard ───────────
   Per-ULTG summary card. Pakai shadcn Card + Progress (overridden inline tint via accent).
   Bottom row tetap 3-cell grid: Target | counts | Realisasi. */
export interface CountItem {
    label: string;
    count: number;
    color: string;
}

export function UltgCard({ name, target, real, accent, countItems, isActive, onClick }: {
    name: string; target: number; real: number; accent: string;
    countItems?: CountItem[];
    isActive?: boolean;
    onClick?: () => void;
}) {
    const p = pct(real, target);
    return (
        <div
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            style={{
                background: isActive ? `color-mix(in oklab, ${accent} 10%, transparent)` : "var(--bg-1)",
                border: "1px solid var(--line)",
                boxShadow: isActive ? `inset 0 0 0 1px ${accent}` : "none",
                borderRadius: 8,
                padding: "12px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                cursor: onClick ? "pointer" : "default",
                transition: "background .25s ease, box-shadow .25s ease",
            }}
        >
            {/* Top: dash + name (kiri) | persen GEDE (kanan) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 18, height: 2, background: accent, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--fg-0)",
                        letterSpacing: "-0.005em",
                    }}>{name}</span>
                </div>
                <span style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 40,
                    fontWeight: 700,
                    color: accent,
                    letterSpacing: "-0.03em",
                    fontFeatureSettings: '"tnum"',
                    lineHeight: 1,
                    flexShrink: 0,
                }}>{p.toFixed(1)}%</span>
            </div>

            {/* Middle: shadcn Progress, accent-tinted via Tailwind descendant selector */}
            <AccentProgress value={Math.min(100, p)} accent={accent} />

            {/* Bottom: 3 cell — Target (kiri) | counts (center) | Realisasi (kanan) */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 16,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--fg-1)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
            }}>
                <span style={{ justifySelf: "start" }}>
                    <span style={{
                        color: "var(--fg-0)",
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 700,
                        fontSize: 14,
                        marginRight: 6,
                        fontFeatureSettings: '"tnum"',
                    }}>{fmtNum(target)}</span>
                    Target
                </span>

                {countItems && countItems.length > 0 && (
                    <span style={{ justifySelf: "center", display: "inline-flex", gap: 14 }}>
                        {countItems.map((c) => (
                            <span key={c.label}>
                                <span style={{
                                    color: c.color,
                                    fontFamily: "var(--font-mono, monospace)",
                                    fontWeight: 700,
                                    fontSize: 14,
                                    marginRight: 6,
                                    fontFeatureSettings: '"tnum"',
                                }}>{fmtNum(c.count)}</span>
                                {c.label}
                            </span>
                        ))}
                    </span>
                )}

                <span style={{ justifySelf: "end" }}>
                    <span style={{
                        color: accent,
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 700,
                        fontSize: 14,
                        marginRight: 6,
                        fontFeatureSettings: '"tnum"',
                    }}>{fmtNum(real)}</span>
                    Realisasi
                </span>
            </div>
        </div>
    );
}

/* ─────────── PanelCard ───────────
   Chart wrapper card. Header pakai pattern caption (dash 16x1.5 + UPPERCASE 11/600 letterSpacing 0.12em).
   Children render di body — Recharts bar list, dll. */
export function PanelCard({ title, count, accent, children }: {
    title: string; count: number; accent: string; children: React.ReactNode;
}) {
    return (
        <div
            style={{
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minHeight: 0,
                overflow: "hidden",
            }}
        >
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--line)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 22, height: 2, background: accent, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 16,
                        color: "var(--fg-0)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontWeight: 700,
                    }}>{title}</span>
                </div>
                <span style={{
                    fontSize: 14,
                    color: "var(--fg-1)",
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                }}>{count} program</span>
            </div>
            <div style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                padding: "12px 20px 16px",
                display: "flex",
                flexDirection: "column",
            }}>
                {children}
            </div>
        </div>
    );
}
