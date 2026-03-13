import { NextResponse } from "next/server";
import {
    listPageConfigsFromFirestore,
    loadPageConfigFromFirestore,
    savePageConfigToFirestore,
    syncRegistryRootFromPageConfigs,
} from "@/lib/firestore-dashboard-config";

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const page = url.searchParams.get("page");

        if (page) {
            const config = await loadPageConfigFromFirestore(page);
            if (!config) {
                return NextResponse.json({
                    success: false,
                    error: `No config found for page: ${page}`,
                }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                config,
            });
        }

        const pages = await listPageConfigsFromFirestore();

        return NextResponse.json({
            success: true,
            pages: pages.map((config: any) => ({
                page: config.page,
                label: config.label,
                dataSourceCount: Array.isArray(config.dataSources) ? config.dataSources.length : 0,
                relationCount: Array.isArray(config.relations) ? config.relations.length : 0,
                sheetNames: Array.isArray(config.dataSources)
                    ? config.dataSources.map((dataSource: any) => dataSource.sheetName)
                    : [],
                updatedAt: config.updatedAt || null,
            })),
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        if (!body?.page || !body?.label) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields: page, label",
            }, { status: 400 });
        }

        const saved = await savePageConfigToFirestore({
            page: body.page,
            label: body.label,
            dataSources: body.dataSources || [],
            relations: body.relations || [],
            nodePositions: body.nodePositions || {},
            updatedAt: new Date().toISOString(),
        });
        await syncRegistryRootFromPageConfigs();

        return NextResponse.json({
            success: true,
            message: `Config saved for ${saved?.page || body.page}`,
            updatedAt: saved?.updatedAt || null,
            error: null,
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error",
        }, { status: 500 });
    }
}
