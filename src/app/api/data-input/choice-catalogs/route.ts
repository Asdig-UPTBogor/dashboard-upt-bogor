/**
 * /api/data-input/choice-catalogs
 *
 * GET  — list semua choice catalog (shared dropdown options)
 * POST — create catalog baru ({ slug, name, options[], description? })
 *
 * Storage: Firestore collection `data_platform_choice_catalogs/{slug}`.
 * Options shape: [{ value, label, color? }]
 */

import { NextResponse, type NextRequest } from "next/server";
import { Firestore } from "@google-cloud/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLLECTION = "data_platform_choice_catalogs";

interface ChoiceOption { value: string; label: string; color?: string }
interface CatalogDoc {
    slug: string;
    name: string;
    description?: string | null;
    options: ChoiceOption[];
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

let _db: Firestore | null = null;
function db() {
    if (!_db) _db = new Firestore({ projectId: "gcp-bridge-meshvpn" });
    return _db;
}

export async function GET() {
    try {
        const snap = await db().collection(COLLECTION).get();
        const catalogs: CatalogDoc[] = snap.docs.map((d) => {
            const data = d.data();
            return {
                slug: d.id,
                name: String(data.name ?? d.id),
                description: data.description ?? null,
                options: Array.isArray(data.options) ? data.options : [],
                createdBy: data.createdBy ?? null,
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
        return NextResponse.json({ ok: true, catalogs });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            slug?: string; name?: string; description?: string; options?: ChoiceOption[]; actor?: string;
        };
        if (!body.slug || !/^[a-z0-9_-]+$/.test(body.slug)) {
            return NextResponse.json({ ok: false, error: "bad_request", message: "slug harus lowercase alfanumerik (-, _ allowed)" }, { status: 400 });
        }
        if (!body.name || !body.name.trim()) {
            return NextResponse.json({ ok: false, error: "bad_request", message: "name wajib" }, { status: 400 });
        }
        if (!Array.isArray(body.options) || body.options.length === 0) {
            return NextResponse.json({ ok: false, error: "bad_request", message: "options minimal 1" }, { status: 400 });
        }
        const cleanOptions: ChoiceOption[] = body.options
            .map((o) => ({ value: String(o.value ?? "").trim(), label: String(o.label ?? "").trim(), color: o.color }))
            .filter((o) => o.value !== "");
        if (cleanOptions.length === 0) {
            return NextResponse.json({ ok: false, error: "bad_request", message: "options invalid" }, { status: 400 });
        }
        await db().collection(COLLECTION).doc(body.slug).set({
            name: body.name.trim(),
            description: body.description?.trim() ?? null,
            options: cleanOptions,
            createdBy: body.actor ?? "unknown@pln.co.id",
            createdAt: new Date(),
            updatedAt: new Date(),
        }, { merge: true });
        return NextResponse.json({ ok: true, slug: body.slug });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
