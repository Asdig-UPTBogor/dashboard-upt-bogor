/**
 * GET /api/data-sources/ss-v5/sync-history?dataset=X&status=Y&limit=50
 * Returns SS V5 sync history timeline.
 */
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';

const bq = new BigQuery({ projectId: PROJECT });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dataset = url.searchParams.get('dataset');
    const status = url.searchParams.get('status');
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const hours = Number(url.searchParams.get('hours') ?? 24);

    const filters: string[] = [
      `started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours HOUR)`,
    ];
    const params: Record<string, unknown> = { hours, limit };
    if (dataset) {
      filters.push('dataset_name = @dataset');
      params.dataset = dataset;
    }
    if (status) {
      filters.push('status = @status');
      params.status = status;
    }

    const [rows] = await bq.query({
      query: `
        SELECT
          run_id, started_at, finished_at, trigger_source, triggered_by,
          dataset_name, sheet_name, status, skipped_reason,
          rows_read, rows_written, rows_rejected, duration_ms, error_message
        FROM \`${PROJECT}.${SS_PLATFORM}.sync_history\`
        WHERE ${filters.join(' AND ')}
        ORDER BY started_at DESC
        LIMIT @limit
      `,
      params,
    });

    return NextResponse.json({ history: rows, filters: { dataset, status, hours, limit } });
  } catch (e: any) {
    console.error('[sync-history] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
