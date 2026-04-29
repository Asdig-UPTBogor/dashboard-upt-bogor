"use client";

/**
 * RecentActivity — Activity panel + Top Reject Rate list.
 */

import { Layers, Clock, TrendingUp } from "lucide-react";
import { ActivityRow } from "./StatsCards";
import type { HealthData } from "./types";

interface SSConfigSubset {
    masterConfigUpdatedAt?: string | null;
    lastStatus?: string;
    lastRun?: string | null;
    globalEnabled?: boolean;
}

export function RecentActivity({
    ssConfig,
    masterConfigured,
    lastRun,
    health,
}: {
    ssConfig: SSConfigSubset | null;
    masterConfigured: boolean;
    lastRun: string | null;
    health: HealthData | null;
}) {
    return (
        <>
            <section>
                <h3 className="ds-small uppercase tracking-widest opacity-70 mb-3">
                    Activity
                </h3>
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <ActivityRow
                        icon={<Layers className="h-4 w-4 text-indigo-400" />}
                        label="Master Hierarchy"
                        value={masterConfigured ? "Configured ✓" : "Belum configured"}
                        time={ssConfig?.masterConfigUpdatedAt}
                    />
                    <ActivityRow
                        icon={<Clock className="h-4 w-4 text-blue-400" />}
                        label="Last Sync Run"
                        value={ssConfig?.lastStatus || "—"}
                        time={lastRun}
                    />
                    <ActivityRow
                        icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                        label="Global Sync"
                        value={ssConfig?.globalEnabled !== false ? "ENABLED" : "PAUSED"}
                    />
                </div>
            </section>

            {/* ── Top Issues ── */}
            {health && health.datasets && (
                <section>
                    <h3 className="ds-small uppercase tracking-widest opacity-70 mb-3">
                        Top Reject Rate
                    </h3>
                    <div className="rounded-lg border border-border bg-card divide-y divide-border">
                        {health.datasets
                            .filter((d) => d.row_count_rejected > 0)
                            .sort((a, b) => b.row_count_rejected - a.row_count_rejected)
                            .slice(0, 5)
                            .map((d) => (
                                <div key={d.dataset_name} className="flex items-center justify-between p-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-mono truncate">{d.dataset_name}</p>
                                        <p className="ds-small opacity-60">
                                            {d.row_count_total.toLocaleString("id-ID")} rows · valid {d.valid_pct}%
                                        </p>
                                    </div>
                                    <span className="ds-data rounded bg-amber-500/10 text-amber-400 px-2 py-1 text-xs shrink-0">
                                        {d.row_count_rejected.toLocaleString("id-ID")} reject
                                    </span>
                                </div>
                            ))}
                        {health.datasets.filter((d) => d.row_count_rejected > 0).length === 0 && (
                            <p className="p-4 ds-small opacity-60 text-center">
                                Zero rejects — data clean 🎉
                            </p>
                        )}
                    </div>
                </section>
            )}
        </>
    );
}
