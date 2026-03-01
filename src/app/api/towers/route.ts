import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { resolveApiDataSource } from "@/lib/data-source-resolver";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";
import { ApiCache } from "@/lib/api-cache";

// Cache: 5 min — tower positions rarely change (see dashboard-config.ts)
export const revalidate = 300;

/**
 * /api/towers — Fetch transmission tower data from Master Transmisi spreadsheet
 *
 * Source: Thor Vaisala PostgreSQL → migrated to Google Sheets
 * ~1,800 towers with LAT/LONG columns
 *
 * Sheet headers are now dynamically resolved via data-source-registry.ts
 */
// In-memory cache: fetch-once — invalidated only by manual refresh
const towerCache = new ApiCache<Tower[]>();


interface Tower {
    id: number;
    name: string;
    penghantar: string;
    ultg: string;
    garduInduk: string;
    funloc: string;
    type: string;
    isolator: string;
    sirkit: string;
    lat: number;
    lng: number;
    tla: string;
    mrgLama: string;
    mrgBaru: string;
    keterangan: string;
    // Kerawanan (risk) flags
    risks: Record<string, boolean>;
}

async function fetchTowers(): Promise<Tower[]> {

    const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_CREDS_PATH,
        scopes: [...GOOGLE_SCOPES],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const { spreadsheetId, sheetName, mappedColumns } = resolveApiDataSource('/api/towers');

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:AJ`,
    });

    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    const headers = rows[0] as string[];
    const col = (configName: string) => {
        const actualName = mappedColumns[configName] || configName;
        const idx = headers.findIndex(h => h?.trim().toUpperCase() === actualName.toUpperCase());
        return idx;
    };
    const getVal = (row: string[], colName: string) => {
        const idx = col(colName);
        return idx >= 0 ? (row[idx] || "").trim() : "";
    };

    const towers: Tower[] = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const lat = parseFloat(getVal(row, "LAT"));
        const lng = parseFloat(getVal(row, "LONG"));
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

        towers.push({
            id: i,
            name: getVal(row, "NAMA TOWER"),
            penghantar: getVal(row, "PENGHANTAR"),
            ultg: getVal(row, "Master ULTG"),
            garduInduk: getVal(row, "Master Gardu Induk"),
            funloc: getVal(row, "FUNLOC TOWER"),
            type: getVal(row, "TYPE"),
            isolator: getVal(row, "ISOLATOR"),
            sirkit: getVal(row, "SIRKIT"),
            lat,
            lng,
            tla: getVal(row, "TLA"),
            mrgLama: getVal(row, "MRG LAMA"),
            mrgBaru: getVal(row, "MRG BARU"),
            keterangan: getVal(row, "KETERANGAN"),
            risks: {
                andongan: getVal(row, "ANDONGAN RENDAH").toUpperCase() === "YA",
                galian: getVal(row, "GALIAN").toUpperCase() === "YA",
                pohon: getVal(row, "POHON").toUpperCase() === "YA",
                bangunan: getVal(row, "BANGUNAN").toUpperCase() === "YA",
                layangan: getVal(row, "LAYANGAN").toUpperCase() === "YA",
                balonUdara: getVal(row, "BALON UDARA").toUpperCase() === "YA",
                longsor: getVal(row, "LONGSOR").toUpperCase() === "YA",
                banjir: getVal(row, "BANJIR").toUpperCase() === "YA",
                petir: getVal(row, "PETIR").toUpperCase() === "YA",
                sosial: getVal(row, "SOSIAL/WARGA/PTPN/TNGHS/DLL").toUpperCase() === "YA",
                pencurian: getVal(row, "PENCURIAN").toUpperCase() === "YA",
            },
        });
    }

    return towers;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        if (searchParams.get("refresh") === "true") towerCache.invalidate();

        const towers = await towerCache.getOrFetch(fetchTowers);
        return NextResponse.json({
            towers,
            total: towers.length,
            source: "Master Transmisi",
            cacheAge: towerCache.ageSeconds,
        });
    } catch (err) {
        console.error("[/api/towers] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch tower data", detail: String(err) },
            { status: 500 }
        );
    }
}
