import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { resolveApiDataSource } from "@/lib/data-source-resolver";
import { GOOGLE_CREDS_PATH, GOOGLE_SCOPES } from "@/lib/dashboard-config";

// Cache: 1 min — lightning data is more dynamic (see dashboard-config.ts)
export const revalidate = 60;

/**
 * /api/strikes — Flash event data from spreadsheet
 *
 * Header-based column lookup (robust against column order changes).
 * Deduplicates per flash event: (event_time_wib + tower_name) = 1 flash event.
 *
 * Query params:
 *   ?days=N   — filter last N days (default: 365, max: 365)
 *
 * Sheet headers are now dynamically resolved via data-source-registry.ts
 */



export interface FlashEvent {
    id: string;
    eventTime: string;
    towerName: string;
    towerNameVaisala: string;
    ultg: string;
    gi: string;
    strikeLat: number;
    strikeLng: number;
    towerLat: number;
    towerLng: number;
    tegangan: number;
    penghantar: string;
    strokeCount: number;
    flashType: string;
    // kA
    currentKa: number;      // raw per-stroke kA (with polarity +/-)
    maxKa: number;
    avgKa: number;
    // Signal params
    risetime: number;       // μs
    maxRateRise: number;    // kA/μs  (di/dt)
    chiSquare: number;
    // Ellipse (accuracy)
    ellSemiMajor: number;   // metres
    ellSemiMinor: number;   // metres
    ellAngle: number;       // degrees
    // Distances
    closestM: number;
    distanceMeters: number;
}

async function fetchFlashEvents(): Promise<FlashEvent[]> {

    const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_CREDS_PATH,
        scopes: [...GOOGLE_SCOPES],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const { spreadsheetId, sheetName, mappedColumns } = resolveApiDataSource('/api/strikes');

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:AZ`,
    });

    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    // ── Header-based column lookup ──
    const rawHeaders = rows[0] as string[];
    const h = (configName: string): number => {
        const actualName = mappedColumns[configName] || configName;
        return rawHeaders.findIndex(v => v?.trim().toLowerCase() === actualName.toLowerCase());
    };

    // Core
    const iEventTime = h("event_time_wib");
    const iTowerName = h("tower_name");
    const iTowerLat = h("tower_lat");
    const iTowerLng = h("tower_lon");
    const iStrikeLat = h("strike_lat");
    const iStrikeLng = h("strike_lon");
    const iTegangan = h("tegangan");
    const iPenghantar = h("penghantar");
    const iUtp = h("upt");

    // kA
    const iCurrentKa = h("strike_current_ka");
    const iMaxKa = h("max_ka");
    const iAvgKa = h("avg_ka");

    // Signal params
    const iRisetime = h("strike_risetime");
    const iMaxRateRise = h("strike_maxraterise");
    const iChiSquare = h("strike_chi_square");

    // Ellipse
    const iEllSemiMajor = h("strike_ell_semimajor_axis");
    const iEllSemiMinor = h("strike_ell_semiminor_axis");
    const iEllAngle = h("strike_ell_angle");

    // Distances (dist_to_tower_real & dist_to_line_real removed — calculated on FE)
    const iClosestM = h("closest_m");
    const iDistMeters = h("distance_meters");

    // Stroke info
    const iStrokeCount = h("stroke_count");
    const iFlashType = h("flash_type");

    // Resolved / enrichment
    const iTowerResolved = h("nama tower (resolved)") >= 0 ? h("nama tower (resolved)") : h("tower_name_resolved");
    const iUltg = h("ultg") >= 0 ? h("ultg") : h("master ultg");
    const iGi = h("gi") >= 0 ? h("gi") : h("master gardu induk");

    console.log(`[/api/strikes] Headers: event_time=${iEventTime}, tower=${iTowerName}, kA=${iCurrentKa}, ellipse=[${iEllSemiMajor},${iEllSemiMinor},${iEllAngle}], rise=${iRisetime}`);

    if (iEventTime < 0 || iTowerName < 0) {
        console.error("[/api/strikes] Critical columns missing! Headers:", rawHeaders.slice(0, 15));
        return [];
    }

    const getStr = (row: string[], idx: number): string =>
        idx >= 0 ? (row[idx] || "").trim() : "";
    const getNum = (row: string[], idx: number): number => {
        if (idx < 0) return 0;
        const v = (row[idx] || "").replace(",", ".");
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    };

    // Deduplicate: one flash event per (event_time_wib + tower_name)
    const seen = new Set<string>();
    const events: FlashEvent[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        if (!row || !row[iEventTime]) continue;

        const eventTime = getStr(row, iEventTime);
        const towerVaisala = getStr(row, iTowerName);
        if (!eventTime || !towerVaisala) continue;

        const key = `${eventTime}|${towerVaisala}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const strikeLat = getNum(row, iStrikeLat);
        const strikeLng = getNum(row, iStrikeLng);
        if (!strikeLat || !strikeLng) continue;

        events.push({
            id: key,
            eventTime,
            towerName: getStr(row, iTowerResolved) || towerVaisala,
            towerNameVaisala: towerVaisala,
            ultg: getStr(row, iUltg) || getStr(row, iUtp),
            gi: getStr(row, iGi),
            strikeLat,
            strikeLng,
            towerLat: getNum(row, iTowerLat),
            towerLng: getNum(row, iTowerLng),
            tegangan: getNum(row, iTegangan),
            penghantar: getStr(row, iPenghantar),
            strokeCount: getNum(row, iStrokeCount) || 1,
            flashType: getStr(row, iFlashType) || "Single",
            // kA
            currentKa: getNum(row, iCurrentKa),
            maxKa: getNum(row, iMaxKa),
            avgKa: getNum(row, iAvgKa),
            // Signal
            risetime: getNum(row, iRisetime),
            maxRateRise: getNum(row, iMaxRateRise),
            chiSquare: getNum(row, iChiSquare),
            // Ellipse
            ellSemiMajor: getNum(row, iEllSemiMajor),
            ellSemiMinor: getNum(row, iEllSemiMinor),
            ellAngle: getNum(row, iEllAngle),
            // Distance (dist_to_tower/line calculated on FE via Turf.js)
            closestM: getNum(row, iClosestM),
            distanceMeters: getNum(row, iDistMeters),
        });
    }


    console.log(`[/api/strikes] ✅ ${events.length} flash events (${rows.length - 1} rows)`);
    return events;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "365")));

        const allEvents = await fetchFlashEvents();

        let filtered = allEvents;
        if (days < 365) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffStr = cutoff.toISOString().slice(0, 19).replace("T", " ");
            filtered = allEvents.filter(e => e.eventTime >= cutoffStr);
        }

        return NextResponse.json({
            events: filtered,
            total: filtered.length,
            totalAll: allEvents.length,
            days,
            source: "Strike Data (Vaisala)",
        });
    } catch (err) {
        console.error("[/api/strikes] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch strike data", detail: String(err) },
            { status: 500 }
        );
    }
}
