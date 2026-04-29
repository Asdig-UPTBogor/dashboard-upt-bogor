/**
 * Shared helper functions — extracted dari berbagai API routes + FE pages
 * supaya testable. Pure functions, no I/O.
 */

/**
 * Convert 0-based column index → spreadsheet column letter (A-Z, AA-ZZ, AAA-ZZZ, ...).
 * Handles arbitrary depth (BQ/Sheets support up to 18,278 cols ≈ ZZZ).
 */
export function indexToColLetter(idx: number): string {
    if (idx < 0) throw new Error(`Invalid column index: ${idx}`);
    let n = idx;
    let letter = '';
    while (n >= 0) {
        letter = String.fromCharCode(65 + (n % 26)) + letter;
        n = Math.floor(n / 26) - 1;
    }
    return letter;
}

/** Inverse: column letter → 0-based index. */
export function colLetterToIndex(letter: string): number {
    if (!letter || !/^[A-Z]+$/.test(letter)) {
        throw new Error(`Invalid column letter: "${letter}"`);
    }
    let n = 0;
    for (let i = 0; i < letter.length; i++) {
        n = n * 26 + (letter.charCodeAt(i) - 64);
    }
    return n - 1;
}

/**
 * Convert page path → Firestore doc ID.
 * Handles trailing slash, query string, hash fragment.
 * Returns 'index' untuk empty path.
 */
export function pageToDocId(pagePath: string): string {
    const clean = ((pagePath ?? '').split('?')[0] ?? '').split('#')[0]?.trim() ?? '';
    return clean.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\//g, '-') || 'index';
}

/**
 * Derive hierarchy level dari kolom yang user pilih (G16 rule).
 * bay→BAY, gi→GI, ultg→ULTG, upt→UPT, none→FLAT.
 */
export interface LevelColumnsInput {
    giColumn?: string;
    bayColumn?: string;
    ultgColumn?: string;
    uptColumn?: string;
}

export type HierarchyLevel = 'BAY' | 'GI' | 'ULTG' | 'UPT' | 'FLAT';

export function deriveHierarchyLevel(c: LevelColumnsInput): HierarchyLevel {
    if (c.bayColumn) return 'BAY';
    if (c.giColumn) return 'GI';
    if (c.ultgColumn) return 'ULTG';
    if (c.uptColumn) return 'UPT';
    return 'FLAT';
}

/**
 * Categorize BQ dataset untuk UI grouping (DC V5 sidebar).
 * - engine: ss_platform (operational)
 * - user_data: Dashboard_, Master_, Mirroring_, Program_, MASTER_HIERARCHY_ prefix
 * - internal: _internal (ext_ pointer)
 * - platform: others (thor_vaisala, wagate, waha, notifier_logs)
 */
export type DatasetCategory = 'engine' | 'internal' | 'user_data' | 'platform';

export function categorizeDataset(datasetId: string): DatasetCategory {
    if (datasetId === 'ss_platform') return 'engine';
    if (datasetId === '_internal') return 'internal';
    if (datasetId.startsWith('Dashboard_') ||
        datasetId.startsWith('Master_') ||
        datasetId.startsWith('Mirroring_') ||
        datasetId.startsWith('Program_') ||
        datasetId.startsWith('MASTER_HIERARCHY_')) {
        return 'user_data';
    }
    return 'platform';
}

/**
 * Infer node type dari table name (DC V5 XYFlow source badges).
 * ext (ext_*), n_table (n_*), dim (dim_*), rejected (rejected_rows), view, raw.
 */
export type NodeType = 'ext' | 'n_table' | 'dim' | 'rejected' | 'view' | 'raw';

export function inferNodeType(
    datasetId: string,
    tableId: string,
    isView: boolean
): NodeType {
    if (isView) return 'view';
    if (datasetId === '_internal' && tableId.startsWith('ext_')) return 'ext';
    if (datasetId === 'ss_platform' && tableId.startsWith('dim_')) return 'dim';
    if (datasetId === 'ss_platform' && tableId === 'rejected_rows') return 'rejected';
    if (tableId.startsWith('n_')) return 'n_table';
    return 'raw';
}
