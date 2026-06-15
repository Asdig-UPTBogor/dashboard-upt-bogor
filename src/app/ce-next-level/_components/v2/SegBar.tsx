"use client";

/**
 * SegBar — bar progress CE (SSOT visual), desain "track 100% target + chip bonus":
 *
 *   [ close hijau ……… | open oranye ]   ( +N )
 *   └────── track = 100% TARGET ─────┘   chip bonus NT close (subordinat)
 *
 * Prinsip keterbacaan (final 2026-06-12):
 * - Track HANYA target: hijau (beres) + oranye (belum), label % basis target
 *   yang dijamin jumlah 100% — proporsi geometris jujur, sekali lihat kebaca.
 * - Non-target ("sunnah") CLOSE = chip bonus kecil DI LUAR track (gap + pill
 *   outline hijau muda, label +N item). Bonus menambah, tak pernah mengurangi.
 * - Non-target OPEN tidak masuk bar (bukan pekerjaan tersisa — bonus yang belum
 *   diambil). Info-nya di badge "+N NT" call-site + tooltip bar ini.
 */
export function SegBar({ close, target, ntClose = 0, ntOpen = 0, height = 13, showLabels = true }: {
    close: number;
    target: number;
    /** Non-target ("sunnah") yang sudah close — tampil sebagai chip bonus. */
    ntClose?: number;
    /** Non-target yang masih open — info tooltip saja (bukan segmen bar). */
    ntOpen?: number;
    height?: number;
    showLabels?: boolean;
}) {
    const open = Math.max(target - close, 0);
    const closeCapped = Math.min(close, target);
    if (target <= 0 && ntClose <= 0) {
        return <div style={{ height, background: "var(--bg-2)", borderRadius: 999 }} />;
    }
    const canLabel = showLabels && height >= 12;

    const pctClose = target > 0 ? (closeCapped / target) * 100 : 0;
    const pctOpen = target > 0 ? (open / target) * 100 : 0;
    const bonusW = target > 0 ? (ntClose / target) * 100 : 100;
    // Skala penuh utk gating label = track 100% (chip bonus dihapus — info NT di label & angka)
    const fullScale = target > 0 ? 100 : 0;
    const shareOfFull = (w: number) => (fullScale > 0 ? (w / fullScale) * 100 : 0);

    const ntTip = ntClose > 0 || ntOpen > 0
        ? ` — Non-target (sunnah): ${ntClose.toLocaleString("id-ID")} close · ${ntOpen.toLocaleString("id-ID")} open`
        : "";
    const barTip = `Target ${target.toLocaleString("id-ID")}: ${close.toLocaleString("id-ID")} close · ${open.toLocaleString("id-ID")} open${ntTip}`;

    const segText: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 10.5,
        fontFamily: "var(--font-mono)",
        overflow: "hidden",
        whiteSpace: "nowrap",
        minWidth: 0,
        transition: "flex .4s ease",
    };

    return (
        <div title={barTip} style={{ display: "flex", height, gap: 5, alignItems: "center" }}>
            {/* Track = 100% target: hijau (close) | oranye (open) */}
            {target > 0 && (
                <div style={{ display: "flex", flex: "100 1 0", minWidth: 0, height: "100%", gap: 2 }}>
                    {closeCapped > 0 && (
                        <div
                            title={`Close target: ${close.toLocaleString("id-ID")}`}
                            style={{
                                ...segText,
                                flex: `${pctClose} 1 0`,
                                background: "var(--cond-very-good)",
                                color: "#0b1a10",
                                borderRadius: `5px ${open > 0 ? 0 : 5}px ${open > 0 ? 0 : 5}px 5px`,
                            }}
                        >
                            {canLabel && shareOfFull(pctClose) >= 9
                                ? ntClose > 0 && shareOfFull(pctClose) >= 18
                                    ? closeCapped >= target
                                        ? `${(100 + bonusW).toFixed(1)}% (+${bonusW.toFixed(1)}%)`
                                        : `${pctClose.toFixed(1)}% (+${bonusW.toFixed(1)}%)`
                                    : `${pctClose.toFixed(1)}%`
                                : ""}
                        </div>
                    )}
                    {open > 0 && (
                        <div
                            title={`Open target: ${open.toLocaleString("id-ID")}`}
                            style={{
                                ...segText,
                                flex: `${pctOpen} 1 0`,
                                background: "var(--cond-poor)",
                                color: "#1a0e00",
                                borderRadius: `${closeCapped > 0 ? 0 : 5}px 5px 5px ${closeCapped > 0 ? 0 : 5}px`,
                            }}
                        >
                            {canLabel && shareOfFull(pctOpen) >= 9 ? `${pctOpen.toFixed(1)}%` : ""}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
