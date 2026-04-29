"use client";

/**
 * Tab Provider — Single-provider view (WaGate) + Telegram future placeholder.
 *
 * Post WAHA archive 2026-04-21: cuma WaGate aktif. Swap button hidden sampai
 * Telegram provider ready (lihat docs/TELEGRAM_IMPLEMENTATION_PLAN.md).
 */

import { useState, useCallback, useEffect, memo } from 'react';
import {
    Radio, RefreshCw, Power, AlertCircle, Smartphone, Loader2,
} from 'lucide-react';
import {
    getWagateStatus, restartWagate, fmtAgo,
} from '../_lib/api';
import type { DispatchConfig, WahaStatus } from '../_lib/types';
import { InfoHeader } from './primitives';
import { getTabDef } from '../_config/tabs';

interface ProviderCardProps {
    name: string;
    isPrimary: boolean;
    status: WahaStatus | null;
    loading: boolean;
    onRefresh: () => void;
    onRestart: () => void;
    restarting: boolean;
    icon: React.ReactNode;
    colorClass: string;
}

function ProviderCard(p: ProviderCardProps) {
    const isWorking = p.status?.status === 'WORKING';
    const statusColor =
        isWorking ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
        p.status?.status === 'STARTING' || p.status?.status === 'CONNECTING' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
        p.status?.status === 'SCAN_QR_CODE' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' :
        'text-red-400 bg-red-500/10 border-red-500/30';

    return (
        <div className={`rounded-lg border-2 p-5 transition-all ${
            p.isPrimary ? 'border-primary/60 bg-primary/5 shadow-[0_0_20px_rgba(99,102,241,0.15)]' :
            'border-border/30 bg-background'
        }`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2.5 ${p.colorClass}`}>
                        {p.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-bold">{p.name}</span>
                            {p.isPrimary && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-primary/50 bg-primary/10 text-primary">
                                    PRIMARY
                                </span>
                            )}
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${statusColor}`}>
                                {p.status?.status || 'loading...'}
                            </span>
                        </div>
                        <div className="ds-small mt-1">
                            Menangani semua outbound. Baileys WS persistent, min=0 (warm via WS keep-alive).
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={p.onRefresh}
                        disabled={p.loading}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/40 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${p.loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={p.onRestart}
                        disabled={p.restarting}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] hover:bg-amber-500/20 disabled:opacity-50"
                    >
                        <Power className={`h-3 w-3 ${p.restarting ? 'animate-pulse' : ''}`} />
                        {p.restarting ? '…' : 'Restart'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/30">
                <div>
                    <div className="ds-label">Bot</div>
                    <div className="text-sm mt-0.5">{p.status?.bot?.name || '—'}</div>
                </div>
                <div>
                    <div className="ds-label">Phone</div>
                    <div className="text-sm font-mono mt-0.5">{p.status?.bot?.phone || '—'}</div>
                </div>
            </div>
        </div>
    );
}

function TabProviderImpl({ config, showFeedback }: {
    config: DispatchConfig;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    void config; void showFeedback;
    const tabDef = getTabDef('provider');
    const [wagateStatus, setWagateStatus] = useState<WahaStatus | null>(null);
    const [loadingWagate, setLoadingWagate] = useState(false);
    const [restartingWagate, setRestartingWagate] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<string | null>(null);

    const refreshWagate = useCallback(async () => {
        setLoadingWagate(true);
        try { setWagateStatus(await getWagateStatus()); setLastRefresh(new Date().toISOString()); }
        catch { setWagateStatus(null); }
        finally { setLoadingWagate(false); }
    }, []);

    useEffect(() => { refreshWagate(); }, [refreshWagate]);

    async function handleRestart() {
        if (!confirm('Restart WaGate session? Pesan antri bisa tertunda beberapa detik.')) return;
        setRestartingWagate(true);
        try {
            await restartWagate();
            setTimeout(refreshWagate, 5000);
        } catch (err) {
            console.error('Restart failed:', err);
        } finally {
            setRestartingWagate(false);
        }
    }

    return (
        <div className="space-y-5">
            <InfoHeader title={tabDef.label} domain={tabDef.domain} />

            {/* Status Summary */}
            <div className="rounded-lg border border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="ds-title flex items-center gap-2">
                            <Radio className="h-4 w-4 text-primary" />
                            Single-provider Architecture
                        </h3>
                        <p className="ds-small mt-1">
                            WaGate handle semua outbound. Telegram fallback <span className="font-semibold">future</span> (lihat roadmap).
                            {lastRefresh && <span className="ml-2 text-muted-foreground/60">Last check: {fmtAgo(lastRefresh)}</span>}
                        </p>
                    </div>
                </div>
            </div>

            {/* WaGate Primary Card */}
            <ProviderCard
                name="WaGate"
                isPrimary={true}
                status={wagateStatus}
                loading={loadingWagate}
                onRefresh={refreshWagate}
                onRestart={handleRestart}
                restarting={restartingWagate}
                icon={<Smartphone className="h-4 w-4 text-emerald-400" />}
                colorClass="bg-emerald-500/10 border border-emerald-500/20"
            />

            {/* Telegram Future Card (placeholder) */}
            <div className="rounded-lg border-2 border-dashed border-border/40 bg-muted/5 p-5 opacity-70">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full p-2.5 bg-sky-500/10 border border-sky-500/20">
                            <Radio className="h-4 w-4 text-sky-400/70" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg font-bold text-foreground/80">Telegram</span>
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400">
                                    FUTURE
                                </span>
                            </div>
                            <div className="ds-small mt-1">
                                Channel future — akan jadi SECONDARY fallback saat implementasi ready. Diversity teknologi (bukan sama-sama WA base).
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info footer */}
            <div className="rounded-md border border-blue-500/10 bg-blue-500/5 p-3 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="ds-small text-blue-300/80 leading-relaxed">
                    <strong>Arsitektur sekarang:</strong> single-provider WaGate (Baileys). WAHA archived 2026-04-21 untuk clean architecture.
                    <br />
                    <strong>Next:</strong> Telegram provider (official Bot API) sebagai fallback beda-ekosistem — lihat roadmap di docs.
                </div>
            </div>
        </div>
    );
}

const TabProvider = memo(TabProviderImpl, (prev, next) =>
    prev.config === next.config && prev.showFeedback === next.showFeedback);
export default TabProvider;

// Reserved for future "swap pending" spinner UI (Telegram provider ready)
void Loader2;
