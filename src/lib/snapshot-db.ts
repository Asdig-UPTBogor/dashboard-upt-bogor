/**
 * snapshot-db.ts — koneksi ke schema `dashboard_snapshot` di Supabase Postgres.
 *
 * SNAPSHOT SEMENTARA (2026-06-08): data CE + Program Kerja di-snapshot dari Sheet.
 * Read-only via role `dashboard_ro` lewat Supabase transaction pooler (port 6543).
 * Nanti diganti tabel actual sesuai desain final. Lihat docs/SNAPSHOT-PROGRAM-KERJA-CE.md.
 *
 * Env: SNAPSHOT_DB_URL (Vercel) — connection string role read-only.
 */
import { Pool } from "pg";

// Env-only (repo public — NO hardcoded password). Set di .env.local (dev) + Vercel env (prod).
const SNAPSHOT_DB_URL = process.env.SNAPSHOT_DB_URL || "";

// Singleton pool — reused across warm serverless invocations.
declare global {
    // eslint-disable-next-line no-var
    var __snapshotPool: Pool | undefined;
}

export function snapshotPool(): Pool {
    if (!SNAPSHOT_DB_URL) {
        throw new Error("SNAPSHOT_DB_URL belum di-set (env). Lihat snapshot-db.ts.");
    }
    if (!global.__snapshotPool) {
        global.__snapshotPool = new Pool({
            connectionString: SNAPSHOT_DB_URL,
            ssl: { rejectUnauthorized: false },
            max: 3,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
        });
    }
    return global.__snapshotPool;
}

export async function snapshotQuery<T = Record<string, unknown>>(
    text: string,
    params: unknown[] = []
): Promise<T[]> {
    const res = await snapshotPool().query(text, params);
    return res.rows as T[];
}
