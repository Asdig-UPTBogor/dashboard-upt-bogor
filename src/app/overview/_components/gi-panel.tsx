"use client";

import { ChevronRight, Building2, Filter, Activity, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { GI, Bay, Relay } from "./types";
import { C } from "./types";

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
    filteredGIs, filteredBays, bays, relays, bayTypeColorMap,
    activeULTG, setActiveULTG, activeGIType, setActiveGIType,
    activeVoltage, setActiveVoltage, detailBayTypeFilter, detailProteksiFilter,
}: GiPanelProps) {
    return (
        <div style={{ flex: '2 1 0%', minWidth: 0 }} className="flex flex-col h-full">
            {expandedGI ? (() => {
                const selGI = filteredGIs.find((g) => g["Master Gardu Induk"] === expandedGI);
                const selBays = filteredBays.filter((b) => b["Master Gardu Induk"] === expandedGI);
                const selRelays = relays.filter((r) => r["Gardu Induk"] === expandedGI);

                // When proteksi filter is active, find bay types that have relays with that proteksi
                const allowedBayTypes = detailProteksiFilter
                    ? new Set(selRelays.filter(r => (r["Fungsi Proteksi"] || "Blm Update") === detailProteksiFilter).map(r => r["Type Bay"] || "Lain"))
                    : null;

                const allGroups = selBays.reduce((acc, b) => { const t = b["Type Bay"] || "Lain"; (acc[t] = acc[t] || []).push(b["Bay/Diameter"]); return acc; }, {} as Record<string, string[]>);
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
                                onClick={() => { setExpandedGI(null); setExpandedTypes(new Set()); }}
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
                                                layout
                                                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                                animate={{
                                                    opacity: isMatch ? 1 : DIM,
                                                    y: 0,
                                                    scale: 1,
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
                                                    <motion.span
                                                        className="font-bold flex-1"
                                                        animate={{ fontSize: isHighlighted ? 16 : 12 }}
                                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                        style={{ color: tColor }}
                                                    >{type}</motion.span>
                                                    <motion.span
                                                        className="font-bold tabular-nums"
                                                        animate={{ fontSize: isHighlighted ? 16 : 12 }}
                                                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                        style={{ color: tColor }}
                                                    >{names.length}</motion.span>
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
                                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                                    {names.map((n, ni) => (
                                                        <motion.p
                                                            key={n}
                                                            className="truncate"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1, color: isHighlighted ? `${tColor}cc` : undefined }}
                                                            transition={{ delay: i * 0.04 + ni * 0.02, duration: 0.3 }}
                                                            style={{ fontSize: isHighlighted ? 12 : 11 }}
                                                        >{n}</motion.p>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                            </AnimatePresence>
                        </div>
                    </motion.div>
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
                @keyframes giSlideIn { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes giFadeIn { from { opacity: 0; } to { opacity: 1; } }
                .gi-animate { animation: giSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
                .gi-fade { animation: giFadeIn 0.3s ease both; }
                .gi-btn { transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
                .gi-btn:hover { transform: translateX(4px); background-color: rgba(255,255,255,0.04); }
                .gi-btn:active { transform: scale(0.97) translateX(2px); }
              `}</style>
                        <div className="grid grid-cols-2 gap-1.5">
                            {(() => {
                                const voltageColorMap: Record<string, string> = { '70': C.amber, '150': C.indigo, '500': C.rose, '275': C.teal };
                                const giTypeColorMap: Record<string, string> = { GI: C.indigo, GIS: C.teal, GITET: C.amber };
                                const sorted = [...filteredGIs].sort((a, b) => Number(b["Voltage (kV)"] || 0) - Number(a["Voltage (kV)"] || 0));
                                return sorted.map((gi, idx) => {
                                    const giName = gi["Master Gardu Induk"];
                                    const giType = gi["GI Type"] || "GI";
                                    const giColor = giTypeColorMap[giType] || C.purple;
                                    const voltage = gi["Voltage (kV)"] || "N/A";
                                    const tColor = voltageColorMap[voltage] || C.purple;
                                    const bayCount = bays.filter((b) => b["Master Gardu Induk"] === giName).length;
                                    const isSelected = expandedGI === giName;
                                    return (
                                        <button
                                            key={giName}
                                            onClick={() => { setExpandedGI(isSelected ? null : giName); setExpandedTypes(new Set()); }}
                                            className={`gi-animate gi-btn text-left px-2 py-1.5 rounded-md border flex items-center gap-2 group ${isSelected
                                                ? 'border-primary/40'
                                                : 'border-transparent hover:border-border/50'
                                                }`}
                                            style={{ animationDelay: `${idx * 25}ms`, backgroundColor: isSelected ? `${giColor}20` : `${giColor}08` }}
                                        >
                                            <div className="h-2 w-2 rounded-full shrink-0 transition-all group-hover:scale-125" style={{ backgroundColor: isSelected ? giColor : `${giColor}40`, boxShadow: isSelected ? `0 0 6px ${giColor}60` : 'none' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[10px] font-semibold truncate transition-colors ${isSelected ? 'text-primary' : 'text-foreground/80 group-hover:text-foreground'}`}>
                                                    {giName}
                                                </p>
                                                <p className="text-[8px] text-muted-foreground/70 truncate">{gi["Master ULTG"]} · {voltage} kV</p>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="text-[10px] font-bold tabular-nums" style={{ color: isSelected ? tColor : undefined }}>{bayCount}</span>
                                                <span className="text-[7px] text-muted-foreground/50">bay</span>
                                            </div>
                                            <ChevronRight className={`h-3 w-3 shrink-0 transition-all ${isSelected ? 'text-primary opacity-100' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'}`} />
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
