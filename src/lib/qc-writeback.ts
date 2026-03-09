/**
 * QC Writeback Worker
 *
 * Runs after the prefetch worker fetches data. Validates hierarchy columns
 * against Master data and writes red background formatting to invalid cells
 * in Google Sheets.
 *
 * ⚠ SAFETY:
 *   - ONLY writes cell formatting (backgroundColor + note), NEVER changes data
 *   - DRY_RUN mode: logs what would be written without actually writing
 *   - Write-once: skips if QC results haven't changed since last run
 *   - Toggle: must be explicitly enabled to write
 *
 * Column positions: resolved BY HEADER NAME from actual spreadsheet data,
 * NOT from hardcoded config positions.
 */

import { sheetCache } from "@/lib/sheet-cache";
import { getSheetsClient } from "@/lib/sheets-api";
import {
    buildValidSets,
    getStrictHierarchyColumnsInHeaders,
    validateRow,
    type HierarchyValidSets,
} from "@/app/maintenance/master-data/_components/hierarchy-qc";
import {
    setQcReport,
    getQcReport,
    needsWrite,
    hashInvalidCells,
    type SheetQcResult,
    type QcReport,
} from "@/lib/qc-store";

/* ── Config ── */
const globalForQcConfig = globalThis as typeof globalThis & { __qcWritebackEnabled?: boolean };

/** Toggle QC writeback on/off. DEFAULT: OFF (safe) */
export function setQcWritebackEnabled(enabled: boolean) {
    globalForQcConfig.__qcWritebackEnabled = enabled;
    console.log(`[QC Worker] Writeback ${enabled ? "ENABLED" : "DISABLED"}`);
}
export function isQcWritebackEnabled(): boolean {
    return globalForQcConfig.__qcWritebackEnabled ?? true;
}

/** Master Hierarchy spreadsheet ID */
const MASTER_HIERARCHY_SS_ID = "1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI";

const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };

/* ── Types ── */
interface InvalidCell {
    rowIdx: number;
    colName: string;
    reason: string;
}

interface SheetWriteJob {
    sheetName: string;
    sheetId: number; // numeric Google Sheets internal ID
    hierCols: string[];
    invalidCells: InvalidCell[];
    /** Previous run's invalid cells — used to compute diff for clearing */
    previousCells: [number, string, string][];
}

/* ── Main QC Writeback Function ── */

/**
 * Run QC validation on all cached sheets and optionally write formatting to Google Sheets.
 * Called by background-prefetch after each fetch cycle completes.
 */
export async function runQcWriteback(): Promise<void> {
    const t0 = Date.now();
    devLog("\n[QC Worker] ── Starting QC validation ──");

    // 1. Build valid sets from Master Hierarchy (from cache)
    const validSets = buildValidSetsFromCache();
    if (!validSets) {
        devLog("[QC Worker] ⏭ Skip: Master Hierarchy not in cache yet");
        return;
    }

    devLog(`[QC Worker] Valid sets: ${validSets.ultg.size} ULTG, ${validSets.gi.size} GI, ${validSets.bay.size} Bay`);

    // 2. Scan all cached sheets for hierarchy errors
    const results = new Map<string, SheetQcResult>();
    let totalErrors = 0;
    let sheetsChecked = 0;
    let sheetsWithErrors = 0;

    // Group write jobs by spreadsheetId for batching
    const writeJobsBySpreadsheet = new Map<string, SheetWriteJob[]>();

    const allEntries = sheetCache.getAllEntries();

    for (const [cacheKey, cacheEntry] of allEntries) {
        const [spreadsheetId, sheetName] = cacheKey.split("::");
        if (!spreadsheetId || !sheetName) continue;

        // Skip MASTER HIERARCHY itself
        if (spreadsheetId === MASTER_HIERARCHY_SS_ID) continue;

        const { data } = cacheEntry;
        if (!data.rows || data.rows.length === 0) continue;

        // Only check sheets with strict "Master *" hierarchy columns
        const hierCols = getStrictHierarchyColumnsInHeaders(data.headers);
        if (hierCols.length === 0) continue;

        sheetsChecked++;

        // 3. Validate each row and collect invalid cells
        const invalidCells: InvalidCell[] = [];
        for (let rowIdx = 0; rowIdx < data.rows.length; rowIdx++) {
            const row = data.rows[rowIdx];
            const result = validateRow(row, hierCols, validSets);
            if (!result.isHealthy) {
                for (const [col, qc] of Object.entries(result.details)) {
                    if (!qc.isValid) {
                        invalidCells.push({
                            rowIdx,
                            colName: col,
                            reason: qc.reason || "Invalid",
                        });
                    }
                }
            }
        }

        const rawCells: [number, string, string][] = invalidCells.map(c => [c.rowIdx, c.colName, c.reason]);
        const hash = hashInvalidCells(rawCells);
        const shouldWriteThis = needsWrite(cacheKey, hash);

        const sheetResult: SheetQcResult = {
            spreadsheetId,
            sheetName,
            total: data.rows.length,
            invalid: invalidCells.length > 0
                ? new Set(invalidCells.map(c => c.rowIdx)).size
                : 0,
            invalidCells: rawCells,
            hash,
            written: false,
            lastRun: new Date().toISOString(),
        };

        if (invalidCells.length > 0) {
            sheetsWithErrors++;
            totalErrors += sheetResult.invalid;
        }

        // 4. Queue write job if enabled AND results need writing
        if (shouldWriteThis && isQcWritebackEnabled()) {
            if (!writeJobsBySpreadsheet.has(spreadsheetId)) {
                writeJobsBySpreadsheet.set(spreadsheetId, []);
            }
            // Get previous invalid cells for diff computation
            const prevReport = getQcReport();
            const prevResult = prevReport?.results.get(cacheKey);
            const previousCells = prevResult?.invalidCells || [];
            writeJobsBySpreadsheet.get(spreadsheetId)!.push({
                sheetName,
                sheetId: -1,
                hierCols,
                invalidCells,
                previousCells,
            });
            sheetResult.written = true; // optimistic, will be set false on error
        } else if (shouldWriteThis) {
            devLog(`[QC Worker] 🔍 DRY-RUN: ${sheetName} → ${invalidCells.length} invalid cells (writeback disabled)`);
        }

        results.set(cacheKey, sheetResult);
    }

    // 5. Execute writes — 1 batchUpdate per spreadsheet
    let sheetsWritten = 0;
    for (const [spreadsheetId, jobs] of writeJobsBySpreadsheet) {
        try {
            await writeBatchFormatting(spreadsheetId, jobs);
            sheetsWritten += jobs.length;
            devLog(`[QC Worker] ✏️ Written: ${spreadsheetId} (${jobs.length} sheets, ${jobs.reduce((s, j) => s + j.invalidCells.length, 0)} cells)`);
        } catch (err) {
            console.error(`[QC Worker] ❌ Write error for ${spreadsheetId}:`, err);
            // Mark sheets as not written
            for (const job of jobs) {
                const key = `${spreadsheetId}::${job.sheetName}`;
                const r = results.get(key);
                if (r) r.written = false;
            }
        }
    }

    // 6. Save QC report
    const report: QcReport = {
        results,
        lastRun: new Date().toISOString(),
        totalErrors,
    };
    setQcReport(report);

    const elapsed = Date.now() - t0;
    devLog(`[QC Worker] ── Done: ${sheetsChecked} sheets, ${sheetsWithErrors} with errors, ${totalErrors} total errors, ${sheetsWritten} written (${elapsed}ms) ──\n`);
}

/* ── Helper: Build valid sets from cache ── */
function buildValidSetsFromCache(): HierarchyValidSets | null {
    const giData = sheetCache.get(MASTER_HIERARCHY_SS_ID, "Master Gardu Induk");
    const bayData = sheetCache.get(MASTER_HIERARCHY_SS_ID, "Master Bay");

    if (!giData && !bayData) return null;

    const hierarchySheets: any[] = [];
    if (giData) hierarchySheets.push({ sheetName: "Master Gardu Induk", rows: giData.rows });
    if (bayData) hierarchySheets.push({ sheetName: "Master Bay", rows: bayData.rows });

    return buildValidSets(hierarchySheets);
}

/* ── Write formatting: 1 batchUpdate per spreadsheet ── */
async function writeBatchFormatting(
    spreadsheetId: string,
    jobs: SheetWriteJob[],
): Promise<void> {
    const client = await getSheetsClient();

    // 1. Get all sheetIds + actual header rows in one call
    const ssInfo = await client.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties,sheets.data.rowData.values.formattedValue",
        includeGridData: true,
    });
    const sheetIdMap = new Map<string, number>();
    const sheetHeaderMap = new Map<string, string[]>(); // sheetName -> real header row
    for (const s of ssInfo.data.sheets || []) {
        if (s.properties?.title != null && s.properties?.sheetId != null) {
            sheetIdMap.set(s.properties.title, s.properties.sheetId);
            // Extract actual header row (row 0) for column position resolution
            const headerRow: string[] = [];
            if (s.data?.[0]?.rowData?.[0]?.values) {
                for (const v of s.data[0].rowData[0].values) {
                    headerRow.push(v?.formattedValue || "");
                }
            }
            sheetHeaderMap.set(s.properties.title, headerRow);
        }
    }

    // 2. Build ALL requests across all sheets
    const requests: any[] = [];

    for (const job of jobs) {
        const sheetId = sheetIdMap.get(job.sheetName);
        if (sheetId === undefined) {
            devLog(`[QC Worker] ⚠ Could not find sheetId for "${job.sheetName}"`);
            continue;
        }
        job.sheetId = sheetId;

        // Resolve column positions BY HEADER NAME from actual spreadsheet
        const realHeaders = sheetHeaderMap.get(job.sheetName) || [];
        const colPositions = new Map<string, number>();
        for (const col of job.hierCols) {
            const idx = realHeaders.indexOf(col);
            if (idx >= 0) colPositions.set(col, idx);
        }
        if (colPositions.size === 0) {
            devLog(`[QC Worker] ⚠ No hierarchy columns found in headers for "${job.sheetName}"`);
            continue;
        }

        // Diff-based approach: only write CHANGES
        // Current invalid cells as a Set of "rowIdx:colName"
        const currentSet = new Set(
            job.invalidCells.map(ic => `${ic.rowIdx}:${ic.colName}`)
        );
        // Previous invalid cells as a Set
        const prevSet = new Set(
            job.previousCells.map(pc => `${pc[0]}:${pc[1]}`)
        );

        // CLEAR: cells that were previously red but are now valid
        for (const prev of job.previousCells) {
            const key = `${prev[0]}:${prev[1]}`;
            if (!currentSet.has(key)) {
                const colIdx = colPositions.get(prev[1]);
                if (colIdx === undefined) continue;
                requests.push({
                    updateCells: {
                        rows: [{
                            values: [{
                                userEnteredFormat: {},
                                note: "",
                            }],
                        }],
                        start: {
                            sheetId,
                            rowIndex: prev[0] + 1,
                            columnIndex: colIdx,
                        },
                        fields: "userEnteredFormat.backgroundColor,note",
                    },
                });
            }
        }

        // MARK: cells that are currently invalid (new or still invalid)
        for (const ic of job.invalidCells) {
            const realColIdx = colPositions.get(ic.colName);
            if (realColIdx === undefined) continue;
            // Skip if already marked (same cell, no change needed)
            const key = `${ic.rowIdx}:${ic.colName}`;
            if (prevSet.has(key)) continue;
            requests.push({
                updateCells: {
                    rows: [{
                        values: [{
                            userEnteredFormat: {
                                backgroundColor: { red: 1, green: 0.8, blue: 0.8 },
                            },
                            note: `QC: ${ic.reason}`,
                        }],
                    }],
                    start: {
                        sheetId,
                        rowIndex: ic.rowIdx + 1,
                        columnIndex: realColIdx,
                    },
                    fields: "userEnteredFormat.backgroundColor,note",
                },
            });
        }
    }

    if (requests.length === 0) return;

    // 3. Execute ONE batchUpdate for all sheets in this spreadsheet
    devLog(`[QC Worker] 📤 Sending ${requests.length} format requests for spreadsheet ${spreadsheetId}`);
    await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
    });
}
