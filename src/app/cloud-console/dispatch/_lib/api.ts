/**
 * Dispatch — API helpers.
 * Mirror of thor-vaisala/_lib/api.ts pattern.
 */

import { CLOUD_CONSOLE_API } from '@/lib/cloud-console-api';
import type { DeliveryLogRow, EventLogRow, MessageLogRow, WahaStatus } from './types';

export const ACTIONS_API = `${CLOUD_CONSOLE_API}/services/dispatch/actions`;
const CONFIG_API = `${CLOUD_CONSOLE_API}/services/dispatch/config`;

async function handleResp<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data as T;
}

/* ── Config ── */

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

/* ── Groups CRUD ── */

export async function addGroup(groupName: string, wa_chat_id: string) {
    const res = await fetch(`${ACTIONS_API}/add-group`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, wa_chat_id }),
    });
    return handleResp<{ ok: true; message: string }>(res);
}

export async function editGroup(groupName: string, body: { wa_chat_id?: string; enabled?: boolean }) {
    const res = await fetch(`${ACTIONS_API}/edit-group`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, ...body }),
    });
    return handleResp<{ ok: true; message: string }>(res);
}

export async function deleteGroup(groupName: string) {
    const res = await fetch(`${ACTIONS_API}/delete-group`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName }),
    });
    return handleResp<{ ok: true; message: string }>(res);
}

export async function verifyGroup(groupName: string, wa_chat_id: string) {
    const res = await fetch(`${ACTIONS_API}/verify-group`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, wa_chat_id }),
    });
    return handleResp<{
        ok: true;
        message: string;
        reconciled: { wa_name: string; members: number; verified_at: string };
    }>(res);
}

/* ── Status normalization ──────────────────────────────────────
 * Dispatch admin proxy pass-through raw response dari gateway.
 * WaGate response: { status, me: {id, pushName}, ws_connected, uptime_sec, ... }
 *
 * Normalize di client supaya FE konsisten baca:
 *   - connected (bool)
 *   - bot { name, phone }
 *   - status (string uppercase)
 */
function normalizeGatewayStatus(raw: Record<string, unknown>): WahaStatus {
    const status = (raw.status as string) || 'UNKNOWN';
    const me = raw.me as { id?: string; pushName?: string } | null;
    const id = me?.id || '';
    const phone = id ? id.replace(/@.*$/, '').replace(/:.*/, '') : '';
    return {
        ...(raw as unknown as WahaStatus),
        status,
        connected: !!raw.ws_connected,
        bot: me ? { name: me.pushName || '—', phone: phone || '—' } : null,
    };
}

/* ── WaGate status (proxy via Dispatch CF /admin/wagate/*) ── */

export async function getWagateStatus(): Promise<WahaStatus> {
    const res = await fetch(`${ACTIONS_API}/wagate-status`, { method: 'POST' });
    const raw = await res.json();
    return normalizeGatewayStatus(raw);
}

export async function restartWagate() {
    const res = await fetch(`${ACTIONS_API}/wagate-restart`, { method: 'POST' });
    return handleResp<{ ok: true; message: string }>(res);
}

/* ── Provider swap (PRIMARY ↔ SECONDARY) + config reload ── */

export interface ProviderSwapResult {
    ok: boolean;
    reloaded_at?: string;
    config?: {
        PRIMARY_PROVIDER?: string;
        SECONDARY_PROVIDER?: string;
        ACTIVE_PROVIDER?: string;
        WAGATE_API_URL?: string;
        WAHA_API_URL?: string;
        IS_ACTIVE?: boolean;
    };
    error?: string;
}

export async function swapProviders(newPrimary: 'wagate' | 'waha', newSecondary: 'wagate' | 'waha'): Promise<ProviderSwapResult> {
    try {
        // Step 1: update FS. ACTIVE_PROVIDER (legacy field) di-sync sama dengan PRIMARY
        // supaya viewer FE yang masih baca field lama tidak stale.
        const ok = await patchConfig({
            PRIMARY_PROVIDER: newPrimary,
            SECONDARY_PROVIDER: newSecondary,
            ACTIVE_PROVIDER: newPrimary,
        });
        if (!ok) return { ok: false, error: 'Gagal update FS config' };
        // Step 2: trigger Dispatch reload
        const res = await fetch(`${ACTIONS_API}/reload-config`, { method: 'POST' });
        const data = await res.json();
        return { ok: !!data.ok, ...data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/* ── Test send ── */

export async function testSend(body: { group?: string; text?: string }) {
    const res = await fetch(`${ACTIONS_API}/test-send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return handleResp<{ ok: true; event_id: string; target: string; detail: string }>(res);
}

/* ── BQ Logs ── */

export async function fetchDeliveryLogs(params: { limit?: number; offset?: number; status?: string }) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.status) qs.set('status', params.status);
    const res = await fetch(`${ACTIONS_API}/delivery-logs?${qs.toString()}`);
    return handleResp<{ rows: DeliveryLogRow[]; total: number; limit: number; offset: number }>(res);
}

export async function fetchInboundLogs(params: { limit?: number; offset?: number; direction?: string; chat_type?: string }) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.direction) qs.set('direction', params.direction);
    if (params.chat_type) qs.set('chat_type', params.chat_type);
    const res = await fetch(`${ACTIONS_API}/inbound-logs?${qs.toString()}`);
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

/* ── Format helpers (shared pattern from thor-vaisala) ── */

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

export function fmtWIBDate(iso: string | { value: string } | null | undefined): string {
    if (!iso) return '—';
    const s = typeof iso === 'string' ? iso : iso.value;
    if (!s) return '—';
    return new Date(s).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', ' ');
}
