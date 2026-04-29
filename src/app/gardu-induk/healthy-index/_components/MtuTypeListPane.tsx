/**
 * MtuTypeListPane — Pane 3 ketika user klik jenis MTU di Pane 2.
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
    mtuType: string;
    rows: HiRow[];
    onSelectUnit: (row: HiRow) => void;
    onBack: () => void;
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

function UnitCard({ row, onClick }: { row: HiRow; onClick: () => void }) {
    const sColor    = COLORS.statusHi[row.statusHi] ?? "#94a3b8";
    const thnOps    = parseInt(row.tahunOperasi);
    const thnBuat   = parseInt(row.tahunBuat);
    const usia      = isValidYear(thnOps)  ? `${YEAR_NOW - thnOps} tahun`
                    : isValidYear(thnBuat) ? `${YEAR_NOW - thnBuat} tahun`
                    : "—";
    const prioColor = row.prioritas === "P0" ? "#fb7185"
                    : row.prioritas === "P1" ? "#fb923c"
                    : row.prioritas === "P2" ? "#fbbf24"
                    : "var(--ds-text-tertiary)";

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => e.key === "Enter" && onClick()}
            className="rounded-md cursor-pointer outline-none ds-transition-fast hover:brightness-110 select-none"
            style={{ background: `${sColor}0a`, border: `1px solid ${sColor}25` }}
        >
            {/* Card header — status badge + merek/tipe + HI score */}
            <div
                className="px-3 py-2 flex items-center gap-2 border-b"
                style={{ borderColor: `${sColor}20` }}
            >
                <span
                    className="ds-data px-1.5 py-0.5 rounded-sm shrink-0"
                    style={{
                        background: `${sColor}20`,
                        color: sColor,
                        border: `1px solid ${sColor}40`,
                    }}
                >
                    {STATUS_HI_LABEL[row.statusHi] ?? row.statusHi}
                </span>
                <span className="ds-small text-ds-text-tertiary flex-1 truncate min-w-0">
                    {[row.merek, row.tipe].filter(Boolean).join(" · ") || "—"}
                </span>
                <span
                    className="ds-kpi text-base shrink-0"
                    style={{ color: sColor }}
                >
                    {row.nilaiHi.toFixed(1)}
                </span>
            </div>

            {/* Lokasi block */}
            <div className="px-3 pt-2.5 pb-1">
                <span className="ds-small" style={{ color: `${sColor}99` }}>
                    Lokasi
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1.5">
                    <Field label="ULTG"            value={row.ultg} />
                    <Field label="Gardu Induk"     value={row.gi} />
                    <Field label="Bay"             value={row.bay} />
                    <Field
                        label="Tegangan / Phasa"
                        value={[row.tegangan, row.phasa].filter(Boolean).join(" · ")}
                    />
                </div>
            </div>

            {/* Peralatan block */}
            <div className="px-3 pt-2 pb-1 border-t" style={{ borderColor: "var(--ds-border-subtle)" }}>
                <span className="ds-small text-ds-text-tertiary">
                    Peralatan
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1.5">
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

            {/* Kritikalitas */}
            {row.criticalityGi && (
                <div className="px-3 pt-2 pb-1 border-t" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    <span className="ds-small text-ds-text-tertiary">
                        Kritikalitas GI
                    </span>
                    <p className="ds-body mt-1">{row.criticalityGi}</p>
                </div>
            )}

            {/* Justifikasi */}
            {row.justifikasi && (
                <div className="px-3 pt-2 pb-1 border-t" style={{ borderColor: "var(--ds-border-subtle)" }}>
                    <span className="ds-small text-ds-text-tertiary">
                        Justifikasi
                    </span>
                    <p className="ds-body mt-1">{row.justifikasi}</p>
                </div>
            )}

            {/* Rencana Tindak Lanjut */}
            {row.rencana && row.rencana !== "-" && (
                <div
                    className="px-3 pt-2 pb-2.5 rounded-b-md border-t"
                    style={{
                        background: "rgba(250,204,21,0.04)",
                        borderColor: "rgba(250,204,21,0.15)",
                    }}
                >
                    <span className="ds-small text-yellow-400/50">
                        Rencana Tindak Lanjut
                    </span>
                    <p className="ds-body mt-1">{row.rencana}</p>
                </div>
            )}
        </div>
    );
}

function MtuTypeListPaneInner({ mtuType, rows, onSelectUnit, onBack }: Props) {
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 py-2 shrink-0 border-b flex items-center gap-2" style={{ borderColor: "var(--ds-border-subtle)" }}>
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-ds-text-tertiary hover:text-ds-text-primary ds-transition-fast outline-none shrink-0 cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="ds-small">Kembali</span>
                </button>
                <div className="h-3 w-px shrink-0" style={{ background: "var(--ds-border-default)" }} />
                <span className="ds-data text-ds-text-primary">{mtuType}</span>
                <span className="ds-small ml-auto tabular-nums shrink-0">
                    {rows.length} unit
                </span>
            </div>

            {/* Unit card list — scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-2.5">
                {rows.map((row, i) => (
                    <UnitCard key={i} row={row} onClick={() => onSelectUnit(row)} />
                ))}
            </div>

            <p className="ds-small text-ds-text-tertiary text-center pb-1 shrink-0">
                Klik kartu untuk lihat detail lengkap
            </p>
        </div>
    );
}

export const MtuTypeListPane = memo(MtuTypeListPaneInner);
