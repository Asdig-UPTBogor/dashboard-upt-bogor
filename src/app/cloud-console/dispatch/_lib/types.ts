/**
 * Dispatch — TypeScript types for Cloud Console page.
 * Mirror of Firestore schema `service_runtime_configs/dispatch` (§1-§11).
 */

export interface DispatchGroup {
    wa_chat_id?: string;
    wa_group_name?: string | null;
    wa_member_count?: number | null;
    enabled?: boolean;
    added_at?: string | null;
    added_by?: string | null;
    verified_at?: string | null;
}

export interface ProviderSnapshot {
    provider?: string;
    connected?: boolean;
    bot_name?: string | null;
    bot_phone?: string | null;
    capabilities?: {
        has_restart?: boolean;
        has_list_groups?: boolean;
        has_message_history?: boolean;
    };
    probed_at?: string;
}

export interface DispatchConfig {
    /* §1 Admin */
    IS_ACTIVE?: boolean;
    ACTIVE_PROVIDER?: string;
    WAHA_API_URL?: string;
    WAHA_SESSION?: string;

    /* §2 Groups */
    groups?: Record<string, DispatchGroup>;

    /* §4 Provider snapshot */
    provider_snapshot?: ProviderSnapshot;

    /* §6 Infra — flat infra_* fields */
    infra_type?: string;
    infra_service_name?: string;
    infra_region?: string;
    infra_memory?: string;
    infra_timeout?: string;
    infra_url?: string;
    infra_runtime?: string;
    infra_port?: string | number;
    infra_cold_start_at?: string;
    infra_revision?: string;
    infra_latest_ready_revision?: string;
    infra_min_instances?: number;
    infra_max_instances?: number;
    infra_concurrency?: number;
    infra_cpu?: string;
    infra_ingress?: string;
    infra_created_at?: string;
    infra_last_deploy?: string;
    infra_service_account?: string;
    infra_image?: string;
    infra_execution_environment?: string;
    infra_generation?: number;
    infra_reconciling?: boolean;
    infra_uid?: string;
    infra_description?: string | null;
    infra_creator?: string;
    infra_last_modifier?: string;
    infra_session_affinity?: boolean;
    infra_vpc_connector?: string | null;
    infra_labels?: Record<string, string> | null;
    infra_project_id?: string;
    infra_configuration?: string;

    /* §7a Pub/Sub — flat pubsub_* fields */
    pubsub_topic?: string;
    pubsub_subscription?: string;
    pubsub_type?: 'push' | 'pull';
    pubsub_push_endpoint?: string | null;
    pubsub_ack_deadline?: number;
    pubsub_retry_min_backoff?: string | null;
    pubsub_retry_max_backoff?: string | null;
    pubsub_dlq_topic?: string | null;
    pubsub_max_delivery?: number | null;
    pubsub_filter?: string | null;
    pubsub_ordering?: boolean;
    pubsub_detached?: boolean;
    pubsub_subscription_count?: number;
    pubsub_updated_at?: string;

    /* §8 CC Standard */
    lastRun?: string | null;
    lastStatus?: 'delivered' | 'failed' | 'skipped' | 'dropped' | null;
    lastDurationMs?: number | null;

    /* §9 Delivery Telemetry */
    LAST_DELIVERY_GROUP?: string | null;
    LAST_DELIVERY_TYPE?: string | null;
    LAST_DELIVERY_STATUS?: string | null;
    LAST_DELIVERY_ERROR?: string | null;
    TOTAL_DELIVERED_TODAY?: number;
    TOTAL_FAILED_TODAY?: number;

    /* §11 Internal */
    _delivery_count?: number;
    _daily_reset_date?: string;
}

export interface DeliveryLogRow {
    event_id: string;
    pubsub_message_id?: string | null;
    group_key: string;
    group_name?: string | null;
    chat_id: string;
    source: string;
    channel: string;
    type: string;
    text?: string | null;
    provider: string;
    status: 'delivered' | 'failed' | 'skipped' | 'dropped';
    provider_message_id?: string | null;
    error?: string | null;
    priority?: string | null;
    duration_ms?: number | null;
    enqueued_at: { value: string } | string;
    delivered_at: { value: string } | string;
    image_gcs_path?: string | null;
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
    source?: string | null;
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

export interface WahaStatus {
    ok: boolean;
    status?: string;
    connected?: boolean;
    bot?: { name: string; phone: string } | null;
    extra?: {
        session?: string;
        engine?: string;
        me_id?: string | null;
        me_push_name?: string | null;
    };
    error?: string;
}
