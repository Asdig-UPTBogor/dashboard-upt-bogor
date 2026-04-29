/**
 * /api/data-input/datasets/[ds]/tables/[t]/rows/replace
 *
 * POST — soft-delete SEMUA row active (is_active=true → false).
 * Digunakan oleh Bulk Import mode "REPLACE ALL" sebelum streaming insert batch baru.
 *
 * Body: { actor?: string }
 * Response: { ok: true, deactivated: number }
 *
 * Catatan:
 *  - Table tanpa audit (is_active column) tidak didukung, return 400.
 *  - Raw row masih di BQ untuk audit trail — cuma di-hide dari workspace.
 *  - DML UPDATE: nunggu sampai streaming buffer clear (90s) kalau row
 *    baru saja di-insert; caller harus aware.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery } from "../../../../../../_lib/clients";
import { getTableSchema } from "../../../../../../_lib/bq-discovery";
import { logAudit, requestMeta } from "../../../../../../_lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

type Ctx = { params: Promise<{ ds: string; t: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const body = await req.json().catch(() => ({})) as { actor?: string };
        const actor = body.actor || "admin";

        const schema = await getTableSchema(ds, t);
        if (!schema) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

        const hasAudit = schema.columns.some((c) => c.name === "is_active");
        if (!hasAudit) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: "Table tidak punya kolom is_active — REPLACE ALL hanya didukung untuk table dengan audit schema." },
                { status: 400 }
            );
        }

        const bq = getBigQuery();
        const fq = "`" + `${bq.projectId}.${ds}.${t}` + "`";
        const query = `
            UPDATE ${fq}
            SET is_active = FALSE,
                valid_to = CURRENT_TIMESTAMP(),
                updated_by = @actor,
                updated_at = CURRENT_TIMESTAMP()
            WHERE is_active = TRUE
        `;

        const [job] = await bq.createQueryJob({
            query,
            params: { actor },
            location: "asia-southeast2",
        });
        await job.getQueryResults();
        const [meta] = await job.getMetadata();
        const stats = meta.statistics?.query;
        const affected = Number(stats?.dmlStats?.updatedRowCount ?? 0);

        logAudit({
            action: "REPLACE_ALL",
            dataset: ds, table: t,
            after: { deactivated: affected },
            actor, ...requestMeta(req),
        });

        return NextResponse.json({ ok: true, deactivated: affected });
    } catch (err) {
        console.error("[api/data-input/rows/replace]", err);
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
