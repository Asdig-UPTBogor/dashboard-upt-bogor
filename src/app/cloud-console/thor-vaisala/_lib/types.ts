/* ═══════════════════════════════════════════════════
   Thor Vaisala Gen 3 — Types
   Aligned: 01_FS_DOC_SCHEMA.md v2.3 (87 fields)
   ═══════════════════════════════════════════════════ */

export interface ThorConfig {
    // ── §1 Config User (Editable via CC Config Tab) ──
    IS_ACTIVE: boolean | string;          // toggle
    SOURCE_MODE: string;                  // "live" | "mock"
    VAISALA_URL: string;
    VAISALA_COOKIE: string;
    UPT_FILTER: string;
    DATA_SPREADSHEET_ID: string;
    TOWER_SHEET_SOURCE: string;
    NOTIFIER_MODE: string;                // "production" | "maintenance"
    BBOX_MARGIN: number;                  // degrees (default 0.09)
    ALERT_ERROR_THRESHOLD: number;        // consecutive errors before alert
    ALERT_COOLDOWN_MIN: number;           // minutes
    ALERT_RECOVERY_MIN: number;           // minutes
    TOWER_COLUMN_MAP: TowerColumnMap | null; // User-defined column mapping
    ENRICHMENT_SOURCES: EnrichmentSource[];   // Dynamic enrichment sources
    BFO_CONFIG: BFOConfig | null;             // BFO calculation config

    // ── §2 Infra CF (service-reporter → cold start) ──
    infra_service_name: string;
    infra_function_name: string;
    infra_region: string;
    infra_memory: string;
    infra_cpu: string;
    infra_timeout: string;
    infra_runtime: string;
    infra_entry_point: string;
    infra_min_instances: number;
    infra_max_instances: number;
    infra_url: string;
    infra_revision: string;
    infra_generation: string;
    infra_function_state: string;
    infra_ingress: string;
    infra_service_account: string;
    infra_source: string;
    infra_created_at: string;
    infra_last_deploy: string;
    infra_cold_start_at: string;

    // ── §3 Infra CS (scheduler_* — 20 fields, SR v2.4) ──
    scheduler_job_id: string;
    scheduler_state: string;              // "ENABLED" | "PAUSED"
    scheduler_schedule: string;           // cron expression
    scheduler_timezone: string;
    scheduler_next_run: string;           // ISO
    scheduler_last_attempt: string;       // ISO
    scheduler_last_status_code: number;
    scheduler_last_status_message: string;
    scheduler_attempt_deadline: string;
    scheduler_target_url: string;
    scheduler_http_method: string;
    scheduler_service_account: string;
    scheduler_description: string;
    scheduler_retry_count: number;
    scheduler_min_backoff: string;
    scheduler_max_backoff: string;
    scheduler_max_doublings: number;
    scheduler_max_retry_duration: string;
    scheduler_user_update_time: string;   // ISO
    scheduler_updated_at: string;         // ISO

    // ── §3b Infra Pub/Sub (service-reporter v2.4) ──
    // Dynamic keys based on topic name 'notifier-send'
    // Accessed via Record<string,any> cast in TabSpecInfra
    pubsub_updated_at: string;

    // ── §4 Infra BQ (V0 validation writes) ──
    bq_dataset: string;
    bq_table_strikes: string;
    bq_table_towers: string;
    bq_table_sync_log: string;
    bq_table_prediction: string;
    bq_table_enrichment: string;          // Phase 2

    // ── §5 Validation Results (CF writes) ──
    CONFIG_STATUS: string;                // "validated" | "need_validate" | "error" | "not_configured"
    CONFIG_ERROR: string;
    CONFIG_REASON: string;
    DATA_SPREADSHEET_NAME: string;

    // §5.2 API
    API_STATUS: string;                   // "connected" | "error" | "auth_failed"
    API_ERROR: string;

    // §5.3 Tower
    TOWER_COUNT: number;
    TOWER_TOTAL_ROWS: number;
    TOWER_EXCLUDED: number;
    TOWER_EXCLUDED_REASONS: string;       // JSON array
    TOWER_COLUMNS: string;               // JSON array
    TOWER_ERROR: string;
    TOWER_LAST_VALIDATED: string;

    // §5.4 BBOX
    BBOX_MIN_LON: number;
    BBOX_MAX_LON: number;
    BBOX_MIN_LAT: number;
    BBOX_MAX_LAT: number;

    // §5.5 Notifier
    NOTIFIER_STATUS: string;              // "connected" | "unreachable" | "not_configured"
    NOTIFIER_SEND_STATUS: string;
    NOTIFIER_ERROR: string;

    // §5.6 Enrichment (Phase 2)
    ENRICHMENT_COUNT: number;
    ENRICHMENT_ERRORS: string;            // JSON
    ENRICHMENT_LAST_SYNCED: string;       // ISO

    // ── §6 Runtime Report (worker writes per-run) ──
    lastRun: string;                      // ISO — CC Standard
    lastStatus: string;                   // CC Standard
    lastDurationMs: number;               // CC Standard
    LAST_FETCH_TS: string;
    LAST_INSERT_COUNT: number;
    LAST_RUNTIME_MS: number;
    LAST_TOTAL_MS: number;
    LAST_VALIDATION_MS: number;
    _last_validated_ts: string;

    // ── §7 Internal State ──
    // Anti-spam (displayed in Notifier tab):
    //   _error_count, _error_alert_sent, _last_error_alert_ts, _recovery_candidate_ts
    // Bookkeeping (hidden):
    //   _last_validated_ts
}

/* ── Sub-types ── */

export interface TowerColumnMap {
    tower: string;      // header name for tower name column (REQUIRED)
    lat: string;        // header name for latitude column (REQUIRED)
    lon: string;        // header name for longitude column (REQUIRED)
    ultg: string;       // header name for ULTG column (REQUIRED)
    gi: string;         // header name for GI column (REQUIRED)
    tegangan: string;   // header name for tegangan column (OPTIONAL — fallback: regex from tower name)
    penghantar: string; // header name for penghantar column (OPTIONAL — fallback: empty, no line grouping)
}

export interface EnrichmentSource {
    name: string;                        // category name (e.g. "Protection")
    spreadsheetId: string;
    sheetName: string;
    towerNameColumn: string;             // header name for tower matching
    columnMap: Record<string, string>;   // { "json_key": "HEADER NAME" }
}

export interface BFOConfig {
    grounding_source: string;   // enrichment source name for grounding
    grounding_key: string;      // key in grounding data for R value
    insulator_source: string;   // enrichment source name for insulator
    insulator_key: string;      // key in insulator data for n_keping
}

/* ── Tab definitions ── */
export type ThorTab = "config" | "operations" | "spec-infra" | "notifier" | "enrichment";

export const TOWER_COLUMN_ROLES = [
    { key: 'tower', label: 'Tower Name', required: true },
    { key: 'lat', label: 'Latitude', required: true },
    { key: 'lon', label: 'Longitude', required: true },
    { key: 'ultg', label: 'ULTG', required: true },
    { key: 'gi', label: 'Gardu Induk', required: true },
    { key: 'tegangan', label: 'Tegangan (kV)', required: false },
    { key: 'penghantar', label: 'Penghantar', required: false },
] as const;
