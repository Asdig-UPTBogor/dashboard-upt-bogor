/**
 * SS V5 — Canonical Data Source Schema
 *
 * SINGLE SOURCE OF TRUTH untuk struktur Firestore `data_sources/{id}`.
 *
 * Semua entry point ke system (Wizard, backfill CLI, sync engine) WAJIB
 * produce + consume shape ini. Deviation = bug.
 *
 * Location: Spreadsheet Sync/lib/data-source-schema.ts (master source)
 * Mirror:   Dashboard-UPT-Bogor/dashboard/src/lib/ss-v5/data-source-schema.ts (copy)
 *
 * Update sync: jalankan `npm run sync-lib` kalau ada perubahan.
 */

/** Hierarchy level per sheet — menentukan strategi enrichment */
export type HierarchyLevel = 'UPT' | 'ULTG' | 'GI' | 'BAY' | 'FLAT' | 'MASTER';

/** Hierarchy default untuk spreadsheet — computed dari distribusi sheets */
export type HierarchyDefault = 'UPT' | 'ULTG' | 'GI' | 'BAY' | 'FLAT' | 'MIXED';

/** Per-sheet config */
export interface SheetConfig {
  /** BQ table name (e.g., `n_MTU_PMT`) */
  tableName: string;

  /** Hierarchy level for this sheet */
  hierarchyLevel: HierarchyLevel;

  /** Column name yang jadi PK (non-null filter + rejection_key stability) */
  pkColumn: string;

  /** Column mapping untuk enrichment */
  columns?: {
    upt?: string;   // column name di Sheet untuk UPT
    ultg?: string;  // column name untuk ULTG
    gi?: string;    // column name untuk GI
    bay?: string;   // column name untuk Bay
  };

  /** DTS Transfer Config ID (auto-populated saat create) */
  transferConfigId?: string;

  /** Placeholder columns (header kosong di row 1) — skip dari output via EXCEPT */
  placeholderColumns?: string[];

  /**
   * Google Sheets numeric `sheetId` (permanent ID — tidak berubah saat rename tab).
   * Dipakai drift-detector untuk detect SHEET_RENAMED via sheetId match.
   * Populate: saat Wizard create (pre-flight Sheets API get) atau backfill script.
   */
  sheetId?: number;
}

/** Canonical data_sources/{id} shape */
export interface DataSource {
  /** = Firestore doc id */
  id: string;

  /** BQ dataset name (usually = id) */
  dataset: string;

  /** Alias for clarity (= dataset) */
  bqDataset: string;

  /** Google Spreadsheet ID */
  spreadsheetId: string;

  /** User-friendly display name (from Drive metadata) */
  spreadsheetName: string;

  /** Auto-derived URL */
  spreadsheetUrl: string;

  /** Sync toggle (pause/resume global) */
  syncEnabled: boolean;

  /** Flag master hierarchy (hanya 1 data_source per ekosistem) */
  isMasterHierarchy: boolean;

  /** Computed dari distribusi hierarchyLevel di sheets */
  hierarchyDefault: HierarchyDefault;

  /** Per-sheet config */
  sheets: Record<string, SheetConfig>;

  /** Computed = Object.keys(sheets).length */
  sheetCount: number;

  /** Timestamps (ISO 8601) */
  createdAt: string;
  configuredAt: string;
  updatedAt: string;
}

/**
 * Compute `hierarchyDefault` dari sheets config.
 * Returns 'MIXED' kalau multiple hierarchy levels, else the common one.
 */
export function computeHierarchyDefault(
  sheets: Record<string, SheetConfig>
): HierarchyDefault {
  const levels = new Set(Object.values(sheets).map((s) => s.hierarchyLevel));
  if (levels.size === 0) return 'FLAT';
  if (levels.size === 1) return Array.from(levels)[0] as HierarchyDefault;
  // Drop MASTER from count (MASTER = dim source, not data)
  levels.delete('MASTER');
  if (levels.size === 1) return Array.from(levels)[0] as HierarchyDefault;
  return 'MIXED';
}

/**
 * Normalize data_source to canonical shape.
 * Fill missing fields, compute derived fields, drop deprecated fields.
 */
export function normalizeDataSource(raw: Partial<DataSource> & { id: string }): DataSource {
  const now = new Date().toISOString();
  const sheets = raw.sheets ?? {};
  const dataset = raw.dataset ?? raw.id;

  return {
    id: raw.id,
    dataset,
    bqDataset: raw.bqDataset ?? dataset,
    spreadsheetId: raw.spreadsheetId ?? '',
    spreadsheetName: raw.spreadsheetName ?? raw.id,
    spreadsheetUrl:
      raw.spreadsheetUrl ??
      (raw.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${raw.spreadsheetId}`
        : ''),
    syncEnabled: raw.syncEnabled ?? true,
    isMasterHierarchy: raw.isMasterHierarchy ?? false,
    hierarchyDefault: raw.hierarchyDefault ?? computeHierarchyDefault(sheets),
    sheets,
    sheetCount: Object.keys(sheets).length,
    createdAt: raw.createdAt ?? now,
    configuredAt: raw.configuredAt ?? raw.createdAt ?? now,
    updatedAt: now,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * V2 SCHEMA (parallel, per-fungsi block structure)
 *
 * Collection: data_sources_v2/{spreadsheetName}
 * Doc key   : BQ dataset name (readable) = nama spreadsheet safe-name
 *
 * Strategy:
 *   - Parallel ke V1 (data_sources/). V4 Dashboard LIVE keeps reading V1.
 *   - V2 CF sync engine writes ke V2 collection.
 *   - n_* BQ tables SHARED (both V1 + V2 produce same schema for backward compat).
 *   - Migrate per-page Dashboard V5 saat ready.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Sync status per sheet (V2) */
export type SyncStatusV2 = 'idle' | 'syncing' | 'halted';

/** Spreadsheet-level status (V2) */
export type SpreadsheetStatusV2 = 'idle' | 'running' | 'halted';

/** V2 per-sheet config + state — key di sheets map = sheetTabId (numeric, permanent) */
export interface SheetConfigV2 {
  /** BQ table name (stable, identifier for Dashboard query) */
  bqTable: string;
  /** Current Sheet tab name (mutable — bisa berubah saat user rename) */
  tabName: string;
  /** Per-sheet sync state (hash + timestamps + status) */
  syncState: {
    /** SHA256 hash of normalized rows (Gate 2 compare) */
    contentHash: string | null;
    lastSyncAt: string | null;
    rowCount: number;
    syncStatus: SyncStatusV2;
    /** Pointer to ss_platform.drift_events.event_id (kalau halted) */
    driftEventId: string | null;
  };
  /** Schema observed dari header row 1 */
  schema: {
    /** Valid column names (safeName) */
    columns: string[];
    /** Column letters yg header kosong (G10 skip) */
    skippedColumns: string[];
  };
  /** Pointer ke bq_table_levels/{dataset}__{table} (nullable kalau belum config level) */
  levelRef: string | null;
}

/** V2 canonical data_sources_v2/{name} shape */
export interface DataSourceV2 {
  /** = Firestore doc id */
  _id: string;
  identity: {
    /** User-friendly name dari Drive metadata */
    name: string;
    /** Drive URL */
    url: string;
    /** Drive file ID (permanent, internal) */
    driveId: string;
    /** Flag spreadsheet yg jadi source master hierarchy */
    isMasterHierarchy: boolean;
  };
  syncControl: {
    enabled: boolean;
    status: SpreadsheetStatusV2;
    /** ISO timestamp Drive modifiedTime dari cycle terakhir (Gate 1 compare) */
    lastDriveModified: string | null;
    lastSyncAt: string | null;
  };
  /** Per-sheet map keyed by sheetTabId numeric (stringified) */
  sheets: Record<string, SheetConfigV2>;
  audit: {
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    configuredAt: string | null;
  };
}

/**
 * Normalize raw input → canonical V2 shape.
 * Fill missing fields with safe defaults.
 */
export function normalizeDataSourceV2(
  raw: Partial<DataSourceV2> & { _id: string }
): DataSourceV2 {
  const now = new Date().toISOString();
  return {
    _id: raw._id,
    identity: {
      name: raw.identity?.name ?? raw._id,
      url: raw.identity?.url ?? '',
      driveId: raw.identity?.driveId ?? '',
      isMasterHierarchy: raw.identity?.isMasterHierarchy ?? false,
    },
    syncControl: {
      enabled: raw.syncControl?.enabled ?? true,
      status: raw.syncControl?.status ?? 'idle',
      lastDriveModified: raw.syncControl?.lastDriveModified ?? null,
      lastSyncAt: raw.syncControl?.lastSyncAt ?? null,
    },
    sheets: raw.sheets ?? {},
    audit: {
      createdAt: raw.audit?.createdAt ?? now,
      createdBy: raw.audit?.createdBy ?? 'system',
      updatedAt: now,
      updatedBy: raw.audit?.updatedBy ?? 'system',
      configuredAt: raw.audit?.configuredAt ?? null,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Deprecated fields yang tidak boleh ada lagi di canonical shape.
 * Kalau ada di input, harus dihapus saat normalize.
 */
export const DEPRECATED_FIELDS = [
  'syncMode',       // V4 artifact — per-sheet flag sekarang
  'excludeSheets',  // V4 — cukup pakai sheets[] filter
  'lastSync',       // baca dari ss_platform.sync_history, bukan cache di FS
  'lastResult',     // same — baca dari BQ
] as const;

/**
 * Strip deprecated fields from raw object.
 */
export function stripDeprecated<T extends Record<string, unknown>>(
  raw: T
): T {
  const clean = { ...raw };
  for (const f of DEPRECATED_FIELDS) {
    delete (clean as Record<string, unknown>)[f];
  }
  return clean;
}
