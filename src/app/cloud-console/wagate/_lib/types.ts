/**
 * WaGate — TypeScript types mirror of Firestore `service_runtime_configs/wagate`.
 * Schema reference: WAGATE_DESIGN.md §6 (11-section FS schema).
 */

export interface WaGateGroup {
    chat_id?: string;
    subject?: string;
    member_count?: number;
    last_synced?: string;
}

export interface BotIdentity {
    phone?: string;
    push_name?: string;
    jid?: string;
    registered_at?: string;
}

export interface ProviderSnapshot {
    status?: string;
    previous_status?: string;
    ws_connected?: boolean;
    reconnect_count?: number;
    probed_at?: string;
}

export interface QueueState {
    pending_count?: number;
    processing?: boolean;
    last_flush_at?: string;
}

export interface WaGateConfig {
    /* §1 Admin (editable) */
    IS_ACTIVE?: boolean;
    SESSION_NAME?: string;
    RECONNECT_MAX_RETRY?: number;
    QR_TIMEOUT_SEC?: number;
    WS_RECONNECT_BACKOFF_MS?: number;
    QUEUE_MAX_SIZE?: number;

    /* §2 Groups */
    groups?: Record<string, WaGateGroup>;

    /* §3 Bot identity (set after QR scan) */
    bot_identity?: BotIdentity;

    /* §4 Provider snapshot (real-time) */
    provider_snapshot?: ProviderSnapshot;

    /* §6 Infra — full parity with Dispatch */
    infra_type?: string;
    infra_project_id?: string;
    infra_service_name?: string;
    infra_revision?: string;
    infra_configuration?: string;
    infra_region?: string;
    infra_memory?: string;
    infra_runtime?: string;
    infra_port?: string | number;
    infra_cold_start_at?: string;
    infra_url?: string;
    infra_uid?: string;
    infra_description?: string | null;
    infra_labels?: Record<string, string> | null;
    infra_generation?: number;
    infra_created_at?: string;
    infra_last_deploy?: string;
    infra_creator?: string;
    infra_last_modifier?: string;
    infra_ingress?: string;
    infra_reconciling?: boolean;
    infra_latest_ready_revision?: string;
    infra_latest_created_revision?: string;
    infra_min_instances?: number;
    infra_max_instances?: number;
    infra_concurrency?: number;
    infra_timeout?: string;
    infra_service_account?: string;
    infra_execution_environment?: string;
    infra_session_affinity?: boolean;
    infra_vpc_connector?: string | null;
    infra_image?: string;
    infra_cpu?: string;

    /* §8 CC Standard */
    lastRun?: string | null;
    lastStatus?: 'sent' | 'failed' | 'queued' | 'received' | null;
    lastDurationMs?: number | null;

    /* §9 Operation Telemetry */
    LAST_OPERATION?: string | null;
    LAST_OPERATION_CHAT?: string | null;
    LAST_OPERATION_RESULT?: string | null;
    LAST_OPERATION_ERROR?: string | null;
    TOTAL_SENT_TODAY?: number;
    TOTAL_FAILED_TODAY?: number;
    TOTAL_RECEIVED_TODAY?: number;

    /* §10 Queue */
    queue_state?: QueueState;

    /* §11 Internal */
    _operation_count?: number;
    _daily_reset_date?: string;
}

/* ── Live API responses (from Dispatch proxy) ── */

export interface WaGateStatus {
    ok: boolean;
    name?: string;
    status?: string;
    engine?: { engine: string; version: string };
    me?: { id: string; pushName: string } | null;
    ws_connected?: boolean;
    uptime_sec?: number;
    session_start_at?: string | null;
    reconnect_count?: number;
    error?: string;
}

export interface WaGateMe {
    ok: boolean;
    id?: string;
    phone?: string;
    pushName?: string;
    platform?: string;
    error?: string;
}

export interface WaGateQr {
    ok: boolean;
    qr?: string;
    qr_text?: string;
    expires_in_sec?: number;
    current_state?: string;
    error?: string;
}

export interface WaGateGroupInfo {
    id: string;
    subject: string;
    owner?: string;
    participant_count?: number;
    is_admin?: boolean;
    created_at?: string;
}

/* ── BQ Log rows ── */

export interface DeliveryLogRow {
    event_id: string;
    operation: string;
    chat_id: string;
    chat_type: 'group' | 'personal';
    caller?: string | null;
    text?: string | null;
    status: 'sent' | 'failed' | 'queued';
    provider_message_id?: string | null;
    error?: string | null;
    duration_ms?: number | null;
    queued_at?: { value: string } | string | null;
    sent_at: { value: string } | string;
    ack_status?: number | null;
    ack_updated_at?: { value: string } | string | null;
    media_gcs_path?: string | null;
}

export interface MessageLogRow {
    event_id: string;
    message_id: string;
    timestamp_wib: { value: string } | string;
    direction: 'inbound' | 'outbound';
    from_id: string;
    from_name?: string | null;
    to_id: string;
    chat_type: 'personal' | 'group';
    body?: string | null;
    has_media: boolean;
    media_type?: string | null;
    media_gcs_path?: string | null;
    quoted_message_id?: string | null;
    inserted_at: { value: string } | string;
}

export interface EventLogRow {
    event_id: string;
    event_type: string;
    timestamp_wib: { value: string } | string;
    session: string;
    payload?: string | null;
    inserted_at: { value: string } | string;
}

export interface AuditLogRow {
    event_id: string;
    timestamp_wib: { value: string } | string;
    caller_type: 'service_account' | 'user' | 'system';
    caller_identity: string;
    action: string;
    resource?: string | null;
    result: 'success' | 'denied' | 'error';
    ip_address?: string | null;
    duration_ms?: number | null;
}
