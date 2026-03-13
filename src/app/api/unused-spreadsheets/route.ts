import { NextResponse } from "next/server";
import {
    proxyDashboardSyncWorker,
    requireDashboardSyncWorkerUrl,
} from "@/lib/dashboard-sync-worker";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        requireDashboardSyncWorkerUrl();
        const upstream = await proxyDashboardSyncWorker("/unused-spreadsheets");
        const text = await upstream.text();
        return new Response(text, {
            status: upstream.status,
            headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        requireDashboardSyncWorkerUrl();
        const body = await request.text();
        const upstream = await proxyDashboardSyncWorker("/unused-spreadsheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });
        const text = await upstream.text();
        return new Response(text, {
            status: upstream.status,
            headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
