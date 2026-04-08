"use client";

import { useState, useMemo, useCallback } from "react";
import { usePageData } from "@/hooks/usePageData";
import { useChartTheme } from "@/components/page-builder/widgets/use-chart-theme";
import type { GI, Bay, Relay, MtuEquipment, EquipmentCounts } from "./types";
import { C, EQUIPMENT_TYPES, EMPTY_EQUIPMENT_COUNTS } from "./types";
import { filterBySet, getGIColumn, buildHierarchyIndex, SHEETS } from "./relation-utils";

type Row = Record<string, string>;

export function useOverviewData() {
    const theme = useChartTheme();
    const allSheetNames = useMemo(
        () => [
            SHEETS.GI, SHEETS.BAY, SHEETS.RELAY,
            SHEETS.TRAFO, SHEETS.PMT, SHEETS.PMS,
            SHEETS.CT, SHEETS.CVT, SHEETS.LA,
            SHEETS.KABEL_POWER, SHEETS.SEALING_END,
        ],
        []
    );

    const { sheets: allSheets, loading } = usePageData("/overview", {
        sheets: allSheetNames,
    });

    // Build hierarchy index from API response (Firestore hierarchyMapping)
    // MUST be useMemo (not useEffect) — runs synchronously during render,
    // before downstream useMemo computations that depend on the hierarchy index.
    useMemo(() => {
        if (allSheets.length > 0) {
            buildHierarchyIndex(allSheets);
        }
    }, [allSheets]);
    const [activeULTG, setActiveULTG] = useState<string | null>(null);
    const [activeGIType, setActiveGIType] = useState<string | null>(null);
    const [activeBayType, setActiveBayType] = useState<string | null>(null);
    const [activeVoltage, setActiveVoltage] = useState<string | null>(null);
    const [expandedGI, setExpandedGI] = useState<string | null>(null);
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
    const [activeVoltageTab, setActiveVoltageTab] = useState<string | null>(null);

    const getRows = useCallback(
        <T>(sheetList: ReturnType<typeof usePageData>["sheets"], sheetName: string) =>
            ((sheetList.find((sheet) => sheet.sheetName === sheetName)?.rows || []) as unknown as T[]),
        []
    );

    const gis = useMemo(() => getRows<GI>(allSheets, SHEETS.GI), [allSheets, getRows]);
    const bays = useMemo(() => getRows<Bay>(allSheets, SHEETS.BAY), [allSheets, getRows]);
    const relays = useMemo(() => getRows<Relay>(allSheets, SHEETS.RELAY), [allSheets, getRows]);

    const trafos = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.TRAFO), [allSheets, getRows]);
    const pmts = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.PMT), [allSheets, getRows]);
    const pmsList = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.PMS), [allSheets, getRows]);
    const cts = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.CT), [allSheets, getRows]);
    const cvts = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.CVT), [allSheets, getRows]);
    const las = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.LA), [allSheets, getRows]);
    const kabelPowers = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.KABEL_POWER), [allSheets, getRows]);
    const sealingEnds = useMemo(() => getRows<MtuEquipment>(allSheets, SHEETS.SEALING_END), [allSheets, getRows]);

    /** All MTU data in a single object keyed by equipment type */
    const mtuData = useMemo(() => ({
        trafo: trafos,
        pmt: pmts,
        pms: pmsList,
        ct: cts,
        cvt: cvts,
        la: las,
        kabelPower: kabelPowers,
        sealingEnd: sealingEnds,
    }), [trafos, pmts, pmsList, cts, cvts, las, kabelPowers, sealingEnds]);

    /** Sheet name lookup per equipment key */
    const mtuSheetNames: Record<string, string> = useMemo(() => ({
        trafo: SHEETS.TRAFO,
        pmt: SHEETS.PMT,
        pms: SHEETS.PMS,
        ct: SHEETS.CT,
        cvt: SHEETS.CVT,
        la: SHEETS.LA,
        kabelPower: SHEETS.KABEL_POWER,
        sealingEnd: SHEETS.SEALING_END,
    }), []);



    // === FILTERED DATA ===
    const filteredGIs = useMemo(() => {
        let result = gis;
        if (activeULTG) result = result.filter((g) => g["Master ULTG"] === activeULTG);
        if (activeGIType) result = result.filter((g) => g["Type Gardu Induk"] === activeGIType);
        if (activeVoltage) result = result.filter((g) => g["Tegangan (kV)"] === activeVoltage);
        if (activeBayType) {
            const bayGICol = getGIColumn(SHEETS.BAY);
            const gisWithBayType = new Set(
                bays.filter((b) => b["Type Bay"] === activeBayType).map((b) => (b as unknown as Row)[bayGICol])
            );
            result = result.filter((g) => gisWithBayType.has(g["Master Gardu Induk"]));
        }
        return result;
    }, [gis, bays, activeULTG, activeGIType, activeVoltage, activeBayType]);

    const baysMatchingGIs = useMemo(() => {
        const giNames = new Set(filteredGIs.map((g) => g["Master Gardu Induk"]));
        return filterBySet(SHEETS.BAY, bays as unknown as Row[], "gi", giNames) as unknown as Bay[];
    }, [bays, filteredGIs]);

    const filteredBays = useMemo(() => {
        if (!activeBayType) return baysMatchingGIs;
        return baysMatchingGIs.filter((b) => b["Type Bay"] === activeBayType);
    }, [baysMatchingGIs, activeBayType]);

    // === EQUIPMENT COUNTS ===
    const globalEquipmentCounts = useMemo<EquipmentCounts>(() => {

        const giNames = new Set(filteredGIs.map((g) => g["Master Gardu Induk"]));
        const countForSheet = (sheetName: string, rows: Row[]) =>
            filterBySet(sheetName, rows, "gi", giNames).length;

        const counts: EquipmentCounts = { ...EMPTY_EQUIPMENT_COUNTS };
        for (const eq of EQUIPMENT_TYPES) {
            const sheetName = mtuSheetNames[eq.key];
            const rows = mtuData[eq.key as keyof typeof mtuData] as unknown as Row[];
            if (sheetName && rows) {
                const c = countForSheet(sheetName, rows);
                (counts as unknown as Record<string, number>)[eq.key] = c;
                counts.total += c;
            }
        }
        return counts;
    }, [filteredGIs, mtuData, mtuSheetNames]);

    const equipmentCountsPerGI = useMemo(() => {

        const map: Record<string, EquipmentCounts> = {};

        for (const eq of EQUIPMENT_TYPES) {
            const sheetName = mtuSheetNames[eq.key];
            const rows = mtuData[eq.key as keyof typeof mtuData] as unknown as Row[];
            if (!sheetName || !rows) continue;
            const giCol = getGIColumn(sheetName);
            rows.forEach((item) => {
                const gi = item[giCol];
                if (!gi) return;
                if (!map[gi]) map[gi] = { ...EMPTY_EQUIPMENT_COUNTS };
                (map[gi] as unknown as Record<string, number>)[eq.key]++;
                map[gi].total++;
            });
        }
        return map;
    }, [mtuData, mtuSheetNames]);

    // === DERIVED ===
    const ultgNames = useMemo(() => [...new Set(gis.map((g) => g["Master ULTG"]))], [gis]);
    const totalGI = filteredGIs.length;
    const totalBay = filteredBays.length;
    const totalGITypes = useMemo(() => new Set(filteredGIs.map((g) => g["Type Gardu Induk"]).filter(Boolean)).size, [filteredGIs]);
    const totalVoltages = useMemo(() => new Set(filteredGIs.map((g) => g["Tegangan (kV)"]).filter(Boolean)).size, [filteredGIs]);
    const totalRelays = useMemo(() => {
        const giNames = new Set(filteredGIs.map((g) => g["Master Gardu Induk"]));
        return filterBySet(SHEETS.RELAY, relays as unknown as Row[], "gi", giNames).length;
    }, [filteredGIs, relays]);

    // Donut distributions
    const ultgDistribution = useMemo(() => {
        let source = gis;
        if (activeGIType) source = source.filter((g) => g["Type Gardu Induk"] === activeGIType);
        if (activeVoltage) source = source.filter((g) => g["Tegangan (kV)"] === activeVoltage);
        const counts: Record<string, number> = {};
        source.forEach((g) => { const u = g["Master ULTG"] || "N/A"; counts[u] = (counts[u] || 0) + 1; });
        return Object.entries(counts);
    }, [gis, activeGIType, activeVoltage]);

    const giTypeDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredGIs.forEach((g) => { const t = g["Type Gardu Induk"] || "N/A"; counts[t] = (counts[t] || 0) + 1; });
        return Object.entries(counts);
    }, [filteredGIs]);

    const shortGI = (name: string) => name.replace(/^(GI[SET]*\s+\d+KV\s+)/i, "");

    const giDistribution = useMemo(() => {
        return filteredGIs.map((gi) => {
            const giName = gi["Master Gardu Induk"];
            const bayCount = filteredBays.filter((b) => (b as unknown as Row)[getGIColumn(SHEETS.BAY)] === giName).length;
            return [shortGI(giName), bayCount, giName, gi["Tegangan (kV)"] || "N/A"] as [string, number, string, string];
        }).sort((a, b) => (b[1] as number) - (a[1] as number));
    }, [filteredGIs, filteredBays]);

    const voltageDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredGIs.forEach((g) => { const v = g["Tegangan (kV)"] || "N/A"; counts[v] = (counts[v] || 0) + 1; });
        return Object.entries(counts);
    }, [filteredGIs]);

    // Bay types per GI (for stacked bar)
    const bayTypesPerGI = useMemo(() => {
        const types = new Set<string>();
        const giMap: Record<string, Record<string, number>> = {};
        filteredBays.forEach((b) => {
            const gi = (b as unknown as Row)[getGIColumn(SHEETS.BAY)];
            const t = b["Type Bay"] || "Lainnya";
            types.add(t);
            if (!giMap[gi]) giMap[gi] = {};
            giMap[gi][t] = (giMap[gi][t] || 0) + 1;
        });
        const sortedGIs = Object.entries(giMap)
            .map(([name, typeCounts]) => ({ name, typeCounts, total: Object.values(typeCounts).reduce((s, v) => s + v, 0) }))
            .sort((a, b) => a.total - b.total);
        return { types: [...types].sort(), sortedGIs };
    }, [filteredBays]);

    const bayTypeColorMap: Record<string, string> = useMemo(() => {
        const palette = [C.indigo, C.teal, C.amber, C.rose, C.blue, C.purple, C.cyan, C.orange, C.pink, C.emerald];
        const map: Record<string, string> = {};
        bayTypesPerGI.types.forEach((t, i) => { map[t] = palette[i % palette.length]; });
        return map;
    }, [bayTypesPerGI.types]);

    // Equipment Heatmap Data (per GI)
    const equipmentHeatmapData = useMemo(() => {

        const giNames = filteredGIs.map((g) => g["Master Gardu Induk"]);
        return giNames.map((giName) => ({
            name: shortGI(giName),
            fullName: giName,
            counts: equipmentCountsPerGI[giName] || { ...EMPTY_EQUIPMENT_COUNTS },
        })).sort((a, b) => b.counts.total - a.counts.total);
    }, [filteredGIs, equipmentCountsPerGI]);

    // === Equipment Stacked Bar Option ===
    const equipmentBarOption = useMemo(() => {
        const sorted = [...equipmentHeatmapData].reverse();
        const yData = sorted.map((d) => d.name);
        const eqTypes = EQUIPMENT_TYPES;
        const series = eqTypes.map((eq) => ({
            name: eq.label,
            type: "bar" as const,
            stack: "equip",
            barMaxWidth: 18,
            itemStyle: { color: eq.color, borderRadius: 2 },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
            label: {
                show: true, fontSize: 8, fontFamily: "Inter, sans-serif", color: "#fff",
                formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : "",
            },
            data: sorted.map((d) => d.counts[eq.key] || 0),
        }));
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const, axisPointer: { type: "shadow" as const },
                backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 11 },
                formatter: (params: { seriesName: string; value: number; color: string; dataIndex: number }[]) => {
                    const giName = sorted[params[0]?.dataIndex ?? 0]?.fullName || "";
                    let html = `<div style="font-weight:bold;margin-bottom:4px">${giName}</div>`;
                    let total = 0;
                    params.forEach((p) => {
                        if (p.value > 0) {
                            html += `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color}"></span>${p.seriesName}: <b>${p.value}</b></div>`;
                            total += p.value;
                        }
                    });
                    html += `<div style="margin-top:4px;border-top:1px solid rgba(128,128,128,0.2);padding-top:4px;font-weight:bold">Total: ${total}</div>`;
                    return html;
                },
            },
            legend: {
                data: eqTypes.map((e) => e.label), bottom: 0,
                textStyle: { color: theme.textMuted, fontSize: 11, fontFamily: "Inter, sans-serif" },
                itemWidth: 12, itemHeight: 8, itemGap: 10,
            },
            grid: { left: 140, right: 20, top: 10, bottom: 40 },
            xAxis: {
                type: "value" as const,
                axisLabel: { color: theme.textMuted, fontSize: 11 },
                splitLine: { lineStyle: { color: "rgba(128,128,128,0.12)" } },
            },
            yAxis: {
                type: "category" as const,
                data: yData,
                axisLabel: { color: theme.textMuted, fontSize: 11, fontFamily: "Inter, sans-serif" },
                axisLine: { show: false }, axisTick: { show: false },
            },
            series,
            animationDuration: 800,
        };
    }, [equipmentHeatmapData, theme]);

    // === CHART OPTIONS ===
    const ultgColors = [C.indigo, C.teal, C.amber, C.rose, C.purple];
    const ultgData = useMemo(() => ultgDistribution.map(([name, value], i) => ({
        name, value,
        itemStyle: { color: ultgColors[i % ultgColors.length], opacity: activeULTG && activeULTG !== name ? 0.3 : 1 },
    })), [ultgDistribution, activeULTG]);

    const ultgOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: { trigger: "item" as const, backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText }, formatter: "{b}: {c} GI ({d}%)" },
        series: [{
            type: "pie" as const, radius: ["40%", "75%"], center: ["50%", "50%"],
            padAngle: 3, itemStyle: { borderRadius: 6 },
            label: { show: true, color: theme.textMuted, fontSize: 11, formatter: "{b}", overflow: "none" as const, minMargin: 5, verticalAlign: "middle" as const },
            emphasis: { label: { fontSize: 14, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 6 },
            data: ultgData,
        }, {
            type: "pie" as const, radius: ["40%", "75%"], center: ["50%", "50%"],
            padAngle: 3, silent: true,
            label: { show: true, position: "inside" as const, color: "#fff", fontSize: 13, fontWeight: "bold" as const, fontFamily: "Inter, sans-serif", formatter: "{c}" },
            labelLine: { show: false },
            itemStyle: { color: "transparent", borderWidth: 0 },
            data: ultgData,
        }],
        graphic: [{
            type: "text", left: "center", top: "center",
            style: { text: `${ultgDistribution.reduce((s, [, v]) => s + v, 0)}`, fill: theme.emphasisText, fontSize: 28, fontWeight: "bold", fontFamily: "Inter, sans-serif", textAlign: "center" },
        }, {
            type: "text", left: "center", top: "58%",
            style: { text: "Total GI", fill: theme.textMuted, fontSize: 11, fontFamily: "Inter, sans-serif", textAlign: "center" },
        }],
        animationType: "scale", animationDuration: 800,
    }), [ultgData, theme, ultgDistribution]);

    // GI Type Donut
    const giTypeColors = [C.amber, C.indigo, C.teal, C.pink, C.purple];
    const giTypeData = useMemo(() => giTypeDistribution.map(([name, value], i) => ({
        name, value,
        itemStyle: { color: giTypeColors[i % giTypeColors.length], opacity: activeGIType && activeGIType !== name ? 0.3 : 1 },
    })), [giTypeDistribution, activeGIType]);

    const giTypeOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: { trigger: "item" as const, backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText }, formatter: "{b}: {c} ({d}%)" },
        series: [{
            type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"],
            padAngle: 3, itemStyle: { borderRadius: 6 },
            label: { show: true, color: theme.textMuted, fontSize: 11, formatter: "{b}", verticalAlign: "middle" as const },
            emphasis: { label: { fontSize: 14, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 6 },
            data: giTypeData,
        }, {
            type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"],
            padAngle: 3, silent: true,
            label: { show: true, position: "inside" as const, color: "#fff", fontSize: 13, fontWeight: "bold" as const, fontFamily: "Inter, sans-serif", formatter: "{c}" },
            labelLine: { show: false },
            itemStyle: { color: "transparent", borderWidth: 0 },
            data: giTypeData,
        }],
        graphic: [],
        animationType: "scale", animationDuration: 800,
    }), [giTypeData, theme]);

    // Voltage Donut
    const voltageColors = [C.amber, C.teal, C.rose, C.blue, C.purple];
    const voltageData = useMemo(() => voltageDistribution.map(([name, value], i) => ({
        name, value,
        itemStyle: { color: voltageColors[i % voltageColors.length], opacity: activeVoltage && activeVoltage !== name ? 0.3 : 1 },
    })), [voltageDistribution, activeVoltage]);

    const voltageOption = useMemo(() => ({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
        tooltip: { trigger: "item" as const, backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)", textStyle: { color: theme.tooltipText }, formatter: "{b}: {c} ({d}%)" },
        series: [{
            type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"],
            padAngle: 3, itemStyle: { borderRadius: 6 },
            label: { show: true, color: theme.textMuted, fontSize: 11, formatter: "{b}", verticalAlign: "middle" as const },
            emphasis: { label: { fontSize: 14, fontWeight: "bold" as const, color: theme.emphasisText }, scaleSize: 6 },
            data: voltageData,
        }, {
            type: "pie" as const, radius: ["38%", "72%"], center: ["50%", "50%"],
            padAngle: 3, silent: true,
            label: { show: true, position: "inside" as const, color: "#fff", fontSize: 13, fontWeight: "bold" as const, fontFamily: "Inter, sans-serif", formatter: "{c}" },
            labelLine: { show: false },
            itemStyle: { color: "transparent", borderWidth: 0 },
            data: voltageData,
        }],
        graphic: [],
        animationType: "scale", animationDuration: 800,
    }), [voltageData, theme]);

    // GI Bar
    const vBarColors: Record<string, string> = { '500': '#f59e0b', '150': '#6366f1', '70': '#14b8a6' };
    const giBarData = useMemo(() => {
        const sorted = [...giDistribution].reverse();
        return {
            names: sorted.map(g => g[0] as string),
            values: sorted.map(g => g[1] as number),
            fullNames: sorted.map(g => g[2] as string),
            colors: sorted.map(g => vBarColors[g[3] as string] || C.indigo),
        };
    }, [giDistribution]);

    const giBarOption = useMemo(() => ({
        backgroundColor: "transparent",
        tooltip: {
            trigger: "axis" as const, axisPointer: { type: "shadow" as const },
            backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)",
            textStyle: { color: theme.tooltipText, fontFamily: "Inter, sans-serif", fontSize: 11 },
        },
        grid: { left: 4, right: 44, top: 4, bottom: 4, containLabel: true },
        xAxis: {
            type: "value" as const,
            axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        },
        yAxis: {
            type: "category" as const,
            data: giBarData.names,
            inverse: false,
            axisLabel: {
                color: theme.textMuted, fontSize: 11, fontFamily: "Inter, sans-serif",
                formatter: (v: string) => {
                    const idx = giBarData.names.indexOf(v);
                    const fn = giBarData.fullNames[idx];
                    return expandedGI === fn ? `{active|${v}}` : v;
                },
                rich: { active: { fontWeight: "bold" as const, color: theme.emphasisText } },
            },
            axisLine: { show: false }, axisTick: { show: false },
        },
        series: [{
            type: "bar" as const,
            data: giBarData.values.map((v, i) => ({
                value: v, name: giBarData.names[i], fullName: giBarData.fullNames[i],
                itemStyle: {
                    color: giBarData.colors[i], borderRadius: [0, 3, 3, 0],
                    opacity: expandedGI && giBarData.fullNames[i] !== expandedGI ? 0.25 : 1,
                },
            })),
            barWidth: '60%',
            label: {
                show: true, position: "right" as const,
                color: theme.textMuted, fontSize: 9, fontWeight: "bold" as const, fontFamily: "Inter, sans-serif",
                formatter: (p: { value: number }) => `${p.value}`,
            },
            emphasis: { itemStyle: { opacity: 1 }, label: { color: theme.emphasisText } },
        }],
        animationDuration: 600, animationEasing: "cubicOut" as const,
    }), [giBarData, theme, expandedGI]);

    // Stacked Bar
    const stackedBarOption = useMemo(() => {
        const { types, sortedGIs } = bayTypesPerGI;
        const yData = sortedGIs.map((gi) => shortGI(gi.name));
        const series = types.map((type) => ({
            name: type, type: "bar" as const, stack: "total", barMaxWidth: 20,
            itemStyle: { color: bayTypeColorMap[type], borderRadius: 2, opacity: activeBayType && activeBayType !== type ? 0.15 : 1 },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
            label: { show: true, fontSize: 9, fontFamily: "Inter, sans-serif", color: "#fff", formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : "" },
            data: sortedGIs.map((gi) => gi.typeCounts[type] || 0),
        }));
        return {
            backgroundColor: "transparent",
            textStyle: { fontFamily: "Inter, sans-serif", color: theme.textMuted },
            tooltip: {
                trigger: "axis" as const, axisPointer: { type: "shadow" as const },
                backgroundColor: theme.tooltipBg, borderColor: "rgba(129,140,248,0.3)",
                textStyle: { color: theme.tooltipText, fontSize: 11 },
                formatter: (params: { seriesName: string; value: number; color: string; dataIndex: number }[]) => {
                    const giName = yData[params[0]?.dataIndex ?? 0] || "";
                    let html = `<div style="font-weight:bold;margin-bottom:4px">${giName}</div>`;
                    let total = 0;
                    params.forEach((p) => {
                        if (p.value > 0) {
                            html += `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color}"></span>${p.seriesName}: <b>${p.value}</b></div>`;
                            total += p.value;
                        }
                    });
                    html += `<div style="margin-top:4px;border-top:1px solid rgba(128,128,128,0.2);padding-top:4px;font-weight:bold">Total: ${total}</div>`;
                    return html;
                },
            },
            legend: { data: types, bottom: 0, textStyle: { color: theme.textMuted, fontSize: 11, fontFamily: "Inter, sans-serif" }, itemWidth: 12, itemHeight: 8, itemGap: 12 },
            grid: { left: 140, right: 20, top: 10, bottom: 40 },
            xAxis: { type: "value" as const, axisLabel: { color: theme.textMuted, fontSize: 11 }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.12)" } } },
            yAxis: { type: "category" as const, data: yData, axisLabel: { color: theme.textMuted, fontSize: 11, fontFamily: "Inter, sans-serif" }, axisLine: { show: false }, axisTick: { show: false } },
            series,
            animationDuration: 800,
        };
    }, [bayTypesPerGI, bayTypeColorMap, theme, activeBayType]);

    // === CLICK HANDLERS ===
    const onULTGClick = useCallback((params: { name?: string }) => {
        if (params.name) setActiveULTG((prev) => prev === params.name ? null : params.name!);
    }, []);

    const onGIDistClick = useCallback((params: { data?: { fullName?: string } }) => {
        if (params.data?.fullName) {
            setExpandedGI((prev) => prev === params.data!.fullName ? null : params.data!.fullName!);
            setExpandedTypes(new Set());
        }
    }, []);

    const onGITypeClick = useCallback((params: { name?: string }) => {
        if (params.name) setActiveGIType((prev) => prev === params.name ? null : params.name!);
    }, []);

    const onVoltageClick = useCallback((params: { name?: string }) => {
        if (params.name) setActiveVoltage((prev) => prev === params.name ? null : params.name!);
    }, []);

    const onBarClick = useCallback((params: { seriesName?: string }) => {
        if (params.seriesName) setActiveBayType((prev) => prev === params.seriesName ? null : params.seriesName!);
    }, []);

    const clearFilters = () => {
        setActiveULTG(null); setActiveGIType(null); setActiveBayType(null); setActiveVoltage(null);
        setExpandedGI(null);
    };

    return {
        // raw data
        gis, bays, relays, trafos, loading, mtuLoading: false, theme,
        // all MTU data
        mtuData,
        // filter state
        activeULTG, setActiveULTG, activeGIType, setActiveGIType,
        activeBayType, setActiveBayType, activeVoltage, setActiveVoltage,
        expandedGI, setExpandedGI, expandedTypes, setExpandedTypes,
        activeVoltageTab, setActiveVoltageTab,
        // derived
        filteredGIs, filteredBays, ultgNames,
        totalGI, totalBay, totalGITypes, totalVoltages, totalRelays,
        giDistribution, bayTypesPerGI, bayTypeColorMap,
        // equipment
        globalEquipmentCounts, equipmentCountsPerGI, equipmentHeatmapData, equipmentBarOption,
        // chart options
        ultgOption, giTypeOption, voltageOption, giBarOption, stackedBarOption,
        // handlers
        onULTGClick, onGIDistClick, onGITypeClick, onVoltageClick, onBarClick, clearFilters,
        // utils
        shortGI,
    };
}
