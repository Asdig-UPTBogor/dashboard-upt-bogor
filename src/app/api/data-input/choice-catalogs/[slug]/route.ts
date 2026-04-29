/**
 * /api/data-input/choice-catalogs/[slug]
 *
 * GET    — get specific catalog
 * DELETE — delete catalog
 */

import { NextResponse, type NextRequest } from "next/server";
import { Firestore } from "@google-cloud/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLLECTION = "data_platform_choice_catalogs";

let _db: Firestore | null = null;
function db() {
    if (!_db) _db = new Firestore({ projectId: "gcp-bridge-meshvpn" });
    return _db;
}

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
    const { slug } = await params;
    try {
        const doc = await db().collection(COLLECTION).doc(slug).get();
        if (!doc.exists) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
        const data = doc.data() ?? {};
        return NextResponse.json({
            ok: true,
            catalog: {
                slug,
                name: String(data.name ?? slug),
                description: data.description ?? null,
                options: Array.isArray(data.options) ? data.options : [],
            },
        });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const { slug } = await params;
    try {
        await db().collection(COLLECTION).doc(slug).delete();
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
