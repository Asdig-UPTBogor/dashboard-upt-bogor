import { CLOUD_CONSOLE_API } from "@/lib/cloud-console-api";

/* ═══════════════════════════════════════════════════
   Thor Vaisala Gen 3 — API Helpers
   Pattern: spreadsheet-sync reference (CC Standard v2.3)
   ═══════════════════════════════════════════════════ */

const CONTROL_API = `${CLOUD_CONSOLE_API}/services/thor-gen3/control`;
const CONFIG_API = `${CLOUD_CONSOLE_API}/services/thor-gen3/config`;
export const ACTIONS_API = `${CLOUD_CONSOLE_API}/services/thor-gen3/actions`;

/**
 * Scheduler control action via CC API backend.
 * Pattern: FE → CC API → Cloud Scheduler SDK → sync FS → onSnapshot → FE
 * Actions: pause, resume, trigger, interval, status
 */
export async function controlAction(body: Record<string, unknown>) {
    return fetch(CONTROL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

/**
 * Patch config fields to Firestore via CC Config API.
 */
export async function patchConfig(fields: Record<string, unknown>): Promise<boolean> {
    try {
        const res = await fetch(CONFIG_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        });
        const data = await res.json();
        return !!data.ok;
    } catch {
        return false;
    }
}

/* ═══════════════════════════════════════════════════
   Spreadsheet Dynamic Loading (shared by Config + Enrichment)
   ═══════════════════════════════════════════════════ */

/**
 * Load sheet names from a spreadsheet.
 * POST /api/console/services/thor-gen3/actions/load-sheets
 */
export async function loadSheets(spreadsheetId: string): Promise<{ sheets: string[] }> {
    const res = await fetch(`${ACTIONS_API}/load-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

/**
 * Load headers + row count from a specific sheet.
 * POST /api/console/services/thor-gen3/actions/load-headers
 */
export async function loadHeaders(spreadsheetId: string, sheetName: string): Promise<{ headers: string[]; rowCount: number }> {
    const res = await fetch(`${ACTIONS_API}/load-headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, sheetName }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

/* ═══════════════════════════════════════════════════
   Format Helpers (consistent with spreadsheet-sync)
   ═══════════════════════════════════════════════════ */

export function fmtBool(v: unknown): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.toUpperCase() === "TRUE" || v === "1";
    return false;
}

export function fmtMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function fmtWIB(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-GB", {
        hour12: false, timeZone: "Asia/Jakarta",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}

export function fmtAgo(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
    return `${Math.floor(d / 86400_000)}d ago`;
}
