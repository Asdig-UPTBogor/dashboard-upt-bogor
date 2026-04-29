/**
 * /api/workspace/references — trace siapa yang pakai dataset/table.
 *
 *  GET ?dataset=X              → references ke semua table di dataset X
 *  GET ?dataset=X&table=Y      → references ke table spesifik Y
 *
 *  Scan 4 collection FS:
 *    1. dashboard_pages_v5  — v5Sources[] langsung {dataset, table}
 *    2. dashboard_pages     — dataSources[] via sheetName (V4 legacy)
 *    3. data_sources        — sheet→table mapping (resolver untuk #2)
 *    4. data_platform_columns — kolom REFERENCE di table lain
 *
 *  Return list dependent + severity (blocker / warn / info).
 */

import { NextResponse } from "next/server";
import { getFirestore } from "@/app/api/data-input/_lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FsDoc = FirebaseFirestore.QueryDocumentSnapshot;

interface DependentRef {
    kind: "dashboard-v5" | "dashboard-v4" | "column-reference" | "scheduled-query";
    sourceId: string;
    label: string;
    detail: string;
    severity: "blocker" | "warn" | "info";
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const targetDs = url.searchParams.get("dataset");
        const targetTbl = url.searchParams.get("table");
        if (!targetDs) {
            return NextResponse.json(
                { ok: false, message: "dataset param required" },
                { status: 400 },
            );
        }

        const db = getFirestore();
        const deps: DependentRef[] = [];

        // ─── 1. dashboard_pages_v5.v5Sources[] ───
        const v5Snap = await db.collection("dashboard_pages_v5").get();
        v5Snap.forEach((d: FsDoc) => {
            const data = d.data() as {
                v5Sources?: Array<{ dataset?: string; table?: string }>;
                pagePath?: string;
            };
            const sources = data.v5Sources ?? [];
            for (const s of sources) {
                if (s.dataset !== targetDs) continue;
                if (targetTbl && s.table !== targetTbl) continue;
                deps.push({
                    kind: "dashboard-v5",
                    sourceId: d.id,
                    label: `Dashboard page "${data.pagePath ?? d.id}"`,
                    detail: `v5Source → ${s.dataset}.${s.table}`,
                    severity: "blocker",
                });
            }
        });

        // ─── 2 + 3. dashboard_pages (V4) via data_sources ───
        // Load data_sources mapping sheet → {dataset, tableName}.
        const dsSnap = await db.collection("data_sources").get();
        /** sheetNameLower → { dataset, tableName } */
        const sheetMap = new Map<string, { dataset: string; tableName: string }>();
        dsSnap.forEach((d: FsDoc) => {
            const doc = d.data() as {
                dataset?: string;
                sheets?: Record<string, { tableName?: string }>;
            };
            const ds = doc.dataset;
            if (!ds) return;
            for (const [sheetName, v] of Object.entries(doc.sheets ?? {})) {
                if (v?.tableName) {
                    sheetMap.set(sheetName.toLowerCase(), { dataset: ds, tableName: v.tableName });
                }
            }
        });

        const v4Snap = await db.collection("dashboard_pages").get();
        v4Snap.forEach((d: FsDoc) => {
            const data = d.data() as {
                dataSources?: Array<{ sheetName?: string }>;
                pagePath?: string;
            };
            const sources = data.dataSources ?? [];
            for (const s of sources) {
                if (!s.sheetName) continue;
                const resolved = sheetMap.get(s.sheetName.toLowerCase());
                if (!resolved) continue;
                if (resolved.dataset !== targetDs) continue;
                if (targetTbl && resolved.tableName !== targetTbl) continue;
                deps.push({
                    kind: "dashboard-v4",
                    sourceId: d.id,
                    label: `Dashboard V4 "${data.pagePath ?? d.id}"`,
                    detail: `sheet "${s.sheetName}" → ${resolved.dataset}.${resolved.tableName}`,
                    severity: "blocker",
                });
            }
        });

        // ─── 4. data_platform_columns.columns[x].reference ───
        const colsSnap = await db.collection("data_platform_columns").get();
        colsSnap.forEach((d: FsDoc) => {
            const data = d.data() as {
                columns?: Record<string, { reference?: { dataset?: string; table?: string } }>;
            };
            const docId = d.id; // format: "ds__table"
            const [dsPart, ...tParts] = docId.split("__");
            const tPart = tParts.join("__");
            for (const [colName, colMeta] of Object.entries(data.columns ?? {})) {
                const ref = colMeta?.reference;
                if (!ref) continue;
                if (ref.dataset !== targetDs) continue;
                if (targetTbl && ref.table !== targetTbl) continue;
                // Skip self-reference
                if (dsPart === targetDs && tPart === (targetTbl ?? "")) continue;
                deps.push({
                    kind: "column-reference",
                    sourceId: docId,
                    label: `Column ${dsPart}.${tPart}.${colName}`,
                    detail: `REFERENCE → ${ref.dataset}.${ref.table} (dropdown source)`,
                    severity: "warn",
                });
            }
        });

        // Deduplicate by (kind, sourceId, detail)
        const seen = new Set<string>();
        const unique = deps.filter((d) => {
            const k = `${d.kind}::${d.sourceId}::${d.detail}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        return NextResponse.json({
            ok: true,
            target: { dataset: targetDs, table: targetTbl ?? null },
            references: unique,
            counts: {
                total: unique.length,
                blocker: unique.filter((d) => d.severity === "blocker").length,
                warn: unique.filter((d) => d.severity === "warn").length,
                info: unique.filter((d) => d.severity === "info").length,
            },
        });
    } catch (e) {
        console.error("[api:references GET]", e);
        return NextResponse.json(
            { ok: false, message: e instanceof Error ? e.message : String(e) },
            { status: 500 },
        );
    }
}
