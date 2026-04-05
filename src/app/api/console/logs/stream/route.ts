/**
 * Unified Log Stream — SSE endpoint (Tail-based, Self-Healing)
 *
 * GET /api/console/logs/stream
 *
 * 1. Backfill: getEntries() for last 30 min history
 * 2. Tail: tailEntries() gRPC duplex stream for real-time
 *    - gRPC keepalive (60s PING) to prevent idle connection drop
 *    - Auto-retry with exponential backoff on tail error/end
 *    - Gap re-backfill on reconnect (fetch entries from lastTimestamp)
 * 3. Enriched heartbeat: mode, lastEntryTime, retryCount
 *
 * Each entry includes `serviceId` so the FE can filter client-side.
 *
 * SDK tailEntries format:
 *   stream.on('data', resp => {
 *     resp.entries  — Array<Entry> (same Entry objects as getEntries)
 *     resp.suppressionInfo — suppression metadata
 *   })
 */

import { NextRequest } from 'next/server';
import { Logging } from '@google-cloud/logging';
import { getActiveServices, PROJECT_ID, type ServiceDefinition } from '../../_lib/firestore';
import { normalizeEntry, buildServiceFilter, type NormalizedLogEntry } from '../../_lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 15_000;
const MAX_LIFETIME_MS = 55 * 60 * 1000; // 55 min (up from 30 — gives keepalive time to work)
const TAIL_MAX_RETRIES = 5;
const TAIL_BACKOFF_BASE_MS = 2_000;
const TAIL_BACKOFF_MAX_MS = 30_000;

// ── Helper: convert SDK Entry → NormalizedLogEntry ──
function processEntry(
  entry: { metadata?: Record<string, unknown>; data?: unknown },
  serviceNameMap: Record<string, string>,
): NormalizedLogEntry | null {
  try {
    const metadata = (entry.metadata || {}) as Record<string, unknown>;
    const data = entry.data;
    const resource = metadata.resource as
      | { type?: string; labels?: Record<string, string> }
      | undefined;
    const svcName =
      resource?.labels?.service_name ||
      resource?.labels?.function_name ||
      '';
    // Dashboard-console entries use labels.service_id instead of resource labels
    const entryLabels = metadata.labels as Record<string, string> | undefined;
    const serviceId = serviceNameMap[svcName] || entryLabels?.service_id || 'unknown';

    const normalized = normalizeEntry({
      insertId: metadata.insertId as string,
      timestamp: metadata.timestamp as string,
      severity: metadata.severity as string,
      textPayload: typeof data === 'string' ? data : undefined,
      jsonPayload:
        typeof data === 'object'
          ? (data as Record<string, unknown>)
          : undefined,
      resource,
      logName: metadata.logName as string,
      labels: metadata.labels as Record<string, string>,
    });
    normalized.serviceId = serviceId;
    return normalized;
  } catch {
    return null;
  }
}

export async function GET(_request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: string, event?: string) => {
        if (closed) return;
        try {
          if (event) controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      // ── 1. Build filter from Firestore registry ──
      let activeServices: Record<string, ServiceDefinition>;
      try {
        activeServices = await getActiveServices();
      } catch (err) {
        send(JSON.stringify({ type: 'error', message: `Registry: ${err}` }), 'status');
        controller.close();
        return;
      }

      const serviceIds = Object.keys(activeServices);
      if (serviceIds.length === 0) {
        send(JSON.stringify({ type: 'error', message: 'No active services in registry' }), 'status');
        controller.close();
        return;
      }

      // Build filter — CF Gen2 logs muncul di KEDUA resource type (per GCP docs)
      const serviceNameMap: Record<string, string> = {};
      const filterParts: string[] = [];
      for (const [id, def] of Object.entries(activeServices)) {
        serviceNameMap[def.logServiceName] = id;
        if (def.serviceType === 'cloud_function') {
          // CF Gen2: OR — tangkap application logs + lifecycle logs
          filterParts.push(`(resource.type="cloud_run_revision" AND resource.labels.service_name="${def.logServiceName}")`);
          filterParts.push(`(resource.type="cloud_function" AND resource.labels.function_name="${def.logServiceName}")`);
        } else {
          // Cloud Run: single filter
          filterParts.push(`(resource.type="cloud_run_revision" AND resource.labels.service_name="${def.logServiceName}")`);
        }
      }
      // Include dashboard-console log entries (config changes from FE)
      filterParts.push(`logName="projects/${PROJECT_ID}/logs/dashboard-console"`);
      const resourceFilter = filterParts.join(' OR ');

      // ── Logging client with gRPC keepalive ──
      // Keepalive sends HTTP/2 PING every 60s to prevent idle connection drop
      // by Load Balancers (~10 min idle timeout)
      const logging = new Logging({
        projectId: PROJECT_ID,
        // @ts-expect-error - grpcOptions is valid for google-gax but omitted from LoggingOptions
        grpcOptions: {
          'grpc.keepalive_time_ms': 60000,
          'grpc.keepalive_timeout_ms': 20000,
          'grpc.keepalive_permit_without_calls': 1,
        },
      });

      const seenIds = new Set<string>();
      let lastEntryTime = '';
      let entriesDelivered = 0;
      let tailMode: 'starting' | 'tailing' | 'retrying' | 'failed' = 'starting';
      let tailRetryCount = 0;

      // Track timestamps for gap recovery
      const trackEntry = (entry: NormalizedLogEntry) => {
        seenIds.add(entry.id);
        entriesDelivered++;
        if (entry.timestamp > lastEntryTime) {
          lastEntryTime = entry.timestamp;
        }
      };

      // ── 2. Backfill (last 30 min) ──
      try {
        const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const [rawEntries] = await logging.getEntries({
          filter: `(${resourceFilter}) AND timestamp >= "${since}"`,
          pageSize: 500,
          orderBy: 'timestamp desc',
        });

        const entries = rawEntries
          .map((e) =>
            processEntry(
              e as unknown as { metadata?: Record<string, unknown>; data?: unknown },
              serviceNameMap,
            ),
          )
          .filter(Boolean) as NormalizedLogEntry[];

        // Send oldest-first for chronological append
        entries.reverse().forEach((entry) => {
          trackEntry(entry);
          send(JSON.stringify(entry));
        });

        send(
          JSON.stringify({ type: 'backfill_complete', count: entries.length }),
          'status',
        );
      } catch (err) {
        console.error('[stream] Backfill error:', String(err).slice(0, 200));
        send(
          JSON.stringify({ type: 'error', message: `Backfill: ${String(err).slice(0, 100)}` }),
          'status',
        );
      }

      // ── 3. Tail with auto-retry ──
      let currentTail: ReturnType<typeof logging.tailEntries> | null = null;
      let tailRetryTimeout: ReturnType<typeof setTimeout> | null = null;

      // Re-backfill gap entries after tail reconnect
      async function backfillGap() {
        if (!lastEntryTime) return;
        try {
          const since = new Date(new Date(lastEntryTime).getTime() - 5000).toISOString(); // 5s overlap for safety
          const [rawEntries] = await logging.getEntries({
            filter: `(${resourceFilter}) AND timestamp >= "${since}"`,
            pageSize: 200,
            orderBy: 'timestamp desc',
          });

          const entries = rawEntries
            .map((e) =>
              processEntry(
                e as unknown as { metadata?: Record<string, unknown>; data?: unknown },
                serviceNameMap,
              ),
            )
            .filter(Boolean) as NormalizedLogEntry[];

          let gapCount = 0;
          entries.reverse().forEach((entry) => {
            if (!seenIds.has(entry.id)) {
              trackEntry(entry);
              send(JSON.stringify(entry));
              gapCount++;
            }
          });

          if (gapCount > 0) {
            console.log(`[stream] Gap backfill: recovered ${gapCount} entries`);
          }
        } catch (err) {
          console.error('[stream] Gap backfill error:', String(err).slice(0, 100));
        }
      }

      function startTail() {
        if (closed) return;

        try {
          currentTail = logging.tailEntries({
            filter: resourceFilter,
          });

          currentTail.on(
            'data',
            (resp: { entries?: Array<{ metadata?: Record<string, unknown>; data?: unknown }> }) => {
              if (!resp.entries) return;
              for (const rawEntry of resp.entries) {
                const entry = processEntry(rawEntry, serviceNameMap);
                if (entry && !seenIds.has(entry.id)) {
                  trackEntry(entry);
                  send(JSON.stringify(entry));
                }
              }
              // Prune to prevent memory leak
              if (seenIds.size > 2000) {
                const arr = Array.from(seenIds);
                arr.slice(0, arr.length - 1000).forEach((id) => seenIds.delete(id));
              }
            },
          );

          currentTail.on('error', (err: Error) => {
            const msg = err.message?.slice(0, 200) || 'Unknown tail error';
            console.error(`[stream] Tail error (attempt ${tailRetryCount}): ${msg}`);

            // Don't retry on permanent errors
            if (msg.includes('PERMISSION_DENIED') || msg.includes('INVALID_ARGUMENT')) {
              tailMode = 'failed';
              send(
                JSON.stringify({ type: 'tail_failed', message: msg.slice(0, 100), permanent: true }),
                'status',
              );
              return;
            }

            // Retry transient errors
            scheduleTailRetry();
          });

          currentTail.on('end', () => {
            console.log('[stream] Tail stream ended');
            scheduleTailRetry();
          });

          // If we get here, tail started successfully
          tailMode = 'tailing';
          tailRetryCount = 0; // Reset on successful start
          send(JSON.stringify({ type: 'tail_started' }), 'status');
        } catch (err) {
          console.error('[stream] Tail setup failed:', err);
          scheduleTailRetry();
        }
      }

      function scheduleTailRetry() {
        if (closed) return;

        // Destroy old tail cleanly
        try { currentTail?.end(); } catch { /* ignore */ }
        currentTail = null;

        if (tailRetryCount >= TAIL_MAX_RETRIES) {
          tailMode = 'failed';
          send(
            JSON.stringify({
              type: 'tail_failed',
              message: `Max retries (${TAIL_MAX_RETRIES}) exceeded`,
              retryCount: tailRetryCount,
            }),
            'status',
          );
          console.error(`[stream] Tail failed after ${TAIL_MAX_RETRIES} retries`);
          return;
        }

        tailMode = 'retrying';
        tailRetryCount++;
        const delay = Math.min(
          TAIL_BACKOFF_BASE_MS * Math.pow(2, tailRetryCount - 1),
          TAIL_BACKOFF_MAX_MS,
        );

        send(
          JSON.stringify({
            type: 'tail_retrying',
            attempt: tailRetryCount,
            maxRetries: TAIL_MAX_RETRIES,
            nextRetryMs: delay,
          }),
          'status',
        );

        console.log(`[stream] Tail retry ${tailRetryCount}/${TAIL_MAX_RETRIES} in ${delay}ms`);

        tailRetryTimeout = setTimeout(async () => {
          // Re-backfill gap entries before restarting tail
          await backfillGap();
          startTail();
        }, delay);
      }

      // Start initial tail
      startTail();

      // ── 4. Enriched Heartbeat ──
      const heartbeat = setInterval(() => {
        send(
          JSON.stringify({
            type: 'heartbeat',
            ts: Date.now(),
            mode: tailMode,
            lastEntryTime: lastEntryTime || null,
            entriesDelivered,
            tailRetryCount,
          }),
          'status',
        );
      }, HEARTBEAT_MS);

      // ── 5. Max lifetime guard ──
      const deadline = setTimeout(() => {
        try { currentTail?.end(); } catch { /* ignore */ }
        if (tailRetryTimeout) clearTimeout(tailRetryTimeout);
        clearInterval(heartbeat);
        send(JSON.stringify({ type: 'stream_expired' }), 'status');
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }, MAX_LIFETIME_MS);

      // ── 6. Cleanup on disconnect ──
      _request.signal.addEventListener('abort', () => {
        try { currentTail?.end(); } catch { /* ignore */ }
        if (tailRetryTimeout) clearTimeout(tailRetryTimeout);
        clearInterval(heartbeat);
        clearTimeout(deadline);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
