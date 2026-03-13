/**
 * Google Sheets API — Shared Fetch Module
 *
 * Extracted from route.ts so both the API handler and background
 * prefetch worker can use the same fetch logic.
 *
 * Optimized: 1 API call per sheet (fetches all data, filters columns server-side).
 */

import { google } from "googleapis";
import { getGoogleAuth, GOOGLE_SCOPES } from "@/lib/dashboard-config";


/* ── Dev-only logging ── */
const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };

/* ── Google Sheets Client (singleton) ── */
let sheetsClient: ReturnType<typeof google.sheets> | null = null;

export async function getSheetsClient() {
    if (sheetsClient) return sheetsClient;
    const auth = getGoogleAuth(GOOGLE_SCOPES);
    sheetsClient = google.sheets({ version: "v4", auth });
    return sheetsClient;
}

/* ── Spreadsheet Title Cache (auto-fetched, cached forever) ── */
const globalForTitles = globalThis as typeof globalThis & { __spreadsheetTitles?: Map<string, string> };
const titleCache = globalForTitles.__spreadsheetTitles ??= new Map<string, string>();

export async function getSpreadsheetTitle(spreadsheetId: string): Promise<string> {
    const cached = titleCache.get(spreadsheetId);
    if (cached) return cached;

    try {
        const client = await getSheetsClient();
        const res = await client.spreadsheets.get({
            spreadsheetId,
            fields: "properties.title",
        });
        const title = res.data.properties?.title ?? spreadsheetId.slice(0, 10);
        titleCache.set(spreadsheetId, title);
        devLog(`[sheets-api] Title for ${spreadsheetId.slice(0, 8)}... → "${title}"`);
        return title;
    } catch {
        // JANGAN cache fallback — biar bisa retry di siklus berikutnya
        return spreadsheetId.slice(0, 10);
    }
}

/**
 * Column config from per-page JSON.
 * `name` = source of truth (must match actual header in sheet).
 * `pos`  = optimization hint (check this position first before scanning).
 */
export interface ColumnPosition {
    name: string;
    pos: string;
}

/** Columns that could not be found in the actual sheet */
export interface MissingColumn {
    name: string;
    configPos: string;
    reason: "not_found" | "header_mismatch";
}

export interface SheetData {
    headers: string[];
    rows: Record<string, string>[];
    rowCount: number;
    missingColumns: MissingColumn[];
}

/**
 * Fetch data from a single sheet — SINGLE API call.
 *
 * Fetches the entire sheet in 1 call, then:
 *   - Row 1 = headers → resolve column positions
 *   - Remaining rows = data → pick only matched columns
 */
export async function fetchSheetData(
    spreadsheetId: string,
    sheetName: string,
    columnPositions: ColumnPosition[]
): Promise<SheetData> {
    const client = await getSheetsClient();

    if (!columnPositions || columnPositions.length === 0) {
        throw new Error(`[fetchSheetData] No columns configured for sheet "${sheetName}"`);
    }

    // ── Single API call: fetch entire sheet ──
    devLog(`[fetchSheetData] Fetching "${sheetName}" (1 call, all columns)...`);
    const res = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'`,
    });

    const allRows = res.data.values || [];
    if (allRows.length === 0) {
        return { headers: [], rows: [], rowCount: 0, missingColumns: [] };
    }

    // ── Row 0 = headers ──
    const headerValues: string[] = allRows[0].map(
        (v: unknown) => (v || "").toString().trim()
    );

    if (headerValues.length === 0) {
        return { headers: [], rows: [], rowCount: 0, missingColumns: [] };
    }

    // Build lowercase header → column index mapping
    const headerNameToIndex = new Map<string, number>();
    for (let i = 0; i < headerValues.length; i++) {
        const name = headerValues[i].toLowerCase();
        if (name) headerNameToIndex.set(name, i);
    }

    // ── Resolve each config column by POS (strict) or name (fallback) ──
    const matched: { name: string; colIndex: number }[] = [];
    const missing: MissingColumn[] = [];

    for (const col of columnPositions) {
        const configName = col.name.trim().toLowerCase();
        const configPos = col.pos.trim().toUpperCase();

        // Check the configured position first
        const posIndex = colLetterToIndex(configPos);
        const actualNameAtPos = headerValues[posIndex]?.toLowerCase();

        if (actualNameAtPos === configName) {
            matched.push({ name: col.name, colIndex: posIndex });
        } else {
            // POS doesn't match — try scanning by name
            const foundIndex = headerNameToIndex.get(configName);
            if (foundIndex !== undefined) {
                matched.push({ name: col.name, colIndex: foundIndex });
            } else {
                missing.push({
                    name: col.name,
                    configPos: col.pos,
                    reason: actualNameAtPos ? "header_mismatch" : "not_found",
                });
            }
        }
    }

    // If no columns matched, return empty with missing info
    if (matched.length === 0) {
        return { headers: [], rows: [], rowCount: 0, missingColumns: missing };
    }

    // ── Extract data rows using matched column indices ──
    const headers = matched.map(c => c.name);
    const dataRows: Record<string, string>[] = [];

    for (let rowIdx = 1; rowIdx < allRows.length; rowIdx++) {
        const rawRow = allRows[rowIdx];
        const obj: Record<string, string> = {
            _rowIndex: (rowIdx + 1).toString() // 1-based index for Google Sheets BatchUpdate
        };
        let hasData = false;

        for (const col of matched) {
            const value = (rawRow[col.colIndex] || "").toString().trim();
            obj[col.name] = value;
            if (value !== "") hasData = true;
        }

        if (hasData) dataRows.push(obj);
    }

    devLog(`[fetchSheetData] ${sheetName}: ${headers.length} cols, ${dataRows.length} rows, ${missing.length} missing`);
    return { headers, rows: dataRows, rowCount: dataRows.length, missingColumns: missing };
}

/* ── Helpers ── */

/** Convert column letter to 0-based index (A=0, B=1, ..., Z=25, AA=26) */
function colLetterToIndex(letter: string): number {
    let idx = 0;
    for (let i = 0; i < letter.length; i++) {
        idx = idx * 26 + (letter.charCodeAt(i) - 64);
    }
    return idx - 1;
}
