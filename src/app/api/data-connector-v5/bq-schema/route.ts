/**
 * GET /api/data-connector-v5/bq-schema
 *
 * DC V5 — List BQ datasets/tables/columns untuk picker.
 * User rule: DC V5 baca BQ (bukan Sheets API) — per hard rule #5.
 *
 * Query modes:
 *   (no params)                → list all datasets (SS V5 related + user data)
 *   ?dataset=X                  → list tables + views di dataset X
 *   ?dataset=X&table=Y          → list columns di table X.Y (dengan type + description)
 *
 * Response shape:
 *   { ok: true, datasets: [...] }
 *   { ok: true, dataset: "X", tables: [...] }
 *   { ok: true, dataset, table, columns: [{ name, type, mode, description }] }
 */
import { NextResponse } from 'next/server';
import { PROJECT, SS_PLATFORM, INTERNAL } from '@/lib/ss-v5/sql-generator';
import { categorizeDataset, inferNodeType } from '@/lib/ss-v5/helpers';
import { getBigQuery } from '@/lib/ss-v5/firestore-singleton';

const bq = getBigQuery();

/** Dataset whitelist — fokus ke SS V5 related + user data, exclude system/archive */
const ALLOWED_PREFIXES = [
    SS_PLATFORM,
    INTERNAL,
    'Dashboard_',
    'Master_',
    'Mirroring_',
    'Program_',
    'MASTER_HIERARCHY_',
    'thor_vaisala',
    'wagate',
    'waha',
    'notifier_logs',
];

async function listDatasets() {
    const [datasets] = await bq.getDatasets();
    const filtered = datasets
        .filter((d) => {
            const id = d.id || '';
            return ALLOWED_PREFIXES.some((p) => id === p || id.startsWith(p));
        })
        .map((d) => ({
            id: d.id!,
            category: categorizeDataset(d.id!),
        }))
        .sort((a, b) => {
            // engine first, then user_data, then platform, then internal last
            const order = { engine: 0, user_data: 1, platform: 2, internal: 3 };
            return order[a.category] - order[b.category] || a.id.localeCompare(b.id);
        });
    return filtered;
}

async function listTables(datasetId: string) {
    const ds = bq.dataset(datasetId);
    const [tables] = await ds.getTables();
    const entries = await Promise.all(
        tables.map(async (t) => {
            const [meta] = await t.getMetadata();
            const isView = meta.type === 'VIEW';
            return {
                id: t.id!,
                type: inferNodeType(datasetId, t.id!, isView),
                isView,
                rowCount: Number(meta.numRows ?? 0),
                sizeBytes: Number(meta.numBytes ?? 0),
                description: meta.description ?? '',
                updatedAt: meta.lastModifiedTime
                    ? new Date(Number(meta.lastModifiedTime)).toISOString()
                    : null,
            };
        })
    );
    return entries.sort((a, b) => a.id.localeCompare(b.id));
}

async function describeTable(datasetId: string, tableId: string) {
    const [meta] = await bq.dataset(datasetId).table(tableId).getMetadata();
    const fields = (meta.schema?.fields ?? []) as Array<{
        name: string;
        type: string;
        mode?: string;
        description?: string;
    }>;
    return {
        dataset: datasetId,
        table: tableId,
        isView: meta.type === 'VIEW',
        rowCount: Number(meta.numRows ?? 0),
        description: meta.description ?? '',
        columns: fields.map((f) => ({
            name: f.name,
            type: f.type,
            mode: f.mode ?? 'NULLABLE',
            description: f.description ?? '',
        })),
    };
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const dataset = url.searchParams.get('dataset');
        const table = url.searchParams.get('table');

        if (dataset && table) {
            const desc = await describeTable(dataset, table);
            return NextResponse.json({ ok: true, ...desc });
        }
        if (dataset) {
            const tables = await listTables(dataset);
            return NextResponse.json({ ok: true, dataset, tables });
        }
        const datasets = await listDatasets();
        return NextResponse.json({ ok: true, datasets });
    } catch (e: any) {
        console.error('[data-connector-v5/bq-schema]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
