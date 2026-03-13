import { NextResponse } from "next/server";
import { getAllPages } from "@/lib/sidebar-config";
import {
    proxyDashboardSyncWorker,
    requireDashboardSyncWorkerUrl,
} from "@/lib/dashboard-sync-worker";
import {
    loadRegistryRootFromFirestore,
    syncRegistryRootFromPageConfigs,
} from "@/lib/firestore-dashboard-config";

export async function GET(request: Request) {
    try {
        requireDashboardSyncWorkerUrl();
        const url = new URL(request.url);

        if (url.searchParams.get("pages") === "1") {
            return NextResponse.json({ success: true, pages: getAllPages() });
        }

        if (url.searchParams.get("raw") === "1") {
            await syncRegistryRootFromPageConfigs();
            const registryRoot = await loadRegistryRootFromFirestore();
            return NextResponse.json({
                success: true,
                data: registryRoot?.spreadsheets || [],
            });
        }

        if (url.searchParams.get("explore")) {
            const workerQuery = new URLSearchParams();
            workerQuery.set("spreadsheetId", url.searchParams.get("explore") as string);
            const upstream = await proxyDashboardSyncWorker(`/config/explore?${workerQuery.toString()}`);
            const text = await upstream.text();
            return new Response(text, {
                status: upstream.status,
                headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
            });
        }

        const upstream = await proxyDashboardSyncWorker(`/config/health-check?${url.searchParams.toString()}`);
        if (url.searchParams.get("stream") === "1") {
            return new Response(upstream.body, {
                status: upstream.status,
                headers: {
                    "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
                    "Cache-Control": upstream.headers.get("cache-control") || "no-cache",
                    "Connection": upstream.headers.get("connection") || "keep-alive",
                },
            });
        }

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

export async function POST(request: Request) {
    try {
        requireDashboardSyncWorkerUrl();
        const body = await request.text();
        const upstream = await proxyDashboardSyncWorker("/config/registry", {
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
            success: false,
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        requireDashboardSyncWorkerUrl();
        const url = new URL(request.url);
        const upstream = await proxyDashboardSyncWorker(`/config/registry?${url.searchParams.toString()}`, {
            method: "DELETE",
        });
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

export async function PATCH(request: Request) {
    try {
        requireDashboardSyncWorkerUrl();
        const body = await request.text();
        const upstream = await proxyDashboardSyncWorker("/config/registry", {
            method: "PATCH",
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
            success: false,
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
