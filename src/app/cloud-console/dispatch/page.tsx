"use client";

/**
 * Dispatch — Cloud Console Page (Thin Orchestrator).
 *
 * Structure:
 *   - Tab registry: _config/tabs.ts        (single source for tab list + domain text)
 *   - State derivation: _lib/selectors.ts  (resolve PRIMARY/SECONDARY/health dari config)
 *   - Shared hooks: _hooks/                (useProviderStatus, dll)
 *   - Primitives: _components/primitives/  (reusable atoms)
 *   - Flow viz: _components/flow/          (architecture diagram)
 *   - Tab bodies: _components/Tab*.tsx     (one file per tab, compose primitives)
 *
 * Tambah tab baru: (1) push ke DISPATCH_TABS, (2) add case di renderer.
 */

import { useCallback, useState } from 'react';

import type { DispatchConfig } from './_lib/types';
import { fmtWIB, fmtAgo } from './_lib/api';
import { resolveProviders, resolveHealth } from './_lib/selectors';
import { DISPATCH_TABS, type DispatchTabId } from './_config/tabs';
import { useProviderStatus } from './_hooks/useProviderStatus';

import {
    ServiceHeader, ServiceTabs, ServiceSkeleton as LoadingSkeleton, ServiceToast as Toast,
} from '../_components/service-ui';
import { useFirestoreConfig, useServiceInfo } from '../_components/useFirestore';

import TabStatus from './_components/TabStatus';
import TabArchitecture from './_components/TabArchitecture';
import TabGroups from './_components/TabGroups';
import TabProvider from './_components/TabProvider';
import TabLogs from './_components/TabLogs';
import TabInbound from './_components/TabInbound';
import TabSettings from './_components/TabSettings';

export default function DispatchPage() {
    const [activeTab, setActiveTab] = useState<DispatchTabId>('status');
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

    const fsConfig = useFirestoreConfig<DispatchConfig>('dispatch');
    const config = fsConfig || ({} as DispatchConfig);
    const configLoading = !fsConfig;
    const svcInfo = useServiceInfo('dispatch');

    // Shared: live provider status (fetch once, pass ke tab yang butuh)
    const { statuses: providerStatuses } = useProviderStatus(30_000);

    const showFeedback = useCallback((msg: string, ok: boolean) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback(null), 3000);
    }, []);

    if (configLoading) return <LoadingSkeleton />;

    const { primary, secondary } = resolveProviders(config);
    const health = resolveHealth(config);

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">
            {feedback && <Toast message={feedback.msg} ok={feedback.ok} />}

            <ServiceHeader
                title={svcInfo?.name || 'Dispatch'}
                subtitle={svcInfo?.subtitle || 'Unified Messaging · CF Gen2'}
                health={health}
            />

            {/* Banner dari service registry description — admin set via Firestore, bukan hardcode */}
            {svcInfo?.description && (
                <div className="rounded-md border border-border/30 bg-muted/5 px-3 py-2 mb-4 ds-small text-muted-foreground/80">
                    {svcInfo.description}
                </div>
            )}

            {/* Status bar — badges read-only */}
            <StatusBar config={config} primary={primary} secondary={secondary} />

            <ServiceTabs
                tabs={DISPATCH_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id as DispatchTabId)}
            />

            {activeTab === 'status' && <TabStatus config={config} providerStatuses={providerStatuses} />}
            {activeTab === 'architecture' && <TabArchitecture config={config} providerStatuses={providerStatuses} />}
            {activeTab === 'groups' && <TabGroups config={config} showFeedback={showFeedback} />}
            {activeTab === 'provider' && <TabProvider config={config} showFeedback={showFeedback} />}
            {activeTab === 'logs' && <TabLogs groups={config.groups} />}
            {activeTab === 'inbound' && <TabInbound />}
            {activeTab === 'settings' && <TabSettings config={config} showFeedback={showFeedback} />}
        </div>
    );
}

/* ── Internal subcomponent: StatusBar ────────────────────────── */

function StatusBar({
    config, primary, secondary,
}: {
    config: DispatchConfig;
    primary: string;
    secondary: string;
}) {
    const isActive = !!config.IS_ACTIVE;
    const connected = !!config.provider_snapshot?.connected;

    return (
        <div className="border-y border-border py-3 mb-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Badge label="Gateway" value={isActive ? 'Active' : 'Disabled'} tone={isActive ? 'ok' : 'err'} />
                <span className="flex items-center gap-1.5">
                    <span className="ds-label">Primary</span>
                    <Chip value={primary} tone="action" />
                    {secondary !== '—' && (
                        <>
                            <span className="ds-small text-muted-foreground/40">⇄</span>
                            <span className="ds-label">Secondary</span>
                            <Chip value={secondary} tone="muted" />
                        </>
                    )}
                </span>
                <Badge label="Connection" value={connected ? 'Connected' : 'Disconnected'} tone={connected ? 'ok' : 'err'} />
                <span className="flex items-center gap-1">
                    <span className="ds-label">Today</span>
                    <span className="text-xs font-mono tabular-nums text-emerald-400">{config.TOTAL_DELIVERED_TODAY ?? 0}</span>
                    <span className="ds-small text-muted-foreground/40">/</span>
                    <span className="text-xs font-mono tabular-nums text-red-400">{config.TOTAL_FAILED_TODAY ?? 0}</span>
                </span>
                <span className="ml-auto flex items-center gap-1">
                    <span className="ds-label">Last run</span>
                    <span className="text-xs font-mono tabular-nums text-foreground/70">{fmtWIB(config.lastRun)}</span>
                    <span className="ds-small">({fmtAgo(config.lastRun)})</span>
                </span>
            </div>
        </div>
    );
}

type Tone = 'ok' | 'err' | 'action' | 'muted' | 'warn';
const TONE_CLASS: Record<Tone, string> = {
    ok: 'bg-emerald-500/10 text-emerald-400',
    err: 'bg-red-500/10 text-red-400',
    action: 'bg-blue-500/10 text-blue-400',
    muted: 'bg-slate-500/10 text-slate-400',
    warn: 'bg-amber-500/10 text-amber-400',
};

function Badge({ label, value, tone }: { label: string; value: string; tone: Tone }) {
    return (
        <span className="flex items-center gap-1">
            <span className="ds-label">{label}</span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${TONE_CLASS[tone]}`}>{value}</span>
        </span>
    );
}

function Chip({ value, tone }: { value: string; tone: Tone }) {
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded uppercase ${TONE_CLASS[tone]}`}>{value}</span>;
}
