/**
 * /api/data-input/datasets/[ds]/tables/[t]/rows/batch
 *
 * POST — batch insert rows via BQ streaming insert API.
 * Handle 1000+ rows dalam 1 call (BQ limit: 10k rows, 10MB total per request).
 *
 * Body:
 *   {
 *     rows: Array<Record<string, unknown>>,
 *     actor?: string,
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     inserted: number,
 *     failed: Array<{ index: number, errors: string[] }>
 *   }
 *
 * Kalau ada partial failure, return ok:true tapi `failed` list tidak kosong.
 * Client harus surface error per-row ke user.
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getBigQuery } from "../../../../../../_lib/clients";
import { getTableSchema, inferPrimaryKey } from "../../../../../../_lib/bq-discovery";
import { getTableOverlay } from "../../../../../../_lib/overlay-config";
import { logAudit, requestMeta } from "../../../../../../_lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;          // 60s max — streaming insert bisa lambat
/** Next.js body parser default 4MB. Batch 5000 rows × ~2KB = 10MB → harus naikkan.
 *  App Router pakai Web API Request, limit global di next.config (future).  */

const MAX_BATCH_SIZE = 5000; // Safety limit per request; BQ native 10k tapi kita batasi 5k
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB hard cap

type Ctx = { params: Promise<{ ds: string; t: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const body = await req.json() as {
            rows: Array<Record<string, unknown>>;
            actor?: string;
        };

        if (!Array.isArray(body.rows) || body.rows.length === 0) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: "rows: [] required (min 1)" },
                { status: 400 }
            );
        }

        if (body.rows.length > MAX_BATCH_SIZE) {
            return NextResponse.json(
                { ok: false, error: "bad_request",
                  message: `Max ${MAX_BATCH_SIZE} rows per batch. Split besar ke beberapa call.` },
                { status: 400 }
            );
        }

        const actor = body.actor || "admin";

        const schema = await getTableSchema(ds, t);
        if (!schema) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

        const overlay = await getTableOverlay(ds, t);
        const pk = overlay.primaryKey ?? inferPrimaryKey(schema.columns, t);
        if (!pk) return NextResponse.json({ ok: false, error: "bad_request", message: "PK tidak terdeteksi" }, { status: 400 });

        const schemaNames = new Set(schema.columns.map((c) => c.name));
        const auditSet = new Set(["is_active", "valid_from", "valid_to", "created_by", "created_at", "updated_by", "updated_at"]);
        const hasAudit = schemaNames.has("is_active");

        const now = new Date();
        const rowsToInsert = body.rows.map((input) => {
            const row: Record<string, unknown> = {};

            // User-provided fields (filter ke schema + non-audit)
            for (const [k, v] of Object.entries(input)) {
                if (k === pk) continue;                  // PK auto-generated
                if (auditSet.has(k)) continue;           // audit server-managed
                if (!schemaNames.has(k)) continue;       // unknown column skip
                if (v === "" || v === undefined) continue; // skip empty
                row[k] = v;
            }

            // Auto PK (UUID)
            row[pk] = randomUUID();

            // Audit fields
            if (hasAudit) {
                row.is_active = true;
                row.valid_from = now;
                row.valid_to = null;
                row.created_by = actor;
                row.created_at = now;
                row.updated_by = null;
                row.updated_at = null;
            }

            return row;
        });

        // BQ streaming insert — handles batches efficiently
        const bq = getBigQuery();
        const table = bq.dataset(ds).table(t);

        try {
            await table.insert(rowsToInsert, {
                skipInvalidRows: false,
                ignoreUnknownValues: false,
            });
        } catch (err: unknown) {
            // PartialFailureError — beberapa row gagal, yg lain success
            const errObj = err as { name?: string; errors?: Array<{ row: Record<string, unknown>; errors: Array<{ reason: string; message: string }> }> };
            if (errObj?.name === "PartialFailureError" && Array.isArray(errObj.errors)) {
                const failed = errObj.errors.map((e, i) => ({
                    index: i,
                    errors: e.errors?.map((x) => `${x.reason}: ${x.message}`) ?? [],
                }));
                logAudit({
                    action: "CREATE_ROW",
                    dataset: ds, table: t,
                    after: { batch: body.rows.length, failed: failed.length },
                    actor, ...requestMeta(req),
                });
                return NextResponse.json({
                    ok: true,
                    inserted: body.rows.length - failed.length,
                    failed,
                    warning: `${failed.length} dari ${body.rows.length} row gagal. Lihat detail di 'failed'.`,
                });
            }
            throw err;
        }

        logAudit({
            action: "CREATE_ROW",
            dataset: ds, table: t,
            after: { batch: body.rows.length },
            actor, ...requestMeta(req),
        });

        return NextResponse.json({
            ok: true,
            inserted: body.rows.length,
            failed: [],
        });
    } catch (err) {
        console.error("[api/data-input/rows/batch]", err);
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
