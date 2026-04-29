"use client";

/**
 * Tab Settings — Kill switch, config display, test send form.
 * IS_ACTIVE toggle → patchConfig (Firestore merge).
 * Test send → Pub/Sub publish via Dashboard action.
 */

import { useState } from 'react';
import { Settings, Power, Send, AlertTriangle, Info } from 'lucide-react';

import { ServiceSection, ServiceGrid, DisplayField } from '../../_components/service-ui';
import { patchConfig, testSend, fmtWIB, fmtAgo } from '../_lib/api';
import type { DispatchConfig } from '../_lib/types';

export default function TabSettings({
    config, showFeedback,
}: {
    config: DispatchConfig;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    const isActive = !!config.IS_ACTIVE;
    const [toggleBusy, setToggleBusy] = useState(false);
    const [sendBusy, setSendBusy] = useState(false);

    const groupKeys = Object.keys(config.groups || {});
    const [testGroup, setTestGroup] = useState(groupKeys.includes('maintenance') ? 'maintenance' : (groupKeys[0] || ''));
    const [testText, setTestText] = useState('');

    async function handleToggleActive() {
        const next = !isActive;
        if (!next && !confirm('Matikan Dispatch? Pesan yang di-publish ke Pub/Sub akan di-ACK tapi tidak dikirim ke WA.')) return;
        setToggleBusy(true);
        try {
            const ok = await patchConfig({ IS_ACTIVE: next });
            if (ok) {
                showFeedback(`Dispatch ${next ? 'ENABLED' : 'DISABLED'}`, true);
            } else {
                showFeedback('Gagal simpan', false);
            }
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Error', false);
        } finally {
            setToggleBusy(false);
        }
    }

    async function handleTestSend() {
        if (!testGroup) {
            showFeedback('Pilih group target dulu', false);
            return;
        }
        setSendBusy(true);
        try {
            const result = await testSend({
                group: testGroup,
                text: testText.trim() || undefined,
            });
            showFeedback(`Test terkirim ke ${result.target} (event ${result.event_id})`, true);
            setTestText('');
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Test send gagal', false);
        } finally {
            setSendBusy(false);
        }
    }

    return (
        <div className="space-y-5">
            {/* Info domain */}
            <div className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/5 p-3">
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span className="ds-small text-muted-foreground/80">
                    <strong className="text-foreground/90">Tab Settings</strong> — kill switch global (pause/resume Dispatch),
                    test send dari Cloud Console, runtime config read-only. Semua persist di Firestore.
                </span>
            </div>

            {/* Kill Switch */}
            <ServiceSection
                title="Kill Switch"
                icon={<Power className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-red-400'}`} />}
                badge={isActive ? 'ACTIVE' : 'DISABLED'}
                badgeColor={isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}
                id="kill-switch"
                noCollapse
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 ds-small">
                        Saat <code className="font-mono">IS_ACTIVE=false</code>, Dispatch tetap terima pesan dari Pub/Sub tapi tidak kirim ke WA
                        (di-log sebagai <code className="font-mono">skipped</code>). Pakai untuk pause sementara tanpa decommission platform.
                    </div>
                    <button
                        onClick={handleToggleActive}
                        disabled={toggleBusy}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            isActive
                                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        } disabled:opacity-50`}
                    >
                        <Power className="h-3 w-3" />
                        {toggleBusy ? 'Saving...' : (isActive ? 'Disable Dispatch' : 'Enable Dispatch')}
                    </button>
                </div>
            </ServiceSection>

            {/* Test Send */}
            <ServiceSection
                title="Test Send"
                icon={<Send className="h-4 w-4 text-muted-foreground/60" />}
                id="test-send"
                noCollapse
            >
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="ds-label mb-1 block">Target Group</label>
                            <select
                                value={testGroup}
                                onChange={(e) => setTestGroup(e.target.value)}
                                className="w-full h-8 px-2 text-[12px] rounded-md border border-border/50 bg-muted/20 focus-visible:outline-none focus-visible:border-blue-500/50"
                            >
                                {groupKeys.length === 0 && <option value="">— Belum ada group —</option>}
                                {groupKeys.map((k) => {
                                    const g = config.groups?.[k];
                                    return (
                                        <option key={k} value={k}>
                                            {k} {g?.wa_group_name ? `— ${g.wa_group_name}` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="ds-label mb-1 block">Message (opsional — kosongkan = default)</label>
                            <input
                                type="text"
                                value={testText}
                                onChange={(e) => setTestText(e.target.value)}
                                placeholder="🧪 Test Dispatch dari Cloud Console..."
                                className="w-full h-8 px-2 text-[12px] rounded-md border border-border/50 bg-muted/20 focus-visible:outline-none focus-visible:border-blue-500/50"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="ds-small">
                            Flow: Dashboard → Pub/Sub
                            <code className="font-mono bg-muted/30 px-1 mx-1 rounded">
                                {(config as unknown as { pubsub_topic?: string }).pubsub_topic || '—'}
                            </code>
                            → Dispatch → Gateway aktif → tujuan.
                        </span>
                        <button
                            onClick={handleTestSend}
                            disabled={sendBusy || !testGroup || !isActive}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50"
                            title={!isActive ? 'Dispatch harus ACTIVE untuk test send' : ''}
                        >
                            <Send className="h-3 w-3" />
                            {sendBusy ? 'Sending...' : 'Send Test'}
                        </button>
                    </div>
                    {!isActive && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-400">
                                Dispatch DISABLED — pesan akan di-publish tapi di-ACK sebagai skipped, tidak sampai WA.
                            </span>
                        </div>
                    )}
                </div>
            </ServiceSection>

            {/* Runtime Config (read-only) */}
            <ServiceSection
                title="Runtime Config"
                icon={<Settings className="h-4 w-4 text-muted-foreground/60" />}
                id="runtime"
            >
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DisplayField label="IS_ACTIVE" value={String(isActive)} color={isActive ? 'text-emerald-400' : 'text-red-400'} />
                        <DisplayField
                            label="PRIMARY_PROVIDER"
                            value={(config as unknown as { PRIMARY_PROVIDER?: string }).PRIMARY_PROVIDER || config.ACTIVE_PROVIDER || '—'}
                        />
                        <DisplayField
                            label="SECONDARY_PROVIDER"
                            value={(config as unknown as { SECONDARY_PROVIDER?: string }).SECONDARY_PROVIDER || '—'}
                        />
                        <DisplayField label="ACTIVE_PROVIDER (legacy)" value={config.ACTIVE_PROVIDER || '—'} />
                        <DisplayField label="WAHA_API_URL" value={config.WAHA_API_URL || '—'} />
                        <DisplayField label="WAHA_SESSION" value={config.WAHA_SESSION || 'default'} />
                        <DisplayField
                            label="WAGATE_API_URL"
                            value={(config as unknown as { WAGATE_API_URL?: string }).WAGATE_API_URL || '—'}
                        />
                        <DisplayField
                            label="WAGATE_SESSION"
                            value={(config as unknown as { WAGATE_SESSION?: string }).WAGATE_SESSION || 'default'}
                        />
                    </div>

                    <ServiceGrid items={[
                        { label: 'Groups Count', value: String(Object.keys(config.groups || {}).length) },
                        { label: 'Lifetime Delivery', value: String(config._delivery_count ?? 0) },
                        { label: 'Daily Reset', value: config._daily_reset_date || '—' },
                        { label: 'Last Run', value: `${fmtWIB(config.lastRun)} (${fmtAgo(config.lastRun)})` },
                    ]} />

                    <div className="ds-small text-muted-foreground/60">
                        Config ini disimpan di Firestore{' '}
                        <code className="font-mono bg-muted/30 px-1 py-0.5 rounded">service_runtime_configs/dispatch</code>.
                        Edit group ada di tab Groups, edit provider ada di tab Provider.
                    </div>
                </div>
            </ServiceSection>
        </div>
    );
}
