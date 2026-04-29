/**
 * /api/data-input/datasets/[ds]/tables/[t]
 *
 * GET    schema table (BQ raw + Firestore overlay merged) + meta
 * DELETE drop table BQ + overlay Firestore
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery } from "../../../../_lib/clients";
import { getTableSchema, inferPrimaryKey, inferDisplayKey } from "../../../../_lib/bq-discovery";
import { getTableOverlay, getColumnsOverlay, mergeColumns } from "../../../../_lib/overlay-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ds: string; t: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const [schema, tableOverlay, colsOverlay] = await Promise.all([
            getTableSchema(ds, t),
            getTableOverlay(ds, t),
            getColumnsOverlay(ds, t),
        ]);
        if (!schema) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

        const columns = mergeColumns(schema.columns, colsOverlay.columns);
        const primaryKey = tableOverlay.primaryKey ?? inferPrimaryKey(columns, t) ?? columns[0]?.name;
        const displayKey = tableOverlay.displayKey ?? inferDisplayKey(columns, t) ?? primaryKey;

        return NextResponse.json({
            ok: true,
            table: {
                dataset: ds,
                table: t,
                description: tableOverlay.description ?? schema.description,
                tableAlias: tableOverlay.alias ?? t,
                numRows: schema.numRows,
                numBytes: schema.numBytes,
                type: schema.type,
                primaryKey,
                displayKey,
                defaultSort: tableOverlay.defaultSort,
                icon: tableOverlay.icon,
            },
            columns,
        });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: String(err) },
            { status: 500 }
        );
    }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const bq = getBigQuery();
        await bq.dataset(ds).table(t).delete();
        // TODO: juga hapus overlay doc di Firestore — delegate ke cleanup job supaya idempotent
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
