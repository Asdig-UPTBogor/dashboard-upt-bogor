/**
 * /api/workspace/categories — CRUD kategori (data_workspace_categories).
 *
 *  GET     → list all non-archived
 *  POST    { key, label, order?, hint?, showEmpty? }     → create/merge
 *  PATCH   { key, ... }                                   → update by key
 *  DELETE  ?key=<k>                                       → soft archive
 *
 *  Middleware gate auth. Actor hardcoded "admin" — nanti dari cookie payload.
 */

import { NextResponse } from "next/server";
import { getFirestore } from "@/app/api/data-input/_lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COL = "data_workspace_categories";

function err(status: number, message: string) {
    return NextResponse.json({ ok: false, message }, { status });
}

export async function GET() {
    try {
        const snap = await getFirestore().collection(COL).get();
        const items: Array<Record<string, unknown> & { key: string }> = [];
        snap.forEach((d) => {
            const data = d.data();
            if (data.archived === true) return;
            items.push({ key: d.id, ...data });
        });
        return NextResponse.json({ ok: true, items });
    } catch (e) {
        console.error("[api:categories GET]", e);
        return err(500, e instanceof Error ? e.message : String(e));
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({})) as {
            key?: string; label?: string; order?: number;
            hint?: string; showEmpty?: boolean;
        };
        if (!body.key || !body.label) return err(400, "key + label required");
        const slug = body.key.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
        await getFirestore().collection(COL).doc(slug).set(
            {
                label: body.label,
                order: typeof body.order === "number" ? body.order : 999,
                hint: body.hint ?? "",
                showEmpty: body.showEmpty === true,
                archived: false,
                updatedBy: "admin",
                updatedAt: new Date(),
            },
            { merge: true },
        );
        return NextResponse.json({ ok: true, key: slug });
    } catch (e) {
        console.error("[api:categories POST]", e);
        return err(500, e instanceof Error ? e.message : String(e));
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json().catch(() => ({})) as {
            key?: string; label?: string; order?: number;
            hint?: string; showEmpty?: boolean; archived?: boolean;
        };
        if (!body.key) return err(400, "key required");
        const patch: Record<string, unknown> = { updatedBy: "admin", updatedAt: new Date() };
        for (const k of ["label", "order", "hint", "showEmpty", "archived"] as const) {
            if (body[k] !== undefined) patch[k] = body[k];
        }
        await getFirestore().collection(COL).doc(body.key).set(patch, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[api:categories PATCH]", e);
        return err(500, e instanceof Error ? e.message : String(e));
    }
}

export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const key = url.searchParams.get("key");
        if (!key) return err(400, "key required");
        await getFirestore().collection(COL).doc(key).set(
            { archived: true, updatedBy: "admin", updatedAt: new Date() },
            { merge: true },
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[api:categories DELETE]", e);
        return err(500, e instanceof Error ? e.message : String(e));
    }
}
