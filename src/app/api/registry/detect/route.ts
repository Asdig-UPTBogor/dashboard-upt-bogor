import { NextResponse } from "next/server";
import {
    proxyDashboardSyncWorker,
    requireDashboardSyncWorkerUrl,
} from "@/lib/dashboard-sync-worker";

export async function GET(request: Request) {
    try {
        requireDashboardSyncWorkerUrl();
        const url = new URL(request.url);
        const upstream = await proxyDashboardSyncWorker(`/registry/detect?${url.searchParams.toString()}`);
        const text = await upstream.text();
        return new Response(text, {
            status: upstream.status,
            headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
