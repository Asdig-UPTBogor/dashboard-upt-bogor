/**
 * GCP Config — Single Source of Truth
 *
 * Centralizes all GCP project constants.
 * Every API route imports from here instead of defining its own constants.
 *
 * Order of precedence: process.env → Firestore _settings → hardcoded default
 */

export const GCP_PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

export const CF_SYNC_REGION =
    process.env.CF_SYNC_REGION || "asia-southeast2";

export const CF_SYNC_FUNCTION_NAME =
    process.env.CF_SYNC_FUNCTION_NAME || "sheet-bq-sync";

export const CF_SYNC_URL =
    process.env.CF_SYNC_URL ||
    `https://${CF_SYNC_REGION}-${GCP_PROJECT_ID}.cloudfunctions.net/${CF_SYNC_FUNCTION_NAME}`;

export const THOR_WORKER_URL =
    process.env.THOR_WORKER_URL ||
    "https://thor-worker-21805978769.asia-southeast2.run.app";

export const THOR_SERVICE_NAME =
    process.env.THOR_SERVICE_NAME || "thor-worker";

export const THOR_CONFIG_COLLECTION =
    process.env.THOR_CONFIG_COLLECTION || "service_runtime_configs";

export const THOR_CONFIG_DOCUMENT =
    process.env.THOR_CONFIG_DOCUMENT || "thor_vaisala";

/** Firestore REST base URL for data_sources collection */
export const FIRESTORE_BASE_URL =
    `https://firestore.googleapis.com/v1/projects/${GCP_PROJECT_ID}/databases/(default)/documents`;

/** Standard GCP scopes */
export const SCOPES = {
    CLOUD_PLATFORM: "https://www.googleapis.com/auth/cloud-platform",
    DATASTORE: "https://www.googleapis.com/auth/datastore",
    LOGGING_READ: "https://www.googleapis.com/auth/logging.read",
} as const;
