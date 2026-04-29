"use client";

/**
 * ProviderCard — unified card buat display info provider (WaGate / WAHA / Telegram).
 *
 * Varian "role":
 *   - primary   → border primary + badge IN USE
 *   - secondary → border muted + badge STANDBY
 *   - future    → border dashed + badge FUTURE (Telegram etc)
 *
 * Data dari props — component TIDAK panggil API sendiri. Parent yang handle fetching.
 * Zero hardcode capability/bot info — semua from props.
 */

import { Radio } from 'lucide-react';
import { StatusDot } from './StatusDot';

export type ProviderRole = 'primary' | 'secondary' | 'future';

interface Props {
    role: ProviderRole;
    name: string;
    /** Session status string from provider.getStatus() — e.g. "WORKING", "CONNECTING", "LOGGED_OUT" */
    status?: string;
    /** Bot identity from provider (fetch live, bukan dari FS snapshot yang bisa stale) */
    bot?: { name?: string; phone?: string } | null;
    /** Apakah Gateway aktif & connected ke WA server */
    connected?: boolean;
    /** Channel target — "WhatsApp", "Telegram" dll */
    channel: string;
    /** Capabilities array dari provider (e.g. ["text", "image", "pdf"]) — kosong = tidak dikenal */
    capabilities?: string[];
    /** Optional footer note — rendered kalau ada. Bukan hardcode, dari provider/config. */
    note?: string;
    /** Uptime container dalam detik — dari provider status.extra.uptime_sec. Null = tidak tersedia. */
    uptimeSec?: number | null;
}

const ROLE_STYLES: Record<ProviderRole, { border: string; bg: string; badge: string; badgeText: string; dotVariant: Parameters<typeof StatusDot>[0]['variant'] }> = {
    primary: {
        border: 'border-primary/40',
        bg: 'bg-primary/5',
        badge: 'border-primary/50 bg-primary/10 text-primary',
        badgeText: 'IN USE',
        dotVariant: 'online',
    },
    secondary: {
        border: 'border-border/50',
        bg: 'bg-muted/5',
        badge: 'border-border/50 bg-muted/20 text-muted-foreground',
        badgeText: 'STANDBY',
        dotVariant: 'standby',
    },
    future: {
        border: 'border-dashed border-border/40',
        bg: 'bg-muted/5',
        badge: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
        badgeText: 'FUTURE',
        dotVariant: 'unknown',
    },
};

/** Map raw session status → label Indonesian yang readable */
function translateStatus(raw?: string): string {
    if (!raw) return '—';
    const map: Record<string, string> = {
        WORKING: 'Terhubung',
        CONNECTING: 'Menyambung',
        RECONNECTING: 'Menyambung ulang',
        FAILED: 'Gagal',
        LOGGED_OUT: 'Logout',
        STARTING: 'Booting',
        SCAN_QR_CODE: 'Butuh scan QR',
    };
    return map[raw.toUpperCase()] || raw;
}

/** Derive runtime state dari uptime — tampilkan warm/cold/just-booted jelas */
function deriveRuntime(uptimeSec?: number | null): { label: string; tone: 'ok' | 'warn' | 'muted' } | null {
    if (uptimeSec === null || uptimeSec === undefined) return null;
    if (uptimeSec < 30) return { label: 'baru boot', tone: 'warn' };
    if (uptimeSec < 300) return { label: 'warming up', tone: 'warn' };
    return { label: 'warm', tone: 'ok' };
}

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}d`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm > 0 ? `${h}j ${mm}m` : `${h}j`;
}

const RUNTIME_TONE = {
    ok: 'bg-emerald-500/10 text-emerald-400',
    warn: 'bg-amber-500/10 text-amber-400',
    muted: 'bg-muted/30 text-muted-foreground',
} as const;

export function ProviderCard({ role, name, status, bot, connected, channel, capabilities, note, uptimeSec }: Props) {
    const s = ROLE_STYLES[role];
    const dotVariant: Parameters<typeof StatusDot>[0]['variant'] =
        role === 'future' ? 'unknown'
        : connected ? 'online'
        : role === 'secondary' ? 'standby'
        : 'offline';

    const runtime = deriveRuntime(uptimeSec);

    return (
        <div className={`rounded-lg border ${s.border} ${s.bg} p-4 ${role === 'future' ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Radio className={`h-3.5 w-3.5 ${role === 'primary' ? 'text-primary' : 'text-muted-foreground/60'}`} />
                    <span className={`ds-label uppercase tracking-wider ${role === 'primary' ? 'text-primary' : ''}`}>
                        {role === 'primary' ? 'Primary' : role === 'secondary' ? 'Secondary' : 'Future'}
                    </span>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${s.badge}`}>
                    {s.badgeText}
                </span>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-foreground uppercase">{name}</span>
                    <StatusDot variant={dotVariant} title={connected ? 'Connected' : 'Not connected'} />
                    {status && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground/80 uppercase tracking-wide">
                            {translateStatus(status)}
                        </span>
                    )}
                    {runtime && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${RUNTIME_TONE[runtime.tone]}`}>
                            {runtime.label}
                        </span>
                    )}
                </div>
                <div className="space-y-0.5">
                    <div className="ds-label">Bot: <span className="ds-small">{bot?.name || '—'}</span></div>
                    <div className="ds-label">Phone: <span className="ds-small font-mono">{bot?.phone || '—'}</span></div>
                    <div className="ds-label">Channel: <span className="ds-small">{channel}</span></div>
                    {typeof uptimeSec === 'number' && uptimeSec > 0 && (
                        <div className="ds-label">Uptime: <span className="ds-small font-mono">{formatUptime(uptimeSec)}</span></div>
                    )}
                    {capabilities && capabilities.length > 0 && (
                        <div className="ds-label">Capability: <span className="ds-small">{capabilities.join(', ')}</span></div>
                    )}
                </div>
                {note && <div className="ds-small text-muted-foreground/60 pt-2 border-t border-border/20">{note}</div>}
            </div>
        </div>
    );
}
