import { findPageConfigsByRoute } from "./data-source-registry";

export interface ResolvedDataSource {
    spreadsheetId: string;
    sheetName: string;
    mappedColumns: Record<string, string>;
}

/**
 * Resolves the actual Spreadsheet ID, Sheet Name, and Column Mapping
 * for a given API route (e.g. "/api/towers") by searching
 * page-configs/*.json (Data Connector SSOT).
 *
 * Registry (spreadsheet-config.json) is NOT used here — it's for health checks only.
 * All data fetching resolves from page-configs.
 */
export function resolveApiDataSource(apiRoute: string): ResolvedDataSource {
    const results = findPageConfigsByRoute(apiRoute);

    if (results.length === 0) {
        throw new Error(
            `[resolveApiDataSource] Route "${apiRoute}" not found in any page-config. ` +
            `Configure this route via Data Connector (Maintenance → Data Connector) first.`
        );
    }

    const { dataSource } = results[0];
    const mappedColumns: Record<string, string> = {};
    for (const col of dataSource.columnsUsed) {
        mappedColumns[col.name] = col.name;
    }

    return {
        spreadsheetId: dataSource.spreadsheetId,
        sheetName: dataSource.sheetName,
        mappedColumns,
    };
}
