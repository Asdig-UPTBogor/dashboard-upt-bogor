import { loadRegistry, normalizeColumn, SheetUsage } from "./data-source-registry";

export interface ResolvedDataSource {
    spreadsheetId: string;
    sheetName: string;
    mappedColumns: Record<string, string>;
}

/**
 * Resolves the actual Spreadsheet ID, Sheet Name, and Column Mapping
 * for a given API route (e.g. "/api/towers") by searching the
 * per-spreadsheet registry.
 *
 * No override layer — spreadsheet-config.json is the single source of truth.
 * Sheet names are always kept up-to-date directly in the config.
 */
export function resolveApiDataSource(apiRoute: string): ResolvedDataSource {
    const registry = loadRegistry();
    let targetSheet: SheetUsage | undefined;
    let targetSpreadsheetId = "";

    // Search through spreadsheet entries → sheets for matching route
    for (const entry of registry) {
        const sheet = entry.sheets.find(s => s.route === apiRoute);
        if (sheet) {
            targetSheet = sheet;
            targetSpreadsheetId = entry.spreadsheetId;
            break;
        }
    }

    if (!targetSheet) {
        throw new Error(`API route ${apiRoute} not found in registry`);
    }

    // Column names come directly from config — no override lookup needed
    const mappedColumns: Record<string, string> = {};
    for (const col of targetSheet.columnsUsed) {
        const normCol = normalizeColumn(col);
        mappedColumns[normCol.name] = normCol.name;
    }

    return {
        spreadsheetId: targetSpreadsheetId,
        sheetName: targetSheet.sheetName,
        mappedColumns
    };
}
