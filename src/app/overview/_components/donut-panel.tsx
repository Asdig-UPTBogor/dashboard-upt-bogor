"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import type { GI, Bay, Relay } from "./types";
import { C } from "./types";
import { getGIColumn, SHEETS } from "./relation-utils";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface DonutPanelProps {
    expandedGI: string | null;
    filteredGIs: GI[];
    filteredBays: Bay[];
    relays: Relay[];
    bayTypeColorMap: Record<string, string>;
    theme: ReturnType<typeof import("@/components/page-builder/widgets/use-chart-theme").useChartTheme>;
    ultgOption: object;
    giTypeOption: object;
    voltageOption: object;
    onULTGClick: (params: { name?: string }) => void;
    onGITypeClick: (params: { name?: string }) => void;
    onVoltageClick: (params: { name?: string }) => void;
    activeBayType: string | null;
    activeRelayJenis: string | null;
    onBayTypeFilter: (name: string | null) => void;
    onRelayJenisFilter: (name: string | null) => void;
}

const RELAY_COLORS = [C.indigo, C.teal, C.amber, C.rose, C.purple, C.emerald, C.pink, C.blue, C.cyan, C.orange];

export function DonutPanel({
    expandedGI, filteredGIs, filteredBays, relays, bayTypeColorMap, theme,
    ultgOption, giTypeOption, voltageOption,
    onULTGClick, onGITypeClick, onVoltageClick,
    activeBayType, activeRelayJenis, onBayTypeFilter, onRelayJenisFilter,
}: DonutPanelProps) {
    const onBayClick = (params: { name?: string }) => {
        onBayTypeFilter(activeBayType === params.name ? null : params.name || null);
    };
    const onRelayClick = (params: { name?: string }) => {
        onRelayJenisFilter(activeRelayJenis === params.name ? null : params.name || null);
    };

    const detail = useMemo(() => {
        if (!expandedGI) return null;
        const selGI = filteredGIs.find(g => g["Master Gardu Induk"] === expandedGI);
        const selBays = filteredBays.filter(b => (b as unknown as Record<string, string>)[getGIColumn(SHEETS.BAY)] === expandedGI);
        const selRelays = relays.filter(r => (r as unknown as Record<string, string>)[getGIColumn(SHEETS.RELAY)] === expandedGI);

        const gType = selGI?.["Type Gardu Induk"] || "GI";
        const gAccent = ({ GI: C.indigo, GIS: C.teal, GITET: C.amber } as Record<string, string>)[gType] || C.indigo;

        return { selBays, selRelays, gAccent };
    }, [expandedGI, filteredGIs, filteredBays, relays]);

    // --- Bay Type Donut (filtered by activeRelayJenis / proteksi) ---
    const bayOption = useMemo(() => {
        if (!detail) return null;
        const { selBays, selRelays, gAccent } = detail;

        // When a proteksi is selected, only count bays whose type matches relays with that proteksi
        let filteredBayList = selBays;
        if (activeRelayJenis) {
            const bayTypesWithProteksi = new Set(
                selRelays.filter(r => (r["Fungsi Proteksi"] || "Blm Update") === activeRelayJenis)
                    .map(r => r["Type Bay"] || "Lain")
            );
            filteredBayList = selBays.filter(b => bayTypesWithProteksi.has(b["Type Bay"] || "Lain"));
        }

        const bayGroups: Record<string, number> = {};
        filteredBayList.forEach(b => { const t = b["Type Bay"] || "Lain"; bayGroups[t] = (bayGroups[t] || 0) + 1; });

        const data = Object.entries(bayGroups)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => {
                const color = bayTypeColorMap[name] || gAccent;
                const selected = !activeBayType || activeBayType === name;
                return { name, value, itemStyle: { color, opacity: selected ? 1 : 0.3 } };
            });

        const totalBay = filteredBayList.length;
        const totalTypes = Object.keys(bayGroups).length;

        return {
            backgroundColor: 'transparent',
            textStyle: { fontFamily: 'Inter, sans-serif', color: theme.textMuted },
            tooltip: {
                trigger: 'item' as const,
                backgroundColor: theme.tooltipBg,
                borderColor: `${gAccent}30`,
                textStyle: { color: theme.tooltipText, fontSize: 11 },
                formatter: '{b}: {c} ({d}%)',
            },
            series: [{
                type: 'pie' as const,
                radius: ['38%', '72%'],
                center: ['50%', '50%'],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: true, color: theme.textMuted, fontSize: 11, formatter: '{b}', verticalAlign: 'middle' as const },
                emphasis: {
                    label: { fontSize: 13, fontWeight: 'bold' as const, color: theme.emphasisText },
                    scaleSize: 6,
                },
                data,
                animationType: 'scale' as const,
                animationEasing: 'elasticOut' as const,
            }, {
                type: 'pie' as const,
                radius: ['38%', '72%'],
                center: ['50%', '50%'],
                padAngle: 3,
                silent: true,
                label: {
                    show: true,
                    position: 'inside' as const,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 'bold' as const,
                    fontFamily: 'Inter, sans-serif',
                    formatter: '{c}',
                },
                labelLine: { show: false },
                itemStyle: { color: 'transparent', borderWidth: 0 },
                data,
            }],
            graphic: [{
                type: 'text', left: 'center', top: 'center',
                style: { text: `${totalBay}`, fill: theme.emphasisText, fontSize: 22, fontWeight: 'bold', fontFamily: 'Inter, sans-serif', textAlign: 'center' },
            }, {
                type: 'text', left: 'center', top: '58%',
                style: { text: `${totalTypes} Tipe`, fill: theme.textMuted, fontSize: 9, fontFamily: 'Inter, sans-serif', textAlign: 'center' },
            }],
            animationType: 'scale' as const,
            animationDuration: 800,
            animationUpdateDuration: 400,
            animationUpdateEasing: 'cubicInOut' as const,
        };
    }, [detail, activeBayType, activeRelayJenis, bayTypeColorMap, theme]);

    // --- Fungsi Proteksi Donut (filtered by activeBayType) ---
    const relayOption = useMemo(() => {
        if (!detail) return null;
        const { selRelays } = detail;

        // When a bay type is selected, only count relays from that bay type
        let filteredRelayList = selRelays;
        if (activeBayType) {
            filteredRelayList = selRelays.filter(r => (r["Type Bay"] || "Lain") === activeBayType);
        }

        const proteksiGroups: Record<string, number> = {};
        filteredRelayList.forEach(r => { const fp = r["Fungsi Proteksi"] || "Blm Update"; proteksiGroups[fp] = (proteksiGroups[fp] || 0) + 1; });

        const sorted = Object.entries(proteksiGroups).sort(([, a], [, b]) => b - a);
        const data = sorted.map(([name, value], i) => {
            const selected = !activeRelayJenis || activeRelayJenis === name;
            return { name, value, itemStyle: { color: RELAY_COLORS[i % RELAY_COLORS.length], opacity: selected ? 1 : 0.3 } };
        });

        const totalRelay = filteredRelayList.length;
        const totalJenis = Object.keys(proteksiGroups).length;

        return {
            backgroundColor: 'transparent',
            textStyle: { fontFamily: 'Inter, sans-serif', color: theme.textMuted },
            tooltip: {
                trigger: 'item' as const,
                backgroundColor: theme.tooltipBg,
                borderColor: `${C.purple}30`,
                textStyle: { color: theme.tooltipText, fontSize: 11 },
                formatter: '{b}: {c} ({d}%)',
            },
            series: [{
                type: 'pie' as const,
                radius: ['38%', '72%'],
                center: ['50%', '50%'],
                padAngle: 3,
                itemStyle: { borderRadius: 6 },
                label: { show: true, color: theme.textMuted, fontSize: 11, formatter: '{b}', verticalAlign: 'middle' as const },
                emphasis: {
                    label: { fontSize: 13, fontWeight: 'bold' as const, color: theme.emphasisText },
                    scaleSize: 6,
                },
                data,
                animationType: 'scale' as const,
                animationEasing: 'elasticOut' as const,
            }, {
                type: 'pie' as const,
                radius: ['38%', '72%'],
                center: ['50%', '50%'],
                padAngle: 3,
                silent: true,
                label: {
                    show: true,
                    position: 'inside' as const,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 'bold' as const,
                    fontFamily: 'Inter, sans-serif',
                    formatter: '{c}',
                },
                labelLine: { show: false },
                itemStyle: { color: 'transparent', borderWidth: 0 },
                data,
            }],
            graphic: [{
                type: 'text', left: 'center', top: 'center',
                style: { text: `${totalRelay}`, fill: theme.emphasisText, fontSize: 22, fontWeight: 'bold', fontFamily: 'Inter, sans-serif', textAlign: 'center' },
            }, {
                type: 'text', left: 'center', top: '58%',
                style: { text: `${totalJenis} Fungsi`, fill: theme.textMuted, fontSize: 9, fontFamily: 'Inter, sans-serif', textAlign: 'center' },
            }],
            animationType: 'scale' as const,
            animationDuration: 800,
            animationUpdateDuration: 400,
            animationUpdateEasing: 'cubicInOut' as const,
        };
    }, [detail, activeBayType, activeRelayJenis, theme]);

    const hasFilter = activeBayType || activeRelayJenis;

    // Active filter color
    const bayFilterColor = activeBayType ? (bayTypeColorMap[activeBayType] || detail?.gAccent || C.indigo) : null;

    return (
        <div style={{ flex: '1.5 1 0%', minWidth: 0 }} className="h-full overflow-y-auto">
            {/* Detail view — visible when GI is expanded */}
            <div className={expandedGI && detail ? '' : 'hidden'}>
                {detail && (
                    <>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                            <p className="text-base font-bold truncate" style={{ color: detail.gAccent }}>{expandedGI}</p>
                            <AnimatePresence>
                                {hasFilter && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.85, x: 10 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.85, x: 10 }}
                                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                        onClick={() => { onBayTypeFilter(null); onRelayJenisFilter(null); }}
                                        className="ml-auto text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-full px-2 py-0.5 transition-colors shrink-0 flex items-center gap-1"
                                    >
                                        <X className="h-2.5 w-2.5" /> Reset
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="flex flex-col flex-1 min-h-0">
                            {/* Bay Type Donut */}
                            <motion.div
                                className="flex flex-col items-center relative"
                                animate={{
                                    borderColor: activeRelayJenis ? `${C.purple}25` : 'transparent',
                                }}
                                transition={{ duration: 0.4 }}
                                style={{
                                    borderWidth: 1,
                                    borderStyle: 'solid',
                                    borderRadius: 12,
                                    margin: '0 8px',
                                }}
                            >
                                {/* Title + active filter pill */}
                                <div className="flex items-center justify-center gap-1.5 pt-1">
                                    <p className="text-xs text-center text-muted-foreground font-semibold">Tipe Bay</p>
                                    <AnimatePresence>
                                        {activeBayType && (
                                            <motion.span
                                                initial={{ opacity: 0, scale: 0.7, width: 0 }}
                                                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                                                exit={{ opacity: 0, scale: 0.7, width: 0 }}
                                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                className="text-xs font-bold rounded-full px-2 py-0.5 overflow-hidden whitespace-nowrap cursor-pointer"
                                                style={{
                                                    backgroundColor: `${bayFilterColor}20`,
                                                    color: bayFilterColor || undefined,
                                                    border: `1px solid ${bayFilterColor}40`,
                                                }}
                                                onClick={() => onBayTypeFilter(null)}
                                            >
                                                {activeBayType} ×
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                                {bayOption && (
                                    <ReactECharts notMerge option={bayOption} style={{ height: 270, width: '100%' }} onEvents={{ click: onBayClick }} />
                                )}
                            </motion.div>

                            {/* Cross-filter connector arrow */}
                            <AnimatePresence>
                                {hasFilter && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 20 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex items-center justify-center overflow-hidden"
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" style={{ color: activeBayType ? bayFilterColor || undefined : C.purple }} />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Fungsi Proteksi Donut */}
                            {detail.selRelays.length > 0 && (
                                <motion.div
                                    className="flex flex-col items-center relative"
                                    animate={{
                                        borderColor: activeBayType ? `${bayFilterColor}25` : 'transparent',
                                    }}
                                    transition={{ duration: 0.4 }}
                                    style={{
                                        borderWidth: 1,
                                        borderStyle: 'solid',
                                        borderRadius: 12,
                                        margin: '0 8px',
                                    }}
                                >
                                    {/* Title + active filter pill */}
                                    <div className="flex items-center justify-center gap-1.5 pt-1">
                                        <p className="text-xs text-center text-muted-foreground font-semibold">Fungsi Proteksi</p>
                                        <AnimatePresence>
                                            {activeRelayJenis && (
                                                <motion.span
                                                    initial={{ opacity: 0, scale: 0.7, width: 0 }}
                                                    animate={{ opacity: 1, scale: 1, width: 'auto' }}
                                                    exit={{ opacity: 0, scale: 0.7, width: 0 }}
                                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                    className="text-xs font-bold rounded-full px-2 py-0.5 overflow-hidden whitespace-nowrap cursor-pointer"
                                                    style={{
                                                        backgroundColor: `${C.purple}20`,
                                                        color: C.purple,
                                                        border: `1px solid ${C.purple}40`,
                                                    }}
                                                    onClick={() => onRelayJenisFilter(null)}
                                                >
                                                    {activeRelayJenis} ×
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    {relayOption && (
                                        <ReactECharts notMerge option={relayOption} style={{ height: 270, width: '100%' }} onEvents={{ click: onRelayClick }} />
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Overview charts — visible when no GI is expanded */}
            <div className={expandedGI ? 'hidden' : ''}>
                <ReactECharts option={ultgOption} style={{ height: 400 }} onEvents={{ click: onULTGClick }} />
                <div className="grid grid-cols-2 gap-0">
                    <div><ReactECharts option={giTypeOption} style={{ height: 200 }} onEvents={{ click: onGITypeClick }} /></div>
                    <div><ReactECharts option={voltageOption} style={{ height: 200 }} onEvents={{ click: onVoltageClick }} /></div>
                </div>
            </div>
        </div>
    );
}
