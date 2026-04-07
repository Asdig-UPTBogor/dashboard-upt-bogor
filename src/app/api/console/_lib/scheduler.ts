/**
 * Console API — Cloud Scheduler Service
 */

import { CloudSchedulerClient } from '@google-cloud/scheduler';
import { PROJECT_ID, getServiceDef } from './firestore';

const client = new CloudSchedulerClient();
const LOCATION = process.env.SCHEDULER_REGION || 'asia-southeast2';

function jobPath(jobId: string): string {
  return `projects/${PROJECT_ID}/locations/${LOCATION}/jobs/${jobId}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toISOString(ts: any): string | null {
  if (!ts) return null;
  if (ts.seconds != null) return new Date(Number(ts.seconds) * 1000).toISOString();
  if (typeof ts === 'string') return ts;
  return null;
}

export async function getJob(serviceId: string) {
  const def = await getServiceDef(serviceId);
  if (!def?.schedulerJobId) throw new Error(`No scheduler configured for '${serviceId}'`);

  const [job] = await client.getJob({ name: jobPath(def.schedulerJobId) });

  // Parse interval from cron: "*/30 * * * *" → 30
  const intervalMinutes = parseCronMinutes(job.schedule || '');

  return {
    name: def.schedulerJobId,
    state: job.state || 'UNKNOWN',
    schedule: job.schedule || '',
    intervalMinutes,
    lastAttemptTime: toISOString(job.lastAttemptTime),
    nextRunTime: toISOString(job.scheduleTime),
    timezone: job.timeZone || 'Asia/Jakarta',
    attemptDeadline: job.attemptDeadline?.seconds
      ? `${job.attemptDeadline.seconds}s`
      : null,
  };
}

// Parse cron interval: e.g. "*/30 * * * *" returns 30. Returns 0 if not a simple interval.
function parseCronMinutes(schedule: string): number {
  const match = schedule.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function pauseJob(serviceId: string) {
  const def = await getServiceDef(serviceId);
  if (!def?.schedulerJobId) throw new Error(`No scheduler configured for '${serviceId}'`);
  await client.pauseJob({ name: jobPath(def.schedulerJobId) });
  return { ok: true, action: 'paused', jobId: def.schedulerJobId };
}

export async function resumeJob(serviceId: string) {
  const def = await getServiceDef(serviceId);
  if (!def?.schedulerJobId) throw new Error(`No scheduler configured for '${serviceId}'`);
  await client.resumeJob({ name: jobPath(def.schedulerJobId) });
  return { ok: true, action: 'resumed', jobId: def.schedulerJobId };
}

export async function triggerJob(serviceId: string) {
  const def = await getServiceDef(serviceId);
  if (!def?.schedulerJobId) throw new Error(`No scheduler configured for '${serviceId}'`);
  await client.runJob({ name: jobPath(def.schedulerJobId) });
  return { ok: true, success: true, action: 'triggered', jobId: def.schedulerJobId };
}

export async function updateSchedule(serviceId: string, schedule: string) {
  const def = await getServiceDef(serviceId);
  if (!def?.schedulerJobId) throw new Error(`No scheduler configured for '${serviceId}'`);
  await client.updateJob({
    job: { name: jobPath(def.schedulerJobId), schedule },
    updateMask: { paths: ['schedule'] },
  });
  return { ok: true, action: 'schedule_updated', jobId: def.schedulerJobId, schedule };
}

// ── Design Standard v2.0: scheduler_* field builder ──

const STATE_MAP: Record<number, string> = {
  0: 'STATE_UNSPECIFIED', 1: 'ENABLED', 2: 'PAUSED', 3: 'DISABLED', 4: 'UPDATE_FAILED',
};

function stateToString(state: string | number | null | undefined): string {
  if (typeof state === 'string') return state;
  if (typeof state === 'number') return STATE_MAP[state] || String(state);
  return 'UNKNOWN';
}

/**
 * Read scheduler job and return standardized scheduler_* fields
 * for writing to Firestore config doc (Design Standard v2.0 §3C).
 */
export async function getSchedulerFields(serviceId: string): Promise<Record<string, unknown>> {
  const def = await getServiceDef(serviceId);
  if (!def?.schedulerJobId) return {};

  try {
    const [job] = await client.getJob({ name: jobPath(def.schedulerJobId) });

    return {
      scheduler_job_id: job.name?.split('/').pop() || def.schedulerJobId,
      scheduler_state: stateToString(job.state as string | number),
      scheduler_schedule: job.schedule || '',
      scheduler_timezone: job.timeZone || 'Asia/Jakarta',
      scheduler_next_run: toISOString(job.scheduleTime),
      scheduler_last_attempt: toISOString(job.lastAttemptTime),
      scheduler_last_status_code: job.status?.code ?? null,
      scheduler_attempt_deadline: job.attemptDeadline?.seconds
        ? `${job.attemptDeadline.seconds}s`
        : null,
      scheduler_target_url: job.httpTarget?.uri || null,
      scheduler_updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[scheduler] getSchedulerFields failed for '${serviceId}':`, err);
    return {};
  }
}

