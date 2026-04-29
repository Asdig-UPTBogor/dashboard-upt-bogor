# Audit BE Data Input — Implementation vs Design Doc + BQ Reality

**Date:** 2026-04-24
**Canonical design:** `docs/DATA_WORKSPACE_DESIGN-iteasi dengan claude dekstop.md`
**Scope:** `src/app/api/data-input/*`

## Ringkasan

```
KATEGORI              COUNT   SEVERITY TERTINGGI
────────────────────────────────────────────────
Route gaps (missing)  3       HIGH  (batch-upsert, master dropdown, import)
Firestore divergence  1       LOW   (v0.3 lebih baik dari doc v0.1)
BQ reality breaks     4       HIGH  (audit_log missing, FK registry sempit,
                                     n_Master prefix, legacy no is_active)
Scalability issues    8       MED   (pagination, N+1 resolveChain, hardcode FK)
Security / bugs       7       CRIT  (dataset delete open), HIGH (actor body)
```

Arsitektur v0.3 secara keseluruhan **lebih baik dari doc v0.1** — namespace `/datasets/[ds]/tables/[t]` lebih skalabel, dynamic BQ discovery lebih benar, 3 Firestore collections terpisah lebih robust. Yang perlu dikerjakan bukan redesign, tapi gap-filling + konsistensi.

---

## 1. API Route Mapping

```
DOC ROUTE (v0.1)                     CURRENT ROUTE (v0.3)                                      STATUS
──────────────────────────────────────────────────────────────────────────────────────────────────────
GET  /{table}/rows                   GET  /datasets/[ds]/tables/[t]/rows                       PARTIAL
                                          - tidak ada: page, sort, order, filter params
                                          - ada: limit, includeArchived, resolveChain (bonus)
POST /{table}/batch-upsert           TIDAK ADA                                                 MISSING
                                          - ada POST /rows (insert 1), PATCH /rows (update 1)
                                          - ada POST /rows/batch (insert N), bukan upsert
                                          - no bulk update, no per-row conflict detect
GET  /{table}/config                 GET  /datasets/[ds]/tables/[t]                            EQUIVALENT
                                          - shape berbeda tapi fungsional
GET  /master/{table}                 TIDAK ADA dedicated master endpoint                       MISSING
                                          - master data dibaca via GET /rows biasa
                                          - no status=active default filter
                                          - no cache headers
POST /{table}/import                 TIDAK ADA                                                 MISSING
POST /{table}/validate               TIDAK ADA                                                 MISSING
DELETE /{table}/rows                 DELETE /datasets/[ds]/tables/[t]/rows                     EQUIVALENT
                                          - body shape berbeda, hanya 1 row per call
                                          - tidak ada: bulk delete, mode param

EXTRA (ada di current, tidak di doc) — ini benar-benar dibutuhkan:
  GET/POST/DELETE /datasets[/[ds]]          → dataset CRUD + auto-discover
  POST/DELETE /datasets/[ds]/tables[/[t]]   → table CRUD + audit cols
  POST /rows/batch                           → bulk insert streaming
  POST /rows/replace                         → soft-delete all (replace mode)
  PATCH /schema                              → patch column overlay FS
  POST/DELETE /columns[/[name]]              → ALTER TABLE ADD/DROP COLUMN
```

---

## 2. Firestore Schema Divergence

Design doc v0.1 pakai **1 collection** `table_configs/{ds}.{t}` dengan columns sebagai array.
Implementasi v0.3 pakai **3 collections** terpisah.

```
ASPEK                   DOC v0.1                      CURRENT v0.3                   IMPACT
───────────────────────────────────────────────────────────────────────────────────────────
Collection count        1                             3 (dataset/table/columns)      v0.3 lebih atomic
Doc ID separator        "Asset_Data.Relay" (.)        "Asset_Data__Relay" (__)       __ lebih aman FS
Column storage          array di doc utama             Map di collection terpisah    v0.3 aman >100 kolom
Doc size risk           1MB limit bisa kena            tiap kolom entry mandiri      v0.3 bebas
Schema type name        "dropdown"                    "CHOICE"                       mismatch → harus
                        "reference"                    "REFERENCE"                    normalize (pakai
                        "cascade"                      "CHOICE_CASCADE"               current name lbh baik)
                        "multi_reference"              BELUM ADA                      GAP
```

**Kesimpulan:** v0.3 naming (`data_platform_*`) lebih bersih, `__` separator lebih aman. Tidak perlu migrasi karena tidak ada data v0.1 legacy.

---

## 3. BQ Reality Check — 18 Dataset

```
DATASET                                  ORIGIN      NOTES
──────────────────────────────────────────────────────────────────────────────────
Master_Data                              user        5 tables, live aktif (Bay 337 row test)
Dashboard_Gardu_Induk_UPT_Bogor         platform    10 tables. Tidak ada is_active / UUID PK
                                                     → GET /rows SELECT * tanpa WHERE is_active
MASTER_HIERARCHY_UPT_Bogor              platform    5 tables n_Master_*. Prefix n_ BREAK
                                                     inferPkName() — pk auto-detect SALAH
Master_Asset_Relay_UPT_Bogor            platform    1 table, PK pattern unknown
Master_Jadwal_Padam_UPT_Bogor           platform    1 table
Master_Transmisi_UPT_Bogor              platform    9 tables (tower, ROW, SLD, petir, dll)
Mirroring_Common_Enemy_Next_Level_*     platform    3 CE tables
Program_Kerja_Proteksi_UPT_Bogor        platform    1 monitoring table
thor_vaisala · dispatch · wagate         platform    read-only via workspace
notifier_logs · waha                     platform    archived
platform_internal                        ?           audit_log target — BELUM DIBUAT di BQ
                                                     → audit.ts silently fail setiap operasi write
```

### Bug yang break karena tidak ada is_active / UUID PK

```
ISSUE                            AFFECTED                   FILE:LINE
─────────────────────────────────────────────────────────────────────────────────
GET /rows tanpa filter            Semua legacy + platform    rows/route.ts:99
is_active (hanya aktif kalau      tables                      "WHERE is_active IS NOT FALSE"
hasAudit=true)                                                 hanya aktif kalau hasAudit
inferPkName() salah untuk         MASTER_HIERARCHY tables    bq-discovery.ts:302
prefix n_Master_*                 "n_Master_GI" →             pk inferred salah
                                  "n_master_gi_id" (salah)
FK registry scan terbatas         Cross-dataset FK tidak     bq-discovery.ts:201-219
Master_Data saja                  terdeteksi sebagai          MISS: kolom FK di
                                  REFERENCE                   Dashboard_GI_UPT_Bogor
audit_log table belum ada         Setiap write operation     audit.ts
                                  silent fail (catch →        target: platform_internal.
                                  console.warn)                audit_log
```

---

## 4. Scalability Red Flags

### 4.1 SELECT * tanpa pagination
`rows/route.ts:100-104` — `SELECT * FROM fq(ds, t) LIMIT 20000`. No OFFSET/cursor/sort/filter params. Tabel 500k rows = full scan.

### 4.2 resolveChain N+1 sequential fetch
`rows/route.ts:59` — loop depth < 5 fetch `getTableSchema()` serial. 4 JOIN levels = ~800ms overhead sebelum query utama.

### 4.3 Hardcoded MASTER_FK di columns/route.ts (VIOLATES v0.3 mandate)
```ts
// columns/route.ts:17-22
const MASTER_FK: Record<string, {...}> = {
    UPT:  { table: "UPT",  valueCol: "upt_id",  displayCol: "upt_name" },
    ULTG: { table: "ULTG", ... },
    GI:   { table: "Gardu_Induk", ... },
    Bay:  { table: "Bay",  ... },
};
```
**SEVERITY: HIGH** — bertentangan langsung dengan mandate "NO hardcode per table". Relay_Brand, Relay_Type, Relay_Function tidak bisa di-link via Add Column wizard.

### 4.4 FK registry scan hanya Master_Data
`bq-discovery.ts:201-219` — 13 dataset lain tidak di-scan. Kolom FK di `Dashboard_Gardu_Induk_UPT_Bogor` tidak auto-detect sebagai REFERENCE.

### 4.5 `inferDisplayColName` magic constant
`bq-discovery.ts:221-225` — hardcode exception `gardu_induk → gi_name`. Tabel lain akan generate nama salah.

### 4.6 In-process memo tidak shared antar Cloud Run instance
`overlay-config.ts:51-61` — memo per-instance. Scale-out 2 instance = 2 memo berbeda. Stale data 2 min TTL.

### 4.7 FK registry cache juga in-process
`bq-discovery.ts:193-196` — sama, cold start N instance = N parallel scan.

### 4.8 Streaming insert tidak idempotent
`rows/batch/route.ts:113` — tidak pass insertId. Network retry = duplicate rows.

---

## 5. Critical Bugs / Security

### 5.1 actor dari request body — no authentication
`rows/route.ts:114`, `batch/route.ts:65`, `replace/route.ts:32` — `body.actor || "unknown@pln.co.id"`. Siapa saja bisa spoof audit log. **Accepted debt** (Phase 5 auth pending).

### 5.2 Hard delete tanpa FK reference check
`rows/route.ts:287-291` — DELETE FROM tabel langsung tanpa check child references. Design doc Section 7 mensyaratkan proteksi. **SEVERITY: HIGH** — orphan FK data corruption.

### 5.3 Conflict detection partial
`rows/route.ts:219-240` — 409 return tidak include `current_value`. FE tidak bisa resolve conflict. Design doc spec: `{status: "conflict", current: {...}}`.

### 5.4 Column name injection risk (low)
`rows/route.ts:206` — `col` interpolated ke SQL. Validasi `schemaNames.has(col)` mencegah injection, tapi pattern fragile. BQ tidak support parameterized column name (native limitation). Comment warning wajib.

### 5.5 fq() duplication
`replace/route.ts:46`, `columns/[name]/route.ts:71` — re-define local `fq` bukan import dari `clients.ts:31`. Duplicate logic.

### 5.6 DELETE dataset tanpa guard platform origin (CRITICAL)
`datasets/[ds]/route.ts:31-44` — `bq.dataset(ds).delete({ force })`. Bisa hapus `thor_vaisala`, `Master_Data`, `dispatch`. **SEVERITY: CRITICAL**. Harus cek `origin === "platform"` → tolak.

### 5.7 localStorage dirty state FE — belum diimplementasi
Design doc Section 5 mensyaratkan localStorage persist + beforeunload + conflict recovery. CLAUDE.md tertulis "Fitur BELUM". BE ready (PATCH conflict via updatedAtAtRead), FE gap.

---

## 6. Rekomendasi Migration Path (prioritized)

```
P0 (WAJIB SEKARANG)
───────────────────────────────────────────────────────────────────────────────
  ▸ Buat platform_internal.audit_log BQ table                 ~30 menit
    Schema: lihat audit.ts:36-48. Tanpa ini audit silent fail.
  ▸ Expand FK registry scan ke semua dataset "Master_*"       ~2 jam
    bq-discovery.ts:201 — loop semua "Master_*" + "Dashboard_*"
  ▸ Guard DELETE dataset/table untuk origin="platform"         ~1 jam
    datasets/[ds]/route.ts:31, tables/[t]/route.ts:57

P1 (CORE FEATURE GAP)
───────────────────────────────────────────────────────────────────────────────
  ▸ POST /rows/batch-upsert endpoint                          ~6 jam
    Body: {updates[], inserts[]}, conflict detect per-row
    Design doc Section 10 exact shape
  ▸ GET /master/[table] + cache headers                        ~3 jam
    Dropdown source untuk cascade + reference
  ▸ Hapus hardcode MASTER_FK di columns/route.ts              ~2 jam
    Pakai dynamic scan dari bq-discovery.ts FK registry
  ▸ Fix resolveChain parallel fetch                            ~1 jam
    rows/route.ts:59 — Promise.all() all parent schemas

P2 (POLISH + SECURITY)
───────────────────────────────────────────────────────────────────────────────
  ▸ Conflict detection return current_value di 409             ~1 jam
  ▸ Hard delete FK reference check                             ~4 jam
  ▸ Pagination GET /rows (page, offset, sort, order)           ~3 jam
  ▸ insertId untuk streaming insert idempotency                ~1 jam

P3 (DEFERRED)
───────────────────────────────────────────────────────────────────────────────
  ▸ actor dari session/auth (butuh Phase 5 decision)
  ▸ In-process memo → Firestore RTDB atau Redis (eventual consistency ok)
  ▸ POST /rows/import endpoint (Sprint 3 design doc)
```

---

## Files Essential untuk Konteks

- `src/app/api/data-input/_lib/bq-discovery.ts` — core discovery + FK + origin
- `src/app/api/data-input/_lib/overlay-config.ts` — Firestore 3-collection overlay
- `src/app/api/data-input/_lib/clients.ts` — BQ/FS singleton + `fq()` helper
- `src/app/api/data-input/_lib/audit.ts` — audit writer (silent fail sekarang)
- `src/app/api/data-input/datasets/[ds]/tables/[t]/rows/route.ts` — CRUD row + resolveChain
- `src/app/api/data-input/datasets/[ds]/tables/[t]/columns/route.ts` — MASTER_FK hardcode target
- `src/app/data-input/_workspace/types.ts` — AppColumnType union
- `docs/DATA_WORKSPACE_DESIGN-iteasi dengan claude dekstop.md` — spec reference
