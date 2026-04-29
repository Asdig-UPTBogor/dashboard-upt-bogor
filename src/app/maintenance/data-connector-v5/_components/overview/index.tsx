"use client";

/**
 * Overview — Executive summary DC V5 hub (container).
 * Full overview of SS V5 system state: data volumes, sync health, quality,
 * master hierarchy, recent activity.
 *
 * Data source:
 *   - useFirestoreDataSourcesV5() → spreadsheet config + count
 *   - useFirestoreSSConfig() → masterConfig + last run status
 *   - /api/data-sources/ss-v5/health → per-dataset health + row counts
 *   - /api/data-sources/ss-v5/hierarchy-tree → master counts
 */

import { useEffect, useState } from "react";
import {
    useFirestoreDataSourcesV2,
    useFirestoreSSConfig,
} from "../shared/useFirestore";
import { MasterHealth } from "./MasterHealth";
import { RecentActivity } from "./RecentActivity";
import type { HealthData, MasterCounts } from "./types";

interface SSConfigShape {
    masterConfig?: {
        levels?: {
            upt?: { spreadsheetId?: string };
            gi?: { spreadsheetId?: string };
        };
    };
    lastRun?: string | null;
    lastStatus?: string;
    masterConfigUpdatedAt?: string | null;
    globalEnabled?: boolean;
}

interface HierarchyTreeNode {
    stats?: {
        ultg_count?: number;
        gi_count?: number;
        bay_count?: number;
    };
}

export default function Overview() {
    const { dataSources } = useFirestoreDataSourcesV2();
    const { config: ssConfig } = useFirestoreSSConfig<SSConfigShape>();
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loadingHealth, setLoadingHealth] = useState(true);
    const [masterCounts, setMasterCounts] = useState<MasterCounts>({ upt: 0, ultg: 0, gi: 0, bay: 0 });
    const [loadingMaster, setLoadingMaster] = useState(true);

    useEffect(() => {
        // Parallel fetch health + hierarchy-tree
        (async () => {
            await Promise.all([
                fetch("/api/data-sources/ss-v5/health")
                    .then((r) => r.json())
                    .then((data: HealthData) => setHealth(data))
                    .catch(() => {})
                    .finally(() => setLoadingHealth(false)),
                fetch("/api/data-sources/ss-v5/hierarchy-tree")
                    .then((r) => r.json())
                    .then((j: { tree?: HierarchyTreeNode[] }) => {
                        const tree = j.tree || [];
                        let ultg = 0, gi = 0, bay = 0;
                        for (const u of tree) {
                            ultg += u.stats?.ultg_count || 0;
                            gi += u.stats?.gi_count || 0;
                            bay += u.stats?.bay_count || 0;
                        }
                        setMasterCounts({ upt: tree.length, ultg, gi, bay });
                    })
                    .catch(() => {})
                    .finally(() => setLoadingMaster(false)),
            ]);
        })();
    }, []);

    const spreadsheetCount = dataSources.length;
    const totalSheets = dataSources.reduce(
        (n, d) => n + (d.sheets ? Object.keys(d.sheets).length : 0),
        0
    );
    const masterConfigured = !!(
        ssConfig?.masterConfig?.levels?.upt?.spreadsheetId &&
        ssConfig?.masterConfig?.levels?.gi?.spreadsheetId
    );
    const lastRun = ssConfig?.lastRun || ssConfig?.masterConfigUpdatedAt || null;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h2 className="ds-heading mb-1">Executive Summary</h2>
                <p className="ds-small opacity-70">Kondisi keseluruhan Spreadsheet Sync V5</p>
            </div>

            <MasterHealth
                loadingMaster={loadingMaster}
                masterCounts={masterCounts}
                loadingHealth={loadingHealth}
                health={health}
                spreadsheetCount={spreadsheetCount}
                totalSheets={totalSheets}
            />

            <RecentActivity
                ssConfig={ssConfig}
                masterConfigured={masterConfigured}
                lastRun={lastRun}
                health={health}
            />
        </div>
    );
}
