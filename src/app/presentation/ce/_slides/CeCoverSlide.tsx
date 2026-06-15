"use client";

import { SlideHeadCompact } from "@/app/presentation/program-kerja/_components/SlideShared";
import { CE_BIDANG_META, CE_ORDER, fmtNum, type BidangDeck, type CeBidang } from "../_lib/ce-deck";
import { FungsiChip } from "../_components/CeSlideShared";

/**
 * Cover deck CE — identitas "Common Enemy Next Level · UPT Bogor 2026".
 * Komposisi 3 zona (bahasa CoverSlide deck PK):
 *   atas  = eyebrow amber + info rail
 *   tengah = headline besar + subjudul progress + baris tanggal/minggu (dinamis)
 *   bawah = cakupan 3 bidang (kartu data-driven: total anomali + jumlah Sub CE) + base rail
 */

/** "12 Juni 2026" + ISO week — baris konteks waktu di cover. */
function todayWithWeek(): { tanggal: string; minggu: number } {
    const now = new Date();
    const tanggal = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    // ISO 8601 week number
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const minggu = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { tanggal, minggu };
}
export function CeCoverSlide({
    slideNo,
    total,
    decks,
    updatedDate,
}: {
    slideNo: number;
    total: number;
    decks: Record<CeBidang, BidangDeck> | null;
    updatedDate?: string;
}) {
    const { tanggal, minggu } = todayWithWeek();

    return (
        <section className="slide" style={{ padding: "56px 96px 48px" }}>
            {/* ── Zona atas: eyebrow kiri + info rail kanan ── */}
            <div className="flex justify-between items-start gap-3">
                <div
                    style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 13,
                        textTransform: "uppercase",
                        letterSpacing: "0.32em",
                        color: "var(--accent-amber)",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        paddingTop: 6,
                    }}
                >
                    <span style={{ width: 48, height: 1.5, background: "var(--accent-amber)" }} />
                    UPT Bogor &middot; Monitoring Common Enemy
                </div>
                <SlideHeadCompact pageNo={slideNo} total={total} section="Common Enemy" />
            </div>

            {/* ── Zona tengah: headline + subjudul ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h1
                    style={{
                        fontSize: 104,
                        fontWeight: 800,
                        letterSpacing: "-0.035em",
                        lineHeight: 0.98,
                        margin: 0,
                        color: "var(--fg-0)",
                    }}
                >
                    Common Enemy<br />
                    Next Level <span style={{ color: "var(--accent-amber)" }}>2026</span>
                </h1>
                <p
                    style={{
                        marginTop: 28,
                        fontSize: 23,
                        color: "var(--fg-1)",
                        fontWeight: 400,
                        maxWidth: 1150,
                        lineHeight: 1.55,
                    }}
                >
                    Progress penyelesaian Common Enemy
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> UPT Bogor</strong> —
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> ULTG Bogor</strong> dan
                    <strong style={{ color: "var(--fg-0)", fontWeight: 600 }}> ULTG Sukabumi</strong>.
                </p>
                <div
                    style={{
                        marginTop: 22,
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 14.5,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        color: "var(--fg-2)",
                    }}
                >
                    <span>Transmisi &middot; Gardu Induk &middot; Proteksi</span>
                    <span style={{ width: 1, height: 14, background: "var(--line-2, var(--line))" }} />
                    <span>
                        <span style={{ color: "var(--accent-amber)" }}>{tanggal}</span>
                        <span style={{ margin: "0 10px", color: "var(--fg-3)" }}>·</span>
                        Minggu ke-<span style={{ color: "var(--accent-amber)" }}>{minggu}</span>
                    </span>
                </div>
            </div>

            {/* ── Zona bawah: 3 kartu bidang + base rail ── */}
            <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    {CE_ORDER.map((b, i) => {
                        const meta = CE_BIDANG_META[b];
                        const deck = decks?.[b];
                        return (
                            <BidangCard
                                key={b}
                                index={String(i + 1).padStart(2, "0")}
                                label={meta.label}
                                fungsi={meta.fungsi}
                                accent={meta.accent}
                                anomali={deck?.total ?? 0}
                                subCe={deck?.programs.length ?? 0}
                            />
                        );
                    })}
                </div>

                <div
                    style={{
                        marginTop: 28,
                        paddingTop: 16,
                        borderTop: "1px solid var(--line)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.16em",
                        color: "var(--fg-2)",
                        fontWeight: 600,
                    }}
                >
                    <span>UPT Bogor &middot; ULTG Bogor &middot; ULTG Sukabumi</span>
                    <span>
                        Periode <span style={{ color: "var(--accent-amber)" }}>2026</span>
                        {updatedDate ? (
                            <>
                                <span style={{ margin: "0 10px", color: "var(--fg-3)" }}>·</span>
                                Data <span style={{ color: "var(--accent-amber)" }}>{updatedDate}</span>
                            </>
                        ) : null}
                    </span>
                </div>
            </div>
        </section>
    );
}

function BidangCard({
    index,
    label,
    fungsi,
    accent,
    anomali,
    subCe,
}: {
    index: string;
    label: string;
    fungsi: string;
    accent: string;
    anomali: number;
    subCe: number;
}) {
    return (
        <div
            style={{
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ width: 24, height: 2, background: accent }} />
                <span
                    style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--fg-3)",
                        letterSpacing: "0.12em",
                        fontFeatureSettings: '"tnum"',
                    }}
                >
                    {index}
                </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span
                    style={{
                        fontSize: 30,
                        fontWeight: 700,
                        color: "var(--fg-0)",
                        letterSpacing: "-0.015em",
                        lineHeight: 1.1,
                    }}
                >
                    {label}
                </span>
                <FungsiChip text={fungsi} color={accent} size={12} />
            </div>
            <div
                style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 13,
                    color: "var(--fg-1)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontFeatureSettings: '"tnum"',
                }}
            >
                <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 16 }}>{fmtNum(anomali)}</span>
                {" "}Anomali
                <span style={{ margin: "0 8px", color: "var(--fg-3)" }}>·</span>
                <span style={{ color: "var(--fg-0)", fontWeight: 700, fontSize: 16 }}>{fmtNum(subCe)}</span>
                {" "}Sub CE
            </div>
        </div>
    );
}
