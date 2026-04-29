/**
 * proxy — gate /data-workspace/* via HMAC cookie.
 *
 *  Next.js 16 renamed the `middleware` file convention to `proxy`.
 *  Same runtime semantics: runs on the edge, intercepts matched requests.
 *  Ref: https://nextjs.org/docs/messages/middleware-to-proxy
 *
 *  ▸ /data-workspace/login → allow unauthenticated
 *  ▸ all other /data-workspace/* → require valid `dw_auth` cookie
 *  ▸ /api/workspace/* (non-auth) → require valid cookie (API same gate)
 */

import { NextResponse, type NextRequest } from "next/server";
import { WORKSPACE_COOKIE, verifyToken } from "@/lib/workspace-auth";

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    const isPage = pathname.startsWith("/data-workspace");
    const isApi = pathname.startsWith("/api/workspace");
    if (!isPage && !isApi) return NextResponse.next();

    // Always allow login page + auth API
    if (pathname.startsWith("/data-workspace/login")) return NextResponse.next();
    if (pathname.startsWith("/api/workspace/auth/")) return NextResponse.next();

    const cookie = req.cookies.get(WORKSPACE_COOKIE)?.value;
    const payload = cookie ? await verifyToken(cookie) : null;

    if (!payload) {
        if (isApi) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const url = req.nextUrl.clone();
        url.pathname = "/data-workspace/login";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/data-workspace/:path*", "/api/workspace/:path*"],
};
