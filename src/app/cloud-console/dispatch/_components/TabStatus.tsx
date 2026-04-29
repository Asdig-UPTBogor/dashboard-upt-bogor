"use client";

/**
 * TabStatus — Overview snapshot per spec DISPATCH_DESIGN.md §11B.
 *   provider info, today counters, last delivery, CC standard, infra, pub/sub
 *
 * Thin orchestrator: selectors derive dari config, primitives render.
 * Zero hardcode. Architecture flow visualization ada di TabArchitecture (terpisah).
 */

import { CheckCircle2, XCircle, Clock, Server, Rss } from 'lucide-react';
import { ServiceSection, ServiceGrid } from '../../_components/service-ui';
import { fmtWIB, fmtAgo, fmtMs } from '../_lib/api';
import { resolveProviders, resolveCounters } from '../_lib/selectors';
import type { DispatchConfig } from '../_lib/types';
import { InfoHeader, ProviderCard } from './primitives';
import { getTabDef } from '../_config/tabs';
import type { ProviderStatusMap } from '../_hooks/useProviderStatus';

interface Props {
    config: DispatchConfig;
    providerStatuses: ProviderStatusMap;
}

export default function TabStatus({ config, providerStatuses }: Props) {
    const tabDef = getTabDef('status');
    const { primary, secondary } = resolveProviders(config);
    const counters = resolveCounters(config);
    const lastStatus = config.lastStatus;

    const primaryStatus = primary === 'wagate' ? providerStatuses.wagate : null;
    const secondaryStatus = secondary === 'wagate' ? providerStatuses.wagate : null;

    return (
        <div className="space-y-5">
            <InfoHeader title={tabDef.label} domain={tabDef.domain} />

            {/* Provider cards — Primary (sole outbound) + Telegram (future fallback).
                Post WAHA archive 2026-04-21: single-provider mode, no Secondary. */}
            <div className={`grid grid-cols-1 gap-4 ${secondary !== '—' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <ProviderCard
                    role="primary"
                    name={primary}
                    status={primaryStatus?.status}
                    bot={primaryStatus?.bot ?? null}
                    connected={!!primaryStatus?.connected}
                    channel="WhatsApp"
                />
                {secondary !== '—' && (
                    <ProviderCard
                        role="secondary"
                        name={secondary}
                        status={secondaryStatus?.status}
                        bot={secondaryStatus?.bot ?? null}
                        connected={!!secondaryStatus?.connected}
                        channel="WhatsApp"
                    />
                )}
                <ProviderCard
                    role="future"
                    name="telegram"
                    status="frozen"
                    channel="Telegram Bot API"
                    note="Channel future — belum aktif. Planning: lihat docs/TELEGRAM_IMPLEMENTATION_PLAN.md"
                />
            </div>

            {/* Counter row — Today + Lifetime */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="ds-label uppercase tracking-wider">Today</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="ds-label">Delivered</div>
                            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">{counters.deliveredToday}</div>
                        </div>
                        <div>
                            <div className="ds-label">Failed</div>
                            <div className="text-xl font-bold font-mono tabular-nums text-red-400">{counters.failedToday}</div>
                        </div>
                    </div>
                    <div className="ds-small mt-2 pt-2 border-t border-border/30">Reset: {counters.resetDate}</div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="ds-label uppercase tracking-wider">Lifetime</span>
                    </div>
                    <div className="space-y-1.5">
                        <div className="ds-label">Total Delivery</div>
                        <div className="text-xl font-bold font-mono tabular-nums">{counters.lifetime}</div>
                        <div className="ds-small pt-1 border-t border-border/30">
                            Groups: <span className="font-mono">{Object.keys(config.groups || {}).length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Last Delivery */}
            <ServiceSection
                title="Last Delivery"
                icon={lastStatus === 'failed' ? <XCircle className="h-4 w-4 text-red-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                badge={lastStatus || 'n/a'}
                badgeColor={
                    lastStatus === 'delivered' ? 'bg-emerald-500/10 text-emerald-400' :
                    lastStatus === 'failed' ? 'bg-red-500/10 text-red-400' :
                    lastStatus === 'skipped' ? 'bg-slate-500/10 text-slate-400' :
                    lastStatus === 'dropped' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-muted text-muted-foreground'
                }
                id="last-delivery"
            >
                <ServiceGrid items={[
                    { label: 'Group', value: config.LAST_DELIVERY_GROUP || '—' },
                    { label: 'Type', value: config.LAST_DELIVERY_TYPE || '—' },
                    { label: 'Status', value: config.LAST_DELIVERY_STATUS || '—' },
                    { label: 'Duration', value: fmtMs(config.lastDurationMs) },
                    { label: 'Last Run', value: `${fmtWIB(config.lastRun)} (${fmtAgo(config.lastRun)})` },
                    { label: 'Error', value: config.LAST_DELIVERY_ERROR || '—', highlight: config.LAST_DELIVERY_ERROR ? 'amber' : undefined },
                ]} />
            </ServiceSection>

            <ServiceSection
                title="Infrastructure"
                icon={<Server className="h-4 w-4 text-muted-foreground/60" />}
                badge={config.infra_type || 'unknown'}
                id="infra"
            >
                <ServiceGrid items={[
                    { label: 'Service', value: config.infra_service_name || '—' },
                    { label: 'Revision', value: config.infra_revision || '—' },
                    { label: 'Region', value: config.infra_region || '—' },
                    { label: 'CPU', value: config.infra_cpu || '—' },
                    { label: 'Memory', value: config.infra_memory || '—' },
                    { label: 'Timeout', value: config.infra_timeout || '—' },
                    { label: 'Concurrency', value: String(config.infra_concurrency ?? '—') },
                    { label: 'Min/Max Instances', value: `${config.infra_min_instances ?? 0} / ${config.infra_max_instances ?? '—'}` },
                    { label: 'Runtime', value: config.infra_runtime || '—' },
                    { label: 'Ingress', value: config.infra_ingress || '—' },
                    { label: 'Cold Start', value: `${fmtWIB(config.infra_cold_start_at)} (${fmtAgo(config.infra_cold_start_at)})` },
                    { label: 'Last Deploy', value: fmtWIB(config.infra_last_deploy) },
                ]} />
            </ServiceSection>

            <ServiceSection
                title="Pub/Sub"
                icon={<Rss className="h-4 w-4 text-muted-foreground/60" />}
                badge={config.pubsub_type || '—'}
                id="pubsub"
            >
                <ServiceGrid items={[
                    { label: 'Topic', value: config.pubsub_topic || '—' },
                    { label: 'Subscription', value: config.pubsub_subscription || '—' },
                    { label: 'Type', value: config.pubsub_type || '—' },
                    { label: 'Push Endpoint', value: config.pubsub_push_endpoint || '—' },
                    { label: 'ACK Deadline', value: config.pubsub_ack_deadline ? `${config.pubsub_ack_deadline}s` : '—' },
                    { label: 'Retry Min', value: config.pubsub_retry_min_backoff || '—' },
                    { label: 'Retry Max', value: config.pubsub_retry_max_backoff || '—' },
                    { label: 'DLQ Topic', value: config.pubsub_dlq_topic || '—' },
                    { label: 'Max Delivery', value: String(config.pubsub_max_delivery ?? '—') },
                ]} />
            </ServiceSection>
        </div>
    );
}
