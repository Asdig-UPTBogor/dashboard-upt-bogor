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

/* ── Row-to-typed-object parsers ── */

/** Parse raw page-data row (Record<string, string>) into Tower */
export function parseRowToTower(row: Record<string, string>, idx: number): Tower | null {
    const lat = parseFloat(row["LAT"] || "");
    const lng = parseFloat(row["LONG"] || "");
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

    return {
        id: idx,
        name: (row["NAMA TOWER"] || "").trim(),
        penghantar: (row["PENGHANTAR"] || "").trim(),
        ultg: (row["Master ULTG"] || "").trim(),
        garduInduk: (row["Master Gardu Induk"] || "").trim(),
        funloc: (row["FUNLOC TOWER"] || "").trim(),
        type: (row["TYPE"] || "").trim(),
        isolator: (row["ISOLATOR"] || "").trim(),
        sirkit: (row["SIRKIT"] || "").trim(),
        lat,
        lng,
        tla: (row["TLA"] || "").trim(),
        mrgLama: (row["MRG LAMA"] || "").trim(),
        mrgBaru: (row["MRG BARU"] || "").trim(),
        keterangan: (row["KETERANGAN"] || "").trim(),
        risks: {
            andongan: (row["ANDONGAN RENDAH"] || "").toUpperCase() === "YA",
            galian: (row["GALIAN"] || "").toUpperCase() === "YA",
            pohon: (row["POHON"] || "").toUpperCase() === "YA",
            bangunan: (row["BANGUNAN"] || "").toUpperCase() === "YA",
            layangan: (row["LAYANGAN"] || "").toUpperCase() === "YA",
            balonUdara: (row["BALON UDARA"] || "").toUpperCase() === "YA",
            longsor: (row["LONGSOR"] || "").toUpperCase() === "YA",
            banjir: (row["BANJIR"] || "").toUpperCase() === "YA",
            petir: (row["PETIR"] || "").toUpperCase() === "YA",
            sosial: (row["SOSIAL/WARGA/PTPN/TNGHS/DLL"] || "").toUpperCase() === "YA",
            pencurian: (row["PENCURIAN"] || "").toUpperCase() === "YA",
        },
    };
}

/** Parse raw page-data row into GarduInduk */
export function parseRowToGI(row: Record<string, string>, idx: number): GarduInduk | null {
    const lat = parseFloat(row["Latitude"] || "");
    const lng = parseFloat(row["Longitude"] || "");
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

    return {
        id: idx,
        name: (row["Master Gardu Induk"] || "").trim(),
        ultg: (row["Master ULTG"] || "").trim(),
        type: (row["GI Type"] || "").trim(),
        voltage: parseInt(row["Voltage (kV)"] || "0") || 0,
        lat,
        lng,
    };
}

/** Parse raw page-data row into FlashEvent (with dedup support) */
export function parseRowToFlashEvent(row: Record<string, string>): FlashEvent | null {
    const getStr = (key: string) => (row[key] || "").trim();
    const getNum = (key: string) => {
        const v = (row[key] || "").replace(",", ".");
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    };

    const eventTime = getStr("event_time_wib");
    const towerVaisala = getStr("tower_name");
    if (!eventTime || !towerVaisala) return null;

    const strikeLat = getNum("strike_lat");
    const strikeLng = getNum("strike_lon");
    if (!strikeLat || !strikeLng) return null;

    const key = `${eventTime}|${towerVaisala}`;

    return {
        id: key,
        eventTime,
        towerName: getStr("nama tower (resolved)") || getStr("tower_name_resolved") || towerVaisala,
        towerNameVaisala: towerVaisala,
        ultg: getStr("ultg") || getStr("master ultg") || getStr("upt"),
        gi: getStr("gi") || getStr("master gardu induk"),
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
