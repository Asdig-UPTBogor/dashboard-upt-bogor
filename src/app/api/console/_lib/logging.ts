/**
 * Console API — Cloud Logging Service (Unified)
 *
 * Single file for ALL Cloud Logging operations:
 *   - Query logs per service
 *   - Query logs for ALL active services (unified)
 *   - Normalize log entries from Cloud Logging format
 *
 * MERGED from: logging.ts + normalizer.ts (old)
 */

import { Logging } from '@google-cloud/logging';
import { PROJECT_ID, getServiceDef } from './firestore';

const logging = new Logging({ projectId: PROJECT_ID });

// ══════════════════════════════════════════════════
//  Types (ex normalizer.ts)
// ══════════════════════════════════════════════════

export interface NormalizedLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  stage: string;
  message: string;
  runId: string | null;
  metrics: Record<string, number>;
  source: 'cloud-function' | 'cloud-run' | 'cloud-scheduler' | 'dashboard';
  serviceId?: string;
  meta?: Record<string, unknown>;
}

export interface CloudLoggingEntry {
  insertId?: string;
  timestamp?: string;
  receiveTimestamp?: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  resource?: { type?: string; labels?: Record<string, string> };
  logName?: string;
  labels?: Record<string, string>;
}

// ══════════════════════════════════════════════════
//  Query: Per-service logs
// ══════════════════════════════════════════════════

// CF Gen2 logs muncul di KEDUA resource type (per GCP docs):
//   - cloud_run_revision + service_name  (application logs, system logs)
//   - cloud_function + function_name     (lifecycle logs)
// Cloud Run hanya pakai cloud_run_revision + service_name

function buildResourceFilter(logServiceName: string, serviceType: string): string {
  if (serviceType === 'cloud_function') {
    // CF Gen2: OR filter — tangkap SEMUA logs
    return `(resource.type="cloud_run_revision" AND resource.labels.service_name="${logServiceName}") OR (resource.type="cloud_function" AND resource.labels.function_name="${logServiceName}")`;
  }
  // Cloud Run: single filter
  return `(resource.type="cloud_run_revision" AND resource.labels.service_name="${logServiceName}")`;
}

export function buildServiceFilter(
  logServiceName: string,
  serviceId: string,
  serviceType: 'cloud_function' | 'cloud_run' = 'cloud_run',
): string {
  const resourceFilter = buildResourceFilter(logServiceName, serviceType);

  // Include dashboard config change logs
  return `(${resourceFilter}) OR (logName="projects/${PROJECT_ID}/logs/dashboard-console" AND labels.service_id="${serviceId}")`;
}

export async function queryLogs(
  serviceId: string,
  options: { limit?: number; hours?: number } = {},
): Promise<NormalizedLogEntry[]> {
  const def = await getServiceDef(serviceId);
  if (!def) throw new Error(`Service '${serviceId}' not found in registry`);

  const limit = options.limit || 50;
  const hours = options.hours || 2;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const filter = [
    buildServiceFilter(def.logServiceName, serviceId, def.serviceType),
    `timestamp >= "${since}"`,
  ].join('\n');

  const [entries] = await logging.getEntries({
    filter,
    pageSize: limit,
    orderBy: 'timestamp desc',
  });

  return entries
    .map((entry) => {
      const metadata = entry.metadata || {};
      const data = entry.data;
      const normalized = normalizeEntry({
        insertId: metadata.insertId as string,
        timestamp: metadata.timestamp as string,
        severity: metadata.severity as string,
        textPayload: typeof data === 'string' ? data : undefined,
        jsonPayload: typeof data === 'object' ? data as Record<string, unknown> : undefined,
        resource: metadata.resource as { type?: string; labels?: Record<string, string> },
        logName: metadata.logName as string,
        labels: metadata.labels as Record<string, string>,
      });
      normalized.serviceId = serviceId;
      return normalized;
    })
    .reverse();
}

// ══════════════════════════════════════════════════
//  Normalizer (ex normalizer.ts)
// ══════════════════════════════════════════════════

export function normalizeEntry(entry: CloudLoggingEntry): NormalizedLogEntry {
  const source = detectSource(entry);

  if (source === 'cloud-scheduler') {
    return {
      id: entry.insertId || `sch-${entry.timestamp}`,
      timestamp: entry.timestamp || entry.receiveTimestamp || new Date().toISOString(),
      level: 'info', stage: 'scheduler',
      message: entry.textPayload || 'Scheduler triggered',
      runId: null, metrics: {}, source: 'cloud-scheduler',
    };
  }

  // Structured JSON log (svc + stage format)
  const jp = entry.jsonPayload;
  if (jp && jp.svc && jp.stage) {
    return {
      id: entry.insertId || `${jp.svc}-${entry.timestamp}`,
      timestamp: entry.timestamp || (jp.ts as string) || new Date().toISOString(),
      level: mapLevel(jp.level as string),
      stage: jp.stage as string,
      message: jp.msg as string || '',
      runId: (jp.run_id as string) || null,
      metrics: (jp.metrics as Record<string, number>) || {},
      source: detectServiceType(entry),
      meta: jp,
    };
  }

  // Text/unstructured log — try multiple extraction patterns
  const text = entry.textPayload
    || (jp?.message as string)
    || (jp?.msg as string)
    || (jp?.textPayload as string)
    || (jp?.error as string)
    || (jp ? extractMeaningfulText(jp) : '')
    || `[${entry.severity || 'INFO'}]`;
  const tagMatch = text.match(/^\[([A-Z0-9.]+)\]\s*(.*)/);

  return {
    id: entry.insertId || `txt-${entry.timestamp}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    level: mapSeverity(entry.severity),
    stage: tagMatch ? tagMatch[1].toLowerCase() : 'runtime',
    message: tagMatch ? tagMatch[2] : text,
    runId: null, metrics: extractLegacyMetrics(text),
    source: detectServiceType(entry),
  };
}

/** Extract meaningful text from jsonPayload when no known field matches */
function extractMeaningfulText(jp: Record<string, unknown>): string {
  // Skip internal/meta fields
  const skip = new Set(['severity', 'timestamp', 'httpRequest', 'logging.googleapis.com/labels', 'labels']);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(jp)) {
    if (skip.has(k) || v === null || v === undefined) continue;
    if (typeof v === 'string' && v.length > 0 && v.length < 200) {
      parts.push(v);
    }
  }
  return parts.join(' | ').slice(0, 300);
}

// ── Helpers ──

function detectSource(entry: CloudLoggingEntry): string {
  const resourceType = entry.resource?.type || '';
  if (resourceType === 'cloud_scheduler_job') return 'cloud-scheduler';
  return 'service';
}

function detectServiceType(entry: CloudLoggingEntry): 'cloud-run' | 'cloud-function' {
  return entry.resource?.type === 'cloud_run_revision' ? 'cloud-run' : 'cloud-function';
}

function mapSeverity(severity?: string): NormalizedLogEntry['level'] {
  switch (severity?.toUpperCase()) {
    case 'ERROR': case 'CRITICAL': case 'ALERT': case 'EMERGENCY': return 'error';
    case 'WARNING': return 'warn';
    case 'DEBUG': return 'debug';
    default: return 'info';
  }
}

function mapLevel(level?: string): NormalizedLogEntry['level'] {
  if (level === 'success' || level === 'error' || level === 'warn' || level === 'info' || level === 'debug') return level;
  return 'info';
}

function extractLegacyMetrics(text: string): Record<string, number> {
  const metrics: Record<string, number> = {};
  const durMatch = text.match(/(?:dur(?:ation)?[=:]\s*)?(\d+)ms/i);
  if (durMatch) metrics.duration_ms = parseInt(durMatch[1]);
  const rowMatch = text.match(/(?:rows?[=:]\s*)?(\d+)\s*rows?/i);
  if (rowMatch) metrics.rows = parseInt(rowMatch[1]);
  const countMatch = text.match(/(?:(?:count|total|raw|inserted|new)[=:]\s*)(\d+)/i);
  if (countMatch) metrics.count = parseInt(countMatch[1]);
  return metrics;
}

// ══════════════════════════════════════════════════
//  Write: Dashboard → Cloud Logging
//  So FE config changes appear in LogPanel
// ══════════════════════════════════════════════════

const dashboardLog = logging.log('dashboard-console');

export async function writeLog(
  serviceId: string,
  action: string,
  details: Record<string, unknown>,
  level: 'INFO' | 'WARNING' | 'ERROR' = 'INFO',
): Promise<void> {
  try {
    const entry = dashboardLog.entry(
      {
        resource: { type: 'global' },
        severity: level,
        labels: {
          service_id: serviceId,
          source: 'dashboard-console',
        },
      },
      {
        svc: 'dashboard',
        stage: 'config',
        level: level === 'ERROR' ? 'error' : level === 'WARNING' ? 'warn' : 'info',
        msg: `[CONSOLE] ${action}`,
        service: serviceId,
        details,
        ts: new Date().toISOString(),
      },
    );
    await dashboardLog.write(entry);
  } catch (err) {
    console.error('[writeLog] Failed to write to Cloud Logging:', err);
  }
}
