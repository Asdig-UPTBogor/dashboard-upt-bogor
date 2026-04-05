/**
 * GET /api/console/logs/[serviceId]
 *
 * Fetch recent logs for a SPECIFIC service.
 * Called when user checks the checkbox to open a LogPanel.
 *
 * Query params:
 *   - limit: max entries (default 200, max 1000)
 *   - hours: lookback window (default 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryLogs } from '../../_lib/logging';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  try {
    const { serviceId } = await params;
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '200'), 1000);
    const hours = Number(url.searchParams.get('hours') || '1');

    const entries = await queryLogs(serviceId, { limit, hours });

    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    const err = error as Error;
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
