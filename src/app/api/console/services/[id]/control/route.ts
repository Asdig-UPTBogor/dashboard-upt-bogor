/**
 * POST /api/console/services/[id]/control
 * 
 * Scheduler control: pause, resume, trigger, status, update_interval
 * 
 * Design Standard v2.0:
 *   1. EXECUTE → SDK call
 *   2. SYNC    → Write scheduler_* to Firestore (triggers onSnapshot push to FE)
 *   3. LOG     → writeLog() to Cloud Logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { pauseJob, resumeJob, triggerJob, updateSchedule, getSchedulerFields } from '../../../_lib/scheduler';
import { writeLog } from '../../../_lib/logging';
import { updateConfig, readConfig } from '../../../_lib/firestore';
import { authenticatedFetch } from '../../../_lib/auth';

/**
 * Sync scheduler_* fields to Firestore after an action.
 * Design Standard v2.0 §3C: scheduler_* namespace.
 * Replaces legacy _live_* pattern.
 */
async function syncSchedulerState(serviceId: string) {
  try {
    const fields = await getSchedulerFields(serviceId);
    if (Object.keys(fields).length > 0) {
      await updateConfig(serviceId, fields);
    }
  } catch (err) {
    console.warn(`[control] syncSchedulerState failed (non-fatal): ${(err as Error).message}`);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as string;

    let result;
    switch (action) {
      case 'pause':
        result = await pauseJob(id);
        await syncSchedulerState(id);
        await writeLog(id, 'Scheduler PAUSED', { action }, 'WARNING');
        break;
      case 'resume':
        result = await resumeJob(id);
        await syncSchedulerState(id);
        await writeLog(id, 'Scheduler RESUMED', { action }, 'INFO');
        break;
      case 'trigger':
      case 'run_now':
        result = await triggerJob(id);
        await syncSchedulerState(id);
        await writeLog(id, 'Scheduler triggered MANUALLY', { action }, 'INFO');
        break;
      case 'status':
        // Refresh scheduler_* fields (replaces legacy bootstrap hack)
        await syncSchedulerState(id);
        result = await getSchedulerFields(id);
        break;
      case 'update_interval':
      case 'interval': {
        const intervalSec = body.intervalSec as number | undefined;
        const schedule = body.schedule as string | undefined;
        if (!intervalSec && !schedule) {
          return NextResponse.json({ error: 'Missing intervalSec or schedule' }, { status: 400 });
        }
        const cronExpr = schedule || `*/${Math.max(1, Math.round((intervalSec || 900) / 60))} * * * *`;
        result = await updateSchedule(id, cronExpr);
        await syncSchedulerState(id);
        await writeLog(id, `Scheduler interval updated → ${cronExpr}`, { action, intervalSec, cronExpr }, 'INFO');
        break;
      }
      case 'run_once': {
        // Direct CF invocation with OIDC — bypasses scheduler
        const { config } = await readConfig(id);
        const cfUrl = config.infra_url as string;
        if (!cfUrl) {
          return NextResponse.json({ error: 'infra_url not available in config' }, { status: 400 });
        }
        await writeLog(id, 'Run Once triggered (direct CF call)', { action }, 'INFO');
        const cfRes = await authenticatedFetch(cfUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }, 120_000);
        const cfData = await cfRes.json();
        result = { ok: cfRes.ok, ...cfData };
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    const status = err.message.includes('not found') || err.message.includes('No scheduler')
      ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// GET for status shortcut
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getSchedulerFields(id);
    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
