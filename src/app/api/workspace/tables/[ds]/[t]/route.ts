/**
 * /api/workspace/tables/[ds]/[t] — PATCH overlay table (alias, description,
 * icon, primaryKey, displayKey, defaultSort, tableOrder).
 *
 * Menulis ke `data_platform_table/{ds}__{t}` (collection existing).
 */

import { NextResponse } from "next/server";
import { getFirestore } from "@/app/api/data-input/_lib/clients";

export const runtime = "nodejs";

const COL = "data_platform_table";

function docKey(ds: string, t: string) { return `${ds}__${t}`; }

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ ds: string; t: string }> },
) {
    try {
        const { ds, t } = await params;
        if (!ds || !t) return NextResponse.json({ ok: false, message: "ds + t required" }, { status: 400 });

        const body = await req.json().catch(() => ({})) as {
            alias?: string;
            description?: string;
            icon?: string;
            primaryKey?: string;
            displayKey?: string;
            tableOrder?: number;
            defaultSort?: { column: string; direction: "asc" | "desc" };
        };

        const patch: Record<string, unknown> = {
            updatedBy: "admin",
            updatedAt: new Date(),
        };
        for (const k of ["alias", "description", "icon", "primaryKey", "displayKey", "tableOrder", "defaultSort"] as const) {
            if (body[k] !== undefined) patch[k] = body[k];
        }

        await getFirestore().collection(COL).doc(docKey(ds, t)).set(patch, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[api:workspace/tables PATCH]", e);
        return NextResponse.json(
            { ok: false, message: e instanceof Error ? e.message : String(e) },
            { status: 500 },
        );
    }
}
