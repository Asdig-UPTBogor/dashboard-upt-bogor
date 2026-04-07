/**
 * UnitDetailPane — Section 3 of the 3-pane drill layout.
 *
 * - No unit selected → elegant empty state
 * - Unit selected    → full spec sheet: Lokasi, Peralatan, Kritikalitas,
 *                       Justifikasi, Rencana Tindak Lanjut
 */
"use client";

import { memo } from "react";
import { ArrowLeft } from "lucide-react";
import { COLORS, STATUS_HI_LABEL } from "./design-tokens";
import type { HiRow } from "./useHealthyIndexData";

interface Props {
    row: HiRow | null;
    onBack?: () => void;
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

function UnitDetailPaneInner({ row, onBack }: Props) {
    // ── Empty state ───────────────────────────────────────────────────────────
    if (!row) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4 select-none">
                <div className="w-8 h-8 rounded-full border border-border/20 flex items-center justify-center mb-1">
                    <svg className="w-4 h-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-[10px] text-white/25 text-center leading-relaxed">
                    Pilih unit MTU<br />untuk lihat spesifikasi
                </p>
            </div>
        );
    }

    const sColor     = COLORS.statusHi[row.statusHi] ?? "#94a3b8";
    const thnOps     = parseInt(row.tahunOperasi);
    const thnBuat    = parseInt(row.tahunBuat);
    const usia       = isValidYear(thnOps)  ? `${YEAR_NOW - thnOps} tahun`
                     : isValidYear(thnBuat) ? `${YEAR_NOW - thnBuat} tahun`
                     : "—";
    const prioColor  = row.prioritas === "P0" ? "#fb7185"
                     : row.prioritas === "P1" ? "#fb923c"
                     : row.prioritas === "P2" ? "#fbbf24"
                     : "rgba(255,255,255,0.4)";

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div
                className="px-3 py-2.5 shrink-0 border-b border-border/10 flex items-center gap-2"
            >
                {onBack && (
                    <>
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1 text-muted-foreground/50 hover:text-foreground/80 transition-colors outline-none shrink-0"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="text-[9px]">Kembali</span>
                        </button>
                        <div className="h-3 w-px bg-border/30 shrink-0" />
                    </>
                )}
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
                <span className="text-[11px] font-bold text-foreground/80 truncate">
                    {row.mtu}
                </span>
                <span
                    className="ml-auto text-xl font-bold tabular-nums shrink-0"
                    style={{ color: sColor }}
                >
                    {row.nilaiHi.toFixed(1)}
                </span>
            </div>

            {/* ── Content ── */}
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
                        <Field
                            label="Tegangan / Phasa"
                            value={[row.tegangan, row.phasa].filter(Boolean).join(" · ")}
                        />
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
                        <Field label="Merek"          value={row.merek} />
                        <Field label="Tipe / Model"   value={row.tipe} />
                        <Field label="Serial ID"      value={row.serialId} />
                        <Field label="Tahun Buat"     value={row.tahunBuat} />
                        <Field label="Tahun Operasi"  value={row.tahunOperasi} />
                        <Field label="Usia"           value={usia} />
                        <Field label="Status Usia"    value={row.statusUsia} />
                        <Field label="Prioritas"      value={row.prioritas} color={prioColor} />
                    </div>
                </div>

                {/* Kritikalitas GI */}
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

                {/* Justifikasi */}
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

                {/* Rencana Tindak Lanjut */}
                {row.rencana && row.rencana !== "-" && (
                    <div
                        className="rounded-md p-3 flex flex-col gap-1.5"
                        style={{
                            background: "rgba(250,204,21,0.04)",
                            border: "1px solid rgba(250,204,21,0.15)",
                        }}
                    >
                        <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400/50">
                            Rencana Tindak Lanjut
                        </span>
                        <p className="text-[10px] text-white/60 leading-relaxed">{row.rencana}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export const UnitDetailPane = memo(UnitDetailPaneInner);
