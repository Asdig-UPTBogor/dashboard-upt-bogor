/**
 * WaGate — API helpers (Dashboard BE → Dispatch /admin/wagate/* → WaGate internal).
 * Mirror dispatch/_lib/api.ts pattern.
 */

import { CLOUD_CONSOLE_API } from '@/lib/cloud-console-api';
import type {
    AuditLogRow, DeliveryLogRow, EventLogRow, MessageLogRow,
    WaGateMe, WaGateQr, WaGateStatus, WaGateGroupInfo,
} from './types';

export const ACTIONS_API = `${CLOUD_CONSOLE_API}/services/wagate/actions`;
const CONFIG_API = `${CLOUD_CONSOLE_API}/services/wagate/config`;

async function handleResp<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data as T;
}

/* ── Config ── */

export interface WaGateReloadResult {
    ok: boolean;
    reloaded_at?: string;
    config?: Record<string, unknown>;
    error?: string;
}

/**
 * Trigger WaGate in-process config reload from Firestore. Call setelah `patchConfig()` sukses
 * supaya runtime WaGate langsung pakai value baru tanpa perlu restart container.
 */
export async function reloadWagateConfig(): Promise<WaGateReloadResult> {
    try {
        const res = await fetch(`${ACTIONS_API}/reload-config`, { method: 'POST' });
        const data = await res.json();
        return data as WaGateReloadResult;
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function patchConfig(fields: Record<string, unknown>): Promise<boolean> {
    try {
        const res = await fetch(CONFIG_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
        });
        const data = await res.json();
        return !!data.ok;
    } catch {
        return false;
    }
}

/* ── WaGate proxy (via Dispatch /admin/wagate/*) ── */

export async function getWagateStatus(): Promise<WaGateStatus> {
    const res = await fetch(`${ACTIONS_API}/status`, { method: 'POST' });
    return handleResp<WaGateStatus>(res);
}

export async function getWagateMe(): Promise<WaGateMe> {
    const res = await fetch(`${ACTIONS_API}/me`, { method: 'POST' });
    return handleResp<WaGateMe>(res);
}

export async function getWagateQr(): Promise<WaGateQr> {
    const res = await fetch(`${ACTIONS_API}/qr`, { method: 'POST' });
    return handleResp<WaGateQr>(res);
}

export interface WaGatePairingCode {
    code: string;
    phone: string;
    session: string;
    instructions: string;
    expires_in_sec: number;
}

export async function requestWagatePairingCode(phoneNumber: string): Promise<WaGatePairingCode> {
    const res = await fetch(`${ACTIONS_API}/pairing-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
    });
    return handleResp<WaGatePairingCode>(res);
}

/**
 * Ping WaGate — trigger cold start kalau min=0 sleeping.
 * Response latency indicates cold start (~10-15s) vs warm (<200ms).
 * Auto-report ke Dashboard BE (persist ke FS) supaya next mount bisa display last metric.
 */
export async function pingWagate(): Promise<{
    ok: boolean;
    latencyMs: number;
    wasColdStart: boolean;
    status?: string;
    serverUptimeMs?: number;
}> {
    const start = Date.now();
    const res = await fetch(`${ACTIONS_API}/ping`, { method: 'POST' });
    const latencyMs = Date.now() - start;
    const data = await res.json().catch(() => ({}));
    // Server returns uptime_ms — kalau <15s berarti just-booted (wasColdStart true)
    const serverUptimeMs = typeof data.uptime_ms === 'number' ? data.uptime_ms : undefined;
    const wasColdStart = (serverUptimeMs !== undefined && serverUptimeMs < 15_000) || latencyMs > 3000;

    // Fire-and-forget persist ke FS supaya data terakhir bisa dipakai mount berikutnya
    fetch(`${ACTIONS_API}/ping-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            latency_ms: latencyMs,
            was_cold_start: wasColdStart,
            server_uptime_ms: serverUptimeMs,
        }),
    }).catch(() => { /* non-fatal */ });

    return {
        ok: res.ok,
        latencyMs,
        wasColdStart,
        status: data.status,
        serverUptimeMs,
    };
}

export async function restartWagate() {
    const res = await fetch(`${ACTIONS_API}/restart`, { method: 'POST' });
    return handleResp<{ ok: true; message?: string }>(res);
}

export async function logoutWagate() {
    const res = await fetch(`${ACTIONS_API}/logout`, { method: 'POST' });
    return handleResp<{ ok: true; message?: string }>(res);
}

export interface WaGateContact {
    jid: string;
    name: string | null;
    lastSeenAt: number;
}

/** GET /api/contacts — snapshot in-memory contacts cache WaGate */
export async function getWagateContacts(): Promise<{ count: number; items: WaGateContact[] }> {
    const res = await fetch(`${ACTIONS_API}/contacts-list`, { method: 'POST' });
    const data = await res.json();
    // BE wraps array→{items,count}, object→spread. Cache handler returns {count,items}
    return {
        count: Number(data.count ?? 0),
        items: Array.isArray(data.items) ? (data.items as WaGateContact[]) : [],
    };
}

/** POST /api/checkNumberStatus — cek apakah nomor terdaftar di WhatsApp */
export async function checkWagateNumber(phone: string): Promise<{ exists: boolean; jid?: string; error?: string }> {
    try {
        const res = await fetch(`${ACTIONS_API}/check-number`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        return {
            exists: !!data.exists,
            jid: typeof data.jid === 'string' ? data.jid : undefined,
            error: !data.ok && typeof data.error === 'string' ? data.error : undefined,
        };
    } catch (err) {
        return { exists: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/** Generate signed URL untuk media GCS (preview/download di Logs tab) */
export async function getWagateMediaUrl(path: string): Promise<{ ok: boolean; url?: string; error?: string }> {
    try {
        const res = await fetch(`${ACTIONS_API}/media-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
        });
        const data = await res.json();
        return { ok: !!data.ok, url: data.url, error: data.error };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/** Architecture pipeline metrics — per-pipe status + traffic counter + last 10 events */
export interface ArchitectureMetrics {
    ok: boolean;
    generated_at: string;
    wagate: {
        status: string;
        ws_connected: boolean;
        reconnect_count: number;
    };
    pipes: Record<string, {
        status: 'healthy' | 'slow' | 'degraded' | 'down' | 'unknown';
        inbound_per_min?: number;
        outbound_per_min?: number;
        reconnect_count?: number;
        latency_ms?: number;
        success_rate_pct?: number;
        total_5m?: number;
        sent_5m?: number;
        note?: string;
    }>;
    last_events: {
        messages: Array<{
            message_id: string;
            direction: 'inbound' | 'outbound';
            from: string;
            to: string;
            preview: string;
            timestamp: string;
        }>;
        system: Array<{
            event_id: string;
            event_type: string;
            session: string;
            timestamp: string;
        }>;
    };
    event_counts_5m: Record<string, number>;
}

export async function getArchitectureMetrics(): Promise<ArchitectureMetrics | null> {
    try {
        const res = await fetch(`${ACTIONS_API}/architecture-metrics`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/** GET /api/contacts/:phone/picture — profile picture URL */
export async function getWagateProfilePicture(phone: string): Promise<{ url: string | null; error?: string }> {
    try {
        const res = await fetch(`${ACTIONS_API}/profile-picture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        return {
            url: typeof data.url === 'string' ? data.url : null,
            error: !data.ok && typeof data.error === 'string' ? data.error : undefined,
        };
    } catch (err) {
        return { url: null, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function getWagateGroups(): Promise<WaGateGroupInfo[]> {
    const res = await fetch(`${ACTIONS_API}/groups`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.groups)) return data.groups;
    return [];
}

export async function testSend(body: { chatId: string; text: string }) {
    const res = await fetch(`${ACTIONS_API}/test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return handleResp<{ ok: true; key?: { id: string } }>(res);
}

export async function sendImage(body: {
    chatId: string;
    file: { mimetype: string; data?: string; url?: string; filename?: string };
    caption?: string;
}) {
    const res = await fetch(`${ACTIONS_API}/send-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return handleResp<{ ok: true; key?: { id: string } }>(res);
}

export async function sendFile(body: {
    chatId: string;
    file: { mimetype: string; filename: string; data?: string; url?: string };
    caption?: string;
}) {
    const res = await fetch(`${ACTIONS_API}/send-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return handleResp<{ ok: true; key?: { id: string } }>(res);
}

export async function sendLocation(body: {
    chatId: string;
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
}) {
    const res = await fetch(`${ACTIONS_API}/send-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return handleResp<{ ok: true; key?: { id: string } }>(res);
}

export async function getWagateGroupInfo(chatId: string): Promise<{
    ok: boolean;
    id: string;
    subject?: string;
    description?: string;
    owner?: string;
    participants?: { id: string; is_admin: boolean }[];
    created_at?: string;
    invite_code?: string;
}> {
    const res = await fetch(`${ACTIONS_API}/group-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
    });
    return handleResp(res);
}

/* ── BQ Logs ── */

export async function fetchDeliveryLogs(params: { limit?: number; offset?: number; status?: string; operation?: string }) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.status) qs.set('status', params.status);
    if (params.operation) qs.set('operation', params.operation);
    const res = await fetch(`${ACTIONS_API}/delivery-logs?${qs.toString()}`);
    return handleResp<{ rows: DeliveryLogRow[]; total: number; limit: number; offset: number }>(res);
}

export async function fetchMessageLogs(params: { limit?: number; offset?: number; direction?: string; chat_type?: string }) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.direction) qs.set('direction', params.direction);
    if (params.chat_type) qs.set('chat_type', params.chat_type);
    const res = await fetch(`${ACTIONS_API}/message-logs?${qs.toString()}`);
    return handleResp<{ rows: MessageLogRow[]; total: number; limit: number; offset: number }>(res);
}

export async function fetchEventLogs(params: { limit?: number; offset?: number; event_type?: string }) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.event_type) qs.set('event_type', params.event_type);
    const res = await fetch(`${ACTIONS_API}/event-logs?${qs.toString()}`);
    return handleResp<{ rows: EventLogRow[]; total: number; limit: number; offset: number }>(res);
}

export async function fetchAuditLogs(params: { limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const res = await fetch(`${ACTIONS_API}/audit-logs?${qs.toString()}`);
    return handleResp<{ rows: AuditLogRow[]; total: number; limit: number; offset: number }>(res);
}

/* ── Format helpers ── */

export function fmtBool(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toUpperCase() === 'TRUE' || v === '1';
    return false;
}

export function fmtMs(ms: number | null | undefined): string {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function fmtWIB(iso: string | { value: string } | null | undefined): string {
    if (!iso) return '—';
    const s = typeof iso === 'string' ? iso : iso.value;
    if (!s) return '—';
    return new Date(s).toLocaleTimeString('en-GB', {
        hour12: false, timeZone: 'Asia/Jakarta',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

export function fmtAgo(iso: string | { value: string } | null | undefined): string {
    if (!iso) return '—';
    const s = typeof iso === 'string' ? iso : iso.value;
    if (!s) return '—';
    const d = Date.now() - new Date(s).getTime();
    if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
    return `${Math.floor(d / 86400_000)}d ago`;
}

export function fmtDuration(sec: number | null | undefined): string {
    if (sec == null) return '—';
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}
