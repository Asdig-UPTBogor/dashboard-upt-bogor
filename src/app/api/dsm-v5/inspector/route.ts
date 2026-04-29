/**
 * GET /api/dsm-v5/inspector?spreadsheetId=<driveId>  —  V2 (read data_sources_v2)
 *
 * Read-only inspector per spreadsheet V2.
 *
 * Returns:
 *   {
 *     ok: true,
 *     spreadsheet: { id, name, url, driveId, isMasterHierarchy, syncEnabled,
 *                    syncStatus, lastDriveModified, lastSyncAt, sheetCount,
 *                    createdAt, updatedAt, configuredAt },
 *     sheets: [{
 *       sheetTabId, tabName, bqTable, levelRef,
 *       schema: { columns, skippedColumns },
 *       syncState: { contentHash, lastSyncAt, rowCount, syncStatus, driftEventId },
 *       recentHistory: [...],     // from ss_platform.sync_history
 *       rejectedSample: [...],    // from ss_platform.rejected_rows
 *       bqTableMeta: {...},
 *     }],
 *     driftAlerts: [...],
 *     driveMeta: ...
 *   }
 *
 * NOTE: pure read-only. Mutation via Cloud Console.
 */
import { NextResponse } from 'next/server';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';
import { getFirestore, getBigQuery } from '@/lib/ss-v5/firestore-singleton';
import type { DataSourceV2, SheetConfigV2 } from '@/lib/ss-v5/data-source-schema';

const fs = getFirestore();
const bq = getBigQuery();

const DATA_SOURCES_V2 = 'data_sources_v2';

type DataSourceV2Doc = DataSourceV2 & { id: string };

async function findDataSource(driveId: string): Promise<DataSourceV2Doc | null> {
    const snap = await fs.collection(DATA_SOURCES_V2).get();
    for (const d of snap.docs) {
        const data = d.data() as DataSourceV2;
        if (data.identity?.driveId === driveId) {
            return { ...data, id: d.id };
        }
    }
    return null;
}

async function getSyncStateAndHistory(bqDataset: string) {
    // State table reflects state dari CF ss-sync V2 (keyed by sheet_tab_id eventually;
    // legacy row masih pake bq_dataset_name == tableName)
    const [allState] = await bq.query({
        query: `
            SELECT spreadsheet_id, spreadsheet_title, sheet_name, bq_dataset_name,
                   content_hash, drive_modified_time, last_synced_at, last_sync_status,
                   row_count_total, row_count_valid, row_count_rejected
            FROM \`${PROJECT}.${SS_PLATFORM}.sheet_sync_state\`
        `,
    });

    const [history] = await bq.query({
        query: `
            SELECT run_id, started_at, finished_at, trigger_source, dataset_name, sheet_name,
                   status, skipped_reason, rows_read, rows_written, rows_rejected, duration_ms, error_message
            FROM \`${PROJECT}.${SS_PLATFORM}.sync_history\`
            WHERE dataset_name = @ds AND started_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
            ORDER BY started_at DESC
            LIMIT 200
        `,
        params: { ds: bqDataset },
    });

    return { state: allState, history };
}

async function getRejected(bqDataset: string) {
    const [rows] = await bq.query({
        query: `
            SELECT rejection_key, spreadsheet_id, spreadsheet_name, spreadsheet_title,
                   source_dataset, source_sheet, row_pk_value, row_number, column_name,
                   cell_value, reason_code, reason_message, status, first_seen_at, last_seen_at
            FROM \`${PROJECT}.${SS_PLATFORM}.rejected_rows\`
            WHERE source_dataset = @ds AND status = 'active'
            ORDER BY last_seen_at DESC
            LIMIT 500
        `,
        params: { ds: bqDataset },
    });
    return rows;
}

async function getBqTableMeta(dataset: string, table: string) {
    try {
        const [meta] = await bq.dataset(dataset).table(table).getMetadata();
        return {
            exists: true,
            rowCount: Number(meta.numRows ?? 0),
            sizeBytes: Number(meta.numBytes ?? 0),
            updatedAt: meta.lastModifiedTime
                ? new Date(Number(meta.lastModifiedTime)).toISOString()
                : null,
            schemaFieldCount: meta.schema?.fields?.length ?? 0,
        };
    } catch {
        return { exists: false, rowCount: 0, sizeBytes: 0, updatedAt: null, schemaFieldCount: 0 };
    }
}

async function getDriveMeta(spreadsheetId: string) {
    try {
        const [rows] = await bq.query({
            query: `
                SELECT spreadsheet_id, name, modified_time, owner_email, last_modified_by,
                       web_view_link, can_edit, fetched_at
                FROM \`${PROJECT}.${SS_PLATFORM}.drive_metadata_log\`
                WHERE spreadsheet_id = @id
                ORDER BY fetched_at DESC
                LIMIT 1
            `,
            params: { id: spreadsheetId },
        });
        return rows[0] ?? null;
    } catch {
        return null;
    }
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const spreadsheetId = url.searchParams.get('spreadsheetId');

        if (!spreadsheetId) {
            // List mode — return all registered spreadsheet summary (V2)
            const snap = await fs.collection(DATA_SOURCES_V2).get();
            const spreadsheets = snap.docs
                .map((d) => {
                    const data = d.data() as DataSourceV2;
                    return {
                        id: d.id,
                        driveId: data.identity?.driveId ?? '',
                        name: data.identity?.name ?? d.id,
                        url: data.identity?.url ?? '',
                        bqDataset: d.id,
                        isMasterHierarchy: data.identity?.isMasterHierarchy ?? false,
                        syncEnabled: data.syncControl?.enabled ?? false,
                        syncStatus: data.syncControl?.status ?? 'idle',
                        sheetCount: Object.keys(data.sheets ?? {}).length,
                        lastSyncAt: data.syncControl?.lastSyncAt ?? null,
                        updatedAt: data.audit?.updatedAt ?? null,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
            return NextResponse.json({ ok: true, spreadsheets });
        }

        // Detail mode
        const ds = await findDataSource(spreadsheetId);
        if (!ds) {
            return NextResponse.json({ ok: false, error: 'Spreadsheet not found di data_sources_v2' }, { status: 404 });
        }

        const bqDataset = ds.id;
        const { state, history } = await getSyncStateAndHistory(bqDataset);
        const rejected = await getRejected(bqDataset);
        const driveMeta = await getDriveMeta(spreadsheetId);

        // Per sheet: gabungkan config V2 + syncState (FS + BQ fallback) + history + rejected sample + BQ meta
        const sheetEntries: Array<[string, SheetConfigV2]> = Object.entries(ds.sheets ?? {});
        const sheets = await Promise.all(
            sheetEntries.map(async ([sheetTabId, cfg]) => {
                // BQ state lookup — match tableName (V1) OR sheet_name (stringified tabId)
                const bqState = state.find(
                    (s: any) =>
                        s.bq_dataset_name === cfg.bqTable ||
                        s.sheet_name === sheetTabId ||
                        s.sheet_name === cfg.tabName
                );
                const recentHistory = history
                    .filter((h: any) => h.sheet_name === cfg.tabName || h.sheet_name === sheetTabId)
                    .slice(0, 10);
                const rejectedSample = rejected
                    .filter((r: any) => r.source_sheet === cfg.tabName || r.source_sheet === cfg.bqTable)
                    .slice(0, 20);
                const bqTableMeta = await getBqTableMeta(bqDataset, cfg.bqTable);
                return {
                    sheetTabId,
                    tabName: cfg.tabName,
                    bqTable: cfg.bqTable,
                    levelRef: cfg.levelRef,
                    schema: cfg.schema,
                    syncState: {
                        contentHash: cfg.syncState?.contentHash ?? bqState?.content_hash ?? null,
                        lastSyncAt:
                            cfg.syncState?.lastSyncAt ??
                            bqState?.last_synced_at?.value ??
                            bqState?.last_synced_at ??
                            null,
                        rowCount: cfg.syncState?.rowCount ?? Number(bqState?.row_count_total ?? 0),
                        rowCountValid: Number(bqState?.row_count_valid ?? 0),
                        rowCountRejected: Number(bqState?.row_count_rejected ?? 0),
                        syncStatus: cfg.syncState?.syncStatus ?? 'idle',
                        driftEventId: cfg.syncState?.driftEventId ?? null,
                        lastSyncStatus: bqState?.last_sync_status ?? null,
                    },
                    recentHistory: recentHistory.map((h: any) => ({
                        run_id: h.run_id,
                        started_at: h.started_at?.value ?? h.started_at,
                        status: h.status,
                        skipped_reason: h.skipped_reason,
                        rows_read: Number(h.rows_read ?? 0),
                        rows_written: Number(h.rows_written ?? 0),
                        rows_rejected: Number(h.rows_rejected ?? 0),
                        duration_ms: Number(h.duration_ms ?? 0),
                        error_message: h.error_message,
                    })),
                    rejectedSample: rejectedSample.map((r: any) => ({
                        rejection_key: String(r.rejection_key),
                        row_pk_value: r.row_pk_value,
                        row_number: Number(r.row_number ?? 0),
                        column_name: r.column_name,
                        cell_value: r.cell_value,
                        reason_code: r.reason_code,
                        reason_message: r.reason_message,
                        first_seen_at: r.first_seen_at?.value ?? r.first_seen_at,
                        last_seen_at: r.last_seen_at?.value ?? r.last_seen_at,
                    })),
                    bqTableMeta,
                };
            })
        );

        // Drift detection (simple heuristics from cross-referencing FS V2 syncState + BQ state)
        const driftAlerts: Array<{
            level: 'high' | 'medium' | 'low';
            sheet: string;
            kind: string;
            detail: string;
        }> = [];

        for (const s of sheets) {
            if (!s.bqTableMeta.exists) {
                driftAlerts.push({
                    level: 'high',
                    sheet: s.tabName,
                    kind: 'BQ_TABLE_MISSING',
                    detail: `Tabel BQ ${bqDataset}.${s.bqTable} tidak exist — sync mungkin belum jalan`,
                });
            }
            if (s.syncState.syncStatus === 'halted' && s.syncState.driftEventId) {
                driftAlerts.push({
                    level: 'high',
                    sheet: s.tabName,
                    kind: 'SYNC_HALTED',
                    detail: `Sync di-halt karena drift event ${s.syncState.driftEventId}`,
                });
            }
            if (s.syncState.lastSyncStatus === 'error') {
                driftAlerts.push({
                    level: 'high',
                    sheet: s.tabName,
                    kind: 'LAST_SYNC_ERROR',
                    detail: `Last sync status = error`,
                });
            }
            const total = s.syncState.rowCount;
            const rejected = s.syncState.rowCountRejected;
            if (total > 0 && rejected > total * 0.1) {
                driftAlerts.push({
                    level: 'medium',
                    sheet: s.tabName,
                    kind: 'HIGH_REJECT_RATE',
                    detail: `${rejected} rejected dari ${total} total (${Math.round((rejected / total) * 100)}%)`,
                });
            }
        }

        return NextResponse.json({
            ok: true,
            spreadsheet: {
                id: ds.id,
                driveId: ds.identity?.driveId ?? '',
                name: ds.identity?.name ?? ds.id,
                url: ds.identity?.url ?? '',
                bqDataset,
                isMasterHierarchy: ds.identity?.isMasterHierarchy ?? false,
                syncEnabled: ds.syncControl?.enabled ?? false,
                syncStatus: ds.syncControl?.status ?? 'idle',
                lastDriveModified: ds.syncControl?.lastDriveModified ?? null,
                lastSyncAt: ds.syncControl?.lastSyncAt ?? null,
                sheetCount: sheetEntries.length,
                createdAt: ds.audit?.createdAt ?? null,
                updatedAt: ds.audit?.updatedAt ?? null,
                configuredAt: ds.audit?.configuredAt ?? null,
            },
            sheets,
            driftAlerts,
            driveMeta,
        });
    } catch (e: any) {
        console.error('[dsm-v5/inspector]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
