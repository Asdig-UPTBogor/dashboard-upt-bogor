/**
 * POST /api/data-sources/ss-v5/rejected-rows/resolve
 *
 * Manual mark rejected rows as resolved.
 * Body: { rejection_keys: number[] }
 */
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';

const bq = new BigQuery({ projectId: PROJECT });

export async function POST(req: Request) {
  try {
    const { rejection_keys } = await req.json();
    if (!Array.isArray(rejection_keys) || rejection_keys.length === 0) {
      return NextResponse.json({ ok: false, error: 'rejection_keys array required' }, { status: 400 });
    }

    const keys = rejection_keys.map((k) => String(k)).join(',');
    await bq.query({
      query: `
        UPDATE \`${PROJECT}.${SS_PLATFORM}.rejected_rows\`
        SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP()
        WHERE rejection_key IN (${keys}) AND status = 'active'
      `,
    });

    return NextResponse.json({ ok: true, resolved: rejection_keys.length });
  } catch (e: any) {
    console.error('[rejected/resolve]', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
