/**
 * /api/workspace/datasets — GET overlay semua dataset (category + alias).
 *  Baca dari `data_platform_dataset` collection.
 */

import { NextResponse } from "next/server";
import { getFirestore } from "@/app/api/data-input/_lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COL = "data_platform_dataset";

export async function GET() {
    try {
        const snap = await getFirestore().collection(COL).get();
        const overlay: Record<string, Record<string, unknown>> = {};
        snap.forEach((d) => { overlay[d.id] = d.data(); });
        return NextResponse.json({ ok: true, overlay });
    } catch (e) {
        console.error("[api:workspace/datasets GET]", e);
        return NextResponse.json(
            { ok: false, message: e instanceof Error ? e.message : String(e) },
            { status: 500 },
        );
    }
}
