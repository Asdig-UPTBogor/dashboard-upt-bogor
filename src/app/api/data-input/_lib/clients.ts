/**
 * Firestore + BigQuery singleton untuk Data Input Platform.
 *
 * Pattern sama dengan ss-v5 — store di globalThis supaya survive Next.js HMR,
 * hindari leak gRPC connection.
 */
import { Firestore } from "@google-cloud/firestore";
import { BigQuery } from "@google-cloud/bigquery";

export const PROJECT = "gcp-bridge-meshvpn";
export const MASTER_DATASET = "Master_Data";
export const PLATFORM_INTERNAL_DATASET = "platform_internal";

type GlobalClients = {
    __di_fs?: Firestore;
    __di_bq?: BigQuery;
};

const g = globalThis as unknown as GlobalClients;

export function getFirestore(): Firestore {
    if (!g.__di_fs) {
        // `preferRest: true` → HTTP/1.1 REST instead of gRPC.
        // Fixes Next.js 16 dev server DEADLINE_EXCEEDED issues (gRPC channel
        // sering stuck / macet setelah HMR). Latency similar (~500ms per write).
        g.__di_fs = new Firestore({ projectId: PROJECT, preferRest: true });
    }
    return g.__di_fs;
}

export function getBigQuery(): BigQuery {
    if (!g.__di_bq) g.__di_bq = new BigQuery({ projectId: PROJECT });
    return g.__di_bq;
}

export function fq(dataset: string, table: string): string {
    return `\`${PROJECT}.${dataset}.${table}\``;
}
