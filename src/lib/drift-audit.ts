/**
 * Drift Audit — Logika inti perbandingan header aktual vs config
 *
 * File ini TIDAK mengakses Google Sheets API secara langsung.
 * Menerima data header yang sudah di-fetch, lalu membandingkan
 * dengan config yang tersimpan.
 *
 * Digunakan oleh:
 *   - Worker: jalankan audit setelah fetch data
 *   - DC: pre-canvas validation (client-side)
 *
 * Prinsip:
 *   - column.name = sumber kebenaran
 *   - pos hanya display, auto-update kalau bergeser
 *   - Tidak pernah auto-delete/break, hanya flag
 */

import type {
    DriftReport,
    SpreadsheetDrift,
    SheetDrift,
    ColumnDrift,
    ColumnDriftStatus,
    SheetDriftStatus,
    DriftIssue,
} from "./drift-types";

/* ── Utilitas ── */

/** Normalisasi string: uppercase + trim + collapse whitespace */
export function norm(s: string): string {
    return s.toUpperCase().replace(/\s+/g, " ").trim();
}

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
}

/** Fuzzy match: cari kandidat terdekat berdasarkan Levenshtein */
export function fuzzyMatch(target: string, candidates: string[]): { name: string; score: number }[] {
    const t = target.toUpperCase();
    return candidates
        .map((c) => {
            const cu = c.toUpperCase();
            const dist = levenshtein(t, cu);
            const maxLen = Math.max(t.length, cu.length);
            const score = maxLen > 0 ? Math.round((1 - dist / maxLen) * 100) : 0;
            return { name: c, score };
        })
        .filter((m) => m.score > 50)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

/** Convert 0-based column index ke letter (0=A, 25=Z, 26=AA) */
export function colIndexToLetter(idx: number): string {
    if (idx < 26) return String.fromCharCode(65 + idx);
    return String.fromCharCode(65 + Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
}

/* ── Input types untuk audit ── */

/** Header aktual dari Google Sheets (sudah di-fetch oleh caller) */
export interface ActualSheetData {
    sheetName: string;
    headers: string[];
    rowCount: number;
}

/** Info spreadsheet aktual */
export interface ActualSpreadsheetData {
    spreadsheetId: string;
    title: string;
    accessible: boolean;
    error?: string;
    responseTime: number;
    sheets: ActualSheetData[];
}

/** Config kolom dari registry/page-config */
export interface ConfiguredColumn {
    name: string;
    pos: string;
}

/** Config sheet dari registry */
export interface ConfiguredSheet {
    sheetName: string;
    columnsUsed: ConfiguredColumn[];
    usedBy: string[];
}

/** Config spreadsheet dari registry */
export interface ConfiguredSpreadsheet {
    spreadsheetId: string;
    title: string;
    sheets: ConfiguredSheet[];
}

/* ── Audit Functions ── */

/**
 * Audit satu kolom: bandingkan config vs header aktual.
 * Mengembalikan status dan posisi aktual (jika ditemukan).
 */
export function auditColumn(
    configCol: ConfiguredColumn,
    actualHeaders: string[],
): ColumnDrift {
    // Skip wildcard
    if (configCol.name === "(semua kolom)") {
        return { name: configCol.name, configPos: configCol.pos || "*", status: "ok" };
    }

    // Cari by NAMA (case-insensitive, trimmed)
    const normalizedName = norm(configCol.name);
    const foundIdx = actualHeaders.findIndex(h => norm(h) === normalizedName);

    if (foundIdx >= 0) {
        const actualPos = colIndexToLetter(foundIdx);
        const status: ColumnDriftStatus = (actualPos === configCol.pos) ? "ok" : "moved";
        return { name: configCol.name, configPos: configCol.pos, status, actualPos };
    }

    // Tidak ditemukan — coba fuzzy match
    const matches = fuzzyMatch(configCol.name, actualHeaders);
    if (matches.length > 0 && matches[0].score > 70) {
        return {
            name: configCol.name,
            configPos: configCol.pos,
            status: "renamed",
            suggestedName: matches[0].name,
            matchScore: matches[0].score,
        };
    }

    return { name: configCol.name, configPos: configCol.pos, status: "missing" };
}

/**
 * Audit satu sheet: cek apakah sheet ada, lalu audit semua kolomnya.
 */
export function auditSheet(
    configSheet: ConfiguredSheet,
    actualSheets: ActualSheetData[],
): SheetDrift {
    // Cari sheet by exact name
    let actual = actualSheets.find(s => s.sheetName === configSheet.sheetName);

    // Fallback: case-insensitive
    if (!actual) {
        actual = actualSheets.find(s => norm(s.sheetName) === norm(configSheet.sheetName));
    }

    // Sheet tidak ditemukan
    if (!actual) {
        const sheetNames = actualSheets.map(s => s.sheetName);
        const matches = fuzzyMatch(configSheet.sheetName, sheetNames);
        const suggested = matches.length > 0 && matches[0].score > 60
            ? matches[0].name : undefined;

        return {
            sheetName: configSheet.sheetName,
            status: "missing" as SheetDriftStatus,
            suggestedName: suggested,
            columns: [],
            summary: { total: configSheet.columnsUsed.length, ok: 0, moved: 0, missing: configSheet.columnsUsed.length, renamed: 0 },
        };
    }

    // Sheet ditemukan — audit kolom-kolomnya
    const columns = configSheet.columnsUsed.map(col => auditColumn(col, actual!.headers));

    const summary = {
        total: columns.length,
        ok: columns.filter(c => c.status === "ok").length,
        moved: columns.filter(c => c.status === "moved").length,
        missing: columns.filter(c => c.status === "missing").length,
        renamed: columns.filter(c => c.status === "renamed").length,
    };

    // Tentukan status sheet
    let sheetStatus: SheetDriftStatus = "ok";
    if (norm(actual.sheetName) !== norm(configSheet.sheetName)) {
        sheetStatus = "renamed";
    }

    return {
        sheetName: configSheet.sheetName,
        status: sheetStatus,
        rowCount: actual.rowCount,
        columns,
        summary,
    };
}

/**
 * Audit satu spreadsheet: cek aksesibilitas, lalu audit semua sheet-nya.
 */
export function auditSpreadsheet(
    config: ConfiguredSpreadsheet,
    actual: ActualSpreadsheetData,
): SpreadsheetDrift {
    if (!actual.accessible) {
        return {
            spreadsheetId: config.spreadsheetId,
            title: config.title,
            accessible: false,
            error: actual.error,
            responseTime: actual.responseTime,
            hasPages: config.sheets.some(s => s.usedBy.length > 0),
            sheets: [],
        };
    }

    const sheets = config.sheets.map(cfgSheet =>
        auditSheet(cfgSheet, actual.sheets)
    );

    return {
        spreadsheetId: config.spreadsheetId,
        title: actual.title || config.title,
        accessible: true,
        responseTime: actual.responseTime,
        hasPages: config.sheets.some(s => s.usedBy.length > 0),
        sheets,
    };
}

/**
 * Buat DriftReport lengkap dari semua spreadsheet.
 * Ini adalah fungsi utama yang dipanggil oleh worker.
 */
export function buildDriftReport(
    configs: ConfiguredSpreadsheet[],
    actuals: ActualSpreadsheetData[],
): DriftReport {
    const actualMap = new Map(actuals.map(a => [a.spreadsheetId, a]));
    const issues: DriftIssue[] = [];

    const spreadsheets = configs.map(cfg => {
        const actual = actualMap.get(cfg.spreadsheetId);

        // Spreadsheet belum di-fetch (seharusnya tidak terjadi)
        if (!actual) {
            issues.push({
                severity: "error",
                spreadsheetTitle: cfg.title,
                sheetName: "",
                message: `Spreadsheet "${cfg.title}" tidak ditemukan di hasil fetch`,
            });
            return {
                spreadsheetId: cfg.spreadsheetId,
                title: cfg.title,
                accessible: false,
                error: "Tidak ada data dari worker",
                responseTime: 0,
                hasPages: cfg.sheets.some(s => s.usedBy.length > 0),
                sheets: [],
            } satisfies SpreadsheetDrift;
        }

        const result = auditSpreadsheet(cfg, actual);

        // Kumpulkan issues
        if (!result.accessible) {
            issues.push({
                severity: "error",
                spreadsheetTitle: result.title,
                sheetName: "",
                message: `API tidak bisa diakses: ${result.error}`,
            });
        }

        for (const sheet of result.sheets) {
            if (sheet.status === "missing") {
                issues.push({
                    severity: "error",
                    spreadsheetTitle: result.title,
                    sheetName: sheet.sheetName,
                    message: sheet.suggestedName
                        ? `Sheet hilang, mungkin diganti jadi "${sheet.suggestedName}"`
                        : `Sheet hilang dari spreadsheet`,
                });
            }

            for (const col of sheet.columns) {
                if (col.status === "missing") {
                    issues.push({
                        severity: "warning",
                        spreadsheetTitle: result.title,
                        sheetName: sheet.sheetName,
                        columnName: col.name,
                        message: col.suggestedName
                            ? `Kolom hilang, mungkin diganti jadi "${col.suggestedName}"`
                            : `Kolom tidak ditemukan di header`,
                    });
                } else if (col.status === "moved") {
                    issues.push({
                        severity: "info",
                        spreadsheetTitle: result.title,
                        sheetName: sheet.sheetName,
                        columnName: col.name,
                        message: `Pindah dari pos ${col.configPos} → ${col.actualPos}`,
                    });
                }
            }
        }

        // Cek apakah spreadsheet tidak dipakai oleh page manapun
        if (!result.hasPages) {
            issues.push({
                severity: "warning",
                spreadsheetTitle: result.title,
                sheetName: "",
                message: "Spreadsheet tidak dipakai oleh halaman manapun",
            });
        }

        return result;
    });

    // Hitung total
    let totalSheets = 0, totalColumns = 0;
    for (const ss of spreadsheets) {
        totalSheets += ss.sheets.length;
        for (const sh of ss.sheets) {
            totalColumns += sh.columns.length;
        }
    }

    const issueCount = issues.filter(i => i.severity !== "info").length;
    const overallHealth = totalColumns > 0
        ? Math.round(
            spreadsheets.reduce((sum, ss) =>
                sum + ss.sheets.reduce((sSum, sh) =>
                    sSum + sh.summary.ok + sh.summary.moved, 0
                ), 0
            ) / totalColumns * 100
        )
        : 100;

    return {
        timestamp: new Date().toISOString(),
        version: 1,
        overallHealth,
        spreadsheets,
        summary: {
            totalSpreadsheets: spreadsheets.length,
            totalSheets,
            totalColumns,
            issueCount,
            issues,
        },
    };
}

/**
 * Kumpulkan kolom-kolom yang posisinya bergeser (moved) untuk auto-fix.
 * Mengembalikan daftar { spreadsheetId, sheetName, columnName, oldPos, newPos }
 */
export function getMovedColumns(report: DriftReport): {
    spreadsheetId: string;
    sheetName: string;
    columnName: string;
    oldPos: string;
    newPos: string;
}[] {
    const result: ReturnType<typeof getMovedColumns> = [];
    for (const ss of report.spreadsheets) {
        for (const sh of ss.sheets) {
            for (const col of sh.columns) {
                if (col.status === "moved" && col.actualPos) {
                    result.push({
                        spreadsheetId: ss.spreadsheetId,
                        sheetName: sh.sheetName,
                        columnName: col.name,
                        oldPos: col.configPos,
                        newPos: col.actualPos,
                    });
                }
            }
        }
    }
    return result;
}
