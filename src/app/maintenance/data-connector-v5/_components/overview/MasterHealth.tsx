"use client";

/**
 * MasterHealth — Master Hierarchy stats row (UPT/ULTG/GI/Bay counts)
 * + Data Volume & Sync Health + Status per Dataset breakdown.
 */

import {
    Building2, Network, Zap, Box, FileSpreadsheet, Layers,
    CheckCircle2, Database, Loader2,
} from "lucide-react";
import { StatCard, StatusTile } from "./StatsCards";
import type { HealthData, MasterCounts } from "./types";

export function MasterHealth({
    loadingMaster,
    masterCounts,
    loadingHealth,
    health,
    spreadsheetCount,
    totalSheets,
}: {
    loadingMaster: boolean;
    masterCounts: MasterCounts;
    loadingHealth: boolean;
    health: HealthData | null;
    spreadsheetCount: number;
    totalSheets: number;
}) {
    return (
        <>
            {/* ── Master Hierarchy row ── */}
            <section>
                <h3 className="ds-small uppercase tracking-widest opacity-70 mb-3">
                    Master Hierarchy
                </h3>
                {loadingMaster ? (
                    <div className="flex items-center justify-center h-24">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-3">
                        <StatCard
                            label="UPT"
                            value={masterCounts.upt}
                            icon={<Building2 className="h-4 w-4" />}
                            color="indigo"
                        />
                        <StatCard
                            label="ULTG"
                            value={masterCounts.ultg}
                            icon={<Network className="h-4 w-4" />}
                            color="blue"
                        />
                        <StatCard
                            label="GI"
                            value={masterCounts.gi}
                            icon={<Zap className="h-4 w-4" />}
                            color="amber"
                        />
                        <StatCard
                            label="Bay"
                            value={masterCounts.bay}
                            icon={<Box className="h-4 w-4" />}
                            color="emerald"
                        />
                    </div>
                )}
            </section>

            {/* ── Spreadsheet Sync Health ── */}
            <section>
                <h3 className="ds-small uppercase tracking-widest opacity-70 mb-3">
                    Data Volume &amp; Sync Health
                </h3>
                {loadingHealth ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                    </div>
                ) : health && health.summary ? (
                    <div className="grid grid-cols-4 gap-3">
                        <StatCard
                            label="Spreadsheet"
                            value={spreadsheetCount}
                            icon={<FileSpreadsheet className="h-4 w-4" />}
                            color="indigo"
                        />
                        <StatCard
                            label="Sheet"
                            value={totalSheets}
                            icon={<Layers className="h-4 w-4" />}
                            color="blue"
                        />
                        <StatCard
                            label="Total Rows"
                            value={health.summary.total_rows}
                            icon={<Database className="h-4 w-4" />}
                            color="emerald"
                        />
                        <StatCard
                            label="Valid"
                            value={`${health.summary.overall_valid_pct}%`}
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            color="emerald"
                            subtitle={`${health.summary.total_rejected.toLocaleString("id-ID")} rejected`}
                        />
                    </div>
                ) : (
                    <p className="ds-small opacity-60">Health data belum tersedia</p>
                )}
            </section>

            {/* ── Status Breakdown ── */}
            {health && health.summary && (
                <section>
                    <h3 className="ds-small uppercase tracking-widest opacity-70 mb-3">
                        Status per Dataset
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                        <StatusTile label="Excellent" count={health.summary.excellent} color="emerald" />
                        <StatusTile label="Good" count={health.summary.good} color="blue" />
                        <StatusTile label="Warning" count={health.summary.warning} color="amber" />
                        <StatusTile label="Critical" count={health.summary.critical} color="red" />
                    </div>
                </section>
            )}
        </>
    );
}
