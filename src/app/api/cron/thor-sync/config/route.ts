/**
 * Thor Config — Dashboard reads runtime config from Firestore
 * and forwards updates to Thor CR.
 *
 * Security:
 *   - GET masks sensitive fields (cookies, tokens, group IDs)
 *   - POST only accepts whitelisted config keys
 */

import { NextResponse } from 'next/server';
import { getGoogleAuthOptions } from '@/lib/dashboard-config';
import { GCP_PROJECT_ID, THOR_WORKER_URL, THOR_CONFIG_COLLECTION, THOR_CONFIG_DOCUMENT } from '@/lib/gcp-config';

export const dynamic = 'force-dynamic';

// ── Security: Fields that must be masked in GET response ──
const SENSITIVE_FIELDS = new Set([
    'VAISALA_COOKIE',
    'MAXCHAT_TOKEN',
    'MAXCHAT_GROUP_ID_THOR',
    'MAXCHAT_GROUP_MAINTENANCE',
]);

// ── Security: Only these keys can be updated via POST ──
const ALLOWED_CONFIG_KEYS = new Set([
    'IS_ACTIVE',
    'MAXCHAT_MODE',
    'VAISALA_SOURCE_MODE',
    'VAISALA_URL',
    'VAISALA_MOCK_URL',
    'UPT_FILTER',
    'BBOX_MIN_LON',
    'BBOX_MAX_LON',
    'BBOX_MIN_LAT',
    'BBOX_MAX_LAT',
    'DATA_SHEET_OUTPUT',
    'TOWER_SHEET_SOURCE',
    'COL_ULTG',
    'COL_GI',
    'COL_TOWER_NAME',
    'COL_LAT',
    'COL_LONG',
]);

type FirestorePrimitive =
    | { stringValue: string }
    | { booleanValue: boolean }
    | { integerValue: string }
    | { doubleValue: number }
    | { nullValue: null };

function decodeFirestoreValue(value: FirestorePrimitive | undefined): string {
    if (!value) return '';
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue ? 'TRUE' : 'FALSE';
    if ('integerValue' in value) return value.integerValue;
    if ('doubleValue' in value) return String(value.doubleValue);
    return '';
}

/** Mask a sensitive string value — show only last 4 chars */
function maskValue(value: string): string {
    if (value.length <= 4) return '****';
    return '****' + value.slice(-4);
}

async function getRuntimeConfigFromFirestore() {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth(getGoogleAuthOptions(['https://www.googleapis.com/auth/cloud-platform']));
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === 'string' ? accessToken : accessToken.token;

    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${GCP_PROJECT_ID}/databases/(default)/documents/${THOR_CONFIG_COLLECTION}/${THOR_CONFIG_DOCUMENT}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
        }
    );

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Firestore config read failed (${response.status}): ${detail}`);
    }

    const document = await response.json() as { fields?: Record<string, FirestorePrimitive> };
    const fields = document.fields || {};
    const config: Record<string, string> = {};

    for (const [key, value] of Object.entries(fields)) {
        config[key] = decodeFirestoreValue(value);
    }

    return config;
}

/**
 * GET — Read runtime config from Firestore
 * Sensitive fields are masked for security.
 */
export async function GET() {
    try {
        const config = await getRuntimeConfigFromFirestore();

        // Mask sensitive fields before sending to browser
        const safeConfig: Record<string, string> = {};
        for (const [key, value] of Object.entries(config)) {
            safeConfig[key] = SENSITIVE_FIELDS.has(key) ? maskValue(value) : value;
        }

        return NextResponse.json(safeConfig, {
            headers: {
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

/**
 * POST — Forward config change to Thor CR /config
 * Thor handles: Firestore update → mode switch notification → cache clear
 * Body: { key: string, value: string }
 *
 * Only whitelisted keys are accepted. Sensitive credential updates
 * (VAISALA_COOKIE, MAXCHAT_TOKEN) must be done directly in Firestore.
 */
export async function POST(request: Request) {
    try {
        const { key, value } = await request.json();
        if (!key || value === undefined) {
            return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
        }

        // Validate: only whitelisted keys
        if (!ALLOWED_CONFIG_KEYS.has(key)) {
            return NextResponse.json(
                { error: `Key "${key}" is not allowed. Only operational config keys can be changed via dashboard.` },
                { status: 403 }
            );
        }

        // Forward to Thor CR /config — Thor handles everything
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth(getGoogleAuthOptions());
        const client = await auth.getIdTokenClient(THOR_WORKER_URL);

        const thorRes = await client.request({
            url: `${THOR_WORKER_URL}/config`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: { key, value },
        });

        const data = thorRes.data as Record<string, unknown>;

        return NextResponse.json({
            status: 'ok',
            key,
            value,
            previousValue: data.previousValue || null,
            thorResponse: data.status || 'ok',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
