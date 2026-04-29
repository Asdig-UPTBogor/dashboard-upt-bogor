import { NextResponse } from "next/server";
import { checkPassword, signToken, WORKSPACE_COOKIE, WORKSPACE_TTL_SECONDS } from "@/lib/workspace-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({})) as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";

    if (!checkPassword(password)) {
        await new Promise((r) => setTimeout(r, 400)); // dampen brute force
        return NextResponse.json({ error: "invalid password" }, { status: 401 });
    }

    const token = await signToken("admin");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(WORKSPACE_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: WORKSPACE_TTL_SECONDS,
    });
    return res;
}
