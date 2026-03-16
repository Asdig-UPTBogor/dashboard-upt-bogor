/**
 * Worker Registry — Single source of truth for all serverless services.
 *
 * Every service monitored by the Serverless Hub is defined here.
 * Adding a new service = add entry here + create its page.
 *
 * The dashboard uses this to:
 *   - Build ServiceExplorer sidebar
 *   - Route API calls to correct Firestore collection/doc
 *   - Route log queries to correct Cloud Logging filter
 *   - Route scheduler control to correct Cloud Scheduler job
 */

export interface WorkerDefinition {
    /** URL-safe slug, used in routes and sidebar */
    id: string;
    /** Display name */
    name: string;
    /** Short description */
    description: string;

    // ── Firestore Config ──
    /** Firestore collection containing this worker's config */
    configCollection: string;
    /** Firestore document ID within the collection */
    configDocument: string;
    /** Fields that must be masked in API responses (e.g. tokens, cookies) */
    sensitiveFields?: string[];

    // ── Cloud Logging ──
    /** Cloud Logging resource.labels.service_name */
    logServiceName: string;
    /** Cloud Logging resource.type (e.g. 'cloud_run_revision', 'cloud_function') */
    logServiceType: string;

    // ── Cloud Scheduler ──
    /** Cloud Scheduler job ID for this worker */
    schedulerJobId: string;

    // ── UI ──
    /** Lucide icon name */
    icon: string;
    /** Accent color class (e.g. 'text-blue-400') */
    color: string;
    /** Short subtitle for explorer */
    subtitle: string;
    /** Service status */
    status: "active" | "planned" | "disabled";
}

/**
 * All registered serverless services.
 * Order determines sidebar display order.
 */
export const WORKERS: Record<string, WorkerDefinition> = {
    "spreadsheet-sync": {
        id: "spreadsheet-sync",
        name: "Spreadsheet Sync",
        description: "Sheets → BigQuery automated pipeline",
        configCollection: "data_sources",
        configDocument: "_settings",
        logServiceName: "sheet-bq-sync",
        logServiceType: "cloud_run_revision",
        schedulerJobId: "sheet-bq-sync-trigger",
        icon: "Table2",
        color: "text-blue-400",
        subtitle: "CF · Scheduler · BQ",
        status: "active",
    },
    "thor-vaisala": {
        id: "thor-vaisala",
        name: "Thor Vaisala",
        description: "Lightning monitoring & WA alert",
        configCollection: "service_runtime_configs",
        configDocument: "thor_vaisala",
        sensitiveFields: [
            "VAISALA_COOKIE",
            "MAXCHAT_TOKEN",
            "MAXCHAT_GROUP_ID_THOR",
            "MAXCHAT_GROUP_MAINTENANCE",
        ],
        logServiceName: "thor-worker",
        logServiceType: "cloud_run_revision",
        schedulerJobId: "thor-sync-trigger",
        icon: "Zap",
        color: "text-amber-400",
        subtitle: "Lightning · CR",
        status: "active",
    },
};

/** Get all workers as an ordered array */
export function getWorkerList(): WorkerDefinition[] {
    return Object.values(WORKERS);
}

/** Get worker by ID (returns undefined if not found) */
export function getWorker(id: string): WorkerDefinition | undefined {
    return WORKERS[id];
}

/** Get all active workers */
export function getActiveWorkers(): WorkerDefinition[] {
    return getWorkerList().filter((w) => w.status === "active");
}

/** Pick the right log normalizer based on service ID */
export function getNormalizer(serviceId: string) {
    if (serviceId === "thor-vaisala") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { normalizeThorLogEntry } = require("@/lib/thor-log-normalizer");
        return normalizeThorLogEntry;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { normalizeCfLogEntry } = require("@/lib/cf-log-normalizer");
    return normalizeCfLogEntry;
}
