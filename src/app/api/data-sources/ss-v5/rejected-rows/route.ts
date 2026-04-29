/**
 * GET /api/data-sources/ss-v5/rejected-rows?dataset=X&status=active&limit=200
 * Returns rejected rows for user fix.
 * Each row includes deeplink cell di spreadsheet (sheet_gid + row_number → URL).
 */
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';

const bq = new BigQuery({ projectId: PROJECT });

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dataset = url.searchParams.get('dataset');
    const status = url.searchParams.get('status') ?? 'active';
    const reason = url.searchParams.get('reason');
    const limit = Number(url.searchParams.get('limit') ?? 200);

    const filters: string[] = ['status = @status'];
    const params: Record<string, unknown> = { status, limit };
    if (dataset) {
      filters.push('source_dataset = @dataset');
      params.dataset = dataset;
    }
    if (reason) {
      filters.push('reason_code = @reason');
      params.reason = reason;
    }

    const [rows] = await bq.query({
      query: `
        SELECT
          CAST(rejection_key AS STRING) AS rejection_key,
          spreadsheet_id, spreadsheet_name,
          source_dataset, source_sheet, row_number,
          column_name, cell_value, reason_code, reason_message,
          first_seen_at, last_seen_at, status, resolved_at,
          -- Build sheet URL kalau sheet_id di-provide — butuh Sheets API untuk sheetId (gid)
          CONCAT('https://docs.google.com/spreadsheets/d/', spreadsheet_id) AS spreadsheet_url
        FROM \`${PROJECT}.${SS_PLATFORM}.rejected_rows\`
        WHERE ${filters.join(' AND ')}
        ORDER BY last_seen_at DESC
        LIMIT @limit
      `,
      params,
    });

    // Group summary
    const summary: Record<string, number> = {};
    for (const r of rows as any[]) {
      const k = `${r.source_dataset}::${r.reason_code}`;
      summary[k] = (summary[k] ?? 0) + 1;
    }

    return NextResponse.json({ rows, summary, filters: { dataset, status, reason, limit } });
  } catch (e: any) {
    console.error('[rejected-rows] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
