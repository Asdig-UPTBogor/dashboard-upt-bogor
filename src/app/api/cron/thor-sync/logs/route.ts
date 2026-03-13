/**
 * Thor Logs API — Read from Cloud Logging
 * 
 * Dashboard reads Thor worker logs from Cloud Logging API.
 * Thor worker writes structured JSON to stdout → Cloud Run → Cloud Logging.
 * This route queries those logs and returns them for the LogPanel.
 */

import { NextResponse } from 'next/server';
import { getGoogleAuthOptions } from '@/lib/dashboard-config';
import { normalizeThorLogEntry } from '@/lib/thor-log-normalizer';

export const dynamic = 'force-dynamic';

const PROJECT_ID = 'gcp-bridge-meshvpn';
const SERVICE_NAME = 'thor-worker';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        // Use Google Auth from environment (Cloud Run default SA)
        // or from local credentials for dev
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth(getGoogleAuthOptions(['https://www.googleapis.com/auth/logging.read']));
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        // Query Cloud Logging REST API
        const response = await fetch(
            `https://logging.googleapis.com/v2/entries:list`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resourceNames: [`projects/${PROJECT_ID}`],
                    filter: `resource.type="cloud_run_revision" AND resource.labels.service_name="${SERVICE_NAME}"`,
                    orderBy: 'timestamp desc',
                    pageSize: limit,
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: err }, { status: response.status });
        }

        const data = await response.json();
        const entries = (data.entries || []).map((entry: Record<string, unknown>) =>
            normalizeThorLogEntry(entry)
        );

        return NextResponse.json(entries);
    } catch (error) {
        const detail = (error as Error).message;
        console.error('[thor-logs] Error:', detail);
        return NextResponse.json({ error: detail }, { status: 500 });
    }
}
