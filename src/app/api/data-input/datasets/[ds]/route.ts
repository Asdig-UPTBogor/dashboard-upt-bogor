/**
 * /api/data-input/datasets/[ds]
 *
 * GET    detail dataset + child tables + BQ metadata (size, rows, etc)
 * DELETE hapus dataset BQ (force=true untuk cascade drop semua table)
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery } from "../../_lib/clients";
import { getDataset } from "../../_lib/bq-discovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ds: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
    const { ds } = await params;
    try {
        const detail = await getDataset(ds);
        if (!detail) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
        return NextResponse.json({ ok: true, dataset: detail });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: String(err) },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
    const { ds } = await params;
    const force = new URL(req.url).searchParams.get("force") === "true";
    try {
        const bq = getBigQuery();
        await bq.dataset(ds).delete({ force });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
