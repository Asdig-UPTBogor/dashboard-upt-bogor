/**
 * GET /api/data-sources/ss-v5/drift  —  V2 (read ss_platform.drift_events)
 *
 * Return active drift events from `ss_platform.drift_events` table
 * (emitted by CF ss-sync-v2 drift-detector unit).
 *
 * Query params:
 *   - dataset (optional) → filter ke 1 dataset (join via spreadsheet_id lookup V2)
 *
 * Shape:
 *   {
 *     ok: true,
 *     count: number,
 *     alerts: [{
 *       level: 'high'|'medium'|'low',
 *       kind: string,            // event_type (SPREADSHEET_RENAMED, SHEET_RENAMED, HEADER_CHANGED, CELL_DRIFT)
 *       dataset: string,         // doc id di data_sources_v2 (resolved dari spreadsheet_id)
 *       sheet?: string,          // sheet_title kalau sheet-scope
 *       detail: string,          // human-readable dari payload
 *       spreadsheetUrl?: string,
 *       eventId: string,         // referensi ke drift_events.event_id (Accept/Batal flow)
 *       detectedAt: string,
 *     }]
 *   }
 */
import { NextResponse } from 'next/server';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';
import { getFirestore, getBigQuery } from '@/lib/ss-v5/firestore-singleton';
import type { DataSourceV2 } from '@/lib/ss-v5/data-source-schema';

const fs = getFirestore();
const bq = getBigQuery();
const DATA_SOURCES_V2 = 'data_sources_v2';

interface DriftEventRow {
    event_id: string;
    event_type: string;
    severity: string;
    status: string;
    spreadsheet_id: string;
    sheet_id: string | null;
    sheet_title: string | null;
    payload: string | null;
    detected_at: { value: string } | string | null;
}

interface DriftAlert {
    level: 'high' | 'medium' | 'low';
    kind: string;
    dataset: string;
    sheet?: string;
    detail: string;
    spreadsheetUrl?: string;
    eventId: string;
    detectedAt: string | null;
}

function normalizeSeverity(s: string): 'high' | 'medium' | 'low' {
    const up = (s || '').toUpperCase();
    if (up === 'HIGH' || up === 'CRITICAL') return 'high';
    if (up === 'MEDIUM' || up === 'WARN' || up === 'WARNING') return 'medium';
    return 'low';
}

function buildDetail(eventType: string, payloadRaw: string | null, sheetTitle: string | null): string {
    let payload: Record<string, unknown> = {};
    try {
        if (payloadRaw) payload = JSON.parse(payloadRaw);
    } catch {
        /* payload not JSON — fallback to raw */
    }
    const scope = sheetTitle ? `Sheet "${sheetTitle}"` : 'Spreadsheet';
    switch (eventType) {
        case 'SPREADSHEET_RENAMED':
            return `${scope} di-rename: "${payload.oldName ?? '?'}" → "${payload.newName ?? '?'}"`;
        case 'SHEET_RENAMED':
            return `${scope} tab rename: "${payload.oldTitle ?? '?'}" → "${payload.newTitle ?? '?'}"`;
        case 'SHEET_REMOVED':
            return `${scope} dihapus dari Spreadsheet`;
        case 'HEADER_ADDED':
            return `${scope} header baru ditambahkan: ${JSON.stringify(payload.addedColumns ?? [])}`;
        case 'HEADER_REMOVED':
            return `${scope} header dihapus: ${JSON.stringify(payload.removedColumns ?? [])}`;
        case 'HEADER_RENAMED':
            return `${scope} header di-rename: ${JSON.stringify(payload.renames ?? {})}`;
        case 'CELL_DRIFT':
            return `${scope} content hash berubah (rowCount=${payload.rowCount ?? '?'})`;
        default:
            return `${scope} ${eventType} — ${payloadRaw ?? ''}`;
    }
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const filterDataset = url.searchParams.get('dataset');

        // Build spreadsheetId → datasetId + url lookup from V2 FS
        const snap = await fs.collection(DATA_SOURCES_V2).get();
        const spreadsheetMap = new Map<string, { dataset: string; url: string }>();
        for (const d of snap.docs) {
            const data = d.data() as DataSourceV2;
            const driveId = data.identity?.driveId;
            if (!driveId) continue;
            spreadsheetMap.set(driveId, {
                dataset: d.id,
                url: data.identity?.url ?? `https://docs.google.com/spreadsheets/d/${driveId}`,
            });
        }

        // Query drift_events (active only)
        const [rows] = await bq.query({
            query: `
                SELECT event_id, event_type, severity, status, spreadsheet_id,
                       sheet_id, sheet_title, payload, detected_at
                FROM \`${PROJECT}.${SS_PLATFORM}.drift_events\`
                WHERE status = 'active'
                ORDER BY detected_at DESC
                LIMIT 500
            `,
        });

        const alerts: DriftAlert[] = [];
        for (const row of rows as DriftEventRow[]) {
            const meta = spreadsheetMap.get(row.spreadsheet_id);
            if (!meta) continue; // event untuk SS yg ga ter-register V2 → skip
            if (filterDataset && meta.dataset !== filterDataset) continue;

            const detectedAt =
                row.detected_at && typeof row.detected_at === 'object' && 'value' in row.detected_at
                    ? row.detected_at.value
                    : (row.detected_at as string | null);

            alerts.push({
                level: normalizeSeverity(row.severity),
                kind: row.event_type,
                dataset: meta.dataset,
                sheet: row.sheet_title ?? undefined,
                detail: buildDetail(row.event_type, row.payload, row.sheet_title),
                spreadsheetUrl: meta.url,
                eventId: row.event_id,
                detectedAt,
            });
        }

        // Sort: high severity first
        const order = { high: 0, medium: 1, low: 2 };
        alerts.sort((a, b) => order[a.level] - order[b.level]);

        return NextResponse.json({
            ok: true,
            count: alerts.length,
            alerts,
        });
    } catch (e: any) {
        console.error('[drift]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
