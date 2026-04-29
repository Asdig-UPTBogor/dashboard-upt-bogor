"use client";

/**
 * Tab Session Control — QR pairing + restart + logout.
 * Priority tab — user scan QR dari sini.
 * Shadcn: Button, Card, Badge, Alert. Typography: ds-* only.
 */

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
    QrCode, RefreshCw, Power, LogOut, CheckCircle2, XCircle, AlertCircle,
    Smartphone, Loader2, Zap, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    getWagateQr, getWagateStatus, restartWagate, logoutWagate, fmtDuration,
    requestWagatePairingCode, type WaGatePairingCode, pingWagate,
} from '../_lib/api';
import type { WaGateConfig, WaGateQr, WaGateStatus } from '../_lib/types';
import { POLL_INTERVAL_MS, RESTART_REFRESH_DELAY_MS } from '../_lib/constants';

function fmtAgoShort(d: Date): string {
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
}

function TabSessionImpl({
    config, showFeedback,
}: {
    config: WaGateConfig;
    showFeedback: (msg: string, ok: boolean) => void;
}) {
    const botPhone = ((config as unknown as { bot_identity?: { phone?: string } })?.bot_identity?.phone) || '628xxxxxxxxxx';
    const botPushName = ((config as unknown as { bot_identity?: { push_name?: string } })?.bot_identity?.push_name) || 'bot';
    const [liveStatus, setLiveStatus] = useState<WaGateStatus | null>(null);
    const [qrData, setQrData] = useState<WaGateQr | null>(null);
    const [loading, setLoading] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    // No hardcode — populate from Firestore bot_identity via config prop
    const [pairingPhone, setPairingPhone] = useState<string>(
        (config as { bot_identity?: { phone?: string } })?.bot_identity?.phone || ''
    );
    const [pairingCode, setPairingCode] = useState<WaGatePairingCode | null>(null);
    const [requestingPairCode, setRequestingPairCode] = useState(false);
    const [pinging, setPinging] = useState(false);
    const [lastPing, setLastPing] = useState<{ at: Date; latencyMs: number; wasColdStart: boolean } | null>(null);
    const [keepAliveOn, setKeepAliveOn] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const result = await getWagateStatus();
            setLiveStatus(result);
            return result;
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Status fetch failed', false);
            return null;
        }
    }, [showFeedback]);

    const refreshQr = useCallback(async (currentStatus?: string) => {
        // Skip fetch kalau session sudah WORKING — QR tidak diperlukan (avoid 409/502 spam console)
        if (currentStatus === 'WORKING' || currentStatus === 'LOGGED_OUT') {
            setQrData(null);
            return null;
        }
        try {
            const result = await getWagateQr();
            setQrData(result);
            return result;
        } catch (err) {
            console.debug('[TabSession] QR refresh failed (transient, session may be transitioning):', err);
            setQrData(null);
            return null;
        }
    }, []);

    const refreshAll = useCallback(async () => {
        setLoading(true);
        try {
            const statusResult = await refreshStatus();
            // Fetch QR hanya kalau status bukan WORKING (menghindari 502 spam)
            await refreshQr(statusResult?.status);
        } finally {
            setLoading(false);
        }
    }, [refreshStatus, refreshQr]);

    useEffect(() => { refreshAll(); }, [refreshAll]);

    // Jitter fix 2026-04-19: cabut polling 3s. Header dapat realtime dari Firestore (page.tsx
    // pakai useFirestoreConfig — provider_snapshot update lewat FS snapshot). LIVE fetch hanya
    // saat session BELUM paired (untuk QR regen tiap 15s — QR expires 60s jadi cukup).
    // Kalau status WORKING/LOGGED_OUT: no polling sama sekali.
    const currentStatus = liveStatus?.status;
    useEffect(() => {
        const needQrRegen = currentStatus && currentStatus !== 'WORKING' && currentStatus !== 'LOGGED_OUT' && currentStatus !== 'FAILED';
        if (needQrRegen && !pollRef.current) {
            pollRef.current = setInterval(async () => {
                // P1-2 fix: fetch fresh status lalu refresh QR dengan status baru (bukan
                // currentStatus yang captured di closure — bisa stale pas transition CONNECTING→RECONNECTING)
                const freshResult = await refreshStatus();
                await refreshQr(freshResult?.status);
            }, POLL_INTERVAL_MS.SESSION_STATUS);
        } else if (!needQrRegen && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [currentStatus, refreshStatus, refreshQr]);

    async function handleRestart() {
        if (!confirm('Restart WaGate session? Koneksi WebSocket akan reconnect, pesan yang antri bisa tertunda ~10 detik.')) return;
        setRestarting(true);
        try {
            await restartWagate();
            showFeedback('Restart dipicu — tunggu 5-10 detik untuk reconnect', true);
            setTimeout(refreshAll, RESTART_REFRESH_DELAY_MS);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Restart failed', false);
        } finally {
            setRestarting(false);
        }
    }

    async function handleLogout() {
        if (!confirm('Logout session + clear auth state? User harus scan QR ulang.\n\nPERINGATAN: Bot akan offline sampai scan ulang dilakukan.')) return;
        setLoggingOut(true);
        try {
            await logoutWagate();
            showFeedback('Logged out — auth state cleared, scan QR ulang untuk reconnect', true);
            setPairingCode(null);
            setTimeout(refreshAll, 3000);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Logout failed', false);
        } finally {
            setLoggingOut(false);
        }
    }

    const handlePing = useCallback(async (silent = false) => {
        setPinging(true);
        try {
            const result = await pingWagate();
            setLastPing({ at: new Date(), latencyMs: result.latencyMs, wasColdStart: result.wasColdStart });
            if (!silent) {
                const msg = result.wasColdStart
                    ? `Bangun dari sleep — cold start ${(result.latencyMs / 1000).toFixed(1)}s`
                    : `Sudah aktif — respons ${result.latencyMs}ms`;
                showFeedback(msg, true);
            }
            refreshAll();
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Ping failed', false);
        } finally {
            setPinging(false);
        }
    }, [showFeedback, refreshAll]);

    // Auto keep-alive: ping tiap 5 menit saat toggle ON + tab visible
    useEffect(() => {
        if (!keepAliveOn) {
            if (keepAliveRef.current) {
                clearInterval(keepAliveRef.current);
                keepAliveRef.current = null;
            }
            return;
        }
        const doKeepAlive = () => {
            if (document.visibilityState === 'visible') {
                handlePing(true); // silent
            }
        };
        doKeepAlive();
        keepAliveRef.current = setInterval(doKeepAlive, POLL_INTERVAL_MS.KEEP_ALIVE);
        return () => {
            if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        };
    }, [keepAliveOn, handlePing]);

    async function handleRequestPairingCode() {
        if (!/^\d{8,15}$/.test(pairingPhone.replace(/\D/g, ''))) {
            showFeedback(`Nomor HP invalid — isi digits only (e.g. ${botPhone})`, false);
            return;
        }
        setRequestingPairCode(true);
        setPairingCode(null);
        try {
            const result = await requestWagatePairingCode(pairingPhone.replace(/\D/g, ''));
            setPairingCode(result);
            showFeedback(`Pairing code generated: ${result.code}`, true);
        } catch (err) {
            showFeedback(err instanceof Error ? err.message : 'Pairing code request failed', false);
        } finally {
            setRequestingPairCode(false);
        }
    }

    const status = liveStatus?.status || 'loading';
    const isLoading = liveStatus === null;  // initial fetch belum selesai — JANGAN render conditional card yg depend on status
    const isWorking = status === 'WORKING';
    const isConnecting = status === 'CONNECTING' || status === 'RECONNECTING';
    const isFailed = status === 'FAILED';
    const isLoggedOut = status === 'LOGGED_OUT';
    const hasQr = qrData?.ok && qrData.qr;
    // QR card hanya render setelah fetch selesai DAN status bukan WORKING — prevent flash saat mount
    const showQrCard = !isLoading && !isWorking;

    const statusVariant: 'default' | 'destructive' | 'outline' | 'secondary' =
        isWorking ? 'default' :
        isFailed ? 'destructive' :
        isConnecting ? 'outline' : 'secondary';

    // Loading skeleton — initial fetch belum selesai, jangan render UI sebenarnya supaya
    // user tidak lihat flash QR card / "—" placeholders yang berubah.
    if (isLoading) {
        return (
            <div className="space-y-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full p-2.5 bg-muted/20 border border-border/30 animate-pulse">
                                <Smartphone className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 w-40 rounded bg-muted/30 animate-pulse" />
                                <div className="h-3 w-28 rounded bg-muted/20 animate-pulse" />
                            </div>
                        </div>
                        <div className="h-8 w-20 rounded bg-muted/20 animate-pulse" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="rounded-md border border-border/20 bg-muted/5 p-2.5 space-y-2">
                                    <div className="h-3 w-16 rounded bg-muted/30 animate-pulse" />
                                    <div className="h-4 w-20 rounded bg-muted/20 animate-pulse" />
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-9 w-32 rounded bg-muted/20 animate-pulse" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 text-muted-foreground/40 animate-spin mr-2" />
                    <span className="ds-small text-muted-foreground">Loading session state…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Main Session Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full p-2.5 bg-green-500/10 border border-green-500/20">
                            <Smartphone className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <CardTitle className="ds-title">WaGate</CardTitle>
                                <Badge variant={statusVariant}>{status}</Badge>
                            </div>
                            <div className="ds-small">
                                Engine: {liveStatus?.engine?.engine || 'BAILEYS'} {liveStatus?.engine?.version || ''}
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
                        <RefreshCw className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-md border border-border/30 bg-muted/10 p-2.5">
                            <div className="ds-label text-muted-foreground">WS Connected</div>
                            <div className={`ds-data ${liveStatus?.ws_connected ? 'text-emerald-400' : 'text-red-400'}`}>
                                {liveStatus?.ws_connected ? 'Yes' : 'No'}
                            </div>
                        </div>
                        <div className="rounded-md border border-border/30 bg-muted/10 p-2.5">
                            <div className="ds-label text-muted-foreground">Uptime</div>
                            <div className="ds-data">{fmtDuration(liveStatus?.uptime_sec)}</div>
                        </div>
                        <div className="rounded-md border border-border/30 bg-muted/10 p-2.5">
                            <div className="ds-label text-muted-foreground">Reconnects</div>
                            <div className="ds-data">{liveStatus?.reconnect_count ?? '—'}</div>
                        </div>
                        <div className="rounded-md border border-border/30 bg-muted/10 p-2.5">
                            <div className="ds-label text-muted-foreground">Bot Phone</div>
                            <div className="ds-data truncate">
                                {liveStatus?.me?.id?.split('@')[0]?.split(':')[0] || '—'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePing(false)}
                            disabled={pinging}
                            className="bg-blue-500/90 hover:bg-blue-500 text-white"
                            title="Ping /ping endpoint → bangunin WaGate kalau tidur + ukur latency realtime. Hasil dicatat ke Firestore untuk persist display next open."
                        >
                            {pinging ? <Loader2 className="animate-spin" /> : <Zap />}
                            {pinging ? 'Waking…' : 'Ping / Wake + Measure'}
                        </Button>
                        <Button
                            variant={keepAliveOn ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setKeepAliveOn((v) => !v)}
                            className={keepAliveOn ? 'bg-emerald-500/90 hover:bg-emerald-500 text-white' : ''}
                            title={keepAliveOn
                                ? 'Inbound Mode aktif: bot ping /ping tiap 5 menit selagi tab visible → WaGate nggak tidur → siap terima pesan inbound 24/7 (kalau tab tetap buka). Cost naik ~Rp 60k/bln.'
                                : 'Inbound Mode OFF: bot tidur saat idle 15 menit. Pesan inbound yang masuk saat tidur akan di-queue di sisi WA, deliver saat bot bangun (delay beberapa detik).'}
                        >
                            <Clock className={keepAliveOn ? 'animate-pulse' : ''} />
                            {keepAliveOn ? 'Inbound Mode ON (keep-alive 5m)' : 'Inbound Mode OFF'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRestart}
                            disabled={restarting}
                            className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                        >
                            {restarting ? <Loader2 className="animate-spin" /> : <Power />}
                            {restarting ? 'Restarting…' : 'Restart Session'}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                            {loggingOut ? 'Logging out…' : 'Logout & Re-pair'}
                        </Button>
                    </div>

                    {/* Metrics dari FS persistent (last_ping_*) + cold start duration */}
                    {(() => {
                        const snap = (config as { provider_snapshot?: Record<string, unknown> })?.provider_snapshot || {};
                        const fsLastPingAt = snap.last_ping_at as string | undefined;
                        const fsLastPingMs = snap.last_ping_latency_ms as number | undefined;
                        const fsLastPingCold = snap.last_ping_was_cold as boolean | undefined;
                        const fsColdStartDuration = snap.last_cold_start_duration_ms as number | undefined;
                        const fsColdStartAt = snap.last_cold_start_at as string | undefined;
                        // Prefer client-measured (just pinged) over FS-persisted
                        const pingMs = lastPing?.latencyMs ?? fsLastPingMs;
                        const pingCold = lastPing?.wasColdStart ?? fsLastPingCold;
                        const pingAt = lastPing?.at ?? (fsLastPingAt ? new Date(fsLastPingAt) : null);
                        if (pingMs === undefined) return null;
                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {/* Last ping card */}
                                <div className="rounded-md border border-border/30 bg-muted/10 p-3 flex items-center gap-3">
                                    <div className={`h-2.5 w-2.5 rounded-full ${pingCold ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                                    <div className="flex-1">
                                        <div className="ds-label text-muted-foreground">Last ping</div>
                                        <div className="ds-data text-base">{pingMs}ms {pingCold ? <span className="ds-small text-amber-400">(cold)</span> : <span className="ds-small text-emerald-400">(warm)</span>}</div>
                                        {pingAt && <div className="ds-small text-muted-foreground">{fmtAgoShort(pingAt)}</div>}
                                    </div>
                                </div>
                                {/* Cold start duration card */}
                                {fsColdStartDuration !== undefined && (
                                    <div className="rounded-md border border-border/30 bg-muted/10 p-3 flex items-center gap-3">
                                        <Zap className="h-4 w-4 text-amber-400" />
                                        <div className="flex-1">
                                            <div className="ds-label text-muted-foreground">Last cold start</div>
                                            <div className="ds-data text-base">{(fsColdStartDuration / 1000).toFixed(1)}s</div>
                                            {fsColdStartAt && <div className="ds-small text-muted-foreground">{fmtAgoShort(new Date(fsColdStartAt))}</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>

            {/* QR Pairing Card — only when loaded AND not WORKING (prevent flash saat mount) */}
            {showQrCard && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-blue-400" />
                            <CardTitle className="ds-title">Pairing QR</CardTitle>
                            {hasQr && (
                                <span className="ml-auto ds-small">
                                    Expires {qrData.expires_in_sec || 60}s · auto-refresh 15s
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {hasQr ? (
                            <div className="flex flex-col md:flex-row items-start gap-5">
                                <div className="rounded-lg border-2 border-white/80 bg-white p-3 shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={qrData.qr} alt="WaGate pairing QR code" width={280} height={280} />
                                </div>
                                <div className="space-y-3 max-w-md">
                                    <div>
                                        <div className="ds-label uppercase tracking-wider mb-1 text-muted-foreground">Cara scan</div>
                                        <ol className="list-decimal ml-5 space-y-1 ds-body">
                                            <li>Buka WhatsApp di HP bot <span className="ds-data">{botPushName}</span> (<span className="ds-data inline">{botPhone}</span>)</li>
                                            <li>Settings → Linked Devices → Link a Device</li>
                                            <li>Scan QR di atas</li>
                                            <li>Tunggu status berubah ke <span className="text-emerald-400 ds-label">WORKING</span></li>
                                        </ol>
                                    </div>
                                    <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-500 [&_svg]:text-amber-500">
                                        <AlertCircle />
                                        <AlertDescription className="ds-small text-amber-500/90">
                                            QR expires 60s — kalau telat, auto-regenerate tiap 15s.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </div>
                        ) : isLoggedOut ? (
                            <EmptyState icon={<LogOut className="h-10 w-10 text-muted-foreground/40" />}
                                title="Session Logged Out"
                                description="Klik Restart Session untuk generate QR baru." />
                        ) : isFailed ? (
                            <EmptyState icon={<XCircle className="h-10 w-10 text-red-400/60" />}
                                title="Session Failed"
                                description="Max reconnect attempts reached. Klik Restart untuk mulai ulang."
                                tone="error" />
                        ) : (
                            <EmptyState icon={<RefreshCw className="h-10 w-10 text-muted-foreground/40 animate-spin" />}
                                title="Waiting for QR…"
                                description="Baileys sedang inisialisasi handshake WhatsApp" />
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Pairing Code via Phone Number — alternative to QR (same gate as QR card) */}
            {showQrCard && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-purple-400" />
                            <CardTitle className="ds-title">Pair via Phone Number</CardTitle>
                            <span className="ml-auto ds-small text-muted-foreground">Alternative to QR</span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-col md:flex-row gap-2">
                            <input
                                type="text"
                                value={pairingPhone}
                                onChange={(e) => setPairingPhone(e.target.value)}
                                placeholder={botPhone}
                                className="flex-1 px-3 py-2 rounded-md border border-border/50 bg-muted/10 ds-body"
                                disabled={requestingPairCode}
                            />
                            <Button
                                onClick={handleRequestPairingCode}
                                disabled={requestingPairCode || !pairingPhone.trim()}
                                className="shrink-0"
                            >
                                {requestingPairCode ? <Loader2 className="animate-spin" /> : <Smartphone />}
                                {requestingPairCode ? 'Requesting…' : 'Request Pairing Code'}
                            </Button>
                        </div>

                        {pairingCode && (
                            <Alert className="border-purple-500/30 bg-purple-500/5">
                                <CheckCircle2 className="text-purple-400" />
                                <AlertDescription className="space-y-2">
                                    <div className="ds-label text-muted-foreground">Pairing Code (valid 60s)</div>
                                    <div className="text-3xl font-mono font-bold tracking-[0.2em] text-purple-400">
                                        {pairingCode.code.replace(/(.{4})/, '$1 ').trim()}
                                    </div>
                                    <div className="ds-small text-muted-foreground space-y-1 pt-2 border-t border-border/30">
                                        <div><strong>Cara pakai:</strong></div>
                                        <ol className="list-decimal ml-5 space-y-0.5">
                                            <li>Buka WhatsApp di HP bot ({pairingCode.phone})</li>
                                            <li>Settings → Linked Devices → Link a Device</li>
                                            <li>Tap &quot;Link with phone number instead&quot;</li>
                                            <li>Masukkan kode 8 digit di atas</li>
                                            <li>Tunggu status transition ke <span className="text-emerald-400 ds-label">WORKING</span></li>
                                        </ol>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {!pairingCode && (
                            <div className="ds-small text-muted-foreground">
                                Gunakan ini jika QR scan tidak work (kamera buram, screen glare, dll).
                                Masukkan nomor HP bot (digits only) → server generate kode 8-char.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Working State */}
            {isWorking && liveStatus?.me && (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <div>
                                <CardTitle className="ds-title text-emerald-400">Connected</CardTitle>
                                <div className="ds-small">Session paired + WebSocket live</div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <div className="ds-label text-muted-foreground">Bot ID</div>
                                <div className="ds-data">{liveStatus.me.id}</div>
                            </div>
                            <div>
                                <div className="ds-label text-muted-foreground">Push Name</div>
                                <div className="ds-body">{liveStatus.me.pushName || '—'}</div>
                            </div>
                            <div>
                                <div className="ds-label text-muted-foreground">Session Start</div>
                                <div className="ds-data">
                                    {liveStatus.session_start_at ? new Date(liveStatus.session_start_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function EmptyState({ icon, title, description, tone }: {
    icon: React.ReactNode; title: string; description: string; tone?: 'error';
}) {
    return (
        <div className={`rounded-md border p-6 text-center ${tone === 'error' ? 'border-red-500/20 bg-red-500/5' : 'border-border/30 bg-muted/10'}`}>
            <div className="flex justify-center mb-3">{icon}</div>
            <div className={`ds-title ${tone === 'error' ? 'text-red-400' : 'text-muted-foreground'}`}>{title}</div>
            <div className={`ds-small mt-1 ${tone === 'error' ? 'text-red-400/70' : ''}`}>{description}</div>
        </div>
    );
}

// Wrap with memo — prevent jitter dari parent re-render saat FS snapshot fire untuk service lain.
// Config reference bisa berubah meski data WaGate tidak, jadi compare key field yang actually dipakai di FE.
const TabSession = memo(TabSessionImpl, (prev, next) => {
    // showFeedback stable via useCallback di parent — skip compare
    // Compare config fields yang actually render (shallow)
    const p = prev.config;
    const n = next.config;
    return (
        p?.bot_identity?.phone === n?.bot_identity?.phone &&
        p?.bot_identity?.push_name === n?.bot_identity?.push_name &&
        p?.provider_snapshot?.status === n?.provider_snapshot?.status &&
        p?.provider_snapshot?.ws_connected === n?.provider_snapshot?.ws_connected
    );
});

export default TabSession;
