/**
 * Audit log writer — platform_internal.audit_log BQ partitioned.
 *
 * Fire-and-forget: audit write tidak block main operation. Kalau gagal,
 * warn tapi tidak throw (idempotent, best-effort).
 */

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getBigQuery, PLATFORM_INTERNAL_DATASET, fq } from "./clients";

export type AuditAction =
    | "CREATE_ROW" | "UPDATE_ROW" | "DELETE_ROW"
    | "CREATE_COLUMN" | "DROP_COLUMN" | "RENAME_COLUMN"
    | "CREATE_TABLE" | "DELETE_TABLE"
    | "CREATE_DATASET" | "DELETE_DATASET"
    | "UPDATE_SCHEMA"
    | "REPLACE_ALL";

export interface AuditEntry {
    action: AuditAction;
    dataset?: string;
    table?: string;
    rowId?: string;
    column?: string;
    before?: unknown;
    after?: unknown;
    actor: string;
    ip?: string;
    userAgent?: string;
}

/** Fire-and-forget audit log write. Tidak throw — best-effort. */
export function logAudit(entry: AuditEntry): void {
    const bq = getBigQuery();
    const row = {
        event_id: randomUUID(),
        event_ts: new Date().toISOString(),
        user_email: entry.actor,
        action: entry.action,
        target_dataset: entry.dataset,
        target_table: entry.table,
        target_row_id: entry.rowId,
        target_column: entry.column,
        before_state: entry.before != null ? JSON.stringify(entry.before) : null,
        after_state: entry.after != null ? JSON.stringify(entry.after) : null,
        ip: entry.ip,
        user_agent: entry.userAgent,
    };

    bq.dataset(PLATFORM_INTERNAL_DATASET)
        .table("audit_log")
        .insert([row])
        .catch((err) => {
            console.warn(`[audit] Failed to log ${entry.action}:`, err instanceof Error ? err.message : err);
        });
}

/** Extract IP + UA dari Next.js request (best-effort). */
export function requestMeta(req: NextRequest): { ip?: string; userAgent?: string } {
    return {
        ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim()
            ?? req.headers.get("x-real-ip")
            ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
    };
}
