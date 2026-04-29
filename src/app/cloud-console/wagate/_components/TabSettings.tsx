"use client";

/**
 * Tab Settings — edit §1 config admin (Firestore service_runtime_configs/wagate).
 * Shadcn: Card, Input, Switch, Button, Alert, Label.
 * Typography: ds-* only.
 */

import { useState, useEffect, memo } from 'react';
import { Save, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { patchConfig, reloadWagateConfig } from '../_lib/api';
import type { WaGateConfig } from '../_lib/types';

function TabSettingsImpl({
    config, showFeedback,
}: {
    config: WaGateConfig;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    const [isActive, setIsActive] = useState(config.IS_ACTIVE ?? false);
    const [sessionName, setSessionName] = useState(config.SESSION_NAME ?? 'default');
    const [reconnectMax, setReconnectMax] = useState(String(config.RECONNECT_MAX_RETRY ?? 10));
    const [qrTimeoutSec, setQrTimeoutSec] = useState(String(config.QR_TIMEOUT_SEC ?? 60));
    const [wsBackoffMs, setWsBackoffMs] = useState(String(config.WS_RECONNECT_BACKOFF_MS ?? 5000));
    const [queueMaxSize, setQueueMaxSize] = useState(String(config.QUEUE_MAX_SIZE ?? 100));
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!dirty) {
            setIsActive(config.IS_ACTIVE ?? false);
            setSessionName(config.SESSION_NAME ?? 'default');
            setReconnectMax(String(config.RECONNECT_MAX_RETRY ?? 10));
            setQrTimeoutSec(String(config.QR_TIMEOUT_SEC ?? 60));
            setWsBackoffMs(String(config.WS_RECONNECT_BACKOFF_MS ?? 5000));
            setQueueMaxSize(String(config.QUEUE_MAX_SIZE ?? 100));
        }
    }, [config, dirty]);

    async function handleSave() {
        const reconnectMaxInt = parseInt(reconnectMax, 10);
        const qrTimeoutInt = parseInt(qrTimeoutSec, 10);
        const wsBackoffInt = parseInt(wsBackoffMs, 10);
        const queueMaxInt = parseInt(queueMaxSize, 10);

        if (isNaN(reconnectMaxInt) || reconnectMaxInt < 0) {
            showFeedback('RECONNECT_MAX_RETRY harus integer >= 0', false); return;
        }
        if (isNaN(qrTimeoutInt) || qrTimeoutInt < 10) {
            showFeedback('QR_TIMEOUT_SEC harus integer >= 10', false); return;
        }
        if (isNaN(wsBackoffInt) || wsBackoffInt < 1000) {
            showFeedback('WS_RECONNECT_BACKOFF_MS harus integer >= 1000', false); return;
        }
        if (isNaN(queueMaxInt) || queueMaxInt < 1) {
            showFeedback('QUEUE_MAX_SIZE harus integer >= 1', false); return;
        }
        if (!sessionName.trim()) {
            showFeedback('SESSION_NAME wajib diisi', false); return;
        }

        setSaving(true);
        try {
            const ok = await patchConfig({
                IS_ACTIVE: isActive,
                SESSION_NAME: sessionName.trim(),
                RECONNECT_MAX_RETRY: reconnectMaxInt,
                QR_TIMEOUT_SEC: qrTimeoutInt,
                WS_RECONNECT_BACKOFF_MS: wsBackoffInt,
                QUEUE_MAX_SIZE: queueMaxInt,
            });
            if (ok) {
                setDirty(false);
                // Trigger WaGate runtime reload supaya nilai baru langsung dipakai (tanpa restart container)
                const reload = await reloadWagateConfig();
                if (reload.ok) {
                    showFeedback('Konfigurasi tersimpan + runtime reloaded', true);
                } else {
                    showFeedback(`Tersimpan di FS, tapi runtime reload gagal: ${reload.error || 'unknown'}`, false);
                }
            } else {
                showFeedback('Save failed — check logs', false);
            }
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Save failed', false);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-5 max-w-3xl">
            <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-500 [&_svg]:text-emerald-500">
                <AlertCircle />
                <AlertDescription className="ds-body text-emerald-500/90">
                    Perubahan config tersimpan ke Firestore + auto-reload runtime WaGate (via <span className="ds-data inline">/api/admin/reload-config</span>). Value baru langsung aktif — tidak perlu restart container.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="ds-title">Admin Config (§1)</CardTitle>
                    <CardDescription className="ds-small">
                        Edit Firestore <span className="ds-data inline">service_runtime_configs/wagate</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* IS_ACTIVE */}
                        <div className="space-y-2">
                            <Label htmlFor="is-active" className="ds-label">IS_ACTIVE</Label>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="is-active"
                                    checked={isActive}
                                    onCheckedChange={(v) => { setIsActive(v); setDirty(true); }}
                                />
                                <span className={`ds-label ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {isActive ? 'ACTIVE' : 'DISABLED'}
                                </span>
                            </div>
                            <div className="ds-small">Gate utama. False = semua send ditolak di D1.</div>
                        </div>

                        {/* SESSION_NAME */}
                        <div className="space-y-2">
                            <Label htmlFor="session-name" className="ds-label">SESSION_NAME</Label>
                            <Input
                                id="session-name"
                                value={sessionName}
                                onChange={e => { setSessionName(e.target.value); setDirty(true); }}
                                className="font-mono"
                            />
                            <div className="ds-small">Nama session Baileys (default: &apos;default&apos;).</div>
                        </div>

                        {/* RECONNECT_MAX_RETRY */}
                        <div className="space-y-2">
                            <Label htmlFor="reconnect-max" className="ds-label">RECONNECT_MAX_RETRY</Label>
                            <Input
                                id="reconnect-max"
                                type="number"
                                min={0}
                                value={reconnectMax}
                                onChange={e => { setReconnectMax(e.target.value); setDirty(true); }}
                                className="font-mono"
                            />
                            <div className="ds-small">Max reconnect attempts sebelum FAILED.</div>
                        </div>

                        {/* QR_TIMEOUT_SEC */}
                        <div className="space-y-2">
                            <Label htmlFor="qr-timeout" className="ds-label">QR_TIMEOUT_SEC</Label>
                            <Input
                                id="qr-timeout"
                                type="number"
                                min={10}
                                value={qrTimeoutSec}
                                onChange={e => { setQrTimeoutSec(e.target.value); setDirty(true); }}
                                className="font-mono"
                            />
                            <div className="ds-small">Berapa detik QR valid (min 10).</div>
                        </div>

                        {/* WS_RECONNECT_BACKOFF_MS */}
                        <div className="space-y-2">
                            <Label htmlFor="ws-backoff" className="ds-label">WS_RECONNECT_BACKOFF_MS</Label>
                            <Input
                                id="ws-backoff"
                                type="number"
                                min={1000}
                                value={wsBackoffMs}
                                onChange={e => { setWsBackoffMs(e.target.value); setDirty(true); }}
                                className="font-mono"
                            />
                            <div className="ds-small">Base backoff reconnect (max 60s setelah dikalikan attempt).</div>
                        </div>

                        {/* QUEUE_MAX_SIZE */}
                        <div className="space-y-2">
                            <Label htmlFor="queue-max" className="ds-label">QUEUE_MAX_SIZE</Label>
                            <Input
                                id="queue-max"
                                type="number"
                                min={1}
                                value={queueMaxSize}
                                onChange={e => { setQueueMaxSize(e.target.value); setDirty(true); }}
                                className="font-mono"
                            />
                            <div className="ds-small">Max pending message di in-memory queue saat WS disconnect.</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                        <Button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"
                        >
                            {saving ? <Loader2 className="animate-spin" /> : <Save />}
                            {saving ? 'Menyimpan…' : 'Save Changes'}
                        </Button>
                        {dirty && <span className="ds-small text-amber-400">Ada perubahan belum tersimpan</span>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

const TabSettings = memo(TabSettingsImpl, (prev, next) =>
    prev.config === next.config && prev.showFeedback === next.showFeedback);
export default TabSettings;
