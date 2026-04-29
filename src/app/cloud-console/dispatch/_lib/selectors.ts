/**
 * Dispatch — Selectors
 *
 * Pure functions yang derive state dari config Firestore.
 * Tidak boleh hardcode value produksi di sini — semua dari config.
 * Pattern: input config → output value yang dipakai FE.
 */

import type { DispatchConfig } from './types';

export type ProviderKey = 'wagate' | 'waha' | 'telegram';

export interface ResolvedProviders {
    /** Provider aktif menangani outbound. Source: PRIMARY_PROVIDER, fallback ACTIVE_PROVIDER (legacy). */
    primary: ProviderKey | '—';
    /** Standby provider untuk auto-fallback. Null kalau tidak di-set. */
    secondary: ProviderKey | '—';
}

/** Resolve PRIMARY + SECONDARY dari config. Legacy field ACTIVE_PROVIDER jadi fallback. */
export function resolveProviders(config: DispatchConfig): ResolvedProviders {
    const cfg = config as unknown as {
        PRIMARY_PROVIDER?: string;
        SECONDARY_PROVIDER?: string;
    };
    return {
        primary: (cfg.PRIMARY_PROVIDER as ProviderKey) || (config.ACTIVE_PROVIDER as ProviderKey) || '—',
        secondary: (cfg.SECONDARY_PROVIDER as ProviderKey) || '—',
    };
}

/** Topic name Pub/Sub dari service-reporter (bukan hardcode). */
export function resolveTopicName(config: DispatchConfig): string {
    return (config as unknown as { pubsub_topic?: string }).pubsub_topic || '—';
}

/** Counters hari ini + lifetime. Default 0 kalau undefined. */
export function resolveCounters(config: DispatchConfig): {
    deliveredToday: number;
    failedToday: number;
    lifetime: number;
    resetDate: string;
} {
    return {
        deliveredToday: config.TOTAL_DELIVERED_TODAY ?? 0,
        failedToday: config.TOTAL_FAILED_TODAY ?? 0,
        lifetime: config._delivery_count ?? 0,
        resetDate: config._daily_reset_date || '—',
    };
}

/** Health status derived dari config — untuk color header. */
export type HealthStatus = 'healthy' | 'paused' | 'stale' | 'error';

export function resolveHealth(config: DispatchConfig): HealthStatus {
    if (!config.IS_ACTIVE) return 'paused';
    if (config.lastStatus === 'failed') return 'error';
    if (!config.provider_snapshot?.connected) return 'stale';
    return 'healthy';
}
