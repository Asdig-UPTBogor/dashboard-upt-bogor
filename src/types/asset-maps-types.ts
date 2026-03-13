/**
 * Shared types for Asset Maps page data.
 * Moved from dedicated API routes to enable SSOT via /api/page-data.
 */

export interface Tower {
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
    risks: Record<string, boolean>;
}

export interface GarduInduk {
    id: number;
    name: string;
    ultg: string;
    type: string;
    voltage: number;
    lat: number;
    lng: number;
}

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
    currentKa: number;
    maxKa: number;
    avgKa: number;
    risetime: number;
    maxRateRise: number;
    chiSquare: number;
    ellSemiMajor: number;
    ellSemiMinor: number;
    ellAngle: number;
    closestM: number;
    distanceMeters: number;
}

/* ── Helpers ── */

/** Case-insensitive row value getter — handles header case mismatches + null values from BQ */
function getVal(row: Record<string, string>, key: string): string {
    // Try exact match first (fast path)
    if (row[key] !== undefined) return row[key] ?? "";
    // Fallback: case-insensitive search
    const keyLower = key.toLowerCase();
    for (const k of Object.keys(row)) {
        if (k.toLowerCase() === keyLower) return row[k] ?? "";
    }
    return "";
}

/* ── Row-to-typed-object parsers ── */

/** Parse raw page-data row (Record<string, string>) into Tower */
export function parseRowToTower(row: Record<string, string>, idx: number): Tower | null {
    const lat = parseFloat(getVal(row, "LAT"));
    const lng = parseFloat(getVal(row, "LONG"));
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

    return {
        id: idx,
        name: getVal(row, "NAMA TOWER").trim(),
        penghantar: getVal(row, "PENGHANTAR").trim(),
        ultg: getVal(row, "MASTER ULTG").trim(),
        garduInduk: getVal(row, "MASTER GARDU INDUK").trim(),
        funloc: getVal(row, "FUNLOC TOWER").trim(),
        type: getVal(row, "TYPE").trim(),
        isolator: getVal(row, "ISOLATOR").trim(),
        sirkit: getVal(row, "SIRKIT").trim(),
        lat,
        lng,
        tla: getVal(row, "TLA").trim(),
        mrgLama: getVal(row, "MRG LAMA").trim(),
        mrgBaru: getVal(row, "MRG BARU").trim(),
        keterangan: getVal(row, "KETERANGAN").trim(),
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
    };
}

/** Parse raw page-data row into GarduInduk.
 *  Source: "Koordinat Gardu Induk" sheet. */
export function parseRowToGI(row: Record<string, string>, idx: number): GarduInduk | null {
    const lat = parseFloat(getVal(row, "Latitude"));
    const lng = parseFloat(getVal(row, "Longitude"));
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

    return {
        id: idx,
        name: getVal(row, "Master Gardu Induk").trim(),
        ultg: getVal(row, "Master ULTG").trim(),
        type: "",    // Not available in Koordinat Gardu Induk sheet
        voltage: 0,  // Not available in Koordinat Gardu Induk sheet
        lat,
        lng,
    };
}

/** Parse raw page-data row into FlashEvent (with dedup support).
 *  Uses case-insensitive getVal and "Nama Tower (Resolved)" as primary tower column. */
export function parseRowToFlashEvent(row: Record<string, string>): FlashEvent | null {
    const getStr = (key: string) => getVal(row, key).trim();
    const getNum = (key: string) => {
        const v = getVal(row, key).replace(",", ".");
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    };

    const eventTime = getStr("event_time_wib");
    // Primary tower name: "Nama Tower (Resolved)" — the corrected/resolved name
    const towerResolved = getStr("Nama Tower (Resolved)");
    if (!eventTime || !towerResolved) return null;

    const strikeLat = getNum("strike_lat");
    const strikeLng = getNum("strike_lon");
    if (!strikeLat || !strikeLng) return null;

    const key = `${eventTime}|${towerResolved}`;

    return {
        id: key,
        eventTime,
        towerName: towerResolved,
        towerNameVaisala: towerResolved,
        ultg: getStr("Master ULTG"),
        gi: getStr("Master Gardu Induk"),
        strikeLat,
        strikeLng,
        towerLat: getNum("tower_lat"),
        towerLng: getNum("tower_lon"),
        tegangan: getNum("tegangan"),
        penghantar: getStr("penghantar"),
        strokeCount: getNum("stroke_count") || 1,
        flashType: getStr("flash_type") || "Single",
        currentKa: getNum("strike_current_ka"),
        maxKa: getNum("max_ka"),
        avgKa: getNum("avg_ka"),
        risetime: getNum("strike_risetime"),
        maxRateRise: getNum("strike_maxraterise"),
        chiSquare: getNum("strike_chi_square"),
        ellSemiMajor: getNum("strike_ell_semimajor_axis"),
        ellSemiMinor: getNum("strike_ell_semiminor_axis"),
        ellAngle: getNum("strike_ell_angle"),
        closestM: getNum("closest_m"),
        distanceMeters: getNum("distance_meters"),
    };
}

/** Deduplicate flash events by eventTime + towerName */
export function deduplicateFlashEvents(events: FlashEvent[]): FlashEvent[] {
    const seen = new Set<string>();
    const result: FlashEvent[] = [];
    for (const e of events) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        result.push(e);
    }
    return result;
}
