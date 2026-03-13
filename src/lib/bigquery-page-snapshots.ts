import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/dashboard-config";

const BIGQUERY_PROJECT_ID =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "gcp-bridge-meshvpn";

const BIGQUERY_DATASET =
    process.env.BIGQUERY_DATASET ||
    "dashboard_upt_bogor";

const BIGQUERY_PAGE_SNAPSHOTS_TABLE =
    process.env.BIGQUERY_PAGE_SNAPSHOTS_TABLE ||
    "page_snapshots_current";

const BIGQUERY_LOCATION =
    process.env.BIGQUERY_LOCATION ||
    "asia-southeast2";

const BIGQUERY_SCOPES = ["https://www.googleapis.com/auth/bigquery.readonly"];

type PageSheet = {
    name?: string | null;
    sheetName?: string | null;
    headers?: string[];
    rows?: Record<string, unknown>[];
    rowCount?: number;
    hierarchyMapping?: Record<string, string> | null;
};

type PagePayload = {
    page: string;
    source?: string;
    fetchedAt?: string;
    sheetCount?: number;
    sheets?: PageSheet[];
    [key: string]: unknown;
};

async function getAccessToken() {
    const auth = getGoogleAuth(BIGQUERY_SCOPES);
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token =
        typeof tokenResponse === "string"
            ? tokenResponse
            : tokenResponse?.token || "";

    if (!token) {
        throw new Error("Failed to get BigQuery access token");
    }

    return token;
}

function filterRowsByMaxDays(sheet: PageSheet, maxDays: number | null) {
    if (!maxDays || maxDays <= 0) {
        return sheet;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);

    const dateColumn = (sheet.headers || []).find((header) => {
        const lower = header.toLowerCase();
        return lower.includes("time") || lower.includes("date");
    });

    if (!dateColumn) {
        return sheet;
    }

    const rows = (sheet.rows || []).filter((row) => {
        const value = row[dateColumn];
        if (!value) return false;
        const parsed = new Date(String(value).replace(" ", "T"));
        return !Number.isNaN(parsed.getTime()) && parsed >= cutoff;
    });

    return {
        ...sheet,
        rows,
        rowCount: rows.length,
    };
}

function getDateColumn(sheet: PageSheet) {
    return (sheet.headers || []).find((header) => {
        const lower = header.toLowerCase();
        return lower.includes("time") || lower.includes("date");
    }) || null;
}

function filterLatestRows(sheet: PageSheet, latestRows: number | null) {
    if (!latestRows || latestRows <= 0) {
        return sheet;
    }

    const dateColumn = getDateColumn(sheet);
    if (!dateColumn) {
        const rows = (sheet.rows || []).slice(0, latestRows);
        return {
            ...sheet,
            rows,
            rowCount: rows.length,
        };
    }

    const rows = [...(sheet.rows || [])]
        .sort((a, b) => {
            const aDate = new Date(String(a[dateColumn] || "").replace(" ", "T")).getTime();
            const bDate = new Date(String(b[dateColumn] || "").replace(" ", "T")).getTime();
            return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
        })
        .slice(0, latestRows);

    return {
        ...sheet,
        rows,
        rowCount: rows.length,
    };
}

function filterColumns(sheet: PageSheet, columns: string[]) {
    if (!Array.isArray(columns) || columns.length === 0) {
        return sheet;
    }

    const requested = new Set(columns.map((column) => String(column).trim()).filter(Boolean));
    if (requested.size === 0) {
        return sheet;
    }

    const hierarchyColumns = new Set<string>();
    const mapping = sheet.hierarchyMapping || null;
    if (mapping) {
        for (const value of Object.values(mapping)) {
            if (value) hierarchyColumns.add(String(value));
        }
    }

    const allowed = new Set([...requested, ...hierarchyColumns, "_rowIndex"]);
    const headers = (sheet.headers || []).filter((header) => allowed.has(header));
    const rows = (sheet.rows || []).map((row) => {
        const nextRow: Record<string, unknown> = {};
        for (const key of Object.keys(row)) {
            if (allowed.has(key)) {
                nextRow[key] = row[key];
            }
        }
        return nextRow;
    });

    return {
        ...sheet,
        headers,
        rows,
    };
}

function getGIMappingColumn(sheet: PageSheet) {
    const mapping = sheet.hierarchyMapping || null;
    if (mapping?.gi) return mapping.gi;
    return (sheet.headers || []).find((header) => header.toLowerCase().includes("gardu induk")) || null;
}

function filterRowsByGI(sheet: PageSheet, gi: string | null) {
    if (!gi) return sheet;
    const giColumn = getGIMappingColumn(sheet);
    if (!giColumn) return sheet;
    const target = gi.trim().toLowerCase();
    const rows = (sheet.rows || []).filter((row) => String(row[giColumn] || "").trim().toLowerCase() === target);
    return {
        ...sheet,
        rows,
        rowCount: rows.length,
    };
}

function detectLatitudeColumn(sheet: PageSheet) {
    const candidates = [
        "strike_lat",
        "tower_lat",
        "LAT",
        "Latitude",
        "latitude",
    ];
    const headers = sheet.headers || [];
    return candidates.find((candidate) => headers.includes(candidate)) || null;
}

function detectLongitudeColumn(sheet: PageSheet) {
    const candidates = [
        "strike_lon",
        "tower_lon",
        "LONG",
        "Longitude",
        "longitude",
    ];
    const headers = sheet.headers || [];
    return candidates.find((candidate) => headers.includes(candidate)) || null;
}

function filterRowsByBBox(
    sheet: PageSheet,
    bbox: { west: number; south: number; east: number; north: number } | null
) {
    if (!bbox) return sheet;
    const latColumn = detectLatitudeColumn(sheet);
    const lngColumn = detectLongitudeColumn(sheet);
    if (!latColumn || !lngColumn) return sheet;

    const rows = (sheet.rows || []).filter((row) => {
        const lat = Number.parseFloat(String(row[latColumn] || ""));
        const lng = Number.parseFloat(String(row[lngColumn] || ""));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        return (
            lng >= bbox.west &&
            lng <= bbox.east &&
            lat >= bbox.south &&
            lat <= bbox.north
        );
    });

    return {
        ...sheet,
        rows,
        rowCount: rows.length,
    };
}

export function applyPageDataFilters(
    payload: PagePayload,
    {
        sheetFilter,
        sheetFilters,
        maxDays,
        latestRows,
        columns,
        gi,
        bbox,
    }: {
        sheetFilter?: string | null;
        sheetFilters?: string[];
        maxDays?: number | null;
        latestRows?: number | null;
        columns?: string[];
        gi?: string | null;
        bbox?: { west: number; south: number; east: number; north: number } | null;
    }
) {
    const normalizedFilterSet = new Set(
        (sheetFilters || [])
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
    );

    if (sheetFilter?.trim()) {
        normalizedFilterSet.add(sheetFilter.trim().toLowerCase());
    }

    const targetSheets = normalizedFilterSet.size > 0
        ? (payload.sheets || []).filter((sheet) =>
            normalizedFilterSet.has((sheet.sheetName || "").trim().toLowerCase())
        )
        : payload.sheets || [];

    if (normalizedFilterSet.size > 0 && targetSheets.length === 0) {
        const requested = sheetFilter || Array.from(normalizedFilterSet).join(", ");
        throw new Error(`Sheet "${requested}" not found in page data for "${payload.page}"`);
    }

    const sheets = targetSheets.map((sheet) =>
        filterColumns(
            filterLatestRows(
                filterRowsByBBox(
                    filterRowsByGI(
                        filterRowsByMaxDays(sheet, maxDays ?? null),
                        gi ?? null
                    ),
                    bbox ?? null
                ),
                latestRows ?? null
            ),
            columns || []
        )
    );

    return {
        ...payload,
        sheetCount: sheets.length,
        columnsFiltered: Array.isArray(columns) && columns.length > 0 ? columns : null,
        sheets: sheets.map((sheet) => ({
            ...sheet,
            name: sheet.name || sheet.sheetName || null,
        })),
    };
}

export async function getCurrentPageSnapshotFromBigQuery(page: string) {
    const token = await getAccessToken();
    const response = await fetch(
        `https://bigquery.googleapis.com/bigquery/v2/projects/${BIGQUERY_PROJECT_ID}/queries`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: `
                    SELECT TO_JSON_STRING(data) AS data_json
                    FROM \`${BIGQUERY_PROJECT_ID}.${BIGQUERY_DATASET}.${BIGQUERY_PAGE_SNAPSHOTS_TABLE}\`
                    WHERE page = @page
                    ORDER BY generated_at DESC
                    LIMIT 1
                `,
                useLegacySql: false,
                location: BIGQUERY_LOCATION,
                parameterMode: "NAMED",
                queryParameters: [
                    {
                        name: "page",
                        parameterType: { type: "STRING" },
                        parameterValue: { value: page },
                    },
                ],
            }),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`BigQuery request failed (${response.status}): ${text}`);
    }

    const result = await response.json() as {
        rows?: { f?: { v?: string }[] }[];
    };

    const row = result.rows?.[0];
    const raw = row?.f?.[0]?.v;
    if (!raw) {
        return null;
    }

    return JSON.parse(raw) as PagePayload;
}
