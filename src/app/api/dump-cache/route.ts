import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        ok: false,
        error: "Endpoint dump-cache sudah dipensiunkan. Runtime dashboard kini memakai Firestore + BigQuery + Sync Worker.",
    }, { status: 410 });
}
