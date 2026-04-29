/**
 * POST /api/data-connector-v5/mapping
 *
 * Save page ↔ BQ table mapping ke Firestore `dashboard_pages_v5/{pageId}.v5Sources`.
 * V4 `dashboard_pages/` tidak disentuh (Dashboard cloud production pakai V4 collection).
 *
 * Input:
 *   {
 *     pagePath: "/gardu-induk/healthy-index",
 *     pageLabel: "Healthy Index Trafo",
 *     v5Sources: [
 *       {
 *         dataset: "Dashboard_Gardu_Induk_UPT_Bogor",
 *         table: "n_MTU_TRAFO",
 *         nodeType: "n_table",
 *         columns: [{ name: "MTU", type: "STRING" }, { name: "Master_Gardu_Induk", type: "STRING" }, ...],
 *         useEnrichedView: false,
 *         includeHierarchy: true,
 *       }
 *     ]
 *   }
 *
 * GET /api/data-connector-v5/mapping?page=X → return current mapping
 */
import { NextResponse } from 'next/server';
import { getFirestore } from '@/lib/ss-v5/firestore-singleton';
import { pageToDocId } from '@/lib/ss-v5/helpers';
import { V5_PAGES_COLLECTION } from '@/lib/ss-v5/sql-generator';

const fs = getFirestore();

interface V5Source {
    dataset: string;
    table: string;
    nodeType: 'ext' | 'n_table' | 'dim' | 'rejected' | 'view' | 'raw';
    columns: Array<{ name: string; type: string }>;
    useEnrichedView?: boolean;
    includeHierarchy?: boolean;
}

interface V5Relation {
    id: string;
    fromDataset: string;
    fromTable: string;
    fromColumn: string;
    toDataset: string;
    toTable: string;
    toColumn: string;
    joinType?: 'left' | 'inner' | 'right';
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { pagePath, pageLabel, v5Sources, nodePositions, relations } = body as {
            pagePath: string;
            pageLabel: string;
            v5Sources: V5Source[];
            nodePositions?: Record<string, { x: number; y: number }>;
            relations?: V5Relation[];
        };

        if (!pagePath || !Array.isArray(v5Sources)) {
            return NextResponse.json(
                { ok: false, error: 'pagePath + v5Sources required' },
                { status: 400 }
            );
        }

        const docId = pageToDocId(pagePath);
        const doc = fs.collection(V5_PAGES_COLLECTION).doc(docId);
        const payload: Record<string, unknown> = {
            pagePath,
            pageLabel: pageLabel || pagePath,
            v5Sources,
            v5UpdatedAt: new Date().toISOString(),
        };
        if (nodePositions) payload.nodePositions = nodePositions;
        if (relations) payload.relations = relations;

        await doc.set(payload, { merge: true });

        return NextResponse.json({
            ok: true,
            docId,
            sourceCount: v5Sources.length,
            columnCount: v5Sources.reduce((n, s) => n + s.columns.length, 0),
            relationCount: relations?.length ?? 0,
            savedPositions: !!nodePositions,
        });
    } catch (e: any) {
        console.error('[data-connector-v5/mapping POST]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const pagePath = url.searchParams.get('page');
        if (!pagePath) {
            return NextResponse.json({ ok: false, error: 'page param required' }, { status: 400 });
        }
        const docId = pageToDocId(pagePath);
        const snap = await fs.collection(V5_PAGES_COLLECTION).doc(docId).get();
        if (!snap.exists) {
            return NextResponse.json({ ok: true, docId, pagePath, v5Sources: [] });
        }
        const data = snap.data() || {};
        return NextResponse.json({
            ok: true,
            docId,
            pagePath,
            pageLabel: data.pageLabel,
            v5Sources: data.v5Sources ?? [],
            nodePositions: data.nodePositions ?? null,
            relations: data.relations ?? [],
            v5UpdatedAt: data.v5UpdatedAt,
        });
    } catch (e: any) {
        console.error('[data-connector-v5/mapping GET]', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
