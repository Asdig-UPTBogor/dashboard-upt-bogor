import { NextResponse } from "next/server";
import { google } from "googleapis";
import { resolveApiDataSource } from "@/lib/data-source-resolver";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

// Cache: 5 min — substation data rarely changes (see dashboard-config.ts)
export const revalidate = 300;

/**
 * /api/gardu-induk — Fetch Gardu Induk data from Asset GI Per ULTG spreadsheet
 *
 * Sheet headers are now dynamically resolved via data-source-registry.ts
 */



interface GarduInduk {
    id: number;
    name: string;
    ultg: string;
    type: string;
    voltage: number;
    lat: number;
    lng: number;
}

async function fetchGarduInduk(): Promise<GarduInduk[]> {

    const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_CREDS_PATH,
        scopes: [...GOOGLE_SCOPES],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const { spreadsheetId, sheetName, mappedColumns } = resolveApiDataSource('/api/gardu-induk');

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:G`,
    });

    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    // Case-insensitive header matching
    const headers = rows[0] as string[];
    const col = (configName: string) => {
        const actualName = mappedColumns[configName] || configName;
        const idx = headers.findIndex((h: string) => h?.trim().toUpperCase() === actualName.toUpperCase());
        return idx;
    };
    const getVal = (row: string[], colName: string) => {
        const idx = col(colName);
        return idx >= 0 ? (row[idx] || "").trim() : "";
    };

    const gis: GarduInduk[] = [];
    const debugRows: { name: string; latStr: string; lngStr: string }[] = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const latStr = getVal(row, "Latitude");
        const lngStr = getVal(row, "Longitude");
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        const name = getVal(row, "Master Gardu Induk");
        debugRows.push({ name, latStr, lngStr });

        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

        const voltage = parseInt(getVal(row, "Voltage (kV)")) || 0;

        gis.push({
            id: i,
            name,
            ultg: getVal(row, "Master ULTG"),
            type: getVal(row, "GI Type"),
            voltage,
            lat,
            lng,
        });
    }

    // Store debug for response
    (globalThis as Record<string, unknown>).__giDebug = {
        totalRows: rows.length,
        headers: rows[0],
        sampleRows: debugRows.slice(0, 5),
        withCoords: gis.length,
        withoutCoords: debugRows.length - gis.length,
    };

    return gis;
}

export async function GET() {
    try {
        const gis = await fetchGarduInduk();
        return NextResponse.json({
            garduInduk: gis,
            total: gis.length,
            source: "Asset GI Per ULTG",
            debug: { credsPath: GOOGLE_CREDS_PATH, ...((globalThis as Record<string, unknown>).__giDebug || {}) },
        });
    } catch (err) {
        console.error("[/api/gardu-induk] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch gardu induk data", detail: String(err) },
            { status: 500 },
        );
    }
}
