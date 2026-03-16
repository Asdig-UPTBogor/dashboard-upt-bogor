/**
 * /api/refresh-data — DEPRECATED (Phase 4)
 *
 * Native table refresh is now handled by Cloud Function (sheet-bq-sync).
 * This endpoint returns a 410 Gone status with instructions to use the Sync Engine.
 *
 * Previously this route ran CREATE OR REPLACE TABLE from v_ views,
 * which is no longer needed since CF writes directly to n_ tables.
 */

import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json(
        {
            ok: false,
            error: "Native table refresh is now handled by Cloud Function (sheet-bq-sync). " +
                   "Use the Sync Engine page to trigger a manual sync, or call POST /api/sync-now.",
        },
        { status: 410 }
    );
}
