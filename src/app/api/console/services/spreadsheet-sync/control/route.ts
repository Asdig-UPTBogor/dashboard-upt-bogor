/**
 * POST /api/console/services/spreadsheet-sync/control  —  V2 native (no DTS/ext)
 *
 * Actions:
 *   pause    — dataset?: toggle `data_sources_v2/{dataset}.syncControl.enabled = false`.
 *              no dataset: pause global Cloud Scheduler job.
 *   resume   — inverse of pause.
 *   trigger  — call CF ss-sync-v2 HTTP trigger; dataset? scoped to 1 spreadsheet.
 *   delete   — delete `data_sources_v2/{dataset}` + drop BQ dataset (destructive).
 *
 * Body: { action, dataset?, confirm? }
 */
import { NextResponse } from 'next/server';
import { CloudSchedulerClient } from '@google-cloud/scheduler';
import { getFirestore, getBigQuery } from '@/lib/ss-v5/firestore-singleton';
import type { DataSourceV2 } from '@/lib/ss-v5/data-source-schema';

const PROJECT = 'gcp-bridge-meshvpn';
const LOCATION = 'asia-southeast2';
const DATA_SOURCES_V2 = 'data_sources_v2';

// Scheduler job untuk trigger CF ss-sync-v2 cycle.
const SCHEDULER_JOB_ID = process.env.SS_SYNC_SCHEDULER_JOB_ID || 'ss-sync-v2-trigger';
const SCHEDULER_JOB_PATH = `projects/${PROJECT}/locations/${LOCATION}/jobs/${SCHEDULER_JOB_ID}`;

// CF V2 HTTP URL — env override allowed
const SS_SYNC_V2_URL =
    process.env.SS_SYNC_V2_URL ||
    `https://${LOCATION}-${PROJECT}.cloudfunctions.net/ss-sync-v2`;

const fs = getFirestore();
const bq = getBigQuery();
const scheduler = new CloudSchedulerClient();

async function callCFV2(body: Record<string, unknown>): Promise<unknown> {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(SS_SYNC_V2_URL);
    const res = await client.request({
        url: SS_SYNC_V2_URL,
        method: 'POST',
        data: body,
        timeout: 9 * 60 * 1000,
    });
    return res.data;
}

async function toggleDatasetEnabled(dataset: string, enabled: boolean): Promise<boolean> {
    const ref = fs.collection(DATA_SOURCES_V2).doc(dataset);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.update({
        'syncControl.enabled': enabled,
        'syncControl.status': 'idle',
        'audit.updatedAt': new Date().toISOString(),
        'audit.updatedBy': 'cloud-console',
    });
    return true;
}

async function toggleGlobalScheduler(pause: boolean): Promise<void> {
    if (pause) {
        await scheduler.pauseJob({ name: SCHEDULER_JOB_PATH });
    } else {
        await scheduler.resumeJob({ name: SCHEDULER_JOB_PATH });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { action, dataset, confirm } = body as {
            action?: string;
            dataset?: string;
            confirm?: boolean;
        };

        if (!action) {
            return NextResponse.json({ ok: false, error: 'action required' }, { status: 400 });
        }

        // ─── PAUSE / RESUME ───
        if (action === 'pause' || action === 'resume') {
            const enabled = action === 'resume';

            if (dataset) {
                // Per-dataset: flip syncControl.enabled di FS V2
                const found = await toggleDatasetEnabled(dataset, enabled);
                if (!found) {
                    return NextResponse.json(
                        { ok: false, error: `data_sources_v2/${dataset} not found` },
                        { status: 404 }
                    );
                }
                return NextResponse.json({
                    ok: true,
                    action,
                    scope: 'dataset',
                    dataset,
                    enabled,
                });
            }

            // Global: pause/resume Cloud Scheduler job
            try {
                await toggleGlobalScheduler(action === 'pause');
                return NextResponse.json({
                    ok: true,
                    action,
                    scope: 'global',
                    scheduler: SCHEDULER_JOB_ID,
                });
            } catch (e: any) {
                return NextResponse.json(
                    { ok: false, error: `Scheduler ${action} failed: ${e.message}` },
                    { status: 500 }
                );
            }
        }

        // ─── TRIGGER ───
        if (action === 'trigger') {
            try {
                const payload = dataset
                    ? { action: 'sync-one', datasetId: dataset }
                    : { action: 'sync-all' };
                const data = await callCFV2(payload);
                return NextResponse.json({
                    ok: true,
                    action,
                    scope: dataset ? 'dataset' : 'global',
                    dataset: dataset ?? null,
                    cfResponse: data,
                });
            } catch (e: any) {
                return NextResponse.json(
                    { ok: false, error: `CF trigger failed: ${e.message}` },
                    { status: 502 }
                );
            }
        }

        // ─── DELETE ───
        if (action === 'delete') {
            if (!dataset) {
                return NextResponse.json({ ok: false, error: 'dataset required' }, { status: 400 });
            }
            if (!confirm) {
                return NextResponse.json(
                    { ok: false, error: 'destructive — pass confirm=true' },
                    { status: 400 }
                );
            }

            const ref = fs.collection(DATA_SOURCES_V2).doc(dataset);
            const snap = await ref.get();
            if (!snap.exists) {
                return NextResponse.json(
                    { ok: false, error: `data_sources_v2/${dataset} not found` },
                    { status: 404 }
                );
            }
            const data = snap.data() as DataSourceV2;
            const sheets = data.sheets ?? {};

            // Drop per-sheet BQ tables
            const droppedTables: string[] = [];
            for (const cfg of Object.values(sheets)) {
                if (!cfg?.bqTable) continue;
                try {
                    await bq
                        .dataset(dataset)
                        .table(cfg.bqTable)
                        .delete({ ignoreNotFound: true } as any);
                    droppedTables.push(cfg.bqTable);
                } catch {
                    /* best-effort */
                }
            }

            // Drop entire BQ dataset (kalau kosong atau force). Safer: leave dataset untuk user cleanup.
            // Kita drop kalau sudah kosong.
            try {
                await bq.dataset(dataset).delete({ force: false } as any);
            } catch {
                /* ignore — dataset mungkin masih punya table lain */
            }

            // Delete FS V2 doc
            await ref.delete();

            return NextResponse.json({
                ok: true,
                action,
                dataset,
                droppedTables,
            });
        }

        return NextResponse.json({ ok: false, error: `Unknown action "${action}"` }, { status: 400 });
    } catch (e: any) {
        console.error('[control]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
