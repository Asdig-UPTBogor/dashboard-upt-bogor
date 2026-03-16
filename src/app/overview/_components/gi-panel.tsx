"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Building2, Filter, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { GI, Bay, Relay, MtuEquipment } from "./types";
import { C, EQUIPMENT_TYPES } from "./types";
import { getGIColumn, getULTGColumn, getBayNameColumn, SHEETS } from "./relation-utils";

type Row = Record<string, string>;

const DIM = 0.15;

/** MTU column configs for each equipment type */
const MTU_COLUMNS: { key: string; sheetName: string; label: string; fields: { label: string; key: string; mono?: boolean }[] }[] = [
    {
        key: "trafo", sheetName: SHEETS.TRAFO, label: "Trafo", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "MVA", key: "MVA" },
            { label: "Phasa", key: "Phasa" }, { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
    {
        key: "pmt", sheetName: SHEETS.PMT, label: "PMT", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "Phasa", key: "Phasa" },
            { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
    {
        key: "pms", sheetName: SHEETS.PMS, label: "PMS", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "Phasa", key: "Phasa" },
            { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
    {
        key: "ct", sheetName: SHEETS.CT, label: "CT", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "Phasa", key: "Phasa" },
            { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
    {
        key: "cvt", sheetName: SHEETS.CVT, label: "CVT", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "Phasa", key: "Phasa" },
            { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
    {
        key: "la", sheetName: SHEETS.LA, label: "LA", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "Phasa", key: "Phasa" },
            { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
    {
        key: "kabelPower", sheetName: SHEETS.KABEL_POWER, label: "Kabel Power", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "Phasa", key: "Phasa" },
            { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
    {
        key: "sealingEnd", sheetName: SHEETS.SEALING_END, label: "Sealing End", fields: [
            { label: "Merek", key: "Merek" }, { label: "Tipe", key: "Tipe" }, { label: "Phasa", key: "Phasa" },
            { label: "S/N", key: "Serial Id", mono: true },
            { label: "Operasi", key: "Tahun Operasi" }, { label: "Buat", key: "Tahun Buat" },
        ]
    },
];

/** Equipment color lookup */
const eqColorMap: Record<string, string> = {};
EQUIPMENT_TYPES.forEach(e => { eqColorMap[e.key] = e.color; });

type MtuDataMap = Record<string, MtuEquipment[]>;

interface GiPanelProps {
    expandedGI: string | null;
    setExpandedGI: (gi: string | null) => void;
    expandedTypes: Set<string>;
    setExpandedTypes: (types: Set<string>) => void;
    filteredGIs: GI[];
    filteredBays: Bay[];
    bays: Bay[];
    relays: Relay[];
    trafos: MtuEquipment[];
    mtuData: MtuDataMap;
    bayTypeColorMap: Record<string, string>;
    activeULTG: string | null;
    setActiveULTG: (v: string | null) => void;
    activeGIType: string | null;
    setActiveGIType: (v: string | null) => void;
    activeVoltage: string | null;
    setActiveVoltage: (v: string | null) => void;
    detailBayTypeFilter?: string | null;
    detailProteksiFilter?: string | null;
}

export function GiPanel({
    expandedGI, setExpandedGI, expandedTypes, setExpandedTypes,
    filteredGIs, filteredBays, bays, relays, trafos, mtuData,
    bayTypeColorMap,
    activeULTG, setActiveULTG, activeGIType, setActiveGIType,
    activeVoltage, setActiveVoltage, detailBayTypeFilter, detailProteksiFilter,
}: GiPanelProps) {
    const [selectedBay, setSelectedBay] = useState<string | null>(null);
    const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);

    return (
        <div style={{ flex: '2 1 0%', minWidth: 0 }} className="flex flex-col h-full">
            {expandedGI ? (() => {
                const selGI = filteredGIs.find((g) => g["Master Gardu Induk"] === expandedGI);
                const expandedLower = expandedGI.toLowerCase();
                const selBays = filteredBays.filter((b) => (b as unknown as Row)[getGIColumn(SHEETS.BAY)]?.toLowerCase() === expandedLower);
                const selRelays = relays.filter((r) => (r as unknown as Row)[getGIColumn(SHEETS.RELAY)]?.toLowerCase() === expandedLower);
                // Filter all MTU equipment for this GI
                const filteredMtu: Record<string, MtuEquipment[]> = {};
                for (const col of MTU_COLUMNS) {
                    const items = mtuData[col.key] || [];
                    filteredMtu[col.key] = items.filter((t) => (t as unknown as Row)[getGIColumn(col.sheetName)]?.toLowerCase() === expandedLower);
                }
                const selTrafos = filteredMtu.trafo || [];

                // When proteksi filter is active, find bay types that have relays with that proteksi
                const allowedBayTypes = detailProteksiFilter
                    ? new Set(selRelays.filter(r => (r["Fungsi Proteksi"] || "Blm Update") === detailProteksiFilter).map(r => r["Type Bay"] || "Lain"))
                    : null;

                const allGroups = selBays.reduce((acc, b) => { const t = b["Type Bay"] || "Lain"; (acc[t] = acc[t] || []).push((b as unknown as Row)[getBayNameColumn(SHEETS.BAY) || "Master Bay"]); return acc; }, {} as Record<string, string[]>);
                const selGroups = allowedBayTypes
                    ? Object.fromEntries(Object.entries(allGroups).filter(([type]) => allowedBayTypes.has(type)))
                    : allGroups;

                const activeFilter = detailBayTypeFilter || detailProteksiFilter;
                const totalForPct = selBays.length;
                const giType = selGI?.["Type Gardu Induk"] || "GI";
                const giTypeColors: Record<string, string> = { GI: C.indigo, GIS: C.teal, GITET: C.amber };
                const accentColor = giTypeColors[giType] || C.indigo;

                return (
                    <div
                        className="flex flex-col h-full"
                    >
                        {/* Title Bar */}
                        <div className="flex items-start gap-2 px-3 py-2.5 border-b border-border/50">
                            <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-base font-bold truncate">{expandedGI}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                                    {[
                                        selGI?.["Master ULTG"] && `ULTG ${selGI["Master ULTG"]}`,
                                        selGI?.["Tegangan (kV)"] && `Tegangan: ${selGI["Tegangan (kV)"]}`,
                                    ].filter(Boolean).join(" · ")}
                                </p>
                            </div>
                            <div className="text-right shrink-0 self-center">
                                <p className="text-lg font-bold tabular-nums leading-none" style={{ color: accentColor }}>{selBays.length}</p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">Bay</p>
                            </div>
                            <button
                                onClick={() => { setExpandedGI(null); setExpandedTypes(new Set()); setSelectedBay(null); }}
                                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        {/* Bay Breakdown */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            <AnimatePresence mode="popLayout">
                                {Object.entries(selGroups)
                                    .sort(([aType, a], [bType, b]) => {
                                        if (detailBayTypeFilter) {
                                            const aMatch = aType === detailBayTypeFilter ? 1 : 0;
                                            const bMatch = bType === detailBayTypeFilter ? 1 : 0;
                                            if (aMatch !== bMatch) return bMatch - aMatch;
                                        }
                                        return b.length - a.length;
                                    })
                                    .map(([type, names], i) => {
                                        const tColor = bayTypeColorMap[type] || accentColor;
                                        const pct = totalForPct > 0 ? Math.round((names.length / totalForPct) * 100) : 0;
                                        const isMatch = !activeFilter || (detailBayTypeFilter ? detailBayTypeFilter === type : allowedBayTypes?.has(type));
                                        const isHighlighted = !!isMatch && !!activeFilter;
                                        return (
                                            <motion.div
                                                key={type}
                                                animate={{
                                                    opacity: isMatch ? 1 : DIM,
                                                    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                                                }}
                                                className="rounded-lg"
                                                style={{
                                                    padding: isHighlighted ? '10px 12px' : '4px 0px',
                                                }}
                                            >
                                                {/* Type header: Name [bar] Count */}
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span
                                                        className="text-[13px] font-bold whitespace-nowrap text-foreground"
                                                    >{type}</span>
                                                    <div className="flex-1 h-[4px] rounded-full bg-muted/30 overflow-hidden min-w-[20px]">
                                                        <motion.div
                                                            className="h-full rounded-full"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${pct}%` }}
                                                            transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
                                                            style={{ backgroundColor: tColor }}
                                                        />
                                                    </div>
                                                    <span
                                                        className="text-[13px] font-bold tabular-nums text-muted-foreground"
                                                    >{names.length}</span>
                                                </div>
                                                <div className="space-y-0.5">
                                                    {names.map((n, ni) => {
                                                        const bayRelays = selRelays.filter(r => (r as unknown as Row)[getBayNameColumn(SHEETS.RELAY) || "Bay/Diameter"]?.toLowerCase() === n.toLowerCase());
                                                        const isBaySelected = selectedBay === n;
                                                        return (
                                                            <div key={`${type}_${ni}`}>
                                                                <motion.button
                                                                    className="w-full text-left flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:pl-3 border-l-2 border-transparent hover:border-foreground/40 group"
                                                                    animate={{ color: isHighlighted ? `${tColor}cc` : undefined }}
                                                                    transition={{ duration: 0.2 }}
                                                                    style={{ fontSize: isHighlighted ? 12 : 11 }}
                                                                    onClick={() => setSelectedBay(isBaySelected ? null : n)}
                                                                >
                                                                    <motion.span
                                                                        animate={{ rotate: isBaySelected ? 90 : 0 }}
                                                                        transition={{ duration: 0.2 }}
                                                                        className="shrink-0"
                                                                    >
                                                                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                                                                    </motion.span>
                                                                    <span className="truncate flex-1">{n}</span>
                                                                    {bayRelays.length > 0 && (
                                                                        <span className="text-[9px] text-muted-foreground/60 tabular-nums shrink-0">
                                                                            {bayRelays.length} relay
                                                                        </span>
                                                                    )}
                                                                </motion.button>
                                                                <AnimatePresence>
                                                                    {isBaySelected && (() => {
                                                                        const nLower = n.toLowerCase();

                                                                        // Filter equipment for this bay
                                                                        const bayMtu: Record<string, Row[]> = {};
                                                                        let totalMtuItems = 0;
                                                                        for (const col of MTU_COLUMNS) {
                                                                            const items = (filteredMtu[col.key] || []) as unknown as Row[];
                                                                            bayMtu[col.key] = items.filter(r => r["Master Bay"]?.toLowerCase() === nLower);
                                                                            totalMtuItems += bayMtu[col.key].length;
                                                                        }

                                                                        // Relay (separate hierarchy)
                                                                        const bayRelayList = selRelays.filter(r =>
                                                                            (r as unknown as Row)[getBayNameColumn(SHEETS.RELAY) || "Bay/Diameter"]?.toLowerCase() === nLower
                                                                        );

                                                                        // Bay type for transmission check
                                                                        const bayRow = selBays.find(b => (b as unknown as Row)[getBayNameColumn(SHEETS.BAY) || "Master Bay"]?.toLowerCase() === nLower);
                                                                        const bayType = bayRow?.["Type Bay"] || "";
                                                                        const isTransmission = bayType.toLowerCase().includes("penghantar") || bayType.toLowerCase().includes("saluran");

                                                                        if (totalMtuItems === 0 && bayRelayList.length === 0) return null;

                                                                        // Helper: render a key-value row
                                                                        const KV = ({ label, value, mono }: { label: string; value?: string; mono?: boolean }) => (
                                                                            value ? (
                                                                                <div className="flex items-baseline justify-between gap-2 py-[2px]">
                                                                                    <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
                                                                                    <span className={`text-[11px] text-foreground font-medium text-right ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
                                                                                </div>
                                                                            ) : null
                                                                        );

                                                                        // Status color helper
                                                                        const statusColor = (s?: string) => {
                                                                            if (!s) return 'text-muted-foreground/50';
                                                                            const l = s.toLowerCase();
                                                                            if (l.includes('muda') || l.includes('normal')) return 'text-emerald-400';
                                                                            if (l.includes('tua')) return 'text-red-400';
                                                                            return 'text-amber-400';
                                                                        };

                                                                        // Equipment chips with data
                                                                        const activeMtuCols = MTU_COLUMNS.filter(col => bayMtu[col.key]?.length > 0);

                                                                        return (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                                                                className="overflow-hidden"
                                                                            >
                                                                                <div className="ml-5 my-1.5 border border-border/40 rounded-md overflow-hidden bg-card/30">

                                                                                    {/* ── Peralatan Utama ── */}
                                                                                    {activeMtuCols.length > 0 && (
                                                                                        <div>
                                                                                            <div className="px-3 py-1.5 bg-muted/20 border-b border-border/20 flex items-center gap-2">
                                                                                                <div className="h-3 w-0.5 rounded-full bg-amber-400" />
                                                                                                <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">Peralatan Utama</span>
                                                                                                <span className="text-[9px] text-muted-foreground/40 ml-auto tabular-nums">{totalMtuItems}</span>
                                                                                            </div>
                                                                                            <div className="px-3 py-2 flex flex-wrap gap-1.5">
                                                                                                {activeMtuCols.map((col) => {
                                                                                                    const count = bayMtu[col.key].length;
                                                                                                    const eqColor = eqColorMap[col.key] || C.indigo;
                                                                                                    const isActive = expandedEquipment === col.key;
                                                                                                    return (
                                                                                                        <button
                                                                                                            key={col.key}
                                                                                                            onClick={(e) => { e.stopPropagation(); setExpandedEquipment(isActive ? null : col.key); }}
                                                                                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-150 cursor-pointer border"
                                                                                                            style={{
                                                                                                                backgroundColor: isActive ? `${eqColor}20` : 'transparent',
                                                                                                                borderColor: isActive ? `${eqColor}60` : 'rgba(255,255,255,0.08)',
                                                                                                                color: isActive ? eqColor : undefined,
                                                                                                            }}
                                                                                                        >
                                                                                                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: eqColor }} />
                                                                                                            <span>{col.label}</span>
                                                                                                            <span className="text-[9px] opacity-50 tabular-nums">{count}</span>
                                                                                                        </button>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                            <AnimatePresence>
                                                                                                {expandedEquipment && bayMtu[expandedEquipment]?.length > 0 && (() => {
                                                                                                    const col = MTU_COLUMNS.find(c => c.key === expandedEquipment);
                                                                                                    const items = bayMtu[expandedEquipment];
                                                                                                    const eqColor = eqColorMap[expandedEquipment] || C.indigo;
                                                                                                    if (!col) return null;
                                                                                                    return (
                                                                                                        <motion.div
                                                                                                            key={expandedEquipment}
                                                                                                            initial={{ height: 0, opacity: 0 }}
                                                                                                            animate={{ height: 'auto', opacity: 1 }}
                                                                                                            exit={{ height: 0, opacity: 0 }}
                                                                                                            transition={{ duration: 0.2 }}
                                                                                                            className="overflow-hidden"
                                                                                                        >
                                                                                                            <div className="px-3 pb-2.5">
                                                                                                                <div className={items.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
                                                                                                                    {items.map((row, ri) => (
                                                                                                                        <div key={ri} className="rounded px-2.5 py-1.5 bg-muted/20" style={{ borderLeft: `2px solid ${eqColor}` }}>
                                                                                                                            {col.fields.map(f => <KV key={f.key} label={f.label} value={row[f.key]} mono={f.mono} />)}
                                                                                                                            {row["Status Usia"] && (
                                                                                                                                <div className="flex items-baseline justify-between gap-2 py-[2px]">
                                                                                                                                    <span className="text-[10px] text-muted-foreground/50">Status</span>
                                                                                                                                    <span className={`text-[10px] font-medium ${statusColor(row["Status Usia"])}`}>{row["Status Usia"]}</span>
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    ))}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </motion.div>
                                                                                                    );
                                                                                                })()}
                                                                                            </AnimatePresence>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* ── Proteksi ── */}
                                                                                    {bayRelayList.length > 0 && (
                                                                                        <div className={activeMtuCols.length > 0 ? "border-t border-border/20" : ""}>
                                                                                            <div className="px-3 py-1.5 bg-muted/20 border-b border-border/20 flex items-center gap-2">
                                                                                                <div className="h-3 w-0.5 rounded-full bg-indigo-400" />
                                                                                                <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">Proteksi</span>
                                                                                                <span className="text-[9px] text-muted-foreground/40 ml-auto tabular-nums">{bayRelayList.length}</span>
                                                                                            </div>
                                                                                            <div className="px-3 py-1.5">
                                                                                                {bayRelayList.map((relay, ri) => (
                                                                                                    <div key={ri} className="flex items-baseline gap-2 py-[2px]">
                                                                                                        <span className="text-[10px] text-foreground font-medium">{relay["Fungsi Proteksi"] || "—"}</span>
                                                                                                        <span className="text-[9px] text-muted-foreground/30">·</span>
                                                                                                        {relay["Merk"] && <span className="text-[9px] text-muted-foreground/50">{relay["Merk"]}</span>}
                                                                                                        {relay["Type"] && <span className="text-[9px] text-muted-foreground/40">{relay["Type"]}</span>}
                                                                                                        {relay["Jenis Relay"] && <span className="text-[9px] text-muted-foreground/30 ml-auto">{relay["Jenis Relay"]}</span>}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* ── Transmisi ── */}
                                                                                    {isTransmission && (
                                                                                        <div className={(activeMtuCols.length > 0 || bayRelayList.length > 0) ? "border-t border-border/20" : ""}>
                                                                                            <div className="px-3 py-1.5 bg-muted/20 border-b border-border/20 flex items-center gap-2">
                                                                                                <div className="h-3 w-0.5 rounded-full bg-teal-400" />
                                                                                                <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">Transmisi</span>
                                                                                            </div>
                                                                                            <div className="px-3 py-1.5">
                                                                                                <KV label="Type" value={bayType} />
                                                                                                <KV label="Penghantar" value={n} />
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </motion.div>
                                                                        );
                                                                    })()}
                                                                </AnimatePresence>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                            </AnimatePresence>
                        </div>
                    </div>
                );
            })() : (
                <>
                    <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-semibold">Gardu Induk</span>
                        <Badge variant="secondary" className="ml-auto text-[9px] tabular-nums">{filteredGIs.length}</Badge>
                    </div>
                    {(activeULTG || activeGIType || activeVoltage) && (
                        <div className="flex items-center gap-1 px-3 pb-1">
                            <Filter className="h-2.5 w-2.5 text-primary" />
                            <span className="text-[8px] text-primary">Filtered</span>
                            <button onClick={() => { setActiveULTG(null); setActiveGIType(null); setActiveVoltage(null); }} className="text-[8px] text-muted-foreground hover:text-foreground ml-auto">Reset</button>
                        </div>
                    )}
                    <div className="p-1.5 flex-1 overflow-y-auto">
                        <style>{`
                @keyframes giSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
                .gi-animate { animation: giSlideIn 0.25s cubic-bezier(0.16,1,0.3,1) both; }
                .gi-btn { transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
                .gi-btn:hover { transform: translateX(4px); background-color: rgba(255,255,255,0.04); }
                .gi-btn:active { transform: scale(0.97) translateX(2px); }
              `}</style>
                        <div style={{ columns: 2, columnGap: '6px' }}>
                            {(() => {
                                const voltageColorMap: Record<string, string> = { '70': C.amber, '150': C.indigo, '500': C.rose, '275': C.teal };
                                const giTypeColorMap: Record<string, string> = { GI: C.indigo, GIS: C.teal, GITET: C.amber };
                                const sorted = [...filteredGIs].sort((a, b) => Number(b["Tegangan (kV)"] || 0) - Number(a["Tegangan (kV)"] || 0));
                                let lastVoltage = '';
                                let sepCounter = 0;
                                return sorted.flatMap((gi, idx) => {
                                    const giName = gi["Master Gardu Induk"];
                                    const giType = gi["Type Gardu Induk"] || "GI";
                                    const giColor = giTypeColorMap[giType] || C.purple;
                                    const voltage = gi["Tegangan (kV)"] || "N/A";
                                    const vColor = voltageColorMap[voltage] || C.purple;
                                    const bayCount = bays.filter((b) => (b as unknown as Row)[getGIColumn(SHEETS.BAY)] === giName).length;
                                    const isSelected = expandedGI === giName;
                                    const items: React.ReactNode[] = [];
                                    if (voltage !== lastVoltage) {
                                        sepCounter++;
                                        items.push(
                                            <div key={`sep-${voltage}-${sepCounter}`} className="flex items-center gap-2 py-0.5 px-1" style={{ breakInside: 'avoid' }}>
                                                <span className="text-[9px] font-semibold shrink-0" style={{ color: vColor }}>{voltage}</span>
                                                <div className="h-[1px] flex-1 bg-border/40" />
                                            </div>
                                        );
                                        lastVoltage = voltage;
                                    }
                                    items.push(
                                        <button
                                            key={giName}
                                            onClick={() => { setExpandedGI(isSelected ? null : giName); setExpandedTypes(new Set()); }}
                                            className={`gi-animate gi-btn text-left px-2 py-1.5 rounded-md border flex items-center gap-2 group mb-1.5 w-full ${isSelected
                                                ? 'border-primary/40'
                                                : 'border-transparent hover:border-border/50'
                                                }`}
                                            style={{ animationDelay: `${idx * 15}ms`, backgroundColor: isSelected ? `${giColor}20` : `${giColor}08`, breakInside: 'avoid' }}
                                        >
                                            <div className="h-2 w-2 rounded-full shrink-0 transition-all group-hover:scale-125" style={{ backgroundColor: isSelected ? giColor : `${giColor}40`, boxShadow: isSelected ? `0 0 6px ${giColor}60` : 'none' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[10px] font-semibold truncate transition-colors ${isSelected ? 'text-primary' : 'text-foreground/80 group-hover:text-foreground'}`}>
                                                    {giName}
                                                </p>
                                                <p className="text-[8px] text-muted-foreground/70 truncate">{gi["Master ULTG"]} · {voltage}</p>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="text-[10px] font-bold tabular-nums" style={{ color: isSelected ? vColor : undefined }}>{bayCount}</span>
                                                <span className="text-[7px] text-muted-foreground/50">bay</span>
                                            </div>
                                            <ChevronRight className={`h-3 w-3 shrink-0 transition-all ${isSelected ? 'text-primary opacity-100' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'}`} />
                                        </button>
                                    );
                                    return items;
                                });
                            })()}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
