/**
 * Cloud Console API — Base URL configuration
 * 
 * MERGED: Cloud Console is now served by Dashboard's own API routes (/api/console).
 * 
 * Route mapping:
 *   /api/console/services                          → GET  all services
 *   /api/console/services/[id]/config              → GET/POST config
 *   /api/console/services/[id]/control             → GET/POST scheduler
 *   /api/console/logs/stream                       → GET  SSE unified log stream
 *   /api/console/services/[id]/actions/[action]    → GET/POST service actions
 */

export const CLOUD_CONSOLE_API = '/api/console';

/** Build service endpoint URL */
export function consoleApiUrl(serviceId: string, path: string): string {
    return `${CLOUD_CONSOLE_API}/services/${serviceId}/${path}`;
}

/** Build service action URL */
export function consoleActionUrl(serviceId: string, action: string): string {
    return `${CLOUD_CONSOLE_API}/services/${serviceId}/actions/${action}`;
}

/** Unified log stream URL */
export const CONSOLE_LOG_STREAM_URL = `${CLOUD_CONSOLE_API}/logs/stream`;
