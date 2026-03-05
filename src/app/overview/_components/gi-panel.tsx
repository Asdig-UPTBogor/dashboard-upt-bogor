"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Building2, Filter, Activity, X, Shield, Zap, CircleDot, ToggleRight, Gauge, Cable } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { GI, Bay, Relay, Trafo, MTUEquipment } from "./types";
import { C } from "./types";
import { getGIColumn, getULTGColumn, getBayNameColumn, SHEETS } from "./relation-utils";

// Config-driven join columns (resolved once from overview.json)
const GI_GI_COL = getGIColumn(SHEETS.GI);         // "Master Gardu Induk"
const GI_ULTG_COL = getULTGColumn(SHEETS.GI);     // "Master ULTG"
const BAY_GI_COL = getGIColumn(SHEETS.BAY);       // "Master Gardu Induk"
const BAY_NAME_COL = getBayNameColumn(SHEETS.BAY)!; // "Bay/Diameter"
const RELAY_GI_COL = getGIColumn(SHEETS.RELAY);    // "Gardu Induk"
const RELAY_BAY_COL = getBayNameColumn(SHEETS.RELAY)!; // "Bay/Diameter"
const TRAFO_GI_COL = getGIColumn(SHEETS.TRAFO);    // "Master Gardu Induk"
const TRAFO_BAY_COL = getBayNameColumn(SHEETS.TRAFO)!; // "Master Bay"
const PMT_GI_COL = getGIColumn(SHEETS.PMT);
const PMT_BAY_COL = getBayNameColumn(SHEETS.PMT)!;
const PMS_GI_COL = getGIColumn(SHEETS.PMS);
const PMS_BAY_COL = getBayNameColumn(SHEETS.PMS)!;
const CT_GI_COL = getGIColumn(SHEETS.CT);
const CT_BAY_COL = getBayNameColumn(SHEETS.CT)!;
const CVT_GI_COL = getGIColumn(SHEETS.CVT);
const CVT_BAY_COL = getBayNameColumn(SHEETS.CVT)!;
const LA_GI_COL = getGIColumn(SHEETS.LA);
const LA_BAY_COL = getBayNameColumn(SHEETS.LA)!;
const KP_GI_COL = getGIColumn(SHEETS.KABEL_POWER);
const KP_BAY_COL = getBayNameColumn(SHEETS.KABEL_POWER)!;

/** MTU section definition for visual rendering */
const MTU_SECTIONS = [
    { key: "trafo", label: "Transformator", Icon: Zap, color: C.amber, giCol: TRAFO_GI_COL, bayCol: TRAFO_BAY_COL },
    { key: "pmt", label: "PMT", Icon: CircleDot, color: C.indigo, giCol: PMT_GI_COL, bayCol: PMT_BAY_COL },
    { key: "pms", label: "PMS", Icon: ToggleRight, color: C.teal, giCol: PMS_GI_COL, bayCol: PMS_BAY_COL },
    { key: "ct", label: "Current Transformer", Icon: Gauge, color: C.rose, giCol: CT_GI_COL, bayCol: CT_BAY_COL },
    { key: "cvt", label: "CVT", Icon: Activity, color: C.purple, giCol: CVT_GI_COL, bayCol: CVT_BAY_COL },
    { key: "la", label: "Lightning Arrester", Icon: Shield, color: C.emerald, giCol: LA_GI_COL, bayCol: LA_BAY_COL },
    { key: "kabelPower", label: "Kabel Power", Icon: Cable, color: C.orange, giCol: KP_GI_COL, bayCol: KP_BAY_COL },
] as const;

type Row = Record<string, string>;

const DIM = 0.15;

interface GiPanelProps {
    expandedGI: string | null;
    setExpandedGI: (gi: string | null) => void;
    expandedTypes: Set<string>;
    setExpandedTypes: (types: Set<string>) => void;
    filteredGIs: GI[];
    filteredBays: Bay[];
    bays: Bay[];
    relays: Relay[];
    trafos: Trafo[];
    pmts: MTUEquipment[];
    pmsList: MTUEquipment[];
    cts: MTUEquipment[];
    cvts: MTUEquipment[];
    las: MTUEquipment[];
    kabelPower: MTUEquipment[];
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
    filteredGIs, filteredBays, bays, relays, trafos,
    pmts, pmsList, cts, cvts, las, kabelPower,
    bayTypeColorMap,
    activeULTG, setActiveULTG, activeGIType, setActiveGIType,
    activeVoltage, setActiveVoltage, detailBayTypeFilter, detailProteksiFilter,
}: GiPanelProps) {
    const [selectedBay, setSelectedBay] = useState<string | null>(null);

    // Build lookup for MTU data arrays by section key
    const mtuDataMap: Record<string, Row[]> = {
        trafo: trafos as unknown as Row[],
        pmt: pmts as unknown as Row[],
        pms: pmsList as unknown as Row[],
        ct: cts as unknown as Row[],
        cvt: cvts as unknown as Row[],
        la: las as unknown as Row[],
        kabelPower: kabelPower as unknown as Row[],
    };

    return (
        <div style={{ flex: '2 1 0%', minWidth: 0 }} className="flex flex-col h-full">
            {expandedGI ? (() => {
                const selGI = filteredGIs.find((g) => g["Master Gardu Induk"] === expandedGI);
                const selBays = filteredBays.filter((b) => (b as unknown as Record<string, string>)[BAY_GI_COL] === expandedGI);
                const selRelays = relays.filter((r) => (r as unknown as Record<string, string>)[RELAY_GI_COL] === expandedGI);
                const selTrafos = trafos.filter((t) => (t as unknown as Record<string, string>)[TRAFO_GI_COL] === expandedGI);

                // When proteksi filter is active, find bay types that have relays with that proteksi
                const allowedBayTypes = detailProteksiFilter
                    ? new Set(selRelays.filter(r => (r["Fungsi Proteksi"] || "Blm Update") === detailProteksiFilter).map(r => r["Type Bay"] || "Lain"))
                    : null;

                const allGroups = selBays.reduce((acc, b) => { const t = b["Type Bay"] || "Lain"; (acc[t] = acc[t] || []).push((b as unknown as Record<string, string>)[BAY_NAME_COL]); return acc; }, {} as Record<string, string[]>);
                // Filter groups if proteksi filter active
                const selGroups = allowedBayTypes
                    ? Object.fromEntries(Object.entries(allGroups).filter(([type]) => allowedBayTypes.has(type)))
                    : allGroups;

                const activeFilter = detailBayTypeFilter || detailProteksiFilter;
                const totalForPct = selBays.length;
                const giType = selGI?.["GI Type"] || "GI";
                const giTypeColors: Record<string, string> = { GI: C.indigo, GIS: C.teal, GITET: C.amber };
                const accentColor = giTypeColors[giType] || C.indigo;
                const ageText = selGI?.["Tanggal Operasi"] ? (() => {
                    const m = selGI["Tanggal Operasi"].match(/(\d{4})/);
                    return m ? `${new Date().getFullYear() - parseInt(m[1])} Tahun` : null;
                })() : null;

                return (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col h-full"
                    >
                        {/* Title Bar */}
                        <div className="flex items-start gap-2 px-3 py-2.5 border-b border-border/50">
                            <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-base font-bold truncate">{expandedGI}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                                    {[
                                        selGI?.["Master ULTG"] && `ULTG ${selGI["Master ULTG"]}`,
                                        selGI?.["Voltage (kV)"] && `Tegangan: ${selGI["Voltage (kV)"]} kV`,
                                        selGI?.["Status Operasi"] && `Status: ${selGI["Status Operasi"]}`,
                                        selGI?.["Status Kepemilikan"] && `Kepemilikan: ${selGI["Status Kepemilikan"]}`,
                                        selGI?.["Tanggal Operasi"] && `Tgl. Operasi: ${selGI["Tanggal Operasi"]}`,
                                        ageText && `Lama Operasi: ${ageText}`,
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
                            {/* Bay Type Items — motion layout for smooth reorder */}
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
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{
                                                    opacity: isMatch ? 1 : DIM,
                                                    y: 0,
                                                    transition: { delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                                                }}
                                                className="rounded-lg"
                                                style={{
                                                    borderLeft: isHighlighted ? `3px solid ${tColor}` : '3px solid transparent',
                                                    background: isHighlighted ? `linear-gradient(135deg, ${tColor}12 0%, ${tColor}06 40%, transparent 80%)` : 'transparent',
                                                    boxShadow: isHighlighted ? `0 2px 16px ${tColor}15, inset 0 1px 0 ${tColor}10` : 'none',
                                                    padding: isHighlighted ? '10px 12px' : '2px 0px',
                                                }}
                                            >
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <motion.div
                                                        className="shrink-0 rounded-full"
                                                        animate={{
                                                            width: isHighlighted ? 14 : 10,
                                                            height: isHighlighted ? 14 : 10,
                                                            boxShadow: isHighlighted ? `0 0 10px ${tColor}60` : `0 0 0px ${tColor}00`,
                                                        }}
                                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                        style={{ backgroundColor: tColor }}
                                                    />
                                                    <span
                                                        className={`font-bold flex-1 transition-all duration-300 ${isHighlighted ? 'text-base' : 'text-xs'}`}
                                                        style={{ color: tColor }}
                                                    >{type}</span>
                                                    <span
                                                        className={`font-bold tabular-nums transition-all duration-300 ${isHighlighted ? 'text-base' : 'text-xs'}`}
                                                        style={{ color: tColor }}
                                                    >{names.length}</span>
                                                </div>
                                                <motion.div
                                                    className="rounded-full bg-muted/30 overflow-hidden mb-2"
                                                    animate={{ height: isHighlighted ? 5 : 4 }}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    <motion.div
                                                        className="h-full rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
                                                        style={{ backgroundColor: tColor }}
                                                    />
                                                </motion.div>
                                                <div className="space-y-0.5">
                                                    {names.map((n, ni) => {
                                                        const bayRelays = selRelays.filter(r => (r as unknown as Record<string, string>)[RELAY_BAY_COL]?.toLowerCase() === n.toLowerCase());
                                                        const isBaySelected = selectedBay === n;
                                                        return (
                                                            <div key={n}>
                                                                <motion.button
                                                                    className="w-full text-left flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-muted/40 transition-colors group"
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1, color: isHighlighted ? `${tColor}cc` : undefined }}
                                                                    transition={{ delay: i * 0.04 + ni * 0.02, duration: 0.3 }}
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
                                                                        // Hierarchy: GI already filtered (selTrafos), now filter by Bay
                                                                        const bayTrafos = selTrafos.filter(t => (t as unknown as Row)[TRAFO_BAY_COL]?.toLowerCase() === nLower);
                                                                        if (bayRelays.length === 0 && bayTrafos.length === 0) return null;
                                                                        return (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                                                className="overflow-hidden"
                                                                            >
                                                                                <div className="ml-4 pl-3 border-l-2 py-2 space-y-2" style={{ borderColor: `${tColor}30` }}>

                                                                                    {/* ── Transformator ── */}
                                                                                    {bayTrafos.length > 0 && (
                                                                                        <motion.div
                                                                                            initial={{ opacity: 0, x: -8 }}
                                                                                            animate={{ opacity: 1, x: 0 }}
                                                                                            transition={{ duration: 0.25 }}
                                                                                            className="rounded-lg p-2.5 space-y-1.5"
                                                                                            style={{ background: `${C.amber}06`, border: `1px solid ${C.amber}18` }}
                                                                                        >
                                                                                            <div className="flex items-center gap-2 pb-1.5 border-b" style={{ borderColor: `${C.amber}15` }}>
                                                                                                <div className="p-1 rounded" style={{ background: `${C.amber}15` }}>
                                                                                                    <Zap className="h-3 w-3" style={{ color: C.amber }} />
                                                                                                </div>
                                                                                                <span className="text-[11px] font-semibold tracking-wide" style={{ color: C.amber }}>Transformator</span>
                                                                                                <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${C.amber}12`, color: C.amber }}>{bayTrafos.length} unit</span>
                                                                                            </div>
                                                                                            {bayTrafos.map((trafo, ti) => (
                                                                                                <div key={ti} className="pl-2.5 py-1.5 rounded" style={{ borderLeft: `2px solid ${C.amber}30` }}>
                                                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                                                        {trafo["Merek"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">Merek</span>{" "}<span className="text-foreground/80">{trafo["Merek"]}</span></span>)}
                                                                                                        {trafo["MVA"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">MVA</span>{" "}<span className="text-foreground/80 font-semibold">{trafo["MVA"]}</span></span>)}
                                                                                                        {trafo["Tipe"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">Tipe</span>{" "}<span className="text-foreground/80">{trafo["Tipe"]}</span></span>)}
                                                                                                        {trafo["Phasa"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">Phasa</span>{" "}<span className="text-foreground/80">{trafo["Phasa"]}</span></span>)}
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-3 flex-wrap mt-1">
                                                                                                        {trafo["Serial Id"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">S/N</span>{" "}<span className="text-foreground/70 font-mono text-[9px]">{trafo["Serial Id"]}</span></span>)}
                                                                                                        {trafo["Tahun Operasi"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">Operasi</span>{" "}<span className="text-foreground/70">{trafo["Tahun Operasi"]}</span></span>)}
                                                                                                        {trafo["Status Usia"] && (
                                                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${trafo["Status Usia"]?.toLowerCase().includes("muda") || trafo["Status Usia"]?.toLowerCase().includes("normal") ? "bg-emerald-500/15 text-emerald-400" : trafo["Status Usia"]?.toLowerCase().includes("tua") ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>
                                                                                                                {trafo["Status Usia"]}
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </motion.div>
                                                                                    )}

                                                                                    {/* ── Protection (Relay) ── */}
                                                                                    {bayRelays.length > 0 && (
                                                                                        <motion.div
                                                                                            initial={{ opacity: 0, x: -8 }}
                                                                                            animate={{ opacity: 1, x: 0 }}
                                                                                            transition={{ duration: 0.25, delay: 0.05 }}
                                                                                            className="rounded-lg p-2.5 space-y-2"
                                                                                            style={{ background: `${tColor}06`, border: `1px solid ${tColor}18` }}
                                                                                        >
                                                                                            <div className="flex items-center gap-2 pb-1.5 border-b" style={{ borderColor: `${tColor}15` }}>
                                                                                                <div className="p-1 rounded" style={{ background: `${tColor}15` }}>
                                                                                                    <Shield className="h-3 w-3" style={{ color: tColor }} />
                                                                                                </div>
                                                                                                <span className="text-[11px] font-semibold tracking-wide" style={{ color: tColor }}>Protection</span>
                                                                                                <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${tColor}12`, color: tColor }}>{bayRelays.length} relay</span>
                                                                                            </div>
                                                                                            {(() => {
                                                                                                const groups: Record<string, typeof bayRelays> = {};
                                                                                                bayRelays.forEach(r => { const k = r["Protection"] || "Lain"; (groups[k] = groups[k] || []).push(r); });
                                                                                                return Object.entries(groups).map(([protName, rList], gi) => (
                                                                                                    <motion.div key={protName} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05, duration: 0.2 }} className="space-y-0.5">
                                                                                                        <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider">{protName}</p>
                                                                                                        {rList.map((relay, ri) => (
                                                                                                            <div key={ri} className="pl-2.5 flex flex-col gap-0.5 py-1" style={{ borderLeft: `2px solid ${tColor}20` }}>
                                                                                                                <p className="text-[10px] text-foreground/80 font-medium">{relay["Fungsi Proteksi"] || "\u2014"}</p>
                                                                                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                                                                                    {relay["Merk"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">Merk</span>{" "}<span className="text-foreground/70">{relay["Merk"]}</span></span>)}
                                                                                                                    {relay["Type"] && (<span className="text-[10px]"><span className="text-muted-foreground/40 font-medium">Type</span>{" "}<span className="text-foreground/70">{relay["Type"]}</span></span>)}
                                                                                                                    {relay["Jenis Relay"] && (<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground/70 font-medium">{relay["Jenis Relay"]}</span>)}
                                                                                                                    {relay["Status"] && (
                                                                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${relay["Status"]?.toLowerCase().includes("operasi") ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                                                                                                                            {relay["Status"]}
                                                                                                                        </span>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </motion.div>
                                                                                                ));
                                                                                            })()}
                                                                                        </motion.div>
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
                            </AnimatePresence >
                        </div >
                    </motion.div >
                );
            })() : (
                <>
                    <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        < span className="text-sm font-semibold" > Gardu Induk</span >
                        <Badge variant="secondary" className="ml-auto text-[9px] tabular-nums">{filteredGIs.length}</Badge>
                    </div >
                    {(activeULTG || activeGIType || activeVoltage) && (
                        <div className="flex items-center gap-1 px-3 pb-1">
                            <Filter className="h-2.5 w-2.5 text-primary" />
                            <span className="text-[8px] text-primary">Filtered</span>
                            <button onClick={() => { setActiveULTG(null); setActiveGIType(null); setActiveVoltage(null); }} className="text-[8px] text-muted-foreground hover:text-foreground ml-auto">Reset</button>
                        </div>
                    )}
                    <div className="p-1.5 flex-1 overflow-y-auto">
                        <style>{`
                @keyframes giSlideIn { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes giFadeIn { from { opacity: 0; } to { opacity: 1; } }
                .gi-animate { animation: giSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
                .gi-fade { animation: giFadeIn 0.3s ease both; }
                .gi-btn { transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
                .gi-btn:hover { transform: translateX(4px); background-color: rgba(255,255,255,0.04); }
                .gi-btn:active { transform: scale(0.97) translateX(2px); }
              `}</style>
                        <div style={{ columns: 2, columnGap: '6px' }}>
                            {(() => {
                                const voltageColorMap: Record<string, string> = { '70': C.amber, '150': C.indigo, '500': C.rose, '275': C.teal };
                                const giTypeColorMap: Record<string, string> = { GI: C.indigo, GIS: C.teal, GITET: C.amber };
                                const sorted = [...filteredGIs].sort((a, b) => Number(b["Voltage (kV)"] || 0) - Number(a["Voltage (kV)"] || 0));
                                let lastVoltage = '';
                                return sorted.flatMap((gi, idx) => {
                                    const giName = gi["Master Gardu Induk"];
                                    const giType = gi["GI Type"] || "GI";
                                    const giColor = giTypeColorMap[giType] || C.purple;
                                    const voltage = gi["Voltage (kV)"] || "N/A";
                                    const vColor = voltageColorMap[voltage] || C.purple;
                                    const bayCount = bays.filter((b) => (b as unknown as Record<string, string>)[BAY_GI_COL] === giName).length;
                                    const isSelected = expandedGI === giName;
                                    const items: React.ReactNode[] = [];
                                    if (voltage !== lastVoltage) {
                                        items.push(
                                            <div key={`sep-${voltage}`} className="flex items-center gap-2 py-0.5 px-1" style={{ breakInside: 'avoid' }}>
                                                <span className="text-[9px] font-semibold shrink-0" style={{ color: vColor }}>{voltage} kV</span>
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
                                            style={{ animationDelay: `${idx * 25}ms`, backgroundColor: isSelected ? `${giColor}20` : `${giColor}08`, breakInside: 'avoid' }}
                                        >
                                            <div className="h-2 w-2 rounded-full shrink-0 transition-all group-hover:scale-125" style={{ backgroundColor: isSelected ? giColor : `${giColor}40`, boxShadow: isSelected ? `0 0 6px ${giColor}60` : 'none' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[10px] font-semibold truncate transition-colors ${isSelected ? 'text-primary' : 'text-foreground/80 group-hover:text-foreground'}`}>
                                                    {giName}
                                                </p>
                                                <p className="text-[8px] text-muted-foreground/70 truncate">{gi["Master ULTG"]} · {voltage} kV</p>
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
        </div >
    );
}
