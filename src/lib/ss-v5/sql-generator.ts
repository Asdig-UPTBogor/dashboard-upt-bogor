/**
 * SS V5 — Canonical SQL Generator (SINGLE SOURCE OF TRUTH)
 *
 * Build BQ DTS Scheduled Query SQL untuk per-sheet sync.
 * Semua entry point (Wizard, setup-dts CLI) WAJIB pakai ini.
 *
 * Output SQL mengacu ke schema `ss_platform` canonical:
 *   - sheet_sync_state (bukan legacy dataset_hash)
 *   - rejected_rows (+row_pk_value, +spreadsheet_title)
 *   - sync_history (+trigger_source='dts')
 *
 * Location: Spreadsheet Sync/lib/sql-generator.ts (master source)
 * Mirror:   Dashboard-UPT-Bogor/dashboard/src/lib/ss-v5/sql-generator.ts
 *
 * Update sync: `npm run sync-lib` saat berubah.
 */
import type { BigQuery } from '@google-cloud/bigquery';
import type { SheetConfig } from './data-source-schema.js';

/* ─────────── CONSTANTS ─────────── */

export const PROJECT = 'gcp-bridge-meshvpn';
export const LOCATION = 'asia-southeast2';
export const INTERNAL = '_internal';
export const SS_PLATFORM = 'ss_platform';
export const EXEC_SA = '21805978769-compute@developer.gserviceaccount.com';
export const DEFAULT_SCHEDULE = 'every 15 minutes';
export const DTS_PARENT = `projects/${PROJECT}/locations/${LOCATION}`;

/** Firestore collection V5 (pisah dari V4 `dashboard_pages` yang dipakai Dashboard cloud production). */
export const V5_PAGES_COLLECTION = 'dashboard_pages_v5';
export const DATA_SOURCES_COLLECTION = 'data_sources';

/* ─────────── HELPERS ─────────── */

/** Sanitize ke BQ-safe identifier (alphanumeric + underscore). */
export function toSafeName(raw: string): string {
  return String(raw)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** External table name convention: ext_<dataset>__<sheet>. */
export function extTableName(dataset: string, sheet: string): string {
  return `ext_${toSafeName(dataset)}__${toSafeName(sheet)}`.substring(0, 1024);
}

/** DTS Scheduled Query displayName convention. */
export function dtsDisplayName(dataset: string, sheet: string): string {
  return `SS V5: ${dataset}.${sheet}`;
}

/** V2: staging table name convention. Dipake buat BQ Load Job intermediate. */
export function stagingTableName(dataset: string, sheet: string): string {
  return `stg_${toSafeName(dataset)}__${toSafeName(sheet)}`.substring(0, 1024);
}

/** V2: BQ schema fields untuk staging Load Job (NEWLINE_DELIMITED_JSON). */
export interface StagingSchemaInput {
  validColumnNames: string[];
}
export function buildStagingSchema(input: StagingSchemaInput) {
  const fields: Array<{ name: string; type: string; mode: string }> = input.validColumnNames.map(
    (name) => ({ name, type: 'STRING', mode: 'NULLABLE' })
  );
  fields.push(
    { name: '_sheet_row_num', type: 'INT64', mode: 'REQUIRED' },
    { name: '_loaded_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
  );
  return fields;
}

/**
 * G10: Auto-detect placeholder columns (col_N pattern) di ext_* schema.
 * Kolom tanpa header di row 1 → placeholder → user rule: SKIP dari output BQ.
 * Returns list of placeholder column names untuk EXCEPT clause.
 */
export async function detectPlaceholderColumns(
  bq: BigQuery,
  dataset: string,
  sheet: string
): Promise<string[]> {
  const extId = extTableName(dataset, sheet);
  try {
    const [meta] = await bq.dataset(INTERNAL).table(extId).getMetadata();
    const fields = (meta.schema?.fields || []) as Array<{ name: string }>;
    return fields.map((f) => f.name).filter((n) => /^col_\d+$/.test(n));
  } catch {
    return [];
  }
}

/* ─────────── SQL BUILDER ─────────── */

/* ═══════════════════════════════════════════════════════════════════════════
 * V2 SQL BUILDERS (CF-native, staging-sourced, no ext_* dependency)
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface BuildFlatCreateOrReplaceInput {
  dataset: string;
  bqTable: string;
  stagingTable: string;
}

/** V2: FLAT mode — no enrichment, direct copy from staging. */
export function buildFlatCreateOrReplaceSQL(input: BuildFlatCreateOrReplaceInput): string {
  const targetFqn = `\`${PROJECT}.${input.dataset}.${input.bqTable}\``;
  const stagingFqn = `\`${PROJECT}._staging.${input.stagingTable}\``;
  return `CREATE OR REPLACE TABLE ${targetFqn} AS
SELECT *, CURRENT_TIMESTAMP() AS _synced_at
FROM ${stagingFqn};`;
}

export interface BuildEnrichmentCreateOrReplaceInput {
  dataset: string;
  bqTable: string;
  stagingTable: string;
  /** Column names di sheet/staging yang berisi nama hirarki */
  fkColumns: {
    upt?: string;
    ultg?: string;
    gi?: string;
    bay?: string;
  };
  /** Apakah level BAY (butuh JOIN dim_bay) */
  hasBay: boolean;
}

/**
 * V2: Non-FLAT mode — LEFT JOIN dim_gi / dim_ultg / dim_bay untuk enrichment FK.
 * Throws kalau giCol missing (fail loud, no fallback).
 */
export function buildEnrichmentCreateOrReplaceSQL(
  input: BuildEnrichmentCreateOrReplaceInput
): string {
  const giCol = input.fkColumns.gi ? toSafeName(input.fkColumns.gi) : null;
  const bayCol = input.fkColumns.bay ? toSafeName(input.fkColumns.bay) : null;
  if (!giCol) {
    throw new Error('buildEnrichmentCreateOrReplaceSQL: butuh fkColumns.gi (fail loud)');
  }
  const targetFqn = `\`${PROJECT}.${input.dataset}.${input.bqTable}\``;
  const stagingFqn = `\`${PROJECT}._staging.${input.stagingTable}\``;
  const hasBay = input.hasBay && !!bayCol;

  return `CREATE OR REPLACE TABLE ${targetFqn} AS
SELECT ext.*,
  gi.gi_id AS _gi_id, gi.ultg_id AS _ultg_id, ultg.upt_id AS _upt_id,
  ${hasBay ? 'bay.bay_id AS _bay_id' : 'CAST(NULL AS INT64) AS _bay_id'},
  CURRENT_TIMESTAMP() AS _synced_at
FROM ${stagingFqn} ext
LEFT JOIN \`${PROJECT}.${SS_PLATFORM}.dim_gi\` gi
  ON UPPER(gi.gi_name) = UPPER(TRIM(ext.${giCol})) AND gi.is_active = TRUE
LEFT JOIN \`${PROJECT}.${SS_PLATFORM}.dim_ultg\` ultg
  ON ultg.ultg_id = gi.ultg_id AND ultg.is_active = TRUE
${
  hasBay
    ? `LEFT JOIN \`${PROJECT}.${SS_PLATFORM}.dim_bay\` bay
  ON bay.gi_id = gi.gi_id AND UPPER(bay.bay_name) = UPPER(TRIM(ext.${bayCol})) AND bay.is_active = TRUE`
    : ''
}`;
}

export interface BuildRejectedRowsInsertInput {
  dataset: string;
  bqTable: string;
  sheetTabName: string;
  sheetTabId: number;
  spreadsheetId: string;
  spreadsheetName: string;
  fkColumns: {
    gi?: string;
    bay?: string;
  };
  hasBay: boolean;
}

/**
 * V2: INSERT INTO rejected_rows SELECT FROM target WHERE FK null.
 * Clear-repaint pattern: caller harus resolve old rejected dulu sebelum INSERT ini.
 */
export function buildRejectedRowsInsertSQL(input: BuildRejectedRowsInsertInput): string {
  const giCol = input.fkColumns.gi ? toSafeName(input.fkColumns.gi) : null;
  const bayCol = input.fkColumns.bay ? toSafeName(input.fkColumns.bay) : null;
  if (!giCol) {
    throw new Error('buildRejectedRowsInsertSQL: butuh fkColumns.gi');
  }
  const targetFqn = `\`${PROJECT}.${input.dataset}.${input.bqTable}\``;
  const escDataset = input.dataset.replace(/'/g, "''");
  const escSheet = input.sheetTabName.replace(/'/g, "''");
  const escSS = input.spreadsheetId.replace(/'/g, "''");
  const escSSName = input.spreadsheetName.replace(/'/g, "''");
  const hasBay = input.hasBay && !!bayCol;

  return `INSERT INTO \`${PROJECT}.${SS_PLATFORM}.rejected_rows\`
  (rejection_key, spreadsheet_id, spreadsheet_name, spreadsheet_title,
   source_dataset, source_sheet, row_pk_value, row_number,
   column_name, cell_value, reason_code, reason_message, status,
   first_seen_at, last_seen_at, resolved_at, sync_cycle_id)
SELECT
  FARM_FINGERPRINT(CONCAT('${escSS}', '|', '${escSheet}', '|',
    CAST(_sheet_row_num AS STRING), '|',
    COALESCE(CAST(${giCol} AS STRING), ''))) AS rejection_key,
  '${escSS}' AS spreadsheet_id,
  '${escSSName}' AS spreadsheet_name,
  '${escSSName}' AS spreadsheet_title,
  '${escDataset}' AS source_dataset,
  '${escSheet}' AS source_sheet,
  NULL AS row_pk_value,
  _sheet_row_num AS row_number,
  CASE
    WHEN ${giCol} IS NULL OR TRIM(${giCol}) = '' THEN '${giCol}'
    WHEN _gi_id IS NULL THEN '${giCol}'
    ${
      hasBay
        ? `WHEN ${bayCol} IS NULL OR TRIM(${bayCol}) = '' THEN '${bayCol}'
    WHEN _bay_id IS NULL THEN '${bayCol}'`
        : ''
    }
    ELSE NULL
  END AS column_name,
  CASE
    WHEN _gi_id IS NULL THEN ${giCol}
    ${hasBay ? `WHEN _bay_id IS NULL THEN ${bayCol}` : ''}
    ELSE NULL
  END AS cell_value,
  CASE
    WHEN ${giCol} IS NULL OR TRIM(${giCol}) = '' THEN 'MISSING_GI'
    WHEN _gi_id IS NULL THEN 'ORPHAN_GI'
    ${
      hasBay
        ? `WHEN ${bayCol} IS NULL OR TRIM(${bayCol}) = '' THEN 'MISSING_BAY'
    WHEN _bay_id IS NULL THEN 'ORPHAN_BAY'`
        : ''
    }
    ELSE 'UNKNOWN'
  END AS reason_code,
  CASE
    WHEN _gi_id IS NULL THEN CONCAT('GI "', COALESCE(${giCol}, ''), '" tidak di dim_gi')
    ${
      hasBay
        ? `WHEN _bay_id IS NULL THEN CONCAT('Bay "', COALESCE(${bayCol}, ''), '" tidak di dim_bay untuk GI ini')`
        : ''
    }
    ELSE NULL
  END AS reason_message,
  'active' AS status,
  CURRENT_TIMESTAMP() AS first_seen_at,
  CURRENT_TIMESTAMP() AS last_seen_at,
  CAST(NULL AS TIMESTAMP) AS resolved_at,
  '${input.sheetTabId}' AS sync_cycle_id
FROM ${targetFqn}
WHERE _gi_id IS NULL ${hasBay ? 'OR _bay_id IS NULL' : ''};`;
}

/** V2: Resolve old rejected (clear-repaint strategy) sebelum INSERT fresh. */
export function buildResolveOldRejectedSQL(dataset: string, sheetTabName: string): string {
  const escDataset = dataset.replace(/'/g, "''");
  const escSheet = sheetTabName.replace(/'/g, "''");
  return `UPDATE \`${PROJECT}.${SS_PLATFORM}.rejected_rows\`
SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP()
WHERE source_dataset = '${escDataset}' AND source_sheet = '${escSheet}' AND status = 'active';`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * V1 DTS SQL BUILDER (legacy, dipake sampai cutover)
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface BuildScheduledSQLInput {
  datasetId: string;
  spreadsheetId: string;
  /** Original spreadsheet name (legacy `spreadsheet_name` kolom di rejected_rows). */
  spreadsheetName: string;
  /**
   * Human-readable title untuk sheet_sync_state + rejected_rows.spreadsheet_title.
   * Biasanya = spreadsheetName tapi field terpisah buat konsistensi.
   */
  spreadsheetTitle?: string;
  sheetTab: string;
  cfg: SheetConfig;
  /** Placeholder columns untuk EXCEPT clause (G10 rule). */
  placeholderCols?: string[];
}

/**
 * Build Scheduled Query SQL untuk 1 sheet.
 *
 * Flow:
 *   1. Compute content hash dari ext_* (MD5 of sorted JSON rows)
 *   2. Skip kalau hash sama dengan last → INSERT sync_history status='skipped'
 *   3. CREATE OR REPLACE target table dengan JOIN dim (FLAT = direct copy)
 *   4. MERGE rejected_rows (ORPHAN_GI / ORPHAN_BAY / MISSING_GI / MISSING_BAY)
 *   5. Auto-resolve rejected dari cycle sebelumnya yang hilang
 *   6. MERGE sheet_sync_state (hash + counts + title)
 *   7. INSERT sync_history status='success'
 *
 * Rules:
 *   - FLAT/MASTER hierarchy → direct copy, no enrichment
 *   - GI/BAY hierarchy → JOIN dim_gi + dim_ultg + optional dim_bay
 *   - Placeholder cols (header kosong, G10) → EXCEPT clause
 *   - rejection_key = FARM_FINGERPRINT stable (ss_id | sheet | row_num | pk_value | gi_value | bay_value)
 */
export function buildScheduledSQL(input: BuildScheduledSQLInput): string {
  const {
    datasetId,
    spreadsheetId,
    spreadsheetName,
    spreadsheetTitle,
    sheetTab,
    cfg,
    placeholderCols = [],
  } = input;

  const extId = extTableName(datasetId, sheetTab);
  const tableFqn = `\`${PROJECT}.${datasetId}.${cfg.tableName}\``;
  const extFqn = `\`${PROJECT}.${INTERNAL}.${extId}\``;
  const pkCol = '`' + toSafeName(cfg.pkColumn) + '`';
  const escDataset = datasetId.replace(/'/g, "''");
  const escSheet = sheetTab.replace(/'/g, "''");
  const escSS = spreadsheetId.replace(/'/g, "''");
  const escSSName = (spreadsheetName || '').replace(/'/g, "''");
  const escSSTitle = (spreadsheetTitle || spreadsheetName || datasetId).replace(/'/g, "''");

  const exceptClause =
    placeholderCols.length > 0 ? ` EXCEPT(${placeholderCols.join(', ')})` : '';

  const isFlat = cfg.hierarchyLevel === 'FLAT' || cfg.hierarchyLevel === 'MASTER';
  const giCol = cfg.columns?.gi ? toSafeName(cfg.columns.gi) : null;
  const bayCol = cfg.columns?.bay ? toSafeName(cfg.columns.bay) : null;

  const header = `
DECLARE run_id STRING DEFAULT CONCAT('dts-', FORMAT_TIMESTAMP('%Y%m%d-%H%M%S', @run_time), '-', SUBSTR(GENERATE_UUID(), 1, 8));
DECLARE current_hash STRING;
DECLARE last_hash STRING;
DECLARE start_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP();

SET current_hash = (
  SELECT TO_HEX(MD5(STRING_AGG(TO_JSON_STRING(t), '|' ORDER BY TO_JSON_STRING(t))))
  FROM ${extFqn} t WHERE t.${pkCol} IS NOT NULL AND TRIM(t.${pkCol}) != ''
);
SET last_hash = (
  SELECT content_hash FROM \`${PROJECT}.${SS_PLATFORM}.sheet_sync_state\`
  WHERE bq_dataset_name = '${cfg.tableName}'
);

IF current_hash IS NOT NULL AND current_hash = last_hash THEN
  INSERT INTO \`${PROJECT}.${SS_PLATFORM}.sync_history\`
    (run_id, started_at, finished_at, trigger_source, dataset_name, sheet_name,
     status, skipped_reason, rows_read, rows_written, rows_rejected, duration_ms)
  VALUES (
    run_id, start_ts, CURRENT_TIMESTAMP(), 'dts',
    '${escDataset}', '${escSheet}', 'skipped', 'hash_unchanged',
    0, 0, 0, TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_ts, MILLISECOND)
  );
  RETURN;
END IF;
`.trim();

  const buildSyncStateMerge = (validCountExpr: string, rejectedCountExpr: string) => `
MERGE \`${PROJECT}.${SS_PLATFORM}.sheet_sync_state\` AS target
USING (SELECT
  '${escSS}' AS spreadsheet_id,
  '${escSSTitle}' AS spreadsheet_title,
  '${escSheet}' AS sheet_name,
  '${cfg.tableName}' AS bq_dataset_name,
  current_hash AS content_hash,
  CAST(NULL AS TIMESTAMP) AS drive_modified_time,
  CURRENT_TIMESTAMP() AS last_synced_at,
  'success' AS last_sync_status,
  (SELECT COUNT(*) FROM ${extFqn} WHERE ${pkCol} IS NOT NULL) AS row_count_total,
  ${validCountExpr} AS row_count_valid,
  ${rejectedCountExpr} AS row_count_rejected
) AS src
ON target.bq_dataset_name = src.bq_dataset_name
WHEN MATCHED THEN UPDATE SET
  spreadsheet_id = src.spreadsheet_id,
  spreadsheet_title = src.spreadsheet_title,
  sheet_name = src.sheet_name,
  content_hash = src.content_hash,
  last_synced_at = src.last_synced_at,
  last_sync_status = src.last_sync_status,
  row_count_total = src.row_count_total,
  row_count_valid = src.row_count_valid,
  row_count_rejected = src.row_count_rejected
WHEN NOT MATCHED THEN INSERT ROW;
`.trim();

  if (isFlat) {
    return `${header}

CREATE OR REPLACE TABLE ${tableFqn} AS
SELECT *${exceptClause}, CURRENT_TIMESTAMP() AS _synced_at
FROM ${extFqn}
WHERE ${pkCol} IS NOT NULL AND TRIM(${pkCol}) != '';

${buildSyncStateMerge(`(SELECT COUNT(*) FROM ${tableFqn})`, '0')}

INSERT INTO \`${PROJECT}.${SS_PLATFORM}.sync_history\`
  (run_id, started_at, finished_at, trigger_source, dataset_name, sheet_name, status, rows_read, rows_written, rows_rejected, duration_ms)
SELECT run_id, start_ts, CURRENT_TIMESTAMP(), 'dts', '${escDataset}', '${escSheet}', 'success',
  (SELECT COUNT(*) FROM ${extFqn} WHERE ${pkCol} IS NOT NULL),
  (SELECT COUNT(*) FROM ${tableFqn}),
  0,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_ts, MILLISECOND);
`.trim();
  }

  if (!giCol) {
    throw new Error(
      `Sheet "${sheetTab}" hierarchy=${cfg.hierarchyLevel} butuh columns.gi (fail loud — no fallback)`
    );
  }
  const hasBay = !!bayCol;

  return `${header}

CREATE OR REPLACE TABLE ${tableFqn} AS
SELECT ext.*${exceptClause},
  gi.gi_id AS _gi_id,
  ultg.upt_id AS _upt_id,
  gi.ultg_id AS _ultg_id,
  ${hasBay ? 'bay.bay_id AS _bay_id' : 'CAST(NULL AS INT64) AS _bay_id'},
  CURRENT_TIMESTAMP() AS _synced_at
FROM ${extFqn} ext
LEFT JOIN \`${PROJECT}.${SS_PLATFORM}.dim_gi\` gi
  ON UPPER(gi.gi_name) = UPPER(TRIM(ext.${giCol})) AND gi.is_active = TRUE
LEFT JOIN \`${PROJECT}.${SS_PLATFORM}.dim_ultg\` ultg
  ON ultg.ultg_id = gi.ultg_id AND ultg.is_active = TRUE
${hasBay ? `LEFT JOIN \`${PROJECT}.${SS_PLATFORM}.dim_bay\` bay
  ON bay.gi_id = gi.gi_id AND UPPER(bay.bay_name) = UPPER(TRIM(ext.${bayCol})) AND bay.is_active = TRUE` : ''}
WHERE ext.${pkCol} IS NOT NULL AND TRIM(ext.${pkCol}) != '';

MERGE \`${PROJECT}.${SS_PLATFORM}.rejected_rows\` AS target
USING (
  WITH numbered AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY ${pkCol}) AS rn FROM ${tableFqn}
  )
  SELECT
    FARM_FINGERPRINT(CONCAT(
      '${escSS}', '|', '${escSheet}', '|',
      CAST(rn AS STRING), '|',
      COALESCE(CAST(${pkCol} AS STRING), ''), '|',
      COALESCE(${giCol}, '')${hasBay ? ", '|', COALESCE(" + bayCol + ", '')" : ''}
    )) AS rejection_key,
    '${escSS}' AS spreadsheet_id,
    '${escSSName}' AS spreadsheet_name,
    '${escSSTitle}' AS spreadsheet_title,
    '${escDataset}' AS source_dataset,
    '${escSheet}' AS source_sheet,
    CAST(${pkCol} AS STRING) AS row_pk_value,
    CAST(rn AS INT64) AS row_number,
    CASE
      WHEN ${giCol} IS NULL OR TRIM(${giCol}) = '' THEN '${giCol}'
      WHEN _gi_id IS NULL THEN '${giCol}'
      ${hasBay ? `WHEN ${bayCol} IS NULL OR TRIM(${bayCol}) = '' THEN '${bayCol}'
      WHEN _bay_id IS NULL THEN '${bayCol}'` : ''}
      ELSE NULL
    END AS column_name,
    CASE
      WHEN ${giCol} IS NULL OR TRIM(${giCol}) = '' THEN NULL
      WHEN _gi_id IS NULL THEN ${giCol}
      ${hasBay ? `WHEN ${bayCol} IS NULL OR TRIM(${bayCol}) = '' THEN NULL
      WHEN _bay_id IS NULL THEN ${bayCol}` : ''}
      ELSE NULL
    END AS cell_value,
    CASE
      WHEN ${giCol} IS NULL OR TRIM(${giCol}) = '' THEN 'MISSING_GI'
      WHEN _gi_id IS NULL THEN 'ORPHAN_GI'
      ${hasBay ? `WHEN ${bayCol} IS NULL OR TRIM(${bayCol}) = '' THEN 'MISSING_BAY'
      WHEN _bay_id IS NULL THEN 'ORPHAN_BAY'` : ''}
      ELSE 'UNKNOWN'
    END AS reason_code,
    CASE
      WHEN _gi_id IS NULL THEN CONCAT('GI "', COALESCE(${giCol}, ''), '" tidak ditemukan di master')
      ${hasBay ? `WHEN _bay_id IS NULL THEN CONCAT('Bay "', COALESCE(${bayCol}, ''), '" tidak ditemukan untuk GI ini')` : ''}
      ELSE NULL
    END AS reason_message,
    'active' AS status,
    CURRENT_TIMESTAMP() AS first_seen_at,
    CURRENT_TIMESTAMP() AS last_seen_at,
    CAST(NULL AS TIMESTAMP) AS resolved_at,
    run_id AS sync_cycle_id
  FROM numbered
  WHERE _gi_id IS NULL ${hasBay ? 'OR _bay_id IS NULL' : ''}
) AS source
ON target.rejection_key = source.rejection_key
WHEN MATCHED THEN UPDATE SET
  last_seen_at = source.last_seen_at,
  sync_cycle_id = source.sync_cycle_id,
  row_pk_value = source.row_pk_value,
  row_number = source.row_number,
  column_name = source.column_name,
  cell_value = source.cell_value,
  reason_code = source.reason_code,
  reason_message = source.reason_message,
  spreadsheet_title = source.spreadsheet_title,
  status = 'active'
WHEN NOT MATCHED THEN INSERT ROW;

UPDATE \`${PROJECT}.${SS_PLATFORM}.rejected_rows\`
SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP()
WHERE source_dataset = '${escDataset}' AND source_sheet = '${escSheet}' AND status = 'active' AND sync_cycle_id != run_id;

${buildSyncStateMerge(
    `(SELECT COUNT(*) FROM ${tableFqn} WHERE _gi_id IS NOT NULL${hasBay ? ' AND _bay_id IS NOT NULL' : ''})`,
    `(SELECT COUNT(*) FROM \`${PROJECT}.${SS_PLATFORM}.rejected_rows\` WHERE source_sheet = '${escSheet}' AND sync_cycle_id = run_id)`
  )}

INSERT INTO \`${PROJECT}.${SS_PLATFORM}.sync_history\`
  (run_id, started_at, finished_at, trigger_source, dataset_name, sheet_name, status, rows_read, rows_written, rows_rejected, duration_ms)
SELECT run_id, start_ts, CURRENT_TIMESTAMP(), 'dts', '${escDataset}', '${escSheet}', 'success',
  (SELECT COUNT(*) FROM ${extFqn} WHERE ${pkCol} IS NOT NULL),
  (SELECT COUNT(*) FROM ${tableFqn} WHERE _gi_id IS NOT NULL${hasBay ? ' AND _bay_id IS NOT NULL' : ''}),
  (SELECT COUNT(*) FROM \`${PROJECT}.${SS_PLATFORM}.rejected_rows\` WHERE source_sheet = '${escSheet}' AND sync_cycle_id = run_id),
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_ts, MILLISECOND);
`.trim();
}
