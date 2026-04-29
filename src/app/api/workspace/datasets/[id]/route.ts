/**
 * /api/workspace/datasets/[id] — PATCH overlay (category, alias, order).
 *  Menulis ke `data_platform_dataset/{id}`.
 */

import { NextResponse } from "next/server";
import { getFirestore } from "@/app/api/data-input/_lib/clients";

export const runtime = "nodejs";

const COL = "data_platform_dataset";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });

        const body = await req.json().catch(() => ({})) as {
            category?: string;
            datasetOrder?: number;
            alias?: string;
            description?: string;
            icon?: string;
        };

        const patch: Record<string, unknown> = {
            updatedBy: "admin",
            updatedAt: new Date(),
        };
        for (const k of ["category", "datasetOrder", "alias", "description", "icon"] as const) {
            if (body[k] !== undefined) patch[k] = body[k];
        }

        await getFirestore().collection(COL).doc(id).set(patch, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[api:datasets PATCH]", e);
        return NextResponse.json(
            { ok: false, message: e instanceof Error ? e.message : String(e) },
            { status: 500 },
        );
    }
}
