/**
 * UnitDetailPane — Section 3 of the 3-pane drill layout.
 *
 * Design System v2:
 *  • Typography: ds-small, ds-small, ds-data, ds-body
 *  • Colors: var(--ds-*) tokens — theme-aware
 *  • Transitions: ds-transition-fast
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
            <span className="ds-small">{label}</span>
            <span
                className="ds-small leading-tight"
                style={{ color: color ?? "var(--ds-text-primary)" }}
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
                <div className="w-8 h-8 rounded-full border flex items-center justify-center mb-1" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    <svg className="w-4 h-4 text-ds-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="ds-small text-ds-text-tertiary text-center leading-relaxed">
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
                     : "var(--ds-text-tertiary)";

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div
                className="px-3 py-2.5 shrink-0 border-b flex items-center gap-2"
                style={{ borderColor: "var(--ds-border-subtle)" }}
            >
                {onBack && (
                    <>
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1 text-ds-text-tertiary hover:text-ds-text-primary ds-transition-fast outline-none shrink-0 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span className="ds-small">Kembali</span>
                        </button>
                        <div className="h-3 w-px shrink-0" style={{ background: "var(--ds-border-default)" }} />
                    </>
                )}
                <span
                    className="ds-data px-1.5 py-0.5 rounded-sm shrink-0"
                    style={{
                        background: sColor + "20",
                        color: sColor,
                        border: `1px solid ${sColor}40`,
                    }}
                >
                    {STATUS_HI_LABEL[row.statusHi] ?? row.statusHi}
                </span>
                <span className="ds-data text-ds-text-primary truncate">
                    {row.mtu}
                </span>
                <span
                    className="ml-auto ds-kpi text-xl shrink-0"
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
                        className="ds-small"
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
                    style={{ border: "1px solid var(--ds-border-subtle)" }}
                >
                    <span className="ds-small text-ds-text-tertiary">
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
                        style={{ border: "1px solid var(--ds-border-subtle)" }}
                    >
                        <span className="ds-small text-ds-text-tertiary">
                            Kritikalitas GI
                        </span>
                        <span className="ds-body">{row.criticalityGi}</span>
                    </div>
                )}

                {/* Justifikasi */}
                {row.justifikasi && (
                    <div
                        className="rounded-md p-3 flex flex-col gap-1.5"
                        style={{ border: "1px solid var(--ds-border-subtle)" }}
                    >
                        <span className="ds-small text-ds-text-tertiary">
                            Justifikasi
                        </span>
                        <p className="ds-body">{row.justifikasi}</p>
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
                        <span className="ds-small text-yellow-400/50">
                            Rencana Tindak Lanjut
                        </span>
                        <p className="ds-body">{row.rencana}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export const UnitDetailPane = memo(UnitDetailPaneInner);
