export function getDashboardSyncWorkerUrl(): string | null {
    const value = process.env.DASHBOARD_SYNC_WORKER_URL?.trim();
    return value ? value.replace(/\/$/, "") : null;
}

const ID_TOKEN_CACHE_TTL_MS = 55 * 60 * 1000;
const GCE_METADATA_ID_TOKEN_URL =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

let idTokenCache: { audience: string; value: string; expiresAt: number } | null = null;

function isLocalWorkerUrl(baseUrl: string): boolean {
    try {
        const parsed = new URL(baseUrl);
        return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    } catch {
        return false;
    }
}

/**
 * Get ID token for service-to-service auth on Cloud Run.
 * Uses GCE metadata server directly (no library dependency).
 * Falls back gracefully on local dev (metadata server unavailable → null).
 */
async function getWorkerIdToken(audience: string): Promise<string | null> {
    if (process.env.DASHBOARD_SYNC_WORKER_AUTH === "none") {
        return null;
    }

    if (isLocalWorkerUrl(audience)) {
        return null;
    }

    const now = Date.now();
    if (
        idTokenCache &&
        idTokenCache.audience === audience &&
        idTokenCache.expiresAt > now + 30_000
    ) {
        return idTokenCache.value;
    }

    try {
        const url = `${GCE_METADATA_ID_TOKEN_URL}?audience=${encodeURIComponent(audience)}`;
        const res = await fetch(url, {
            headers: { "Metadata-Flavor": "Google" },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            throw new Error(`Metadata server returned ${res.status}: ${await res.text()}`);
        }

        const token = await res.text();
        if (!token) {
            throw new Error("Metadata server returned empty token");
        }

        idTokenCache = {
            audience,
            value: token,
            expiresAt: now + ID_TOKEN_CACHE_TTL_MS,
        };
        return token;
    } catch (tokenError) {
        console.error("[dashboard-sync-worker] ID token error:", (tokenError as Error).message);
        return null;
    }
}

export async function proxyDashboardSyncWorker(
    path: string,
    init?: RequestInit
): Promise<Response> {
    const baseUrl = getDashboardSyncWorkerUrl();
    if (!baseUrl) {
        throw new Error("DASHBOARD_SYNC_WORKER_URL is not configured");
    }

    const headers = new Headers(init?.headers || {});
    const token = await getWorkerIdToken(baseUrl);
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    return fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        cache: "no-store",
    });
}

export function requireDashboardSyncWorkerUrl(): string {
    const baseUrl = getDashboardSyncWorkerUrl();
    if (!baseUrl) {
        throw new Error("DASHBOARD_SYNC_WORKER_URL is not configured");
    }
    return baseUrl;
}

export function isExternalDashboardSyncWorkerEnabled(): boolean {
    return getDashboardSyncWorkerUrl() !== null;
}
