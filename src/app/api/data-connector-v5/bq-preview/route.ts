/**
 * GET /api/data-connector-v5/bq-preview
 *
 * Preview data rows dari BQ table — biar user ga perlu buka BQ console.
 * Per docs SS_V5_SYSTEM.md §12a "BQ Table — Feature Enhancement".
 *
 * Query params:
 *   ?dataset=X&table=Y                     (required)
 *   ?page=1                                (default 1)
 *   ?pageSize=100                          (default 100, max 500)
 *
 * Response:
 *   { ok: true, dataset, table, totalRows, page, pageSize, columns, rows }
 *
 * Security: assertSafeIdent() untuk dataset/table (identifier shell-safe).
 */
import { NextResponse } from 'next/server';
import { PROJECT } from '@/lib/ss-v5/sql-generator';
import { getBigQuery } from '@/lib/ss-v5/firestore-singleton';

const bq = getBigQuery();

const MAX_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 100;

function assertSafeIdent(kind: string, name: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_\-]*$/.test(name)) {
        throw Object.assign(new Error(`INVALID_${kind.toUpperCase()}_IDENT: "${name}"`), {
            code: `INVALID_${kind.toUpperCase()}_IDENT`,
        });
    }
}

/** Normalize BQ row value → JSON-safe primitive. */
function normalizeValue(v: unknown): unknown {
    if (v === null || v === undefined) return null;
    // BigQueryDate / Timestamp objects have `.value` string
    if (typeof v === 'object' && v !== null && 'value' in v) {
        return (v as { value: unknown }).value;
    }
    // BigInt overflow safe
    if (typeof v === 'bigint') return v.toString();
    return v;
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const dataset = url.searchParams.get('dataset');
        const table = url.searchParams.get('table');
        const pageRaw = Number(url.searchParams.get('page') || '1');
        const pageSizeRaw = Number(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE));

        if (!dataset || !table) {
            return NextResponse.json(
                { ok: false, error: 'dataset + table required' },
                { status: 400 }
            );
        }

        assertSafeIdent('dataset', dataset);
        assertSafeIdent('table', table);

        const page = Math.max(1, Math.floor(pageRaw) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSizeRaw) || DEFAULT_PAGE_SIZE));
        const offset = (page - 1) * pageSize;

        // Schema + total rows metadata
        const [meta] = await bq.dataset(dataset).table(table).getMetadata();
        const fields = (meta.schema?.fields ?? []) as Array<{ name: string; type: string }>;
        const totalRows = Number(meta.numRows ?? 0);

        // Fetch page via SQL — pakai LIMIT/OFFSET (simple, deterministic kalau ga ada ORDER)
        const tblFqn = `\`${PROJECT}.${dataset}.${table}\``;
        const sql = `SELECT * FROM ${tblFqn} LIMIT ${pageSize} OFFSET ${offset}`;
        const [rawRows] = await bq.query({ query: sql });

        const rows = rawRows.map((r) => {
            const out: Record<string, unknown> = {};
            for (const f of fields) {
                out[f.name] = normalizeValue((r as Record<string, unknown>)[f.name]);
            }
            return out;
        });

        return NextResponse.json({
            ok: true,
            dataset,
            table,
            totalRows,
            page,
            pageSize,
            columns: fields.map((f) => ({ name: f.name, type: f.type })),
            rows,
        });
    } catch (e) {
        const err = e as { code?: string | number; message?: string };
        console.error('[bq-preview]', e);
        const msg = err.message || String(e);
        const is404 = msg.toLowerCase().includes('not found');
        return NextResponse.json(
            {
                ok: false,
                code: is404 ? 'BQ_TABLE_NOT_FOUND' : err.code || 'INTERNAL_ERROR',
                error: msg,
            },
            { status: is404 ? 404 : 500 }
        );
    }
}
