/**
 * Worker Firestore — Generic Firestore R/W for Serverless Hub.
 *
 * Reads and writes any worker's config document using data from worker-registry.ts.
 * No hardcoded collection/document paths — everything comes from the registry.
 *
 * Used by:
 *   /api/serverless-hub/[serviceId]/config
 *   /api/serverless-hub/[serviceId]/control
 */

import { getGoogleAuth } from "@/lib/dashboard-config";

const PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_SCOPES = ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"];

const googleAuth = getGoogleAuth(FIRESTORE_SCOPES);

/* ── Firestore value types ── */

type FirestoreValue =
    | { stringValue: string }
    | { booleanValue: boolean }
    | { integerValue: string }
    | { doubleValue: number }
    | { nullValue: null }
    | { mapValue: { fields?: Record<string, FirestoreValue> } }
    | { arrayValue: { values?: FirestoreValue[] } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrapValue(v: FirestoreValue): any {
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("nullValue" in v) return null;
    if ("arrayValue" in v) {
        return (v.arrayValue.values || []).map(unwrapValue);
    }
    if ("mapValue" in v) {
        const obj: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
            obj[k] = unwrapValue(val);
        }
        return obj;
    }
    return null;
}

function toFirestoreValue(val: unknown): FirestoreValue {
    if (typeof val === "string") return { stringValue: val };
    if (typeof val === "boolean") return { booleanValue: val };
    if (typeof val === "number")
        return Number.isInteger(val)
            ? { integerValue: String(val) }
            : { doubleValue: val };
    if (val === null || val === undefined) return { nullValue: null };
    if (Array.isArray(val)) {
        return {
            arrayValue: { values: val.map(toFirestoreValue) },
        } as FirestoreValue;
    }
    if (typeof val === "object") {
        const fields: Record<string, FirestoreValue> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            fields[k] = toFirestoreValue(v);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

/* ── Auth ── */

async function getFirestoreToken(): Promise<string> {
    const client = await googleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token || "";
    if (!token) throw new Error("Failed to get Firestore access token");
    return token;
}

/* ── Generic Read ── */

export async function readWorkerConfig(
    collection: string,
    document: string,
): Promise<Record<string, unknown>> {
    const token = await getFirestoreToken();
    const res = await fetch(`${FIRESTORE_BASE}/${collection}/${document}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });
    if (!res.ok) {
        if (res.status === 404) return {};
        throw new Error(`Firestore read failed (${res.status})`);
    }
    const doc = await res.json();
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(doc.fields || {})) {
        result[key] = unwrapValue(val as FirestoreValue);
    }
    return result;
}

/** List all documents in a Firestore collection. Returns array with `_docId` on each. */
export async function listCollectionDocs(
    collection: string,
    excludeDocs: string[] = [],
): Promise<Array<Record<string, unknown>>> {
    const token = await getFirestoreToken();
    const res = await fetch(`${FIRESTORE_BASE}/${collection}?pageSize=100`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const docs = (data.documents || []) as Array<{ name?: string; fields?: Record<string, FirestoreValue> }>;
    return docs
        .map((doc) => {
            const docId = doc.name?.split("/").pop() || "";
            const result: Record<string, unknown> = { _docId: docId };
            for (const [key, val] of Object.entries(doc.fields || {})) {
                result[key] = unwrapValue(val);
            }
            return result;
        })
        .filter((d) => !excludeDocs.includes(d._docId as string));
}

/* ── Generic Write (patch) ── */

export async function patchWorkerConfig(
    collection: string,
    document: string,
    updates: Record<string, unknown>,
): Promise<void> {
    const token = await getFirestoreToken();
    const fields: Record<string, FirestoreValue> = {};
    const updateMask: string[] = [];

    for (const [key, val] of Object.entries(updates)) {
        fields[key] = toFirestoreValue(val);
        updateMask.push(key);
    }

    const maskParam = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await fetch(
        `${FIRESTORE_BASE}/${collection}/${document}?${maskParam}`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ fields }),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Firestore patch failed (${res.status}): ${text}`);
    }
}

/* ── Sensitive field masking ── */

export function maskSensitiveFields(
    config: Record<string, unknown>,
    sensitiveFields?: string[],
): Record<string, unknown> {
    if (!sensitiveFields || sensitiveFields.length === 0) return config;
    const masked = { ...config };
    for (const field of sensitiveFields) {
        if (field in masked) {
            const val = masked[field];
            if (typeof val === "string" && val.length > 4) {
                masked[field] = val.slice(0, 4) + "•".repeat(Math.min(val.length - 4, 20));
            } else {
                masked[field] = "••••";
            }
        }
    }
    return masked;
}
