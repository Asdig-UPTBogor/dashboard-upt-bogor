/**
 * GET /api/data-sources/ss-v5/health
 * Returns SS V5 overall health: per-dataset status from v_sync_health.
 */
import { NextResponse } from 'next/server';
import { cachedQuery } from '@/lib/bq-cache';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';

interface HealthRow {
  dataset_name: string;
  row_count_total: number;
  row_count_valid: number;
  row_count_rejected: number;
  valid_pct: number;
  last_sync_status: string;
  last_synced_at: string;
  health_status: 'excellent' | 'good' | 'warning' | 'critical';
}

export const revalidate = 60;

export async function GET() {
  try {
    const rows = await cachedQuery<HealthRow[]>(
      'ss-v5-health-all',
      'dataset_hash',
      `SELECT * FROM \`${PROJECT}.${SS_PLATFORM}.v_sync_health\` ORDER BY dataset_name`,
    );

    // Summary
    const summary = {
      total_datasets: rows.length,
      total_rows: rows.reduce((s, r) => s + (Number(r.row_count_total) || 0), 0),
      total_valid: rows.reduce((s, r) => s + (Number(r.row_count_valid) || 0), 0),
      total_rejected: rows.reduce((s, r) => s + (Number(r.row_count_rejected) || 0), 0),
      excellent: rows.filter((r) => r.health_status === 'excellent').length,
      good: rows.filter((r) => r.health_status === 'good').length,
      warning: rows.filter((r) => r.health_status === 'warning').length,
      critical: rows.filter((r) => r.health_status === 'critical').length,
    };
    const overall_valid_pct = summary.total_rows > 0
      ? Math.round((summary.total_valid / summary.total_rows) * 1000) / 10
      : 0;

    return NextResponse.json({ summary: { ...summary, overall_valid_pct }, datasets: rows });
  } catch (e: any) {
    console.error('[ss-v5-health] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
