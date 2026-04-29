"use client";

/**
 * Tab Status — Real-time view of WaGate state.
 * Sections: Connection + Bot Identity, Today Counters, Queue, Last Operation, Bot Identity, Infrastructure
 * Typography: ds-* classes only (globals.css). No hardcoded text-sizes.
 * Data source: Firestore `service_runtime_configs/wagate` (reactive via onSnapshot).
 */

import { memo } from 'react';
import { Radio, CheckCircle2, Server, Clock, Inbox, Phone } from 'lucide-react';
import { ServiceSection, ServiceGrid } from '../../_components/service-ui';
import { fmtWIB, fmtAgo, fmtMs } from '../_lib/api';
import type { WaGateConfig } from '../_lib/types';

function TabStatusImpl({ config }: { config: WaGateConfig }) {
    const snapshot = config.provider_snapshot;
    const bot = config.bot_identity;
    const queue = config.queue_state;
    const wsStatus = snapshot?.status || 'INIT';
    const connected = snapshot?.ws_connected === true;

    return (
        <div className="space-y-5">
            {/* Top row — 3 stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Connection + Bot */}
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Radio className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="ds-label uppercase tracking-wider text-muted-foreground">Connection</span>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="ds-title">{wsStatus}</span>
                            <span className={`h-2 w-2 rounded-full ${
                                connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' :
                                wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING' ? 'bg-amber-400' :
                                'bg-red-400'
                            }`} />
                        </div>
                        <div className="space-y-0.5">
                            <div className="ds-label">Bot: <span className="ds-small">{bot?.push_name || '—'}</span></div>
                            <div className="ds-label">Phone: <span className="ds-data">{bot?.phone || '—'}</span></div>
                        </div>
                    </div>
                </div>

                {/* Today Counters */}
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="ds-label uppercase tracking-wider text-muted-foreground">Today</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <div className="ds-label">Sent</div>
                            <div className="ds-kpi text-emerald-400">{config.TOTAL_SENT_TODAY ?? 0}</div>
                        </div>
                        <div>
                            <div className="ds-label">Failed</div>
                            <div className="ds-kpi text-red-400">{config.TOTAL_FAILED_TODAY ?? 0}</div>
                        </div>
                        <div>
                            <div className="ds-label">Recv</div>
                            <div className="ds-kpi text-blue-400">{config.TOTAL_RECEIVED_TODAY ?? 0}</div>
                        </div>
                    </div>
                </div>

                {/* Queue State */}
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Inbox className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="ds-label uppercase tracking-wider text-muted-foreground">Queue</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="ds-label">Pending</div>
                            <div className="ds-kpi">{queue?.pending_count ?? 0}</div>
                        </div>
                        <div>
                            <div className="ds-label">Last Flush</div>
                            <div className="ds-data">{fmtAgo(queue?.last_flush_at)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Last Operation */}
            <ServiceSection title="Last Operation" icon={<Clock className="h-3.5 w-3.5" />} noCollapse>
                <ServiceGrid items={[
                    { label: 'Operation', value: config.LAST_OPERATION || '—' },
                    { label: 'Chat', value: config.LAST_OPERATION_CHAT || '—' },
                    { label: 'Result', value: config.LAST_OPERATION_RESULT || '—',
                      highlight: config.LAST_OPERATION_RESULT === 'sent' ? 'emerald' :
                                 config.LAST_OPERATION_RESULT === 'failed' ? 'amber' : undefined },
                    { label: 'Error', value: config.LAST_OPERATION_ERROR || '—' },
                    { label: 'Last Run', value: fmtWIB(config.lastRun) + ' (' + fmtAgo(config.lastRun) + ')' },
                    { label: 'Last Duration', value: fmtMs(config.lastDurationMs) },
                    { label: 'Last Status', value: config.lastStatus || '—',
                      highlight: config.lastStatus === 'sent' ? 'emerald' :
                                 config.lastStatus === 'failed' ? 'amber' : undefined },
                    { label: 'Total Ops', value: config._operation_count ?? 0 },
                ]} />
            </ServiceSection>

            {/* Bot Identity */}
            {bot && (
                <ServiceSection title="Bot Identity" icon={<Phone className="h-3.5 w-3.5" />} noCollapse>
                    <ServiceGrid items={[
                        { label: 'Phone', value: bot.phone || '—' },
                        { label: 'Push Name', value: bot.push_name || '—' },
                        { label: 'JID', value: bot.jid || '—' },
                        { label: 'Registered At', value: fmtWIB(bot.registered_at) },
                    ]} />
                </ServiceSection>
            )}

            {/* Infrastructure */}
            <ServiceSection title="Infrastructure" icon={<Server className="h-3.5 w-3.5" />} defaultOpen={false}>
                <ServiceGrid items={[
                    { label: 'Type', value: config.infra_type || '—' },
                    { label: 'Service', value: config.infra_service_name || '—' },
                    { label: 'Region', value: config.infra_region || '—' },
                    { label: 'Revision', value: config.infra_revision || (config.infra_latest_ready_revision?.split('/').pop()) || '—' },
                    { label: 'Runtime', value: config.infra_runtime || '—' },
                    { label: 'Image', value: config.infra_image || '—' },
                    { label: 'URL', value: config.infra_url || '—' },
                    { label: 'Ingress', value: config.infra_ingress || '—' },
                    { label: 'Memory', value: config.infra_memory || '—' },
                    { label: 'CPU', value: config.infra_cpu || '—' },
                    { label: 'Min/Max', value: `${config.infra_min_instances ?? 0} / ${config.infra_max_instances ?? '—'}` },
                    { label: 'Concurrency', value: config.infra_concurrency ?? '—' },
                    { label: 'Timeout', value: config.infra_timeout || '—' },
                    { label: 'Port', value: config.infra_port ?? '—' },
                    { label: 'Execution Env', value: config.infra_execution_environment || '—' },
                    { label: 'VPC Connector', value: config.infra_vpc_connector || '—' },
                    { label: 'Service Account', value: config.infra_service_account || '—' },
                    { label: 'Creator', value: config.infra_creator || '—' },
                    { label: 'Created At', value: fmtWIB(config.infra_created_at) },
                    { label: 'Last Deploy', value: fmtWIB(config.infra_last_deploy) + ' (' + fmtAgo(config.infra_last_deploy) + ')' },
                    { label: 'Generation', value: config.infra_generation ?? '—' },
                    { label: 'UID', value: config.infra_uid || '—' },
                    { label: 'Cold Start', value: fmtAgo(config.infra_cold_start_at) },
                ]} />
            </ServiceSection>
        </div>
    );
}

// Memo — parent page.tsx re-renders saat context configs ref change (service lain update).
// Compare 1 prop config shallow — stable ref thanks to FirestoreProvider selective merge.
const TabStatus = memo(TabStatusImpl, (prev, next) => prev.config === next.config);
export default TabStatus;
