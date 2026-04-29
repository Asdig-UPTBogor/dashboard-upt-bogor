/**
 * /api/data-input/datasets
 *
 * GET  list semua dataset BQ di project (auto-discover, no registry).
 * POST create dataset baru (bq mk DATASET).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getBigQuery, PROJECT } from "../_lib/clients";
import { listDatasets } from "../_lib/bq-discovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    try {
        const datasets = await listDatasets();
        return NextResponse.json({ ok: true, datasets, project: PROJECT });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: String(err) },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            id: string;
            location?: string;
            description?: string;
            friendlyName?: string;
            ownerEmail?: string;
        };
        if (!body.id || !/^[a-zA-Z0-9_]{1,1024}$/.test(body.id)) {
            return NextResponse.json(
                { ok: false, error: "bad_request", message: "id invalid. Alphanumeric + underscore, max 1024." },
                { status: 400 }
            );
        }

        // BQ label rule: lowercase letters, numbers, dashes, underscores, max 63.
        // Email encoded: dots/@ → underscore. Contoh: admin@foo.com → admin_at_foo_com
        const owner = (body.ownerEmail || "admin")
            .toLowerCase()
            .replace(/@/g, "_at_")
            .replace(/\./g, "_")
            .replace(/[^a-z0-9_-]/g, "_")
            .slice(0, 63);

        const bq = getBigQuery();
        await bq.createDataset(body.id, {
            location: body.location || "asia-southeast2",
            description: body.description,
            friendlyName: body.friendlyName,
            labels: {
                origin: "user",
                owner_email: owner,
            },
        });
        return NextResponse.json({ ok: true, id: body.id });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: "server_error", message: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
