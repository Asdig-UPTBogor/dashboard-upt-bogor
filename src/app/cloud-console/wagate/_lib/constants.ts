/**
 * WaGate FE constants — pindah magic numbers dari scattered tabs.
 * Tidak hardcode data runtime (nama resource, URL, API key) — hanya UI timing + limit.
 */

/** Polling interval untuk refresh status / log / event feed */
export const POLL_INTERVAL_MS = {
    /** Status session & bot — moderate churn */
    SESSION_STATUS: 15_000,
    /** Architecture live activity feed */
    RECENT_ACTIVITY: 15_000,
    /** Logs auto-refresh (jarang, user manual refresh lebih sering) */
    LOGS: 60_000,
    /** Keep-alive ping untuk mencegah Cloud Run scale-down mid-session */
    KEEP_ALIVE: 5 * 60_000,
} as const;

/** Max file size upload Send Test — harus match server limit (WaGate Baileys WS) */
export const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB — WhatsApp protocol limit

/** Max entries in SSE Event Monitor buffer (memory protection) */
export const MAX_EVENT_STREAM_BUFFER = 500;

/** Default BQ log table page size — lihat PAGE_SIZE di TabLogs */
export const DEFAULT_LOG_PAGE_SIZE = 50;

/** Restart delay — waktu tunggu post-trigger sebelum refresh status */
export const RESTART_REFRESH_DELAY_MS = 5_000;

/** SSE reconnect delay saat connection dropped */
export const SSE_RECONNECT_DELAY_MS = 5_000;
