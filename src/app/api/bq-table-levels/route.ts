/**
 * Data Level Config — Backend (SS V5)
 *
 * Per-tabel user hierarchy config. User pilih level (UPT/ULTG/GI/BAY/FLAT) +
 * kolom mana di tabel yang berisi nama hirarki. Config disimpan di Firestore
 * collection `bq_table_levels`.
 *
 * Flow:
 *   1. GET       → list semua tabel user (n_*) + config level-nya
 *   2. dry-run   → test LEFT JOIN ke dim_* tanpa commit, return counts + sample rejected
 *   3. save      → validate + write Firestore (ga trigger re-sync di sini)
 *   4. highlight-preview → call CF ss-sync action=highlight mode=preview
 *
 * Ref: Spreadsheet Sync/docs/SS_V5_SYSTEM.md (Data Level Config section)
 */
import { NextResponse } from 'next/server';
import { getFirestore, getBigQuery } from '@/lib/ss-v5/firestore-singleton';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';
import { categorizeDataset } from '@/lib/ss-v5/helpers';
import type { SheetConfigV2 } from '@/lib/ss-v5/data-source-schema';

const fs = getFirestore();
const bq = getBigQuery();

const LEVELS_COLLECTION = 'bq_table_levels';
const DATA_SOURCES_V2 = 'data_sources_v2';
const SS_SYNC_CF_URL = process.env.SS_SYNC_CF_URL || 'https://ss-sync-xelpk4dj7q-et.a.run.app';

/** Safety cap untuk berapa banyak rejected rows yang di-paint dalam satu preview call. */
const PREVIEW_SAMPLE_LIMIT = 500;

/* ─────────── Types ─────────── */

type HierarchyLevel = 'UPT' | 'ULTG' | 'GI' | 'BAY' | 'FLAT';

interface LevelColumns {
    upt?: string;
    ultg?: string;
    gi?: string;
    bay?: string;
}

interface RejectReasons {
    ORPHAN_UPT?: number;
    ORPHAN_ULTG?: number;
    ORPHAN_GI?: number;
    ORPHAN_BAY?: number;
    MISSING_UPT?: number;
    MISSING_ULTG?: number;
    MISSING_GI?: number;
    MISSING_BAY?: number;
    MISMATCH_ULTG?: number;
    [k: string]: number | undefined;
}

interface DryRunSampleRow {
    row_number: number;
    reason: string;
    reason_message: string;
    cell_value: string | null;
}

interface DryRunResult {
    rowsTotal: number;
    rowsEnriched: number;
    rowsRejected: number;
    rejectReasons: RejectReasons;
    sample: DryRunSampleRow[];
    runAt: string;
}

interface TableLevelConfig {
    dataset: string;
    table: string;
    level: HierarchyLevel;
    source: 'bigquery';
    columns: LevelColumns;
    lastDryRun?: DryRunResult;
    configuredAt: string;
    configuredBy?: string;
}

interface TableEntry {
    dataset: string;
    table: string;
    level: HierarchyLevel;
    configured: boolean;
    columns?: LevelColumns;
    lastDryRun?: {
        rowsTotal: number;
        rowsEnriched: number;
        rowsRejected: number;
        rejectReasons: RejectReasons;
        runAt: string;
    };
}

type ValidationError = { code: string; message: string; field?: string };

/* ─────────── Validation ─────────── */

const VALID_LEVELS: HierarchyLevel[] = ['UPT', 'ULTG', 'GI', 'BAY', 'FLAT'];

function validateLevelPayload(body: {
    dataset?: unknown;
    table?: unknown;
    level?: unknown;
    columns?: unknown;
}): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!body.dataset || typeof body.dataset !== 'string') {
        errors.push({ code: 'MISSING_DATASET', message: 'dataset wajib (string)', field: 'dataset' });
    }
    if (!body.table || typeof body.table !== 'string') {
        errors.push({ code: 'MISSING_TABLE', message: 'table wajib (string)', field: 'table' });
    }
    if (!body.level || typeof body.level !== 'string' || !VALID_LEVELS.includes(body.level as HierarchyLevel)) {
        errors.push({
            code: 'INVALID_LEVEL',
            message: `level harus salah satu: ${VALID_LEVELS.join(', ')} (got: ${String(body.level)})`,
            field: 'level',
        });
    }
    if (body.columns !== undefined && (typeof body.columns !== 'object' || body.columns === null || Array.isArray(body.columns))) {
        errors.push({ code: 'INVALID_COLUMNS', message: 'columns harus object', field: 'columns' });
    }

    // Level-specific column requirement (skip kalau level invalid — udah error di atas)
    if (errors.length === 0 && body.level !== 'FLAT') {
        const cols = (body.columns ?? {}) as LevelColumns;
        const level = body.level as HierarchyLevel;
        const required: Array<keyof LevelColumns> = [];
        if (level === 'UPT') required.push('upt');
        if (level === 'ULTG') required.push('upt', 'ultg');
        if (level === 'GI') required.push('gi');
        if (level === 'BAY') required.push('gi', 'bay');
        for (const r of required) {
            const v = cols[r];
            if (!v || typeof v !== 'string' || !v.trim()) {
                errors.push({
                    code: 'MISSING_COLUMNS',
                    message: `level ${level} butuh columns.${r} (nama kolom di tabel user)`,
                    field: `columns.${r}`,
                });
            }
        }
    }
    return errors;
}

/* ─────────── BQ identifier safety ─────────── */

/**
 * Validate identifier — allow alphanumeric + underscore + hyphen (dataset names
 * pakai hyphen sesekali). Project-level names (dataset/table/column) harus
 * match BQ identifier rules. Fail loud kalau tidak valid.
 */
function assertSafeIdent(kind: string, name: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_\-]*$/.test(name)) {
        throw Object.assign(new Error(`INVALID_${kind.toUpperCase()}_IDENT: "${name}"`), {
            code: `INVALID_${kind.toUpperCase()}_IDENT`,
        });
    }
}

function q(name: string): string {
    return '`' + name + '`';
}

/* ─────────── GET — list tables + configs ─────────── */

/**
 * Source: Firestore `data_sources_v2/*` (V2 collection — V1 deprecated).
 * Pattern: enumerate sheets[sheetTabId].bqTable per data_source_v2 doc → join dengan
 * bq_table_levels configs.
 *
 * Kalau ada tabel BQ manual (ga via Wizard V2) yg ga ke-track di Firestore,
 * dia ga muncul di sini — by design (FS = registered tables only).
 */
async function listUserTables(): Promise<TableEntry[]> {
    // Parallel: load data_sources_v2 + bq_table_levels
    const [dsSnap, configSnap] = await Promise.all([
        fs.collection(DATA_SOURCES_V2).get(),
        fs.collection(LEVELS_COLLECTION).get(),
    ]);

    // Build configs map
    const configMap = new Map<string, TableLevelConfig>();
    configSnap.forEach((doc) => {
        const data = doc.data() as TableLevelConfig;
        if (data && data.dataset && data.table) {
            configMap.set(`${data.dataset}__${data.table}`, data);
        }
    });

    // Enumerate registered tables dari data_sources_v2.sheets[*].bqTable
    const entries: TableEntry[] = [];
    for (const doc of dsSnap.docs) {
        const datasetId = doc.id;
        if (!categorizeDataset(datasetId)) continue;

        const data = doc.data() as { sheets?: Record<string, SheetConfigV2> };
        const sheets = data?.sheets;
        if (!sheets || typeof sheets !== 'object') continue;

        for (const cfg of Object.values(sheets)) {
            const tableId = cfg?.bqTable;
            if (!tableId) continue;

            const lvlCfg = configMap.get(`${datasetId}__${tableId}`);
            if (lvlCfg) {
                entries.push({
                    dataset: datasetId,
                    table: tableId,
                    level: lvlCfg.level,
                    configured: true,
                    columns: lvlCfg.columns,
                    lastDryRun: lvlCfg.lastDryRun
                        ? {
                              rowsTotal: lvlCfg.lastDryRun.rowsTotal,
                              rowsEnriched: lvlCfg.lastDryRun.rowsEnriched,
                              rowsRejected: lvlCfg.lastDryRun.rowsRejected,
                              rejectReasons: lvlCfg.lastDryRun.rejectReasons,
                              runAt: lvlCfg.lastDryRun.runAt,
                          }
                        : undefined,
                });
            } else {
                entries.push({
                    dataset: datasetId,
                    table: tableId,
                    level: 'FLAT',
                    configured: false,
                });
            }
        }
    }

    return entries.sort(
        (a, b) => a.dataset.localeCompare(b.dataset) || a.table.localeCompare(b.table)
    );
}

/* ─────────── Dry-run ─────────── */

/**
 * Build dry-run SQL per level. Returns SQL string + param untuk BQ.
 * Level FLAT ga perlu SQL — handle di caller dengan trivial result.
 *
 * Query pattern: LEFT JOIN dim_* dari tabel user, count total/enriched/orphan.
 */
function buildDryRunSQL(
    dataset: string,
    table: string,
    level: Exclude<HierarchyLevel, 'FLAT'>,
    cols: LevelColumns,
    sampleLimit: number = 5
): { countSQL: string; sampleSQL: string } {
    assertSafeIdent('dataset', dataset);
    assertSafeIdent('table', table);

    const tblFqn = `\`${PROJECT}.${dataset}.${table}\``;
    const dimFqn = (name: string) => `\`${PROJECT}.${SS_PLATFORM}.${name}\``;

    // Column idents (validate all used ones)
    const uptCol = cols.upt ? (assertSafeIdent('column', cols.upt), q(cols.upt)) : null;
    const ultgCol = cols.ultg ? (assertSafeIdent('column', cols.ultg), q(cols.ultg)) : null;
    const giCol = cols.gi ? (assertSafeIdent('column', cols.gi), q(cols.gi)) : null;
    const bayCol = cols.bay ? (assertSafeIdent('column', cols.bay), q(cols.bay)) : null;

    // Build JOIN chain + reason classifier based on level.
    // Reason codes mirror sql-generator.ts convention (MISSING_* = empty cell, ORPHAN_* = not found in dim).
    let joins = '';
    let reasonCase = '';
    let enrichedCond = '';

    if (level === 'UPT') {
        if (!uptCol) throw Object.assign(new Error('MISSING_COLUMNS: upt'), { code: 'MISSING_COLUMNS' });
        joins = `LEFT JOIN ${dimFqn('dim_upt')} upt
  ON UPPER(upt.upt_name) = UPPER(TRIM(ext.${uptCol})) AND upt.is_active = TRUE`;
        reasonCase = `CASE
    WHEN ext.${uptCol} IS NULL OR TRIM(ext.${uptCol}) = '' THEN 'MISSING_UPT'
    WHEN upt.upt_id IS NULL THEN 'ORPHAN_UPT'
    ELSE NULL
  END`;
        enrichedCond = `upt.upt_id IS NOT NULL`;
    } else if (level === 'ULTG') {
        if (!uptCol || !ultgCol) {
            throw Object.assign(new Error('MISSING_COLUMNS: upt/ultg'), { code: 'MISSING_COLUMNS' });
        }
        joins = `LEFT JOIN ${dimFqn('dim_upt')} upt
  ON UPPER(upt.upt_name) = UPPER(TRIM(ext.${uptCol})) AND upt.is_active = TRUE
LEFT JOIN ${dimFqn('dim_ultg')} ultg
  ON UPPER(ultg.ultg_name) = UPPER(TRIM(ext.${ultgCol})) AND ultg.is_active = TRUE AND ultg.upt_id = upt.upt_id`;
        reasonCase = `CASE
    WHEN ext.${uptCol} IS NULL OR TRIM(ext.${uptCol}) = '' THEN 'MISSING_UPT'
    WHEN upt.upt_id IS NULL THEN 'ORPHAN_UPT'
    WHEN ext.${ultgCol} IS NULL OR TRIM(ext.${ultgCol}) = '' THEN 'MISSING_ULTG'
    WHEN ultg.ultg_id IS NULL THEN 'ORPHAN_ULTG'
    ELSE NULL
  END`;
        enrichedCond = `upt.upt_id IS NOT NULL AND ultg.ultg_id IS NOT NULL`;
    } else if (level === 'GI') {
        if (!giCol) throw Object.assign(new Error('MISSING_COLUMNS: gi'), { code: 'MISSING_COLUMNS' });
        joins = `LEFT JOIN ${dimFqn('dim_gi')} gi
  ON UPPER(gi.gi_name) = UPPER(TRIM(ext.${giCol})) AND gi.is_active = TRUE`;
        reasonCase = `CASE
    WHEN ext.${giCol} IS NULL OR TRIM(ext.${giCol}) = '' THEN 'MISSING_GI'
    WHEN gi.gi_id IS NULL THEN 'ORPHAN_GI'
    ELSE NULL
  END`;
        enrichedCond = `gi.gi_id IS NOT NULL`;
    } else {
        // BAY
        if (!giCol || !bayCol) {
            throw Object.assign(new Error('MISSING_COLUMNS: gi/bay'), { code: 'MISSING_COLUMNS' });
        }
        joins = `LEFT JOIN ${dimFqn('dim_gi')} gi
  ON UPPER(gi.gi_name) = UPPER(TRIM(ext.${giCol})) AND gi.is_active = TRUE
LEFT JOIN ${dimFqn('dim_bay')} bay
  ON UPPER(bay.bay_name) = UPPER(TRIM(ext.${bayCol})) AND bay.is_active = TRUE AND bay.gi_id = gi.gi_id`;
        reasonCase = `CASE
    WHEN ext.${giCol} IS NULL OR TRIM(ext.${giCol}) = '' THEN 'MISSING_GI'
    WHEN gi.gi_id IS NULL THEN 'ORPHAN_GI'
    WHEN ext.${bayCol} IS NULL OR TRIM(ext.${bayCol}) = '' THEN 'MISSING_BAY'
    WHEN bay.bay_id IS NULL THEN 'ORPHAN_BAY'
    ELSE NULL
  END`;
        enrichedCond = `gi.gi_id IS NOT NULL AND bay.bay_id IS NOT NULL`;
    }

    const countSQL = `
WITH classified AS (
  SELECT
    ROW_NUMBER() OVER () AS row_number,
    ${reasonCase} AS reason,
    CASE WHEN ${enrichedCond} THEN 1 ELSE 0 END AS is_enriched
  FROM ${tblFqn} ext
  ${joins}
)
SELECT
  COUNT(*) AS rows_total,
  SUM(is_enriched) AS rows_enriched,
  SUM(CASE WHEN reason IS NOT NULL THEN 1 ELSE 0 END) AS rows_rejected,
  reason
FROM classified
GROUP BY reason
`.trim();

    const sampleSQL = `
WITH classified AS (
  SELECT
    ROW_NUMBER() OVER () AS row_number,
    ${reasonCase} AS reason,
    ${uptCol ? `ext.${uptCol} AS upt_val,` : `CAST(NULL AS STRING) AS upt_val,`}
    ${ultgCol ? `ext.${ultgCol} AS ultg_val,` : `CAST(NULL AS STRING) AS ultg_val,`}
    ${giCol ? `ext.${giCol} AS gi_val,` : `CAST(NULL AS STRING) AS gi_val,`}
    ${bayCol ? `ext.${bayCol} AS bay_val` : `CAST(NULL AS STRING) AS bay_val`}
  FROM ${tblFqn} ext
  ${joins}
)
SELECT row_number, reason, upt_val, ultg_val, gi_val, bay_val
FROM classified
WHERE reason IS NOT NULL
ORDER BY row_number
LIMIT ${Math.max(1, Math.floor(sampleLimit))}
`.trim();

    return { countSQL, sampleSQL };
}

async function performDryRun(
    dataset: string,
    table: string,
    level: HierarchyLevel,
    columns: LevelColumns
): Promise<DryRunResult> {
    const runAt = new Date().toISOString();

    if (level === 'FLAT') {
        // FLAT = no enrichment, skip query. Return trivial result dengan total row dari table.
        assertSafeIdent('dataset', dataset);
        assertSafeIdent('table', table);
        const tblFqn = `\`${PROJECT}.${dataset}.${table}\``;
        try {
            const [rows] = await bq.query({ query: `SELECT COUNT(*) AS total FROM ${tblFqn}` });
            const total = Number((rows?.[0] as { total?: number | string })?.total ?? 0);
            return {
                rowsTotal: total,
                rowsEnriched: total,
                rowsRejected: 0,
                rejectReasons: {},
                sample: [],
                runAt,
            };
        } catch (e) {
            const err = e as { code?: string | number; message?: string };
            if (String(err.message || '').toLowerCase().includes('not found')) {
                throw Object.assign(new Error(`BQ_TABLE_NOT_FOUND: ${dataset}.${table}`), {
                    code: 'BQ_TABLE_NOT_FOUND',
                });
            }
            throw e;
        }
    }

    const { countSQL, sampleSQL } = buildDryRunSQL(dataset, table, level, columns);

    let countRows: Array<Record<string, unknown>>;
    let sampleRows: Array<Record<string, unknown>>;
    try {
        [[countRows], [sampleRows]] = await Promise.all([
            bq.query({ query: countSQL }),
            bq.query({ query: sampleSQL }),
        ]);
    } catch (e) {
        const err = e as { code?: string | number; message?: string };
        if (String(err.message || '').toLowerCase().includes('not found')) {
            throw Object.assign(new Error(`BQ_TABLE_NOT_FOUND: ${dataset}.${table} (or related dim_*)`), {
                code: 'BQ_TABLE_NOT_FOUND',
            });
        }
        throw e;
    }

    // Aggregate count rows — grouped by reason, perlu di-flatten
    let rowsTotal = 0;
    let rowsEnriched = 0;
    let rowsRejected = 0;
    const rejectReasons: RejectReasons = {};

    for (const r of countRows) {
        const total = Number(r.rows_total ?? 0);
        const enriched = Number(r.rows_enriched ?? 0);
        const rejected = Number(r.rows_rejected ?? 0);
        const reason = r.reason as string | null;

        rowsTotal += total;
        rowsEnriched += enriched;
        rowsRejected += rejected;

        if (reason) {
            rejectReasons[reason] = (rejectReasons[reason] ?? 0) + rejected;
        }
    }

    const sample: DryRunSampleRow[] = sampleRows.map((r) => {
        const reason = String(r.reason ?? 'UNKNOWN');
        const cellValue =
            reason === 'MISSING_UPT' || reason === 'ORPHAN_UPT' ? (r.upt_val as string | null)
            : reason === 'MISSING_ULTG' || reason === 'ORPHAN_ULTG' ? (r.ultg_val as string | null)
            : reason === 'MISSING_GI' || reason === 'ORPHAN_GI' ? (r.gi_val as string | null)
            : reason === 'MISSING_BAY' || reason === 'ORPHAN_BAY' ? (r.bay_val as string | null)
            : null;
        return {
            row_number: Number(r.row_number ?? 0),
            reason,
            reason_message: buildReasonMessage(reason, cellValue),
            cell_value: cellValue,
        };
    });

    return { rowsTotal, rowsEnriched, rowsRejected, rejectReasons, sample, runAt };
}

function buildReasonMessage(reason: string, cellValue: string | null): string {
    const val = cellValue ?? '';
    switch (reason) {
        case 'MISSING_UPT':
            return 'Kolom UPT kosong';
        case 'ORPHAN_UPT':
            return `UPT "${val}" tidak ditemukan di dim_upt`;
        case 'MISSING_ULTG':
            return 'Kolom ULTG kosong';
        case 'ORPHAN_ULTG':
            return `ULTG "${val}" tidak ditemukan di dim_ultg (atau tidak cocok UPT)`;
        case 'MISSING_GI':
            return 'Kolom GI kosong';
        case 'ORPHAN_GI':
            return `GI "${val}" tidak ditemukan di dim_gi`;
        case 'MISSING_BAY':
            return 'Kolom Bay kosong';
        case 'ORPHAN_BAY':
            return `Bay "${val}" tidak ditemukan di dim_bay untuk GI ini`;
        default:
            return reason;
    }
}

/* ─────────── Save config ─────────── */

async function saveConfig(
    input: { dataset: string; table: string; level: HierarchyLevel; columns: LevelColumns; dryRunResult?: DryRunResult },
    configuredBy?: string
): Promise<void> {
    const docId = `${input.dataset}__${input.table}`;
    const doc: TableLevelConfig = {
        dataset: input.dataset,
        table: input.table,
        level: input.level,
        source: 'bigquery',
        columns: input.columns ?? {},
        configuredAt: new Date().toISOString(),
        ...(configuredBy ? { configuredBy } : {}),
        ...(input.dryRunResult ? { lastDryRun: input.dryRunResult } : {}),
    };
    await fs.collection(LEVELS_COLLECTION).doc(docId).set(doc, { merge: true });

    // Backref: set data_sources_v2/{dataset}.sheets[sheetTabId].levelRef = docId
    // Pointer dipakai sync engine buat auto-apply enrichment saat cycle berikutnya.
    await updateLevelRefBackref(input.dataset, input.table, docId);
}

/**
 * Update `data_sources_v2/{dataset}.sheets[sheetTabId].levelRef` ke docId.
 * Best-effort — kalau tabel ga ke-track di FS V2 (manual table), skip silent.
 */
async function updateLevelRefBackref(
    dataset: string,
    table: string,
    levelRefDocId: string
): Promise<void> {
    try {
        const ref = fs.collection(DATA_SOURCES_V2).doc(dataset);
        const snap = await ref.get();
        if (!snap.exists) return;
        const data = snap.data() as { sheets?: Record<string, SheetConfigV2> };
        const sheets = data?.sheets;
        if (!sheets) return;
        for (const [sheetTabId, cfg] of Object.entries(sheets)) {
            if (cfg?.bqTable === table) {
                await ref.update({
                    [`sheets.${sheetTabId}.levelRef`]: levelRefDocId,
                    'audit.updatedAt': new Date().toISOString(),
                    'audit.updatedBy': 'data-level-config',
                });
                return;
            }
        }
    } catch (e) {
        console.warn('[bq-table-levels] backref update skipped:', e);
    }
}

/* ─────────── Highlight preview (CF trigger) ─────────── */

/** Explicit cell contract expected by CF `ss-sync` action=highlight mode=preview. */
interface HighlightCell {
    spreadsheet_id: string;
    source_sheet: string;
    row_number: number;
    reason_code: string;
    reason_message: string;
}

/**
 * Lookup `data_sources_v2` di Firestore untuk mencari spreadsheet + sheet tab
 * yang punya `bqTable === input.table`. Throw TABLE_NOT_REGISTERED kalau
 * tabel BQ belum ter-register via Wizard V2 — artinya tidak ada Sheet sumber
 * untuk di-paint.
 *
 * Shape Firestore: data_sources_v2/{id} = {
 *   identity: { driveId },
 *   sheets: { [sheetTabId]: { bqTable, tabName, ... } }
 * }
 */
async function lookupSpreadsheetForTable(
    table: string
): Promise<{ spreadsheetId: string; sheetName: string }> {
    const snap = await fs.collection(DATA_SOURCES_V2).get();
    for (const doc of snap.docs) {
        const data = doc.data() as {
            identity?: { driveId?: string };
            sheets?: Record<string, SheetConfigV2>;
        };
        const spreadsheetId = data?.identity?.driveId;
        const sheets = data?.sheets;
        if (!spreadsheetId || !sheets || typeof sheets !== 'object') continue;
        for (const cfg of Object.values(sheets)) {
            if (cfg && cfg.bqTable === table && cfg.tabName) {
                return { spreadsheetId, sheetName: cfg.tabName };
            }
        }
    }
    throw Object.assign(
        new Error(`TABLE_NOT_REGISTERED: ${table} tidak ditemukan di data_sources_v2 (belum di-register via Wizard V2)`),
        { code: 'TABLE_NOT_REGISTERED' }
    );
}

/**
 * Build cells array untuk painting dari query rejected rows.
 *
 * Note row_number: SQL pakai `ROW_NUMBER() OVER ()` atas hasil LEFT JOIN —
 * urutannya BISA non-deterministic + tidak match row fisik Google Sheet (karena
 * External Table tidak guarantee preserve sheet row order, dan row 1 sheet =
 * header sementara row_number kita 1-indexed over data rows). Jadi painting
 * ini approximate — user tetap dapet signal "cek kolom X, ada issue" tapi
 * row spesifik yang di-highlight mungkin geser ±beberapa. Untuk akurasi
 * exact row, perlu stamping `_sheet_row` di ext_* (belum implemented).
 */
async function buildPreviewCells(input: {
    dataset: string;
    table: string;
    level: HierarchyLevel;
    columns: LevelColumns;
    spreadsheetId: string;
    sheetName: string;
}): Promise<HighlightCell[]> {
    // FLAT = no enrichment, no rejected rows, nothing to paint.
    if (input.level === 'FLAT') return [];

    const { sampleSQL } = buildDryRunSQL(
        input.dataset,
        input.table,
        input.level as Exclude<HierarchyLevel, 'FLAT'>,
        input.columns,
        PREVIEW_SAMPLE_LIMIT
    );

    let rows: Array<Record<string, unknown>>;
    try {
        const [result] = await bq.query({ query: sampleSQL });
        rows = result;
    } catch (e) {
        const err = e as { code?: string | number; message?: string };
        if (String(err.message || '').toLowerCase().includes('not found')) {
            throw Object.assign(new Error(`BQ_TABLE_NOT_FOUND: ${input.dataset}.${input.table} (or related dim_*)`), {
                code: 'BQ_TABLE_NOT_FOUND',
            });
        }
        throw e;
    }

    const cells: HighlightCell[] = rows.map((r) => {
        const reason = String(r.reason ?? 'UNKNOWN');
        const cellValue =
            reason === 'MISSING_UPT' || reason === 'ORPHAN_UPT' ? (r.upt_val as string | null)
            : reason === 'MISSING_ULTG' || reason === 'ORPHAN_ULTG' ? (r.ultg_val as string | null)
            : reason === 'MISSING_GI' || reason === 'ORPHAN_GI' ? (r.gi_val as string | null)
            : reason === 'MISSING_BAY' || reason === 'ORPHAN_BAY' ? (r.bay_val as string | null)
            : null;
        // +1 biar skip header row di Google Sheet (header = row 1, data mulai row 2).
        const rawRow = Number(r.row_number ?? 0);
        const sheetRow = rawRow > 0 ? rawRow + 1 : 2;
        return {
            spreadsheet_id: input.spreadsheetId,
            source_sheet: input.sheetName,
            row_number: sheetRow,
            reason_code: reason,
            reason_message: buildReasonMessage(reason, cellValue),
        };
    });

    if (cells.length === 0) {
        console.warn(
            `[triggerHighlightPreview] no rejected rows for ${input.dataset}.${input.table} (level=${input.level}) — nothing to paint`
        );
    }
    return cells;
}

async function triggerHighlightPreview(input: {
    dataset: string;
    table: string;
    level: HierarchyLevel;
    columns: LevelColumns;
}): Promise<
    | { ok: true; cellsPainted: number; spreadsheetId: string; sheetName: string }
    | { ok: false; error: string; code?: string; details?: unknown }
> {
    let spreadsheetId: string;
    let sheetName: string;
    try {
        const lookup = await lookupSpreadsheetForTable(input.table);
        spreadsheetId = lookup.spreadsheetId;
        sheetName = lookup.sheetName;
    } catch (e) {
        const err = e as { code?: string; message?: string };
        return {
            ok: false,
            error: err.message || String(e),
            code: err.code || 'TABLE_NOT_REGISTERED',
        };
    }

    let cells: HighlightCell[];
    try {
        cells = await buildPreviewCells({
            dataset: input.dataset,
            table: input.table,
            level: input.level,
            columns: input.columns,
            spreadsheetId,
            sheetName,
        });
    } catch (e) {
        const err = e as { code?: string; message?: string };
        return {
            ok: false,
            error: err.message || String(e),
            code: err.code || 'PREVIEW_SQL_FAILED',
        };
    }

    try {
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth();
        const client = await auth.getIdTokenClient(SS_SYNC_CF_URL);
        const res = await client.request({
            url: SS_SYNC_CF_URL,
            method: 'POST',
            data: {
                action: 'highlight',
                mode: 'preview',
                cells,
            },
            timeout: 2 * 60 * 1000,
        });
        const data = res.data as {
            ok?: boolean;
            highlight?: {
                mode?: string;
                flagged?: number;
                cleared?: number;
                perSpreadsheet?: Record<string, number>;
            };
            cellsPainted?: number;
            error?: string;
            code?: string;
            details?: unknown;
        };
        if (data?.ok !== false && (data?.highlight || typeof data?.cellsPainted === 'number')) {
            const flagged =
                typeof data.highlight?.flagged === 'number'
                    ? data.highlight.flagged
                    : Number(data.cellsPainted ?? 0);
            return { ok: true, cellsPainted: flagged, spreadsheetId, sheetName };
        }
        return {
            ok: false,
            error: data?.error || 'CF returned unexpected shape',
            code: data?.code,
            details: data?.details,
        };
    } catch (e: unknown) {
        const err = e as {
            response?: { data?: { error?: string; code?: string; details?: unknown } };
            message?: string;
        };
        const body = err.response?.data;
        if (body?.error) {
            return { ok: false, error: body.error, code: body.code, details: body.details };
        }
        return { ok: false, error: err.message || String(e) };
    }
}

/* ─────────── Handlers ─────────── */

export async function GET() {
    try {
        const tables = await listUserTables();
        return NextResponse.json({ ok: true, tables });
    } catch (e) {
        const err = e as { code?: string; message?: string };
        console.error('[bq-table-levels GET]', e);
        return NextResponse.json(
            { ok: false, code: err.code || 'INTERNAL_ERROR', error: err.message || String(e) },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const action = body?.action as string | undefined;

        if (action === 'dry-run') {
            const errs = validateLevelPayload(body);
            if (errs.length > 0) {
                return NextResponse.json(
                    { ok: false, code: errs[0].code, error: errs[0].message, validation: errs },
                    { status: 422 }
                );
            }
            try {
                const dryRun = await performDryRun(
                    body.dataset as string,
                    body.table as string,
                    body.level as HierarchyLevel,
                    (body.columns ?? {}) as LevelColumns
                );
                return NextResponse.json({ ok: true, dryRun });
            } catch (e) {
                const err = e as { code?: string; message?: string };
                const status = err.code === 'BQ_TABLE_NOT_FOUND' ? 404 : err.code === 'MISSING_COLUMNS' ? 422 : 500;
                return NextResponse.json(
                    { ok: false, code: err.code || 'DRY_RUN_FAILED', error: err.message || String(e) },
                    { status }
                );
            }
        }

        if (action === 'save') {
            const errs = validateLevelPayload(body);
            if (errs.length > 0) {
                return NextResponse.json(
                    { ok: false, code: errs[0].code, error: errs[0].message, validation: errs },
                    { status: 422 }
                );
            }
            await saveConfig(
                {
                    dataset: body.dataset as string,
                    table: body.table as string,
                    level: body.level as HierarchyLevel,
                    columns: (body.columns ?? {}) as LevelColumns,
                    dryRunResult: body.dryRunResult as DryRunResult | undefined,
                },
                body.configuredBy as string | undefined
            );
            return NextResponse.json({ ok: true, saved: true });
        }

        if (action === 'highlight-preview') {
            const errs = validateLevelPayload(body);
            if (errs.length > 0) {
                return NextResponse.json(
                    { ok: false, code: errs[0].code, error: errs[0].message, validation: errs },
                    { status: 422 }
                );
            }
            const result = await triggerHighlightPreview({
                dataset: body.dataset as string,
                table: body.table as string,
                level: body.level as HierarchyLevel,
                columns: (body.columns ?? {}) as LevelColumns,
            });
            if (result.ok) {
                return NextResponse.json({
                    ok: true,
                    cellsPainted: result.cellsPainted,
                    spreadsheetId: result.spreadsheetId,
                    sheetName: result.sheetName,
                    preview: {
                        cellsPainted: result.cellsPainted,
                        spreadsheetId: result.spreadsheetId,
                        sheetName: result.sheetName,
                    },
                });
            }
            const status =
                result.code === 'TABLE_NOT_REGISTERED' ? 422
                : result.code === 'BQ_TABLE_NOT_FOUND' ? 404
                : result.code === 'MISSING_COLUMNS' ? 422
                : 502;
            return NextResponse.json(
                { ok: false, code: result.code || 'HIGHLIGHT_FAILED', error: result.error, details: result.details },
                { status }
            );
        }

        return NextResponse.json(
            { ok: false, code: 'UNKNOWN_ACTION', error: `Unknown action "${action}"` },
            { status: 400 }
        );
    } catch (e) {
        const err = e as { code?: string; message?: string };
        console.error('[bq-table-levels POST]', e);
        return NextResponse.json(
            { ok: false, code: err.code || 'INTERNAL_ERROR', error: err.message || String(e) },
            { status: 500 }
        );
    }
}
