/**
 * Thor Config — Dashboard reads runtime config from Firestore
 * and forwards updates to Thor CR.
 */

import { NextResponse } from 'next/server';
import { getGoogleAuthOptions } from '@/lib/dashboard-config';

export const dynamic = 'force-dynamic';

const THOR_WORKER_URL = process.env.THOR_WORKER_URL || 'https://thor-worker-21805978769.asia-southeast2.run.app';
const FIRESTORE_PROJECT_ID = process.env.GCP_PROJECT_ID || 'gcp-bridge-meshvpn';
const THOR_CONFIG_COLLECTION = process.env.THOR_CONFIG_COLLECTION || 'service_runtime_configs';
const THOR_CONFIG_DOCUMENT = process.env.THOR_CONFIG_DOCUMENT || 'thor_vaisala';

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

async function getRuntimeConfigFromFirestore() {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth(getGoogleAuthOptions(['https://www.googleapis.com/auth/cloud-platform']));
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === 'string' ? accessToken : accessToken.token;

    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${THOR_CONFIG_COLLECTION}/${THOR_CONFIG_DOCUMENT}`,
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
 */
export async function GET() {
    try {
        const config = await getRuntimeConfigFromFirestore();
        return NextResponse.json(config, {
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
 * Thor handles: sheet update → mode switch notification → cache clear
 * Body: { key: string, value: string }
 */
export async function POST(request: Request) {
    try {
        const { key, value } = await request.json();
        if (!key || value === undefined) {
            return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
        }

        // Forward to Thor CR /config — Thor handles everything:
        // 1. Update sheet value
        // 2. Detect mode switch → send WA notification
        // 3. Clear cache → next sync reloads fresh config
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
