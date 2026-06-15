"use client";
import { Card } from "@/components/designer/Card";
import { pctColor, pctEff } from "../ce-types";
import { SegBar } from "./SegBar";

export interface CeHeroData {
    /** Total anomali CE = target. */
    total: number;
    /** Realisasi = anomali CLOSE. */
    close: number;
    /** Sisa = anomali OPEN. */
    open: number;
    /** Jumlah program kerja CE di bidang ini. */
    programCount: number;
    caption: string;
    nickname?: string;
    nicknameColor?: string;
    accent: string;
    accent2: string;
    /** Item Non-Target CE (opsional, khusus Proteksi) — ditampilkan kecil di bawah angka utama. */
    nonTargetClose?: number;
    nonTargetOpen?: number;
    /** ROW (Right of Way, khusus transmisi) — masuk hero, bukan kartu terpisah (user 2026-06-12). */
    rowTarget?: number;
    rowRealisasi?: number;
}

/**
 * KPI hero CE — gaya Hero.tsx Program Kerja Transmisi.
 * Grid golden-ratio: total (1.618fr) | stat blok (1fr) — segmented bar close vs open.
 */
export function CeHero({ data, side }: {
    data: CeHeroData;
    /** Konten panel kanan hero (CE: bar per-ULTG clickable). */
    side?: React.ReactNode;
}) {
    const ntC = data.nonTargetClose ?? 0;
    // Sunnah selalu menambah: eff = (target + NT) / target — kontribusi NT tampil dalam kurung
    const pct = pctEff(data.close, data.total, ntC);
    const pctBase = data.total > 0 ? (data.close / data.total) * 100 : 0;
    const ntPctC = data.total > 0 ? (ntC / data.total) * 100 : 0;
    // Open = basis target murni (selaras segmen oranye di bar) — NT open bukan sisa pekerjaan
    const pctOpenBase = data.total > 0 ? (Math.max(data.total - data.close, 0) / data.total) * 100 : 0;
    const hasRow = (data.rowTarget ?? 0) > 0;
    const rowPct = hasRow ? ((data.rowRealisasi ?? 0) / (data.rowTarget as number)) * 100 : 0;
    const ntClose = data.nonTargetClose ?? 0;
    const ntOpen = data.nonTargetOpen ?? 0;
    const hasNT = data.nonTargetClose !== undefined || data.nonTargetOpen !== undefined;
    const ntTotal = ntClose + ntOpen;

    return (
        <Card className="col-span-12" noPad>
            <div
                data-hero-grid
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.618fr 1px 1fr",
                }}
            >
                {/* Panel utama — highlight */}
                <div
                    style={{
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 22,
                        position: "relative",
                        background:
                            "radial-gradient(ellipse 55% 80% at 0% 0%, color-mix(in oklab, var(--cond-very-good) 6%, transparent), transparent 60%)",
                    }}
                >
                    <Caption nickname={data.nickname} nicknameColor={data.nicknameColor ?? data.accent}>
                        {data.caption}
                    </Caption>

                    <div
                        style={{
                            display: "flex",
                            gap: 24,
                            alignItems: "flex-end",
                            flexWrap: "wrap",
                            justifyContent: "space-evenly",
                            alignContent: "center",
                            flex: 1,
                        }}
                    >
                        <Stat
                            value={data.total.toLocaleString("id-ID")}
                            label="Total Anomali"
                            size={32}
                            beside={hasNT && ntTotal > 0 ? { text: `+${ntTotal} NT`, color: "var(--cond-good)" } : undefined}
                        />
                        <VDivider />
                        <Stat value={data.programCount.toLocaleString("id-ID")} label="Sub CE" size={32} />
                        <VDivider />
                        <Stat
                            value={`${pct.toFixed(1)}%`}
                            label="Close"
                            size={32}
                            valueColor={pctColor(pctBase)}
                            beside={ntPctC > 0 ? { text: `(+${ntPctC.toFixed(1)}%)`, color: "var(--cond-good)" } : undefined}
                        />
                        <VDivider />
                        <Stat
                            value={`${pctOpenBase.toFixed(1)}%`}
                            label="Open"
                            size={32}
                            valueColor={data.open > 0 ? "var(--cond-poor)" : "var(--fg-3)"}
                            beside={ntOpen > 0 && data.total > 0
                                ? { text: `(+${((ntOpen / data.total) * 100).toFixed(1)}%)`, color: "var(--cond-poor)" }
                                : undefined}
                        />
                        {hasRow && (
                            <>
                                <VDivider />
                                <Stat value={(data.rowTarget ?? 0).toLocaleString("id-ID")} label="Target ROW" size={32} />
                                <VDivider />
                                <Stat
                                    value={`${rowPct.toFixed(1)}%`}
                                    label="Progress ROW"
                                    size={32}
                                    valueColor={pctColor(rowPct)}
                                    sub={`${(data.rowRealisasi ?? 0).toLocaleString("id-ID")} terealisasi`}
                                />
                            </>
                        )}
                    </div>

                    <div style={{ marginTop: "auto" }}>
                        <SegmentedProgress done={data.close} total={data.total} ntDone={ntClose} ntOpen={ntOpen} />
                    </div>
                </div>

                <Divider />

                {/* Panel kanan — slot (CE: card ULTG nyamping hero, gantiin
                    "Status Penyelesaian" yang redundan — keputusan user 2026-06-12) */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                        background: `radial-gradient(ellipse 60% 80% at 100% 0%, color-mix(in oklab, ${data.accent} 5%, transparent), transparent 65%)`,
                    }}
                >
                    {side}
                </div>
            </div>
        </Card>
    );
}

function Divider() {
    return <div data-hero-divider style={{ background: "var(--line)" }} />;
}

function VDivider() {
    return <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />;
}

function Stat({
    value,
    label,
    size,
    valueColor,
    sub,
    beside,
}: {
    value: string;
    label: string;
    size: number;
    valueColor?: string;
    /** Catatan kecil di bawah label (mis. "+4 non-target"). */
    sub?: string;
    /** Persen BESAR di samping angka (semantic by value). */
    beside?: { text: string; color: string };
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10, whiteSpace: "nowrap" }}>
                <span
                    className="num"
                    style={{
                        fontSize: size,
                        fontWeight: 600,
                        letterSpacing: "-0.04em",
                        color: valueColor ?? "var(--fg-0)",
                        lineHeight: 1,
                    }}
                >
                    {value}
                </span>
                {beside && (
                    <span
                        className="num"
                        style={{
                            fontSize: Math.round(size * 0.5),
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                            color: beside.color,
                            lineHeight: 1,
                        }}
                    >
                        {beside.text}
                    </span>
                )}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--fg-1)", fontWeight: 500, whiteSpace: "nowrap" }}>
                {label}
            </span>
            {sub && (
                <span
                    className="num"
                    style={{
                        fontSize: 10.5,
                        color: "var(--cond-fair)",
                        fontWeight: 600,
                        letterSpacing: "0.01em",
                        whiteSpace: "nowrap",
                    }}
                >
                    {sub}
                </span>
            )}
        </div>
    );
}

function SegmentedProgress({ done, total, ntDone = 0, ntOpen = 0 }: {
    done: number; total: number;
    /** Non-target ("sunnah" — di luar target resmi, tetap ditampilkan kecil). */
    ntDone?: number; ntOpen?: number;
}) {
    const pct = total === 0 ? 0 : (done / total) * 100;
    const pctOpen = 100 - pct;
    const belum = Math.max(total - done, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SegBar close={done} target={total} ntClose={ntDone} ntOpen={ntOpen} height={8} showLabels={false} />
            <div style={{ display: "flex", gap: 4, fontSize: 11.5, color: "var(--fg-2)" }}>
                {pct > 0 && <LegendItem flex={pct} color="var(--cond-very-good)" label="Close" value={done} nt={ntDone} ntColor="var(--cond-good)" />}
                {belum > 0 && <LegendItem flex={pctOpen} color="var(--cond-poor)" label="Open" value={belum} nt={ntOpen} ntColor="var(--cond-poor)" />}
            </div>
        </div>
    );
}

function LegendItem({ flex, color, label, value, nt = 0, ntColor = "var(--cond-good)" }: {
    flex: number; color: string; label: string; value: number;
    /** Non-target ("sunnah") — anotasi (+n) kecil, warna sesuai kesepakatan. */
    nt?: number;
    ntColor?: string;
}) {
    return (
        <div
            style={{
                flex: `${flex} 1 0`,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                whiteSpace: "nowrap",
            }}
        >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span>{label}</span>
            <span className="num" style={{ color, fontWeight: 600 }}>
                {value.toLocaleString("id-ID")}
            </span>
            {nt > 0 && (
                <span className="num" style={{ color: ntColor, fontWeight: 600, fontSize: 10 }}>
                    (+{nt.toLocaleString("id-ID")})
                </span>
            )}
        </div>
    );
}



function Caption({
    children,
    nickname,
    nicknameColor,
}: {
    children: React.ReactNode;
    nickname?: string;
    nicknameColor?: string;
}) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 16, height: 1.5, background: "var(--fg-3)" }} />
            <span
                style={{
                    fontSize: 11,
                    color: "var(--fg-0)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    fontWeight: 600,
                }}
            >
                {children}
            </span>
            {nickname && (
                <span
                    className="num"
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        padding: "2px 7px",
                        borderRadius: 4,
                        color: nicknameColor ?? "var(--fg-1)",
                        background: `color-mix(in oklab, ${nicknameColor ?? "var(--fg-2)"} 14%, transparent)`,
                        border: `1px solid color-mix(in oklab, ${nicknameColor ?? "var(--fg-2)"} 28%, transparent)`,
                    }}
                >
                    {nickname}
                </span>
            )}
        </div>
    );
}
