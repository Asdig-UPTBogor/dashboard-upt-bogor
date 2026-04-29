"use client";

/**
 * WaGate — Cloud Console Page
 *
 * 7 tabs per WAGATE_DESIGN.md §11 (+ Docs tab).
 * Typography: ds-* classes only. Shadcn: Badge for status chips.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Activity, Users, Send, ScrollText, QrCode, Settings, BookOpen, Contact, Radio, Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import type { WaGateConfig } from './_lib/types';
import { fmtBool, fmtWIB, fmtAgo } from './_lib/api';
import {
    ServiceHeader,
    ServiceTabs,
    ServiceSkeleton as LoadingSkeleton,
    ServiceToast as Toast,
} from '../_components/service-ui';
import { useFirestoreConfig, useServiceInfo } from '../_components/useFirestore';

import TabStatus from './_components/TabStatus';
import TabGroups from './_components/TabGroups';
import TabSendTest from './_components/TabSendTest';
import TabLogs from './_components/TabLogs';
import TabSession from './_components/TabSession';
import TabSettings from './_components/TabSettings';
import TabDocs from './_components/TabDocs';
import TabContacts from './_components/TabContacts';
import TabEventMonitor from './_components/TabEventMonitor';
import TabArchitecture from './_components/TabArchitecture';

type MainTab = 'status' | 'groups' | 'send-test' | 'logs' | 'session' | 'settings' | 'docs' | 'contacts' | 'events' | 'architecture';

const TABS = [
    { id: 'status' as MainTab, label: 'Status', icon: Activity },
    { id: 'architecture' as MainTab, label: 'Architecture', icon: Network },
    { id: 'session' as MainTab, label: 'Session Control', icon: QrCode },
    { id: 'events' as MainTab, label: 'Event Monitor', icon: Radio },
    { id: 'groups' as MainTab, label: 'Groups', icon: Users },
    { id: 'contacts' as MainTab, label: 'Contacts', icon: Contact },
    { id: 'send-test' as MainTab, label: 'Send Test', icon: Send },
    { id: 'logs' as MainTab, label: 'Logs', icon: ScrollText },
    { id: 'docs' as MainTab, label: 'Docs', icon: BookOpen },
    { id: 'settings' as MainTab, label: 'Settings', icon: Settings },
];

export default function WaGatePage() {
    // Default tab = 'status' (pure FS, tidak bangunin WaGate). User pilih Session Control
    // manual kalau mau wake atau scan QR. Hemat cold start kalau cuma mau lihat status.
    const [activeTab, setActiveTab] = useState<MainTab>('status');
    const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

    const fsConfig = useFirestoreConfig<WaGateConfig>('wagate');
    const config = fsConfig || ({} as WaGateConfig);
    const configLoading = !fsConfig;

    const svcInfo = useServiceInfo('wagate');

    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showFeedback = useCallback((msg: string, ok: boolean) => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        setFeedback({ msg, ok });
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
    }, []);
    useEffect(() => () => { if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current); }, []);

    const isActive = fmtBool(config.IS_ACTIVE);
    const snapshot = config.provider_snapshot;
    const bot = config.bot_identity;
    const wsStatus = snapshot?.status || '—';
    const connected = snapshot?.ws_connected === true;

    const healthStatus = useMemo(() => {
        if (!isActive) return 'paused' as const;
        if (wsStatus === 'FAILED') return 'error' as const;
        if (!connected) return 'stale' as const;
        return 'healthy' as const;
    }, [isActive, wsStatus, connected]);

    if (configLoading) return <LoadingSkeleton />;

    const gatewayBadge = isActive
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-red-500/10 text-red-400 border-red-500/30';

    const statusBadge =
        wsStatus === 'WORKING' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
        wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
        wsStatus === 'FAILED' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
        'bg-muted/20 text-muted-foreground border-border/30';

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 relative">
            {feedback && <Toast message={feedback.msg} ok={feedback.ok} />}

            <ServiceHeader
                title={svcInfo?.name || 'WaGate'}
                subtitle={svcInfo?.subtitle || 'Self-hosted WhatsApp · Baileys'}
                health={healthStatus}
            />

            {/* Status Bar */}
            <div className="border-y border-border py-3 mb-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="flex items-center gap-1">
                        <span className="ds-label text-muted-foreground">Gateway</span>
                        <Badge variant="outline" className={gatewayBadge}>
                            {isActive ? 'Active' : 'Disabled'}
                        </Badge>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="ds-label text-muted-foreground">Status</span>
                        <Badge variant="outline" className={statusBadge}>{wsStatus}</Badge>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="ds-label text-muted-foreground">Bot</span>
                        <span className="ds-data">{bot?.phone || '—'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="ds-label text-muted-foreground">Today</span>
                        <span className="ds-data text-emerald-400">{config.TOTAL_SENT_TODAY ?? 0}</span>
                        <span className="ds-small">/</span>
                        <span className="ds-data text-red-400">{config.TOTAL_FAILED_TODAY ?? 0}</span>
                        <span className="ds-small">/</span>
                        <span className="ds-data text-blue-400">{config.TOTAL_RECEIVED_TODAY ?? 0}</span>
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                        <span className="ds-label text-muted-foreground">Last run</span>
                        <span className="ds-data">{fmtWIB(config.lastRun)}</span>
                        <span className="ds-small">({fmtAgo(config.lastRun)})</span>
                    </span>
                </div>
            </div>

            <ServiceTabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as MainTab)} />

            {activeTab === 'status' && <TabStatus config={config} />}
            {activeTab === 'session' && <TabSession config={config} showFeedback={showFeedback} />}
            {activeTab === 'groups' && <TabGroups config={config} showFeedback={showFeedback} />}
            {activeTab === 'contacts' && <TabContacts config={config} showFeedback={showFeedback} />}
            {activeTab === 'events' && <TabEventMonitor config={config} showFeedback={showFeedback} />}
            {activeTab === 'architecture' && <TabArchitecture config={config} showFeedback={showFeedback} />}
            {activeTab === 'send-test' && <TabSendTest config={config} showFeedback={showFeedback} />}
            {activeTab === 'logs' && <TabLogs />}
            {activeTab === 'docs' && <TabDocs />}
            {activeTab === 'settings' && <TabSettings config={config} showFeedback={showFeedback} />}
        </div>
    );
}
