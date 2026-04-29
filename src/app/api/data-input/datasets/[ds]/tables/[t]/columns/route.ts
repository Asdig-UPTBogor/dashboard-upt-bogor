/**
 * /api/data-input/datasets/[ds]/tables/[t]/columns
 *
 * POST — add new column to BQ table (ALTER TABLE ADD COLUMN via setMetadata).
 * Supports Link ke Master (auto-sets REFERENCE overlay).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery } from "../../../../../_lib/clients";
import { patchColumnsOverlay } from "../../../../../_lib/overlay-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ds: string; t: string }> };

const MASTER_FK: Record<string, { table: string; valueCol: string; displayCol: string }> = {
    UPT:  { table: "UPT",         valueCol: "upt_id",  displayCol: "upt_name" },
    ULTG: { table: "ULTG",        valueCol: "ultg_id", displayCol: "ultg_name" },
    GI:   { table: "Gardu_Induk", valueCol: "gi_id",   displayCol: "gi_name" },
    Bay:  { table: "Bay",         valueCol: "bay_id",  displayCol: "bay_name" },
};

export async function POST(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const body = await req.json() as {
            name: string;
            type: string;
            mode?: "REQUIRED" | "NULLABLE";
            description?: string;
            masterRef?: keyof typeof MASTER_FK;
            actor?: string;
        };

        if (!body.name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(body.name)) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: "Nama kolom invalid (alphanumeric + underscore, start dengan letter/underscore)" },
                { status: 400 }
            );
        }

        // Master FK locks type + name
        let colName = body.name;
        let colType = body.type;
        if (body.masterRef) {
            const fk = MASTER_FK[body.masterRef];
            colName = fk.valueCol;
            colType = "STRING";
        }

        const bq = getBigQuery();
        const table = bq.dataset(ds).table(t);
        const [meta] = await table.getMetadata();
        const existingFields = (meta.schema?.fields ?? []) as Array<{ name: string; type: string; mode?: string; description?: string }>;

        if (existingFields.some((f) => f.name === colName)) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: `Kolom "${colName}" sudah ada` },
                { status: 400 }
            );
        }

        const newField = {
            name: colName,
            type: colType,
            mode: body.mode || "NULLABLE",
            description: body.description,
        };

        // BQ ALTER TABLE via setMetadata — append field (BQ only supports append, not delete)
        await table.setMetadata({
            schema: { fields: [...existingFields, newField] },
        });

        // Kalau Master FK — tulis overlay REFERENCE config ke Firestore
        if (body.masterRef) {
            const fk = MASTER_FK[body.masterRef];
            await patchColumnsOverlay(ds, t, {
                [colName]: {
                    type: "REFERENCE",
                    reference: {
                        dataset: "Master_Data",
                        table: fk.table,
                        valueCol: fk.valueCol,
                        displayCol: fk.displayCol,
                    },
                },
            }, body.actor || "unknown@pln.co.id");
        }

        return NextResponse.json({ ok: true, column: newField });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
