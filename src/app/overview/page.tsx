"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Filter, RefreshCw, Building2, Zap, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { DataFreshness } from "@/components/DataFreshness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverviewData } from "./_components/use-overview-data";
import { KpiCards } from "./_components/kpi-cards";
import { DonutPanel } from "./_components/donut-panel";
import { GiPanel } from "./_components/gi-panel";
import { DetailTable } from "./_components/detail-table";
import { EquipmentPanel } from "./_components/equipment-panel";
import { MtuBreakdown } from "./_components/mtu-breakdown";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/* shared motion presets */
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};
const transition = (delay: number) => ({
  duration: 0.45,
  delay,
  ease: [0.16, 1, 0.3, 1] as const,
});

export default function OverviewPage() {
  const d = useOverviewData();
  const equipmentSectionRef = useRef<HTMLDivElement | null>(null);

  // Cross-filter state for GI Detail donuts
  const [detailBayType, setDetailBayType] = useState<string | null>(null);
  const [detailRelayJenis, setDetailRelayJenis] = useState<string | null>(null);

  // Reset when GI changes
  useEffect(() => { setDetailBayType(null); setDetailRelayJenis(null); }, [d.expandedGI]);

  useEffect(() => {
    if (d.equipmentRequested) return;
    const node = equipmentSectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          d.requestEquipmentData();
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [d.equipmentRequested, d.requestEquipmentData]);

  if (d.loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-6 gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        {...fadeUp}
        transition={transition(0)}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Overview UPT Bogor</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Data real-time dari Google Sheets — {d.gis.length} GI, {d.bays.length} Bay, {d.totalRelays} Relay
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <DataFreshness />
          {(d.activeULTG || d.activeGIType || d.activeBayType || d.activeVoltage) && (
            <button onClick={d.clearFilters} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <RefreshCw className="h-3 w-3" /> Reset Filter
            </button>
          )}
          {d.ultgNames.map((name) => (
            <button
              key={name}
              onClick={() => d.setActiveULTG((prev) => prev === name ? null : name)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-all duration-200 ${d.activeULTG === name
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted"
                }`}
            >
              <Filter className="h-3 w-3 inline mr-1" />
              ULTG {name}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Active filters */}
      {(d.activeULTG || d.activeGIType || d.activeBayType || d.activeVoltage) && (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-muted-foreground">Filter aktif:</span>
          {d.activeULTG && <Badge variant="secondary" className="text-xs">ULTG: {d.activeULTG}</Badge>}
          {d.activeGIType && <Badge variant="secondary" className="text-xs">Tipe: {d.activeGIType}</Badge>}
          {d.activeBayType && <Badge variant="secondary" className="text-xs">Bay: {d.activeBayType}</Badge>}
          {d.activeVoltage && <Badge variant="secondary" className="text-xs">Tegangan: {d.activeVoltage}</Badge>}
        </div>
      )}

      {/* KPI Cards */}
      <motion.div {...fadeUp} transition={transition(0.08)}>
        <KpiCards
          totalGI={d.totalGI}
          totalBay={d.totalBay}
          totalGITypes={d.totalGITypes}
          totalVoltages={d.totalVoltages}
        />
      </motion.div>

      {/* Main Visual: Donut Panel + GI Panel */}
      <motion.div {...fadeUp} transition={transition(0.16)} style={{ height: 625 }}>
        {d.expandedGI ? (
          /* Expanded: single card wrapping both detail panels */
          <Card className="shadow-none py-0 gap-0 h-full">
            <div className="flex h-full">
              <DonutPanel
                expandedGI={d.expandedGI} filteredGIs={d.filteredGIs} filteredBays={d.filteredBays}
                relays={d.relays} bayTypeColorMap={d.bayTypeColorMap} theme={d.theme}
                ultgOption={d.ultgOption} giTypeOption={d.giTypeOption} voltageOption={d.voltageOption}
                onULTGClick={d.onULTGClick} onGITypeClick={d.onGITypeClick} onVoltageClick={d.onVoltageClick}
                activeBayType={detailBayType} activeRelayJenis={detailRelayJenis}
                onBayTypeFilter={setDetailBayType} onRelayJenisFilter={setDetailRelayJenis}
              />
              <div className="w-px bg-border/50 shrink-0" />
              <GiPanel
                expandedGI={d.expandedGI} setExpandedGI={d.setExpandedGI}
                expandedTypes={d.expandedTypes} setExpandedTypes={d.setExpandedTypes}
                filteredGIs={d.filteredGIs} filteredBays={d.filteredBays} bays={d.bays} relays={d.relays} trafos={d.trafos} mtuData={d.mtuData}
                bayTypeColorMap={d.bayTypeColorMap}
                activeULTG={d.activeULTG} setActiveULTG={d.setActiveULTG}
                activeGIType={d.activeGIType} setActiveGIType={d.setActiveGIType}
                activeVoltage={d.activeVoltage} setActiveVoltage={d.setActiveVoltage}
                detailBayTypeFilter={detailBayType}
                detailProteksiFilter={detailRelayJenis}
              />
            </div>
          </Card>
        ) : (
          /* Default: two separate cards */
          <div className="flex gap-4 h-full">
            <div style={{ flex: '1.5 1 0%', minWidth: 0 }}>
              <Card className="h-full py-0 gap-0 shadow-none">
                <DonutPanel
                  expandedGI={d.expandedGI} filteredGIs={d.filteredGIs} filteredBays={d.filteredBays}
                  relays={d.relays} bayTypeColorMap={d.bayTypeColorMap} theme={d.theme}
                  ultgOption={d.ultgOption} giTypeOption={d.giTypeOption} voltageOption={d.voltageOption}
                  onULTGClick={d.onULTGClick} onGITypeClick={d.onGITypeClick} onVoltageClick={d.onVoltageClick}
                  activeBayType={detailBayType} activeRelayJenis={detailRelayJenis}
                  onBayTypeFilter={setDetailBayType} onRelayJenisFilter={setDetailRelayJenis}
                />
              </Card>
            </div>
            <div style={{ flex: '2 1 0%', minWidth: 0 }}>
              <Card className="h-full py-0 gap-0 shadow-none flex flex-col">
                <GiPanel
                  expandedGI={d.expandedGI} setExpandedGI={d.setExpandedGI}
                  expandedTypes={d.expandedTypes} setExpandedTypes={d.setExpandedTypes}
                  filteredGIs={d.filteredGIs} filteredBays={d.filteredBays} bays={d.bays} relays={d.relays} trafos={d.trafos} mtuData={d.mtuData}
                  bayTypeColorMap={d.bayTypeColorMap}
                  activeULTG={d.activeULTG} setActiveULTG={d.setActiveULTG}
                  activeGIType={d.activeGIType} setActiveGIType={d.setActiveGIType}
                  activeVoltage={d.activeVoltage} setActiveVoltage={d.setActiveVoltage}
                />
              </Card>
            </div>
          </div>
        )}
      </motion.div>

      {/* Data Table */}
      <motion.div {...fadeUp} transition={transition(0.24)}>
        <DetailTable
          filteredGIs={d.filteredGIs} filteredBays={d.filteredBays}
          expandedGI={d.expandedGI} setExpandedGI={d.setExpandedGI}
          expandedTypes={d.expandedTypes} setExpandedTypes={d.setExpandedTypes}
          bayTypeColorMap={d.bayTypeColorMap}
          setActiveULTG={d.setActiveULTG} setActiveGIType={d.setActiveGIType} setActiveVoltage={d.setActiveVoltage}
          activeULTG={d.activeULTG} activeGIType={d.activeGIType} activeVoltage={d.activeVoltage}
        />
      </motion.div>

      {/* Equipment Panel */}
      <motion.div {...fadeUp} transition={transition(0.32)} ref={equipmentSectionRef}>
        {!d.equipmentRequested ? (
          <Card className="shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Equipment insights will load when this section is needed.
            </CardContent>
          </Card>
        ) : d.mtuLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <EquipmentPanel
            equipmentHeatmapData={d.equipmentHeatmapData}
            equipmentBarOption={d.equipmentBarOption}
            globalEquipmentCounts={d.globalEquipmentCounts}
            expandedGI={d.expandedGI}
            setExpandedGI={d.setExpandedGI}
          />
        )}
      </motion.div>

      {/* Stacked Bar: Bay per GI */}
      <motion.div {...fadeUp} transition={transition(0.4)}>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Bay per Gardu Induk
              <span className="text-[10px] text-muted-foreground font-normal ml-1">— Stacked by Tipe Bay</span>
              <Badge variant="secondary" className="ml-auto text-[9px]">Klik warna untuk filter tipe</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts
              option={d.stackedBarOption}
              style={{ height: Math.max(300, d.bayTypesPerGI.sortedGIs.length * 28 + 60) }}
              onEvents={{ click: d.onBarClick }}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* GI Distribution Bar */}
      <motion.div {...fadeUp} transition={transition(0.48)}>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Gardu Induk
              <span className="text-[10px] text-muted-foreground font-normal">— Bay per GI</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={d.giBarOption} style={{ height: 280 }} onEvents={{ click: d.onGIDistClick }} />
          </CardContent>
        </Card>
      </motion.div>

      {/* MTU Breakdown — paling bawah */}
      <motion.div {...fadeUp} transition={transition(0.56)}>
        {!d.equipmentRequested ? (
          <Card className="shadow-none">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Breakdown loads on demand with equipment insights.
            </CardContent>
          </Card>
        ) : d.mtuLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <MtuBreakdown globalEquipmentCounts={d.globalEquipmentCounts} />
        )}
      </motion.div>
    </div>
  );
}
