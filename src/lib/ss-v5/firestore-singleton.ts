/**
 * Shared Firestore + BigQuery singleton untuk SS V5 routes.
 *
 * Next.js dev mode HMR sering bikin module re-execute, menyebabkan multiple
 * Firestore/BQ client instance yang hang di gRPC handshake. Store di globalThis
 * supaya survive HMR + tidak bikin leak connection.
 */
import { Firestore } from '@google-cloud/firestore';
import { BigQuery } from '@google-cloud/bigquery';
import { PROJECT } from './sql-generator';

type GlobalClients = {
    __ss_v5_fs?: Firestore;
    __ss_v5_bq?: BigQuery;
};

const g = globalThis as unknown as GlobalClients;

export function getFirestore(): Firestore {
    if (!g.__ss_v5_fs) {
        g.__ss_v5_fs = new Firestore({ projectId: PROJECT });
    }
    return g.__ss_v5_fs;
}

export function getBigQuery(): BigQuery {
    if (!g.__ss_v5_bq) {
        g.__ss_v5_bq = new BigQuery({ projectId: PROJECT });
    }
    return g.__ss_v5_bq;
}
