/**
 * POST /api/ss-v5/wizard/create  —  V2 (full native, no DTS/ext)
 *
 * Register spreadsheet ke pipeline V2 2-gate sync. Scope sempit:
 *   1. Validate body
 *   2. Create BQ dataset kalau belum exist
 *   3. Fetch Drive metadata + per-sheet (sheetTabId, headers)
 *   4. Build canonical `DataSourceV2` shape
 *   5. Write `data_sources_v2/{datasetId}` (merge:false, clean shape)
 *
 * ZERO V1 legacy:
 *   - No DTS createTransferConfig
 *   - No `_internal.ext_*` table setup
 *   - No write ke `data_sources/` V1 collection
 *   - No first-sync trigger (CF `ss-sync-v2` cycle pick up sendiri via Scheduler)
 *
 * FK enrichment di-setup TERPISAH via Data Level Config page
 * (writes `bq_table_levels/{dataset}__{table}` → SheetConfigV2.levelRef).
 */
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import {
    normalizeDataSourceV2,
    type DataSourceV2,
    type SheetConfigV2,
} from '@/lib/ss-v5/data-source-schema';
import { LOCATION, toSafeName } from '@/lib/ss-v5/sql-generator';
import { getFirestore, getBigQuery } from '@/lib/ss-v5/firestore-singleton';

const DATA_SOURCES_V2 = 'data_sources_v2';

const fs = getFirestore();
const bq = getBigQuery();

interface WizardSheetPayload {
    tableName: string;
    // hierarchyLevel dan pkColumn dari FE V2 diabaikan — V2 Mode C (Full Replace)
    // + level setup terpisah via Data Level Config page.
}

interface WizardCreateBody {
    datasetId: string;
    spreadsheetId: string;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    isMasterHierarchy?: boolean;
    syncEnabled?: boolean;
    sheets: Record<string, WizardSheetPayload>;
}

/**
 * Fetch Drive + Sheets metadata untuk build SheetConfigV2.
 * Return map keyed by sheet title (FE payload key).
 */
async function fetchSheetMetadata(
    spreadsheetId: string
): Promise<{
    driveId: string;
    driveName: string;
    driveUrl: string;
    sheetsByTitle: Map<string, { sheetTabId: number; headers: string[] }>;
}> {
    const auth = new GoogleAuth({
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.metadata.readonly',
        ],
    });
    const client = await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: client as any });
    const driveApi = google.drive({ version: 'v3', auth: client as any });

    const driveResp = await driveApi.files.get({
        fileId: spreadsheetId,
        fields: 'id,name,webViewLink',
    });

    const ssResp = await sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(sheetId,title)',
    });

    const sheetList = ssResp.data.sheets ?? [];
    const byTitle = new Map<string, { sheetTabId: number; headers: string[] }>();

    // Fetch headers parallel per sheet
    await Promise.all(
        sheetList.map(async (s) => {
            const title = s.properties?.title ?? '';
            const sheetTabId = s.properties?.sheetId ?? 0;
            if (!title) return;
            try {
                const hResp = await sheetsApi.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${title}!A1:ZZ1`,
                });
                const headers = (hResp.data.values?.[0] ?? []).map((h) =>
                    String(h).trim()
                );
                byTitle.set(title, { sheetTabId, headers });
            } catch {
                byTitle.set(title, { sheetTabId, headers: [] });
            }
        })
    );

    return {
        driveId: driveResp.data.id ?? spreadsheetId,
        driveName: driveResp.data.name ?? '',
        driveUrl:
            driveResp.data.webViewLink ??
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        sheetsByTitle: byTitle,
    };
}

/**
 * Dari raw headers → { columns (safeName included), skippedColumns (letter header kosong) }.
 * G10 rule: header kosong di row 1 = skip kolom (placeholder).
 */
function buildSchemaFromHeaders(rawHeaders: string[]): {
    columns: string[];
    skippedColumns: string[];
} {
    const columns: string[] = [];
    const skippedColumns: string[] = [];
    const used = new Set<string>();

    rawHeaders.forEach((h, idx) => {
        const letter = columnLetter(idx);
        const trimmed = h.trim();
        if (!trimmed) {
            skippedColumns.push(letter);
            return;
        }
        let safeName = toSafeName(trimmed) || `col_${idx + 1}`;
        let finalName = safeName;
        let suffix = 2;
        while (used.has(finalName)) {
            finalName = `${safeName}_${suffix++}`;
        }
        used.add(finalName);
        columns.push(finalName);
    });

    return { columns, skippedColumns };
}

/** 0 → 'A', 25 → 'Z', 26 → 'AA' */
function columnLetter(idx: number): string {
    let s = '';
    let n = idx;
    while (n >= 0) {
        s = String.fromCharCode((n % 26) + 65) + s;
        n = Math.floor(n / 26) - 1;
    }
    return s;
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as WizardCreateBody;
        const {
            datasetId,
            spreadsheetId,
            spreadsheetName,
            spreadsheetUrl,
            isMasterHierarchy = false,
            syncEnabled = true,
            sheets,
        } = body;

        if (!datasetId || !spreadsheetId || !sheets || Object.keys(sheets).length === 0) {
            return NextResponse.json(
                { ok: false, error: 'datasetId, spreadsheetId, sheets (non-empty) required' },
                { status: 400 }
            );
        }

        // 1. Create BQ dataset kalau belum exist
        const [exists] = await bq.dataset(datasetId).exists();
        if (!exists) {
            await bq.createDataset(datasetId, { location: LOCATION });
        }

        // 2. Fetch Drive + Sheets metadata
        const meta = await fetchSheetMetadata(spreadsheetId);

        // 3. Build sheets map keyed by sheetTabId (V2 convention — permanent ID)
        const sheetsV2: Record<string, SheetConfigV2> = {};
        const results: Array<{ sheet: string; ok: boolean; sheetTabId?: number; error?: string }> = [];

        for (const [sheetTitle, payload] of Object.entries(sheets)) {
            const sheetMeta = meta.sheetsByTitle.get(sheetTitle);
            if (!sheetMeta) {
                results.push({
                    sheet: sheetTitle,
                    ok: false,
                    error: `Sheet "${sheetTitle}" not found di spreadsheet`,
                });
                continue;
            }
            if (!payload.tableName) {
                results.push({ sheet: sheetTitle, ok: false, error: 'tableName required' });
                continue;
            }

            const schema = buildSchemaFromHeaders(sheetMeta.headers);
            const key = String(sheetMeta.sheetTabId);
            sheetsV2[key] = {
                bqTable: payload.tableName,
                tabName: sheetTitle,
                syncState: {
                    contentHash: null,
                    lastSyncAt: null,
                    rowCount: 0,
                    syncStatus: 'idle',
                    driftEventId: null,
                },
                schema,
                levelRef: null,
            };
            results.push({ sheet: sheetTitle, ok: true, sheetTabId: sheetMeta.sheetTabId });
        }

        const okCount = results.filter((r) => r.ok).length;
        if (okCount === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    error: 'Zero sheet berhasil di-register. Cek detail error per-sheet.',
                    datasetId,
                    results,
                },
                { status: 500 }
            );
        }

        // 4. Build canonical DataSourceV2
        const now = new Date().toISOString();
        const canonical: DataSourceV2 = normalizeDataSourceV2({
            _id: datasetId,
            identity: {
                name: spreadsheetName || meta.driveName || datasetId,
                url: spreadsheetUrl || meta.driveUrl,
                driveId: meta.driveId,
                isMasterHierarchy,
            },
            syncControl: {
                enabled: syncEnabled,
                status: 'idle',
                // lastDriveModified=null → Gate 1 first cycle akan load semua (no skip)
                lastDriveModified: null,
                lastSyncAt: null,
            },
            sheets: sheetsV2,
            audit: {
                createdAt: now,
                createdBy: 'wizard',
                updatedAt: now,
                updatedBy: 'wizard',
                configuredAt: now,
            },
        });

        // 5. Write Firestore (merge:false — ensure exactly canonical shape)
        await fs
            .collection(DATA_SOURCES_V2)
            .doc(datasetId)
            .set(canonical as unknown as Record<string, unknown>, { merge: false });

        return NextResponse.json({
            ok: true,
            datasetId,
            sheetCount: Object.keys(sheets).length,
            created: okCount,
            failed: results.filter((r) => !r.ok).length,
            results,
            message:
                okCount === Object.keys(sheets).length
                    ? `${okCount} sheet registered di data_sources_v2/${datasetId}. CF ss-sync-v2 akan pickup di cycle berikutnya.`
                    : `${okCount}/${Object.keys(sheets).length} sheet registered. Sheet error bisa di-retry.`,
        });
    } catch (e: any) {
        console.error('[wizard/create]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export type { DataSourceV2 };
