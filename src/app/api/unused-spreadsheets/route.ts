/**
 * Unused Spreadsheets API — Deteksi & hapus spreadsheet tidak terpakai
 *
 * GET  → daftar spreadsheets yang tidak dipakai oleh page manapun
 * POST → hapus spreadsheet dari registry (body: { ids: string[] })
 */

import { NextResponse } from "next/server";
import { getUnusedSpreadsheets, removeSpreadsheets } from "@/lib/data-source-registry";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const unused = getUnusedSpreadsheets();
        return NextResponse.json({ unused });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const ids = body.ids as string[];

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "ids harus berupa array non-kosong" }, { status: 400 });
        }

        const removed = removeSpreadsheets(ids);
        return NextResponse.json({ success: true, removed });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
