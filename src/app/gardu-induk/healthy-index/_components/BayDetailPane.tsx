/**
 * BayDetailPane — Detail panel untuk Bay yang dipilih.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ ← Kembali  │  Bay name              avg HI   │
 *   ├──────────────────────────────────────────────┤
 *   │ [ CT · 3 ][ CVT ][ LA · 3 ][ PMS ][ PMT ]   │  ← tab MTU
 *   ├──────────────────────────────────────────────┤
 *   │  detail unit langsung (tanpa klik tambahan)   │
 *   │  kalau >1 unit → navigator kecil di header    │
 *   └──────────────────────────────────────────────┘
 */
"use client";

import { memo, useMemo, useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { COLORS, STATUS_HI_LABEL } from "./design-tokens";
import type { HiRow } from "./useHealthyIndexData";

interface Props {
    rows: HiRow[];
    onBack: () => void;
}

const YEAR_NOW = new Date().getFullYear();

function isValidYear(y: number): boolean {
    return !isNaN(y) && y >= 1950 && y <= YEAR_NOW;
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[8px] text-white/30 uppercase tracking-wider">{label}</span>
            <span
                className="text-[11px] font-medium leading-tight"
                style={{ color: color ?? "rgba(255,255,255,0.85)" }}
            >
                {value || "—"}
            </span>
        </div>
    );
}

function hiColor(score: number): string {
    const stops = [[0x34, 0xd3, 0x99], [0xfb, 0xbf, 0x24], [0xfb, 0x71, 0x85]] as const;
    const inv = 1 - Math.max(0, Math.min(1, score / 100));
    const [a, b, frac] =
        inv < 0.5
            ? [stops[0], stops[1], inv * 2]
            : [stops[1], stops[2], (inv - 0.5) * 2];
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * frac)},${Math.round(a[1] + (b[1] - a[1]) * frac)},${Math.round(a[2] + (b[2] - a[2]) * frac)})`;
}

function BayDetailPaneInner({ rows, onBack }: Props) {
    /* ── Group by MTU type, sort worst avg HI first ── */
    const byMtu = useMemo(() => {
        const map: Record<string, HiRow[]> = {};
        for (const row of rows) {
            if (!map[row.mtu]) map[row.mtu] = [];
            map[row.mtu].push(row);
        }
        for (const mtu of Object.keys(map)) {
            map[mtu].sort((a, b) => a.nilaiHi - b.nilaiHi); // worst first
        }
        return map;
    }, [rows]);

    const mtuTypes = useMemo(
        () =>
            Object.keys(byMtu).sort((a, b) => {
                const avgA = byMtu[a].reduce((s, r) => s + r.nilaiHi, 0) / byMtu[a].length;
                const avgB = byMtu[b].reduce((s, r) => s + r.nilaiHi, 0) / byMtu[b].length;
                return avgA - avgB;
            }),
        [byMtu],
    );

    const [selMtu, setSelMtu] = useState<string>(() => mtuTypes[0] ?? "");
    const [unitIdx, setUnitIdx] = useState(0);

    /* Sync when mtuTypes changes (e.g. tree MTU filter applied) */
    useEffect(() => {
        if (mtuTypes.length === 0) return;
        if (!mtuTypes.includes(selMtu)) {
            setSelMtu(mtuTypes[0]);
            setUnitIdx(0);
        }
    }, [mtuTypes, selMtu]);

    const switchMtu = (mtu: string) => {
        setSelMtu(mtu);
        setUnitIdx(0);
    };

    const units  = byMtu[selMtu] ?? [];
    const row    = units[unitIdx] ?? null;
    const bayName = rows[0]?.bay ?? "";
    const bayAvg  = rows.reduce((s, r) => s + r.nilaiHi, 0) / (rows.length || 1);

    if (mtuTypes.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-[10px] text-white/25 select-none">
                Tidak ada data
            </div>
        );
    }

    const sColor    = COLORS.statusHi[row?.statusHi ?? ""] ?? "#94a3b8";
    const thnOps    = parseInt(row?.tahunOperasi ?? "");
    const thnBuat   = parseInt(row?.tahunBuat ?? "");
    const usia      = isValidYear(thnOps)  ? `${YEAR_NOW - thnOps} tahun`
                    : isValidYear(thnBuat) ? `${YEAR_NOW - thnBuat} tahun`
                    : "—";
    const prioColor = row?.prioritas === "P0" ? "#fb7185"
                    : row?.prioritas === "P1" ? "#fb923c"
                    : row?.prioritas === "P2" ? "#fbbf24"
                    : "rgba(255,255,255,0.4)";

    return (
        <div className="flex flex-col h-full min-h-0">

            {/* ── 1. Header: back · bay name · avg HI ── */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border/10">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors outline-none shrink-0"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="text-[9px]">Kembali</span>
                </button>
                <div className="h-3 w-px bg-border/25 shrink-0" />
                <span className="text-[11px] font-semibold text-white/65 truncate flex-1">
                    {bayName}
                </span>
                <span
                    className="text-[10px] tabular-nums font-bold shrink-0"
                    style={{ color: hiColor(bayAvg) }}
                >
                    avg {bayAvg.toFixed(1)}
                </span>
            </div>

            {/* ── 2a. MTU type tabs ── */}
            <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2 pb-1.5 overflow-x-auto">
                {mtuTypes.map((mtu) => {
                    const us    = byMtu[mtu];
                    const avg   = us.reduce((s, r) => s + r.nilaiHi, 0) / us.length;
                    const clr   = hiColor(avg);
                    const worstStatus = COLORS.statusHi[us[0]?.statusHi] ?? clr;
                    const isAct = selMtu === mtu;

                    return (
                        <button
                            key={mtu}
                            onClick={() => switchMtu(mtu)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-semibold shrink-0 transition-all outline-none"
                            style={{
                                background: isAct ? `${clr}22` : "rgba(255,255,255,0.04)",
                                color: isAct ? clr : "rgba(255,255,255,0.35)",
                                border: `1px solid ${isAct ? clr + "55" : "rgba(255,255,255,0.07)"}`,
                                boxShadow: isAct ? `0 0 0 1px ${clr}22` : "none",
                            }}
                        >
                            {mtu}
                            <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: worstStatus }}
                            />
                            <span
                                className="text-[8px] px-1 py-0.5 rounded-sm tabular-nums font-bold"
                                style={{
                                    background: isAct ? `${clr}25` : "rgba(255,255,255,0.06)",
                                    color: isAct ? clr : "rgba(255,255,255,0.25)",
                                }}
                            >
                                {us.length}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── 2b. Unit buttons (baris ke-2, hanya jika tipe aktif punya >1 unit) ── */}
            {units.length > 1 && (
                <div className="shrink-0 flex items-center gap-1 px-3 pt-0 pb-2 overflow-x-auto border-b border-border/10">
                    {units.map((u, i) => {
                        const uClr   = COLORS.statusHi[u.statusHi] ?? "#94a3b8";
                        const isActU = unitIdx === i;
                        const label  = u.serialId || `Unit ${i + 1}`;
                        return (
                            <button
                                key={i}
                                onClick={() => setUnitIdx(i)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] shrink-0 transition-all outline-none"
                                style={{
                                    background: isActU ? `${uClr}20` : "rgba(255,255,255,0.03)",
                                    color: isActU ? uClr : "rgba(255,255,255,0.28)",
                                    border: `1px solid ${isActU ? uClr + "45" : "rgba(255,255,255,0.05)"}`,
                                }}
                            >
                                <span
                                    className="w-1 h-1 rounded-full shrink-0"
                                    style={{ background: uClr }}
                                />
                                <span className="truncate max-w-18">{label}</span>
                                <span
                                    className="tabular-nums font-bold shrink-0"
                                    style={{ color: isActU ? uClr : "rgba(255,255,255,0.2)" }}
                                >
                                    {u.nilaiHi.toFixed(1)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Separator kalau 1 unit saja (tidak ada baris ke-2) */}
            {units.length === 1 && (
                <div className="shrink-0 border-b border-border/10" />
            )}

            {/* ── 3. Detail unit langsung ── */}
            {row && (
                <>
                    {/* Sub-header: status · merek/tipe · navigator · HI score */}
                    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border/10">
                        <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0"
                            style={{
                                background: sColor + "20",
                                color: sColor,
                                border: `1px solid ${sColor}40`,
                            }}
                        >
                            {STATUS_HI_LABEL[row.statusHi] ?? row.statusHi}
                        </span>
                        <span className="text-[10px] text-white/50 truncate flex-1">
                            {[row.merek, row.tipe].filter(Boolean).join(" · ") || "—"}
                        </span>
                        <span
                            className="text-xl font-bold tabular-nums shrink-0"
                            style={{ color: sColor }}
                        >
                            {row.nilaiHi.toFixed(1)}
                        </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">

                        {/* Lokasi */}
                        <div
                            className="rounded-md p-3 flex flex-col gap-2.5"
                            style={{ background: sColor + "08", border: `1px solid ${sColor}20` }}
                        >
                            <span
                                className="text-[9px] font-bold uppercase tracking-widest"
                                style={{ color: sColor }}
                            >
                                Lokasi
                            </span>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                <Field label="ULTG"             value={row.ultg} />
                                <Field label="Gardu Induk"      value={row.gi} />
                                <Field label="Bay"              value={row.bay} />
                                <Field label="Tegangan / Phasa" value={[row.tegangan, row.phasa].filter(Boolean).join(" · ")} />
                            </div>
                        </div>

                        {/* Peralatan */}
                        <div
                            className="rounded-md p-3 flex flex-col gap-2.5"
                            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                            <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                                Peralatan
                            </span>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                <Field label="Merek"         value={row.merek} />
                                <Field label="Tipe / Model"  value={row.tipe} />
                                <Field label="Serial ID"     value={row.serialId} />
                                <Field label="Tahun Buat"    value={row.tahunBuat} />
                                <Field label="Tahun Operasi" value={row.tahunOperasi} />
                                <Field label="Usia"          value={usia} />
                                <Field label="Status Usia"   value={row.statusUsia} />
                                <Field label="Prioritas"     value={row.prioritas} color={prioColor} />
                            </div>
                        </div>

                        {row.criticalityGi && (
                            <div
                                className="rounded-md p-3 flex flex-col gap-1.5"
                                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                                    Kritikalitas GI
                                </span>
                                <span className="text-[11px] text-white/70">{row.criticalityGi}</span>
                            </div>
                        )}

                        {row.justifikasi && (
                            <div
                                className="rounded-md p-3 flex flex-col gap-1.5"
                                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                                    Justifikasi
                                </span>
                                <p className="text-[10px] text-white/60 leading-relaxed">{row.justifikasi}</p>
                            </div>
                        )}

                        {row.rencana && (
                            <div
                                className="rounded-md p-3 flex flex-col gap-1.5"
                                style={{ background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.15)" }}
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400/50">
                                    Rencana Tindak Lanjut
                                </span>
                                <p className="text-[10px] text-white/60 leading-relaxed">{row.rencana}</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export const BayDetailPane = memo(BayDetailPaneInner);
