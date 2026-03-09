import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const cache = (globalThis as any).sheetCache;
        if (!cache) {
            return NextResponse.json({ error: "No cache found in globalThis" });
        }

        // Coba ambil cache untuk Asset GI
        const cacheKeys = Array.from(cache.keys());
        let assetGIData = null;
        let foundKey = "";

        for (const key of cacheKeys) {
            if (key.includes("Asset GI") || key.includes("1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI")) {
                assetGIData = cache.get(key);
                foundKey = key;
                break;
            }
        }

        if (assetGIData) {
            return NextResponse.json({
                success: true,
                key: foundKey,
                dataLength: assetGIData.data ? assetGIData.data.length : 'unknown',
                data: assetGIData.data || []
            });
        } else {
            return NextResponse.json({
                success: false,
                message: "Asset GI not found in cache",
                availableKeys: cacheKeys
            });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
