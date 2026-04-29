/**
 * /api/data-input/datasets/[ds]/tables
 *
 * POST create table di dataset (bq mk table dengan schema yg di-define).
 *
 * Body: {
 *   id: string,
 *   description?: string,
 *   columns: [{ name, type, mode, description? }],
 *   partitioning?: { type: 'DAY' | 'MONTH' | 'YEAR', field: string },
 *   audit?: boolean    // kalau true, otomatis tambah kolom audit (is_active, valid_from, dll)
 * }
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery } from "../../../_lib/clients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ds: string }> };

interface ColumnDef {
    name: string;
    type: string;
    mode?: "REQUIRED" | "NULLABLE" | "REPEATED";
    description?: string;
}

export async function POST(req: NextRequest, { params }: Ctx) {
    const { ds } = await params;
    try {
        const body = await req.json() as {
            id: string;
            description?: string;
            columns: ColumnDef[];
            partitioning?: { type: "DAY" | "MONTH" | "YEAR"; field: string };
            audit?: boolean;
        };
        if (!body.id || !/^[a-zA-Z0-9_]{1,1024}$/.test(body.id)) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: "id invalid" },
                { status: 400 }
            );
        }
        if (!body.columns || body.columns.length === 0) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: "columns minimal 1" },
                { status: 400 }
            );
        }

        const fields = [...body.columns];
        if (body.audit) {
            fields.push(
                { name: "is_active", type: "BOOL", mode: "NULLABLE" },
                { name: "valid_from", type: "TIMESTAMP", mode: "NULLABLE" },
                { name: "valid_to", type: "TIMESTAMP", mode: "NULLABLE" },
                { name: "created_by", type: "STRING", mode: "NULLABLE" },
                { name: "created_at", type: "TIMESTAMP", mode: "NULLABLE" },
                { name: "updated_by", type: "STRING", mode: "NULLABLE" },
                { name: "updated_at", type: "TIMESTAMP", mode: "NULLABLE" },
            );
        }

        const bq = getBigQuery();
        const schema = { fields };
        const options: Record<string, unknown> = {
            schema,
            description: body.description,
        };
        if (body.partitioning) {
            options.timePartitioning = {
                type: body.partitioning.type,
                field: body.partitioning.field,
            };
        }

        await bq.dataset(ds).createTable(body.id, options);
        return NextResponse.json({ ok: true, id: body.id });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
