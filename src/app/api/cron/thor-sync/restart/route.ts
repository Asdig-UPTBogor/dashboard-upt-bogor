/**
 * Thor Restart — Trigger restart via GCP service-to-service auth
 * 
 * Dashboard CR → Thor CR (both on same GCP project)
 * Uses google-auth-library to get ID token for Cloud Run auth.
 */

import { NextResponse } from 'next/server';
import { getGoogleAuthOptions } from '@/lib/dashboard-config';

export const dynamic = 'force-dynamic';

const THOR_WORKER_URL = process.env.THOR_WORKER_URL || 'https://thor-worker-21805978769.asia-southeast2.run.app';

export async function POST() {
    try {
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth(getGoogleAuthOptions());
        const client = await auth.getIdTokenClient(THOR_WORKER_URL);

        const res = await client.request({
            url: `${THOR_WORKER_URL}/restart`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        return NextResponse.json(res.data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
