"use client";

/**
 * Thor Vaisala — Cloud Console Page (Gen 3 v2.3)
 *
 * 5-tab architecture per CC Standard v2.3 YGGDRASIL.
 * Visual Standard: Spreadsheet Sync v2.0 (compact, dense, no emoji)
 *
 * Tabs:
 *   1. Config       — editable, dynamic column mapping
 *   2. Operations   — merged: Runtime (sub-tab) + Validation (sub-tab)
 *   3. Spec & Infra — SR cold-start metadata
 *   4. Notifier     — Pub/Sub alert status + anti-spam
 *   5. Enrichment   — editable, dynamic source manager
 */

import { useState, useCallback } from "react";
import {
    Settings, Activity, Server,
    MessageSquare, Layers,
} from "lucide-react";

import type { ThorConfig } from "./_lib/types";
import { fmtBool, fmtWIB, fmtAgo } from "./_lib/api";
import { ServiceHeader, ServiceTabs, ServiceSkeleton as LoadingSkeleton, ServiceToast as Toast } from "../_components/service-ui";
import { useFirestoreConfig, useServiceInfo } from "../_components/useFirestore";

import TabConfig from "./_components/TabConfig";
import TabOperations from "./_components/TabOperations";
import TabSpecInfra from "./_components/TabSpecInfra";
import TabNotifier from "./_components/TabNotifier";
import TabEnrichment from "./_components/TabEnrichment";

/* ═══════════════════════════════════════════════════
   Tab Definitions — 5 tabs
   ═══════════════════════════════════════════════════ */

type MainTab = "config" | "operations" | "spec-infra" | "notifier" | "enrichment";

const TABS = [
    { id: "config" as MainTab, label: "Config", icon: Settings },
    { id: "enrichment" as MainTab, label: "Enrichment", icon: Layers },
    { id: "operations" as MainTab, label: "Operations", icon: Activity },
    { id: "spec-infra" as MainTab, label: "Spec & Infra", icon: Server },
    { id: "notifier" as MainTab, label: "Notifier", icon: MessageSquare },
];

/* ═══════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════ */

export default function ThorVaisalaPage() {
    const [activeTab, setActiveTab] = useState<MainTab>("config");
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

    /* Firestore SSOT */
    const fsConfig = useFirestoreConfig<Partial<ThorConfig>>('thor_vaisala');
    const config = fsConfig || {};
    const configLoading = !fsConfig;

    /* Registry — consistent header with sidebar */
    const svcInfo = useServiceInfo('thor-vaisala');

    const showFeedback = useCallback((msg: string, ok: boolean) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 3000);
    }, []);

    /* Derived */
    const isActive = fmtBool(config.IS_ACTIVE);
    const mode = (config.NOTIFIER_MODE as string) || "production";
    const lastRun = config.LAST_FETCH_TS as string | undefined;



    if (configLoading) return <LoadingSkeleton />;

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">
            {feedback && <Toast message={feedback.msg} ok={feedback.ok} />}

            {/* Header */}
            <ServiceHeader
                title={svcInfo?.name || "Thor Gen 3 (Beta)"}
                subtitle={svcInfo?.subtitle || "AI Model Lightning"}
                health={isActive ? "healthy" : "paused"}
            />

            {/* Status Bar — read-only badges */}
            <div className="border-y border-border py-3 mb-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    {/* Worker status */}
                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">Worker</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>{isActive ? "Enabled" : "Disabled"}</span>
                    </span>

                    {/* Mode */}
                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">Mode</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            mode === "production" ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{mode}</span>
                    </span>

                    {/* Config + API Status */}
                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">Config</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            config.CONFIG_STATUS === 'validated' ? 'bg-emerald-500/10 text-emerald-400' :
                            config.CONFIG_STATUS === 'error' ? 'bg-red-500/10 text-red-400' :
                            'bg-amber-500/10 text-amber-400'
                        }`}>{String(config.CONFIG_STATUS || "—")}</span>
                    </span>

                    <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">API</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            config.API_STATUS === 'connected' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-red-500/10 text-red-400'
                        }`}>{String(config.API_STATUS || "—")}</span>
                    </span>

                    {/* Right: Last run */}
                    <span className="ml-auto flex items-center gap-1">
                        <span className="text-muted-foreground/50">Last run</span>
                        <span className="font-mono tabular-nums text-foreground/70">{fmtWIB(lastRun)}</span>
                        <span className="text-muted-foreground/40">({fmtAgo(lastRun)})</span>
                    </span>
                </div>
            </div>

            {/* Tabs — 5 main tabs */}
            <ServiceTabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as MainTab)} />

            {/* Tab Content */}
            {activeTab === "config" && <TabConfig config={config} showFeedback={showFeedback} />}
            {activeTab === "enrichment" && <TabEnrichment config={config} showFeedback={showFeedback} />}
            {activeTab === "operations" && <TabOperations config={config} />}
            {activeTab === "spec-infra" && <TabSpecInfra config={config} />}
            {activeTab === "notifier" && <TabNotifier config={config} />}
        </div>
    );
}
