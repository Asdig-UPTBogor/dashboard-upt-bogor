/**
 * BQ discovery — list dataset + table + schema langsung dari BigQuery.
 *
 * Tidak ada registry, tidak ada seed. Semua data real-time dari BQ.
 */

import { getBigQuery } from "./clients";
import type { ColumnMeta } from "@/app/data-input/_workspace/types";

/** Daftar dataset project current (sorted by id). */
export async function listDatasets(): Promise<DatasetInfo[]> {
    const bq = getBigQuery();
    const [datasets] = await bq.getDatasets();
    return datasets
        .map((d) => {
            const labels = (d.metadata?.labels as Record<string, string> | undefined) ?? {};
            const id = d.id ?? "";
            return {
                id,
                location: (d.metadata?.location as string | undefined) ?? "",
                description: (d.metadata?.description as string | undefined) ?? "",
                labels,
                friendlyName: (d.metadata?.friendlyName as string | undefined) ?? undefined,
                origin: detectOrigin(id, labels),
                platformName: labels.platform_name,
                ownerEmail: labels.owner_email,
            };
        })
        .filter((d) => d.id)
        .sort((a, b) => a.id.localeCompare(b.id));
}

/** BQ label `origin` → "user" | "platform" | "legacy".
 *  Prioritas:
 *    1. Label BQ eksplisit (wins if set)
 *    2. Known platform dataset list (auto-detect)
 *    3. Master_Data = user (dataset untuk Data Input pattern)
 *    4. Default "legacy" (existing Spreadsheet Sync dataset)
 *  Admin override via UI "Mark as Platform" / "Mark as User" tulis label BQ. */
export type DatasetOrigin = "user" | "platform" | "legacy";

/** Dataset yang di-maintain oleh platform Level 1/1E/2/3.
 *  Update list ini saat platform baru hadir. */
const PLATFORM_DATASETS = new Set([
    "thor_vaisala",                                  // Level 1 Thor (Vaisala lightning)
    "dispatch",                                       // Level 3 Dispatch (WA orchestration)
    "wagate",                                         // Level 3 WaGate (WA gateway)
    "notifier_logs",                                  // legacy Notifier (archived, but platform-origin)
    "waha",                                           // legacy WAHA (archived, but platform-origin)
    "Dashboard_Gardu_Induk_UPT_Bogor",               // Dashboard asset GI
    "MASTER_HIERARCHY_UPT_Bogor",                    // Master hierarchy (source migrate)
    "Master_Asset_Relay_UPT_Bogor",                  // Asset relay
    "Master_Jadwal_Padam_UPT_Bogor",                 // Jadwal padam
    "Master_Transmisi_UPT_Bogor",                    // Transmisi (tower, ROW, SLD)
    "Mirroring_Common_Enemy_Next_Level_UPT_Bogor",   // CE Next Level
    "Program_Kerja_Proteksi_UPT_Bogor",              // Program Kerja Proteksi
]);

/** Dataset "user" default — dibuat user via Data Input pattern. */
const USER_DATASETS = new Set([
    "Master_Data",    // Master Data (UPT/ULTG/GI/Bay) yg di-migrate untuk Data Input
]);

export function detectOrigin(dsId: string, labels: Record<string, string>): DatasetOrigin {
    if (labels.origin === "user") return "user";
    if (labels.origin === "platform") return "platform";
    if (labels.origin === "legacy") return "legacy";
    if (PLATFORM_DATASETS.has(dsId)) return "platform";
    if (USER_DATASETS.has(dsId)) return "user";
    return "legacy";
}

export async function getDataset(dsId: string): Promise<DatasetDetail | null> {
    const bq = getBigQuery();
    try {
        const ds = bq.dataset(dsId);
        const [exists] = await ds.exists();
        if (!exists) return null;
        const [meta] = await ds.getMetadata();
        const labels = (meta.labels as Record<string, string> | undefined) ?? {};
        const [tables] = await ds.getTables();
        const tableInfos: TableSummary[] = await Promise.all(
            tables.map(async (t) => {
                try {
                    const [tMeta] = await t.getMetadata();
                    return {
                        id: t.id ?? "",
                        type: String(tMeta.type ?? "TABLE"),
                        numRows: Number(tMeta.numRows ?? 0),
                        numBytes: Number(tMeta.numBytes ?? 0),
                        description: tMeta.description ?? "",
                        lastModified: tMeta.lastModifiedTime
                            ? new Date(Number(tMeta.lastModifiedTime)).toISOString()
                            : undefined,
                    };
                } catch {
                    return { id: t.id ?? "", type: "UNKNOWN", numRows: 0, numBytes: 0, description: "" };
                }
            })
        );
        return {
            id: dsId,
            location: (meta.location as string | undefined) ?? "",
            description: (meta.description as string | undefined) ?? "",
            labels,
            friendlyName: meta.friendlyName as string | undefined,
            origin: detectOrigin(dsId, labels),
            platformName: labels.platform_name,
            ownerEmail: labels.owner_email,
            creationTime: meta.creationTime ? new Date(Number(meta.creationTime)).toISOString() : undefined,
            lastModifiedTime: meta.lastModifiedTime ? new Date(Number(meta.lastModifiedTime)).toISOString() : undefined,
            tables: tableInfos,
        };
    } catch (err) {
        console.warn(`[bq-discovery] getDataset ${dsId} failed:`, err);
        return null;
    }
}

export async function getTableSchema(dsId: string, tableId: string): Promise<TableSchema | null> {
    const bq = getBigQuery();
    try {
        const [meta] = await bq.dataset(dsId).table(tableId).getMetadata();
        const fields: BqField[] = (meta.schema?.fields ?? []) as BqField[];
        // Pre-load FK registry so per-field sync mapping can use it
        await loadFkRegistry();
        const cols = fields.map((f) => bqFieldToColumnMetaSync(f, tableId));
        return {
            id: tableId,
            datasetId: dsId,
            description: (meta.description as string | undefined) ?? "",
            numRows: Number(meta.numRows ?? 0),
            numBytes: Number(meta.numBytes ?? 0),
            type: String(meta.type ?? "TABLE"),
            columns: applyDefaultColumnOrder(cols, tableId),
        };
    } catch (err) {
        console.warn(`[bq-discovery] getTableSchema ${dsId}.${tableId} failed:`, err);
        return null;
    }
}

/* ─── Types ──────────────────────────────────────────────── */

export interface DatasetInfo {
    id: string;
    location: string;
    description: string;
    labels: Record<string, string>;
    friendlyName?: string;
    origin: DatasetOrigin;
    platformName?: string;
    ownerEmail?: string;
}

export interface DatasetDetail extends DatasetInfo {
    creationTime?: string;
    lastModifiedTime?: string;
    tables: TableSummary[];
}

export interface TableSummary {
    id: string;
    type: string;
    numRows: number;
    numBytes: number;
    description: string;
    lastModified?: string;
}

export interface TableSchema {
    id: string;
    datasetId: string;
    description: string;
    numRows: number;
    numBytes: number;
    type: string;
    columns: ColumnMeta[];
}

interface BqField {
    name: string;
    type: string;
    mode?: string;
    description?: string;
}

/* ─── Helpers ────────────────────────────────────────────── */

/** Dynamic FK registry — hasil scan Master_Data dataset saat startup.
 *  Setiap Master table registered jadi kandidat FK target untuk kolom child.
 *  Pattern detect: kolom child ending `_id` + match PK master → auto REFERENCE. */
let _fkRegistry: Record<string, { dataset: string; table: string; displayCol: string }> | null = null;
let _fkRegistryLoadedAt = 0;
const FK_CACHE_MS = 5 * 60_000; // 5 menit

async function loadFkRegistry(): Promise<Record<string, { dataset: string; table: string; displayCol: string }>> {
    if (_fkRegistry && Date.now() - _fkRegistryLoadedAt < FK_CACHE_MS) return _fkRegistry;
    const bq = getBigQuery();
    const registry: Record<string, { dataset: string; table: string; displayCol: string }> = {};
    try {
        // Scan "Master_Data" dataset untuk auto-register. Ga hardcode per table.
        const ds = bq.dataset("Master_Data");
        const [exists] = await ds.exists();
        if (exists) {
            const [tables] = await ds.getTables();
            for (const t of tables) {
                const pk = inferPkName(t.id ?? "");
                const displayCol = inferDisplayColName(t.id ?? "");
                registry[pk] = { dataset: "Master_Data", table: t.id ?? "", displayCol };
            }
        }
    } catch (err) {
        console.warn("[fk-registry] scan failed:", err);
    }
    _fkRegistry = registry;
    _fkRegistryLoadedAt = Date.now();
    return registry;
}

function inferDisplayColName(tableId: string): string {
    const lc = tableId.toLowerCase();
    if (lc === "gardu_induk") return "gi_name";
    return `${lc}_name`;
}

/** Synchronous fallback — pakai cache kalau ada, else empty.
 *  loadFkRegistry() should be called first untuk populate. */
function fkRegistrySync(): Record<string, { dataset: string; table: string; displayCol: string }> {
    return _fkRegistry ?? {};
}

export async function bqFieldToColumnMeta(f: BqField, ownTableId?: string): Promise<ColumnMeta> {
    const bqType = normalizeBqType(f.type);
    const ownPk = ownTableId ? inferPkName(ownTableId) : null;
    const registry = await loadFkRegistry();
    const fkTarget = registry[f.name];

    if (fkTarget && f.name !== ownPk && fkTarget.table !== ownTableId) {
        return {
            name: f.name,
            type: "REFERENCE",
            mode: f.mode === "REQUIRED" ? "REQUIRED" : f.mode === "REPEATED" ? "REPEATED" : "NULLABLE",
            description: f.description,
            reference: {
                dataset: fkTarget.dataset,
                table: fkTarget.table,
                displayCol: fkTarget.displayCol,
                valueCol: f.name,
            },
            hidden: false,
            readOnly: false,
        };
    }

    return {
        name: f.name,
        type: bqType,
        mode: f.mode === "REQUIRED" ? "REQUIRED" : f.mode === "REPEATED" ? "REPEATED" : "NULLABLE",
        description: f.description,
        hidden: AUTO_HIDE.has(f.name) || f.name === ownPk,
        readOnly: AUTO_HIDE.has(f.name) || f.name === ownPk,
    };
}

/** Sync version untuk pemanggil yang sudah punya registry ter-load.
 *  Dipakai internal discovery untuk batch map. */
export function bqFieldToColumnMetaSync(f: BqField, ownTableId?: string): ColumnMeta {
    const bqType = normalizeBqType(f.type);
    const ownPk = ownTableId ? inferPkName(ownTableId) : null;
    const registry = fkRegistrySync();
    const fkTarget = registry[f.name];
    const alias = DEFAULT_ALIAS[f.name];

    if (fkTarget && f.name !== ownPk && fkTarget.table !== ownTableId) {
        return {
            name: f.name,
            alias,
            type: "REFERENCE",
            mode: f.mode === "REQUIRED" ? "REQUIRED" : f.mode === "REPEATED" ? "REPEATED" : "NULLABLE",
            description: f.description,
            reference: {
                dataset: fkTarget.dataset,
                table: fkTarget.table,
                displayCol: fkTarget.displayCol,
                valueCol: f.name,
            },
        };
    }

    return {
        name: f.name,
        alias,
        type: bqType,
        mode: f.mode === "REQUIRED" ? "REQUIRED" : f.mode === "REPEATED" ? "REPEATED" : "NULLABLE",
        description: f.description,
        hidden: AUTO_HIDE.has(f.name) || f.name === ownPk,
        readOnly: AUTO_HIDE.has(f.name) || f.name === ownPk,
    };
}

function inferPkName(tableId: string): string {
    const lc = tableId.toLowerCase();
    if (lc === "gardu_induk") return "gi_id";
    return `${lc}_id`;
}

/** Supabase-like default ordering:
 *   1. PK (hidden)
 *   2. Parent FK (REFERENCE — prominent, user butuh context)
 *   3. Display name (*_name)
 *   4. Attribute kolom lain
 *   5. Audit (hidden, paling bawah)
 */
function applyDefaultColumnOrder(cols: ColumnMeta[], tableId: string): ColumnMeta[] {
    const pk = inferPkName(tableId);
    function priority(c: ColumnMeta): number {
        if (c.name === pk) return 0;                       // PK first (biasa hidden)
        if (c.type === "REFERENCE") return 1;               // FK parent prominent
        if (c.name.endsWith("_name")) return 2;             // display name
        if (AUTO_HIDE.has(c.name)) return 9;                // audit terakhir
        return 5;                                            // atribut lain
    }
    return [...cols].sort((a, b) => {
        const pa = priority(a);
        const pb = priority(b);
        if (pa !== pb) return pa - pb;
        return 0; // stable
    }).map((c, i) => ({ ...c, order: i }));
}

export function normalizeBqType(t: string): ColumnMeta["type"] {
    const up = t.toUpperCase();
    if (up === "INTEGER") return "INT64";
    if (up === "FLOAT") return "FLOAT64";
    if (up === "BOOL" || up === "BOOLEAN") return "BOOL";
    if (up === "DATE") return "DATE";
    if (up === "TIMESTAMP" || up === "DATETIME") return "TIMESTAMP";
    if (up === "NUMERIC" || up === "BIGNUMERIC") return "NUMERIC";
    return "STRING";
}

export const AUTO_HIDE = new Set([
    "is_active",
    "valid_from", "valid_to",
    "created_by", "created_at",
    "updated_by", "updated_at",
]);

/** Default alias Indonesia-friendly untuk common column names (fallback kalau
 *  Firestore overlay belum set). Admin bisa override via Konfig Kolom. */
export const DEFAULT_ALIAS: Record<string, string> = {
    // Hirarki Master
    upt_id: "UPT", upt_name: "Nama UPT",
    ultg_id: "ULTG", ultg_name: "Nama ULTG",
    gi_id: "Gardu Induk", gi_name: "Nama Gardu Induk",
    bay_id: "Bay", bay_name: "Nama Bay",
    // Attributes umum
    voltage_kv: "Tegangan (kV)", voltage: "Tegangan",
    bay_function: "Fungsi Bay", bay_type: "Tipe Bay",
    gi_type: "Tipe Gardu Induk", status: "Status",
    address: "Alamat",
    latitude: "Latitude", longitude: "Longitude",
    commissioned_at: "Tanggal COD",
    // Audit (tetap hidden default, tapi kalau admin show → label jelas)
    is_active: "Status Aktif",
    valid_from: "Berlaku Sejak", valid_to: "Berlaku Sampai",
    created_by: "Dibuat Oleh", created_at: "Dibuat Pada",
    updated_by: "Diubah Oleh", updated_at: "Diubah Pada",
};

/** Heuristic PK detection: kolom pertama kalau tipe STRING atau INT, atau *_id. */
export function inferPrimaryKey(columns: ColumnMeta[], tableId: string): string | null {
    const lc = tableId.toLowerCase();
    const exactMatches = [`${lc}_id`, `id_${lc}`, "id"];
    for (const m of exactMatches) {
        const found = columns.find((c) => c.name.toLowerCase() === m);
        if (found) return found.name;
    }
    // Cari kolom yang ending dengan _id dan punya tipe STRING
    const idCol = columns.find((c) => c.name.toLowerCase().endsWith("_id") && c.type === "STRING");
    if (idCol) return idCol.name;
    return columns[0]?.name ?? null;
}

export function inferDisplayKey(columns: ColumnMeta[], tableId: string): string | null {
    const lc = tableId.toLowerCase();
    const exactMatches = [`${lc}_name`, `name`, `title`, tableId];
    for (const m of exactMatches) {
        const found = columns.find((c) => c.name.toLowerCase() === m.toLowerCase());
        if (found) return found.name;
    }
    // Cari kolom STRING yang bukan ID
    const strCol = columns.find(
        (c) => c.type === "STRING" && !c.name.toLowerCase().endsWith("_id") && !AUTO_HIDE.has(c.name)
    );
    return strCol?.name ?? null;
}
