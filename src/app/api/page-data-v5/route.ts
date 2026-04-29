/**
 * GET /api/page-data-v5?page=/gardu-induk/healthy-index&limit=5000
 *
 * V5 page data endpoint — consume `dashboard_pages_v5/{docId}.v5Sources[]` dari DC V5 mapping.
 * Generate dynamic BQ query from saved config. Cache via LRU + version key.
 *
 * V4 endpoint `/api/page-data` tetap jalan untuk legacy pages (Dashboard cloud production).
 * V4 `dashboard_pages/` collection TIDAK di-touch (pisah dari V5).
 * Page migrate V4 → V5 via DC V5 Wizard (simpan `v5Sources`), lalu FE switch hook/route.
 *
 * Response:
 *   {
 *     ok: true,
 *     pagePath, pageLabel,
 *     sources: [
 *       { dataset, table, nodeType, columns: [{name, type}], rows: [...], rowCount }
 *     ],
 *     totalRows, version
 *   }
 */
import { NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';
import { PROJECT, V5_PAGES_COLLECTION, DATA_SOURCES_COLLECTION } from '@/lib/ss-v5/sql-generator';
import { pageToDocId } from '@/lib/ss-v5/helpers';
import { getFirestore, getBigQuery } from '@/lib/ss-v5/firestore-singleton';

const fs = getFirestore();
const bq = getBigQuery();

// LRU per-source cache keyed by `{dataset}::{table}::{version}`
const cache = new LRUCache<string, { rows: any[]; rowCount: number }>({
    max: 200,
    ttl: 1000 * 60 * 30, // 30 min absolute TTL
});

const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 50000;

interface V5Source {
    dataset: string;
    table: string;
    nodeType: string;
    columns: Array<{ name: string; type: string }>;
    useEnrichedView?: boolean;
    includeHierarchy?: boolean;
}

/** Safe column name — backtick wrap untuk handle reserved words + special chars. */
function safeCol(name: string): string {
    return '`' + name.replace(/`/g, '``') + '`';
}

/** Safe table FQN */
function safeTable(dataset: string, table: string): string {
    return `\`${PROJECT}.${dataset}.${table}\``;
}

async function getPageConfig(pagePath: string) {
    const docId = pageToDocId(pagePath);
    const snap = await fs.collection(V5_PAGES_COLLECTION).doc(docId).get();
    if (!snap.exists) return null;
    return { docId, ...snap.data() };
}

/**
 * Version key per source — from data_sources/{dataset}.updatedAt (canonical shape).
 * Invalidate cache saat dataset re-config atau sync completes + state update.
 */
async function getSourceVersion(dataset: string): Promise<string> {
    try {
        const snap = await fs.collection(DATA_SOURCES_COLLECTION).doc(dataset).get();
        if (!snap.exists) return 'unknown';
        const data = snap.data() || {};
        return String(data.updatedAt ?? 'unknown');
    } catch {
        return 'unknown';
    }
}

async function querySource(src: V5Source, limit: number) {
    const version = await getSourceVersion(src.dataset);
    const cacheKey = `${src.dataset}::${src.table}::${version}::${limit}::${src.columns.map((c) => c.name).join(',')}`;
    const cached = cache.get(cacheKey);
    if (cached) return { ...cached, cacheHit: true, version };

    // Build SELECT — kalau columns kosong, SELECT *
    const select =
        src.columns.length > 0
            ? src.columns.map((c) => safeCol(c.name)).join(', ')
            : '*';

    const [rows] = await bq.query({
        query: `SELECT ${select} FROM ${safeTable(src.dataset, src.table)} LIMIT @lim`,
        params: { lim: limit },
    });

    const result = { rows, rowCount: rows.length };
    cache.set(cacheKey, result);
    return { ...result, cacheHit: false, version };
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const pagePath = url.searchParams.get('page');
        const limitRaw = url.searchParams.get('limit');
        const limit = Math.min(
            MAX_LIMIT,
            Math.max(1, Number.parseInt(limitRaw ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
        );

        if (!pagePath) {
            return NextResponse.json(
                { ok: false, error: 'page param required' },
                { status: 400 }
            );
        }

        const config = await getPageConfig(pagePath);
        if (!config) {
            return NextResponse.json(
                { ok: false, error: `No config for page ${pagePath}. Run DC V5 Wizard to map.` },
                { status: 404 }
            );
        }

        const v5Sources = ((config as any).v5Sources ?? []) as V5Source[];
        if (!Array.isArray(v5Sources) || v5Sources.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    error: `Page ${pagePath} belum punya v5Sources. Pakai /maintenance/data-connector-v5 untuk mapping.`,
                },
                { status: 404 }
            );
        }

        // Query all sources parallel
        const sourcePayloads = await Promise.all(
            v5Sources.map(async (src) => {
                try {
                    const res = await querySource(src, limit);
                    return {
                        dataset: src.dataset,
                        table: src.table,
                        nodeType: src.nodeType,
                        columns: src.columns,
                        rows: res.rows,
                        rowCount: res.rowCount,
                        cacheHit: res.cacheHit,
                        version: res.version,
                    };
                } catch (e: any) {
                    return {
                        dataset: src.dataset,
                        table: src.table,
                        nodeType: src.nodeType,
                        columns: src.columns,
                        rows: [],
                        rowCount: 0,
                        cacheHit: false,
                        version: 'error',
                        error: e.message,
                    };
                }
            })
        );

        const totalRows = sourcePayloads.reduce((n, s) => n + s.rowCount, 0);
        const cacheHits = sourcePayloads.filter((s) => s.cacheHit).length;

        return NextResponse.json({
            ok: true,
            pagePath,
            pageLabel: (config as any).pageLabel,
            sources: sourcePayloads,
            totalRows,
            sourceCount: sourcePayloads.length,
            cacheHits,
            v5UpdatedAt: (config as any).v5UpdatedAt,
        });
    } catch (e: any) {
        console.error('[page-data-v5]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

/** Admin: clear cache — POST /api/page-data-v5 { action: "invalidate" } */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        if (body.action === 'invalidate') {
            cache.clear();
            return NextResponse.json({ ok: true, message: 'Cache cleared' });
        }
        if (body.action === 'stats') {
            return NextResponse.json({ ok: true, size: cache.size, max: cache.max });
        }
        return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
