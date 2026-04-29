/**
 * POST /api/data-sources/ss-v5/trigger-sync
 * body: { dataset?: string, sheet?: string }  — kalau kosong, sync-all
 *
 * Invoke ss-sync-runner CF via OIDC token.
 */
import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

const SYNC_URL = 'https://ss-sync-xelpk4dj7q-et.a.run.app';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { dataset, sheet, action: reqAction } = body;
    const action = reqAction || (dataset ? 'sync' : 'full-cycle');

    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(SYNC_URL);
    const response = await client.request({
      url: SYNC_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { action, dataset, sheet, trigger_source: 'manual' },
    });

    return NextResponse.json({ status: 'triggered', result: response.data });
  } catch (e: any) {
    console.error('[trigger-sync]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
