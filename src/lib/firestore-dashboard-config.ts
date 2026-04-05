import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/dashboard-config";

const FIRESTORE_PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const PAGE_COLLECTION = process.env.FIRESTORE_PAGES_COLLECTION || "dashboard_pages";
const META_COLLECTION = process.env.FIRESTORE_META_COLLECTION || "dashboard_meta";
const REGISTRY_DOC_ID = process.env.FIRESTORE_REGISTRY_DOC_ID || "registry_root";

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_SCOPES = ["https://www.googleapis.com/auth/datastore"];
type FirestorePageConfig = Record<string, unknown> & {
    page?: string;
    dataSources?: Record<string, unknown>[];
};
type FirestoreRegistryRoot = Record<string, unknown> & {
    spreadsheets?: Record<string, unknown>[];
};

type FirestoreValue =
    | { stringValue: string }
    | { booleanValue: boolean }
    | { integerValue: string }
    | { doubleValue: number }
    | { nullValue: null }
    | { arrayValue: { values?: FirestoreValue[] } }
    | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
    name: string;
    fields?: Record<string, FirestoreValue>;
};

const googleAuth = getGoogleAuth(FIRESTORE_SCOPES);

function pagePathToSlug(pagePath: string) {
    return pagePath.replace(/^\//, "").replace(/\//g, "--");
}

function normalizeColumn(column: unknown) {
    if (typeof column === "string") {
        return { name: column, pos: "" };
    }

    const value = column as { name?: unknown; pos?: unknown };
    return {
        name: String(value?.name || "").trim(),
        pos: String(value?.pos || "").trim(),
    };
}

function sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }

    if (value && typeof value === "object") {
        const next: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value)) {
            const safeKey =
                key.startsWith("__") && key.endsWith("__")
                    ? `reserved${key}`
                    : key;
            next[safeKey] = sanitizeValue(child);
        }
        return next;
    }

    return value;
}

function unsanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(unsanitizeValue);
    }

    if (value && typeof value === "object") {
        const next: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            const originalKey = key.startsWith("reserved__") && key.endsWith("__")
                ? key.replace(/^reserved/, "")
                : key;
            next[originalKey] = unsanitizeValue(child);
        }
        return next;
    }

    return value;
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
    if (value === null || value === undefined) {
        return { nullValue: null };
    }

    if (Array.isArray(value)) {
        return {
            arrayValue: {
                values: value.map(encodeFirestoreValue),
            },
        };
    }

    if (typeof value === "string") {
        return { stringValue: value };
    }

    if (typeof value === "boolean") {
        return { booleanValue: value };
    }

    if (typeof value === "number") {
        if (Number.isInteger(value)) {
            return { integerValue: String(value) };
        }
        return { doubleValue: value };
    }

    if (typeof value === "object") {
        const fields: Record<string, FirestoreValue> = {};
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            fields[key] = encodeFirestoreValue(child);
        }
        return { mapValue: { fields } };
    }

    return { stringValue: String(value) };
}

function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
    if (!value) return null;
    if ("stringValue" in value) return value.stringValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return value.doubleValue;
    if ("nullValue" in value) return null;
    if ("arrayValue" in value) {
        return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }
    if ("mapValue" in value) {
        const next: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value.mapValue.fields || {})) {
            next[key] = decodeFirestoreValue(child);
        }
        return next;
    }
    return null;
}

function decodeFirestoreDocument(document: FirestoreDocument | null): Record<string, unknown> | null {
    if (!document?.fields) return null;
    const decoded = decodeFirestoreValue({ mapValue: { fields: document.fields } });
    return unsanitizeValue(decoded) as Record<string, unknown>;
}

function encodeDocumentFields(data: Record<string, unknown>) {
    const encoded = encodeFirestoreValue(sanitizeValue(data));
    if (!("mapValue" in encoded)) {
        throw new Error("Firestore document must be an object");
    }
    return encoded.mapValue.fields || {};
}

async function getAccessToken() {
    const client = await googleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token =
        typeof tokenResponse === "string"
            ? tokenResponse
            : tokenResponse?.token || "";

    if (!token) {
        throw new Error("Failed to get Firestore access token");
    }

    return token;
}

async function firestoreRequest<T>(path: string, init: RequestInit = {}) {
    const token = await getAccessToken();
    const response = await fetch(`${FIRESTORE_BASE_URL}/${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(init.headers || {}),
        },
        cache: "no-store",
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Firestore request failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
}

async function listCollection(collection: string) {
    const result = await firestoreRequest<{ documents?: FirestoreDocument[] }>(
        `${collection}?pageSize=200`
    );
    return (result.documents || []).map((document) => decodeFirestoreDocument(document)).filter(Boolean);
}

async function getDocument(path: string) {
    try {
        const document = await firestoreRequest<FirestoreDocument>(path);
        return decodeFirestoreDocument(document);
    } catch (error) {
        if (error instanceof Error && error.message.includes("(404)")) {
            return null;
        }
        throw error;
    }
}

async function setDocument(path: string, data: Record<string, unknown>) {
    const body = JSON.stringify({
        fields: encodeDocumentFields(data),
    });

    const document = await firestoreRequest<FirestoreDocument>(path, {
        method: "PATCH",
        body,
    });
    return decodeFirestoreDocument(document);
}

export async function listPageConfigsFromFirestore() {
    const configs = await listCollection(PAGE_COLLECTION);
    const normalized = configs.map((config) => ({
        ...(config as FirestorePageConfig),
        dataSources: Array.isArray(config?.dataSources)
            ? config.dataSources.map((dataSource) => ({
                ...(dataSource as Record<string, unknown>),
                columnsUsed: Array.isArray((dataSource as Record<string, unknown>).columnsUsed)
                    ? ((dataSource as Record<string, unknown>).columnsUsed as unknown[]).map(normalizeColumn)
                    : [],
            }))
            : [],
    })) as FirestorePageConfig[];

    return normalized
        .sort((left, right) => String(left.page || "").localeCompare(String(right.page || "")));
}

export async function loadPageConfigFromFirestore(pagePath: string) {
    const slug = pagePathToSlug(pagePath);
    const config = await getDocument(`${PAGE_COLLECTION}/${slug}`);
    if (!config) return null;

    return {
        ...config,
        dataSources: Array.isArray(config.dataSources)
            ? config.dataSources.map((dataSource) => ({
                ...(dataSource as Record<string, unknown>),
                columnsUsed: Array.isArray((dataSource as Record<string, unknown>).columnsUsed)
                    ? ((dataSource as Record<string, unknown>).columnsUsed as unknown[]).map(normalizeColumn)
                    : [],
            }))
            : [],
    };
}

export async function loadRegistryRootFromFirestore() {
    return getDocument(`${META_COLLECTION}/${REGISTRY_DOC_ID}`);
}

export async function savePageConfigToFirestore(config: Record<string, unknown>) {
    const slug = pagePathToSlug(String(config.page || ""));
    const next = {
        ...config,
        updatedAt: config.updatedAt || new Date().toISOString(),
        _firestore: {
            slug,
            projectId: FIRESTORE_PROJECT_ID,
            updatedAt: new Date().toISOString(),
        },
    };
    return setDocument(`${PAGE_COLLECTION}/${slug}`, next);
}

export async function saveDataSourceToFirestore(docId: string, data: Record<string, unknown>) {
    return setDocument(`data_sources/${docId}`, data);
}

export async function saveRegistryRootToFirestore(registryRoot: Record<string, unknown>) {
    const next = {
        ...registryRoot,
        _firestore: {
            ...((registryRoot._firestore as Record<string, unknown> | undefined) || {}),
            projectId: FIRESTORE_PROJECT_ID,
            updatedAt: new Date().toISOString(),
        },
    };
    return setDocument(`${META_COLLECTION}/${REGISTRY_DOC_ID}`, next);
}

export async function syncRegistryRootFromPageConfigs() {
    const registryRoot = await loadRegistryRootFromFirestore() as FirestoreRegistryRoot | null;
    if (!registryRoot || !Array.isArray(registryRoot.spreadsheets)) {
        return null;
    }

    const pageConfigs = await listPageConfigsFromFirestore() as FirestorePageConfig[];
    const sheetToPages = new Map<string, Set<string>>();
    const sheetToColumns = new Map<string, Map<string, { name: string; pos: string }>>();

    for (const pageConfig of pageConfigs) {
        for (const dataSource of (pageConfig.dataSources as Record<string, unknown>[] | undefined) || []) {
            const spreadsheetId = String(dataSource.spreadsheetId || "");
            const sheetName = String(dataSource.sheetName || "");
            const key = `${spreadsheetId}::${sheetName}`.toLowerCase();

            if (!sheetToPages.has(key)) sheetToPages.set(key, new Set<string>());
            sheetToPages.get(key)?.add(String(pageConfig.page || ""));

            if (!sheetToColumns.has(key)) {
                sheetToColumns.set(key, new Map<string, { name: string; pos: string }>());
            }
            const columnMap = sheetToColumns.get(key);
            const columnsUsed = Array.isArray(dataSource.columnsUsed) ? dataSource.columnsUsed : [];
            for (const column of columnsUsed) {
                const normalized = normalizeColumn(column);
                if (!normalized.name) continue;
                const columnKey = normalized.name.toLowerCase();
                if (!columnMap?.has(columnKey)) {
                    columnMap?.set(columnKey, normalized);
                }
            }
        }
    }

    for (const spreadsheet of registryRoot.spreadsheets as Record<string, unknown>[]) {
        const sheets = Array.isArray(spreadsheet.sheets) ? spreadsheet.sheets : [];
        for (const sheet of sheets as Record<string, unknown>[]) {
            const spreadsheetId = String(spreadsheet.spreadsheetId || spreadsheet.id || "");
            const sheetName = String(sheet.sheetName || "");
            const key = `${spreadsheetId}::${sheetName}`.toLowerCase();
            sheet.usedBy = Array.from(sheetToPages.get(key) || []);
            const mergedColumns = sheetToColumns.get(key);
            if (mergedColumns && mergedColumns.size > 0) {
                sheet.columnsUsed = Array.from(mergedColumns.values());
            } else {
                const currentColumns = Array.isArray(sheet.columnsUsed) ? sheet.columnsUsed : [];
                sheet.columnsUsed = currentColumns.map(normalizeColumn);
            }
        }
    }

    await saveRegistryRootToFirestore(registryRoot);
    return registryRoot;
}
