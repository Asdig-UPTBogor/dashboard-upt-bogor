/**
 * /api/data-input/datasets/[ds]/tables/[t]/schema
 *
 * PATCH — update column overlay (alias, CHOICE options, REFERENCE config, etc).
 * Merge ke Firestore data_platform_columns/{ds}__{t}.
 */

import { NextResponse, type NextRequest } from "next/server";
import { patchColumnsOverlay } from "../../../../../_lib/overlay-config";
import type { ColumnMeta } from "@/app/data-input/_workspace/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ds: string; t: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
    const { ds, t } = await params;
    try {
        const body = await req.json() as {
            columns: Record<string, Partial<ColumnMeta>>;
            actor?: string;
        };
        if (!body.columns || typeof body.columns !== "object") {
            return NextResponse.json({ ok: false, error: "bad_request", message: "columns wajib" }, { status: 400 });
        }
        await patchColumnsOverlay(ds, t, body.columns, body.actor || "unknown@pln.co.id");
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
