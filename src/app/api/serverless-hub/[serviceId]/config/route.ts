/**
 * Serverless Hub — Config API (per service)
 *
 * GET  /api/serverless-hub/[serviceId]/config → Read Firestore config
 * POST /api/serverless-hub/[serviceId]/config → Patch Firestore config
 *
 * Uses worker-registry.ts to determine collection/document.
 * Sensitive fields are automatically masked in GET responses.
 */

import { NextResponse } from "next/server";
import { WORKERS } from "@/lib/worker-registry";
import { readWorkerConfig, patchWorkerConfig, maskSensitiveFields, listCollectionDocs } from "@/lib/worker-firestore";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ serviceId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
    const { serviceId } = await params;
    const worker = WORKERS[serviceId];

    if (!worker) {
        return NextResponse.json({ error: `Unknown service: ${serviceId}` }, { status: 404 });
    }

    try {
        const [config, spreadsheetDocs] = await Promise.all([
            readWorkerConfig(worker.configCollection, worker.configDocument),
            listCollectionDocs(worker.configCollection, [worker.configDocument]),
        ]);
        const safe = maskSensitiveFields(config, worker.sensitiveFields);
        // Build spreadsheets array from individual Firestore documents
        const spreadsheets = spreadsheetDocs.map((doc) => ({
            id: doc._docId,
            spreadsheetId: doc.spreadsheetId || "",
            name: doc.spreadsheetName || doc._docId,
            dataset: doc.dataset || "",
            syncEnabled: doc.syncEnabled !== false,
            lastSync: doc.lastSync || null,
            sheetCount: doc.sheetCount || 0,
            sheets: doc.sheets || {},
        }));
        return NextResponse.json({ ok: true, serviceId, config: safe, spreadsheets });
    } catch (error) {
        console.error(`[serverless-hub/${serviceId}/config] GET`, error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 },
        );
    }
}

export async function POST(request: Request, { params }: RouteParams) {
    const { serviceId } = await params;
    const worker = WORKERS[serviceId];

    if (!worker) {
        return NextResponse.json({ error: `Unknown service: ${serviceId}` }, { status: 404 });
    }

    try {
        const body = await request.json();

        // Optional: specify a sub-document (e.g. per-spreadsheet config)
        const collection = body._collection || worker.configCollection;
        const document = body._document || worker.configDocument;

        // Remove internal control keys
        const updates = { ...body };
        delete updates._collection;
        delete updates._document;

        // Block writes to sensitive fields from frontend
        if (worker.sensitiveFields) {
            for (const field of worker.sensitiveFields) {
                delete updates[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
        }

        await patchWorkerConfig(collection, document, updates);

        // Read back the updated config
        const config = await readWorkerConfig(worker.configCollection, worker.configDocument);
        const safe = maskSensitiveFields(config, worker.sensitiveFields);
        return NextResponse.json({ ok: true, serviceId, config: safe });
    } catch (error) {
        console.error(`[serverless-hub/${serviceId}/config] POST`, error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 },
        );
    }
}
