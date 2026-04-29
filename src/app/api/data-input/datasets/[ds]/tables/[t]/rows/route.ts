/**
 * /api/data-input/datasets/[ds]/tables/[t]/rows
 *
 * GET    list rows (SELECT * FROM ds.t)
 * POST   insert row
 * PATCH  update row  body: { pk, changes, updatedAtAtRead? }
 * DELETE soft delete (kalau ada is_active) / hard delete
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery, fq } from "../../../../../_lib/clients";
import { getTableSchema, inferPrimaryKey } from "../../../../../_lib/bq-discovery";
import { getTableOverlay } from "../../../../../_lib/overlay-config";
import { logAudit, requestMeta } from "../../../../../_lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ds: string; t: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const url = new URL(req.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 5000), 20000);
        const includeArchived = url.searchParams.get("includeArchived") === "true";
        const resolveChain = url.searchParams.get("resolveChain") === "true";

        const schema = await getTableSchema(ds, t);
        if (!schema) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
        const hasAudit = schema.columns.some((c) => c.name === "is_active");

        const bq = getBigQuery();

        if (resolveChain) {
            /* Server-side chain resolve — walk REFERENCE cols sampai root,
             *  build LEFT JOIN chain, return rows + _ancestors inlined. */
            const joins: string[] = [];
            const selectExtra: string[] = [];
            const ancestors: Array<{ dataset: string; table: string; alias: string }> = [];

            let currentAlias = "t0";
            let currentSchema = schema;
            let depth = 0;
            while (depth < 5) {
                const refCol = currentSchema.columns.find((c) => c.type === "REFERENCE" && c.reference);
                if (!refCol?.reference) break;
                const nextAlias = `t${depth + 1}`;
                const pDs = refCol.reference.dataset;
                const pTable = refCol.reference.table;
                const pValueCol = refCol.reference.valueCol;
                const pDisplayCol = refCol.reference.displayCol;

                joins.push(`LEFT JOIN ${fq(pDs, pTable)} ${nextAlias} ON ${nextAlias}.${pValueCol} = ${currentAlias}.${refCol.name}`);
                selectExtra.push(`${nextAlias}.${pDisplayCol} AS \`__ancestor_${pDs}__${pTable}\``);
                ancestors.push({ dataset: pDs, table: pTable, alias: nextAlias });

                // Fetch parent schema untuk lanjut walk
                const parentSchemaRes = await getTableSchema(pDs, pTable);
                if (!parentSchemaRes) break;
                currentSchema = parentSchemaRes;
                currentAlias = nextAlias;
                depth++;
            }

            const whereActive = hasAudit && !includeArchived ? "WHERE t0.is_active IS NOT FALSE" : "";
            const query = `
                SELECT t0.*${selectExtra.length > 0 ? ", " + selectExtra.join(", ") : ""}
                FROM ${fq(ds, t)} t0
                ${joins.join("\n")}
                ${whereActive}
                LIMIT ${limit}
            `;
            const [rows] = await bq.query({ query, useLegacySql: false });

            // Transform: pluck __ancestor_ fields into nested `_ancestors` object
            const transformed = rows.map((r) => {
                const normalized = normalizeBqRow(r);
                const _ancestors: Record<string, string> = {};
                for (const a of ancestors) {
                    const k = `__ancestor_${a.dataset}__${a.table}`;
                    if (normalized[k] != null) {
                        _ancestors[`${a.dataset}.${a.table}`] = String(normalized[k]);
                        delete normalized[k];
                    }
                }
                return Object.keys(_ancestors).length > 0 ? { ...normalized, _ancestors } : normalized;
            });

            return NextResponse.json({
                ok: true,
                rows: transformed,
                total: transformed.length,
                chain: ancestors.map((a) => `${a.dataset}.${a.table}`),
            });
        }

        // Default: simple SELECT * tanpa JOIN
        const whereActive = hasAudit && !includeArchived ? "WHERE is_active IS NOT FALSE" : "";
        const [rows] = await bq.query({
            query: `SELECT * FROM ${fq(ds, t)} ${whereActive} LIMIT ${limit}`,
            useLegacySql: false,
        });
        return NextResponse.json({ ok: true, rows: rows.map(normalizeBqRow), total: rows.length });
    } catch (err) {
        return fail(err);
    }
}

export async function POST(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const body = await req.json() as { values: Record<string, unknown>; actor?: string };
        const actor = body.actor || "unknown@pln.co.id";
        const values = body.values ?? {};

        const schema = await getTableSchema(ds, t);
        if (!schema) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

        const overlay = await getTableOverlay(ds, t);
        const pk = overlay.primaryKey ?? inferPrimaryKey(schema.columns, t);
        if (!pk) return NextResponse.json({ ok: false, error: "bad_request", message: "Primary key tidak terdeteksi" }, { status: 400 });

        const schemaNames = new Set(schema.columns.map((c) => c.name));
        const auditSet = new Set(["is_active", "valid_from", "valid_to", "created_by", "created_at", "updated_by", "updated_at"]);
        const hasAudit = schemaNames.has("is_active");

        const insertRow: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(values)) {
            if (k === pk) continue;
            if (auditSet.has(k)) continue;
            if (!schemaNames.has(k)) continue;
            insertRow[k] = v;
        }

        const userCols = Object.keys(insertRow);
        const placeholders = userCols.map((c) => `@${c}`);

        let query: string;
        if (hasAudit) {
            query = `
                INSERT INTO ${fq(ds, t)}
                  (${pk}, ${userCols.join(", ")},
                   is_active, valid_from, valid_to,
                   created_by, created_at, updated_by, updated_at)
                VALUES
                  (GENERATE_UUID(), ${placeholders.join(", ")},
                   TRUE, CURRENT_TIMESTAMP(), NULL,
                   @_actor, CURRENT_TIMESTAMP(), NULL, NULL)
            `;
        } else {
            query = `
                INSERT INTO ${fq(ds, t)}
                  (${pk}, ${userCols.join(", ")})
                VALUES (GENERATE_UUID(), ${placeholders.join(", ")})
            `;
        }

        const bq = getBigQuery();
        await bq.query({
            query,
            params: { ...insertRow, _actor: actor },
            useLegacySql: false,
        });

        logAudit({
            action: "CREATE_ROW",
            dataset: ds, table: t,
            after: insertRow,
            actor, ...requestMeta(req),
        });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return fail(err);
    }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const body = await req.json() as {
            pk: string;
            changes: Record<string, unknown>;
            updatedAtAtRead?: string;
            actor?: string;
        };
        const actor = body.actor || "unknown@pln.co.id";

        const schema = await getTableSchema(ds, t);
        if (!schema) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

        const overlay = await getTableOverlay(ds, t);
        const pkCol = overlay.primaryKey ?? inferPrimaryKey(schema.columns, t);
        if (!pkCol) return NextResponse.json({ ok: false, error: "bad_request", message: "PK tidak terdeteksi" }, { status: 400 });

        const schemaNames = new Set(schema.columns.map((c) => c.name));
        const auditSet = new Set(["is_active", "valid_from", "valid_to", "created_by", "created_at", "updated_by", "updated_at"]);
        const hasAudit = schemaNames.has("updated_at");

        const setParts: string[] = [];
        const qparams: Record<string, unknown> = { _pk: body.pk, _actor: actor };

        for (const [col, val] of Object.entries(body.changes)) {
            if (col === pkCol) continue;
            if (auditSet.has(col)) continue;
            if (!schemaNames.has(col)) continue;
            setParts.push(`${col} = @${col}`);
            qparams[col] = val;
        }
        if (setParts.length === 0) {
            return NextResponse.json({ ok: false, error: "bad_request", message: "No editable changes" }, { status: 400 });
        }
        if (hasAudit) {
            setParts.push(`updated_by = @_actor`);
            setParts.push(`updated_at = CURRENT_TIMESTAMP()`);
        }

        let whereExtra = "";
        if (body.updatedAtAtRead && hasAudit) {
            whereExtra = ` AND (updated_at IS NULL OR updated_at = TIMESTAMP(@_updatedAtAtRead))`;
            qparams._updatedAtAtRead = body.updatedAtAtRead;
        }

        const query = `
            UPDATE ${fq(ds, t)}
            SET ${setParts.join(", ")}
            WHERE ${pkCol} = @_pk ${whereExtra}
        `;

        const bq = getBigQuery();
        const [job] = await bq.createQueryJob({ query, params: qparams, useLegacySql: false });
        // WAIT for job completion — dmlStats only populated setelah job finish
        await job.getQueryResults();
        const [metadata] = await job.getMetadata();
        const affected = Number(metadata.statistics?.query?.dmlStats?.updatedRowCount ?? 0);

        if (affected === 0 && body.updatedAtAtRead) {
            return NextResponse.json(
                { ok: false, error: "conflict", message: "Row sudah diubah orang lain. Refresh dulu." },
                { status: 409 }
            );
        }
        if (affected === 0) {
            return NextResponse.json(
                { ok: false, error: "not_found", message: `Row dengan PK "${body.pk}" tidak ditemukan` },
                { status: 404 }
            );
        }

        logAudit({
            action: "UPDATE_ROW",
            dataset: ds, table: t, rowId: body.pk,
            after: body.changes,
            actor, ...requestMeta(req),
        });
        return NextResponse.json({ ok: true, updatedRows: affected });
    } catch (err) {
        return fail(err);
    }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const body = await req.json() as { pk: string; hard?: boolean; actor?: string };
        const actor = body.actor || "unknown@pln.co.id";

        const schema = await getTableSchema(ds, t);
        if (!schema) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
        const overlay = await getTableOverlay(ds, t);
        const pkCol = overlay.primaryKey ?? inferPrimaryKey(schema.columns, t);
        if (!pkCol) return NextResponse.json({ ok: false, error: "bad_request", message: "PK tidak terdeteksi" }, { status: 400 });

        const schemaNames = new Set(schema.columns.map((c) => c.name));
        const hasAudit = schemaNames.has("is_active");
        const bq = getBigQuery();

        if (hasAudit && !body.hard) {
            await bq.query({
                query: `UPDATE ${fq(ds, t)}
                        SET is_active = FALSE, valid_to = CURRENT_TIMESTAMP(),
                            updated_by = @_actor, updated_at = CURRENT_TIMESTAMP()
                        WHERE ${pkCol} = @_pk`,
                params: { _pk: body.pk, _actor: actor },
                useLegacySql: false,
            });
        } else {
            await bq.query({
                query: `DELETE FROM ${fq(ds, t)} WHERE ${pkCol} = @_pk`,
                params: { _pk: body.pk },
                useLegacySql: false,
            });
        }

        logAudit({
            action: "DELETE_ROW",
            dataset: ds, table: t, rowId: body.pk,
            before: { pk: body.pk, hard: body.hard },
            actor, ...requestMeta(req),
        });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return fail(err);
    }
}

/** BQ client returns wrapper objects untuk DATE/TIMESTAMP/NUMERIC + bigint untuk INT64.
 *  Normalize ke plain JS primitives yg aman JSON-serialize — preserve type. */
function normalizeBqRow(r: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
        if (v == null) { out[k] = v; continue; }
        if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
            out[k] = (v as { value: unknown }).value;
            continue;
        }
        if (typeof v === "bigint") { out[k] = Number(v); continue; }
        out[k] = v;
    }
    return out;
}

function fail(err: unknown) {
    console.error("[api/data-input/rows]", err);
    return NextResponse.json(
        { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
        { status: 500 }
    );
}
