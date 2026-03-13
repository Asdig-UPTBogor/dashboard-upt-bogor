/**
 * Thor Validate — Call Thor CR /validate to check config correctness
 * 
 * Hits Thor CR with OIDC token, returns validation results.
 * FE uses this to show ✅/❌ on each config field.
 */

import { NextResponse } from 'next/server';
import { getGoogleAuthOptions } from '@/lib/dashboard-config';

export const dynamic = 'force-dynamic';

const THOR_WORKER_URL = process.env.THOR_WORKER_URL || 'https://thor-worker-21805978769.asia-southeast2.run.app';

export async function GET() {
    try {
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth(getGoogleAuthOptions());
        const client = await auth.getIdTokenClient(THOR_WORKER_URL);

        const res = await client.request({
            url: `${THOR_WORKER_URL}/validate`,
            method: 'GET',
        });

        return NextResponse.json(res.data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
