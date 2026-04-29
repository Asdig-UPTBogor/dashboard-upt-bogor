import { NextResponse } from "next/server";
import { WORKSPACE_COOKIE } from "@/lib/workspace-auth";

export const runtime = "nodejs";

export async function POST() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
}
