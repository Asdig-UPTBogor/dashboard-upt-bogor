/**
 * Google Sheets API Quota Monitor (Deterministic)
 *
 * Instead of sliding-window tracking, calculates quota usage deterministically
 * from page-configs: we know exactly how many sheets = how many API calls.
 *
 * Still tracks 429 errors as a safety net for debugging.
 *
 * Google Sheets API limit: 300 read requests per minute per project.
 */

const QUOTA_LIMIT = 300; // Google Sheets API: 300 reads/min/project

interface ErrorEntry {
    timestamp: number;
    code: number;
    message: string;
}

class QuotaMonitor {
    private errors: ErrorEntry[] = [];
    private _lastCycleSheetCount = 0;

    /** Record an API error (429, 403, etc.) for debugging */
    recordError(code: number, message: string): void {
        this.errors.push({ timestamp: Date.now(), code, message });
        // Keep only last 10 minutes of errors
        const cutoff = Date.now() - 10 * 60 * 1000;
        this.errors = this.errors.filter(e => e.timestamp > cutoff);
    }

    /** Update the known sheet count (called by worker after collecting unique sheets) */
    setSheetCount(count: number): void {
        this._lastCycleSheetCount = count;
    }

    /** Get deterministic quota info */
    getStatus(): QuotaStatus {
        const sheetsPerCycle = this._lastCycleSheetCount;
        const usagePercent = sheetsPerCycle > 0
            ? Math.round((sheetsPerCycle / QUOTA_LIMIT) * 100)
            : 0;

        // Clean old errors
        const cutoff = Date.now() - 60 * 1000;
        const recentErrors = this.errors
            .filter(e => e.timestamp > cutoff)
            .map(e => ({
                code: e.code,
                message: e.message,
                ago: `${Math.round((Date.now() - e.timestamp) / 1000)}s ago`,
            }));

        const lastError429 = this.errors
            .filter(e => e.code === 429)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        return {
            sheetsPerCycle,
            quotaLimit: QUOTA_LIMIT,
            usagePercent,
            rateLimited: recentErrors.some(e => e.code === 429),
            lastError429At: lastError429 ? new Date(lastError429.timestamp).toISOString() : null,
            recentErrors,
        };
    }
}

export interface QuotaStatus {
    sheetsPerCycle: number;
    quotaLimit: number;
    usagePercent: number;
    rateLimited: boolean;
    lastError429At: string | null;
    recentErrors: { code: number; message: string; ago: string }[];
}

/**
 * Singleton via globalThis — shared across all Next.js API routes.
 * Fixes module isolation bug where each route gets its own instance.
 */
const globalForQuota = globalThis as typeof globalThis & { __quotaMonitor?: QuotaMonitor };
export const rateLimitCounter = globalForQuota.__quotaMonitor ??= new QuotaMonitor();
