/**
 * /api/data-input/datasets/[ds]/tables/[t]/columns/[name]
 *
 * DELETE — drop kolom dari BQ table (ALTER TABLE DROP COLUMN via DDL).
 *   + hapus overlay entry di Firestore data_platform_columns
 *   + audit log DROP_COLUMN
 *
 * Guard: kolom PK dan audit cols (is_active, created_*, updated_*, valid_*)
 * TIDAK bisa di-drop — return 400.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery } from "../../../../../../_lib/clients";
import { getTableOverlay, removeColumnOverlay } from "../../../../../../_lib/overlay-config";
import { inferPrimaryKey, getTableSchema } from "../../../../../../_lib/bq-discovery";
import { logAudit, requestMeta } from "../../../../../../_lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ ds: string; t: string; name: string }> };

const PROTECTED_COLS = new Set([
    "is_active", "valid_from", "valid_to",
    "created_by", "created_at", "updated_by", "updated_at",
]);

export async function DELETE(req: NextRequest, { params }: Ctx) {
    const { ds, t, name } = await params;
    try {
        if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: "Nama kolom invalid" },
                { status: 400 }
            );
        }

        if (PROTECTED_COLS.has(name)) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: `Kolom "${name}" adalah audit column — tidak bisa dihapus` },
                { status: 400 }
            );
        }

        const schema = await getTableSchema(ds, t);
        if (!schema) {
            return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
        }

        const overlay = await getTableOverlay(ds, t);
        const pk = overlay.primaryKey ?? inferPrimaryKey(schema.columns, t);
        if (pk === name) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: `Kolom "${name}" adalah primary key — tidak bisa dihapus` },
                { status: 400 }
            );
        }

        if (!schema.columns.some((c) => c.name === name)) {
            return NextResponse.json(
                { ok: false, error: "not_found", message: `Kolom "${name}" tidak ditemukan di table` },
                { status: 404 }
            );
        }

        const actor = (req.headers.get("x-actor") || "admin");

        // ALTER TABLE DROP COLUMN — BQ DDL statement
        const bq = getBigQuery();
        const fq = "`" + `${bq.projectId}.${ds}.${t}` + "`";
        const query = `ALTER TABLE ${fq} DROP COLUMN IF EXISTS \`${name}\``;

        const [job] = await bq.createQueryJob({
            query,
            location: "asia-southeast2",
        });
        await job.getQueryResults();

        // Clean up overlay entry (FieldValue.delete) supaya Firestore doc bersih.
        await removeColumnOverlay(ds, t, name, actor);

        logAudit({
            action: "DROP_COLUMN",
            dataset: ds, table: t, column: name,
            actor, ...requestMeta(req),
        });

        return NextResponse.json({ ok: true, dropped: name });
    } catch (err) {
        console.error("[api/data-input/columns/DELETE]", err);
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
